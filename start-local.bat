@echo off
setlocal
cd /d "%~dp0"

echo Starting AcuGuide local web app...
echo URL: http://127.0.0.1:5173/
echo.
echo Keep this window open while using the site.
echo Press Ctrl+C here to stop the local server.
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://127.0.0.1:5173/'"
npm.cmd run dev -- --port 5173 --strictPort --force

pause
