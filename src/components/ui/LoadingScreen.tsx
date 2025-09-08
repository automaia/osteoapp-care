import React from 'react';
import { Stethoscope } from 'lucide-react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="flex items-center mb-8">
        <Stethoscope size={40} className="text-primary-500" />
        <h1 className="text-2xl md:text-3xl font-bold text-primary-500 ml-3">OstheoApp</h1>
      </div>
      <div className="w-12 h-12 rounded-full border-4 border-primary-200 border-t-primary-500 animate-spin"></div>
    </div>
  );
};

export default LoadingScreen;