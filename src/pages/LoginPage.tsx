import React, { useState } from 'react';
import './LoginPage.css';
import { login, register } from '../api/api'; 
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios'; 

export const LoginPage = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState(''); // Changed username to email
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      if (isRegistering) {
        // 2. FIXED: Using 'register' with object payload
        await register({ email, password });
        
        // Auto-login after register, or ask user to login
        // For now, let's just switch to login mode so they can sign in
        setIsRegistering(false);
        setError('Account created! Please log in.');
      } else {
        // 3. FIXED: Using 'login' with object payload
        const data = await login({ email, password });
        
        // 4. FIXED: Using the response structure from your new api.ts
        setAuth(data.token, data.user.email);
        navigate('/');
      }
      
    } catch (err) {
      const axiosError = err as AxiosError<{ detail: string }>;
      console.error(axiosError);
      setError(axiosError.response?.data?.detail || 'Authentication failed');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h2>{isRegistering ? 'Create Account' : 'Welcome back'}</h2>
          <p className="login-subtitle">
            {isRegistering ? 'Sign up to start transcribing' : 'Sign in to your account'}
          </p>
        </div>
        
        {error && (
          <div className={`login-alert ${error.includes('created') ? 'login-alert--success' : 'login-alert--error'}`}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="login-submit">
            {isRegistering ? 'Create Account' : 'Sign In'}
          </button>
        </form>
        
        <div className="login-footer">
          <button 
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
            className="login-toggle"
          >
            {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
};