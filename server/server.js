import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { getClaudeSessions } from './sessions.js';
// Claude CLI handles session persistence internally via JSONL files
import {
  getFileTree,
  readFile,
  writeFile,
  deleteItem,
  createDirectory,
  renameItem,
  uploadFile
} from './fileOperations.js';
import { authenticateUser, authMiddleware, generatePasswordHash } from './auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
// Increase body size limit to 50MB for file uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(join(__dirname, '../dist')));

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await authenticateUser(username, password);

    if (result) {
      res.json(result);
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/check', authMiddleware, (req, res) => {
  res.json({
    authenticated: true,
    user: req.user
  });
});

// Apply auth middleware to all other API routes
app.use('/api', authMiddleware);

// API endpoint to get sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const projectPath = req.user.projectPath || process.env.PROJECT_PATH || '/Users/jonbennett/Dropbox/Coding-Main/rxion-web';
    const sessions = await getClaudeSessions(projectPath);
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Claude CLI handles session persistence - messages are saved automatically to JSONL files
// We don't need separate endpoints for loading/saving messages

// File operations API endpoints
app.get('/api/files', async (req, res) => {
  try {
    const fileTree = await getFileTree(req.user.docsPath);
    res.json(fileTree);
  } catch (error) {
    console.error('Error fetching file tree:', error);
    res.status(500).json({ error: 'Failed to fetch file tree' });
  }
});

