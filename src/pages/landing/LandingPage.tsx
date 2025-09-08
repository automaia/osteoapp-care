import React from 'react';
import '../../styles/animatedGradient.css';
import HeroSection from '../../components/landing/HeroSection';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section avec le dégradé animé */}
      <HeroSection />
      
      {/* Autres sections de la landing page */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Fonctionnalités principales
          </h2>
          
          {/* Ajoutez ici le contenu des autres sections */}
        </div>
      </section>
    </div>
  );
};

export default LandingPage;