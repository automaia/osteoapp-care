import { useState, useCallback } from 'react';

/**
 * Custom hook for automatic capitalization of text
 * 
 * @param initialValue Initial text value
 * @returns [value, setValue, handleChange] - The current value, a setter function, and a change handler
 */
export function useAutoCapitalize(initialValue: string = '') {
  const [value, setValue] = useState(initialValue);

  // Function to capitalize the first letter of each new line
  const capitalizeText = useCallback((text: string): string => {
    if (!text) return text;
    
    // Split the text by new lines
    return text.split('\n').map(line => {
      if (!line) return line;
      return line.charAt(0).toUpperCase() + line.slice(1);
    }).join('\n');
  }, []);

  // Handle input changes with auto-capitalization
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const capitalizedValue = capitalizeText(newValue);
    setValue(capitalizedValue);
  }, [capitalizeText]);

  return [value, setValue, handleChange] as const;
}

export default useAutoCapitalize;