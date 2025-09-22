# VPS Deployment Guide for AI SuperAgent

## Overview
This guide explains how to deploy AI SuperAgent on a VPS for multiple client projects.

## Prerequisites
- Ubuntu VPS (20.04+ recommended)
- Node.js 18+ installed
- Claude CLI installed and configured
- Nginx (for reverse proxy)
- PM2 (for process management)

## Installation Steps

### 1. Clone and Setup
```bash
# Clone the repository
cd /home/ubuntu
git clone <your-repo-url> ai-superagent
cd ai-superagent

# Install dependencies
npm install
cd server && npm install && cd ..

# Build the frontend
npm run build
```

### 2. Configure Environment
```bash
# Copy and edit environment file
cp .env.example .env
nano .env
```

Set your project path:
```env
PROJECT_PATH=/home/ubuntu/projects/client1
PROJECT_NAME=Client 1 Project
PORT=3001
```

### 3. Setup PM2 Process Manager
```bash
# Install PM2 globally
sudo npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'claude-web-server',
      script: './server/server.js',
      cwd: '/home/ubuntu/ai-superagent',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        PROJECT_PATH: process.env.PROJECT_PATH || '/home/ubuntu/projects/current'
      },
      error_file: '/home/ubuntu/logs/claude-web-error.log',
      out_file: '/home/ubuntu/logs/claude-web-out.log',
      time: true
    }
  ]
};
EOF

# Start the application
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 4. Configure Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Serve the React app
    location / {
        root /home/ubuntu/ai-superagent/dist;
        try_files $uri /index.html;
    }

    # Proxy API requests
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

## Multi-Client Setup

### Option 1: Multiple Ports
Run separate instances for each client on different ports:

```bash
# Client 1
PROJECT_PATH=/home/ubuntu/projects/client1 PORT=3001 pm2 start server/server.js --name client1-claude

# Client 2
PROJECT_PATH=/home/ubuntu/projects/client2 PORT=3002 pm2 start server/server.js --name client2-claude
```

### Option 2: Subdomain Setup
Use nginx to route subdomains to different instances:

```nginx
# client1.yourdomain.com
server {
    listen 80;
    server_name client1.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
    }
}

# client2.yourdomain.com
server {
    listen 80;
    server_name client2.yourdomain.com;

    location / {
        proxy_pass http://localhost:3002;
    }
}
```

### Option 3: Project Switcher (Recommended)
Add a project switcher to the UI:

1. Create a projects configuration file:
```json
// /home/ubuntu/claude-web-ui/projects.json
{
  "projects": [
    {
      "id": "client1",
      "name": "Client 1 - E-commerce Site",
      "path": "/home/ubuntu/projects/client1",
      "docsPath": "/home/ubuntu/projects/client1/docs"
    },
    {
      "id": "client2",
      "name": "Client 2 - SaaS Platform",
      "path": "/home/ubuntu/projects/client2",
      "docsPath": "/home/ubuntu/projects/client2/docs"
    }
  ]
}
```

2. The UI can then switch between projects dynamically.

## Security Considerations

### 1. Add Authentication
For production use, add authentication middleware:

```javascript
// server/auth.js
const basicAuth = require('express-basic-auth');

app.use(basicAuth({
  users: {
    'admin': process.env.ADMIN_PASSWORD
  },
  challenge: true
}));
```

### 2. HTTPS Setup
Use Let's Encrypt for SSL:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### 3. Firewall Configuration
```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 4. Environment Isolation
Each client project should have:
- Separate project directories
- Isolated docs folders
- Independent Claude sessions

## Monitoring

### View Logs
```bash
# PM2 logs
pm2 logs claude-web-server

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Health Check Endpoint
The server provides a health check at:
```
GET http://your-vps-ip:3001/api/health
```

## Backup Strategy

### Automated Backups
```bash
#!/bin/bash
# /home/ubuntu/backup.sh

# Backup docs folders
tar -czf /home/ubuntu/backups/docs-$(date +%Y%m%d).tar.gz /home/ubuntu/projects/*/docs

# Backup Claude sessions
tar -czf /home/ubuntu/backups/claude-sessions-$(date +%Y%m%d).tar.gz ~/.claude/

# Keep only last 7 days
find /home/ubuntu/backups -name "*.tar.gz" -mtime +7 -delete
```

Add to crontab:
```bash
crontab -e
0 2 * * * /home/ubuntu/backup.sh
```

## Troubleshooting

### Claude CLI Not Found
```bash
# Ensure Claude is in PATH
export PATH=$PATH:/path/to/claude
echo 'export PATH=$PATH:/path/to/claude' >> ~/.bashrc
```

### WebSocket Connection Issues
- Check nginx configuration includes WebSocket headers
- Ensure firewall allows WebSocket connections
- Verify PM2 process is running

### File Upload Size Limits
Adjust nginx configuration:
```nginx
client_max_body_size 50M;
```

## Performance Optimization

### 1. Enable Compression
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
```

### 2. Cache Static Assets
```nginx
location /static {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. Process Management
```bash
# Scale based on CPU cores
pm2 scale claude-web-server 2
```

## Cost-Effective VPS Recommendations

- **DigitalOcean**: $6/month droplet (1GB RAM, 1 CPU)
- **Linode**: $5/month Nanode (1GB RAM, 1 CPU)
- **Vultr**: $6/month (1GB RAM, 1 CPU)
- **Hetzner**: €4.51/month (2GB RAM, 1 CPU)

Minimum requirements:
- 1GB RAM
- 1 CPU core
- 25GB storage
- Ubuntu 20.04+