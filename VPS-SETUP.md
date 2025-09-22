# VPS Setup Guide for Claude Web UI

## Quick Setup

### 1. Prerequisites on VPS
```bash
# Install Claude CLI
curl -fsSL https://storage.googleapis.com/code.cla8ude.ai/install.sh | bash

# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2
```

### 2. Deploy the App
```bash
# Clone the repository
git clone [your-repo] ~/claude-web-ui
cd ~/claude-web-ui

# Install dependencies
npm install
cd server && npm install && cd ..

# Build the frontend
npm run build
```

### 3. Configure for Your Project

Edit `server/clients.json` with your project details:
```json
{
  "clients": [
    {
      "id": "main",
      "username": "admin",
      "password": "dev:your-password-here",
      "name": "Your Project Name",
      "projectPath": "/path/to/your/project",
      "docsPath": "/path/to/your/project/docs",
      "active": true
    }
  ]
}
```

**Simple Auth Notes:**
- Use `dev:password` format for plain text passwords (simple but works)
- Or use bcrypt hashed passwords for production (more secure)
- Single username/password per project
- No complex user management

### 4. Start with PM2
```bash
# Start the server
cd server
pm2 start server.js --name claude-web

# Save PM2 configuration
pm2 save
pm2 startup  # Follow the instructions to enable auto-start
```

### 5. Setup Nginx (Optional but Recommended)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Using with Different Projects

### Option 1: Single Instance, Switch Projects
Edit `server/clients.json` and change the `projectPath`:
```json
{
  "projectPath": "/home/ubuntu/project-1",  // Change this
  "name": "Project 1"                       // And this
}
```
Then restart: `pm2 restart claude-web`

### Option 2: Multiple Instances (Different Ports)
Run multiple instances on different ports:
```bash
# Instance 1 - Port 3001
PORT=3001 pm2 start server.js --name claude-project1

# Instance 2 - Port 3002
PORT=3002 pm2 start server.js --name claude-project2
```

### Option 3: Multi-Client Setup
Add multiple clients to `clients.json`:
```json
{
  "clients": [
    {
      "id": "project1",
      "username": "project1",
      "password": "dev:password1",
      "name": "Project 1",
      "projectPath": "/home/ubuntu/project1",
      "active": true
    },
    {
      "id": "project2",
      "username": "project2",
      "password": "dev:password2",
      "name": "Project 2",
      "projectPath": "/home/ubuntu/project2",
      "active": true
    }
  ]
}
```
Each project gets its own login credentials.

## Security Notes

### Basic Setup (Good for Personal Use)
- Use `dev:password` format in clients.json
- Put behind Cloudflare or VPN
- Use strong passwords

### Production Setup (If Needed)
```bash
# Generate bcrypt hash for password
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your-password', 10).then(console.log)"
```
Then use the hash in clients.json instead of `dev:password`.

## Environment Variables (Optional)
Create `.env` file in server directory:
```env
PORT=3001
JWT_SECRET=your-secret-key-here
CLIENTS_CONFIG_PATH=./clients.json
```

## Key Features
- ✅ Real-time streaming from Claude CLI
- ✅ Image upload support
- ✅ Session persistence (via localStorage + Claude's JSONL)
- ✅ Tool usage visibility
- ✅ Thinking blocks display
- ✅ Simple auth per project
- ✅ Works with any project Claude CLI can access

## Troubleshooting

1. **Can't connect?**
   - Check Claude CLI works: `claude --help`
   - Check server is running: `pm2 status`
   - Check firewall: `sudo ufw allow 3001`

2. **Sessions not persisting?**
   - Claude CLI handles the real persistence
   - UI state is in browser localStorage
   - Use `/continue` command to resume sessions

3. **Wrong project showing?**
   - Update `projectPath` in clients.json
   - Restart server: `pm2 restart claude-web`