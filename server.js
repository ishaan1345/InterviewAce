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
// Import Deepgram SDK
import { createClient as createDeepgramClient } from "@deepgram/sdk";

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

// Initialize Deepgram Client (Server-side)
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
if (!deepgramApiKey) {
  console.warn('DEEPGRAM_API_KEY environment variable not set. Live transcription will not work.');
}
const deepgramClient = deepgramApiKey ? createDeepgramClient(deepgramApiKey) : null;
if (deepgramClient) {
  console.log('Deepgram client initialized successfully.');
} else {
  console.warn('Deepgram client could not be initialized.');
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

    // Construct prompt for the AI - REFINED V6 (DEMAND Specificity & Explanation)
    const systemPrompt = `You are an expert AI interview coach simulating a candidate answering a specific interview question. Your persona is confident, knowledgeable, and articulate. You MUST answer *as if you are the candidate* (using "I", "my").

    **Core Task:** Generate a SINGLE, focused, and detailed answer to the interview question based *only* on the provided Resume and Job Description.

    **ULTRA-CRITICAL INSTRUCTIONS - FOLLOW EXACTLY:**
    1.  **Answer the Question Directly:** Address the *specific question*. NO general resume summaries unless explicitly asked (e.g., "Tell me about yourself").
    2.  **DEEP DIVE on ONE Example:** For almost all questions (especially behavioral or technical), select the SINGLE most relevant project, skill, or experience from the resume. **Drill down into THIS ONE EXAMPLE.** Do NOT superficially mention multiple projects.
    3.  **FORBIDDEN: Listing Metrics/Resume Points:** Do **NOT** simply list metrics (e.g., "improved accuracy by 30%") or rephrase bullet points from the resume. This sounds fake. 
    4.  **REQUIRED: Explain the "HOW" and "WHY":** Instead of listing, **EXPLAIN** the *context* of the chosen example:
        *   What was the specific *problem* or *challenge*?
        *   What *specific actions* did YOU take? (Describe the *process*, the *techniques* used, the *reasoning* behind your actions – infer plausible details based on resume keywords if necessary, but ground it in the resume context).
        *   What was the *tangible outcome* or *impact*? (Explain the result, don't just state a percentage).
    5.  **Narrative & Storytelling:** Weave the details into a concise story. Use the STAR method (Situation/Task, Action, Result) implicitly where appropriate, focusing heavily on the specific *Action*.
    6.  **Natural Tone:** Sound like a real person sharing an experience. Use clear, confident language. Avoid jargon where possible, or briefly explain it if necessary.
    7.  **Job Relevance:** Connect your specific example back to the requirements mentioned in the Job Description, explaining *how* that experience makes you a good fit.
    8.  **Concise Focus:** Keep the answer focused on the single elaborated example. Aim for 200-350 words.
    9.  **Output:** Respond ONLY with the candidate's answer. No introductory/concluding remarks.

    **Example Self-Correction:** If the resume says "Improved object detection by 30% using AWS Rekognition", DO NOT just say that. Instead, explain: "During my internship, we faced a challenge with [describe challenge, e.g., inconsistent object detection]. I was tasked with improving it. I specifically used AWS Rekognition by [describe *how* you used it - e.g., tuning parameters, building custom labels, integrating it into the pipeline]. This required me to [describe a specific action/learning]. Ultimately, this led to a much more reliable system, reducing false positives significantly."`;

    // Add job context to the user message for better grounding if available
    let userQuestionContext = `Question: ${question}\n\nMy Resume:\n${resume}`;
    if (jobInfoText) {
      userQuestionContext += `\n\nTarget Job Info:\n${jobInfoText}`;
    }

    // Generate the answer using OpenAI's API
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Still using 3.5, but GPT-4 might be needed for true nuance
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuestionContext } 
      ],
      temperature: 0.7, // Increase slightly again to allow more detailed explanation
      max_tokens: 450 // Allow slightly more room for explanation
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

// NEW Endpoint for Live Interview Mode turns
app.post('/api/live-interview-turn', async (req, res) => {
  console.log("Received request for /api/live-interview-turn");
  try {
    // TODO: Add authentication check here later (ensure user is logged in)
    // const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.authorization?.split(' ')[1]);
    // if (!user) return res.status(401).json({ error: 'Unauthorized' });
    // TODO: Check if user is subscribed using profile table? Depends on security needs.

    const {
      resumeText, 
      jobInfo, 
      question, 
      conversationHistory // Array of { question: string, answer: string }
    } = req.body;

    console.log("Live Turn Data Received:");
    console.log("Question:", question);
    console.log("History Length:", conversationHistory?.length || 0);
    // console.log("Resume Text Length:", resumeText?.length || 0);
    // console.log("Job Info:", jobInfo);

    // --- Placeholder Logic (Replace with actual GPT-4o call) --- 
    // 1. Format conversation history
    let historyString = "";
    if (Array.isArray(conversationHistory)) {
      historyString = conversationHistory.map(turn => 
        `Interviewer: ${turn.question}\nCandidate: ${turn.answer}`
      ).join('\n\n');
    }

    // 2. Construct Prompt (using v6 from previous step or similar)
    //    Remember to include the historyString and specific instructions for live mode.
    const systemPromptLive = `SYSTEM_PROMPT_FOR_LIVE_MODE_GPT4o - Include instructions to use history: ${historyString}`; // Placeholder
    const userPromptLive = `Current Question: ${question}\n\nResume:\n${resumeText}\n\nJob Info:\n${JSON.stringify(jobInfo)}`; // Placeholder

    console.log("Placeholder for OpenAI call with history.");
    // 3. Make OpenAI call (GPT-4o recommended)
    // const response = await openai.chat.completions.create({ model: 'gpt-4o', ... });
    // const answer = response.choices[0].message.content.trim();
    
    // 4. Return generated answer (using placeholder for now)
    const placeholderAnswer = `This is a placeholder answer for the live question: \"${question}\". I acknowledge the history of ${conversationHistory?.length || 0} turns. My actual answer would be based on the resume and job info, avoiding repetition.`;
    // --- End Placeholder Logic ---

    res.json({ answer: placeholderAnswer });

  } catch (error) {
    console.error('Error in /api/live-interview-turn:', error);
    res.status(500).json({ 
      error: 'An error occurred during the live interview turn', 
      message: error.message 
    });
  }
});

// NEW Endpoint to generate temporary Deepgram API keys
app.post('/api/deepgram/token', async (req, res) => {
  // TODO: Add authentication check here - ensure user is logged in and maybe subscribed
  // const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.authorization?.split(' ')[1]);
  // if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (!deepgramClient) {
    return res.status(500).json({ error: 'Deepgram client not initialized on server.' });
  }

  try {
    // Create a temporary key with specific capabilities (e.g., streaming) and a time-to-live (TTL)
    // Adjust scopes and TTL as needed for your application
    const newKey = await deepgramClient.manage.createProjectKey(
      process.env.DEEPGRAM_PROJECT_ID, // Assuming you might set PROJECT_ID env var, otherwise use default project
      {
        comment: "Temporary key for InterviewAce live session",
        scopes: ["usage:write"], // Allows creating transcriptions
        time_to_live_in_seconds: 60 * 60, // Key valid for 1 hour
      }
    );

    if (newKey.key) {
      res.json({ deepgramToken: newKey.key });
    } else {
      console.error("Deepgram key creation response missing key:", newKey);
      res.status(500).json({ error: 'Failed to generate Deepgram token.' });
    }
  } catch (error) {
    console.error('Error generating Deepgram token:', error);
    res.status(500).json({ error: 'Could not generate Deepgram token', message: error.message });
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