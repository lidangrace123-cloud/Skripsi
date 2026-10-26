#!/bin/bash
# Glitch start script
# Install dependencies and start the app
npm ci --omit=dev --no-audit --no-fund
node server.js
