import React from 'react';
import { Calculator, Plus, Search, User, Trash2, Wrench } from 'lucide-react';

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
    <aside className={`fixed lg:static inset-y-0 left-0 w-80 bg-slate-50 border-r border-slate-200 z-30 transition-transform duration-300 ${
      sidebarOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      <div className="p-6 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-8">
          <div className="bg-emerald-600 p-2 rounded-xl">
            <Calculator className="text-white" size={20} />
          </div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">
            TaxNG <span className="text-emerald-600">2025</span>
          </h1>
        </div>

        <button 
          onClick={handleNewChat} 
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3 px-4 font-bold text-sm flex items-center justify-center gap-2 shadow-lg mb-6 transition-all active:scale-95"
        >
          <Plus size={16} /> New Inquiry
        </button>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="Search histories..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20" 
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
                  ? 'bg-white border-emerald-200 shadow-sm' 
                  : 'hover:bg-white border-transparent'
              }`}
            >
              <div className={`p-2 rounded-lg ${
                activeChatId === chat.session_id 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-slate-200 text-slate-400'
              }`}>
                <User />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[11px] font-black text-slate-800 truncate">
                  {chat.title || chat.session_id}
                </h3>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  {(chat.message_count || 0) + ' msgs • ' + (chat.last_activity ? new Date(chat.last_activity).toLocaleString() : '')}
                </span>
              </div>
              <button 
                onClick={(e) => deleteChat(e, chat.session_id)} 
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-all text-slate-300"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-slate-200 mt-auto">
          <button 
            onClick={() => { 
              setActiveTab('tools'); 
              setSidebarOpen(window.innerWidth > 1024); 
            }} 
            className={`w-full py-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all font-black text-[10px] uppercase tracking-widest ${
              activeTab === 'tools' 
                ? 'bg-emerald-50 border-emerald-600 text-emerald-700' 
                : 'border-slate-100 hover:border-emerald-200 text-slate-500'
            }`}
          >
            <Wrench size={14} /> Fiscal Toolkit
          </button>
        </div>
      </div>
    </aside>
  );
};
