import React from 'react';

export const CitationBadge = ({ text }) => (
  <span className="ml-1 sm:ml-2 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[7px] sm:text-[8px] px-1 sm:px-1.5 py-0.5 rounded font-black uppercase tracking-wider sm:tracking-widest border border-slate-200 dark:border-slate-600 whitespace-nowrap">
    {text}
  </span>
);
