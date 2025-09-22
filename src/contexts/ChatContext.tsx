import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Message, MessageType } from '@/components/messages/MessageRenderer';

interface ChatContextType {
  messages: Message[];
  isStreaming: boolean;
  currentStreamingId: string | null;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;
  setStreaming: (streaming: boolean, messageId?: string | null) => void;
  parseAndAddClaudeMessage: (data: any, messageId?: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamingId, setCurrentStreamingId] = useState<string | null>(null);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      // Filter out messages that are still streaming before saving
      const messagesToSave = messages.map(msg => ({
        ...msg,
        isStreaming: false // Don't save streaming state
      }));
      localStorage.setItem('claude-chat-messages', JSON.stringify(messagesToSave));
    }
  }, [messages]);

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newMessage: Message = {
      ...message,
      id,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, ...updates } : msg
    ));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setIsStreaming(false);
    setCurrentStreamingId(null);
    localStorage.removeItem('claude-chat-messages');
  }, []);

  const setStreaming = useCallback((streaming: boolean, messageId: string | null = null) => {
    setIsStreaming(streaming);
    setCurrentStreamingId(messageId);

    // When stopping streaming, mark all streaming messages as complete
    if (!streaming) {
      messages.forEach(msg => {
        if (msg.isStreaming) {
          updateMessage(msg.id, { isStreaming: false });
        }
      });
    } else if (messageId) {
      updateMessage(messageId, { isStreaming: streaming });
    }
  }, [messages, updateMessage]);

  const parseAndAddClaudeMessage = useCallback((data: any, messageId?: string) => {
    // Handle stream events for text and tool content
    if (data.data?.type === 'stream_event' && data.data?.event) {
      const event = data.data.event;

      // Handle text content block
      if (event.type === 'content_block_start' && event.content_block?.type === 'text') {
        const id = addMessage({
          type: 'text',
          role: 'assistant',
          content: '',
          isStreaming: true
        });
        return id;
      } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const textContent = event.delta.text || '';
        if (textContent) {
          const lastTextMsg = messages.slice().reverse().find(m =>
            m.type === 'text' && m.role === 'assistant' && m.isStreaming
          );
          if (lastTextMsg) {
            updateMessage(lastTextMsg.id, {
              content: (lastTextMsg.content || '') + textContent,
              isStreaming: true
            });
            return lastTextMsg.id;
          }
        }
      }
      return messageId;
    }

    // Handle stream-json format from Claude CLI
    if (data.data) {
      const msg = data.data;

      // Handle assistant messages with text or tool_use
      if (msg.type === 'assistant' && msg.message) {
        const content = msg.message.content;
        let returnId = messageId;

        if (Array.isArray(content)) {
          for (const item of content) {
            if (item.type === 'text') {
              // Add or append text to assistant message
              if (!messageId) {
                // Create new message
                const id = addMessage({
                  type: 'text',
                  role: 'assistant',
                  content: item.text,
                  isStreaming: true
                });
                returnId = id;
              } else {
                // Find existing message by ID
                const existingMsg = messages.find(m => m.id === messageId);
                if (existingMsg && existingMsg.type === 'text') {
                  updateMessage(messageId, {
                    content: (existingMsg.content || '') + item.text,
                    isStreaming: true
                  });
                  returnId = messageId;
                } else {
                  // Create new if not found
                  const id = addMessage({
                    type: 'text',
                    role: 'assistant',
                    content: item.text,
                    isStreaming: true
                  });
                  returnId = id;
                }
              }
            } else if (item.type === 'tool_use') {
              // Add tool use message immediately
              const toolId = addMessage({
                type: 'tool_use',
                role: 'assistant',
                toolName: item.name,
                toolInput: item.input,
                toolStatus: 'running'
              });
            } else if (item.type === 'thinking') {
              // Add thinking block
              const thinkingId = addMessage({
                type: 'thinking',
                role: 'assistant',
                content: item.thinking || item.text || ''
              });
            }
          }
        }
        return returnId;
      }

      // Handle user messages (tool results)
      if (msg.type === 'user' && msg.message) {
        const content = msg.message.content;
        if (Array.isArray(content)) {
          for (const item of content) {
            if (item.type === 'tool_result') {
              // Find the corresponding tool use message and update it
              const toolMsg = messages.slice().reverse().find(
                m => m.type === 'tool_use' && m.toolStatus === 'running'
              );
              if (toolMsg) {
                updateMessage(toolMsg.id, {
                  toolOutput: item.content,
                  toolStatus: item.is_error ? 'error' : 'success'
                });
              }
            }
          }
        }
        return messageId;
      }
    }

    // Parse different Claude message types (fallback for other formats)
    let messageType: MessageType = 'text';
    let content = '';
    let toolName = '';
    let toolInput = null;
    let toolOutput = '';
    let toolStatus: 'running' | 'success' | 'error' = 'running';

    // Handle thinking messages from Claude CLI stream events
    if (data.data?.type === 'stream_event' && data.data?.event) {
      const event = data.data.event;

      // Handle thinking content block
      if (event.type === 'content_block_start' && event.content_block?.type === 'thinking') {
        // Create new thinking block
        const id = addMessage({
          type: 'thinking',
          role: 'assistant',
          content: ''
        });
        return id;
      } else if (event.type === 'content_block_delta' && event.delta?.type === 'thinking_delta') {
        // Accumulate thinking content
        const lastThinking = messages.slice().reverse().find(m =>
          m.type === 'thinking' && m.role === 'assistant'
        );
        if (lastThinking) {
          updateMessage(lastThinking.id, {
            content: (lastThinking.content || '') + (event.delta.thinking || '')
          });
          return lastThinking.id;
        }
      }
    }

    // Handle thinking messages directly
    if (data.type === 'thinking' ||
        (data.data?.type === 'assistant' && data.data?.thinking)) {
      const thinkingContent = data.content || data.data?.thinking || '';

      if (thinkingContent) {
        const existingThinking = messages.slice().reverse().find(m =>
          m.type === 'thinking' && m.role === 'assistant'
        );

        if (existingThinking && messageId === existingThinking.id) {
          updateMessage(existingThinking.id, {
            content: (existingThinking.content || '') + thinkingContent
          });
          return existingThinking.id;
        } else {
          const id = addMessage({
            type: 'thinking',
            role: 'assistant',
            content: thinkingContent
          });
          return id;
        }
      }
    }

    // Handle tool use
    if (data.type === 'tool_use' ||
        (data.data?.type === 'assistant' && data.data?.message?.content?.[0]?.type === 'tool_use')) {
      messageType = 'tool_use';
      const toolData = data.data?.message?.content?.[0] || data;
      toolName = toolData.name || toolData.tool || 'Unknown Tool';
      toolInput = toolData.input || toolData.arguments;

      const id = messageId || addMessage({
        type: 'tool_use',
        role: 'assistant',
        toolName,
        toolInput,
        toolStatus: 'running'
      });
      return id;
    }

    // Handle tool results
    if (data.type === 'tool_result' ||
        (data.data?.type === 'user' && data.data?.message?.content?.[0]?.type === 'tool_result')) {
      const toolResult = data.data?.message?.content?.[0] || data;

      // Find the corresponding tool use message and update it
      const toolUseMessage = messages
        .slice()
        .reverse()
        .find(msg => msg.type === 'tool_use' && msg.toolStatus === 'running');

      if (toolUseMessage) {
        updateMessage(toolUseMessage.id, {
          toolOutput: toolResult.content || toolResult.output || '',
          toolStatus: toolResult.error ? 'error' : 'success'
        });
      }
      return toolUseMessage?.id;
    }

    // Handle regular text messages
    if (data.data?.type === 'assistant' && data.data?.message?.content) {
      const messageContent = data.data.message.content;

      if (Array.isArray(messageContent)) {
        for (const item of messageContent) {
          if (item.type === 'text' && item.text) {
            content += item.text;
          }
        }
      } else if (typeof messageContent === 'string') {
        content = messageContent;
      }
    }

    // Handle errors
    if (data.type === 'error' || data.type === 'claude-error') {
      const errorContent = data.error || data.message || data.data?.error || 'An error occurred';
      const id = addMessage({
        type: 'error',
        role: 'system',
        content: errorContent
      });
      return id;
    }

    // Add text message if we have content
    if (content) {
      // Find the most recent assistant text message that's streaming
      const existingStreamingMsg = messages.slice().reverse().find(m =>
        m.type === 'text' &&
        m.role === 'assistant' &&
        m.isStreaming
      );

      if (existingStreamingMsg) {
        // Append to existing streaming message
        updateMessage(existingStreamingMsg.id, {
          content: (existingStreamingMsg.content || '') + content,
          isStreaming: true
        });
        return existingStreamingMsg.id;
      } else {
        // Create new message
        const id = addMessage({
          type: 'text',
          role: 'assistant',
          content,
          isStreaming: true
        });
        return id;
      }
    }

    return messageId;
  }, [messages, addMessage, updateMessage]);

  const value = {
    messages,
    isStreaming,
    currentStreamingId,
    addMessage,
    updateMessage,
    clearMessages,
    setStreaming,
    parseAndAddClaudeMessage
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}