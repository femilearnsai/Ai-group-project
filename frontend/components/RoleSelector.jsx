import React from 'react';
import { Scale, User, Building2 } from 'lucide-react';

const ROLES = [
  {
    id: 'taxpayer',
    label: 'Taxpayer',
    icon: User,
    description: 'Casual, friendly explanations with examples',
    color: 'emerald'
  },
  {
    id: 'tax_lawyer',
    label: 'Tax Lawyer',
    icon: Scale,
    description: 'Formal legal language with statutory citations',
    color: 'blue'
  },
  {
    id: 'company',
    label: 'Company',
    icon: Building2,
    description: 'Compliance-focused guidance for businesses',
    color: 'purple'
  }
];

export const RoleSelector = ({ selectedRole, onRoleChange }) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] px-2">
        I am asking as...
      </div>
      <div className="flex flex-col gap-2">
        {ROLES.map((role) => {
          const Icon = role.icon;
          const isSelected = selectedRole === role.id;
          
          const colorClasses = {
            emerald: isSelected 
              ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-300' 
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20',
            blue: isSelected 
              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300' 
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/20',
            purple: isSelected 
              ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300' 
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/50 dark:hover:bg-purple-900/20'
          };

          return (
            <button
              key={role.id}
              onClick={() => onRoleChange(role.id)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${colorClasses[role.color]}`}
            >
              <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/60 dark:bg-slate-800/60' : 'bg-slate-100 dark:bg-slate-700'}`}>
                <Icon size={16} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-xs font-black">{role.label}</div>
                <div className="text-[9px] opacity-70 font-medium">{role.description}</div>
              </div>
              {isSelected && (
                <div className={`w-2 h-2 rounded-full ${
                  role.color === 'emerald' ? 'bg-emerald-500' :
                  role.color === 'blue' ? 'bg-blue-500' : 'bg-purple-500'
                }`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
