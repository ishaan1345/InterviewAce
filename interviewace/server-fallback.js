/**
 * Fallback script for server.js in case nodemon is not available
 * This will check for nodemon and try to run it, falling back to regular node
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Paths
const serverPath = path.join(__dirname, 'server.js');
const nodeModulesPath = path.join(__dirname, 'node_modules', '.bin');
const nodemonPath = path.join(nodeModulesPath, process.platform === 'win32' ? 'nodemon.cmd' : 'nodemon');

// Check if a file exists
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
}

// Attempt to install missing nodemon
function installNodemon() {
  console.log('Attempting to install nodemon...');
  try {
    console.log('Running npm install nodemon --save-dev');
    execSync('npm install nodemon --save-dev', { stdio: 'inherit' });
    console.log('Successfully installed nodemon');
    return true;
  } catch (err) {
    console.error('Failed to install nodemon:', err.message);
    return false;
  }
}

// Run server with nodemon if available, otherwise use node
function startServer() {
  console.log('Starting server...');
  
  // Check if server.js exists
  if (!fileExists(serverPath)) {
    console.error(`Error: server.js not found at ${serverPath}`);
    process.exit(1);
  }
  
  // Try to use nodemon first
  if (fileExists(nodemonPath)) {
    console.log('Using nodemon for auto-restart on changes.');
    
    const args = ['--watch', 'server.js', '--watch', '.env', 'server.js'];
    const nodemon = spawn(nodemonPath, args, { stdio: 'inherit' });
    
    nodemon.on('error', (err) => {
      console.error('Failed to start nodemon:', err);
      
      // Try to install nodemon if not found
      if (err.code === 'ENOENT') {
        if (installNodemon()) {
          console.log('Restarting with newly installed nodemon...');
          startServer();
          return;
        }
      }
      
      console.log('Falling back to regular node...');
      startWithNode();
    });
    
    nodemon.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.log(`nodemon exited with code ${code}, falling back to regular node...`);
        startWithNode();
      }
    });
  } else {
    console.log('nodemon not found in node_modules/.bin');
    
    // Try to install nodemon
    if (installNodemon()) {
      console.log('Restarting with newly installed nodemon...');
      startServer();
      return;
    }
    
    console.log('Using regular node as fallback.');
    startWithNode();
  }
}

// Fallback to regular node
function startWithNode() {
  console.log('Starting server with regular node (no auto-restart).');
  console.log('WARNING: Changes to server code will require manual restart.');
  
  const node = spawn('node', [serverPath], { stdio: 'inherit' });
  
  node.on('error', (err) => {
    console.error('Failed to start node:', err);
    process.exit(1);
  });
  
  node.on('exit', (code) => {
    console.log(`Server exited with code ${code}`);
    process.exit(code || 0);
  });
}

// Main execution
startServer(); 