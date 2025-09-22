import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Get Claude sessions for the current project
export async function getClaudeSessions(projectPath) {
  const sessions = [];

  try {
    // Convert project path to Claude's format (replace / with -)
    // Note: Claude adds a leading dash, so /Users/... becomes -Users-...
    const projectDirName = projectPath.replace(/\//g, '-');
    const claudeProjectDir = path.join(os.homedir(), '.claude', 'projects', projectDirName);

    // Check if project directory exists
    try {
      await fs.access(claudeProjectDir);
    } catch {
      return sessions; // No sessions for this project
    }

    // Read all .jsonl files in the project directory
    const files = await fs.readdir(claudeProjectDir);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    // Get metadata for each session file
    for (const file of jsonlFiles) {
      const filePath = path.join(claudeProjectDir, file);
      const stats = await fs.stat(filePath);
      const sessionId = file.replace('.jsonl', '');

      // Try to read first and last message for summary
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());

      let firstUserMessage = '';
      let lastAssistantMessage = '';
      let messageCount = 0;

      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          messageCount++;

          if (msg.role === 'user' && !firstUserMessage && msg.content) {
            // Extract text from content if it's an array
            if (Array.isArray(msg.content)) {
              const textContent = msg.content.find(c => c.type === 'text');
              firstUserMessage = textContent?.text || '';
            } else {
              firstUserMessage = msg.content;
            }
          }

          if (msg.role === 'assistant' && msg.content) {
            // Extract text from content if it's an array
            if (Array.isArray(msg.content)) {
              const textContent = msg.content.find(c => c.type === 'text');
              lastAssistantMessage = textContent?.text || '';
            } else {
              lastAssistantMessage = msg.content;
            }
          }
        } catch (e) {
          // Skip malformed JSON lines
        }
      }

      sessions.push({
        id: sessionId,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
        firstMessage: firstUserMessage.substring(0, 100) + (firstUserMessage.length > 100 ? '...' : ''),
        lastResponse: lastAssistantMessage.substring(0, 100) + (lastAssistantMessage.length > 100 ? '...' : ''),
        messageCount,
        projectPath
      });
    }

    // Sort sessions by last updated, newest first
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);

  } catch (error) {
    console.error('Error reading Claude sessions:', error);
  }

  return sessions;
}