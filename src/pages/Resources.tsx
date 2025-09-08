import React, { useState } from 'react';
import { 
  Search, 
  Download, 
  ExternalLink, 
  Star, 
  CheckSquare, 
  FileText, 
  Video, 
  Users, 
  Calendar, 
  Mail, 
  Calculator, 
  Shield, 
  Briefcase, 
  Heart, 
  TrendingUp, 
  MapPin, 
  Globe, 
  Camera, 
  BookOpen, 
  Award, 
  MessageCircle, 
  Zap,
  Crown,
  Play,
  UserPlus,
  Building
} from 'lucide-react';
import { Button } from '../components/ui/Button';

const Resources: React.FC = () => {
  const [activeTab, setActiveTab] = useState('accueil');
  const [searchTerm, setSearchTerm] = useState('');

  const tabs = [
    { id: 'accueil', label: 'Accueil', icon: <Star size={16} /> },
    { id: 'installation', label: 'Installation & démarrage', icon: <UserPlus size={16} /> },
    { id: 'communication', label: 'Communication & développement', icon: <TrendingUp size={16} /> },
    { id: 'bien-etre', label: 'Vie & bien-être', icon: <Heart size={16} /> },
    { id: 'outils', label: 'Outils pratiques', icon: <Briefcase size={16} /> },
    { id: 'premium', label: 'Premium', icon: <Crown size={16} /> }
  ];

  const featuredResource = {
    title: "Guide complet d'installation 2024",
    description: "Le guide le plus téléchargé avec toutes les étapes pour s'installer en libéral",
    downloads: 1247,
    icon: <BookOpen size={24} className="text-primary-600" />,
    type: "PDF - 45 pages"
  };

  const installationResources = [
    {
      title: "Checklist démarches administratives",
      description: "Liste interactive de toutes les démarches obligatoires (URSSAF, assurances, mutuelles)",
      icon: <CheckSquare size={20} className="text-green-600" />,
      type: "Checklist interactive",
      action: "Ouvrir",
      popular: true
    },
    {
      title: "Modèles de documents patients",
      description: "Consentement éclairé, fiche patient, CGV - Conformes RGPD",
      icon: <FileText size={20} className="text-blue-600" />,
      type: "Pack PDF",
      action: "Télécharger"
    },
    {
      title: "Guide d'aménagement du cabinet",
      description: "Ergonomie, mobilier, organisation spatiale pour un cabinet fonctionnel",
      icon: <Building size={20} className="text-purple-600" />,
      type: "Guide PDF",
      action: "Télécharger"
    },
    {
      title: "Aide à la fixation des tarifs",
      description: "Comparatif régional et conseils éthiques pour fixer vos tarifs",
      icon: <Calculator size={20} className="text-orange-600" />,
      type: "Outil interactif",
      action: "Utiliser"
    }
  ];

  const communicationResources = [
    {
      title: "Guide Google Business Profile",
      description: "Optimisez votre visibilité locale et attirez plus de patients",
      icon: <Globe size={20} className="text-red-600" />,
      type: "Guide PDF",
      action: "Télécharger"
    },
    {
      title: "Kit marketing local",
      description: "Conseils réseaux sociaux, flyers, partenariats avec médecins",
      icon: <TrendingUp size={20} className="text-green-600" />,
      type: "Kit complet",
      action: "Télécharger",
      popular: true
    },
    {
      title: "Guide SEO local",
      description: "Étapes simples pour être trouvé sur Google dans votre ville",
      icon: <MapPin size={20} className="text-blue-600" />,
      type: "Guide pratique",
      action: "Ouvrir"
    },
    {
      title: "Ressources patients prêtes à l'emploi",
      description: "PDF éducatifs, visuels Instagram, posts Facebook",
      icon: <Camera size={20} className="text-pink-600" />,
      type: "Pack créatif",
      action: "Télécharger"
    }
  ];

  const bienEtreResources = [
    {
      title: "Gestion du stress du praticien",
      description: "Articles et vidéos courtes pour gérer le stress professionnel",
      icon: <Heart size={20} className="text-red-600" />,
      type: "Articles + Vidéos",
      action: "Consulter"
    },
    {
      title: "Ergonomie ostéopathique",
      description: "Conseils pour prévenir les TMS et préserver votre corps",
      icon: <Zap size={20} className="text-yellow-600" />,
      type: "Guide pratique",
      action: "Télécharger",
      popular: true
    },
    {
      title: "Communauté privée OsteoApp",
      description: "Rejoignez notre communauté d'ostéopathes pour échanger et s'entraider",
      icon: <Users size={20} className="text-purple-600" />,
      type: "Communauté",
      action: "Rejoindre"
    },
    {
      title: "Formations continues",
      description: "MOOC, congrès, certifications - Restez à jour dans votre pratique",
      icon: <Award size={20} className="text-blue-600" />,
      type: "Catalogue",
      action: "Explorer"
    }
  ];

  const outilsResources = [
    {
      title: "Modèles d'emails patients",
      description: "Templates de confirmation, suivi, remerciements personnalisables",
      icon: <Mail size={20} className="text-blue-600" />,
      type: "Pack emails",
      action: "Télécharger"
    },
    {
      title: "Guide comptabilité simplifiée",
      description: "Facturation, charges, déclarations avec simulateur intégré",
      icon: <Calculator size={20} className="text-green-600" />,
      type: "Guide + Outil",
      action: "Ouvrir",
      popular: true
    },
    {
      title: "Calendrier professionnel",
      description: "Agenda des congrès, formations et événements ostéopathiques",
      icon: <Calendar size={20} className="text-purple-600" />,
      type: "Calendrier",
      action: "Consulter"
    },
    {
      title: "Kit RGPD complet",
      description: "Checklist, modèles de mentions légales et registre des traitements",
      icon: <Shield size={20} className="text-red-600" />,
      type: "Kit juridique",
      action: "Télécharger"
    }
  ];

  const premiumResources = [
    {
      title: "Vidéos pédagogiques",
      description: "Mini-formations sur l'installation, l'organisation et l'acquisition patients",
      icon: <Video size={20} className="text-red-600" />,
      type: "Vidéos HD",
      action: "Regarder",
      premium: true
    },
    {
      title: "Webinaires experts",
      description: "Sessions avec comptable, avocat et ostéopathes confirmés",
      icon: <MessageCircle size={20} className="text-blue-600" />,
      type: "Webinaires live",
      action: "S'inscrire",
      premium: true
    },
    {
      title: "Kits de communication pro",
      description: "Affiches, flyers, posts réseaux sociaux personnalisables",
      icon: <Camera size={20} className="text-purple-600" />,
      type: "Kit design",
      action: "Télécharger",
      premium: true
    }
  ];

  const allResources = [
    ...installationResources.map(r => ({ ...r, category: 'installation' })),
    ...communicationResources.map(r => ({ ...r, category: 'communication' })),
    ...bienEtreResources.map(r => ({ ...r, category: 'bien-etre' })),
    ...outilsResources.map(r => ({ ...r, category: 'outils' })),
    ...premiumResources.map(r => ({ ...r, category: 'premium' }))
  ];

  const filteredResources = allResources.filter(resource =>
    resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    resource.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const ResourceCard: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    type: string;
    action: string;
    popular?: boolean;
    premium?: boolean;
  }> = ({ title, description, icon, type, action, popular, premium }) => (
    <div className="card hover:shadow-card-hover transition-all duration-200 relative">
      {popular && (
        <div className="absolute -top-2 -right-2 bg-accent-500 text-white px-2 py-1 rounded-full text-xs font-medium">
          Populaire
        </div>
      )}
      {premium && (
        <div className="absolute -top-2 -right-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center">
          <Crown size={10} className="mr-1" />
          Premium
        </div>
      )}
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600 text-sm mb-3">{description}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{type}</span>
            <Button 
              variant={premium ? "primary" : "outline"} 
              size="sm"
              rightIcon={action === "Télécharger" ? <Download size={14} /> : <ExternalLink size={14} />}
            >
              {action}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAccueil = () => (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Toutes les ressources pour développer et mieux vivre votre activité d'ostéopathe.
        </h1>
        
        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
          <Button 
            variant="primary" 
            size="lg"
            leftIcon={<UserPlus size={20} />}
            onClick={() => setActiveTab('installation')}
            fullWidth
          >
            Je m'installe
          </Button>
          <Button 
            variant="outline" 
            size="lg"
            leftIcon={<TrendingUp size={20} />}
            onClick={() => setActiveTab('communication')}
            fullWidth
          >
            J'optimise mon cabinet
          </Button>
        </div>

        {/* Search Bar */}
        <div className="max-w-md mx-auto">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              className="input pl-10"
              placeholder="Rechercher une ressource (RGPD, comptabilité, patients...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Featured Resource */}
      <div className="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-xl p-6 border border-primary-200">
        <div className="flex items-center space-x-2 mb-3">
          <Star size={20} className="text-accent-500" />
          <span className="text-sm font-medium text-accent-600">Ressource du mois</span>
        </div>
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            {featuredResource.icon}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{featuredResource.title}</h3>
            <p className="text-gray-700 mb-3">{featuredResource.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {featuredResource.downloads} téléchargements • {featuredResource.type}
              </span>
              <Button variant="primary" leftIcon={<Download size={16} />}>
                Télécharger gratuitement
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Results */}
      {searchTerm && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Résultats de recherche ({filteredResources.length})
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {filteredResources.map((resource, index) => (
              <ResourceCard key={index} {...resource} />
            ))}
          </div>
          {filteredResources.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Search size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Aucune ressource trouvée pour "{searchTerm}"</p>
            </div>
          )}
        </div>
      )}

      {/* Quick Access Categories */}
      {!searchTerm && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div 
            className="card cursor-pointer hover:shadow-card-hover transition-all duration-200"
            onClick={() => setActiveTab('installation')}
          >
            <div className="flex items-center space-x-3 mb-3">
              <UserPlus size={24} className="text-primary-600" />
              <h3 className="text-lg font-medium text-gray-900">Installation & démarrage</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Tout pour bien démarrer votre activité libérale
            </p>
            <div className="text-primary-600 text-sm font-medium">
              {installationResources.length} ressources →
            </div>
          </div>

          <div 
            className="card cursor-pointer hover:shadow-card-hover transition-all duration-200"
            onClick={() => setActiveTab('communication')}
          >
            <div className="flex items-center space-x-3 mb-3">
              <TrendingUp size={24} className="text-secondary-600" />
              <h3 className="text-lg font-medium text-gray-900">Communication & développement</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Développez votre patientèle et votre visibilité
            </p>
            <div className="text-primary-600 text-sm font-medium">
              {communicationResources.length} ressources →
            </div>
          </div>

          <div 
            className="card cursor-pointer hover:shadow-card-hover transition-all duration-200"
            onClick={() => setActiveTab('bien-etre')}
          >
            <div className="flex items-center space-x-3 mb-3">
              <Heart size={24} className="text-red-600" />
              <h3 className="text-lg font-medium text-gray-900">Vie & bien-être</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Prenez soin de vous pour mieux soigner
            </p>
            <div className="text-primary-600 text-sm font-medium">
              {bienEtreResources.length} ressources →
            </div>
          </div>

          <div 
            className="card cursor-pointer hover:shadow-card-hover transition-all duration-200"
            onClick={() => setActiveTab('outils')}
          >
            <div className="flex items-center space-x-3 mb-3">
              <Briefcase size={24} className="text-blue-600" />
              <h3 className="text-lg font-medium text-gray-900">Outils pratiques</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Templates, guides et outils du quotidien
            </p>
            <div className="text-primary-600 text-sm font-medium">
              {outilsResources.length} ressources →
            </div>
          </div>

          <div 
            className="card cursor-pointer hover:shadow-card-hover transition-all duration-200"
            onClick={() => setActiveTab('premium')}
          >
            <div className="flex items-center space-x-3 mb-3">
              <Crown size={24} className="text-purple-600" />
              <h3 className="text-lg font-medium text-gray-900">Premium</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Formations avancées et contenus exclusifs
            </p>
            <div className="text-primary-600 text-sm font-medium">
              {premiumResources.length} ressources →
            </div>
          </div>

          <div className="card bg-gradient-to-br from-primary-50 to-secondary-50 border-primary-200">
            <div className="flex items-center space-x-3 mb-3">
              <MessageCircle size={24} className="text-primary-600" />
              <h3 className="text-lg font-medium text-gray-900">Besoin d'aide ?</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Notre équipe est là pour vous accompagner
            </p>
            <Button variant="primary" size="sm" leftIcon={<Mail size={14} />}>
              Nous contacter
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderCategoryResources = (resources: any[], categoryTitle: string) => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{categoryTitle}</h2>
        <Button variant="outline" onClick={() => setActiveTab('accueil')}>
          Retour à l'accueil
        </Button>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {resources.map((resource, index) => (
          <ResourceCard key={index} {...resource} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="min-h-[600px]">
        {activeTab === 'accueil' && renderAccueil()}
        {activeTab === 'installation' && renderCategoryResources(installationResources, 'Installation & démarrage')}
        {activeTab === 'communication' && renderCategoryResources(communicationResources, 'Communication & développement')}
        {activeTab === 'bien-etre' && renderCategoryResources(bienEtreResources, 'Vie & bien-être du praticien')}
        {activeTab === 'outils' && renderCategoryResources(outilsResources, 'Outils pratiques')}
        {activeTab === 'premium' && renderCategoryResources(premiumResources, 'Premium')}
      </div>
    </div>
  );
};

export default Resources;