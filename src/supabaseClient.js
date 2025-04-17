import { createClient } from '@supabase/supabase-js'

// Try environment variables first, fallback to hard-coded values if needed
// TEMPORARY FIX: Hardcoded fallbacks should be removed before final production deployment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://kiquqlaijpfebwymwlor.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpcXVxbGFpanBmZWJ3eW13bG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2ODEwODYsImV4cCI6MjA2MDI1NzA4Nn0.q3iuKlNj48HCCLjbgIrs52MNT3tPrajWGQmwsOPmsho";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase URL or Anon Key in frontend environment variables (src/.env)');
  // You might want to display an error to the user or disable features
}

// Export the client, handling potential initialization failure
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!supabase) {
  console.error('Supabase client could not be initialized on the frontend.');
} 