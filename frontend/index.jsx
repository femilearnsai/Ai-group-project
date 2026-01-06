
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
// import { toast, Bounce, ToastContainer } from 'react-toastify';
import { GoogleGenAI } from "@google/genai";
import {
  Calculator,
  User,
  Building2,
  Gavel,
  Info,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  ShieldCheck,
  FileText,
  MessageSquare,
  Wrench,
  Trash2,
  Plus,
  Send,
  Download,
  Search,
  Menu,
  Scale,
  RotateCcw,
  BookOpen
} from 'lucide-react';

/* ---------------- Configuration & Constants ---------------- */

const PIT_BRACKETS = [
  { limit: 800000, rate: 0, citation: 'NTA 2025 s.56(1)' },
  { limit: 3000000, rate: 0.15, citation: 'NTA 2025 s.56(2)' },
  { limit: 12000000, rate: 0.18, citation: 'NTA 2025 s.56(3)' },
  { limit: 25000000, rate: 0.21, citation: 'NTA 2025 s.56(4)' },
  { limit: 50000000, rate: 0.23, citation: 'NTA 2025 s.56(5)' },
  { limit: Infinity, rate: 0.25, citation: 'NTA 2025 s.56(6)' },
];

const CIT_RATES = {
  SMALL: 0,
  OTHERS: 0.30,
  DEV_LEVY: 0.04,
  MIN_EFFECTIVE_RATE: 0.15,
  CGT_COMPANY: 0.30,
};

const STATUTORY_CITATIONS = {
  PIT_GENERAL: {
    code: 'NTA 2025 s.56',
    desc: 'Establishes progressive Personal Income Tax rates for individuals.'
  },
  CIT_STANDARD: {
    code: 'NTA 2025 s.12',
    desc: 'Provides for the standard Company Income Tax rate of 30%.'
  },
  CIT_SMALL: {
    code: 'NTA 2025 s.14',
    desc: 'Grants 0% CIT exemption for Small Companies to stimulate growth.'
  },
  DEV_LEVY: {
    code: 'NTA 2025 s.58',
    desc: 'Imposes a 4% Development Levy on corporate profits for infrastructure.'
  },
  MIN_TAX_FLOOR: {
    code: 'NTA 2025 s.22',
    desc: 'Ensures a 15% Minimum Effective Tax rate for large corporations.'
  },
  CGT_COMPANY: {
    code: 'NTA 2025 s.30',
    desc: 'Sets Capital Gains Tax rate for companies at 30%.'
  },
  CGT_INDIVIDUAL: {
    code: 'NTA 2025 s.56',
    desc: 'Individuals capital gains are integrated into PIT progressive brackets.'
  },
  WHT_CREDIT: {
    code: 'NTAA 2025 s.51',
    desc: 'Allows for the utilization of Withholding Tax as credits against tax due.'
  },
};

const ROLE_CONFIGS = {
  Individual: {
    label: 'Individual',
    icon: User,
    color: 'text-blue-600',
    prompt: "You are a specialized Nigerian Tax Consultant for individuals. Focus on PIT, reliefs, and standard filings. Cite Nigeria Tax Act 2025 (NTA) and Nigeria Tax Administration Act 2025 (NTAA).",
  },
  Company: {
    label: 'Company',
    icon: Building2,
    color: 'text-indigo-600',
    prompt: "You are a Corporate Tax Strategist. Focus on CIT, WHT, VAT, and Development Levy. Cite CITA, VAT Act, and Nigeria Tax Act 2025.",
  },
  Advisor: {
    label: 'Legal Advisor',
    icon: Gavel,
    color: 'text-amber-600',
    prompt: "You are a Nigerian Tax Lawyer. Provide formal legal interpretations citing specific sections of NTA 2025, NTAA 2025, and JRBA 2025. Use professional legal terminology.",
  }
};

const CITATION_REGEX = /((JRBA|NTAA|NRSA|NTA)\s*(s\.|Section|Paragraph)?\s*\d+(\/\d+)?)/gi;
const INITIAL_GREETING = "Greetings. I am your Nigeria Tax Reform Assistant (2025). Select a profile and ask me anything about the new tax laws.";

const INITIAL_CALC_INPUTS = {
  grossIncome: 0,
  deductions: 0,
  cgtGains: 0,
  whtCredits: 0,
  isSmallCompany: false,
  profitBeforeTax: 0,
};

/* ---------------- Utilities ---------------- */

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(val);
};

/* ---------------- Tax Logic ---------------- */

