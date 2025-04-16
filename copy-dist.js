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
    
    // Also copy our default CSS file
    try {
      const defaultCssPath = path.join(__dirname, 'default-styles.css');
      const defaultCssExists = await fs.pathExists(defaultCssPath);
      
      if (defaultCssExists) {
        const assetsPath = path.join(destPath, 'assets');
        await fs.ensureDir(assetsPath);
        await fs.copy(defaultCssPath, path.join(assetsPath, 'default-styles.css'));
        console.log('Successfully copied default styles to assets folder');
      }
    } catch (cssErr) {
      console.warn('Could not copy default CSS file:', cssErr.message);
    }
  } catch (err) {
    console.error('Error copying build files:', err);
    process.exit(1);
  }
}

copyBuildFiles(); 