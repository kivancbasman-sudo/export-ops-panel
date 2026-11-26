import React, { useState, useRef, useEffect } from 'react';
import { AlertTriangle, Check, Copy, Edit2 } from 'lucide-react';

interface EditableDocFieldProps {
  label: string;
  value: string | string[];
  prefixStr?: string;
  copyable?: boolean;
  copyWithoutPrefix?: boolean;
  onChange: (val: any) => void;
  isMulti?: boolean;
  multiCols?: number;
  className?: string;
  maxLength?: number;
  conflictMessage?: string;
  conflictingValues?: string[];
  extraAction?: {
    icon: React.ReactNode;
    title: string;
    href?: string;
    onClick?: () => void;
  };
}

export function EditableDocField({ 
  label, 
  value, 
  prefixStr, 
  copyable, 
  copyWithoutPrefix,
  onChange, 
  isMulti, 
  multiCols, 
  className, 
  maxLength,
  conflictMessage,
  conflictingValues,
  extraAction
}: EditableDocFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDocWithPrefixToStrip = 
    copyWithoutPrefix ?? 
    Boolean(
      (prefixStr && /^(?:I7X|D7X|DI|ı7x|i7x|d7x|dı|di|İ7X|Dİ)/i.test(prefixStr)) ||
      /^(?:I7X|D7X|DI|ı7x|i7x|d7x|dı|di|İ7X|Dİ)/i.test(label)
    );

  const cleanDocNumber = (val: string): string => {
    if (!val) return '';
    let clean = String(val).trim();
    // I7X, D7X, DI gibi baş ekleri (ve varsa sonrasındaki tire, boşluk vb.) temizle
    clean = clean.replace(/^(?:I7X|D7X|DI|ı7x|i7x|d7x|dı|di|İ7X|Dİ)[-\s_.:]*/i, '');
    if (prefixStr && clean.startsWith(prefixStr)) {
      clean = clean.slice(prefixStr.length).trim();
    }
    // Baş ekinden sonra gelen sadece rakamları al
    clean = clean.replace(/^[^\d]+/, '');
    return clean;
  };

  const displayValue = isMulti 
    ? (Array.isArray(value) ? value : value ? [value] : []) 
    : ((value as string) || '');

  useEffect(() => {
    if (isEditing) {
      setTempValue(isMulti ? (displayValue as string[]).join(', ') : (displayValue as string));
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isEditing, displayValue, isMulti]);

  const handleSave = () => {
    if (isMulti) {
      const vals = tempValue.split(',').map(s => s.trim()).filter(Boolean);
      onChange(vals);
    } else {
      onChange(tempValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    let textToCopy = '';
    if (isMulti) {
      if (isDocWithPrefixToStrip) {
        textToCopy = (displayValue as string[]).map(cleanDocNumber).filter(Boolean).join(', ');
      } else {
        textToCopy = (displayValue as string[]).join(', ');
      }
    } else {
      if (isDocWithPrefixToStrip) {
        textToCopy = cleanDocNumber(displayValue as string);
      } else {
        textToCopy = String((prefixStr || '') + (displayValue || ''));
      }
    }
    handleCopy(textToCopy);
  };

  const hasConflict = Boolean(conflictMessage);
  const normalizedConflictSet = new Set(
    (conflictingValues || []).map(v => v.trim().replace(/\s+/g, ' ').toUpperCase())
  );

  return (
    <div className={`flex flex-col ${className || 'flex-1 min-w-0'}`}>
      <label 
        className={`text-[10px] font-bold uppercase tracking-wider cursor-pointer group flex items-center gap-1 transition-colors select-none truncate mb-0.5 ${
          hasConflict
            ? 'text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300'
            : 'text-slate-500 dark:text-stone-400 hover:text-blue-600 dark:hover:text-amber-400'
        }`}
        onClick={() => setIsEditing(true)}
        title={hasConflict ? `${label} — ${conflictMessage}` : `${label} (Düzenlemek için tıklayın)`}
      >
        {hasConflict && (
          <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
        )}
        <span className="truncate">{label}</span>
        <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 dark:text-amber-400 shrink-0" />
      </label>
      
      {isEditing ? (
        <div className={`relative flex items-center border bg-slate-100 dark:bg-stone-900 h-6.5 min-h-[26px] rounded-sm w-full min-w-0 max-w-full ${
          hasConflict
            ? 'border-rose-500 dark:border-rose-500 shadow-[0_0_0_2px_rgba(244,63,94,0.2)]'
            : 'border-blue-500 dark:border-amber-500 shadow-[0_0_0_2px_rgba(245,158,11,0.2)]'
        }`}>
          {prefixStr && <span className="pl-1.5 text-xs font-mono font-medium text-slate-500 dark:text-stone-400 select-none cursor-text shrink-0" onClick={() => inputRef.current?.focus()}>{prefixStr}</span>}
          <input
            ref={inputRef}
            type="text"
            maxLength={maxLength}
            className={`bg-transparent py-0.5 text-xs font-mono font-semibold text-slate-900 dark:text-stone-100 focus:outline-none flex-1 min-w-0 w-full ${prefixStr ? 'px-1' : 'px-1.5'}`}
            value={tempValue}
            onChange={e => {
              let val = e.target.value;
              if (prefixStr && val.startsWith(prefixStr)) {
                val = val.slice(prefixStr.length);
              }
              if (maxLength && val.length > maxLength) {
                val = val.slice(0, maxLength);
              }
              setTempValue(val);
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            placeholder={isMulti ? "Değerleri virgülle ayırın..." : ""}
          />
        </div>
      ) : (
        <div 
          className={`relative flex items-center justify-start gap-1 min-h-[26px] border rounded-sm px-1 group transition-colors min-w-0 w-full overflow-hidden ${
            hasConflict
              ? 'border-rose-400 dark:border-rose-700 bg-rose-50/80 dark:bg-rose-950/40 hover:border-rose-500 dark:hover:border-rose-600'
              : 'border-transparent hover:border-slate-400 dark:hover:border-stone-600 hover:bg-slate-200/70 dark:hover:bg-stone-800/80'
          }`}
          onDoubleClick={() => setIsEditing(true)}
          title={hasConflict ? conflictMessage : undefined}
        >
          <div className={`${isMulti && multiCols === 2 && (displayValue as string[]).length > 1 ? 'grid grid-cols-2 gap-1 items-center w-fit shrink-0' : 'flex items-center gap-1 min-w-0 shrink-0'} py-0.5 cursor-text`}>
            {isMulti ? (
              (displayValue as string[]).length > 0 ? (
                (displayValue as string[]).map((v, i) => {
                  const isItemConflicting = normalizedConflictSet.has(
                    v.trim().replace(/\s+/g, ' ').toUpperCase()
                  );
                  return (
                    <span 
                      key={i} 
                      className={`border shadow-sm font-mono text-xs font-semibold px-1.5 py-0.5 rounded-sm select-text shrink-0 whitespace-nowrap ${multiCols === 2 ? 'text-center' : ''} ${
                        isItemConflicting
                          ? 'bg-rose-100 dark:bg-rose-950/80 border-rose-400 dark:border-rose-700 text-rose-800 dark:text-rose-200'
                          : 'bg-slate-100 dark:bg-stone-800 border-slate-300 dark:border-stone-700 text-slate-900 dark:text-stone-100'
                      }`} 
                      title={isItemConflicting && conflictMessage ? `${v} — ${conflictMessage}` : v}
                    >
                      {v}
                    </span>
                  );
                })
              ) : (
                <span className="text-slate-500 dark:text-stone-500 text-xs font-mono italic select-none whitespace-nowrap">Boş</span>
              )
            ) : (
              <span 
                className={`font-mono text-xs ${
                  displayValue
                    ? hasConflict
                      ? 'text-rose-800 dark:text-rose-200 font-semibold select-text'
                      : 'text-slate-900 dark:text-stone-100 font-semibold select-text'
                    : 'text-slate-500 dark:text-stone-500 italic select-none font-normal'
                } inline-flex items-center shrink-0`} 
                title={hasConflict ? `${(prefixStr || '') + (displayValue || '')} — ${conflictMessage}` : String((prefixStr || '') + (displayValue || ''))}
              >
                {prefixStr && displayValue ? <span className={`${hasConflict ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-stone-400'} font-mono font-medium mr-0.5 shrink-0`}>{prefixStr}</span> : null}
                <span className="whitespace-nowrap select-text">{displayValue || 'Boş'}</span>
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-0.5 shrink-0 ml-1">
            {copyable && (displayValue as any)?.length > 0 && (
              <button
                type="button"
                onClick={handleCopyAll}
                className={`p-0.5 text-slate-500 dark:text-stone-400 hover:text-blue-600 dark:hover:text-amber-400 hover:bg-blue-50 dark:hover:bg-stone-800 transition-all shrink-0 rounded border border-transparent cursor-pointer ${
                  copied ? 'opacity-100' : 'opacity-40 group-hover:opacity-100 hover:!opacity-100'
                }`}
                title={isDocWithPrefixToStrip ? "Belge numarasını kopyala (ön eksiz)" : "Kopyala"}
              >
                {copied ? <Check className="w-3 h-3 text-green-600 dark:text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}

            {extraAction && (displayValue as any)?.length > 0 && (
              extraAction.href ? (
                <a
                  href={extraAction.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                    extraAction.onClick?.();
                  }}
                  className="p-0.5 text-slate-500 dark:text-stone-400 hover:text-red-600 dark:hover:text-amber-400 hover:bg-red-50 dark:hover:bg-stone-800 transition-all shrink-0 rounded border border-transparent cursor-pointer opacity-50 group-hover:opacity-100 hover:!opacity-100 flex items-center justify-center"
                  title={extraAction.title}
                >
                  {extraAction.icon}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    extraAction.onClick?.();
                  }}
                  className="p-0.5 text-slate-500 dark:text-stone-400 hover:text-red-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-stone-800 transition-all shrink-0 rounded border border-transparent cursor-pointer opacity-50 group-hover:opacity-100 hover:!opacity-100"
                  title={extraAction.title}
                >
                  {extraAction.icon}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
