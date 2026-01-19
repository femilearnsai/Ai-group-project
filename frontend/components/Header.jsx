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
    <header className="h-16 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-20">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)} 
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-all"
        >
          <Menu size={20} />
        </button>
        <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-[0.2em]">
          {activeTab === 'chat' 
            ? (activeChatId ? 'Conversation' : 'New Conversation') 
            : 'Precision Calculator'}
        </h2>
        {activeTab === 'chat' && (
          <RoleDropdown selectedRole={userRole} onRoleChange={setUserRole} />
        )}
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <nav className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button 
            onClick={() => setActiveTab('chat')} 
            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'chat' 
                ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' 
                : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            Assistant
          </button>
          <button 
            onClick={() => setActiveTab('tools')} 
            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'tools' 
                ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' 
                : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            Calculator
          </button>
        </nav>
      </div>
    </header>
  );
};
