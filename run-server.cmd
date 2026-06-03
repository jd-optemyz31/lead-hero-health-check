@echo off
cd /d "%~dp0"
echo Starting Lead Hero Health Check Tool at %DATE% %TIME% > work\server-live.log
node server.mjs >> work\server-live.log 2>&1
