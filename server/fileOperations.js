import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default docs directory path - use the actual project's docs folder
const DEFAULT_PROJECT_PATH = process.env.PROJECT_PATH || '/Users/jonbennett/Dropbox/Coding-Main/rxion-web';
const DEFAULT_DOCS_DIR = path.join(DEFAULT_PROJECT_PATH, 'docs');

// Ensure docs directory exists (will be created on first operation)
async function ensureDocsDir(docsDir) {
  try {
    await fs.mkdir(docsDir, { recursive: true });
  } catch (error) {
    console.error('Error creating docs directory:', error);
  }
}

// Get file tree structure for the docs folder
export async function getFileTree(docsPath = DEFAULT_DOCS_DIR) {
  const docsDir = typeof docsPath === 'string' ? docsPath : DEFAULT_DOCS_DIR;

  // Ensure docs directory exists
  await ensureDocsDir(docsDir);

  async function readTree(dir, relativePath = '') {
    const items = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const itemPath = path.join(relativePath, entry.name);

        if (entry.isDirectory()) {
          const children = await readTree(fullPath, itemPath);
          items.push({
            name: entry.name,
            path: itemPath,
            type: 'directory',
            children
          });
        } else {
          const stats = await fs.stat(fullPath);
          items.push({
            name: entry.name,
            path: itemPath,
            type: 'file',
            size: stats.size,
            modified: stats.mtime
          });
        }
      }
    } catch (error) {
      console.error('Error reading directory:', error);
    }

    return items;
  }

  return readTree(docsDir);
}

// Read file content
export async function readFile(filePath, docsPath = DEFAULT_DOCS_DIR) {
  const docsDir = typeof docsPath === 'string' ? docsPath : DEFAULT_DOCS_DIR;

  try {
    const fullPath = path.join(docsDir, filePath);

    // Security check - ensure path doesn't escape docs directory
    const resolvedPath = path.resolve(fullPath);
    const resolvedDocsDir = path.resolve(docsDir);
    if (!resolvedPath.startsWith(resolvedDocsDir)) {
      throw new Error('Access denied: Path outside docs directory');
    }

    const content = await fs.readFile(fullPath, 'utf-8');
    const stats = await fs.stat(fullPath);

    return {
      content,
      size: stats.size,
      modified: stats.mtime
    };
  } catch (error) {
    throw error;
  }
}

// Write/update file
export async function writeFile(filePath, content, docsPath = DEFAULT_DOCS_DIR) {
  const docsDir = typeof docsPath === 'string' ? docsPath : DEFAULT_DOCS_DIR;

  try {
    const fullPath = path.join(docsDir, filePath);

    // Security check
    const resolvedPath = path.resolve(fullPath);
    const resolvedDocsDir = path.resolve(docsDir);
    if (!resolvedPath.startsWith(resolvedDocsDir)) {
      throw new Error('Access denied: Path outside docs directory');
    }

    // Create directory if it doesn't exist
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(fullPath, content, 'utf-8');

    const stats = await fs.stat(fullPath);
    return {
      success: true,
      size: stats.size,
      modified: stats.mtime
    };
  } catch (error) {
    throw error;
  }
}

// Delete file or directory
export async function deleteItem(itemPath, docsPath = DEFAULT_DOCS_DIR) {
  const docsDir = typeof docsPath === 'string' ? docsPath : DEFAULT_DOCS_DIR;

  try {
    const fullPath = path.join(docsDir, itemPath);

    // Security check
    const resolvedPath = path.resolve(fullPath);
    const resolvedDocsDir = path.resolve(docsDir);
    if (!resolvedPath.startsWith(resolvedDocsDir)) {
      throw new Error('Access denied: Path outside docs directory');
    }

    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      await fs.rmdir(fullPath, { recursive: true });
    } else {
      await fs.unlink(fullPath);
    }

    return { success: true };
  } catch (error) {
    throw error;
  }
}

// Create directory
export async function createDirectory(dirPath, docsPath = DEFAULT_DOCS_DIR) {
  const docsDir = typeof docsPath === 'string' ? docsPath : DEFAULT_DOCS_DIR;

  try {
    const fullPath = path.join(docsDir, dirPath);

    // Security check
    const resolvedPath = path.resolve(fullPath);
    const resolvedDocsDir = path.resolve(docsDir);
    if (!resolvedPath.startsWith(resolvedDocsDir)) {
      throw new Error('Access denied: Path outside docs directory');
    }

    await fs.mkdir(fullPath, { recursive: true });

    return { success: true };
  } catch (error) {
    throw error;
  }
}

// Rename file or directory
export async function renameItem(oldPath, newName, docsPath = DEFAULT_DOCS_DIR) {
  const docsDir = typeof docsPath === 'string' ? docsPath : DEFAULT_DOCS_DIR;

  try {
    const fullOldPath = path.join(docsDir, oldPath);
    const dir = path.dirname(fullOldPath);
    const fullNewPath = path.join(dir, newName);

    // Security check for both paths
    const resolvedOldPath = path.resolve(fullOldPath);
    const resolvedNewPath = path.resolve(fullNewPath);
    const resolvedDocsDir = path.resolve(docsDir);

    if (!resolvedOldPath.startsWith(resolvedDocsDir) || !resolvedNewPath.startsWith(resolvedDocsDir)) {
      throw new Error('Access denied: Path outside docs directory');
    }

    await fs.rename(fullOldPath, fullNewPath);

    return {
      success: true,
      newPath: path.relative(docsDir, fullNewPath)
    };
  } catch (error) {
    throw error;
  }
}

// Upload file from base64
export async function uploadFile(filePath, base64Content, docsPath = DEFAULT_DOCS_DIR) {
  const docsDir = typeof docsPath === 'string' ? docsPath : DEFAULT_DOCS_DIR;

  try {
    const fullPath = path.join(docsDir, filePath);

    // Security check
    const resolvedPath = path.resolve(fullPath);
    const resolvedDocsDir = path.resolve(docsDir);
    if (!resolvedPath.startsWith(resolvedDocsDir)) {
      throw new Error('Access denied: Path outside docs directory');
    }

    // Create directory if needed
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // Decode base64 and write file
    const buffer = Buffer.from(base64Content, 'base64');
    await fs.writeFile(fullPath, buffer);

    const stats = await fs.stat(fullPath);
    return {
      success: true,
      size: stats.size,
      modified: stats.mtime
    };
  } catch (error) {
    throw error;
  }
}