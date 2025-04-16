@echo off
echo === InterviewAce Development Starter ===
echo.
echo 1. Cleaning up any existing processes...
call npm run clean
echo.
echo 2. Verifying development tools...
call npm run verify
if %ERRORLEVEL% neq 0 (
  echo ERROR: Failed to verify development tools.
  echo Please check errors above and try to resolve them.
  pause
  exit /b 1
)
echo.
echo 3. Starting InterviewAce application...
echo.
call npm run dev || (
  echo.
  echo ERROR: Failed to start the application.
  echo - Make sure you've run 'npm install' to install all dependencies
  echo - Try running 'npm run dev-clean' to clear all processes
  echo.
  pause
  exit /b 1
) 