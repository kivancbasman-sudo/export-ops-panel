import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  prefixStr?: string;
  copyable?: boolean;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, prefixStr, copyable, className = '', containerClassName = 'w-full', value, ...props }, ref) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
      let textToCopy = String(value || '');
      // Do not append prefixStr, just copy the actual input value
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const hasCustomTextSize = /\btext-(?:xs|sm|base|lg|xl|\[[^\]]+\])\b/.test(className);
    const heightMatch = className.match(/\bh-(?:[0-9.]+|auto)\b/);
    const wrapperHeight = heightMatch ? heightMatch[0] : 'h-8';

    return (
      <div className={`flex flex-col gap-1 ${containerClassName}`}>
        {label && <label className="text-xs font-semibold text-slate-700 dark:text-stone-300">{label}</label>}
        <div className={`relative flex items-center border border-slate-500 dark:border-stone-700 bg-slate-100 dark:bg-stone-900/90 focus-within:border-blue-600 dark:focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-blue-600 dark:focus-within:ring-amber-400 ${wrapperHeight} shadow-sm transition-none`}>
          {prefixStr && (
            <span 
              className="pl-2 text-sm text-slate-600 dark:text-stone-400 font-medium cursor-text"
              onClick={(e) => {
                const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                if (input) input.focus();
              }}
            >
              {prefixStr}
            </span>
          )}
          <input
            ref={ref}
            value={value}
            className={`bg-transparent px-2 py-0.5 ${hasCustomTextSize ? '' : 'text-sm'} text-slate-900 dark:text-stone-100 placeholder:text-slate-400 dark:placeholder:text-stone-500 focus:outline-none flex-1 min-w-0 ${copyable ? 'pr-8' : ''} ${className}`}
            {...props}
          />
          {copyable && (
            <button
              type="button"
              onClick={handleCopy}
              className="absolute right-1 w-6 h-6 flex items-center justify-center text-slate-500 dark:text-stone-400 hover:text-blue-600 dark:hover:text-amber-400 hover:bg-blue-50 dark:hover:bg-stone-800 transition-colors"
              title="Kopyala"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        {error && <span className="text-[10px] text-red-600 dark:text-red-400">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';

