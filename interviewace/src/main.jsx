import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import './index.css'

// Make React available globally to fix any reference errors
window.React = React;

// Using a simple function instead of a class component to avoid React reference issues
const SimpleApp = () => {
  try {
    return (
      <React.StrictMode>
        <AuthProvider>
          <App />
        </AuthProvider>
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Error rendering app:", error);
    return (
      <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Something went wrong</h1>
        <p>{error.message}</p>
      </div>
    );
  }
};

// Render the application
ReactDOM.createRoot(document.getElementById('root')).render(<SimpleApp />);
