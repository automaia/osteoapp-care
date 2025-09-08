import { useState, useEffect } from 'react';
import { saveFormData, getFormData, clearFormData } from '../utils/sessionPersistence';

/**
 * Hook for form data persistence
 * 
 * @param formId Unique identifier for the form
 * @param initialData Initial form data
 * @returns [formData, setFormData, resetForm]
 */
export function useFormPersistence<T extends Record<string, any>>(
  formId: string,
  initialData: T
): [T, (data: Partial<T>) => void, () => void] {
  // Initialize state with saved data or initial data
  const [formData, setFormDataState] = useState<T>(() => {
    const savedData = getFormData<T>(formId);
    return savedData || initialData;
  });

  // Update form data and save to localStorage
  const setFormData = (data: Partial<T>) => {
    setFormDataState(prev => {
      const newData = { ...prev, ...data };
      saveFormData(formId, newData);
      return newData;
    });
  };

  // Reset form to initial data and clear localStorage
  const resetForm = () => {
    setFormDataState(initialData);
    clearFormData(formId);
  };

  // Save form data on unmount
  useEffect(() => {
    return () => {
      saveFormData(formId, formData);
    };
  }, [formId, formData]);

  return [formData, setFormData, resetForm];
}

export default useFormPersistence;