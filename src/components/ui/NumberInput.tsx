import React, { useState, useEffect } from 'react';
import { Input } from './Input';
import { formatNumber } from '../../utils/calculations';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  label?: string;
  value: number | undefined | null;
  onChange: (value: number) => void;
  decimals?: number;
  containerClassName?: string;
}

export function NumberInput({ value, onChange, decimals = 2, ...props }: NumberInputProps) {
  const [localValue, setLocalValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value != null && !isNaN(value) && value !== 0 ? formatNumber(value, decimals) : '');
    }
  }, [value, isFocused, decimals]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    
    // Parse the value allowing comma as decimal separator
    const clean = val.replace(/\./g, '').replace(/,/g, '.');
    const parsed = parseFloat(clean);
    if (!isNaN(parsed)) {
      onChange(parsed);
    } else if (val === '') {
      onChange(0);
    }
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={localValue}
      onChange={handleChange}
      onFocus={(e) => {
        setIsFocused(true);
        // When focused, show a more raw value that's easier to edit
        if (value != null && value !== 0) {
          let raw = String(value).replace('.', ',');
          setLocalValue(raw);
        } else {
          setLocalValue('');
        }
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        // On blur it formats back through the effect
        props.onBlur?.(e);
      }}
    />
  );
}
