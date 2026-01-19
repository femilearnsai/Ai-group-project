import React from 'react';
import { Menu } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle.jsx';
import { RoleDropdown } from './RoleDropdown.jsx';

export const Header = ({ 
  setSidebarOpen, 
  sidebarOpen, 
  activeTab, 
  setActiveTab, 
  activeChatId,
  userRole,
  setUserRole
}) => {
  return (
    <header className="h-12 sm:h-14 md:h-16 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-2 sm:px-3 md:px-4 lg:px-6 sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-20 safe-area-top">
      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 min-w-0 flex-1">
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)} 
          className="p-1.5 sm:p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-all flex-shrink-0 active:scale-95"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} className="sm:w-5 sm:h-5" />
        </button>
        <h2 className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider md:tracking-[0.15em] lg:tracking-[0.2em] truncate hidden sm:block">
          {activeTab === 'chat' 
            ? (activeChatId ? 'Conversation' : 'New Chat') 
            : 'Calculator'}
        </h2>
        {activeTab === 'chat' && (
          <div className="flex-shrink-0 ml-auto sm:ml-0">
            <RoleDropdown selectedRole={userRole} onRoleChange={setUserRole} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 flex-shrink-0">
        <ThemeToggle />
        <nav className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
          <button 
            onClick={() => setActiveTab('chat')} 
            className={`px-2 sm:px-2.5 md:px-3 lg:px-4 py-1 sm:py-1.5 rounded-md text-[7px] sm:text-[8px] md:text-[9px] lg:text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'chat' 
                ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' 
                : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <span className="hidden xs:inline sm:hidden md:inline">Assistant</span>
            <span className="xs:hidden sm:inline md:hidden">Chat</span>
          </button>
          <button 
            onClick={() => setActiveTab('tools')} 
            className={`px-2 sm:px-2.5 md:px-3 lg:px-4 py-1 sm:py-1.5 rounded-md text-[7px] sm:text-[8px] md:text-[9px] lg:text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'tools' 
                ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' 
                : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <span className="hidden xs:inline sm:hidden md:inline">Calculator</span>
            <span className="xs:hidden sm:inline md:hidden">Calc</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
