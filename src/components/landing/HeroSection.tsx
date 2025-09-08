import React from 'react';
import { Star, ArrowRight } from 'lucide-react';
import AnimatedHero from './AnimatedHero';
import { Button } from '../ui/Button';

const HeroSection: React.FC = () => {
  return (
    <section className="min-h-[80vh] flex flex-col md:flex-row">
      {/* Partie gauche avec dégradé animé */}
      <AnimatedHero className="flex-1 flex flex-col justify-center items-center p-8 md:p-12 text-white">
        {/* Badge Beta */}
        <div className="absolute top-6 right-6">
          <div className="bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium flex items-center">
            <Star size={14} className="mr-1" />
            BETA
          </div>
        </div>

        <div className="max-w-xl">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Gérez votre cabinet d'ostéopathie en toute simplicité
          </h1>
          
          <p className="text-lg md:text-xl opacity-90 mb-8">
            Une solution complète et intuitive pour les ostéopathes qui souhaitent se concentrer sur leurs patients.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              variant="primary" 
              size="lg"
              className="bg-white text-primary-600 hover:bg-opacity-90"
            >
              Essayer gratuitement
              <ArrowRight size={18} className="ml-2" />
            </Button>
            
            <Button 
              variant="outline" 
              size="lg"
              className="border-white text-white hover:bg-white/10"
            >
              Découvrir les fonctionnalités
            </Button>
          </div>
          
          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-12">
            <div className="bg-white bg-opacity-10 p-4 rounded-xl backdrop-blur-sm">
              <h3 className="font-semibold text-lg md:text-xl mb-2">Gestion patients</h3>
              <p className="opacity-80 text-sm md:text-base">Dossiers médicaux complets et accessibles</p>
            </div>
            <div className="bg-white bg-opacity-10 p-4 rounded-xl backdrop-blur-sm">
              <h3 className="font-semibold text-lg md:text-xl mb-2">Agenda intégré</h3>
              <p className="opacity-80 text-sm md:text-base">Planifiez et suivez vos rendez-vous</p>
            </div>
          </div>
        </div>
      </AnimatedHero>
      
      {/* Partie droite (contenu ou image) */}
      <div className="flex-1 bg-white p-8 flex items-center justify-center">
        {/* Contenu de la partie droite - à personnaliser */}
        <div className="max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Simplifiez votre quotidien professionnel
          </h2>
          <p className="text-gray-600 mb-6">
            OsteoApp vous permet de gérer efficacement vos patients, rendez-vous, 
            consultations et factures dans une interface intuitive et sécurisée.
          </p>
          {/* Ajoutez ici une image, une maquette ou d'autres éléments */}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;