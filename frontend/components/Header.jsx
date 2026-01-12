import React from 'react';
import { Menu, Download } from 'lucide-react';

export const Header = ({ 
  setSidebarOpen, 
  sidebarOpen, 
  activeTab, 
  setActiveTab, 
  activeChatId 
}) => {
  return (
    <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 bg-white/80 backdrop-blur-md z-20">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)} 
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-all"
        >
          <Menu size={20} />
        </button>
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">
          {activeTab === 'chat' 
            ? (activeChatId ? 'Inquiry History' : 'New Inquiry') 
            : 'Precision Calculator'}
        </h2>
      </div>
      <div className="flex items-center gap-4">
        <nav className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button 
            onClick={() => setActiveTab('chat')} 
            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'chat' 
                ? 'bg-white shadow-sm text-emerald-600' 
                : 'text-slate-400'
            }`}
          >
            Assistant
          </button>
          <button 
            onClick={() => setActiveTab('tools')} 
            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'tools' 
                ? 'bg-white shadow-sm text-emerald-600' 
                : 'text-slate-400'
            }`}
          >
            Calculator
          </button>
        </nav>
        {activeChatId && activeTab === 'chat' && (
          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <Download size={18} />
          </button>
        )}
      </div>
    </header>
  );
};
