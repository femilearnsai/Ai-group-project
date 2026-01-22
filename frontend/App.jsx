import React, { useState, useRef, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { Sidebar } from './components/Sidebar.jsx';
import { Header } from './components/Header.jsx';
import { ChatSection } from './components/ChatSection.jsx';
import { ChatInput } from './components/ChatInput.jsx';
import { CalculatorDashboard } from './components/CalculatorDashboard.jsx';
import { RoleSelector } from './components/RoleSelector.jsx';
import { BuyMeCoffee, BuyMeCoffeeButton } from './components/BuyMeCoffee.jsx';
import { AuthModal } from './components/AuthModal.jsx';
import { SignupPrompt } from './components/SignupPrompt.jsx';
import { useAuth } from './contexts/AuthContext.jsx';
import useChatStore from './stores/chatStore.js';
import { INITIAL_CALC_INPUTS } from './constants.js';
import config from './config.js';

export const App = () => {
  const [activeTab, setActiveTab] = useState('chat');
  const [role, setRole] = useState('Individual');
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [calcInputs, setCalcInputs] = useState(INITIAL_CALC_INPUTS);
  const [showDonation, setShowDonation] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);

  // Zustand store
  const {
    currentChat,
    activeChatId,
    userRole,
    isLoading,
    error,
    searchQuery,
    setUserRole,
    setSearchQuery,
    setActiveChatId,
    sendMessage,
    regenerateResponse,
    deleteConversation,
    newChat,
    setMessageVersion,
    fetchConversations,
    getFilteredConversations,
    initializeGreeting,
    setCurrentUser,
  } = useChatStore();

  const { isAuthenticated, user } = useAuth();
  const scrollRef = useRef(null);

  // Check if user has donated (for hiding the coffee popup permanently)
  const hasDonated = localStorage.getItem('user_has_donated') === 'true';

  // Get filtered conversations
  const filteredConversations = getFilteredConversations();

  // Check for Paystack callback and auto-open donation modal
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const reference = urlParams.get('reference') || urlParams.get('trxref');
    
    if (reference) {
      // Payment callback detected, open donation modal to show result
      setShowDonation(true);
    }
  }, []);

  // Initialize chat on mount and when user changes
  useEffect(() => {
    // Update current user in store for personalized greetings
    setCurrentUser(user);
    initializeGreeting(user);
    // Only fetch conversations for authenticated users
    if (isAuthenticated) {
      fetchConversations();
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ 
        top: scrollRef.current.scrollHeight, 
        behavior: 'smooth' 
      });
    }
  }, [activeChatId, currentChat, isLoading, activeTab]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(true);
      else setSidebarOpen(false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNewChat = () => {
    setActiveTab('chat');
    newChat();
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
      await deleteConversation(id);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userText = input.trim();
    setInput('');

    try {
      await sendMessage(userText);

      // Track query count for non-authenticated users and show signup prompt
      if (!isAuthenticated) {
        const queryCount = parseInt(localStorage.getItem('guest_query_count') || '0') + 1;
        localStorage.setItem('guest_query_count', queryCount.toString());
        
        // Show signup prompt after 2 queries (and not dismissed permanently)
        if (queryCount === 2 && !localStorage.getItem('signup_prompt_dismissed')) {
          setTimeout(() => setShowSignupPrompt(true), 1000);
        }
        
        // Show Buy Me a Coffee popup every 2 AI responses for guests
        const coffeeCount = parseInt(localStorage.getItem('guest_coffee_count') || '0') + 1;
        localStorage.setItem('guest_coffee_count', coffeeCount.toString());
        
        if (coffeeCount % 2 === 0) {
          setTimeout(() => setShowDonation(true), 1500);
        }
      } else {
        // Authenticated user - show coffee popup after 5 queries, once per day
        if (!hasDonated) {
          const today = new Date().toDateString();
          const lastCoffeeDate = localStorage.getItem('last_coffee_popup_date');
          const authCoffeeCount = parseInt(localStorage.getItem('auth_coffee_count') || '0') + 1;
          localStorage.setItem('auth_coffee_count', authCoffeeCount.toString());
          
          // Reset count if new day
          if (lastCoffeeDate !== today) {
            localStorage.setItem('auth_coffee_count', '1');
          }
          
          const currentCount = parseInt(localStorage.getItem('auth_coffee_count') || '1');
          
          // Show popup after 5 queries and only once per day
          if (currentCount === 5 && lastCoffeeDate !== today) {
            localStorage.setItem('last_coffee_popup_date', today);
            setTimeout(() => setShowDonation(true), 1500);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegenerate = async () => {
    if (isLoading || !currentChat || currentChat.length < 2) return;
    await regenerateResponse();
  };

  const handleVersionChange = (messageIndex, versionIndex) => {
    setMessageVersion(messageIndex, versionIndex);
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
        onLoginClick={() => setShowAuthModal(true)}
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
            <ChatSection 
              currentChat={currentChat} 
              error={error} 
              isLoading={isLoading}
              onRegenerate={handleRegenerate} 
              sessionId={activeChatId} 
              onEdit={handleEdit} 
              onVersionChange={handleVersionChange} 
            />
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

      {/* Buy Me a Coffee */}
      <BuyMeCoffeeButton onClick={() => setShowDonation(true)} />
      <BuyMeCoffee isOpen={showDonation} onClose={() => setShowDonation(false)} />

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* Signup Prompt for Guest Users */}
      <SignupPrompt 
        isOpen={showSignupPrompt} 
        onClose={() => {
          setShowSignupPrompt(false);
          localStorage.setItem('signup_prompt_dismissed', 'true');
        }}
        onSignup={() => {
          setShowSignupPrompt(false);
          setShowAuthModal(true);
        }}
      />

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
