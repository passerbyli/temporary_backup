@echo off
cd /d "%~dp0"
call pnpm install puppeteer
node auto-login.js
pause