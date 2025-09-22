import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Secret key for JWT - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Load clients configuration
let clients = [];
const loadClients = async () => {
  try {
    // Try to load from environment-specified path first
    const clientsPath = process.env.CLIENTS_CONFIG_PATH
      ? path.resolve(__dirname, '..', process.env.CLIENTS_CONFIG_PATH)
      : path.join(__dirname, 'clients.json');

    const data = await fs.readFile(clientsPath, 'utf8');
    const config = JSON.parse(data);
    clients = config.clients || [];
    console.log(`Loaded ${clients.length} client configurations from ${clientsPath}`);
  } catch (error) {
    console.error('Error loading clients config:', error);
    // Fallback to environment-based single client if no config file
    if (process.env.CLIENT_USERNAME && process.env.CLIENT_PASSWORD_HASH) {
      clients = [{
        id: 'default',
        username: process.env.CLIENT_USERNAME,
        password: process.env.CLIENT_PASSWORD_HASH,
        name: process.env.PROJECT_NAME || 'Default Project',
        projectPath: process.env.PROJECT_PATH || '/home/ubuntu/projects/default',
        docsPath: path.join(process.env.PROJECT_PATH || '/home/ubuntu/projects/default', 'docs'),
        active: true
      }];
    }
  }
};

// Initialize clients on module load
await loadClients();

// Reload clients configuration (useful for dynamic updates)
export const reloadClients = async () => {
  await loadClients();
};

// Authenticate user with username and password
export const authenticateUser = async (username, password) => {
  const client = clients.find(c => c.username === username && c.active);

  if (!client) {
    return null;
  }

  // For development, allow plain text password matching if it starts with 'dev:'
  let isValidPassword = false;
  if (client.password.startsWith('dev:')) {
    isValidPassword = password === client.password.substring(4);
  } else {
    isValidPassword = await bcrypt.compare(password, client.password);
  }

  if (!isValidPassword) {
    return null;
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      id: client.id,
      username: client.username,
      projectPath: client.projectPath,
      docsPath: client.docsPath,
      name: client.name
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return {
    token,
    client: {
      id: client.id,
      username: client.username,
      name: client.name,
      projectPath: client.projectPath,
      docsPath: client.docsPath
    }
  };
};

// Verify JWT token
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Express middleware for authentication
export const authMiddleware = (req, res, next) => {
  // Skip auth for login endpoint
  if (req.path === '/api/auth/login' || req.path === '/api/auth/check') {
    return next();
  }

  // Skip auth if AUTH_ENABLED is explicitly set to false
  if (process.env.AUTH_ENABLED === 'false') {
    // Set default project path for non-authenticated mode
    req.user = {
      id: 'default',
      projectPath: process.env.PROJECT_PATH || '/Users/jonbennett/Dropbox/Coding-Main/rxion-web',
      docsPath: path.join(process.env.PROJECT_PATH || '/Users/jonbennett/Dropbox/Coding-Main/rxion-web', 'docs')
    };
    return next();
  }

  // Check for token in header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Attach user info to request
  req.user = decoded;
  next();
};

// Generate password hash utility
export const generatePasswordHash = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};