// Configuration for the AI SuperAgent
// This file handles both local development and VPS deployment

const isDevelopment = import.meta.env.DEV;

// Automatically detect the API URL based on the current environment
const getApiUrl = () => {
  if (isDevelopment) {
    // Local development
    return 'http://localhost:3001';
  }

  // Production/VPS - use same host as the UI
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;

  // If served from same server (recommended for VPS)
  if (window.location.port === '3000' || window.location.port === '') {
    return `${protocol}//${hostname}:3001`;
  }

  // If using a reverse proxy (nginx) on VPS
  return `${protocol}//${hostname}/api`;
};

export const config = {
  API_URL: import.meta.env.VITE_API_URL || getApiUrl(),
  WS_URL: import.meta.env.VITE_WS_URL || getApiUrl().replace('http', 'ws'),

  // Project settings
  DEFAULT_PROJECT_PATH: import.meta.env.VITE_PROJECT_PATH || '/home/ubuntu/projects/current',

  // Feature flags
  ENABLE_MULTI_PROJECT: import.meta.env.VITE_ENABLE_MULTI_PROJECT === 'true',
  ENABLE_FILE_BROWSER: import.meta.env.VITE_ENABLE_FILE_BROWSER !== 'false',

  // UI settings
  MAX_UPLOAD_SIZE: 50 * 1024 * 1024, // 50MB
  SESSION_STORAGE_KEY: 'claude-chat-messages',
  SESSION_ID_KEY: 'claude-session-id',
};

export default config;