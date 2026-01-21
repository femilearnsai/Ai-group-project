/**
 * Zustand Chat Store
 * Manages chat state with authentication-aware persistence
 * - Authenticated users: Full session history saved to backend
 * - Guests: Only current session (no persistence, cleared on refresh)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import config from '../config.js';
import { getRoleGreeting } from '../utils.js';

// Create a custom storage that only persists for authenticated users
const createAuthAwareStorage = () => ({
  getItem: (name) => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      // Guest user - no persistence
      return null;
    }
    return localStorage.getItem(name);
  },
  setItem: (name, value) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // Only persist for authenticated users
      localStorage.setItem(name, value);
    }
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
  },
});

const initialState = {
  // Current chat messages
  currentChat: [],
  // All conversations/sessions
  conversations: [],
  // Active chat session ID
  activeChatId: null,
  // User role for context
  userRole: 'taxpayer',
  // Loading state
  isLoading: false,
  // Error state
  error: null,
  // Search query for filtering conversations
  searchQuery: '',
};

export const useChatStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      // Check if user is authenticated
      isAuthenticated: () => !!localStorage.getItem('auth_token'),

      // Set user role
      setUserRole: (role) => set({ userRole: role }),

      // Set search query
      setSearchQuery: (query) => set({ searchQuery: query }),

      // Set loading state
      setIsLoading: (loading) => set({ isLoading: loading }),

      // Set error
      setError: (error) => set({ error }),

      // Clear error
      clearError: () => set({ error: null }),

      // Initialize greeting message
      initializeGreeting: () => {
        const { userRole } = get();
        const greeting = getRoleGreeting(userRole);
        set({ 
          currentChat: [{ role: 'assistant', content: greeting, isGreeting: true }],
          activeChatId: null
        });
      },

      // Set active chat
      setActiveChatId: async (chatId) => {
        set({ activeChatId: chatId });
        
        if (chatId) {
          // Fetch chat history from backend
          try {
            const res = await fetch(`${config.API_BASE_URL}/sessions/${chatId}/history`);
            if (res.ok) {
              const data = await res.json();
              set({ currentChat: data.messages || [] });
            }
          } catch (err) {
            console.error('Failed to fetch chat history:', err);
          }
        } else {
          // New chat - show greeting
          get().initializeGreeting();
        }
      },

      // Fetch conversations from backend (only for authenticated users)
      fetchConversations: async () => {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          // Guest users don't have conversation history
          set({ conversations: [] });
          return;
        }

        try {
          const res = await fetch(config.endpoints.sessions, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            set({ conversations: data || [] });
          }
        } catch (err) {
          console.error('Error fetching sessions:', err);
        }
      },

      // Add message to current chat
      addMessage: (message) => {
        set((state) => ({
          currentChat: [...state.currentChat, {
            ...message,
            timestamp: message.timestamp || new Date().toISOString()
          }]
        }));
      },

      // Update last assistant message (for regeneration with versions)
      updateLastAssistantMessage: (newContent, timestamp, sources) => {
        set((state) => {
          const newChat = [...state.currentChat];
          const lastAssistantIndex = newChat.length - 1 - 
            [...newChat].reverse().findIndex(m => m.role === 'assistant' || m.role === 'ai');
          
          if (lastAssistantIndex >= 0) {
            const lastAssistant = newChat[lastAssistantIndex];
            const existingVersions = lastAssistant.versions || [
              { content: lastAssistant.content, timestamp: lastAssistant.timestamp }
            ];
            
            const newVersions = [
              { content: newContent, timestamp },
              ...existingVersions
            ];
            
            newChat[lastAssistantIndex] = {
              ...lastAssistant,
              content: newContent,
              timestamp,
              sources: sources || lastAssistant.sources,
              versions: newVersions,
              currentVersionIndex: 0
            };
          }
          
          return { currentChat: newChat };
        });
      },

      // Change version of a message
      setMessageVersion: (messageIndex, versionIndex) => {
        set((state) => {
          const newChat = [...state.currentChat];
          const message = newChat[messageIndex];
          
          if (message?.versions?.[versionIndex]) {
            newChat[messageIndex] = {
              ...message,
              currentVersionIndex: versionIndex
            };
          }
          
          return { currentChat: newChat };
        });
      },

      // Send message
      sendMessage: async (content) => {
        const { activeChatId, userRole, isAuthenticated } = get();
        const token = localStorage.getItem('auth_token');
        
        if (!content.trim()) return;

        set({ isLoading: true, error: null });

        // Add user message
        get().addMessage({ role: 'human', content });

        const payload = activeChatId 
          ? { message: content, session_id: activeChatId, user_role: userRole }
          : { message: content, user_role: userRole };

        try {
          const headers = { 'Content-Type': 'application/json' };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const res = await fetch(config.endpoints.chat, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            throw new Error(await res.text() || 'Chat request failed');
          }

          const data = await res.json();

          // Update active chat ID if new session created
          if (data.session_id && data.session_id !== activeChatId) {
            set({ activeChatId: data.session_id });
          }

          // Add assistant response
          get().addMessage({
            role: 'assistant',
            content: data.response,
            timestamp: data.timestamp,
            sources: data.sources || [],
            used_retrieval: data.used_retrieval || false
          });

          // Refresh conversations for authenticated users
          if (token) {
            get().fetchConversations();
          }

          return data;
        } catch (err) {
          set({ error: 'Failed to get response. Please try again.' });
          console.error(err);
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      // Regenerate last response
      regenerateResponse: async () => {
        const { currentChat, activeChatId, userRole } = get();
        const token = localStorage.getItem('auth_token');
        
        if (currentChat.length < 2) return;

        // Find last user message
        const lastUserMessage = [...currentChat].reverse().find(m => m.role === 'human');
        if (!lastUserMessage) return;

        set({ isLoading: true, error: null });

        const payload = activeChatId 
          ? { message: lastUserMessage.content, session_id: activeChatId, user_role: userRole }
          : { message: lastUserMessage.content, user_role: userRole };

        try {
          const headers = { 'Content-Type': 'application/json' };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const res = await fetch(config.endpoints.chat, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            throw new Error(await res.text() || 'Regeneration failed');
          }

          const data = await res.json();

          // Update last assistant message with version
          get().updateLastAssistantMessage(data.response, data.timestamp, data.sources);

          return data;
        } catch (err) {
          set({ error: 'Failed to regenerate response. Please try again.' });
          console.error(err);
        } finally {
          set({ isLoading: false });
        }
      },

      // Delete a conversation
      deleteConversation: async (sessionId) => {
        const token = localStorage.getItem('auth_token');
        
        // Remove from local state immediately
        set((state) => ({
          conversations: state.conversations.filter(c => c.session_id !== sessionId),
          activeChatId: state.activeChatId === sessionId ? null : state.activeChatId
        }));

        // If active chat was deleted, show greeting
        if (get().activeChatId === null) {
          get().initializeGreeting();
        }

        // Delete from backend
        try {
          const headers = {};
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          await fetch(`${config.API_BASE_URL}/sessions/${sessionId}`, {
            method: 'DELETE',
            headers
          });
        } catch (err) {
          console.error('Failed to delete session:', err);
        }
      },

      // Start new chat
      newChat: () => {
        set({ activeChatId: null });
        get().initializeGreeting();
      },

      // Reset state for guest (clear everything)
      resetForGuest: () => {
        set({
          ...initialState,
          currentChat: [{ 
            role: 'assistant', 
            content: getRoleGreeting('taxpayer'), 
            isGreeting: true 
          }]
        });
      },

      // Called when user logs in - fetch their data and handle new session from new IP
      onLogin: async (authResponse = {}) => {
        // If login returned a new session ID (new IP address), use it
        if (authResponse.new_session_id) {
          set({ activeChatId: authResponse.new_session_id });
          console.log('🆕 New session created from new IP:', authResponse.new_session_id);
        }
        
        await get().fetchConversations();
        // Keep current chat if exists, otherwise show greeting
        if (!get().currentChat.length) {
          get().initializeGreeting();
        }
      },

      // Called when user logs out - clear persisted data
      onLogout: () => {
        // Clear persisted storage
        localStorage.removeItem('chat-storage');
        // Reset to guest state
        get().resetForGuest();
      },

      // Get filtered conversations
      getFilteredConversations: () => {
        const { conversations, searchQuery } = get();
        const q = searchQuery.toLowerCase().trim();
        const list = Array.isArray(conversations) ? conversations : [];
        
        const matched = q
          ? list.filter(c => (c.session_id || c.title || '').toLowerCase().includes(q))
          : list;

        return matched.sort((a, b) => {
          const ta = new Date(a.last_activity || a.created_at || 0).getTime();
          const tb = new Date(b.last_activity || b.created_at || 0).getTime();
          return tb - ta;
        });
      },
    }),
    {
      name: 'chat-storage',
      storage: createJSONStorage(() => createAuthAwareStorage()),
      // Only persist these fields for authenticated users
      partialize: (state) => ({
        conversations: state.conversations,
        userRole: state.userRole,
      }),
    }
  )
);

export default useChatStore;
