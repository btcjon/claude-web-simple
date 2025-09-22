import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bot, Loader2, RotateCcw, LogOut } from 'lucide-react';
import { SessionSidebar } from '@/components/SessionSidebar';
import { Card } from '@/components/ui/card';
import { LoginForm } from '@/components/LoginForm';
import { MessageRenderer } from '@/components/messages/MessageRenderer';
import { ChatInput } from '@/components/ChatInput';
import { ChatProvider, useChatContext } from '@/contexts/ChatContext';
import config from '@/config';
import './App.css';


function ChatInterface() {
  const {
    messages,
    addMessage,
    updateMessage,
    clearMessages,
    setStreaming,
    parseAndAddClaudeMessage
  } = useChatContext();
  // Set document title
  useEffect(() => {
    document.title = 'AI SuperAgent';
  }, []);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // Check if user is already authenticated
    const token = localStorage.getItem('auth_token');
    return !!token;
  });
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('auth_token');
  });
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const userStr = localStorage.getItem('auth_user');
    return userStr ? JSON.parse(userStr) : null;
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showFileMention, setShowFileMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [referencedFiles, setReferencedFiles] = useState<Array<{ name: string; path: string }>>([]);

  // Handle login
  const handleLogin = (token: string, user: any) => {
    setAuthToken(token);
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('claude-chat-messages');
    localStorage.removeItem('claude-session-id');
    setAuthToken(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
    clearMessages();
    setSessionId(null);
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  // Check auth on mount and restore messages from localStorage
  useEffect(() => {
    if (authToken) {
      // Verify token is still valid
      fetch(`${config.API_URL}/api/auth/check`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })
      .then(res => {
        if (!res.ok) {
          throw new Error('Invalid token');
        }
        return res.json();
      })
      .then(() => {
        // Simply restore messages from localStorage (UI state only)
        const savedMessages = localStorage.getItem('claude-chat-messages');
        if (savedMessages) {
          try {
            const messages = JSON.parse(savedMessages);
            console.log('Restored', messages.length, 'messages from localStorage');
            // Restore each message to the UI
            messages.forEach((msg: any) => {
              addMessage({
                type: msg.type || 'text',
                role: msg.role,
                content: msg.content,
                toolName: msg.toolName,
                toolInput: msg.toolInput,
                toolOutput: msg.toolOutput,
                toolStatus: msg.toolStatus
              });
            });
          } catch (e) {
            console.error('Failed to restore messages:', e);
          }
        }
      })
      .catch(err => {
        console.error('Auth check failed:', err);
        handleLogout();
      });
    }
  }, [authToken, addMessage]);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();


  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    const scrollToBottom = () => {
      // Find the viewport element inside ScrollArea
      const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        // Use requestAnimationFrame for smoother scrolling
        requestAnimationFrame(() => {
          viewport.scrollTop = viewport.scrollHeight;
        });
      }
    };

    // Scroll immediately and after a short delay to catch any async updates
    scrollToBottom();
    const timeoutId = setTimeout(scrollToBottom, 150);

    return () => clearTimeout(timeoutId);
  }, [messages]);

  // API requests with authentication
  const fetchWithAuth = useCallback((url: string, options: RequestInit = {}) => {
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${authToken}`
      }
    });
  }, [authToken]);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    let currentStreamingMessageId: string | null = null;
    // Only connect if authenticated
    if (!isAuthenticated || !authToken) {
      console.log('Not authenticated, skipping WebSocket connection');
      return;
    }
    // Don't create a new connection if one already exists and is open/connecting
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      console.log('WebSocket already connected or connecting');
      return;
    }

    const wsUrl = import.meta.env.DEV
      ? 'ws://localhost:3001'
      : `ws://${window.location.host}`;

    try {
      // Include auth token in WebSocket URL as query param
      const wsUrlWithAuth = `${wsUrl}?token=${encodeURIComponent(authToken || '')}`;
      const ws = new WebSocket(wsUrlWithAuth);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        // Small delay to ensure WebSocket is fully ready
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            console.log('WebSocket ready for messages');
            // Session will be loaded from localStorage and server in the auth effect
          }
        }, 100);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received message:', data);

          switch (data.type) {
            case 'claude-response':
              // Handle structured JSON responses from Claude
              console.log('Claude response:', data.data);

              // Parse different message types from stream-json format
              if (data.data.type === 'system' && data.data.session_id) {
                // Use Claude's actual session ID
                setSessionId(data.data.session_id);
                console.log('Claude session ID:', data.data.session_id);
              } else if (data.data.type === 'stream_event') {
                // Handle streaming events and pass them to the parser
                console.log('Stream event:', data.data.event?.type);

                if (data.data.event?.type === 'message_start') {
                  // Start of a new message stream
                  setIsLoading(true);
                  setStreaming(true, null);
                  currentStreamingMessageId = null; // Reset for new stream
                } else if (data.data.event?.type === 'message_stop') {
                  // End of message stream
                  setIsLoading(false);
                  setStreaming(false, null);
                  currentStreamingMessageId = null;
                } else {
                  // Pass all content blocks to parser for real-time display
                  const newId = parseAndAddClaudeMessage(data, currentStreamingMessageId);
                  if (newId && !currentStreamingMessageId) {
                    currentStreamingMessageId = newId;
                  }
                }
              } else {
                // Use the context parser for all other message types
                // Maintain message ID for streaming accumulation
                if (data.data?.type === 'assistant') {
                  // For assistant messages, track the ID for accumulation
                  if (!currentStreamingMessageId) {
                    currentStreamingMessageId = data.messageId || Date.now().toString();
                  }
                  parseAndAddClaudeMessage(data, currentStreamingMessageId);
                } else {
                  // For other types, just parse normally
                  parseAndAddClaudeMessage(data, data.messageId);
                }
              }
              break;
            case 'claude-output':
              console.log('Claude output:', data.content);
              parseAndAddClaudeMessage({ content: data.content, type: 'text' }, data.messageId);
              break;
            case 'claude-error':
              console.error('Claude error:', data.error);
              parseAndAddClaudeMessage({ type: 'error', error: data.error });
              break;
            case 'claude-complete':
              console.log('Claude completed with exit code:', data.exitCode);
              setIsLoading(false);
              setStreaming(false, null);
              currentStreamingMessageId = null;
              break;
            case 'assistant_message':
              if (data.content && data.content.trim()) {
                parseAndAddClaudeMessage({
                  type: 'text',
                  data: { type: 'assistant', message: { content: data.content } }
                }, data.messageId);
              }
              setIsLoading(false);
              break;
            case 'chat_received':
              break;
            case 'interrupt-confirmed':
              console.log('Interrupt confirmed:', data.message);
              setIsLoading(false);
              addMessage({
                type: 'system',
                role: 'system',
                content: '✋ Stopped by user'
              });
              break;
            case 'error':
              console.error('Server error:', data.message);
              if (!data.message.includes('code 143')) {
                parseAndAddClaudeMessage({ type: 'error', error: data.message });
              }
              setIsLoading(false);
              break;
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connectWebSocket();
        }, 3000);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      connectWebSocket();
    }

    return () => {
      // Don't close WebSocket in development due to StrictMode double-render
      if (!import.meta.env.DEV) {
        if (wsRef.current) {
          wsRef.current.close();
        }
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket, isAuthenticated]);

  const handleInterrupt = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'interrupt',
        timestamp: new Date().toISOString()
      }));
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not ready, current state:', wsRef.current?.readyState);
      // Try to reconnect if needed
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connectWebSocket();
      }
      return;
    }

    let finalMessage = input;

    // If there are referenced files, append their contents
    if (referencedFiles.length > 0 && (window as any).fileContents) {
      finalMessage += '\n\n--- Referenced Files ---\n';
      for (const file of referencedFiles) {
        const content = (window as any).fileContents[file.path];
        if (content) {
          finalMessage += `\n### ${file.name}\n\`\`\`\n${content}\n\`\`\`\n`;
        }
      }
    }

    const messageId = Date.now().toString();

    // Add user message to chat
    addMessage({
      type: 'text',
      role: 'user',
      content: input
    });

    setInput('');
    setReferencedFiles([]);
    (window as any).fileContents = {};
    setIsLoading(true);

    try {
      // Build multimodal message if we have images
      let messageContent = finalMessage;
      const messageImages: Array<{name: string, data: string, mediaType: string}> = [];

      if (attachments.length > 0) {
        const imageFiles = attachments.filter(file => file.type.startsWith('image/'));

        for (const file of imageFiles) {
          const base64Data = await fileToBase64(file);
          messageImages.push({
            name: file.name,
            data: base64Data,
            mediaType: file.type
          });
        }
      }

      // Send multimodal message to server
      wsRef.current.send(JSON.stringify({
        type: 'chat',
        messageId,
        content: messageContent,
        images: messageImages,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      }));

      setAttachments([]);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
    }
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove data:type;base64, prefix
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle input change for @ mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // Check for @ symbol
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Check if there's no space after @ (still typing the mention)
      if (!textAfterAt.includes(' ')) {
        setMentionQuery(textAfterAt);
        setShowFileMention(true);

        // Calculate position for mention dropdown
        if (textareaRef.current) {
          const rect = textareaRef.current.getBoundingClientRect();
          setMentionPosition({
            top: 40, // Position above textarea
            left: 0
          });
        }
      } else {
        setShowFileMention(false);
      }
    } else {
      setShowFileMention(false);
    }
  };

  // Handle file selection from mention
  const handleFileMentionSelect = async (file: { name: string; path: string }) => {
    // Load file content
    try {
      const response = await fetch(`http://localhost:3001/api/files/${file.path}`);
      if (response.ok) {
        const data = await response.json();

        // Add to referenced files
        setReferencedFiles(prev => [...prev, file]);

        // Replace @ mention with file reference
        const cursorPosition = textareaRef.current?.selectionStart || 0;
        const textBeforeCursor = input.substring(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        const textAfterCursor = input.substring(cursorPosition);

        const newText =
          input.substring(0, lastAtIndex) +
          `@${file.name} ` +
          textAfterCursor;

        setInput(newText);
        setShowFileMention(false);
        setMentionQuery('');

        // Store file content to include in message
        if (!(window as any).fileContents) {
          (window as any).fileContents = {};
        }
        (window as any).fileContents[file.path] = data.content;
      }
    } catch (error) {
      console.error('Error loading file:', error);
    }
  };


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      setAttachments(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Handle session selection from sidebar
  const handleSessionSelect = async (selectedSessionId: string) => {
    console.log('Loading session:', selectedSessionId);
    setSessionId(selectedSessionId);
    localStorage.setItem('claude-session-id', selectedSessionId);

    // Load session messages from server
    try {
      const response = await fetch(`http://localhost:3001/api/sessions/${selectedSessionId}/messages`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (response.ok) {
        const sessionMessages = await response.json();
        console.log('Loaded session messages:', sessionMessages.length, 'messages');
        // Convert timestamps back to Date objects
        // Clear current messages and load session messages
        clearMessages();
        sessionMessages.forEach((msg: any) => {
          addMessage({
            type: msg.type || 'text',
            role: msg.role,
            content: msg.content
          });
        });
      } else {
        console.error('Failed to load session messages:', response.status);
      }
    } catch (error) {
      console.error('Error loading session messages:', error);
    }
  };

  // Handle starting a new session
  const handleNewSession = () => {
    clearMessages();
    setSessionId(null);
    localStorage.removeItem('claude-chat-messages');
    localStorage.removeItem('claude-session-id');
  };

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen bg-background dark flex flex-col">
      {/* Sidebar */}
      <SessionSidebar
        currentSessionId={sessionId}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
      />

      {/* Header with user info and logout */}
      <header className="border-b bg-card px-6 py-4 flex-shrink-0 pl-16">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">AI SuperAgent</h1>
              <div className="flex items-center gap-2">
                <Badge
                  variant={isConnected ? "default" : "secondary"}
                  className="text-xs"
                >
                  {isConnected ? "Connected" : "Connecting..."}
                </Badge>
                {sessionId && (
                  <Badge variant="outline" className="text-xs">
                    Session: {sessionId.slice(0, 8)}...
                  </Badge>
                )}
                {currentUser && (
                  <span className="text-sm text-muted-foreground">{currentUser.name}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
            <Button
              variant="outline"
            size="sm"
            onClick={() => {
              // Clear session and start fresh
              clearMessages();
              setSessionId(null);
              localStorage.removeItem('claude-chat-messages');
              localStorage.removeItem('claude-session-id');
            }}
            title="Start new session"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            New Session
          </Button>
          </div>
        </div>
      </header>

      {/* Chat Area - Fixed height with overflow */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full p-6" ref={scrollAreaRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Welcome to AI SuperAgent</h2>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.map((message) => (
                <MessageRenderer key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <Card className="bg-muted p-4 max-w-[70%]">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Claude is thinking...</span>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Input Area - Fixed at bottom */}
      <ChatInput
        input={input}
        setInput={setInput}
        onSend={handleSend}
        isLoading={isLoading}
        isConnected={isConnected}
        attachments={attachments}
        setAttachments={setAttachments}
        referencedFiles={referencedFiles}
        onFileMentionSelect={handleFileMentionSelect}
        showFileMention={showFileMention}
        setShowFileMention={setShowFileMention}
        mentionQuery={mentionQuery}
        setMentionQuery={setMentionQuery}
        mentionPosition={mentionPosition}
        setMentionPosition={setMentionPosition}
      />
    </div>
  );
}

function App() {
  return (
    <ChatProvider>
      <ChatInterface />
    </ChatProvider>
  );
}

export default App;