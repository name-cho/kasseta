@echo off
chcp 65001 >nul
cd /d "%~dp0"

:loop
echo.
echo [%date% %time%] starting server...
node server.js
echo.
echo [%date% %time%] server crashed, restarting in 5 sec...
timeout /t 5 /nobreak >nul
goto loop