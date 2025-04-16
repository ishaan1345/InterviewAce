import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import bodyParser from 'body-parser';
import fs from 'fs';
import net from 'net';
import * as dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { execSync } from 'child_process';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Process ID for lock check
const PID = process.pid;
const LOCK_FILE = path.join(__dirname, '.server.lock');
const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SERVER_LOCK_FILE = path.join(__dirname, '.server.lock');

// Load environment variables
import 'dotenv/config';

// Get API key from environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

// Initialize Express
const app = express();
let server = null;

// Improved port handling and cleanup
const findAvailablePort = (startPort) => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
    server.once('listening', () => {
      const port = server.address().port;
      server.close(() => {
        resolve(port);
      });
    });
    server.listen(startPort);
  });
};

// More robust lock file handling
const acquireLock = () => {
  try {
    if (fs.existsSync(SERVER_LOCK_FILE)) {
      const lockData = JSON.parse(fs.readFileSync(SERVER_LOCK_FILE, 'utf8'));
      const pid = lockData.pid;
      
      // Check if the process is still running
      try {
        // In Node.js, sending signal 0 tests if process exists
        process.kill(pid, 0);
        console.warn(`Server lock file exists and process ${pid} is still running.`);
        console.warn('If this is incorrect, delete the .server.lock file and restart.');
        return false;
      } catch (e) {
        // Process doesn't exist, safe to remove lock file
        console.log(`Stale lock file found. Previous process ${pid} is not running.`);
        fs.unlinkSync(SERVER_LOCK_FILE);
      }
    }
    
    // Create new lock file
    fs.writeFileSync(SERVER_LOCK_FILE, JSON.stringify({
      pid: process.pid,
      timestamp: new Date().toISOString()
    }));
    return true;
  } catch (err) {
    console.error('Error handling server lock file:', err);
    return false;
  }
};

const releaseLock = () => {
  try {
    if (fs.existsSync(SERVER_LOCK_FILE)) {
      const lockData = JSON.parse(fs.readFileSync(SERVER_LOCK_FILE, 'utf8'));
      if (lockData.pid === process.pid) {
        fs.unlinkSync(SERVER_LOCK_FILE);
        console.log('Server lock file released.');
      }
    }
  } catch (err) {
    console.error('Error releasing server lock file:', err);
  }
};

// Configure CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', process.env.FRONTEND_URL || ''],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Body parser middleware
app.use(bodyParser.json({ limit: '10mb' }));

// Configure OpenAI client with API key from environment
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

// Simple in-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

// Helper function to create a cache key
const createCacheKey = (question, resume, jobInfo) => {
  // Truncate resume to minimize cache key size, but keep enough for context
  const truncatedResume = resume.substring(0, 500);
  return `${question}_${truncatedResume}_${JSON.stringify(jobInfo)}`;
};

// Clean expired cache entries periodically
const cacheCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now > value.expiresAt) {
      cache.delete(key);
    }
  }
}, 30 * 60 * 1000); // Clean every 30 minutes

// Rate limiting middleware
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: IS_PRODUCTION ? 10 : 100, // limit each IP to 10 requests per windowMs in production, 100 in dev
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again later.'
  },
  skip: (req) => !IS_PRODUCTION // Only apply in production
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

