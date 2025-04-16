// Simple Express server for handling API requests
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import winston from 'winston';
import 'winston-daily-rotate-file';

// Get current file path in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Set up Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    })
  );
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Add security headers in production
if (NODE_ENV === 'production') {
  app.use(helmet());
}

// Setup rate limiting for API endpoints to prevent abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'production' ? 10 : 100, // tighter limits in production
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again later.'
  }
});

// Enhanced CORS configuration to fix cross-origin issuesa
const allowedOrigins = NODE_ENV === 'production' 
  ? [process.env.FRONTEND_URL || 'https://interviewace.netlify.app', 'https://www.interviewace.netlify.app'] 
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, { 
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

app.use(express.json({ limit: '5mb' })); // Increase limit for resume uploads
app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }));

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Express error:', { 
    error: err.message,
    stack: err.stack,
    path: req.path
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Simple in-memory cache for responses (production would use Redis)
const responseCache = new Map();

// Cache TTL in ms (1 hour)
const CACHE_TTL = 60 * 60 * 1000;

// Define common company values for tailoring responses
const COMPANY_VALUES = {
  'Google': 'Focus on the user, freedom to innovate, being technically excellent, and working as a team while maintaining a fun environment.',
  'Microsoft': 'Innovation, diversity and inclusion, corporate social responsibility, and making technology accessible to everyone.',
  'Amazon': 'Customer obsession, ownership, innovation, high standards, bias for action, frugality, and deliver results.',
  'Apple': 'Innovation, quality, simplicity, and a seamless customer experience.',
  'Facebook': 'Move fast, be bold, focus on impact, be open, and build social value.',
  'Netflix': 'Judgment, communication, curiosity, courage, passion, selflessness, innovation, inclusion, integrity, and impact.',
  'Uber': 'Customer obsession, continuous improvement, bold innovation, and creating opportunities through movement.',
  'Airbnb': 'Community belonging, creating unique human connections, and making people feel valued and at home.',
  'Twitter': 'Promoting free expression, fostering healthy conversations, and championing social justice.',
  'LinkedIn': 'Professional growth, relationships matter, transformation, integrity, and collaboration.'
};

// Function to get company values by name (supports partial matches)
const getCompanyValues = (companyName) => {
  if (!companyName) return null;
  
  // Direct match
  if (COMPANY_VALUES[companyName]) {
    return COMPANY_VALUES[companyName];
  }
  
  // Partial match
  const lowerName = companyName.toLowerCase();
  for (const [company, values] of Object.entries(COMPANY_VALUES)) {
    if (lowerName.includes(company.toLowerCase()) || company.toLowerCase().includes(lowerName)) {
      return values;
    }
  }
  
  return null;
};

// Function to extract keywords from resume text
const extractKeywords = (resumeText) => {
  if (!resumeText) return {};
  
  const extractedKeywords = {};
  
  // Extract skills from a skills section
  const skillsMatch = resumeText.match(/SKILLS.*?(?:\n|•|\*|\-)\s*(.*?)(?=\n\n|\n[A-Z]|$)/si);
  if (skillsMatch && skillsMatch[1]) {
    const skillsSection = skillsMatch[1];
    const skills = skillsSection
      .split(/[,•\n\*\-]/)
      .map(skill => skill.trim())
      .filter(skill => skill.length > 2 && !/^\d+$/.test(skill));
    
    extractedKeywords.skills = Array.from(new Set(skills)); // Remove duplicates
  }
  
  // Extract education from education section
  const educationMatch = resumeText.match(/EDUCATION.*?((?:Bachelor|Master|PhD|B\.S\.|M\.S\.|B\.A\.|M\.A\.|MBA|Ph\.D).*?)(?=\n\n|\n[A-Z]|$)/si);
  if (educationMatch && educationMatch[1]) {
    extractedKeywords.education = educationMatch[1].trim().replace(/\n+/g, ' ');
  }
  
  // Extract experience from job titles or experience section
  const experienceMatch = resumeText.match(/EXPERIENCE.*?(?:\n|•|\*|\-)\s*(.*?)(?=\n\n|\n[A-Z]|$)/si);
  if (experienceMatch && experienceMatch[1]) {
    extractedKeywords.experience = experienceMatch[1].trim();
  }
  
  // Try to extract years of experience
  const yearsMatch = resumeText.match(/(\d+)\+?\s*(?:years|yrs)(?:\s+of)?\s+(?:experience|work)/i);
  if (yearsMatch && yearsMatch[1]) {
    extractedKeywords.yearsOfExperience = yearsMatch[1];
  }
  
  return extractedKeywords;
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', environment: NODE_ENV });
});

