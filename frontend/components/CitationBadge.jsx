import React from 'react';

export const CitationBadge = ({ text }) => (
  <span className="ml-0.5 sm:ml-1 md:ml-2 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[6px] sm:text-[7px] md:text-[8px] px-0.5 sm:px-1 md:px-1.5 py-0.5 rounded font-black uppercase tracking-wider border border-slate-200 dark:border-slate-600 whitespace-nowrap inline-flex items-center flex-shrink-0">
    {text}
  </span>
);
