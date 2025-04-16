import React, { useState } from 'react';
import { useAuth } from './context/AuthContext'; // Assuming AuthContext is in src/context
import Button from './components/Button';       // Assuming Button is in src/components
import InputGroup from './components/InputGroup';   // Assuming InputGroup is in src/components

const Login = ({ onSwitchMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Ensure signIn function is available before calling
      if (!signIn) throw new Error("Authentication service not available.");
      const { error: signInError } = await signIn({ email, password });
      if (signInError) throw signInError;
      // Login successful, AuthProvider handles state update
      console.log('Login successful!');
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || 'Failed to log in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center text-gray-900">Log In</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <InputGroup
          label="Email"
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
        <InputGroup
          label="Password"
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          placeholder="••••••••"
        />
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        <Button type="submit" fullWidth loading={loading} disabled={loading || !signIn}>
          {loading ? 'Logging In...' : 'Log In'}
        </Button>
      </form>
      <p className="text-sm text-center text-gray-600">
        Don't have an account?{' '}
        <button
          type="button"
          onClick={onSwitchMode}
          className="font-medium text-primary-600 hover:underline disabled:text-gray-400 disabled:cursor-not-allowed"
          disabled={loading} // Disable switching while loading
        >
          Sign up
        </button>
      </p>
    </div>
  );
};

export default Login; 