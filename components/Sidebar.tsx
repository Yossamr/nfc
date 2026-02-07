import React from 'react';
import { Home, Plus, Settings, BookOpen, Layers } from 'lucide-react';
import { ViewState } from '../types';

interface Props {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  // These props are no longer used in the Dock but kept for compatibility if passed
  onLogout?: () => void;
  onSave?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<Props> = ({ currentView, onChangeView }) => {
  const menuItems = [
    { id: 'dashboard', label: 'الرئيسية', icon: <Home size={24} /> },
    { id: 'subjects-list', label: 'المواد', icon: <BookOpen size={24} /> },
    { id: 'create-session', label: 'إضافة', icon: <Plus size={28} />, isMain: true },
    { id: 'settings', label: 'الإعدادات', icon: <Settings size={24} /> },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full px-6 flex justify-center pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-2 p-2 rounded-3xl bg-slate-900/60 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50 ring-1 ring-white/5 transition-all duration-300 hover:scale-[1.02] hover:bg-slate-900/70">
        
        {menuItems.map((item) => {
          const isActive = currentView === item.id || (currentView === 'subject-weeks' && item.id === 'subjects-list');
          
          if (item.isMain) {
            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id as ViewState)}
                className={`
                  relative w-14 h-14 -mt-6 mx-2 rounded-2xl flex items-center justify-center 
                  bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/40
                  transition-all duration-300 hover:scale-110 hover:-translate-y-1 active:scale-95 border-2 border-slate-900
                  group
                `}
              >
                <div className="absolute inset-0 rounded-2xl bg-white/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative z-10 transition-transform duration-300 group-hover:rotate-90">{item.icon}</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id as ViewState)}
              className={`
                relative w-12 h-12 flex flex-col items-center justify-center rounded-2xl transition-all duration-300
                ${isActive 
                  ? 'text-white bg-white/10 shadow-inner' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'}
              `}
            >
              <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'scale-100'}`}>
                {item.icon}
              </span>
              
              {/* Active Dot Indicator */}
              <span className={`
                absolute bottom-1 w-1 h-1 rounded-full bg-blue-400 transition-all duration-300
                ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}
              `} />
              
              {/* Tooltip on Hover (Desktop) */}
              <span className="absolute -top-10 bg-slate-800 text-white text-[10px] py-1 px-2 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-xl border border-white/5">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};