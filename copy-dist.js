// Helper script to copy build files from src/dist to root/dist
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function copyBuildFiles() {
  const srcPath = path.join(__dirname, 'src', 'dist');
  const destPath = path.join(__dirname, 'dist');
  
  try {
    // Check if source folder exists
    const exists = await fs.pathExists(srcPath);
    if (!exists) {
      console.error(`Source path does not exist: ${srcPath}`);
      return;
    }
    
    // Ensure the destination directory exists
    await fs.ensureDir(destPath);
    
    // Copy files from src/dist to root/dist
    await fs.copy(srcPath, destPath);
    console.log(`Successfully copied build files from ${srcPath} to ${destPath}`);
    
    // Ensure CSS is properly included in the build
    try {
      // Create assets directory if it doesn't exist
      const assetsPath = path.join(destPath, 'assets');
      await fs.ensureDir(assetsPath);
      
      // Get all CSS files from the build
      const cssFiles = await findFiles(srcPath, '.css');
      console.log(`Found ${cssFiles.length} CSS files in the build`);
      
      // Create a simple CSS file to ensure basic styling works
      const cssContent = `/* Basic CSS to ensure styling works */
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background-color: #f9fafb;
  color: #111827;
  line-height: 1.5;
}

.card {
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  margin-bottom: 1rem;
}

button {
  background-color: #0073ff;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
}

.bg-white { background-color: white; }
.bg-gray-50 { background-color: #f9fafb; }
.bg-gray-100 { background-color: #f3f4f6; }
.text-gray-700 { color: #374151; }
.text-gray-900 { color: #111827; }
`;
      
      // Write a backup CSS file
      const backupCssPath = path.join(assetsPath, 'backup-styles.css');
      await fs.writeFile(backupCssPath, cssContent);
      
      // Update index.html to include both CSS files
      const indexHtmlPath = path.join(destPath, 'index.html');
      if (await fs.pathExists(indexHtmlPath)) {
        let htmlContent = await fs.readFile(indexHtmlPath, 'utf8');
        
        // Ensure all CSS imports are properly linked
        const headCloseTag = '</head>';
        const cssLinks = cssFiles.map(file => {
          const relativePath = path.relative(destPath, file);
          return `  <link rel="stylesheet" href="./${relativePath.replace(/\\/g, '/')}">\n`;
        }).join('');
        
        // Add backup CSS link
        const backupCssLink = `  <link rel="stylesheet" href="./assets/backup-styles.css">\n`;
        
        // Replace head close tag with CSS links followed by the tag
        if (!htmlContent.includes('backup-styles.css')) {
          htmlContent = htmlContent.replace(
            headCloseTag,
            `${cssLinks}${backupCssLink}${headCloseTag}`
          );
          await fs.writeFile(indexHtmlPath, htmlContent);
          console.log('Updated index.html with CSS links');
        }
      }
    } catch (cssErr) {
      console.error('Error handling CSS files:', cssErr);
    }
  } catch (err) {
    console.error('Error copying build files:', err);
    process.exit(1);
  }
}

// Helper function to find files with a specific extension
async function findFiles(directory, extension) {
  const files = [];
  
  async function scan(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(extension)) {
        files.push(fullPath);
      }
    }
  }
  
  await scan(directory);
  return files;
}

copyBuildFiles(); 