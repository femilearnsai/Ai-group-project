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
  }
};
