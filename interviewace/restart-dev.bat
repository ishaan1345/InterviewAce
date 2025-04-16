@echo off
echo === InterviewAce Development Restart Script ===
echo.
echo 1. Killing any existing processes on development ports...
npx kill-port 3000 3001 3002 3003 5173
echo.
echo 2. Cleaning up any temporary files...
if exist ".server.lock" del ".server.lock"
echo.
echo 3. Starting the development server...
npm run dev
echo.
pause 