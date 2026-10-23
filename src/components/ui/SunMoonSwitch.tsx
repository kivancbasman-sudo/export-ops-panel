import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../store/ThemeContext';

interface SunMoonSwitchProps {
  className?: string;
  showText?: boolean;
}

export function SunMoonSwitch({ className = '', showText = false }: SunMoonSwitchProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className={`flex items-center gap-2 select-none shrink-0 ${className}`}>
      {showText && (
        <span className="text-xs font-semibold text-slate-700 dark:text-stone-200">
          {isDark ? 'Koyu Tema' : 'Açık Tema'}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? 'Açık Temaya Geç' : 'Koyu Temaya Geç'}
        title={isDark ? 'Açık Temaya Geç (Güneş)' : 'Koyu Temaya Geç (Ay)'}
        onClick={toggleTheme}
        className={`relative inline-flex h-7 w-14 items-center rounded-full p-1 cursor-pointer transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 dark:focus:ring-offset-stone-900 border shrink-0 ${
          isDark
            ? 'bg-stone-900 border-stone-700 shadow-inner'
            : 'bg-amber-100/90 border-amber-300/80 shadow-inner'
        }`}
      >
        {/* Track Icons in Background */}
        <div className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
          <Sun
            className={`w-3.5 h-3.5 transition-opacity duration-200 ${
              isDark ? 'opacity-30 text-stone-500' : 'opacity-0 text-amber-500'
            }`}
          />
          <Moon
            className={`w-3.5 h-3.5 transition-opacity duration-200 ${
              isDark ? 'opacity-0 text-amber-200' : 'opacity-40 text-stone-400'
            }`}
          />
        </div>

        {/* Sliding Knob with Active Icon */}
        <div
          className={`flex items-center justify-center h-5 w-5 rounded-full shadow-md transform transition-all duration-300 ease-in-out ${
            isDark
              ? 'translate-x-7 bg-stone-800 text-amber-300 border border-amber-600/50 shadow-amber-950/50'
              : 'translate-x-0 bg-white text-amber-500 border border-amber-200 shadow-amber-200/50'
          }`}
        >
          {isDark ? (
            <Moon className="w-3.5 h-3.5 fill-amber-300/40 text-amber-300 transition-transform duration-300 rotate-0" />
          ) : (
            <Sun className="w-3.5 h-3.5 fill-amber-400/50 text-amber-500 transition-transform duration-300 rotate-0" />
          )}
        </div>
      </button>
    </div>
  );
}
