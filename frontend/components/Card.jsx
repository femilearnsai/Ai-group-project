import React from 'react';

export const Card = ({ children, className = "" }) => (
  <div className={`bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl md:rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-2.5 sm:p-3 md:p-4 lg:p-5 transition-colors duration-300 ${className}`}>
    {children}
  </div>
);
