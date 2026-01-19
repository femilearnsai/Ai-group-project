import React from 'react';

export const ThinkingDisplay = () => (
  <div className="flex flex-col gap-2 py-2 min-w-[150px]">
    <div className="flex items-center gap-3">
      <div className="relative w-6 h-6 flex items-center justify-center">
        <div className="absolute inset-0 bg-emerald-600/10 dark:bg-emerald-400/10 rounded-full animate-ping"></div>
        <div className="w-2 h-2 bg-emerald-600 dark:bg-emerald-400 rounded-full animate-pulse"></div>
      </div>
      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Consulting Statutes...</span>
    </div>
  </div>
);
