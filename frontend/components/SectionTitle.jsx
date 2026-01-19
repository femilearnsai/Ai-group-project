import React from 'react';

export const SectionTitle = ({ children, icon: Icon }) => (
  <h3 className="text-[10px] sm:text-xs md:text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1 sm:gap-1.5 md:gap-2 mb-2 sm:mb-3 md:mb-4 uppercase tracking-wider">
    <Icon size={12} className="sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
    <span className="truncate">{children}</span>
  </h3>
);
