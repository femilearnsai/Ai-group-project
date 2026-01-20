import React from 'react';
import { X, Sparkles, UserPlus, MessageSquare, Zap, Shield } from 'lucide-react';

export const SignupPrompt = ({ isOpen, onClose, onSignup }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Decorative Header */}
        <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 p-6 text-white overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors z-10"
          >
            <X size={18} />
          </button>
          
          <div className="relative flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-xl">
              <Sparkles size={28} />
            </div>
            <div>
              <h2 className="text-xl font-black">Enjoying TaxNG?</h2>
              <p className="text-emerald-100 text-sm font-medium">
                Sign up for a better experience!
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-slate-600 dark:text-slate-300 text-sm">
            Create a free account to unlock these benefits:
          </p>
          
          {/* Benefits List */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-800/50 rounded-lg text-emerald-600 dark:text-emerald-400">
                <MessageSquare size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Save Chat History</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Access your conversations anytime</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <div className="p-2 bg-blue-100 dark:bg-blue-800/50 rounded-lg text-blue-600 dark:text-blue-400">
                <Zap size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Personalized Experience</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Get tailored tax advice for your role</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
              <div className="p-2 bg-purple-100 dark:bg-purple-800/50 rounded-lg text-purple-600 dark:text-purple-400">
                <Shield size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Secure & Private</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Your data is protected and encrypted</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              onClick={onSignup}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors flex items-center justify-center gap-2"
            >
              <UserPlus size={18} />
              Sign Up Free
            </button>
            
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-colors text-sm"
            >
              Maybe Later
            </button>
          </div>
          
          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
            Already have an account?{' '}
            <button
              onClick={onSignup}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
