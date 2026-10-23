import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', className = '', ...props }, ref) => {
    let variantStyles = '';
    switch (variant) {
      case 'primary':
        variantStyles = 'bg-[#0070F2] dark:bg-amber-600 dark:hover:bg-amber-500 text-white border-transparent hover:bg-[#0050B3]';
        break;
      case 'secondary':
        variantStyles = 'bg-slate-200 dark:bg-stone-800 text-slate-800 dark:text-stone-200 border-slate-500 dark:border-stone-700 hover:bg-slate-300 dark:hover:bg-stone-700';
        break;
      case 'danger':
        variantStyles = 'bg-slate-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-500 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/50';
        break;
      case 'ghost':
        variantStyles = 'bg-transparent text-slate-700 dark:text-stone-300 border-transparent hover:bg-slate-300 dark:hover:bg-stone-800';
        break;
    }

    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center border px-3 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-amber-500 focus:ring-offset-1 dark:focus:ring-offset-stone-900 rounded-none shadow-sm transition-none h-8 ${variantStyles} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
