import React from 'react';

interface Props {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass: string;
}

export const DashboardCard: React.FC<Props> = ({ title, value, icon, colorClass }) => {
  // Extract color base from colorClass usually passed like 'bg-green-500/10'
  // We'll use specific gradients based on the context or generic glass
  
  return (
    <div className="relative group overflow-hidden bg-slate-900/40 backdrop-blur-xl p-5 rounded-2xl border border-white/5 shadow-xl hover:shadow-2xl hover:bg-slate-800/50 transition-all duration-300">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
      
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-xs font-medium mb-2 tracking-wide uppercase">{title}</p>
          <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{value}</h3>
        </div>
        <div className={`p-3.5 rounded-2xl ${colorClass.replace('/10', '/20')} backdrop-blur-md shadow-inner ring-1 ring-white/5`}>
          {icon}
        </div>
      </div>
      
      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  );
};