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
    <aside className={`fixed inset-y-0 left-0 w-[280px] xs:w-[300px] sm:w-80 md:w-[320px] lg:w-72 xl:w-80 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 z-30 transition-transform duration-300 ease-out safe-area-left ${
      sidebarOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      <div className="p-3 sm:p-4 md:p-5 lg:p-6 h-full flex flex-col safe-area-top">
        <div className="flex items-center gap-2 mb-4 sm:mb-5 md:mb-6 lg:mb-8">
          <div className="bg-emerald-600 p-1.5 sm:p-2 rounded-lg">
            <Calculator className="text-white w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          </div>
          <h1 className="text-base sm:text-lg md:text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
            TaxNG
          </h1>
        </div>

        <button 
          onClick={handleNewChat} 
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2 sm:py-2.5 md:py-3 px-3 sm:px-4 font-bold text-[11px] sm:text-xs md:text-sm flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg mb-3 sm:mb-4 md:mb-5 lg:mb-6 transition-all active:scale-[0.98]"
        >
          <Plus size={14} className="sm:w-4 sm:h-4" /> New Conversation
        </button>

        <div className="relative mb-3 sm:mb-4 md:mb-5 lg:mb-6">
          <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <input 
            type="text" 
            placeholder="Search histories..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl pl-8 sm:pl-9 md:pl-10 pr-3 py-2 sm:py-2.5 text-[11px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-slate-100 dark:placeholder-slate-500 transition-all" 
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 sm:space-y-1.5 md:space-y-2 no-scrollbar -mx-1 px-1">
          {filteredConversations.map(chat => (
            <div 
              key={chat.session_id} 
              onClick={() => { 
                setActiveChatId(chat.session_id); 
                setActiveTab('chat'); 
                if (window.innerWidth < 1024) setSidebarOpen(false); 
              }} 
              className={`group flex items-center gap-2 sm:gap-2.5 md:gap-3 p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl cursor-pointer transition-all border ${
                activeChatId === chat.session_id 
                  ? 'bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-800 shadow-sm' 
                  : 'hover:bg-white dark:hover:bg-slate-800 border-transparent'
              }`}
            >
              <div className={`p-1.5 sm:p-2 rounded-md sm:rounded-lg flex-shrink-0 ${
                activeChatId === chat.session_id 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
              }`}>
                <User size={14} className="sm:w-4 sm:h-4 md:w-5 md:h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[10px] sm:text-[11px] md:text-xs font-black text-slate-800 dark:text-slate-100 truncate leading-tight">
                  {chat.title || chat.session_id}
                </h3>
                <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block truncate">
                  {(chat.message_count || 0) + ' msgs • ' + (chat.last_activity ? new Date(chat.last_activity).toLocaleDateString() : '')}
                </span>
              </div>
              <button 
                onClick={(e) => deleteChat(e, chat.session_id)} 
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-rose-500 transition-all text-slate-300 dark:text-slate-600 flex-shrink-0 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Trash2 size={12} className="sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="pt-2 sm:pt-3 md:pt-4 border-t border-slate-200 dark:border-slate-700 mt-auto space-y-2 sm:space-y-2.5 md:space-y-3 safe-area-bottom">
          <button 
            onClick={() => { 
              setActiveTab('tools'); 
              setSidebarOpen(window.innerWidth > 1024); 
            }} 
            className={`w-full py-2 sm:py-2.5 md:py-3 rounded-lg sm:rounded-xl border-2 flex items-center justify-center gap-1.5 sm:gap-2 transition-all font-black text-[8px] sm:text-[9px] md:text-[10px] uppercase tracking-wider ${
              activeTab === 'tools' 
                ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-600 text-emerald-700 dark:text-emerald-300' 
                : 'border-slate-100 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-emerald-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            <Wrench size={12} className="sm:w-3.5 sm:h-3.5" /> Fiscal Toolkit
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
    { name: 'Simeon Akinrinade', role: 'Team Member' },
  ];
  
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-2 sm:px-2.5 md:px-3 py-1.5 sm:py-2 md:py-2.5 flex items-center justify-between gap-1.5 sm:gap-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
          <Users size={11} className="sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[8px] sm:text-[9px] md:text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Our Team
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp size={11} className="sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-slate-400" />
        ) : (
          <ChevronDown size={11} className="sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-slate-400" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-2 sm:px-2.5 md:px-3 py-1.5 sm:py-2 space-y-1 sm:space-y-1.5 md:space-y-2 bg-white dark:bg-slate-900">
          {team.map((member, index) => (
            <div key={index} className="flex items-center gap-1.5 sm:gap-2">
              <div className={`w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[7px] sm:text-[8px] md:text-[9px] font-black flex-shrink-0 ${
                member.role === 'Team Lead' 
                  ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                {member.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] sm:text-[9px] md:text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate leading-tight">
                  {member.name}
                </p>
                <p className={`text-[6px] sm:text-[7px] md:text-[8px] font-bold uppercase tracking-wider ${
                  member.role === 'Team Lead' 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {member.role}
                </p>
              </div>
            </div>
          ))}
          <div className="pt-1 sm:pt-1.5 md:pt-2 mt-1 sm:mt-1.5 md:mt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[6px] sm:text-[7px] md:text-[8px] text-center text-slate-400 dark:text-slate-500 font-medium">
              Built with ❤️ for Nigerian Taxpayers
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
