import React, { useState, useEffect, forwardRef } from 'react';
import { useAutoCapitalize } from '../../hooks/useAutoCapitalize';

interface AutoCapitalizeInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onValueChange?: (value: string) => void;
}

const AutoCapitalizeInput = forwardRef<HTMLInputElement, AutoCapitalizeInputProps>(
  ({ value: propValue, onChange, onValueChange, ...props }, ref) => {
    const [localValue, setLocalValue] = useState(propValue as string || '');
    const [value, setValue, handleAutoCapitalize] = useAutoCapitalize(localValue);

    // Update local value when prop value changes
    useEffect(() => {
      if (propValue !== undefined && propValue !== value) {
        setValue(propValue as string);
      }
    }, [propValue, setValue]);

    // Update parent when value changes
    useEffect(() => {
      if (onValueChange && value !== propValue) {
        onValueChange(value);
      }
    }, [value, propValue, onValueChange]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      handleAutoCapitalize(e);
      
      // Create a synthetic event to pass to the original onChange
      if (onChange) {
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1)
          }
        };
        onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
      }
    };

    return (
      <input
        {...props}
        ref={ref}
        value={value}
        onChange={handleChange}
      />
    );
  }
);

AutoCapitalizeInput.displayName = 'AutoCapitalizeInput';

export default AutoCapitalizeInput;