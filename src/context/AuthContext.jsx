import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient'; // Use the new client utility

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // Add state for profile data
  const [loading, setLoading] = useState(true);
  const [renderStatus, setRenderStatus] = useState('initializing'); // Track render status for debugging

  // Log important state changes to help debug issues
  useEffect(() => {
    console.log(`[AuthProvider] renderStatus: ${renderStatus}, loading: ${loading}, user: ${user ? 'exists' : 'null'}`);
  }, [renderStatus, loading, user]);

  // Function to fetch profile data
  const fetchProfile = async (userId) => {
    if (!supabase || !userId) {
      // Throw an error if supabase client isn't ready or no userId provided
      throw new Error("Supabase client not available or userId missing for fetchProfile.");
    }

    console.log("[fetchProfile] Attempting for user:", userId);
    try {
      const { data, error, status } = await supabase
        .from('profiles')
        .select(`is_subscribed, full_name`) // Select needed fields
        .eq('id', userId)
        .single();

      // Handle Supabase-specific errors (like RLS)
      if (error && status !== 406) { // 406 means no rows found, treat as non-error for profile creation flow
        console.error('[fetchProfile] Supabase query error:', error);
        throw error; // Re-throw the Supabase error object
      } 

      console.log("[fetchProfile] Profile data fetched:", data);
      return data; // Return data if successful (can be null if status 406)

    } catch (error) {
      // Catch exceptions from the await call itself or re-thrown Supabase errors
      console.error('[fetchProfile] Exception during fetch:', error);
      throw error; // Re-throw the caught error to ensure caller handles it
    }
  };

  useEffect(() => {
    // Mark that we've started initialization
    setRenderStatus('checking-supabase');
    
    if (!supabase) {
      console.error("Supabase client not available in AuthProvider.");
      setLoading(false);
      setRenderStatus('error-no-supabase');
      return; // Stop if supabase client failed to initialize
    }

    setLoading(true);
    setRenderStatus('loading-session');

    // Check initial session and fetch profile if session exists
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setRenderStatus('session-loaded');
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      let initialProfileFetchAttempted = false; // Flag to prevent redundant setLoading(false)

      if (currentUser) {
        console.log("[Initial Load] Fetching profile for user:", currentUser.id);
        setRenderStatus('fetching-profile');
        initialProfileFetchAttempted = true;
        try {
          const userProfile = await fetchProfile(currentUser.id);
          console.log("[Initial Load] Profile fetch result:", userProfile);
          setProfile(userProfile);
          setRenderStatus('profile-loaded');
        } catch (error) {
          console.error("[Initial Load] EXCEPTION during profile fetch:", error);
          setProfile(null); // Ensure profile is null on error
          setRenderStatus('profile-error');
        } finally {
          // Ensure loading is only set once
          if (loading) { // Check if loading is still true
            console.log("[Initial Load] Setting loading false (after profile fetch attempt).");
            setLoading(false); // ALWAYS set loading false after initial profile fetch attempt
            setRenderStatus('ready-with-user');
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
         setRenderStatus('ready-no-user');
      }

    }).catch(err => {
      console.error("Error getting initial session:", err);
      setProfile(null);
      // Ensure loading is only set once even in catch
      if (loading) { 
        console.log("[Initial Load] Setting loading false (in getSession catch).");
        setLoading(false); 
        setRenderStatus('error-session-fetch');
      }
    });

    // Listen for auth changes and fetch profile accordingly
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log("Auth state changed event:", _event);
        setRenderStatus(`auth-event-${_event}`);
        
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        // Ensure loading is handled correctly even with potential profile fetch errors
        if (currentUser) {
          // Avoid fetching profile again if user object hasn't changed significantly
          // Simple ID check for now.
          if (!profile || currentUser.id !== profile.id) { 
            setLoading(true); // Show loading while profile fetches
            setRenderStatus('auth-change-fetching-profile');
            console.log("[Auth State Change] Fetching profile for user:", currentUser.id);
            try {
              const userProfile = await fetchProfile(currentUser.id);
              console.log("[Auth State Change] Profile fetch result:", userProfile);
              setProfile(userProfile); 
              setRenderStatus('auth-change-profile-loaded');
            } catch (error) {
              console.error("[Auth State Change] EXCEPTION during profile fetch:", error);
              setProfile(null); // Ensure profile is null on error
              setRenderStatus('auth-change-profile-error');
            } finally {
              console.log("[Auth State Change] Setting loading to false.");
              setLoading(false); // ALWAYS set loading false after attempt
              setRenderStatus('auth-change-ready');
            }
          } else {
            // User exists but profile hasn't changed, ensure loading is false
            if (loading) {
              setLoading(false);
              setRenderStatus('auth-change-same-profile');
            }
          }
        } else {
          // No user, clear profile and ensure loading is false
          console.log("[Auth State Change] No user, clearing profile and setting loading false.");
          setProfile(null); 
          setLoading(false);
          setRenderStatus('auth-change-no-user');
        }
      }
    );

    // Cleanup listener on unmount
    return () => {
      authListener?.unsubscribe();
      setRenderStatus('unmounted');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed 'profile' from dependencies to avoid potential loops

  const value = {
    session,
    user,
    profile, // Expose profile data
    loading,
    renderStatus, // Expose render status for debugging
    isSubscribed: profile?.is_subscribed ?? false, // Convenience flag
    // Ensure supabase client exists before calling auth methods
    signUp: (data) => supabase ? supabase.auth.signUp(data) : Promise.reject("Supabase not initialized"),
    signIn: (data) => supabase ? supabase.auth.signInWithPassword(data) : Promise.reject("Supabase not initialized"),
    signOut: () => supabase ? supabase.auth.signOut() : Promise.reject("Supabase not initialized"),
  };

  // Add a conditional rendering wrapper with better error states
  const renderContent = () => {
    if (loading) {
      // During loading, show nothing
      return null;
    }
    
    // Handle any potential rendering issues
    try {
      return children;
    } catch (error) {
      console.error("Error rendering children in AuthProvider:", error);
      return (
        <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
          <h1 style={{ color: '#b91c1c' }}>Rendering Error</h1>
          <p>There was an error rendering the application.</p>
          <p style={{ fontSize: '0.875rem', marginTop: '1rem' }}>Status: {renderStatus}</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Auth: {user ? 'Logged In' : 'Not Logged In'}</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '0.25rem',
              border: 'none',
              cursor: 'pointer',
              marginTop: '1rem'
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }
  };

  // Render children only when initial check is done (loading is false)
  return (
    <AuthContext.Provider value={value}>
      {renderContent()}
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