// API endpoint to generate answers
app.post('/api/generate-answer', apiLimiter, async (req, res) => {
  try {
    logger.info('Received request to generate answer', { 
      questionLength: req.body.question?.length,
      resumeLength: req.body.resumeText?.length
    });
    
    const { 
      question, 
      resumeText, 
      jobDescription, 
      jobTitle, 
      companyName, 
      responsibilities,
      customInstructions 
    } = req.body;
    
    // Validate inputs
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    if (!resumeText) {
      return res.status(400).json({ error: 'Resume is required' });
    }

    // Create a cache key from the request data
    const cacheKey = JSON.stringify({
      question,
      resumeText: resumeText.slice(0, 100), // Just use the start of resume for cache key
      jobTitle,
      companyName
    });

    // Check if we have a cached response
    if (responseCache.has(cacheKey)) {
      logger.info('Returning cached response');
      return res.json(responseCache.get(cacheKey));
    }
    
    // Extract keywords from resume
    const extractedKeywords = extractKeywords(resumeText);
    
    // Get company values if company name is provided
    const companyValues = companyName ? getCompanyValues(companyName) : null;
    
    // Prepare metadata to return to client
    const metadata = {
      extractedKeywords,
      companyValues,
      timestamp: new Date().toISOString()
    };
    
    // Build prompt for AI
    let systemPrompt = `You are an expert interview coach specializing in crafting personalized interview answers that showcase a candidate's unique qualifications. Follow these guidelines:

1. Analyze the provided resume data to identify key skills, experiences, and achievements.
2. Create a personalized answer that directly addresses the interview question.
3. Incorporate specific details from the resume to demonstrate how the candidate's background makes them an ideal fit.
4. Match your answer tone to the job and company culture - be enthusiastic and professional.
5. Structure your answer using the STAR method (Situation, Task, Action, Result) where appropriate.
6. Keep answers concise (250-350 words) and focused on concrete examples.
7. Include specific metrics and achievements where possible.
8. End with a statement that ties the answer back to the job requirements.`;
    
    if (companyValues) {
      systemPrompt += `\n9. Subtly incorporate the company's values in your answer. Their values include: ${companyValues}`;
    }
    
    if (customInstructions) {
      systemPrompt += `\n\nAdditional Custom Instructions: ${customInstructions}`;
    }
    
    let prompt = `Based on the following information, help me craft a personalized, detailed, and authentic interview answer.

Interview Question: ${question}

Job Details:
${jobTitle ? `- Title: ${jobTitle}` : ''}
${companyName ? `- Company: ${companyName}` : ''}
${jobDescription ? `- Description: ${jobDescription}` : ''}
${responsibilities ? `- Key Responsibilities: ${responsibilities}` : ''}

Resume Information:
${resumeText.slice(0, 3000)}`;
    
    if (Object.keys(extractedKeywords).length > 0) {
      prompt += `\n\nKey resume highlights:`;
      
      if (extractedKeywords.skills && extractedKeywords.skills.length > 0) {
        prompt += `\n- Skills: ${extractedKeywords.skills.join(', ')}`;
      }
      
      if (extractedKeywords.education) {
        prompt += `\n- Education: ${extractedKeywords.education}`;
      }
      
      if (extractedKeywords.experience) {
        prompt += `\n- Experience: ${extractedKeywords.experience}`;
      }
      
      if (extractedKeywords.yearsOfExperience) {
        prompt += `\n- Years of experience: ${extractedKeywords.yearsOfExperience}`;
      }
    }
    
    prompt += '\n\nPlease craft a detailed, professional, and authentic answer to this interview question based on the provided resume and job details. Use specific examples from the resume where relevant.';
    
    logger.info('Sending request to OpenAI API');
    
    // Validate API key before making request
    if (!process.env.OPENAI_API_KEY) {
      logger.error('Missing OpenAI API key');
      return res.status(500).json({ error: 'Server configuration error: Missing API key' });
    }
    
    // Call OpenAI API to generate the answer
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        timeout: 30000 // 30 second timeout
      }
    );
    
    const generatedAnswer = response.data.choices[0].message.content.trim();
    logger.info('Answer generated successfully', { 
      answerLength: generatedAnswer.length,
      promptTokens: response.data.usage?.prompt_tokens,
      completionTokens: response.data.usage?.completion_tokens
    });
    
    // Store in cache
    const responseData = {
      answer: generatedAnswer,
      metadata: metadata
    };
    
    responseCache.set(cacheKey, responseData);
    
    // Set cache expiration
    setTimeout(() => {
      responseCache.delete(cacheKey);
    }, CACHE_TTL);
    
    // Return the answer along with metadata for client-side display
    res.json(responseData);
  } catch (error) {
    logger.error('Error generating answer:', { 
      error: error.message,
      statusCode: error.response?.status,
      errorDetails: error.response?.data
    });
    
    // Enhanced error handling
    if (error.response?.status === 429) {
      return res.status(429).json({ 
        error: 'OpenAI rate limit exceeded. Please try again later.' 
      });
    }
    
    if (error.response?.status === 401 || error.response?.status === 403) {
      logger.error('API key error:', error.response?.data);
      return res.status(500).json({ 
        error: 'Authentication error with AI service. Please contact support.' 
      });
    }
    
    const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error occurred';
    res.status(500).json({ error: `Failed to generate answer: ${errorMessage}` });
  }
});

// Serve static files in production
if (NODE_ENV === 'production') {
  // Serve any static files
  app.use(express.static(join(__dirname, 'dist')));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
  logger.info('Received shutdown signal, closing server...');
  
  // Close database connections, etc. here if needed
  
  process.exit(0);
}

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${NODE_ENV} mode`);
}); 
