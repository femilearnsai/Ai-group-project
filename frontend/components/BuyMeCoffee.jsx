import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Coffee, Heart, X, Loader2, CheckCircle, Gift, Sparkles, XCircle } from 'lucide-react';
import config from '../config.js';

export const BuyMeCoffee = ({ isOpen, onClose }) => {
  const [step, setStep] = useState('select'); // 'select', 'form', 'processing', 'success', 'error'
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [donationConfig, setDonationConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifiedAmount, setVerifiedAmount] = useState(null);

  // Check for Paystack callback on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const reference = urlParams.get('reference') || urlParams.get('trxref');
    
    if (reference) {
      // We have a payment reference, verify it
      verifyPayment(reference);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const verifyPayment = async (reference) => {
    setStep('processing');
    setLoading(true);
    
    try {
      const response = await fetch(`${config.endpoints.donateVerify}/${reference}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name || 'Anonymous',
          message: message || ''
        }),
      });
      const data = await response.json();
      
      if (data.status === 'success') {
        setVerifiedAmount(data.amount);
        setStep('success');
        // Mark user as donor - never show popup again
        localStorage.setItem('user_has_donated', 'true');
      } else {
        setError(data.message || 'Payment verification failed. Please contact support.');
        setStep('error');
      }
    } catch (err) {
      // Even if verification fails, the payment might have gone through
      // Mark as potential donor and show success with note
      localStorage.setItem('user_has_donated', 'true');
      setVerifiedAmount(selectedAmount);
      setStep('success');
    } finally {
      setLoading(false);
    }
  };

  // Fetch donation config and stats on mount
  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      fetchStats();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    try {
      const response = await fetch(config.endpoints.donateConfig);
      const data = await response.json();
      setDonationConfig(data);
    } catch (err) {
      console.error('Failed to fetch donation config:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(config.endpoints.donateStats);
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch donation stats:', err);
    }
  };

  const handleSelectAmount = (amount) => {
    setSelectedAmount(amount);
    setCustomAmount('');
    if (amount !== null) {
      setStep('form');
    }
  };

  const handleCustomAmount = () => {
    const amount = parseInt(customAmount);
    if (amount >= 100) {
      setSelectedAmount(amount);
      setStep('form');
    } else {
      setError('Minimum amount is ₦100');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Check if Paystack is loaded
    if (!window.PaystackPop) {
      setError('Payment system is loading. Please try again.');
      return;
    }

    // Check if public key is configured
    if (!config.PAYSTACK_PUBLIC_KEY) {
      setError('Payment not configured. Please contact support.');
      return;
    }

    // Generate a unique reference
    const reference = `coffee_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Use Paystack Inline (popup) - this avoids IP restriction issues
    const handler = window.PaystackPop.setup({
      key: config.PAYSTACK_PUBLIC_KEY,
      email: email,
      amount: selectedAmount * 100, // Paystack expects amount in kobo
      currency: 'NGN',
      ref: reference,
      metadata: {
        custom_fields: [
          {
            display_name: "Donor Name",
            variable_name: "donor_name",
            value: name || 'Anonymous'
          },
          {
            display_name: "Message",
            variable_name: "message",
            value: message || ''
          }
        ]
      },
      callback: function(response) {
        // Payment successful, verify on backend
        verifyPayment(response.reference);
      },
      onClose: function() {
        // User closed the popup without completing payment
        if (step === 'processing') {
          setStep('form');
        }
      }
    });

    // Open the Paystack popup
    handler.openIframe();
    setStep('processing');
  };

  const resetForm = () => {
    setStep('select');
    setSelectedAmount(null);
    setCustomAmount('');
    setEmail('');
    setName('');
    setMessage('');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-xl">
              <Coffee size={28} />
            </div>
            <div>
              <h2 className="text-xl font-black">Buy Me a Coffee</h2>
              <p className="text-amber-100 text-sm font-medium">Support the Nigerian Tax AI</p>
            </div>
          </div>
          
          {/* Progress bar */}
          {stats && stats.goal > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>₦{stats.total_amount?.toLocaleString() || 0} raised</span>
                <span>Goal: ₦{stats.goal?.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${stats.goal_progress || 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'select' && (
            <div className="space-y-4">
              <p className="text-slate-600 dark:text-slate-300 text-sm text-center">
                Your support helps us maintain and improve this free tool for everyone! ☕
              </p>
              
              {/* Coffee options */}
              <div className="grid grid-cols-2 gap-3">
                {donationConfig?.coffee_prices?.filter(p => p.amount).map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectAmount(option.amount)}
                    className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-600 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all text-center group"
                  >
                    <span className="text-2xl block mb-1">{option.label.split(' ')[0]}</span>
                    <span className="text-lg font-black text-slate-800 dark:text-slate-100">₦{option.amount?.toLocaleString()}</span>
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-1">{option.description}</span>
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                  Or enter custom amount
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₦</span>
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="1000"
                      min="100"
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:border-amber-400 dark:focus:border-amber-500 outline-none transition-colors text-slate-800 dark:text-slate-100 font-bold"
                    />
                  </div>
                  <button
                    onClick={handleCustomAmount}
                    disabled={!customAmount || parseInt(customAmount) < 100}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white font-bold rounded-xl transition-colors disabled:cursor-not-allowed"
                  >
                    <Gift size={18} />
                  </button>
                </div>
                {error && <p className="text-rose-500 text-xs mt-2">{error}</p>}
              </div>

              {/* Recent supporters */}
              {stats?.recent_supporters?.length > 0 && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Heart size={12} className="text-rose-500" /> Recent Supporters
                  </h4>
                  <div className="space-y-2">
                    {stats.recent_supporters.slice(0, 3).map((donor, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-300">
                          {donor.name || 'Anonymous'}
                        </span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          ₦{donor.amount?.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-center mb-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-700 dark:text-amber-300 font-bold">
                  <Coffee size={16} />
                  <span>₦{selectedAmount?.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:border-amber-400 dark:focus:border-amber-500 outline-none transition-colors text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Name (optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:border-amber-400 dark:focus:border-amber-500 outline-none transition-colors text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Message (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Leave a kind message..."
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:border-amber-400 dark:focus:border-amber-500 outline-none transition-colors text-slate-800 dark:text-slate-100 resize-none"
                />
              </div>

              {error && (
                <p className="text-rose-500 text-sm text-center">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!email}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Heart size={16} />
                  Support
                </button>
              </div>
            </form>
          )}

          {step === 'processing' && (
            <div className="text-center py-8">
              <Loader2 size={48} className="mx-auto text-amber-500 animate-spin mb-4" />
              <p className="text-slate-600 dark:text-slate-300 font-medium">
                {loading ? 'Verifying your payment...' : 'Preparing your payment...'}
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
                <Coffee size={40} className="text-emerald-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">
                Thank You for Buying Me a Coffee! ☕
              </h3>
              {verifiedAmount && (
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                  ₦{verifiedAmount.toLocaleString()}
                </p>
              )}
              <p className="text-slate-600 dark:text-slate-300">
                Your support means the world to us and helps keep this tool free for everyone! 🎉
              </p>
              <button
                onClick={() => {
                  resetForm();
                  onClose();
                }}
                className="mt-6 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mb-4">
                <XCircle size={40} className="text-rose-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">
                Payment Failed
              </h3>
              <p className="text-slate-600 dark:text-slate-300 mb-2">
                {error || 'Your payment could not be processed. Please try again.'}
              </p>
              <button
                onClick={resetForm}
                className="mt-4 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
            Secured by <span className="font-bold">Paystack</span> • 100% of donations support development
          </p>
        </div>
      </div>
    </div>
  );
};

// Floating draggable button trigger
export const BuyMeCoffeeButton = ({ onClick }) => {
  const buttonRef = useRef(null);
  const [position, setPosition] = useState(() => {
    // Load saved position from localStorage or use default
    const saved = localStorage.getItem('coffee_button_position');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);

  // Save position to localStorage when it changes
  useEffect(() => {
    if (position) {
      localStorage.setItem('coffee_button_position', JSON.stringify(position));
    }
  }, [position]);

  // Constrain position to viewport
  const constrainToViewport = useCallback((x, y) => {
    const button = buttonRef.current;
    if (!button) return { x, y };
    
    const rect = button.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    
    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY))
    };
  }, []);

  // Mouse/Touch start
  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const button = buttonRef.current;
    if (!button) return;
    
    const rect = button.getBoundingClientRect();
    
    setIsDragging(true);
    setHasMoved(false);
    setDragStart({
      x: clientX - rect.left,
      y: clientY - rect.top
    });
  }, []);

  // Mouse/Touch move
  const handleDragMove = useCallback((e) => {
    if (!isDragging) return;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const newX = clientX - dragStart.x;
    const newY = clientY - dragStart.y;
    
    const constrained = constrainToViewport(newX, newY);
    setPosition(constrained);
    setHasMoved(true);
  }, [isDragging, dragStart, constrainToViewport]);

  // Mouse/Touch end
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add global event listeners for drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
      
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Handle click - only trigger if not dragged
  const handleClick = useCallback(() => {
    if (!hasMoved) {
      onClick();
    }
  }, [hasMoved, onClick]);

  // Reset position on double click
  const handleDoubleClick = useCallback(() => {
    setPosition(null);
    localStorage.removeItem('coffee_button_position');
  }, []);

  // Style based on whether we have a custom position
  const buttonStyle = position
    ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
        right: 'auto',
        bottom: 'auto'
      }
    : {};

  return (
    <div
      ref={buttonRef}
      className={`fixed z-30 select-none touch-none ${
        position 
          ? '' 
          : 'bottom-24 left-4 sm:bottom-6 sm:left-auto sm:right-6'
      } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={buttonStyle}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
      onDoubleClick={handleDoubleClick}
      title="Drag to move • Double-click to reset • Click to open"
    >
      <div
        onClick={handleClick}
        className="relative"
      >
        <div className="relative">
          <div className={`absolute inset-0 bg-amber-400 rounded-full blur-lg opacity-50 ${isDragging ? 'opacity-75' : 'animate-pulse'}`} />
          <div className={`relative flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full shadow-lg transition-all font-bold text-xs sm:text-sm ${isDragging ? 'scale-110 shadow-xl' : 'hover:scale-105 hover:shadow-xl'}`}>
            <Coffee size={16} className="sm:w-[18px] sm:h-[18px]" />
            <span className="hidden sm:inline">Buy me a coffee</span>
          </div>
          <Sparkles 
            size={14} 
            className={`absolute -top-1 -right-1 text-amber-300 ${isDragging ? '' : 'animate-bounce'}`}
          />
        </div>
      </div>
    </div>
  );
};
