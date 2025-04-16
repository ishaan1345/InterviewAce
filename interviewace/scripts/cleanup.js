/**
 * Clean up script to kill processes on relevant ports and remove lock files
 * Run with: npm run dev-clean
 */

const { execSync } = require('child_process');
const findProcess = require('find-process');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Configuration
const PORTS_TO_CHECK = Array.from({ length: 11 }, (_, i) => 3000 + i);
const LOCK_FILE = path.join(__dirname, '..', '.server.lock');
const isWindows = os.platform() === 'win32';

// Remove lock file if it exists
function removeLockFile() {
  console.log('🔓 Checking for lock file...');
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
      console.log(`Found lock file for process ${lockData.pid} on port ${lockData.port}`);
      
      fs.unlinkSync(LOCK_FILE);
      console.log('✅ Lock file removed');
    } else {
      console.log('No lock file found');
    }
  } catch (err) {
    console.error('❌ Error handling lock file:', err.message);
  }
}

// Clean up ports using kill-port for simpler handling
async function cleanupPorts() {
  console.log('🧹 Cleaning up ports 3000-3010...');
  
  try {
    // Use kill-port directly for more consistent results
    const portsString = PORTS_TO_CHECK.join(' ');
    try {
      const result = execSync(`npx kill-port ${portsString}`, { encoding: 'utf8' });
      console.log(result);
    } catch (err) {
      // kill-port returns non-zero if some ports weren't in use, which is fine
      console.log(err.stdout);
    }
    console.log('✅ Port cleanup completed');
  } catch (err) {
    console.error('❌ Error cleaning up ports:', err.message);
  }
}

// Clean up Node processes
async function cleanupNodeProcesses() {
  console.log('🧹 Cleaning up stale Node.js processes...');
  
  try {
    const processes = await findProcess('name', 'node');
    
    for (const proc of processes) {
      // Only kill node processes that include our app name or server.js in the command
      if (proc.cmd && (
        proc.cmd.includes('interviewace') || 
        proc.cmd.includes('server.js')
      )) {
        console.log(`Found InterviewAce Node process: PID ${proc.pid}`);
        try {
          if (isWindows) {
            execSync(`taskkill /F /PID ${proc.pid}`);
          } else {
            execSync(`kill -9 ${proc.pid}`);
          }
          console.log(`✅ Killed process ${proc.pid}`);
        } catch (err) {
          console.error(`❌ Failed to kill process ${proc.pid}:`, err.message);
        }
      }
    }
    console.log('✅ Node process cleanup completed');
  } catch (err) {
    console.error('❌ Error cleaning up Node processes:', err.message);
  }
}

async function main() {
  try {
    console.log('🚀 Starting cleanup process');
    
    // Remove lock file first
    removeLockFile();
    
    // Clean up ports
    await cleanupPorts();
    
    // Clean up Node processes
    await cleanupNodeProcesses();
    
    console.log('🎉 All cleanup tasks completed successfully');
    console.log('You can now start the development server with: npm run dev');
  } catch (err) {
    console.error('❌ Error during cleanup:', err);
    process.exit(1);
  }
}

main(); 