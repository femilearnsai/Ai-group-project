import React, { useState, useRef, useEffect } from 'react';
import { Scale, User, Building2, ChevronDown } from 'lucide-react';

const ROLES = [
  {
    id: 'taxpayer',
    label: 'Taxpayer',
    icon: User,
    description: 'Casual, friendly explanations',
    color: 'emerald'
  },
  {
    id: 'tax_lawyer',
    label: 'Tax Lawyer',
    icon: Scale,
    description: 'Formal legal language',
    color: 'blue'
  },
  {
    id: 'company',
    label: 'Company',
    icon: Building2,
    description: 'Compliance-focused guidance',
    color: 'purple'
  }
];

export const RoleDropdown = ({ selectedRole, onRoleChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentRole = ROLES.find(r => r.id === selectedRole) || ROLES[0];
  const CurrentIcon = currentRole.icon;

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

  const getColorClasses = (color, isSelected) => {
    const colors = {
      emerald: {
        selected: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
        hover: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
      },
      blue: {
        selected: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
        hover: 'hover:bg-blue-50 dark:hover:bg-blue-900/30'
      },
      purple: {
        selected: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700',
        hover: 'hover:bg-purple-50 dark:hover:bg-purple-900/30'
      }
    };
    return isSelected ? colors[color].selected : colors[color].hover;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 sm:gap-1.5 md:gap-2 px-1.5 sm:px-2 md:px-3 py-1 sm:py-1.5 md:py-2 rounded-lg border-2 transition-all font-bold text-[10px] sm:text-xs md:text-sm ${getColorClasses(currentRole.color, true)}`}
      >
        <CurrentIcon size={12} className="sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
        <span>{currentRole.label}</span>
        <ChevronDown 
          size={10} 
          className={`sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1.5 sm:mt-2 w-48 sm:w-56 md:w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 sm:py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-[7px] sm:text-[8px] md:text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            I am asking as...
          </div>
          {ROLES.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.id;
            
            return (
              <button
                key={role.id}
                onClick={() => {
                  onRoleChange(role.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 sm:gap-2.5 md:gap-3 px-2.5 sm:px-3 py-2 sm:py-2.5 md:py-3 transition-all ${
                  isSelected 
                    ? getColorClasses(role.color, true) 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <div className={`p-1.5 sm:p-2 rounded-lg ${
                  isSelected 
                    ? 'bg-white/60 dark:bg-slate-900/60' 
                    : 'bg-slate-100 dark:bg-slate-700'
                }`}>
                  <Icon size={14} className="sm:w-4 sm:h-4" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-[10px] sm:text-[11px] md:text-xs font-black truncate">{role.label}</div>
                  <div className="text-[8px] sm:text-[9px] md:text-[10px] text-slate-400 dark:text-slate-500 truncate">{role.description}</div>
                </div>
                {isSelected && (
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-current flex-shrink-0"></div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
