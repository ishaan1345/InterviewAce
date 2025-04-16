import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  function signup(email, password) {
    // This would connect to your auth service
    return new Promise((resolve, reject) => {
      // Mock signup
      localStorage.setItem('user', JSON.stringify({ email }));
      setCurrentUser({ email });
      resolve();
    });
  }

  function login(email, password) {
    // This would connect to your auth service
    return new Promise((resolve, reject) => {
      // Mock login
      localStorage.setItem('user', JSON.stringify({ email }));
      setCurrentUser({ email });
      resolve();
    });
  }

  function logout() {
    // Mock logout
    localStorage.removeItem('user');
    setCurrentUser(null);
    return Promise.resolve();
  }

  useEffect(() => {
    // Check if user is already logged in
    const user = localStorage.getItem('user');
    if (user) {
      setCurrentUser(JSON.parse(user));
    }
    setLoading(false);
  }, []);

  const value = {
    currentUser,
    signup,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
