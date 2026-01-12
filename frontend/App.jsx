import React, { useState, useRef, useEffect, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Sidebar } from './components/Sidebar.jsx';
import { Header } from './components/Header.jsx';
import { ChatSection } from './components/ChatSection.jsx';
import { ChatInput } from './components/ChatInput.jsx';
import { CalculatorDashboard } from './components/CalculatorDashboard.jsx';
import { INITIAL_GREETING, INITIAL_CALC_INPUTS } from './constants.js';

export const App = () => {
  const [activeTab, setActiveTab] = useState('chat');
  const [role, setRole] = useState('Individual');
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
        const res = await fetch(`http://localhost:8000/sessions/${activeChatId}/history`);
        const data = await res.json();
        setCurrentChat(data.messages);
      } else {
        setCurrentChat([{ role: 'assistant', content: INITIAL_GREETING }]);
      }
    }
    fetchCurrentChat();
  }, [activeChatId]);

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
        const res = await fetch('http://localhost:8000/sessions');
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
    if (confirm('Delete this inquiry?')) {
      setConversations(prev => prev.filter(c => c.session_id !== id));
      if (activeChatId === id) setActiveChatId(null);
    }
    try {
      const res = await fetch(`http://localhost:8000/sessions/${id}`, {
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
    
    setCurrentChat(prev => [...prev, { role: 'human', content: userText }]);

    const payload = activeChatId 
      ? { message: userText, session_id: activeChatId } 
      : { message: userText };

    try {
      const res = await fetch('http://localhost:8000/chat', {
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

      setCurrentChat(prev => [...prev, { role: 'assistant', content: data.response }]);

      try {
        const sres = await fetch('http://localhost:8000/sessions');
        if (sres.ok) {
          const sdata = await sres.json();
          setConversations(sdata || []);
        }
      } catch (err) {
        console.error('Failed to refresh sessions', err);
      }

      if (data.session_id) {
        try {
          const hres = await fetch(`http://localhost:8000/sessions/${data.session_id}/history`);
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

  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden">
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

      <div className="flex-1 flex flex-col h-full bg-white relative">
        <Header
          setSidebarOpen={setSidebarOpen}
          sidebarOpen={sidebarOpen}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeChatId={activeChatId}
        />

        <main ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
          {activeTab === 'chat' ? (
            <ChatSection currentChat={currentChat} error={error} />
          ) : (
            <div className="max-w-6xl mx-auto px-6 py-12">
              <div className="mb-10 text-center">
                <h2 className="text-4xl font-black text-slate-800 tracking-tighter mb-2">
                  Statutory Calculator
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  Aligned with Nigeria Tax Act 2025 Provisions
                </p>
                <div className="flex flex-wrap justify-center mt-6 items-center gap-4">
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    {['Individual', 'Company'].map(r => (
                      <button 
                        key={r} 
                        onClick={() => setRole(r)} 
                        className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          role === r 
                            ? 'bg-white shadow-sm text-emerald-600' 
                            : 'text-slate-400'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={handleClearCalc} 
                    className="flex items-center gap-2 px-4 py-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest border border-transparent hover:border-rose-100"
                  >
                    <RotateCcw size={14} /> Clear All
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

      {sidebarOpen && window.innerWidth < 1024 && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-20" 
        />
      )}
    </div>
  );
};
