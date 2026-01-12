import React from 'react';

export const SectionTitle = ({ children, icon: Icon }) => (
  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-4 uppercase tracking-widest">
    <Icon size={16} className="text-emerald-600" />
    {children}
  </h3>
);
