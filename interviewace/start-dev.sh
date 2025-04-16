#!/bin/bash

echo "=== InterviewAce Development Starter ==="
echo ""
echo "1. Cleaning up any existing processes..."
npm run clean
echo ""

echo "2. Verifying development tools..."
npm run verify
if [ $? -ne 0 ]; then
  echo "ERROR: Failed to verify development tools."
  echo "Please check errors above and try to resolve them."
  exit 1
fi
echo ""

echo "3. Starting InterviewAce application..."
echo ""
npm run dev || {
  echo ""
  echo "ERROR: Failed to start the application."
  echo "- Make sure you've run 'npm install' to install all dependencies"
  echo "- Try running 'npm run dev-clean' to clear all processes"
  echo ""
  exit 1
} 