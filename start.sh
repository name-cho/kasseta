#!/bin/bash
cd "$(dirname "$0")"

while true; do
  echo ""
  echo "[$(date '+%d.%m.%Y %H:%M:%S')] starting server..."
  node server.js
  echo ""
  echo "[$(date '+%d.%m.%Y %H:%M:%S')] server crashed, restarting in 5 sec..."
  sleep 5
done