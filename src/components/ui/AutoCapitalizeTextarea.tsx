import React, { useState, useEffect, forwardRef } from 'react';
import { useAutoCapitalize } from '../../hooks/useAutoCapitalize';

interface AutoCapitalizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onValueChange?: (value: string) => void;
}

const AutoCapitalizeTextarea = forwardRef<HTMLTextAreaElement, AutoCapitalizeTextareaProps>(
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

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleAutoCapitalize(e);
      
      // Create a synthetic event to pass to the original onChange
      if (onChange) {
        // Split by lines, capitalize first letter of each line, then join back
        const lines = e.target.value.split('\n');
        const capitalizedLines = lines.map(line => 
          line ? line.charAt(0).toUpperCase() + line.slice(1) : line
        );
        const capitalizedValue = capitalizedLines.join('\n');
        
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: capitalizedValue
          }
        };
        onChange(syntheticEvent as React.ChangeEvent<HTMLTextAreaElement>);
      }
    };

    return (
      <textarea
        {...props}
        ref={ref}
        value={value}
        onChange={handleChange}
      />
    );
  }
);

AutoCapitalizeTextarea.displayName = 'AutoCapitalizeTextarea';

export default AutoCapitalizeTextarea;