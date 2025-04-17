import { createClient } from '@supabase/supabase-js'

// Try environment variables first, fallback to hard-coded values if needed
// TEMPORARY FIX: Hardcoded fallbacks should be removed before final production deployment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://kiquqlaijpfebwymwlor.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpcXVxbGFpanBmZWJ3eW13bG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2ODEwODYsImV4cCI6MjA2MDI1NzA4Nn0.q3iuKlNj48HCCLjbgIrs52MNT3tPrajWGQmwsOPmsho";

// Add diagnostic info
console.log(`[supabaseClient] Initializing with URL: ${supabaseUrl.substring(0, 15)}...`);
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