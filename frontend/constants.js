import { User, Building2, Gavel } from 'lucide-react';

export const PIT_BRACKETS = [
  { limit: 800000, rate: 0, citation: 'NTA 2025 s.56(1)' },
  { limit: 3000000, rate: 0.15, citation: 'NTA 2025 s.56(2)' },
  { limit: 12000000, rate: 0.18, citation: 'NTA 2025 s.56(3)' },
  { limit: 25000000, rate: 0.21, citation: 'NTA 2025 s.56(4)' },
  { limit: 50000000, rate: 0.23, citation: 'NTA 2025 s.56(5)' },
  { limit: Infinity, rate: 0.25, citation: 'NTA 2025 s.56(6)' },
];

export const CIT_RATES = {
  SMALL: 0,
  OTHERS: 0.30,
  DEV_LEVY: 0.04,
  MIN_EFFECTIVE_RATE: 0.15,
  CGT_COMPANY: 0.30,
};

export const STATUTORY_CITATIONS = {
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

export const ROLE_CONFIGS = {
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

export const CITATION_REGEX = /((JRBA|NTAA|NRSA|NTA)\s*(s\.|Section|Paragraph)?\s*\d+(\/\d+)?)/gi;

export const INITIAL_GREETING = "Greetings. I am your Nigeria Tax Reform Assistant (2025). Select a profile and ask me anything about the new tax laws.";

export const INITIAL_CALC_INPUTS = {
  grossIncome: 0,
  deductions: 0,
  cgtGains: 0,
  whtCredits: 0,
  isSmallCompany: false,
  profitBeforeTax: 0,
};
