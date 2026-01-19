import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';

export const ThemeToggle = () => {
  const { theme, toggleTheme, setThemeMode, isDark } = useTheme();

  const themes = [
    { id: 'light', icon: Sun, label: 'Light' },
    { id: 'dark', icon: Moon, label: 'Dark' },
    { id: 'system', icon: Monitor, label: 'System' }
  ];

  return (
    <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
      {themes.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => setThemeMode(id)}
          className={`p-1 sm:p-1.5 md:p-2 rounded-md transition-all ${
            theme === id
              ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
          title={label}
          aria-label={`${label} theme`}
        >
          <Icon size={12} className="sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
        </button>
      ))}
    </div>
  );
};
