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
    <div className="mt-3 sm:mt-4 md:mt-6 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm transition-colors duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2.5 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-3 md:py-4 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-all group"
      >
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
          <BookOpen size={14} className="sm:w-4 sm:h-4 md:w-[18px] md:h-[18px] text-emerald-600 dark:text-emerald-400" />
          <span className="text-[9px] sm:text-[10px] md:text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Legal Basis</span>
        </div>
        {isOpen ? <ChevronUp size={12} className="sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" /> : <ChevronDown size={12} className="sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />}
      </button>
      {isOpen && (
        <div className="p-2.5 sm:p-3 md:p-4 lg:p-5 space-y-2 sm:space-y-3 md:space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {relevantCitations.map((cit, idx) => (
            <div key={idx} className="flex gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 items-start">
              <div className="mt-1 flex-shrink-0 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-500"></div>
              <div className="min-w-0 flex-1">
                <h4 className="text-[9px] sm:text-[10px] md:text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight mb-0.5">{cit.code}</h4>
                <p className="text-[9px] sm:text-[10px] md:text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{cit.desc}</p>
              </div>
            </div>
          ))}
          <div className="mt-2 sm:mt-3 md:mt-4 p-2 sm:p-2.5 md:p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-100 dark:border-amber-800">
            <p className="text-[7px] sm:text-[8px] md:text-[9px] text-amber-800 dark:text-amber-300 font-bold leading-relaxed uppercase tracking-wider text-center">
              ⚖️ This calculator is for informational purposes only and does not constitute legal or tax advice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
