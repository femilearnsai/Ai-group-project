import React from 'react';

export const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-5 ${className}`}>
    {children}
  </div>
);
