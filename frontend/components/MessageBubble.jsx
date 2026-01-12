import React from 'react';

export const MessageBubble = ({ role, content }) => {
  const isUser = role === "human";
  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
      <div className={`max-w-[85%] px-5 py-4 rounded-2xl text-sm leading-relaxed shadow-sm border ${
        isUser 
          ? "bg-emerald-600 text-white rounded-br-none border-emerald-700" 
          : "bg-white border-slate-200 text-slate-800 rounded-bl-none"
      }`}>
        <div className="flex items-center gap-2 mb-2 opacity-60">
          <span className="text-[9px] uppercase font-black tracking-widest">
            {isUser ? 'Taxpayer' : 'AI Assistant'}
          </span>
        </div>
        <div className="whitespace-pre-wrap break-words font-medium">
          {content}
        </div>
      </div>
    </div>
  );
};
