# Claude Web UI

A simple, secure web interface for Claude CLI that lets you interact with Claude in any project directory through your browser.

## Features

- 🚀 Real-time streaming responses from Claude CLI
- 🖼️ Image upload and analysis support
- 🔧 Full visibility of Claude's tool usage
- 💭 Display of Claude's thinking process
- 💾 Session persistence and continuation
- 🔐 Simple authentication per project
- 📁 Works with any project directory

## Quick Start

### Local Development
```bash
# Install dependencies
npm install
cd server && npm install && cd ..

# Configure auth (edit server/clients.json)
# Set your project path and password

# Start development servers
npm run dev           # Frontend on http://localhost:5173
cd server && npm run dev  # Backend on http://localhost:3001
```

### Production Deployment
See [VPS-SETUP.md](./VPS-SETUP.md) for detailed deployment instructions.

## Configuration

Edit `server/clients.json`:
```json
{
  "clients": [{
    "id": "main",
    "username": "admin",
    "password": "dev:your-password",
    "name": "Your Project",
    "projectPath": "/path/to/project",
    "active": true
  }]
}
```

## Requirements

- Node.js 20+
- Claude CLI installed and configured
- A project directory for Claude to work in

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Express, WebSocket
- **Auth**: JWT with simple JSON config
- **Persistence**: localStorage + Claude's JSONL files

## License

MIT
