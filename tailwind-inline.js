// Helper script to generate Tailwind CSS in case the build process doesn't include it
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Basic Tailwind utility classes that are commonly used
const basicTailwindCSS = `
/* Basic Tailwind utilities */
.bg-white { background-color: #ffffff; }
.bg-gray-50 { background-color: #f9fafb; }
.bg-gray-100 { background-color: #f3f4f6; }
.bg-primary-600 { background-color: #0073ff; }
.text-white { color: #ffffff; }
.text-gray-500 { color: #6b7280; }
.text-gray-700 { color: #374151; }
.text-gray-800 { color: #1f2937; }
.text-gray-900 { color: #111827; }
.border { border-width: 1px; }
.border-gray-200 { border-color: #e5e7eb; }
.rounded-md { border-radius: 0.375rem; }
.rounded-lg { border-radius: 0.5rem; }
.rounded-xl { border-radius: 0.75rem; }
.shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
.py-4 { padding-top: 1rem; padding-bottom: 1rem; }
.px-4 { padding-left: 1rem; padding-right: 1rem; }
.py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
.px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
.m-4 { margin: 1rem; }
.mx-auto { margin-left: auto; margin-right: auto; }
.my-4 { margin-top: 1rem; margin-bottom: 1rem; }
.mt-4 { margin-top: 1rem; }
.mb-4 { margin-bottom: 1rem; }
.flex { display: flex; }
.grid { display: grid; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.space-y-4 > * + * { margin-top: 1rem; }
.space-x-4 > * + * { margin-left: 1rem; }
.w-full { width: 100%; }
.max-w-5xl { max-width: 64rem; }
.font-medium { font-weight: 500; }
.text-sm { font-size: 0.875rem; line-height: 1.25rem; }
.text-lg { font-size: 1.125rem; line-height: 1.75rem; }
.text-xl { font-size: 1.25rem; line-height: 1.75rem; }
.grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
@media (min-width: 640px) {
  .sm\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1024px) {
  .lg\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
`;

/**
 * Generate inline Tailwind CSS to be used if the CSS file is missing
 */
export async function generateInlineTailwind() {
  const destPath = path.join(__dirname, 'dist', 'assets');
  
  try {
    // Check if the destination directory exists
    await fs.ensureDir(destPath);
    
    // Write the basic Tailwind CSS file
    const cssFilePath = path.join(destPath, 'tailwind-fallback.css');
    await fs.writeFile(cssFilePath, basicTailwindCSS);
    
    console.log(`Generated fallback Tailwind CSS at ${cssFilePath}`);
    return cssFilePath;
  } catch (err) {
    console.error('Error generating Tailwind CSS fallback:', err);
    return null;
  }
}

/**
 * Middleware to inject Tailwind CSS into HTML if the CSS file is missing
 */
export function tailwindMiddleware(buildPath) {
  return async (req, res, next) => {
    // Only process HTML requests
    if (req.path === '/' || req.path.endsWith('.html')) {
      // Read the original HTML
      const indexPath = path.join(buildPath, 'index.html');
      
      try {
        let html = await fs.readFile(indexPath, 'utf8');
        
        // Always inject our default CSS to ensure basic styling works
        const defaultCssLink = '<link rel="stylesheet" href="/assets/default-styles.css">';
        
        // Check if the default stylesheet is already included
        if (!html.includes('default-styles.css')) {
          html = html.replace(
            '</head>',
            `${defaultCssLink}</head>`
          );
          
          // Save the modified HTML for future requests
          try {
            await fs.writeFile(indexPath, html);
            console.log('Updated index.html with default styles link');
          } catch (writeErr) {
            console.warn('Could not save updated HTML:', writeErr.message);
          }
          
          // Send the modified HTML
          return res.send(html);
        }
      } catch (err) {
        console.error('Error in Tailwind middleware:', err);
      }
    }
    
    // Continue with the next middleware
    next();
  };
} 