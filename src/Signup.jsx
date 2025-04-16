import React, { useState } from 'react';
import { useAuth } from './context/AuthContext'; // Assuming AuthContext is in src/context
import Button from './components/Button';       // Assuming Button is in src/components
import InputGroup from './components/InputGroup';   // Assuming InputGroup is in src/components

const Signup = ({ onSwitchMode }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    if (password.length < 6) {
      return setError('Password must be at least 6 characters long.');
    }

    setLoading(true);
    try {
      // Ensure signUp function is available
      if (!signUp) throw new Error("Authentication service not available.");
      const { error: signUpError } = await signUp({ email, password });
      if (signUpError) throw signUpError;
      setMessage('Signup successful! Check your email for verification link.');
      // Clear form on success (optional)
      // setEmail('');
      // setPassword('');
      // setConfirmPassword('');
    } catch (err) {
      console.error("Signup error:", err);
      setError(err.message || 'Failed to create an account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center text-gray-900">Sign Up</h2>
      {message && <p className="text-sm text-green-600 text-center p-2 bg-green-50 rounded-md">{message}</p>}
      <form onSubmit={handleSignup} className="space-y-4">
        <InputGroup
          label="Email"
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
        <InputGroup
          label="Password"
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          minLength={6}
          placeholder="Create a password (min 6 chars)"
        />
        <InputGroup
          label="Confirm Password"
          id="signup-confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          placeholder="Confirm your password"
        />
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        <Button type="submit" fullWidth loading={loading} disabled={loading || !signUp}>
          {loading ? 'Signing Up...' : 'Sign Up'}
        </Button>
      </form>
      <p className="text-sm text-center text-gray-600">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchMode}
          className="font-medium text-primary-600 hover:underline disabled:text-gray-400 disabled:cursor-not-allowed"
          disabled={loading} // Disable switching while loading
        >
          Log in
        </button>
      </p>
    </div>
  );
};

export default Signup; 