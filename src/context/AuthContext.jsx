import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient'; // Use the new client utility

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // Add state for profile data
  const [loading, setLoading] = useState(true);

  // Function to fetch profile data
  const fetchProfile = async (userId) => {
    if (!supabase || !userId) return null;
    try {
      console.log("Fetching profile for user:", userId);
      const { data, error, status } = await supabase
        .from('profiles')
        .select(`is_subscribed, full_name`) // Select needed fields
        .eq('id', userId)
        .single();

      if (error && status !== 406) { // 406 means no rows found, which is ok if profile not created yet
        console.error('Error fetching profile:', error);
        return null;
      } 
      console.log("Profile data fetched:", data);
      return data;
    } catch (error) {
      console.error('Exception fetching profile:', error);
      return null;
    }
  };

  useEffect(() => {
    if (!supabase) {
      console.error("Supabase client not available in AuthProvider.");
      setLoading(false);
      return; // Stop if supabase client failed to initialize
    }

    setLoading(true);
    // Check initial session and fetch profile if session exists
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const userProfile = await fetchProfile(currentUser.id);
        setProfile(userProfile);
      } else {
        setProfile(null); // Clear profile on logout
      }
      setLoading(false);
    }).catch(err => {
      console.error("Error getting initial session:", err);
      setProfile(null);
      setLoading(false);
    });

    // Listen for auth changes and fetch profile accordingly
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log("Auth state changed:", _event, session);
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          // Avoid fetching profile again if user object is the same (e.g., token refresh)
          // Simple check for now, might need refinement
          if (currentUser.id !== profile?.id) { 
            setLoading(true); // Show loading while profile fetches
            const userProfile = await fetchProfile(currentUser.id);
            setProfile(userProfile);
            setLoading(false);
          }
        } else {
          setProfile(null); // Clear profile on logout
        }
        // Ensure loading is false if no user
        if (!currentUser) setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      authListener?.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed 'profile' from dependencies to avoid potential loops

  const value = {
    session,
    user,
    profile, // Expose profile data
    loading,
    isSubscribed: profile?.is_subscribed ?? false, // Convenience flag
    // Ensure supabase client exists before calling auth methods
    signUp: (data) => supabase ? supabase.auth.signUp(data) : Promise.reject("Supabase not initialized"),
    signIn: (data) => supabase ? supabase.auth.signInWithPassword(data) : Promise.reject("Supabase not initialized"),
    signOut: () => supabase ? supabase.auth.signOut() : Promise.reject("Supabase not initialized"),
  };

  // Render children only when initial check is done (loading is false)
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
