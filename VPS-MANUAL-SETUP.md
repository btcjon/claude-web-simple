# Manual VPS Setup for Claude Web UI with Rxion-Web

## Prerequisites on VPS

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install PM2
sudo npm install -g pm2

# 4. Install Claude CLI (if not already installed)
curl -fsSL https://storage.googleapis.com/code.cla8ude.ai/install.sh | bash
source ~/.bashrc  # Or restart terminal
claude --help  # Verify installation
```

## Deploy Claude Web UI

```bash
# 1. Clone the repository
cd ~
git clone https://github.com/btcjon/claude-web-simple.git claude-web-ui
cd claude-web-ui

# 2. Install dependencies
npm install
cd server && npm install && cd ..

# 3. Build the frontend
npm run build

# 4. Configure for rxion-web
cd server
nano clients.json
```

Add this configuration:
```json
{
  "clients": [
    {
      "id": "rxion",
      "username": "admin",
      "password": "dev:your-secure-password",
      "name": "Rxion Web",
      "projectPath": "/home/ubuntu/rxion-web",
      "docsPath": "/home/ubuntu/rxion-web/docs",
      "active": true
    }
  ]
}
```

## Ensure Rxion-Web is Ready

```bash
# 1. Clone/update rxion-web if needed
cd ~
git clone https://github.com/btcjon/rxion-web.git  # Or your rxion-web repo

# 2. Verify Claude CLI works with the project
cd ~/rxion-web
claude "What is this project?"  # Test Claude CLI
```

## Start Claude Web UI

```bash
cd ~/claude-web-ui/server

# Start with PM2
PORT=3001 pm2 start server.js --name claude-web

# Save PM2 configuration
pm2 save
pm2 startup  # Follow the command it outputs
```

## Configure Firewall

```bash
# Allow port 3001
sudo ufw allow 3001

# Check firewall status
sudo ufw status
```

## Set Up Nginx (Optional but Recommended)

```bash
# 1. Install Nginx
sudo apt install nginx -y

# 2. Create configuration
sudo nano /etc/nginx/sites-available/claude-web
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Or use IP address

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# 3. Enable site
sudo ln -s /etc/nginx/sites-available/claude-web /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## SSL with Let's Encrypt (if using domain)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## Verify Everything is Working

```bash
# 1. Check PM2 status
pm2 status

# 2. Check logs
pm2 logs claude-web

# 3. Test locally
curl http://localhost:3001/api/health

# 4. Access from browser
# http://your-vps-ip:3001
# Login: admin / your-password
```

## Troubleshooting

### Claude CLI not working?
```bash
# Check Claude CLI
claude --version

# Test in project directory
cd ~/rxion-web
claude "test"
```

### Port 3001 not accessible?
```bash
# Check if server is running
pm2 status
netstat -tuln | grep 3001

# Check firewall
sudo ufw status verbose
```

### WebSocket issues?
- Make sure Nginx config includes WebSocket headers
- Check browser console for connection errors

## Maintenance

```bash
# View logs
pm2 logs claude-web

# Restart server
pm2 restart claude-web

# Update to latest version
cd ~/claude-web-ui
git pull
npm install
cd server && npm install && cd ..
npm run build
pm2 restart claude-web
```

## Security Notes

1. **Change the default password** in `clients.json`
2. **Use HTTPS** in production (via Nginx + Let's Encrypt)
3. **Consider VPN** or IP whitelisting for extra security
4. **Regular updates**: Keep Node.js, PM2, and dependencies updated

## Working with Different Projects

To use with a different project instead of rxion-web:

1. Edit `server/clients.json`
2. Change `projectPath` to your project directory
3. Restart: `pm2 restart claude-web`

Example for multiple projects:
```json
{
  "clients": [
    {
      "id": "project1",
      "username": "project1",
      "password": "dev:password1",
      "projectPath": "/home/ubuntu/project1"
    },
    {
      "id": "project2",
      "username": "project2",
      "password": "dev:password2",
      "projectPath": "/home/ubuntu/project2"
    }
  ]
}
```

Each project gets its own login credentials.