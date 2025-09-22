# Multi-Client Setup Guide

## Overview
This AI SuperAgent supports multi-tenant deployment where different clients can access only their assigned project directories. Each client has isolated access to their own project files and Claude sessions.

## Authentication System

### How It Works
1. **Login Required**: Users must authenticate with username/password
2. **JWT Tokens**: Successful login returns a JWT token valid for 24 hours
3. **Project Isolation**: Each user is assigned to a specific project directory
4. **Session Persistence**: Login state persists across browser refreshes

### Client Configuration

Edit `server/clients.json` to configure client access:

```json
{
  "clients": [
    {
      "id": "client1",
      "username": "client1",
      "password": "$2b$10$HashedPasswordHere",
      "name": "Client 1 - E-commerce Site",
      "projectPath": "/home/ubuntu/projects/client1",
      "docsPath": "/home/ubuntu/projects/client1/docs",
      "active": true
    }
  ]
}
```

### Password Management

#### For Development
Use `dev:` prefix for plain text passwords:
```json
"password": "dev:mypassword123"
```

#### For Production
Generate bcrypt hashed passwords:
```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('yourpassword', 10).then(console.log)"
```

## VPS Deployment Options

### Option 1: Single Instance, Multiple Clients

1. **Setup**: One server instance with authentication enabled
2. **Access**: Clients login with their credentials
3. **Benefits**: Simple setup, centralized management
4. **Configuration**:
   ```env
   AUTH_ENABLED=true
   CLIENTS_CONFIG_PATH=./server/clients.json
   ```

### Option 2: Multiple Instances (Subdomains)

1. **Setup**: Separate server instances per client
2. **Access**: Each client gets their own subdomain
3. **Benefits**: Complete isolation, independent scaling
4. **Nginx Configuration**:
   ```nginx
   server {
       listen 80;
       server_name client1.yourdomain.com;

       location / {
           proxy_pass http://localhost:3001;
       }

       location /api {
           proxy_pass http://localhost:3001;
           proxy_set_header Authorization $http_authorization;
       }
   }
   ```

### Option 3: Docker Containers

1. **Setup**: Each client runs in isolated Docker container
2. **Benefits**: Maximum isolation, easy deployment
3. **Docker Compose Example**:
   ```yaml
   version: '3'
   services:
     client1:
       image: ai-superagent
       environment:
         - PROJECT_PATH=/data/client1
         - AUTH_ENABLED=true
       volumes:
         - ./projects/client1:/data/client1
       ports:
         - "3001:3001"
   ```

## Security Features

### Project Isolation
- **File Access**: Clients can only access files within their assigned project directory
- **Path Validation**: All file operations validate paths don't escape the project boundary
- **Session Isolation**: Claude sessions are scoped to the client's project directory

### Authentication Security
- **Token Expiry**: JWT tokens expire after 24 hours
- **Secure Headers**: Authorization headers required for all API calls
- **Password Hashing**: Production passwords use bcrypt with salt rounds

### API Protection
All API endpoints except `/api/auth/login` require authentication:
- `/api/files/*` - File operations
- `/api/sessions/*` - Claude session management
- `/api/chat` - Claude interactions

## Client Access Instructions

### For Clients
1. Navigate to your assigned URL
2. Enter your username and password
3. Click "Sign In"
4. You'll have access to:
   - Your project's docs folder
   - Claude chat interface
   - File management capabilities

### Password Reset
Contact your administrator to reset passwords. They will:
1. Generate new password hash
2. Update `clients.json`
3. Restart the server

## Monitoring & Maintenance

### View Active Sessions
```bash
pm2 status claude-web-server
```

### View Logs
```bash
pm2 logs claude-web-server
```

### Update Client Configuration
1. Edit `server/clients.json`
2. Restart server: `pm2 restart claude-web-server`

### Backup Client Data
```bash
#!/bin/bash
# Backup script
for client in client1 client2 client3; do
  tar -czf backups/${client}-$(date +%Y%m%d).tar.gz /home/ubuntu/projects/${client}/docs
done
```

## Troubleshooting

### Client Can't Login
- Check username/password in `clients.json`
- Verify `active: true` for the client
- Check server logs: `pm2 logs`

### Files Not Accessible
- Verify `docsPath` in client configuration
- Check directory exists and has proper permissions
- Ensure path doesn't contain symlinks

### Session Timeout
- JWT tokens expire after 24 hours
- Client needs to login again
- Consider adjusting token expiry in `auth.js`

## Environment Variables

```env
# Authentication
AUTH_ENABLED=true              # Set to false to disable auth
JWT_SECRET=your-secret-key     # Change in production!

# Client Configuration
CLIENTS_CONFIG_PATH=./server/clients.json

# Default Project (when auth disabled)
PROJECT_PATH=/home/ubuntu/projects/default
PROJECT_NAME=Default Project
```

## Quick Start Commands

### Generate Password Hash
```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('password123', 10).then(console.log)"
```

### Add New Client
1. Generate password hash
2. Add to `clients.json`:
   ```json
   {
     "id": "newclient",
     "username": "newclient",
     "password": "$2b$10$...",
     "name": "New Client Project",
     "projectPath": "/home/ubuntu/projects/newclient",
     "docsPath": "/home/ubuntu/projects/newclient/docs",
     "active": true
   }
   ```
3. Create project directory:
   ```bash
   mkdir -p /home/ubuntu/projects/newclient/docs
   ```
4. Restart server:
   ```bash
   pm2 restart claude-web-server
   ```

### Disable Client Access
1. Set `"active": false` in `clients.json`
2. Restart server

### Test Authentication
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}'
```