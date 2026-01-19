import React, { useState } from 'react';
import { Calculator, Plus, Search, User, Trash2, Wrench, Users, ChevronDown, ChevronUp } from 'lucide-react';

export const Sidebar = ({ 
  sidebarOpen, 
  setSidebarOpen,
  handleNewChat, 
  searchQuery, 
  setSearchQuery, 
  filteredConversations, 
  activeChatId, 
  setActiveChatId, 
  setActiveTab,
  deleteChat,
  activeTab
}) => {
  return (
    <aside className={`fixed inset-y-0 left-0 w-80 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 z-30 transition-transform duration-300 ${
      sidebarOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      <div className="p-6 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-8">
          <div className="bg-emerald-600 p-2 rounded-xl">
            <Calculator className="text-white" size={20} />
          </div>
          <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
            TaxNG <span className="text-emerald-600 dark:text-emerald-400">2025</span>
          </h1>
        </div>

        <button 
          onClick={handleNewChat} 
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3 px-4 font-bold text-sm flex items-center justify-center gap-2 shadow-lg mb-6 transition-all active:scale-95"
        >
          <Plus size={16} /> New Conversation
        </button>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" size={14} />
          <input 
            type="text" 
            placeholder="Search histories..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-slate-100 dark:placeholder-slate-500" 
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
          {filteredConversations.map(chat => (
            <div 
              key={chat.session_id} 
              onClick={() => { 
                setActiveChatId(chat.session_id); 
                setActiveTab('chat'); 
                if (window.innerWidth < 1024) setSidebarOpen(false); 
              }} 
              className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                activeChatId === chat.session_id 
                  ? 'bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-800 shadow-sm' 
                  : 'hover:bg-white dark:hover:bg-slate-800 border-transparent'
              }`}
            >
              <div className={`p-2 rounded-lg ${
                activeChatId === chat.session_id 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
              }`}>
                <User />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[11px] font-black text-slate-800 dark:text-slate-100 truncate">
                  {chat.title || chat.session_id}
                </h3>
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {(chat.message_count || 0) + ' msgs • ' + (chat.last_activity ? new Date(chat.last_activity).toLocaleString() : '')}
                </span>
              </div>
              <button 
                onClick={(e) => deleteChat(e, chat.session_id)} 
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-all text-slate-300 dark:text-slate-600"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-700 mt-auto space-y-3">
          <button 
            onClick={() => { 
              setActiveTab('tools'); 
              setSidebarOpen(window.innerWidth > 1024); 
            }} 
            className={`w-full py-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all font-black text-[10px] uppercase tracking-widest ${
              activeTab === 'tools' 
                ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-600 text-emerald-700 dark:text-emerald-300' 
                : 'border-slate-100 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-emerald-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            <Wrench size={14} /> Fiscal Toolkit
          </button>
          
          {/* Team Credits */}
          <TeamCredits />
        </div>
      </div>
    </aside>
  );
};

// Team Credits Component
const TeamCredits = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const team = [
    { name: 'Oluwapelumi Awoyale', role: 'Team Lead' },
    { name: 'Oluwaseyi Egunjobi', role: 'Team Member' },
    { name: 'Perpetual Meninwa', role: 'Team Member' },
    { name: 'Gbemisola Victoria', role: 'Team Member' },
    { name: 'Odefemi Adebola', role: 'Team Member' },
  ];
  
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2.5 flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users size={14} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
            Our Team
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp size={14} className="text-slate-400" />
        ) : (
          <ChevronDown size={14} className="text-slate-400" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-3 py-2 space-y-2 bg-white dark:bg-slate-900">
          {team.map((member, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black ${
                member.role === 'Team Lead' 
                  ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                {member.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">
                  {member.name}
                </p>
                <p className={`text-[8px] font-bold uppercase tracking-wider ${
                  member.role === 'Team Lead' 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {member.role}
                </p>
              </div>
            </div>
          ))}
          <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[8px] text-center text-slate-400 dark:text-slate-500 font-medium">
              Built with ❤️ for Nigerian Taxpayers
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