app.post('/api/generate-answer', async (req, res) => {
  try {
    const { resume, question, jobTitle, jobCompany, jobDescription, jobResponsibilities } = req.body;

    // Validate inputs
    if (!resume) {
      return res.status(400).json({ error: 'Resume text is required' });
    }
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Prepare job info object for cache key
    const jobInfo = {
      title: jobTitle || '',
      company: jobCompany || '',
      description: jobDescription || '',
      responsibilities: jobResponsibilities || ''
    };

    // Check cache first
    const cacheKey = createCacheKey(question, resume, jobInfo);
    if (cache.has(cacheKey)) {
      console.log('Cache hit for question:', question);
      return res.json({ answer: cache.get(cacheKey).data });
    }

    console.log('Generating answer for question:', question);

    // Format job info to include in prompt if available
    let jobInfoText = '';
    if (jobTitle) {
      jobInfoText += `\nJob Title: ${jobTitle}`;
    }
    if (jobCompany) {
      jobInfoText += `\nCompany: ${jobCompany}`;
    }
    if (jobDescription) {
      jobInfoText += `\nJob Description: ${jobDescription}`;
    }
    if (jobResponsibilities) {
      jobInfoText += `\nKey Responsibilities: ${jobResponsibilities}`;
    }

    // Construct prompt for the AI
    const systemPrompt = `You are an expert interview coach. Your goal is to help the candidate craft a compelling answer to the interview question.
    
Make your answer urgent, direct, and conversational. Write in first person as if you ARE the candidate, using "I" statements. 
Craft an answer that is authentic and sounds like a real person speaking, not a template.
Focus on specific skills, experiences and achievements from their resume that are most relevant to the position.
Keep answers concise (maximum 300 words). Be confident but not arrogant.
${jobInfoText ? `The candidate is applying for:${jobInfoText}` : ''}`;

    // Generate the answer using OpenAI's API
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Question: ${question}\n\nMy Resume:\n${resume}` }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    // Extract the generated answer
    const answer = response.choices[0].message.content.trim();

    // Cache the result
    cache.set(cacheKey, {
      data: answer,
      expiresAt: Date.now() + CACHE_TTL
    });

    // Send the answer back to the client
    res.json({ answer });
  } catch (error) {
    console.error('Error in /api/generate-answer:', error);
    res.status(500).json({ 
      error: 'An error occurred while generating the answer', 
      message: error.message 
    });
  }
});

// Serve static files in production
if (IS_PRODUCTION) {
  // Set the correct path to the build directory
  const buildPath = path.join(__dirname, 'src', 'dist');
  console.log(`Serving static files from: ${buildPath}`);
  
  // Serve static files
  app.use(express.static(buildPath));
  
  // For any route not matching an API route, serve the index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(buildPath, 'index.html'));
    }
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    pid: PID,
    port: PORT,
    uptime: process.uptime()
  });
});

// Server status route to check if our server is running
app.get('/api/status', (req, res) => {
  res.json({ 
    running: true,
    pid: PID,
    port: PORT,
    started: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Add global error handler middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  const statusCode = err.statusCode || 500;
  const message = IS_PRODUCTION 
    ? 'An internal server error occurred' 
    : err.message || 'Unknown error';
  
  res.status(statusCode).json({
    error: {
      message,
      status: statusCode
    }
  });
});

// Start the server
const startServer = async () => {
  // Always release lock first on start attempt
  releaseLock();

  if (!acquireLock()) {
    console.error('Could not acquire server lock. Another instance might be running or lock file is stuck.');
    console.error(`Attempting to kill process on port ${PORT} and fallback ${PORT + 1}...`);
    try {
      execSync(`npx kill-port ${PORT} ${PORT + 1}`);
      console.log(`Processes on ports ${PORT} and ${PORT + 1} killed.`);
      // Try acquiring lock again after killing ports
      if (!acquireLock()) {
        console.error('Still could not acquire lock after killing ports. Please check manually.');
        process.exit(1);
      }
    } catch (killError) {
      console.error('Failed to kill processes on ports:', killError.message);
      // Continue trying to start, but log warning
    }
  }

  let actualPort = PORT;
  try {
    // Explicitly find available port *before* listening
    actualPort = await findAvailablePort(PORT);
    console.log(`Attempting to start server on port: ${actualPort}`);

    server = app.listen(actualPort, () => {
      const serverInfo = {
        pid: process.pid,
        port: actualPort,
        url: `http://localhost:${actualPort}`,
        nodeEnv: process.env.NODE_ENV || 'development',
        startTime: new Date().toISOString()
      };
      
      console.log(`Server running at ${serverInfo.url} (PID: ${serverInfo.pid}, env: ${serverInfo.nodeEnv})`);
      
      // Update lock file with actual listening port
      if (!IS_PRODUCTION) {
        try {
          fs.writeFileSync(
            SERVER_LOCK_FILE,
            JSON.stringify(serverInfo, null, 2)
          );
        } catch (error) {
          console.warn(`Warning: Could not update server lock file: ${error.message}`);
        }
      }
    });

    // Handle server specific errors (like EADDRINUSE if findAvailablePort failed)
    server.on('error', (err) => {
      console.error(`Server encountered an error on port ${actualPort}:`, err.message);
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${actualPort} is already in use. Cannot start server.`);
      } else {
        console.error('An unexpected server error occurred.');
      }
      releaseLock(); // Ensure lock is released on server error
      process.exit(1); // Exit if server cannot start
    });

  } catch (err) {
    // This catch block handles errors from findAvailablePort
    console.error('Fatal error during server startup:', err.message);
    releaseLock();
    process.exit(1);
  }
};

// Handle graceful shutdown
const gracefulShutdown = () => {
  console.log('Received shutdown signal, closing server gracefully...');
  server.close(() => {
    console.log('Server closed successfully');
    
    // Clean up lock file
    if (!IS_PRODUCTION && fs.existsSync(SERVER_LOCK_FILE)) {
      try {
        fs.unlinkSync(SERVER_LOCK_FILE);
        console.log('Removed server lock file');
      } catch (error) {
        console.warn(`Warning: Could not remove lock file: ${error.message}`);
      }
    }
    
    process.exit(0);
  });
  
  // Force close after 10 seconds if hanging
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Listen for shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle nodemon restart signal
process.on('SIGUSR2', () => {
  console.log('Nodemon restart signal received');
  if (server) {
    server.close(() => {
      console.log('Server closed for nodemon restart');
      releaseLock();
      process.kill(process.pid, 'SIGUSR2');
    });
  } else {
    releaseLock();
    process.kill(process.pid, 'SIGUSR2');
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown();
});

// Start the server
startServer(); 