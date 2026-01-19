import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { STATUTORY_CITATIONS } from '../constants.js';

export const LegalBasisSection = ({ role, inputs }) => {
  const [isOpen, setIsOpen] = useState(false);

  const relevantCitations = useMemo(() => {
    const list = [];
    if (role === 'Individual' || role === 'Advisor') {
      list.push(STATUTORY_CITATIONS.PIT_GENERAL);
      if (inputs.cgtGains > 0) list.push(STATUTORY_CITATIONS.CGT_INDIVIDUAL);
    } else {
      list.push(inputs.isSmallCompany ? STATUTORY_CITATIONS.CIT_SMALL : STATUTORY_CITATIONS.CIT_STANDARD);
      list.push(STATUTORY_CITATIONS.DEV_LEVY);
      list.push(STATUTORY_CITATIONS.MIN_TAX_FLOOR);
      if (inputs.cgtGains > 0) list.push(STATUTORY_CITATIONS.CGT_COMPANY);
    }
    if (inputs.whtCredits > 0) list.push(STATUTORY_CITATIONS.WHT_CREDIT);
    return list;
  }, [role, inputs]);

  return (
    <div className="mt-6 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm transition-colors duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-all group"
      >
        <div className="flex items-center gap-3">
          <BookOpen size={18} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Legal Basis (Statutes)</span>
        </div>
        {isOpen ? <ChevronUp size={16} className="text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" /> : <ChevronDown size={16} className="text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />}
      </button>
      {isOpen && (
        <div className="p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {relevantCitations.map((cit, idx) => (
            <div key={idx} className="flex gap-4 items-start">
              <div className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              <div>
                <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter mb-1">{cit.code}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{cit.desc}</p>
              </div>
            </div>
          ))}
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl border border-amber-100 dark:border-amber-800">
            <p className="text-[9px] text-amber-800 dark:text-amber-300 font-bold leading-relaxed uppercase tracking-widest text-center">
              ⚖️ This calculator is for informational purposes only and does not constitute legal or tax advice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
