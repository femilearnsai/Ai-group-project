import React, { useState, useRef, useEffect, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Sidebar } from './components/Sidebar.jsx';
import { Header } from './components/Header.jsx';
import { ChatSection } from './components/ChatSection.jsx';
import { ChatInput } from './components/ChatInput.jsx';
import { CalculatorDashboard } from './components/CalculatorDashboard.jsx';
import { RoleSelector } from './components/RoleSelector.jsx';
import { INITIAL_CALC_INPUTS } from './constants.js';
import { getRoleGreeting } from './utils.js';
import config from './config.js';

export const App = () => {
  const [activeTab, setActiveTab] = useState('chat');
  const [role, setRole] = useState('Individual');
  const [userRole, setUserRole] = useState('taxpayer'); // tax_lawyer, taxpayer, company
  const [conversations, setConversations] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [searchQuery, setSearchQuery] = useState('');
  const [calcInputs, setCalcInputs] = useState(INITIAL_CALC_INPUTS);
  const [currentChat, setCurrentChat] = useState([]);

  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ 
        top: scrollRef.current.scrollHeight, 
        behavior: 'smooth' 
      });
    }
  }, [activeChatId, conversations, isLoading, activeTab]);

  useEffect(() => {
    async function fetchCurrentChat() {
      if (activeChatId) {
        const res = await fetch(`${config.API_BASE_URL}/sessions/${activeChatId}/history`);
        const data = await res.json();
        setCurrentChat(data.messages);
      } else {
        const greeting = getRoleGreeting(userRole);
        setCurrentChat([{ role: 'assistant', content: greeting, isGreeting: true }]);
      }
    }
    fetchCurrentChat();
  }, [activeChatId, userRole]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(true);
      else setSidebarOpen(false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch(config.endpoints.sessions);
        if (!res.ok) throw new Error('Failed to load sessions');
        const data = await res.json();
        setConversations(data || []);
      } catch (err) {
        console.error('Error fetching sessions', err);
      }
    }

    fetchSessions();
  }, []);

  const filteredConversations = useMemo(() => {
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
  }, [conversations, searchQuery]);

  const handleNewChat = () => {
    setActiveTab('chat');
    setActiveChatId(null);
    setInput('');
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const handleClearCalc = () => {
    if (confirm('Are you sure you want to clear all calculator inputs?')) {
      setCalcInputs(INITIAL_CALC_INPUTS);
    }
  };

  const deleteChat = async (e, id) => {
    e.stopPropagation();
    if (confirm('Delete this conversation?')) {
      setConversations(prev => prev.filter(c => c.session_id !== id));
      if (activeChatId === id) setActiveChatId(null);
    }
    try {
      const res = await fetch(`${config.API_BASE_URL}/sessions/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      alert(data.message || `Session ${id} deleted`);
    } catch (err) {
      console.error('Failed to delete session', err);
      alert('Failed to delete session');
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userText = input.trim();
    setInput('');
    setIsLoading(true);
    setError(null);
    
    // Add user message with timestamp
    const userMessage = { 
      role: 'human', 
      content: userText,
      timestamp: new Date().toISOString()
    };
    setCurrentChat(prev => [...prev, userMessage]);

    const payload = activeChatId 
      ? { message: userText, session_id: activeChatId, user_role: userRole } 
      : { message: userText, user_role: userRole };

    try {
      const res = await fetch(config.endpoints.chat, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Chat request failed');
      }

      const data = await res.json();

      if (data.session_id && data.session_id !== activeChatId) {
        setActiveChatId(data.session_id);
      }

      // Add assistant message with timestamp from API
      const assistantMessage = { 
        role: 'assistant', 
        content: data.response,
        timestamp: data.timestamp
      };
      setCurrentChat(prev => [...prev, assistantMessage]);

      try {
        const sres = await fetch(config.endpoints.sessions);
        if (sres.ok) {
          const sdata = await sres.json();
          setConversations(sdata || []);
        }
      } catch (err) {
        console.error('Failed to refresh sessions', err);
      }

      if (data.session_id) {
        try {
          const hres = await fetch(`${config.API_BASE_URL}/sessions/${data.session_id}/history`);
          if (hres.ok) {
            const hdata = await hres.json();
            setCurrentChat(hdata.messages || []);
          }
        } catch (err) {
          console.error('Failed to fetch history', err);
        }
      }

      return data;
    } catch (err) {
      setError('Failed to get response. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (isLoading || !currentChat || currentChat.length < 2) return;
    
    // Find the last user message
    const lastUserMessageIndex = [...currentChat].reverse().findIndex(m => m.role === 'human');
    if (lastUserMessageIndex === -1) return;
    
    const actualIndex = currentChat.length - 1 - lastUserMessageIndex;
    const lastUserMessage = currentChat[actualIndex];
    
    // Find the last assistant message index
    const lastAssistantIndex = currentChat.length - 1 - [...currentChat].reverse().findIndex(m => m.role === 'assistant' || m.role === 'ai');
    
    setIsLoading(true);
    setError(null);

    const payload = activeChatId 
      ? { message: lastUserMessage.content, session_id: activeChatId, user_role: userRole } 
      : { message: lastUserMessage.content, user_role: userRole };

    try {
      const res = await fetch(config.endpoints.chat, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Regeneration failed');
      }

      const data = await res.json();

      // Update the last assistant message with versioning
      setCurrentChat(prev => {
        const newChat = [...prev];
        const lastAssistant = newChat[lastAssistantIndex];
        
        if (lastAssistant && (lastAssistant.role === 'assistant' || lastAssistant.role === 'ai')) {
          // If versions array doesn't exist, create it with the current content as version 1
          const existingVersions = lastAssistant.versions || [
            { content: lastAssistant.content, timestamp: lastAssistant.timestamp }
          ];
          
          // Add new response as a new version
          const newVersions = [
            { content: data.response, timestamp: data.timestamp },
            ...existingVersions
          ];
          
          // Update the message with versions (newest first, so index 0 is the latest)
          newChat[lastAssistantIndex] = {
            ...lastAssistant,
            content: data.response,
            timestamp: data.timestamp,
            versions: newVersions,
            currentVersionIndex: 0 // Show the newest version
          };
        }
        
        return newChat;
      });

    } catch (err) {
      setError('Failed to regenerate response. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVersionChange = (messageIndex, versionIndex) => {
    setCurrentChat(prev => {
      const newChat = [...prev];
      const message = newChat[messageIndex];
      
      if (message && message.versions && message.versions[versionIndex]) {
        newChat[messageIndex] = {
          ...message,
          currentVersionIndex: versionIndex
        };
      }
      
      return newChat;
    });
  };

  const handleEdit = (content, messageIndex) => {
    // Set the input to the message content for editing
    setInput(content);
    
    // Scroll to bottom to show the input field
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current.scrollTo({ 
          top: scrollRef.current.scrollHeight, 
          behavior: 'smooth' 
        });
      }, 100);
    }
  };

  return (
    <div className="flex h-screen h-screen-safe bg-white dark:bg-slate-900 font-sans overflow-hidden transition-colors duration-300">
      {/* Sidebar placeholder for desktop layout */}
      <div className={`hidden lg:block transition-all duration-300 flex-shrink-0 ${sidebarOpen ? 'w-72 xl:w-80' : 'w-0'}`} />
      
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        handleNewChat={handleNewChat}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filteredConversations={filteredConversations}
        activeChatId={activeChatId}
        setActiveChatId={setActiveChatId}
        setActiveTab={setActiveTab}
        deleteChat={deleteChat}
        activeTab={activeTab}
      />

      <div className="flex-1 flex flex-col h-full min-w-0 bg-white dark:bg-slate-900 relative transition-colors duration-300">
        <Header
          setSidebarOpen={setSidebarOpen}
          sidebarOpen={sidebarOpen}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeChatId={activeChatId}
          userRole={userRole}
          setUserRole={setUserRole}
        />

        <main ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar scroll-smooth">
          {activeTab === 'chat' ? (
            <ChatSection currentChat={currentChat} error={error} onRegenerate={handleRegenerate} sessionId={activeChatId} onEdit={handleEdit} onVersionChange={handleVersionChange} />
          ) : (
            <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 lg:py-12">
              <div className="mb-4 sm:mb-6 md:mb-8 lg:mb-10 text-center">
                <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tighter mb-1 sm:mb-2">
                  Statutory Calculator
                </h2>
                <p className="text-[7px] sm:text-[8px] md:text-[9px] lg:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.3em]">
                  Aligned with Nigeria Tax Act 2025 Provisions
                </p>
                <div className="flex flex-wrap justify-center mt-3 sm:mt-4 md:mt-5 lg:mt-6 items-center gap-2 sm:gap-3">
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                    {['Individual', 'Company'].map(r => (
                      <button 
                        key={r} 
                        onClick={() => setRole(r)} 
                        className={`px-2.5 sm:px-3 md:px-4 lg:px-6 py-1 sm:py-1.5 md:py-2 rounded-md text-[7px] sm:text-[8px] md:text-[9px] lg:text-[10px] font-black uppercase tracking-wide sm:tracking-wider md:tracking-widest transition-all ${
                          role === r 
                            ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' 
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={handleClearCalc} 
                    className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 md:px-3 lg:px-4 py-1 sm:py-1.5 md:py-2 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all font-black text-[7px] sm:text-[8px] md:text-[9px] lg:text-[10px] uppercase tracking-wide sm:tracking-wider md:tracking-widest border border-transparent hover:border-rose-100 dark:hover:border-rose-800"
                  >
                    <RotateCcw size={10} className="sm:w-3 sm:h-3 md:w-3.5 md:h-3.5" /> 
                    <span className="hidden sm:inline">Clear All</span>
                    <span className="sm:hidden">Clear</span>
                  </button>
                </div>
              </div>
              <CalculatorDashboard 
                role={role} 
                inputs={calcInputs} 
                setInputs={setCalcInputs}
                onClear={handleClearCalc}
              />
            </div>
          )}
        </main>

        {activeTab === 'chat' && (
          <ChatInput
            input={input}
            setInput={setInput}
            isLoading={isLoading}
            handleSendMessage={handleSendMessage}
            role={role}
          />
        )}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-20 lg:hidden transition-opacity duration-300" 
        />
      )}
    </div>
  );
};
