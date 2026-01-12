import React from 'react';
import { Send } from 'lucide-react';

export const ChatInput = ({ 
  input, 
  setInput, 
  isLoading, 
  handleSendMessage, 
  role 
}) => {
  return (
    <footer className="p-6 border-t border-slate-100 bg-white/80 backdrop-blur-xl">
      <div className="max-w-4xl mx-auto flex gap-3 items-end">
        <div className="flex-1 relative">
          <textarea 
            rows={1} 
            value={input} 
            onChange={(e) => { 
              setInput(e.target.value); 
              e.target.style.height = 'auto'; 
              e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'; 
            }} 
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} 
            placeholder={`Query ${role} statutes...`} 
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-6 py-4 text-sm font-bold focus:border-emerald-500 focus:bg-white resize-none outline-none transition-all shadow-inner no-scrollbar" 
          />
        </div>
        <button 
          onClick={handleSendMessage} 
          disabled={isLoading || !input.trim()} 
          className="bg-emerald-600 hover:bg-emerald-700 text-white w-14 h-14 rounded-2xl shadow-lg transition-all flex items-center justify-center active:scale-90 disabled:opacity-50"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <Send size={20} />
          )}
        </button>
      </div>
    </footer>
  );
};
