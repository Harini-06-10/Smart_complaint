#!/usr/bin/env bash
# Smart Complaint Registration System v3 – one-click start (macOS / Linux)
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js is not installed. Get the LTS version from https://nodejs.org"; exit 1; }
[ -d node_modules ] && [ -d backend/node_modules ] && [ -d frontend/node_modules ] || npm run setup
[ -f backend/.env ] || cp backend/.env.example backend/.env
echo "Starting... open http://localhost:5173 in your browser"
npm run dev
