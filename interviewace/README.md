# InterviewAce

InterviewAce is an AI-powered interview preparation application that helps you craft compelling answers to interview questions based on your resume and the job you're applying for.

## Features

- Upload and process your resume (PDF or TXT)
- Add job details to tailor your answers
- Ask interview questions through text or voice input
- Get AI-generated answers optimized for your experience
- Save your recent answers for review

## Development Setup

### Prerequisites

- Node.js (LTS version recommended, v18.x)
- npm (included with Node.js)

No global dependencies are required! All tools are installed locally.

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd interviewace
   ```

2. Install dependencies:
   ```
   npm install
   ```
   This will also install dependencies for the frontend automatically.

3. Create a `.env` file in the root directory:
   ```
   OPENAI_API_KEY=your_openai_api_key
   NODE_ENV=development
   ```

### Running the Application

For Windows users, use the convenient batch file:
```
start-dev.bat
```

For macOS/Linux users:
```
chmod +x start-dev.sh  # Make the script executable (first time only)
./start-dev.sh
```

Alternatively, you can run:
```
npm run clean     # Clear any existing processes (optional)
npm run verify    # Verify all tools are installed (recommended)
npm run dev       # Start both frontend and backend servers
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Development Commands

- `npm run dev` - Start both frontend and backend in development mode
- `npm run verify` - Check and install required development tools
- `npm run clean` - Quickly kill any processes using ports 3000-3004
- `npm run dev-clean` - More thorough cleanup of processes and lock files
- `npm run build` - Build the frontend for production
- `npm start` - Start the backend server only (production mode)

## Project Structure

- `/src` - Frontend React application
- `/server.js` - Backend Express server
- `/scripts` - Utility scripts for development

## Deployment

For Heroku deployment:
```
git push heroku main
```

## Troubleshooting

### "nodemon is not recognized" or similar errors

This usually indicates nodemon isn't properly installed as a local dependency. Try the following:

1. Verify development tools:
   ```
   npm run verify
   ```
   This will check and install any missing dependencies automatically.

2. If that doesn't work, manually install nodemon:
   ```
   npm install nodemon --save-dev
   ```

3. Fix npm issues with:
   ```
   npm cache clean --force
   rm -rf node_modules
   npm install
   ```

### Port Conflicts

If you get port conflict errors:

1. Run the cleanup script:
   ```
   npm run clean
   ```

2. For more stubborn issues, use:
   ```
   npm run dev-clean
   ```

3. Verify your `.env` file contains the required environment variables.

4. For port conflicts that persist, check what's using your ports:
   - Windows: `netstat -ano | findstr :3001`
   - macOS/Linux: `lsof -i :3001`

## License

ISC 