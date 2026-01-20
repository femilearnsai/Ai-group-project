import React, { createContext, useContext, useState, useEffect } from 'react';
import config from '../config.js';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken) {
        try {
          const response = await fetch(config.endpoints.me, {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
            setToken(storedToken);
          } else {
            // Token is invalid, clear it
            localStorage.removeItem('auth_token');
            setToken(null);
            setUser(null);
          }
        } catch (err) {
          console.error('Auth check failed:', err);
          localStorage.removeItem('auth_token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const signup = async (email, password, username) => {
    setError(null);
    try {
      const response = await fetch(config.endpoints.signup, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, username })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        localStorage.setItem('auth_token', data.token);
        // Clear guest tracking data
        localStorage.removeItem('guest_query_count');
        localStorage.removeItem('signup_prompt_dismissed');
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      } else {
        setError(data.detail || data.message || 'Signup failed');
        return { success: false, error: data.detail || data.message };
      }
    } catch (err) {
      setError('Network error. Please try again.');
      return { success: false, error: 'Network error' };
    }
  };

  const login = async (email, password) => {
    setError(null);
    try {
      const response = await fetch(config.endpoints.login, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        localStorage.setItem('auth_token', data.token);
        // Clear guest tracking data
        localStorage.removeItem('guest_query_count');
        localStorage.removeItem('signup_prompt_dismissed');
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      } else {
        setError(data.detail || data.message || 'Login failed');
        return { success: false, error: data.detail || data.message };
      }
    } catch (err) {
      setError('Network error. Please try again.');
      return { success: false, error: 'Network error' };
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    setError(null);
  };

  const googleSignIn = async (credential) => {
    setError(null);
    try {
      const response = await fetch(config.endpoints.googleAuth, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ credential })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        localStorage.setItem('auth_token', data.token);
        // Clear guest tracking data
        localStorage.removeItem('guest_query_count');
        localStorage.removeItem('signup_prompt_dismissed');
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      } else {
        setError(data.detail || data.message || 'Google sign-in failed');
        return { success: false, error: data.detail || data.message };
      }
    } catch (err) {
      setError('Network error. Please try again.');
      return { success: false, error: 'Network error' };
    }
  };

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!user,
    signup,
    login,
    logout,
    googleSignIn,
    clearError: () => setError(null)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
