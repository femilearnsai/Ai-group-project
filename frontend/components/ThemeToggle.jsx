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
    <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 sm:p-1 rounded-lg sm:rounded-xl">
      {themes.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => setThemeMode(id)}
          className={`p-1.5 sm:p-2 rounded-md sm:rounded-lg transition-all ${
            theme === id
              ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
          title={label}
        >
          <Icon size={14} className="sm:w-4 sm:h-4" />
        </button>
      ))}
    </div>
  );
};