const calculatePIT = (taxableIncome) => {
  let remaining = taxableIncome;
  let totalTax = 0;
  let prevLimit = 0;
  const breakdown = [];

  for (const bracket of PIT_BRACKETS) {
    const taxableInThisBracket = Math.max(0, Math.min(remaining, bracket.limit - prevLimit));
    const taxForBracket = taxableInThisBracket * bracket.rate;

    if (taxableInThisBracket > 0) {
      breakdown.push({
        label: bracket.limit === Infinity ? `Above ₦${prevLimit.toLocaleString()}` : `₦${(prevLimit + 1).toLocaleString()} - ₦${bracket.limit.toLocaleString()}`,
        rate: bracket.rate,
        amount: taxableInThisBracket,
        tax: taxForBracket,
        citation: bracket.citation
      });
    }

    totalTax += taxForBracket;
    remaining -= taxableInThisBracket;
    prevLimit = bracket.limit;
    if (remaining <= 0) break;
  }

  return { totalTax, breakdown };
};

const calculateCIT = (profitBeforeTax, isSmallCompany, cgtGains) => {
  const baseRate = isSmallCompany ? CIT_RATES.SMALL : CIT_RATES.OTHERS;
  const citPayable = profitBeforeTax * baseRate;
  const devLevy = profitBeforeTax * CIT_RATES.DEV_LEVY;
  const companyCGT = cgtGains * CIT_RATES.CGT_COMPANY;

  const combinedCurrentTax = citPayable + devLevy;
  const minTaxFloor = profitBeforeTax * CIT_RATES.MIN_EFFECTIVE_RATE;
  const topUpTax = Math.max(0, minTaxFloor - combinedCurrentTax);

  const totalCompanyTax = combinedCurrentTax + topUpTax + companyCGT;

  return { citPayable, devLevy, companyCGT, topUpTax, totalCompanyTax, minTaxFloor };
};

/* ---------------- UI Components ---------------- */

