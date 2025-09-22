#!/bin/bash

# VPS Deployment Script for Claude Web UI
# Usage: ./deploy-to-vps.sh

VPS_HOST="your-vps-ip-or-domain"
VPS_USER="ubuntu"
PROJECT_PATH="/home/ubuntu/rxion-web"
CLAUDE_WEB_PATH="/home/ubuntu/claude-web-ui"

echo "🚀 Deploying Claude Web UI to VPS..."

# SSH into VPS and execute deployment
ssh $VPS_USER@$VPS_HOST << 'EOF'
set -e

echo "📦 Installing dependencies if needed..."
# Check Node.js
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Check PM2
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# Check Claude CLI
if ! command -v claude &> /dev/null; then
    echo "⚠️  Claude CLI not found. Please install it first:"
    echo "curl -fsSL https://storage.googleapis.com/code.cla8ude.ai/install.sh | bash"
    exit 1
fi

echo "📥 Cloning/updating Claude Web UI..."
if [ -d "/home/ubuntu/claude-web-ui" ]; then
    cd /home/ubuntu/claude-web-ui
    git pull origin master
else
    cd /home/ubuntu
    git clone https://github.com/btcjon/claude-web-simple.git claude-web-ui
    cd claude-web-ui
fi

echo "📦 Installing Node dependencies..."
npm install
cd server && npm install && cd ..

echo "🏗️ Building frontend..."
npm run build

echo "⚙️ Configuring for rxion-web project..."
cd server
cat > clients.json << 'CONFIG'
{
  "clients": [
    {
      "id": "rxion",
      "username": "admin",
      "password": "dev:rxion2024",
      "name": "Rxion Web",
      "projectPath": "/home/ubuntu/rxion-web",
      "docsPath": "/home/ubuntu/rxion-web/docs",
      "active": true
    }
  ]
}
CONFIG

echo "🔄 Starting/restarting with PM2..."
pm2 stop claude-web || true
PORT=3001 pm2 start server.js --name claude-web
pm2 save
pm2 startup | grep -E "^sudo" | bash

echo "✅ Claude Web UI deployed successfully!"
echo "🌐 Access at: http://$(hostname -I | awk '{print $1}'):3001"
echo "👤 Login: admin / rxion2024"
EOF

echo "
✅ Deployment complete!
Next steps:
1. SSH into VPS and check: pm2 status
2. Access the UI at http://$VPS_HOST:3001
3. Optional: Set up Nginx reverse proxy for domain access
"