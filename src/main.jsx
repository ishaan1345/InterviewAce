import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './context/AuthContext.jsx'

// Make React available globally to fix any reference errors
window.React = React;

// Create a more resilient error boundary fallback
const ErrorFallback = ({ error }) => {
  // Log the error to console
  console.error("Fatal application error:", error);
  
  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      textAlign: 'center'
    }}>
      <h1 style={{ color: '#b91c1c', marginBottom: '1rem' }}>Application Error</h1>
      <p style={{ marginBottom: '1rem' }}>Sorry, the application couldn't be loaded.</p>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
        Please try refreshing the page or clearing your browser cache.
      </p>
      <button 
        onClick={() => window.location.reload()} 
        style={{
          backgroundColor: '#2563eb',
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '0.25rem',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        Refresh Page
      </button>
    </div>
  );
};

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
    return <ErrorFallback error={error} />;
  }
};

// Add a global error handler to catch unhandled errors
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  // Prevent default browser error handling
  event.preventDefault();
  
  // Try to render the fallback UI if the main app fails
  const rootElement = document.getElementById('root');
  if (rootElement) {
    try {
      ReactDOM.createRoot(rootElement).render(<ErrorFallback error={event.error} />);
    } catch (renderError) {
      console.error('Failed to render error fallback:', renderError);
    }
  }
});

// Render the application
try {
  ReactDOM.createRoot(document.getElementById('root')).render(<SimpleApp />);
} catch (error) {
  console.error("Critical rendering error:", error);
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: system-ui, sans-serif; text-align: center;">
      <h1 style="color: #b91c1c;">Critical Error</h1>
      <p>The application failed to initialize.</p>
      <p style="margin-top: 10px;"><button onclick="window.location.reload()">Try Again</button></p>
    </div>
  `;
}
