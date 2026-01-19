import React from 'react';
import { formatCurrency } from '../utils.js';

export const CurrencyDisplay = ({ value }) => (
  <span className="font-mono font-bold tracking-tight text-[10px] sm:text-xs md:text-sm">
    {formatCurrency(value)}
  </span>
);
