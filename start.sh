#!/bin/bash
cd "$(dirname "$0")"

export PORT=3000
export MAX_MB=5000

export SMTP_HOST=smtp.mail.ru
export SMTP_PORT=465
export SMTP_USER=example@mail.ru
export SMTP_PASS=example

export DONATE_CARD="2200 1502 8944 7333"
export DONATE_NAME="Матвей М."

while true; do
  echo ""
  echo "[$(date '+%d.%m.%Y %H:%M:%S')] starting server..."
  node server.js
  echo ""
  echo "[$(date '+%d.%m.%Y %H:%M:%S')] server crashed, restarting in 5 sec..."
  sleep 5
done