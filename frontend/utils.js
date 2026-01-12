import { PIT_BRACKETS, CIT_RATES } from './constants.js';

export const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(val);
};

export const calculatePIT = (taxableIncome) => {
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

export const calculateCIT = (profitBeforeTax, isSmallCompany, cgtGains) => {
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
