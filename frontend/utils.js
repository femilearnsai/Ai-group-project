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

/**
 * Get time-based greeting (Good morning/afternoon/evening) based on user's local time
 * @returns {string} - The appropriate greeting based on current hour
 */
export const getTimeBasedGreeting = () => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  } else {
    return 'Good evening';
  }
};

/**
 * Extract first name from username or email
 * @param {object} user - User object with username and/or email
 * @returns {string|null} - First name or null if not available
 */
export const getFirstName = (user) => {
  if (!user) return null;
  
  // Try to get from username first
  if (user.username) {
    // If username contains space, get first part (first name)
    const nameParts = user.username.trim().split(' ');
    if (nameParts[0]) {
      // Capitalize first letter
      return nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase();
    }
  }
  
  // Fallback to email prefix if no username
  if (user.email) {
    const emailPrefix = user.email.split('@')[0];
    // Capitalize first letter
    return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1).toLowerCase();
  }
  
  return null;
};

/**
 * Get role-specific greeting with time-based salutation
 * Personalizes greeting with user's first name if available
 * @param {string} userRole - The user's role (taxpayer, tax_lawyer, company)
 * @param {object} user - Optional user object with username/email for personalization
 * @returns {string} - The complete greeting message
 */
export const getRoleGreeting = (userRole, user = null) => {
  const timeGreeting = getTimeBasedGreeting();
  const firstName = getFirstName(user);
  
  // Personalized greetings when user is logged in
  if (firstName) {
    const personalizedGreetings = {
      taxpayer: `${timeGreeting} ${firstName}! 👋 Thank you for paying your taxes. How can I help you today?`,
      tax_lawyer: `${timeGreeting} Barrister ${firstName}! 👋 Thank you for encouraging people to pay their taxes. How can I assist you today?`,
      company: `${timeGreeting} ${firstName}! 👋 Thank you for your company's compliance with the tax laws. How can I help you today?`
    };
    return personalizedGreetings[userRole] || personalizedGreetings.taxpayer;
  }
  
  // Default greetings for guests
  const greetings = {
    taxpayer: `${timeGreeting} Taxpayer, thank you for paying your taxes. How can I help you today?`,
    tax_lawyer: `${timeGreeting} Barrister, thank you for encouraging people to pay their taxes. How can I help you today?`,
    company: `${timeGreeting} Great Nigerian Company, thank you for complying with the tax laws. How can I help you today?`
  };
  
  return greetings[userRole] || greetings.taxpayer;
};