app.get('/api/files/*', async (req, res) => {
  try {
    const filePath = req.params[0];
    const fileContent = await readFile(filePath, req.user.docsPath);
    res.json(fileContent);
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

app.put('/api/files/*', async (req, res) => {
  try {
    const filePath = req.params[0];
    const { content } = req.body;
    const result = await writeFile(filePath, content, req.user.docsPath);
    res.json(result);
  } catch (error) {
    console.error('Error writing file:', error);
    res.status(500).json({ error: 'Failed to write file' });
  }
});

app.delete('/api/files/*', async (req, res) => {
  try {
    const itemPath = req.params[0];
    const result = await deleteItem(itemPath, req.user.docsPath);
    res.json(result);
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

app.post('/api/files/directory', async (req, res) => {
  try {
    const { path } = req.body;
    const result = await createDirectory(path, req.user.docsPath);
    res.json(result);
  } catch (error) {
    console.error('Error creating directory:', error);
    res.status(500).json({ error: 'Failed to create directory' });
  }
});

app.post('/api/files/rename', async (req, res) => {
  try {
    const { oldPath, newName } = req.body;
    const result = await renameItem(oldPath, newName, req.user.docsPath);
    res.json(result);
  } catch (error) {
    console.error('Error renaming item:', error);
    res.status(500).json({ error: 'Failed to rename item' });
  }
});

app.post('/api/files/upload', async (req, res) => {
  try {
    const { path, content } = req.body;
    const result = await uploadFile(path, content, req.user.docsPath);
    res.json(result);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Store active Claude Code processes with session tracking
const activeProcesses = new Map();

// Store client connections
const clients = new Map();

// Store Claude processes by client for interrupt capability
const claudeProcesses = new Map();

// WebSocket connection handler
wss.on('connection', (ws) => {
  const clientId = Date.now().toString();
  clients.set(clientId, { ws, process: null });

  console.log(`Client ${clientId} connected`);

  // Send initial connection message
  ws.send(JSON.stringify({
    type: 'connection',
    status: 'connected',
    clientId,
    message: 'Connected to Claude Web Server'
  }));

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`Received message from ${clientId}:`, message);

      switch (message.type) {
        case 'chat':
          await handleChatMessage(clientId, message);
          break;
        case 'upload':
          await handleFileUpload(clientId, message);
          break;
        case 'command':
          await handleCommand(clientId, message);
          break;
        case 'interrupt':
          handleInterrupt(clientId);
          break;
        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${message.type}`
          }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });

  ws.on('close', () => {
    console.log(`Client ${clientId} disconnected`);
    // Clean up Claude Code process if exists
    const client = clients.get(clientId);
    if (client?.process) {
      client.process.kill();
    }
    clients.delete(clientId);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
  });
});

// Handle chat messages with Claude Code
async function handleChatMessage(clientId, message) {
  const client = clients.get(clientId);
  if (!client) return;

  const { ws } = client;

  try {
    // Send acknowledgment
    ws.send(JSON.stringify({
      type: 'chat_received',
      messageId: message.messageId,
      timestamp: new Date().toISOString()
    }));

    // Claude CLI automatically saves messages to JSONL files

    // Generate response message ID
    const responseMessageId = Date.now().toString();

    // Handle images by saving to temp files
    let imagePaths = [];
    if (message.images && message.images.length > 0) {
      const tempDir = join(__dirname, 'temp', clientId);
      await fs.mkdir(tempDir, { recursive: true });

      for (const img of message.images) {
        const filename = `image_${Date.now()}_${Math.random().toString(36).substring(7)}.${img.mediaType.split('/')[1]}`;
        const filepath = join(tempDir, filename);
        const buffer = Buffer.from(img.data, 'base64');
        await fs.writeFile(filepath, buffer);
        imagePaths.push(filepath);
      }
    }

    // Call Claude with file paths instead of base64 images
    const response = await callClaudeAPI(message.content, ws, responseMessageId, clientId, message.sessionId, imagePaths);

    // Send final complete message
    ws.send(JSON.stringify({
      type: 'assistant_message',
      messageId: responseMessageId,
      content: response,
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    console.error('Error handling chat message:', error);

    let errorMessage = 'Failed to process message';

    if (error.message.includes('command not found') || error.message.includes('ENOENT')) {
      errorMessage = "Claude CLI is not installed. Please make sure you can run 'claude' command in your terminal.";
    } else if (error.message.includes('timed out')) {
      errorMessage = "Claude request timed out. Please try again.";
    } else {
      errorMessage = `Error: ${error.message}`;
    }

    ws.send(JSON.stringify({
      type: 'error',
      message: errorMessage
    }));
  }
}

// Initialize Claude Code process for a client
async function initializeClaudeProcess(clientId) {
  const client = clients.get(clientId);
  if (!client) return;

  try {
    // Create a temporary workspace for this client
    const workspaceDir = join(__dirname, 'workspaces', clientId);
    await fs.mkdir(workspaceDir, { recursive: true });

    // Start Claude Code process
    const claudeProcess = spawn('claude-code', ['--api'], {
      cwd: workspaceDir,
      env: {
        ...process.env,
        CLAUDE_CODE_API_KEY: process.env.CLAUDE_CODE_API_KEY
      }
    });

    claudeProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Claude output for ${clientId}:`, output);

      // Send output to client
      client.ws.send(JSON.stringify({
        type: 'claude_output',
        content: output,
        timestamp: new Date().toISOString()
      }));
    });

    claudeProcess.stderr.on('data', (data) => {
      console.error(`Claude error for ${clientId}:`, data.toString());
    });

    claudeProcess.on('close', (code) => {
      console.log(`Claude process for ${clientId} exited with code ${code}`);
      client.process = null;
    });

    client.process = claudeProcess;
    activeProcesses.set(clientId, claudeProcess);

  } catch (error) {
    console.error('Error initializing Claude process:', error);
    throw error;
  }
}

// Handle file uploads
async function handleFileUpload(clientId, message) {
  const client = clients.get(clientId);
  if (!client) return;

  const { ws } = client;

  try {
    const { files } = message;

    // Process uploaded files
    const processedFiles = [];
    for (const file of files) {
      // Save file to workspace
      const workspaceDir = join(__dirname, 'workspaces', clientId);
      const filePath = join(workspaceDir, 'uploads', file.name);

      await fs.mkdir(join(workspaceDir, 'uploads'), { recursive: true });
      await fs.writeFile(filePath, Buffer.from(file.data, 'base64'));

      processedFiles.push({
        name: file.name,
        path: filePath,
        size: file.size,
        type: file.type
      });
    }

    ws.send(JSON.stringify({
      type: 'upload_complete',
      files: processedFiles,
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    console.error('Error handling file upload:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to process file upload'
    }));
  }
}

// Handle commands
async function handleCommand(clientId, message) {
  const client = clients.get(clientId);
  if (!client) return;

  const { ws } = client;
  const { command, args } = message;

  try {
    switch (command) {
      case 'clear':
        // Clear conversation history
        ws.send(JSON.stringify({
          type: 'command_response',
          command: 'clear',
          status: 'success'
        }));
        break;

      case 'reset':
        // Reset Claude Code process
        if (client.process) {
          client.process.kill();
          client.process = null;
        }
        await initializeClaudeProcess(clientId);
        ws.send(JSON.stringify({
          type: 'command_response',
          command: 'reset',
          status: 'success'
        }));
        break;

      case 'status':
        // Get status
        ws.send(JSON.stringify({
          type: 'command_response',
          command: 'status',
          data: {
            connected: true,
            claudeActive: !!client.process,
            clientId
          }
        }));
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown command: ${command}`
        }));
    }
  } catch (error) {
    console.error('Error handling command:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to execute command'
    }));
  }
}

// Call Claude using claude CLI with proper streaming
async function callClaudeAPI(userMessage, ws, messageId, clientId, sessionId = null, imagePaths = []) {
  return new Promise((resolve, reject) => {
    try {
      console.log('Calling Claude with message:', userMessage);
      if (sessionId) {
        console.log('Continuing session:', sessionId);
      }

      // Run in project directory to have context about the actual project
      // Get project path from WebSocket connection's auth token
      const projectPath = ws.projectPath || process.env.PROJECT_PATH || '/Users/jonbennett/Dropbox/Coding-Main/rxion-web';

      // Use stream-json format with proper flags for streaming
      const args = ['--print', '--output-format', 'stream-json', '--include-partial-messages', '--verbose'];

      // Add temp directory to allowed paths if we have images
      if (imagePaths && imagePaths.length > 0) {
        const tempDir = dirname(imagePaths[0]);
        args.push('--add-dir', tempDir);
      }

      // Add continue flag if we have a session ID
      if (sessionId) {
        args.push('--continue');
        // Note: Claude CLI uses --continue to resume the most recent session
        // We might need to use --resume with session ID if available
      }

      // Use full path to claude on Linux/VPS, or just 'claude' on other systems
      const claudeCommand = process.platform === 'linux' ? '/usr/bin/claude' : 'claude';

      const claudeProcess = spawn(claudeCommand, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: projectPath,
        env: process.env
      });

      // Store process for interrupt capability
      claudeProcesses.set(clientId, claudeProcess);

      let fullResponse = '';
      let buffer = '';
      let sessionMessages = [];
      let currentThinking = null;
      let currentTool = null;

      // Construct message with image paths if present
      let fullMessage = userMessage;
      if (imagePaths && imagePaths.length > 0) {
        // Add image references that Claude CLI will read using the Read tool
        fullMessage += '\n\nI have attached the following images for you to analyze:\n';
        imagePaths.forEach((path, index) => {
          fullMessage += `\nImage ${index + 1}: ${path}`;
        });
        fullMessage += '\n\nPlease use the Read tool to view and analyze these images.';
      }

      // Send plain text message (Claude CLI will use Read tool for image paths)
      claudeProcess.stdin.write(fullMessage + '\n');
      claudeProcess.stdin.end();

      // Handle stdout - parse JSON line by line
      claudeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        console.log('Claude stdout chunk:', chunk.substring(0, 200)); // Debug log
        buffer += chunk;
        const lines = buffer.split('\n');

        // Keep incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              // Try to parse as JSON
              const jsonData = JSON.parse(line);
              console.log('Parsed JSON:', jsonData.type || 'unknown type'); // Debug log

              // Send structured response
              if (ws && ws.readyState === 1) { // Use numeric constant for OPEN
                ws.send(JSON.stringify({
                  type: 'claude-response',
                  messageId,
                  data: jsonData,
                  timestamp: new Date().toISOString()
                }));
              }

              // Track messages for session persistence
              if (sessionId && jsonData.type === 'assistant' && jsonData.message) {
                const content = jsonData.message.content;
                if (Array.isArray(content)) {
                  for (const item of content) {
                    if (item.type === 'thinking') {
                      currentThinking = { type: 'thinking', content: item.thinking || '' };
                    } else if (item.type === 'tool_use') {
                      currentTool = {
                        type: 'tool_use',
                        toolName: item.name,
                        toolInput: item.input,
                        toolStatus: 'running'
                      };
                      sessionMessages.push({
                        ...currentTool,
                        role: 'assistant',
                        timestamp: new Date().toISOString()
                      });
                    } else if (item.type === 'text' && item.text) {
                      fullResponse += item.text;
                    }
                  }
                }
              }

              // Extract text content if available
              if (jsonData.content) {
                fullResponse += jsonData.content;
              } else if (jsonData.text) {
                fullResponse += jsonData.text;
              } else if (jsonData.message && typeof jsonData.message === 'string') {
                fullResponse += jsonData.message;
              }
            } catch (parseError) {
              // Not JSON, send as raw output
              console.log('Raw output line:', line.substring(0, 100)); // Debug log
              if (ws && ws.readyState === 1) { // Use numeric constant for OPEN
                ws.send(JSON.stringify({
                  type: 'claude-output',
                  messageId,
                  content: line,
                  timestamp: new Date().toISOString()
                }));
              }
              fullResponse += line + '\n';
            }
          }
        }
      });

      // Handle stderr
      claudeProcess.stderr.on('data', (data) => {
        const errorMsg = data.toString();
        console.error('Claude stderr:', errorMsg);

        // Only send non-debug messages as errors
        if (!errorMsg.includes('[DEBUG]') && ws && ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'claude-error',
            messageId,
            error: errorMsg,
            timestamp: new Date().toISOString()
          }));
        }
      });

      // Handle process completion
      claudeProcess.on('close', async (code) => {
        console.log(`Claude process exited with code ${code}`);

        // Clean up process tracking
        claudeProcesses.delete(clientId);

        // Claude CLI automatically saves all messages to JSONL files

        // Send completion message
        if (ws && ws.readyState === 1) { // Use numeric constant for OPEN
          ws.send(JSON.stringify({
            type: 'claude-complete',
            messageId,
            exitCode: code,
            timestamp: new Date().toISOString()
          }));
        }

        // Exit code 143 is SIGTERM (interrupted), which is normal for stop button
        if (fullResponse || code === 0 || code === 143) {
          resolve(fullResponse.trim() || (code === 143 ? 'Process interrupted' : 'Process completed'));
        } else {
          reject(new Error(`Claude process exited with code ${code}`));
        }
      });

      claudeProcess.on('error', (error) => {
        console.error('Claude process error:', error);
        claudeProcesses.delete(clientId);
        reject(error);
      });

      // Timeout after 10 minutes for complex operations
      const timeout = setTimeout(() => {
        claudeProcess.kill('SIGTERM');
        claudeProcesses.delete(clientId);
        reject(new Error('Claude request timed out after 10 minutes'));
      }, 600000); // 10 minutes

      // Clear timeout if process completes
      claudeProcess.on('exit', () => {
        clearTimeout(timeout);
      });

    } catch (error) {
      console.error('Error calling Claude:', error);
      claudeProcesses.delete(clientId);
      reject(error);
    }
  });
}

// Handle interrupt/abort request
function handleInterrupt(clientId) {
  const client = clients.get(clientId);
  if (!client) return;

  const claudeProcess = claudeProcesses.get(clientId);
  if (claudeProcess) {
    console.log(`🛑 Interrupting Claude process for client ${clientId}`);

    // Send SIGTERM to gracefully terminate
    claudeProcess.kill('SIGTERM');

    // Remove from tracking
    claudeProcesses.delete(clientId);

    // Send confirmation to client
    client.ws.send(JSON.stringify({
      type: 'interrupt-confirmed',
      message: 'Claude process interrupted',
      timestamp: new Date().toISOString()
    }));
  } else {
    client.ws.send(JSON.stringify({
      type: 'error',
      message: 'No active Claude process to interrupt',
      timestamp: new Date().toISOString()
    }));
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    clients: clients.size,
    activeProcesses: activeProcesses.size
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

// Cleanup on server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');

  // Kill all Claude processes
  for (const [clientId, process] of activeProcesses) {
    console.log(`Killing process for client ${clientId}`);
    process.kill();
  }

  // Close WebSocket connections
  for (const [clientId, client] of clients) {
    console.log(`Closing connection for client ${clientId}`);
    client.ws.close();
  }

  server.close(() => {
    console.log('Server shut down');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Claude Web Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
});