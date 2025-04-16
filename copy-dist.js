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
    
    // Handle CSS files specially for better styling support
    try {
      // Create the assets directory if it doesn't exist
      const assetsPath = path.join(destPath, 'assets');
      await fs.ensureDir(assetsPath);
      
      // Copy the default CSS file
      const defaultCssPath = path.join(__dirname, 'default-styles.css');
      const defaultCssExists = await fs.pathExists(defaultCssPath);
      
      if (defaultCssExists) {
        await fs.copy(defaultCssPath, path.join(assetsPath, 'default-styles.css'));
        console.log('Successfully copied default styles to assets folder');
      }
      
      // Copy the src/index.css file for Tailwind directives
      const srcIndexCssPath = path.join(__dirname, 'src', 'index.css');
      const srcIndexCssExists = await fs.pathExists(srcIndexCssPath);
      
      if (srcIndexCssExists) {
        await fs.copy(srcIndexCssPath, path.join(assetsPath, 'index-source.css'));
        console.log('Successfully copied source index.css with Tailwind directives');
      }
      
      // Find and ensure all CSS files are copied
      const cssFiles = await findFiles(srcPath, '.css');
      console.log(`Found ${cssFiles.length} CSS files in the build`);
      
      // Create a combined CSS file for stability
      const combinedCssPath = path.join(assetsPath, 'combined-styles.css');
      let combinedCss = '/* Combined CSS for InterviewAce */\n\n';
      
      for (const cssFile of cssFiles) {
        const cssContent = await fs.readFile(cssFile, 'utf8');
        combinedCss += `/* From ${path.basename(cssFile)} */\n${cssContent}\n\n`;
      }
      
      if (defaultCssExists) {
        const defaultCss = await fs.readFile(defaultCssPath, 'utf8');
        combinedCss += `/* Default styles */\n${defaultCss}\n`;
      }
      
      await fs.writeFile(combinedCssPath, combinedCss);
      console.log(`Created combined CSS file at ${combinedCssPath}`);
      
      // Inject the combined CSS into index.html
      const indexHtmlPath = path.join(destPath, 'index.html');
      if (await fs.pathExists(indexHtmlPath)) {
        let htmlContent = await fs.readFile(indexHtmlPath, 'utf8');
        
        // Check if we need to add the combined CSS
        if (!htmlContent.includes('combined-styles.css')) {
          htmlContent = htmlContent.replace(
            '</head>',
            `  <link rel="stylesheet" href="/assets/combined-styles.css">\n</head>`
          );
          await fs.writeFile(indexHtmlPath, htmlContent);
          console.log('Injected combined CSS link into index.html');
        }
      }
    } catch (cssErr) {
      console.warn('Error handling CSS files:', cssErr);
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