import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient'; // Use the new client utility

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      console.error("Supabase client not available in AuthProvider.");
      setLoading(false);
      return; // Stop if supabase client failed to initialize
    }

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(err => {
      console.error("Error getting initial session:", err);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false); // Ensure loading is set to false on change
      }
    );

    // Cleanup listener on unmount
    return () => {
      authListener?.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user,
    loading,
    // Ensure supabase client exists before calling auth methods
    signUp: (data) => supabase ? supabase.auth.signUp(data) : Promise.reject("Supabase not initialized"),
    signIn: (data) => supabase ? supabase.auth.signInWithPassword(data) : Promise.reject("Supabase not initialized"),
    signOut: () => supabase ? supabase.auth.signOut() : Promise.reject("Supabase not initialized"),
  };

  // Don't render children until loading is complete
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
