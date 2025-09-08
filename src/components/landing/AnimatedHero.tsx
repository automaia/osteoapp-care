import React from 'react';

interface AnimatedHeroProps {
  children: React.ReactNode;
  className?: string;
}

const AnimatedHero: React.FC<AnimatedHeroProps> = ({ children, className = '' }) => {
  return (
    <div className={`animated-gradient-bg relative overflow-hidden ${className}`}>
      {/* Éléments décoratifs flottants */}
      <div className="absolute inset-0 opacity-10">
        <div className="floating-element-1 absolute top-20 left-20 w-32 h-32 bg-white rounded-full"></div>
        <div className="floating-element-2 absolute bottom-20 right-20 w-24 h-24 bg-white rounded-full"></div>
        <div className="floating-element-3 absolute top-1/2 left-10 w-16 h-16 bg-white rounded-full"></div>
      </div>
      
      {/* Contenu du hero */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default AnimatedHero;