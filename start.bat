@echo off
chcp 65001 >nul
cd /d "%~dp0"

set PORT=3000
set MAX_MB=5000

set SMTP_HOST=smtp.mail.ru
set SMTP_PORT=465
set SMTP_USER=example@mail.ru
set SMTP_PASS=example

set DONATE_CARD=2200 1502 8944 7333
set DONATE_NAME=Матвей М.

:loop
echo.
echo [%date% %time%] starting server...
node server.js
echo.
echo [%date% %time%] server crashed, restarting in 5 sec...
timeout /t 5 /nobreak >nul
goto loop