const CurrencyDisplay = ({ value }) => (
  <span className="font-mono font-bold tracking-tight">
    {formatCurrency(value)}
  </span>
);

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-5 ${className}`}>
    {children}
  </div>
);

const SectionTitle = ({ children, icon: Icon }) => (
  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-4 uppercase tracking-widest">
    <Icon size={16} className="text-emerald-600" />
    {children}
  </h3>
);

const ThinkingDisplay = () => (
  <div className="flex flex-col gap-2 py-2 min-w-[150px]">
    <div className="flex items-center gap-3">
      <div className="relative w-6 h-6 flex items-center justify-center">
        <div className="absolute inset-0 bg-emerald-600/10 rounded-full animate-ping"></div>
        <div className="w-2 h-2 bg-emerald-600 rounded-full animate-pulse"></div>
      </div>
      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Consulting Statutes...</span>
    </div>
  </div>
);

const MessageBubble = ({ role, content }) => {
  const isUser = role === "human";
  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
      <div className={`max-w-[85%] px-5 py-4 rounded-2xl text-sm leading-relaxed shadow-sm border ${isUser ? "bg-emerald-600 text-white rounded-br-none border-emerald-700" : "bg-white border-slate-200 text-slate-800 rounded-bl-none"
        }`}>
        <div className="flex items-center gap-2 mb-2 opacity-60">
          <span className="text-[9px] uppercase font-black tracking-widest">{isUser ? 'Taxpayer' : 'AI Assistant'}</span>
        </div>
        <div className="whitespace-pre-wrap break-words font-medium">
          {content}
        </div>
        {/* {!isUser && citations?.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
            {citations.map((c, i) => (
              <span key={i} className="text-[9px] px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold rounded uppercase tracking-tighter">
                {c}
              </span>
            ))}
          </div>
        )} */}
      </div>
    </div>
  );
};

const CitationBadge = ({ text }) => (
  <span className="ml-2 bg-slate-100 text-slate-500 text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest border border-slate-200">
    {text}
  </span>
);

const LegalBasisSection = ({ role, inputs }) => {
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
    <div className="mt-6 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-all group"
      >
        <div className="flex items-center gap-3">
          <BookOpen size={18} className="text-emerald-600" />
          <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Legal Basis (Statutes)</span>
        </div>
        {isOpen ? <ChevronUp size={16} className="text-slate-400 group-hover:text-emerald-600" /> : <ChevronDown size={16} className="text-slate-400 group-hover:text-emerald-600" />}
      </button>
      {isOpen && (
        <div className="p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {relevantCitations.map((cit, idx) => (
            <div key={idx} className="flex gap-4 items-start">
              <div className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              <div>
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-tighter mb-1">{cit.code}</h4>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{cit.desc}</p>
              </div>
            </div>
          ))}
          <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-[9px] text-amber-800 font-bold leading-relaxed uppercase tracking-widest text-center">
              ⚖️ This calculator is for informational purposes only and does not constitute legal or tax advice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const CalculatorDashboard = ({ role, inputs, setInputs, onClear }) => {
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
                      className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${inputs.isSmallCompany ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-slate-50 text-slate-400'
                        }`}
                    >
                      <span className="text-[10px] font-black uppercase">Small</span>
                      <span className="text-[8px] font-bold opacity-70">Exempt (0% CIT)</span>
                    </button>
                    <button
                      onClick={() => setInputs(prev => ({ ...prev, isSmallCompany: false }))}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${!inputs.isSmallCompany ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-slate-50 text-slate-400'
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

/* ---------------- Main App ---------------- */

const App = () => {
  const [activeTab, setActiveTab] = useState('chat');
  const [role, setRole] = useState('Individual');
  const [conversations, setConversations] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [searchQuery, setSearchQuery] = useState('');

  // Calculator Inputs State
  const [calcInputs, setCalcInputs] = useState(INITIAL_CALC_INPUTS);

  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeChatId, conversations, isLoading, activeTab]);

  const [currentChat, setCurrentChat] = useState([])

  useEffect(() => {
    async function fetchCurrentChat() {
      if (activeChatId) {
        const res = await fetch(`http://localhost:8000/sessions/${activeChatId}/history`);
        const data = await res.json();
        setCurrentChat(data.messages);
      } else {
        setCurrentChat([{ role: 'assistant', content: INITIAL_GREETING }]);
      }
    }
    fetchCurrentChat();
    console.log(currentChat)
  }, [activeChatId]);

  // Keep sidebar responsive: open on large viewports, closed on small
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(true);
      else setSidebarOpen(false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch('http://localhost:8000/sessions');
        if (!res.ok) throw new Error('Failed to load sessions');
        const data = await res.json();
        setConversations(data || []);
      } catch (err) {
        console.error('Error fetching sessions', err);
      }
    }

    fetchSessions();
  }, [])

  // const currentChat = conversations.find(c => c.id === activeChatId) || { messages: [{ id: 'init', role: 'assistant', content: INITIAL_GREETING }] };

  const filteredConversations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = Array.isArray(conversations) ? conversations : [];
    const matched = q
      ? list.filter(c => (c.session_id || c.title || '').toLowerCase().includes(q))
      : list;

    return matched.sort((a, b) => {
      const ta = new Date(a.last_activity || a.created_at || 0).getTime();
      const tb = new Date(b.last_activity || b.created_at || 0).getTime();
      return tb - ta;
    });
  }, [conversations, searchQuery]);

  const handleNewChat = () => {
    setActiveTab('chat');
    setActiveChatId(null);
    setInput('');
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const handleClearCalc = () => {
    if (confirm('Are you sure you want to clear all calculator inputs?')) {
      setCalcInputs(INITIAL_CALC_INPUTS);
    }
  };

  const deleteChat = async (e, id) => {
    e.stopPropagation();
    if (confirm('Delete this inquiry?')) {
      setConversations(prev => prev.filter(c => c.session_id !== id));
      if (activeChatId === id) setActiveChatId(null);
    }
    try {
      const res = await fetch(`http://localhost:8000/sessions/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      alert(data.message || `Session ${id} deleted`);
    } catch (err) {
      console.error('Failed to delete session', err);
      alert('Failed to delete session');
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userText = input.trim();
    setInput('');
    setIsLoading(true);
    setError(null);
    // Optimistically append user's message
    setCurrentChat(prev => [...prev, { role: 'human', content: userText }]);

    // Build payload: only include session_id if we already have one
    const payload = activeChatId ? { message: userText, session_id: activeChatId } : { message: userText };

    try {
      const res = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Chat request failed');
      }

      const data = await res.json();

      // Ensure we use the server-generated session id
      if (data.session_id && data.session_id !== activeChatId) {
        setActiveChatId(data.session_id);
      }

      // Append assistant reply
      setCurrentChat(prev => [...prev, { role: 'assistant', content: data.response }]);

      // Refresh sessions list to reflect the new/updated session metadata
      try {
        const sres = await fetch('http://localhost:8000/sessions');
        if (sres.ok) {
          const sdata = await sres.json();
          setConversations(sdata || []);
        }
      } catch (err) {
        console.error('Failed to refresh sessions', err);
      }

      // Fetch canonical conversation history from backend to keep in sync
      if (data.session_id) {
        try {
          const hres = await fetch(`http://localhost:8000/sessions/${data.session_id}/history`);
          if (hres.ok) {
            const hdata = await hres.json();
            setCurrentChat(hdata.messages || []);
          }
        } catch (err) {
          console.error('Failed to fetch history', err);
        }
      }

      return data;
    } catch (err) {
      setError('Failed to get response. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-80 bg-slate-50 border-r border-slate-200 z-30 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center gap-2 mb-8">
            <div className="bg-emerald-600 p-2 rounded-xl"><Calculator className="text-white" size={20} /></div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">TaxNG <span className="text-emerald-600">2025</span></h1>
          </div>

          <button onClick={handleNewChat} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3 px-4 font-bold text-sm flex items-center justify-center gap-2 shadow-lg mb-6 transition-all active:scale-95">
            <Plus size={16} /> New Inquiry
          </button>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input type="text" placeholder="Search histories..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
            {filteredConversations.map(chat => (
              <div key={chat.session_id} onClick={() => { setActiveChatId(chat.session_id); setActiveTab('chat'); if (window.innerWidth < 1024) setSidebarOpen(false); }} className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${activeChatId === chat.session_id ? 'bg-white border-emerald-200 shadow-sm' : 'hover:bg-white border-transparent'}`}>
                <div className={`p-2 rounded-lg ${activeChatId === chat.session_id ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  {/* {React.createElement(ROLE_CONFIGS[chat.role]?.icon || User, { size: 14 })} */}
                  <User />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[11px] font-black text-slate-800 truncate">{chat.title || chat.session_id}</h3>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{(chat.message_count || 0) + ' msgs • ' + (chat.last_activity ? new Date(chat.last_activity).toLocaleString() : '')}</span>
                </div>
                <button onClick={(e) => deleteChat(e, chat.session_id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-all text-slate-300"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-slate-200 mt-auto">
            <button onClick={() => { setActiveTab('tools'); setSidebarOpen(window.innerWidth > 1024); }} className={`w-full py-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all font-black text-[10px] uppercase tracking-widest ${activeTab === 'tools' ? 'bg-emerald-50 border-emerald-600 text-emerald-700' : 'border-slate-100 hover:border-emerald-200 text-slate-500'}`}>
              <Wrench size={14} /> Fiscal Toolkit
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col h-full bg-white relative">
        <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 bg-white/80 backdrop-blur-md z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-all"><Menu size={20} /></button>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">{activeTab === 'chat' ? (activeChatId ? 'Inquiry History' : 'New Inquiry') : 'Precision Calculator'}</h2>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button onClick={() => setActiveTab('chat')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'chat' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}>Assistant</button>
              <button onClick={() => setActiveTab('tools')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'tools' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}>Calculator</button>
            </nav>
            {activeChatId && activeTab === 'chat' && <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><Download size={18} /></button>}
          </div>
        </header>

        <main ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
          {activeTab === 'chat' ? (
            <div className="max-w-4xl mx-auto px-6 py-12 flex flex-col gap-10">
              {currentChat && currentChat.map((m, index) => <MessageBubble key={index} role={m.role} content={m.content} />)}
              {error && <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-700 font-bold text-xs"><Info size={16} /> {error}</div>}
            </div>
          ) : (
            <div className="max-w-6xl mx-auto px-6 py-12">
              <div className="mb-10 text-center">
                <h2 className="text-4xl font-black text-slate-800 tracking-tighter mb-2">Statutory Calculator</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Aligned with Nigeria Tax Act 2025 Provisions</p>
                <div className="flex flex-wrap justify-center mt-6 items-center gap-4">
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    {['Individual', 'Company'].map(r => (
                      <button key={r} onClick={() => setRole(r)} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${role === r ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}>{r}</button>
                    ))}
                  </div>
                  <button onClick={handleClearCalc} className="flex items-center gap-2 px-4 py-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest border border-transparent hover:border-rose-100">
                    <RotateCcw size={14} /> Clear All
                  </button>
                </div>
              </div>
              <CalculatorDashboard role={role} inputs={calcInputs} setInputs={setCalcInputs} />
            </div>
          )}
        </main>

        {activeTab === 'chat' && (
          <footer className="p-6 border-t border-slate-100 bg-white/80 backdrop-blur-xl">
            <div className="max-w-4xl mx-auto flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea rows={1} value={input} onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'; }} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} placeholder={`Query ${role} statutes...`} className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-6 py-4 text-sm font-bold focus:border-emerald-500 focus:bg-white resize-none outline-none transition-all shadow-inner no-scrollbar" />
              </div>
              <button onClick={handleSendMessage} disabled={isLoading || !input.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white w-14 h-14 rounded-2xl shadow-lg transition-all flex items-center justify-center active:scale-90 disabled:opacity-50">
                {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Send size={20} />}
              </button>
            </div>
          </footer>
        )}
      </div>

      {sidebarOpen && window.innerWidth < 1024 && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-20" />}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
