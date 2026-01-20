/**
 * API Configuration
 * Centralized configuration for backend API endpoints
 */

// Detect if we're in development or production
const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development';

// API base URL
const API_BASE_URL = isDev 
  ? import.meta.env.VITE_API_URL || 'http://localhost:8000'
  : import.meta.env.VITE_API_URL || '/api';

export { API_BASE_URL };

// Export default config object
export default {
  API_BASE_URL,
  endpoints: {
    chat: `${API_BASE_URL}/chat`,
    tts: `${API_BASE_URL}/tts`,
    sessions: `${API_BASE_URL}/sessions`,
    health: `${API_BASE_URL}/health`,
    feedback: `${API_BASE_URL}/feedback`,
    regenerate: `${API_BASE_URL}/regenerate`,
    documents: `${API_BASE_URL}/documents`,
    // Donation endpoints
    donateConfig: `${API_BASE_URL}/donate/config`,
    donateInitialize: `${API_BASE_URL}/donate/initialize`,
    donateVerify: `${API_BASE_URL}/donate/verify`,
    donateStats: `${API_BASE_URL}/donate/stats`,
    // Auth endpoints
    signup: `${API_BASE_URL}/auth/signup`,
    login: `${API_BASE_URL}/auth/login`,
    logout: `${API_BASE_URL}/auth/logout`,
    me: `${API_BASE_URL}/auth/me`,
    googleAuth: `${API_BASE_URL}/auth/google`,
  },
  // Google OAuth Client ID (set in environment or replace with your actual client ID)
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  // Paystack Public Key (set in environment)
  PAYSTACK_PUBLIC_KEY: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || ''
};
