#!/bin/bash

# Claude Web Simple - Start Script

echo "🚀 Starting Claude Web Simple..."

# Check if node_modules exist for server
if [ ! -d "server/node_modules" ]; then
  echo "📦 Installing server dependencies..."
  cd server && npm install && cd ..
fi

# Check if node_modules exist for client
if [ ! -d "node_modules" ]; then
  echo "📦 Installing client dependencies..."
  npm install
fi

# Create .env file if it doesn't exist
if [ ! -f "server/.env" ]; then
  echo "📝 Creating .env file from example..."
  cp server/.env.example server/.env
  echo "⚠️  Please edit server/.env and add your Claude Code API key"
fi

# Start both server and client in parallel
echo "🎯 Starting server on port 3001..."
echo "🎨 Starting client on port 5173..."

# Function to kill processes on exit
cleanup() {
  echo "Shutting down..."
  kill $SERVER_PID 2>/dev/null
  kill $CLIENT_PID 2>/dev/null
  exit
}

trap cleanup EXIT INT TERM

# Start server in background
(cd server && npm run dev) &
SERVER_PID=$!

# Give server a moment to start
sleep 2

# Start client in background
npm run dev &
CLIENT_PID=$!

echo "✅ Claude Web Simple is running!"
echo "📍 Frontend: http://localhost:5173"
echo "📍 Backend: http://localhost:3001"
echo "Press Ctrl+C to stop"

# Wait for processes
wait