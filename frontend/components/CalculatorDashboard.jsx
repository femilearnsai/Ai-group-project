import React, { useMemo } from 'react';
import { TrendingUp, FileText, Calculator, RotateCcw } from 'lucide-react';
import { Card } from './Card.jsx';
import { SectionTitle } from './SectionTitle.jsx';
import { CurrencyDisplay } from './CurrencyDisplay.jsx';
import { CitationBadge } from './CitationBadge.jsx';
import { LegalBasisSection } from './LegalBasisSection.jsx';
import { STATUTORY_CITATIONS } from '../constants.js';
import { calculatePIT, calculateCIT } from '../utils.js';

export const CalculatorDashboard = ({ role, inputs, setInputs, onClear }) => {
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInputs(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : parseFloat(value) || 0
    }));
  };

  const results = useMemo(() => {
    if (role === 'Individual' || role === 'Advisor') {
      const taxableBase = Math.max(0, inputs.grossIncome - inputs.deductions);
      const { totalTax: pitTax, breakdown } = calculatePIT(taxableBase);
      const { totalTax: cgtTax } = calculatePIT(inputs.cgtGains);
      const totalLiability = pitTax + cgtTax;
      const netPayable = Math.max(0, totalLiability - inputs.whtCredits);
      return {
        taxableBase,
        pitTax,
        pitBreakdown: breakdown,
        cgtTax,
        totalLiability,
        netPayable,
        gross: inputs.grossIncome + inputs.cgtGains,
        netIncome: (inputs.grossIncome + inputs.cgtGains) - totalLiability
      };
    } else {
      const r = calculateCIT(inputs.profitBeforeTax, inputs.isSmallCompany, inputs.cgtGains);
      const netPayable = Math.max(0, r.totalCompanyTax - inputs.whtCredits);
      return {
        ...r,
        totalLiability: r.totalCompanyTax,
        netPayable,
        gross: inputs.profitBeforeTax + inputs.cgtGains,
        netIncome: (inputs.profitBeforeTax + inputs.cgtGains) - r.totalCompanyTax
      };
    }
  }, [role, inputs]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Inputs */}
      <div className="lg:col-span-1 space-y-6">
        <Card>
          <SectionTitle icon={TrendingUp}>Income Sources</SectionTitle>
          <div className="space-y-4">
            {role === 'Company' ? (
              <>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Profit Before Tax</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₦</span>
                    <input type="number" name="profitBeforeTax" value={inputs.profitBeforeTax || ''} onChange={handleInputChange} className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Company Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setInputs(prev => ({ ...prev, isSmallCompany: true }))}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
                        inputs.isSmallCompany 
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700' 
                          : 'border-slate-100 bg-slate-50 text-slate-400'
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase">Small</span>
                      <span className="text-[8px] font-bold opacity-70">Exempt (0% CIT)</span>
                    </button>
                    <button
                      onClick={() => setInputs(prev => ({ ...prev, isSmallCompany: false }))}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
                        !inputs.isSmallCompany 
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700' 
                          : 'border-slate-100 bg-slate-50 text-slate-400'
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase">Standard</span>
                      <span className="text-[8px] font-bold opacity-70">30% CIT Rate</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Gross Annual Income</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₦</span>
                  <input type="number" name="grossIncome" value={inputs.grossIncome || ''} onChange={handleInputChange} className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold" />
                </div>
              </div>
            )}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Capital Gains</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₦</span>
                <input type="number" name="cgtGains" value={inputs.cgtGains || ''} onChange={handleInputChange} className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold" />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={FileText}>Reliefs & Credits</SectionTitle>
          <div className="space-y-4">
            {role !== 'Company' && (
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Deductions</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₦</span>
                  <input type="number" name="deductions" value={inputs.deductions || ''} onChange={handleInputChange} className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold" />
                </div>
              </div>
            )}
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">WHT Credits</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm">₦</span>
                <input type="number" name="whtCredits" value={inputs.whtCredits || ''} onChange={handleInputChange} className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Breakdown */}
      <div className="lg:col-span-2 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 rounded-2xl p-6 text-white flex flex-col justify-between shadow-lg">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Tax Liability</span>
            <div className="mt-2">
              <h2 className="text-3xl font-black"><CurrencyDisplay value={results.netPayable} /></h2>
              <p className="text-[10px] text-emerald-400 font-bold mt-1 uppercase tracking-tighter">
                Effective Rate: {results.gross > 0 ? ((results.totalLiability / results.gross) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>
          <div className="bg-emerald-600 rounded-2xl p-6 text-white flex flex-col justify-between shadow-lg">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-100 mb-1">Est. Net Take-Home</span>
            <div className="mt-2">
              <h2 className="text-3xl font-black"><CurrencyDisplay value={results.netIncome} /></h2>
              <p className="text-[10px] text-emerald-200 font-bold mt-1 tracking-wider uppercase">Post-Statutory Deductions</p>
            </div>
          </div>
        </div>

        <Card>
          <SectionTitle icon={Calculator}>Calculation Breakdown</SectionTitle>
          <div className="space-y-3">
            {role !== 'Company' ? (
              <>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <div className="flex items-center">
                    <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">Taxable PIT Base</span>
                    <CitationBadge text={STATUTORY_CITATIONS.PIT_GENERAL.code} />
                  </div>
                  <CurrencyDisplay value={results.taxableBase} />
                </div>
                {results.pitBreakdown?.map((b, i) => (
                  <div key={i} className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-xl">
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <span className="font-bold text-slate-700">{b.label}</span>
                        <CitationBadge text={b.citation} />
                      </div>
                      <span className="text-[9px] text-emerald-600 font-black">@{(b.rate * 100).toFixed(0)}% RATE</span>
                    </div>
                    <span className="font-mono font-bold text-slate-800 tracking-tight"><CurrencyDisplay value={b.tax} /></span>
                  </div>
                ))}
                {inputs.cgtGains > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <div className="flex items-center">
                      <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">Capital Gains Tax</span>
                      <CitationBadge text={STATUTORY_CITATIONS.CGT_INDIVIDUAL.code} />
                    </div>
                    <CurrencyDisplay value={results.cgtTax} />
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">Company Income Tax</span>
                    {inputs.isSmallCompany ? (
                      <div className="flex items-center">
                        <span className="bg-emerald-100 text-emerald-700 text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Exempt (0%)</span>
                        <CitationBadge text={STATUTORY_CITATIONS.CIT_SMALL.code} />
                      </div>
                    ) : (
                      <CitationBadge text={STATUTORY_CITATIONS.CIT_STANDARD.code} />
                    )}
                  </div>
                  <CurrencyDisplay value={results.citPayable} />
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <div className="flex items-center">
                    <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">Development Levy (4%)</span>
                    <CitationBadge text={STATUTORY_CITATIONS.DEV_LEVY.code} />
                  </div>
                  <CurrencyDisplay value={results.devLevy} />
                </div>
                {results.topUpTax > 0 && (
                  <div className="flex justify-between items-center py-2 p-2 bg-emerald-50 rounded-lg">
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <span className="text-xs text-emerald-800 font-black uppercase tracking-widest italic">Min. Effective Tax Top-up</span>
                        <CitationBadge text={STATUTORY_CITATIONS.MIN_TAX_FLOOR.code} />
                      </div>
                      <span className="text-[9px] text-emerald-600 font-bold">Adjusted to 15% minimum threshold</span>
                    </div>
                    <span className="text-emerald-700"><CurrencyDisplay value={results.topUpTax} /></span>
                  </div>
                )}
                {inputs.cgtGains > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <div className="flex items-center">
                      <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">Company CGT (30%)</span>
                      <CitationBadge text={STATUTORY_CITATIONS.CGT_COMPANY.code} />
                    </div>
                    <CurrencyDisplay value={results.companyCGT} />
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 pt-4 border-t-2 border-slate-100">
              <div className="flex justify-between items-center text-xs text-slate-500 mb-1 font-bold uppercase tracking-widest">
                <span>Gross Liability</span>
                <CurrencyDisplay value={results.totalLiability} />
              </div>
              <div className="flex justify-between items-center text-xs text-rose-500 mb-2 font-bold uppercase tracking-widest">
                <div className="flex items-center">
                  <span>WHT Credits Applied</span>
                  <CitationBadge text={STATUTORY_CITATIONS.WHT_CREDIT.code} />
                </div>
                <span>- <CurrencyDisplay value={inputs.whtCredits} /></span>
              </div>
              <div className="flex justify-between items-center text-lg font-black text-emerald-600 pt-2 border-t border-slate-100">
                <span className="uppercase tracking-tighter">Net Tax Payable</span>
                <CurrencyDisplay value={results.netPayable} />
              </div>
            </div>

            <LegalBasisSection role={role} inputs={inputs} />
          </div>
        </Card>
      </div>
    </div>
  );
};
