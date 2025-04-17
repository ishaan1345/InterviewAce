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
      let initialProfileFetchAttempted = false; // Flag to prevent redundant setLoading(false)

      if (currentUser) {
        console.log("[Initial Load] Fetching profile for user:", currentUser.id);
        initialProfileFetchAttempted = true;
        try {
          const userProfile = await fetchProfile(currentUser.id);
          console.log("[Initial Load] Profile fetch result:", userProfile);
          setProfile(userProfile);
        } catch (error) {
          console.error("[Initial Load] EXCEPTION during profile fetch:", error);
          setProfile(null); // Ensure profile is null on error
        } finally {
          // Ensure loading is only set once
          if (loading) { // Check if loading is still true
            console.log("[Initial Load] Setting loading false (after profile fetch attempt).");
            setLoading(false); // ALWAYS set loading false after initial profile fetch attempt
          }
        }
      } else {
        setProfile(null); // Clear profile if no initial session
      }

      // Only set loading false here if profile fetch wasn't attempted (no user)
      // and it hasn't already been set in the finally block above
      if (!initialProfileFetchAttempted && loading) {
         console.log("[Initial Load] No user, setting loading false.");
         setLoading(false);
      }

    }).catch(err => {
      console.error("Error getting initial session:", err);
      setProfile(null);
      // Ensure loading is only set once even in catch
      if (loading) { 
        console.log("[Initial Load] Setting loading false (in getSession catch).");
        setLoading(false); 
      }
    });

    // Listen for auth changes and fetch profile accordingly
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log("Auth state changed event:", _event);
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        // Ensure loading is handled correctly even with potential profile fetch errors
        if (currentUser) {
          // Avoid fetching profile again if user object hasn't changed significantly
          // Simple ID check for now.
          if (!profile || currentUser.id !== profile.id) { 
            setLoading(true); // Show loading while profile fetches
            console.log("[Auth State Change] Fetching profile for user:", currentUser.id);
            try {
              const userProfile = await fetchProfile(currentUser.id);
              console.log("[Auth State Change] Profile fetch result:", userProfile);
              setProfile(userProfile); 
            } catch (error) {
              console.error("[Auth State Change] EXCEPTION during profile fetch:", error);
              setProfile(null); // Ensure profile is null on error
            } finally {
              console.log("[Auth State Change] Setting loading to false.");
              setLoading(false); // ALWAYS set loading false after attempt
            }
          } else {
            // User exists but profile hasn't changed, ensure loading is false
            if (loading) setLoading(false);
          }
        } else {
          // No user, clear profile and ensure loading is false
          console.log("[Auth State Change] No user, clearing profile and setting loading false.");
          setProfile(null); 
          setLoading(false); 
        }
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
