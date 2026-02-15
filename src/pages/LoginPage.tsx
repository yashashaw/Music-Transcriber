import React, { useState } from 'react';
// 1. FIXED IMPORTS: Changed loginUser/registerUser to login/register
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">
          {isRegistering ? 'Create Account' : 'Login to Maestro'}
        </h2>
        
        {error && (
          <div className={`mb-4 p-2 text-sm rounded border ${
             error.includes('created') 
               ? 'text-green-700 bg-green-100 border-green-200' 
               : 'text-red-700 bg-red-100 border-red-200'
          }`}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email" // Changed to email type
            placeholder="Email Address" // Changed placeholder
            className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button 
            type="submit" 
            className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition-colors"
          >
            {isRegistering ? 'Register' : 'Login'}
          </button>
        </form>
        
        <button 
          onClick={() => {
            setIsRegistering(!isRegistering);
            setError(''); 
          }}
          className="mt-4 text-sm text-blue-500 hover:underline w-full text-center"
        >
          {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
        </button>
      </div>
    </div>
  );
};