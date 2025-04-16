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
// Import the Tailwind middleware
import { tailwindMiddleware, generateInlineTailwind } from './tailwind-inline.js';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Initialize Supabase Client (Server-side)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required for the backend.');
  // Optionally exit if Supabase is critical, or continue if it's progressively enhanced
  // process.exit(1);
}

// Note: We are initializing Supabase here, but database interactions will be added later.
// Use the service key for backend operations that might require elevated privileges.
const supabaseAdmin = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;
if (supabaseAdmin) {
  console.log('Supabase admin client initialized successfully.');
} else {
  console.warn('Supabase admin client could not be initialized. Check environment variables.');
}

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

// Enable trust proxy - necessary for express-rate-limit to work with Heroku
app.enable('trust proxy');

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
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://interviewace.herokuapp.com', 'https://www.interviewace.com'] 
    : 'http://localhost:5173',
  methods: ['GET', 'POST'],
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
      jobInfoText += `\nJob Description Summary: ${jobDescription.substring(0, 300)}...`; // Limit length
    }
    if (jobResponsibilities) {
      jobInfoText += `\nKey Responsibilities Summary: ${jobResponsibilities.substring(0, 300)}...`; // Limit length
    }

    // Construct prompt for the AI - REFINED V4
    const systemPrompt = `You are an expert AI assistant helping a user succeed in a job interview. The user is providing:\n1. Their resume (skills, experiences, projects).\n2. The job description (company, role, responsibilities).\n3. A specific interview question.\n\nYour task is to generate an interview answer that is:\n- Directly responsive to the specific question asked.\n- Draws *only* from the provided resume and job description. Do not hallucinate or add information not present.\n- Conversational and natural in tone, as if the user is speaking confidently.\n- Context-aware: While generating, try to maintain consistency if simulating a sequence, but prioritize answering the current question accurately based on resume/JD.\n- Highlights the most relevant skills and experiences from the resume that align with the job description details provided.\n- Uses STAR format (Situation, Task, Action, Result) implicitly for behavioral questions (\`Tell me about a time...\`, \`Describe a challenge...\`) where appropriate. Focus on the Action and Result/Impact.\n- Prioritizes clarity, confidence, and genuine relevance.\n- If clarification on the question's intent is needed, make reasonable assumptions based on the resume and job context.\n\nOutput ONLY the generated answer for the candidate. Do not include any introductory or concluding remarks.`;

    // Add job context to the user message for better grounding if available
    let userQuestionContext = `Question: ${question}\n\nMy Resume:\n${resume}`;
    if (jobInfoText) {
      userQuestionContext += `\n\nTarget Job Info:\n${jobInfoText}`;
    }

    // Generate the answer using OpenAI's API
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Consider GPT-4 for potentially better adherence
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuestionContext } // Pass resume/job info here
      ],
      temperature: 0.6, // Slightly lower temp might help with focus
      max_tokens: 400 // Keep reasonable limit
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

// Build path for static files
const buildPath = path.join(__dirname, 'dist');

// Debug middleware to help diagnose static file serving issues
app.use((req, res, next) => {
  // Log all requests except for static assets to reduce noise
  if (!req.path.includes('.')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  } else if (req.path.includes('.css')) {
    // Log CSS file requests to debug styling issues
    console.log(`[${new Date().toISOString()}] CSS request: ${req.path}`);
  }
  next();
});

// Apply tailwind middleware for HTML responses
app.use(tailwindMiddleware(buildPath));

// Disable inline Tailwind generation - rely on proper CSS files
// if (IS_PRODUCTION) {
//   try {
//     generateInlineTailwind();
//     console.log('Generated inline Tailwind CSS for production');
//   } catch (err) {
//     console.error('Error generating inline Tailwind:', err);
//   }
// }

// Serve static files with proper cache headers
app.use(express.static(buildPath, {
  maxAge: '1d', // Set to 1 day for all static assets
  etag: true,
  index: false, // Don't automatically serve index.html
  setHeaders: (res, filePath) => {
    // Ensure HTML files are not cached
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    // Ensure CSS files have correct headers and no caching in development
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
      res.setHeader('Cache-Control', IS_PRODUCTION ? 'public, max-age=86400' : 'no-cache');
    }
  }
}));

// Serve index.html for all other routes - client-side routing
app.get('*', (req, res, next) => {
  // Skip API routes and forward them to the next middleware
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(buildPath, 'index.html'));
});

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
      }
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

startServer();