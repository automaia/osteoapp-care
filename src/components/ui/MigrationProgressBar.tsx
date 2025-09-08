import React from 'react';
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface MigrationProgressBarProps {
  steps: {
    id: string;
    label: string;
    status: 'pending' | 'in-progress' | 'completed' | 'error';
    progress?: number;
    error?: string;
  }[];
  currentStep: string;
}

const MigrationProgressBar: React.FC<MigrationProgressBarProps> = ({ steps, currentStep }) => {
  const currentStepIndex = steps.findIndex(step => step.id === currentStep);
  
  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="relative">
        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
          <div 
            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary-500 transition-all duration-500"
            style={{ 
              width: `${Math.max(5, (currentStepIndex / (steps.length - 1)) * 100)}%` 
            }}
          ></div>
        </div>
        
        {/* Step indicators */}
        <div className="flex justify-between">
          {steps.map((step, index) => (
            <div 
              key={step.id} 
              className={`flex flex-col items-center ${index <= currentStepIndex ? 'text-primary-600' : 'text-gray-400'}`}
              style={{ width: `${100 / steps.length}%` }}
            >
              <div className={`w-6 h-6 flex items-center justify-center rounded-full mb-1
                ${step.status === 'completed' ? 'bg-green-100 text-green-600' : 
                  step.status === 'error' ? 'bg-red-100 text-red-600' :
                  step.status === 'in-progress' ? 'bg-primary-100 text-primary-600' :
                  'bg-gray-100 text-gray-400'}`}
              >
                {step.status === 'completed' ? (
                  <CheckCircle size={14} />
                ) : step.status === 'error' ? (
                  <AlertTriangle size={14} />
                ) : step.status === 'in-progress' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <span className="text-xs">{index + 1}</span>
                )}
              </div>
              <span className="text-xs text-center">{step.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Current step details */}
      {steps.map(step => {
        if (step.id !== currentStep) return null;
        
        return (
          <div key={step.id} className="mt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">{step.label}</h4>
            
            {step.status === 'in-progress' && step.progress !== undefined && (
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                <div 
                  className="bg-primary-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${step.progress}%` }}
                ></div>
              </div>
            )}
            
            {step.status === 'error' && step.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {step.error}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MigrationProgressBar;