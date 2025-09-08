import React from 'react';
import { Outlet } from 'react-router-dom';
import { Stethoscope, Star } from 'lucide-react';

const WaitlistLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Centered content */}
      <div className="min-h-screen flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-4xl">
          {/* Mobile header */}
          <div className="md:hidden flex items-center justify-center mb-8">
            <Stethoscope className="text-primary-500" size={32} />
            <h1 className="text-2xl font-bold text-primary-500 ml-2">OsteoApp</h1>
            <div className="ml-2 bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center">
              <Star size={10} className="mr-1" />
              BETA
            </div>
          </div>

          {/* Main content card */}
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaitlistLayout;