import { createClient } from '@supabase/supabase-js'

// In production, environment variables are injected at build time as part of the window object
// Try environment variables first, fallback to window.__ENV if available, then to hardcoded values
const getEnvVar = (viteKey, windowKey) => {
  // First try Vite env vars which work in development
  if (import.meta.env[viteKey]) return import.meta.env[viteKey];
  
  // Then try window.__ENV which can be used in production when set by server
  if (typeof window !== 'undefined' && window.__ENV && window.__ENV[windowKey]) {
    return window.__ENV[windowKey];
  }
  
  // Fallback to hardcoded values as last resort
  if (viteKey === 'VITE_SUPABASE_URL') return "https://kiquqlaijpfebwymwlor.supabase.co";
  if (viteKey === 'VITE_SUPABASE_ANON_KEY') return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpcXVxbGFpanBmZWJ3eW13bG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2ODEwODYsImV4cCI6MjA2MDI1NzA4Nn0.q3iuKlNj48HCCLjbgIrs52MNT3tPrajWGQmwsOPmsho";
  
  return null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', 'SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');

// Add diagnostic info
console.log(`[supabaseClient] Initializing with URL: ${supabaseUrl ? supabaseUrl.substring(0, 15) + '...' : 'MISSING'}`);
console.log(`[supabaseClient] Anon key present: ${!!supabaseAnonKey}`);

let supabase = null;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[supabaseClient] Missing Supabase URL or Anon Key in frontend environment variables (src/.env)');
  // You might want to display an error to the user or disable features
} else {
  // Try/catch to handle any client initialization failures
  try {
    // Export the client, handling potential initialization failure
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Add more detailed logging
        debug: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
    
    console.log('[supabaseClient] Supabase client initialized successfully');
    
    // Verify connection with a simple test
    (async () => {
      try {
        const { error } = await supabase.from('health_check').select('*').limit(1);
        if (error) {
          console.warn('[supabaseClient] Connection test failed:', error.message);
        } else {
          console.log('[supabaseClient] Connection test succeeded');
        }
      } catch (err) {
        console.error('[supabaseClient] Connection test exception:', err.message);
      }
    })();
  } catch (error) {
    console.error('[supabaseClient] Failed to initialize Supabase client:', error);
    supabase = null;
  }
}

if (!supabase) {
  console.error('[supabaseClient] Supabase client could not be initialized on the frontend.');
  // Add a custom event for error tracking
  const event = new CustomEvent('supabase-init-failed');
  window.dispatchEvent(event);
}

export { supabase }; 