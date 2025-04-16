/**
 * Tool verification script
 * Ensures all required development tools are installed and working
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Required dev dependencies
const REQUIRED_TOOLS = [
  { name: 'nodemon', package: 'nodemon' },
  { name: 'concurrently', package: 'concurrently' },
  { name: 'kill-port', package: 'kill-port' }
];

// Check node_modules path
const nodeModulesPath = path.join(__dirname, 'node_modules');
const binPath = path.join(nodeModulesPath, '.bin');

console.log('🔍 Verifying development tools...');

let missingTools = [];

// Check if node_modules exists
if (!fs.existsSync(nodeModulesPath)) {
  console.log('❌ node_modules directory not found!');
  console.log('💡 Running npm install to set up dependencies...');
  
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed successfully');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
  }
}

// Check each required tool
REQUIRED_TOOLS.forEach(tool => {
  try {
    // Check bin directory for the executable
    const exeName = process.platform === 'win32' ? `${tool.name}.cmd` : tool.name;
    const exePath = path.join(binPath, exeName);
    
    if (!fs.existsSync(exePath)) {
      console.log(`❌ ${tool.name} not found in node_modules/.bin`);
      missingTools.push(tool);
    } else {
      console.log(`✅ ${tool.name} found at ${exePath}`);
    }
  } catch (error) {
    console.error(`❌ Error checking ${tool.name}:`, error.message);
    missingTools.push(tool);
  }
});

// Install any missing tools
if (missingTools.length > 0) {
  console.log(`\n🔧 Installing ${missingTools.length} missing tools...`);
  
  const installCmd = `npm install ${missingTools.map(t => t.package).join(' ')} --save-dev`;
  console.log(`Running: ${installCmd}`);
  
  try {
    execSync(installCmd, { stdio: 'inherit' });
    console.log('✅ Successfully installed missing tools');
  } catch (error) {
    console.error('❌ Failed to install missing tools:', error.message);
    process.exit(1);
  }
}

// Check package.json scripts
try {
  const packageJson = require('./package.json');
  
  // Verify scripts using correct paths
  const scripts = packageJson.scripts || {};
  const scriptIssues = [];
  
  if (scripts.server && !scripts.server.includes('./node_modules/.bin/nodemon') && !scripts.server.includes('npx nodemon')) {
    scriptIssues.push('server script should use "./node_modules/.bin/nodemon" or "npx nodemon"');
  }
  
  if (scripts.dev && !scripts.dev.includes('./node_modules/.bin/concurrently') && !scripts.dev.includes('npx concurrently')) {
    scriptIssues.push('dev script should use "./node_modules/.bin/concurrently" or "npx concurrently"');
  }
  
  if (scriptIssues.length > 0) {
    console.log('⚠️ Potential issues in package.json scripts:');
    scriptIssues.forEach(issue => console.log(`  - ${issue}`));
    console.log('Consider updating package.json scripts for better compatibility.');
  }
} catch (error) {
  console.error('❌ Error checking package.json:', error.message);
}

console.log('\n✅ Tool verification complete. Ready to run the application!'); 