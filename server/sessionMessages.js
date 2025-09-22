import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Get messages for a specific session
export async function getSessionMessages(projectPath, sessionId) {
  try {
    // Convert project path to Claude's format
    const projectDirName = projectPath.replace(/\//g, '-');
    const claudeProjectDir = path.join(os.homedir(), '.claude', 'projects', projectDirName);
    const sessionFile = path.join(claudeProjectDir, `${sessionId}.jsonl`);

    // Check if session file exists
    try {
      await fs.access(sessionFile);
    } catch {
      return []; // Session file doesn't exist
    }

    // Read and parse the session file
    const content = await fs.readFile(sessionFile, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    const messages = [];

    for (const line of lines) {
      try {
        const msg = JSON.parse(line);

        // Convert to our message format
        if (msg.role === 'user') {
          // Extract text from user message
          let text = '';
          if (Array.isArray(msg.content)) {
            for (const item of msg.content) {
              if (item.type === 'text') {
                text = item.text;
              } else if (item.type === 'tool_result') {
                // Add tool result as a system message
                messages.push({
                  id: item.tool_use_id,
                  role: 'system',
                  content: `📄 Tool result: ${item.content?.substring(0, 200)}...`,
                  timestamp: msg.timestamp || new Date().toISOString(),
                  isToolResult: true
                });
              }
            }
          } else {
            text = msg.content;
          }

          if (text) {
            messages.push({
              id: msg.id || Date.now().toString(),
              role: 'user',
              content: text,
              timestamp: msg.timestamp || new Date().toISOString()
            });
          }
        } else if (msg.role === 'assistant') {
          // Parse assistant message
          let text = '';
          const toolUses = [];

          if (Array.isArray(msg.content)) {
            for (const item of msg.content) {
              if (item.type === 'text') {
                text += item.text;
              } else if (item.type === 'tool_use') {
                toolUses.push({
                  id: item.id,
                  name: item.name,
                  input: item.input
                });
              }
            }
          } else {
            text = msg.content || '';
          }

          // Add tool uses as separate messages for clarity
          for (const tool of toolUses) {
            messages.push({
              id: tool.id,
              role: 'assistant',
              content: `🔧 Using ${tool.name}`,
              timestamp: msg.timestamp || new Date().toISOString(),
              isToolUse: true,
              toolName: tool.name,
              toolInput: tool.input
            });
          }

          // Add the text content if any
          if (text) {
            messages.push({
              id: msg.id || Date.now().toString(),
              role: 'assistant',
              content: text,
              timestamp: msg.timestamp || new Date().toISOString()
            });
          }
        }
      } catch (e) {
        console.error('Error parsing message:', e);
        // Skip malformed messages
      }
    }

    return messages;
  } catch (error) {
    console.error('Error reading session messages:', error);
    return [];
  }
}