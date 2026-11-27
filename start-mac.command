#!/bin/bash
# Double-click to start Flowboard on macOS. Keep this window open while you use the app.
cd "$(dirname "$0")" || exit 1
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js is not installed. Get it from https://nodejs.org and try again."
  read -r -p "Press Enter to close"; exit 1
fi
if [ ! -d node_modules ]; then
  echo "Installing for the first time, this takes a minute..."
  npm install || { read -r -p "Press Enter to close"; exit 1; }
fi
echo "Starting Flowboard at http://127.0.0.1:5173 ... keep this window open."
npm start
