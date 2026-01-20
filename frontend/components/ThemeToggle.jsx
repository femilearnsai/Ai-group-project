import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';

export const ThemeToggle = () => {
  const { theme, setThemeMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const themes = [
    { id: 'light', icon: Sun, label: 'Light' },
    { id: 'dark', icon: Moon, label: 'Dark' },
    { id: 'system', icon: Monitor, label: 'System' }
  ];

  const currentTheme = themes.find(t => t.id === theme) || themes[0];
  const CurrentIcon = currentTheme.icon;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 md:px-2.5 py-1 sm:py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all font-bold text-[10px] sm:text-xs"
      >
        <CurrentIcon size={12} className="sm:w-3.5 sm:h-3.5 text-emerald-600 dark:text-emerald-400" />
        <span className="hidden sm:inline">{currentTheme.label}</span>
        <ChevronDown 
          size={10} 
          className={`sm:w-3 sm:h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1.5 sm:mt-2 w-32 sm:w-36 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-2.5 py-1 text-[7px] sm:text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            Theme
          </div>
          {themes.map(({ id, icon: Icon, label }) => {
            const isSelected = theme === id;
            
            return (
              <button
                key={id}
                onClick={() => {
                  setThemeMode(id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-2 transition-all ${
                  isSelected 
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <Icon size={14} className="sm:w-4 sm:h-4" />
                <span className="text-[10px] sm:text-xs font-bold">{label}</span>
                {isSelected && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
