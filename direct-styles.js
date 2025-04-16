// A direct, no-dependency approach to inject styles into the HTML response
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Basic styles that work without Tailwind
const INLINE_STYLES = `
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.5;
  color: #111827;
  background-color: #f9fafb;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

main {
  flex: 1;
  padding: 1rem;
}

header {
  background-color: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h1, h2, h3, h4, h5 {
  margin-top: 0;
  margin-bottom: 0.5rem;
}

.card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  padding: 1rem;
  margin-bottom: 1rem;
}

button {
  background-color: #0073ff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
}

button:hover {
  background-color: #005ccc;
}

input, textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  margin-bottom: 1rem;
}

footer {
  background-color: white;
  border-top: 1px solid #e5e7eb;
  padding: 1rem;
  text-align: center;
  font-size: 0.875rem;
  color: #6b7280;
}

/* Standard utility classes */
.container { max-width: 1200px; margin: 0 auto; }
.flex { display: flex; }
.items-center { align-items: center; }
.justify-between { justify-between: space-between; }
.mt-4 { margin-top: 1rem; }
.mb-4 { margin-bottom: 1rem; }
.p-4 { padding: 1rem; }
.bg-white { background-color: white; }
.text-center { text-align: center; }
.grid { display: grid; }
.grid-cols-1 { grid-template-columns: 1fr; }
.shadow { box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.rounded { border-radius: 0.25rem; }
.hidden { display: none; }

@media (min-width: 640px) {
  .sm\\:grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .lg\\:grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
}
`;

// Create a middleware function that directly modifies HTML responses
export function createDirectStylesMiddleware() {
  // Return the actual middleware function
  return function directStylesMiddleware(req, res, next) {
    // Only intercept requests for HTML
    if (req.path === '/' || req.path.endsWith('.html')) {
      // Store the original send function
      const originalSend = res.send;
      
      // Override the send function
      res.send = function(body) {
        // Only process HTML responses
        if (typeof body === 'string' && body.includes('<!DOCTYPE html>')) {
          // Insert our styles directly into the HTML
          body = body.replace('</head>', `<style>${INLINE_STYLES}</style></head>`);
          
          // Clear any cache headers
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          res.setHeader('Surrogate-Control', 'no-store');
          
          console.log('Applied direct styles to HTML response');
        }
        
        // Call the original send with our modified body
        return originalSend.call(this, body);
      };
    }
    
    // Continue to the next middleware
    next();
  };
}

// Allow direct importing and execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('Direct styles script executed directly');
  // Implementation for direct script execution if needed
} 