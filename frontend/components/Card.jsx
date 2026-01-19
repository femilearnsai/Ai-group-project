import React from 'react';

export const Card = ({ children, className = "" }) => (
  <div className={`bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-3 sm:p-4 md:p-5 transition-colors duration-300 ${className}`}>
    {children}
  </div>
);
