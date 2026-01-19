import React from 'react';

export const SectionTitle = ({ children, icon: Icon }) => (
  <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4 uppercase tracking-wider sm:tracking-widest">
    <Icon size={14} className="sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400" />
    {children}
  </h3>
);
