import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { 
  Home, 
  Users, 
  Calendar, 
  FileText, 
  BarChart2, 
  Settings, 
  Book, 
  Share2, 
  Menu, 
  X, 
  LogOut,
  User,
  Bell,
  Shield,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { isAdmin } from '../utils/adminAuth';
import { isSubstitute, getLinkedOsteopathId } from '../utils/substituteAuth';
import { trackEvent } from '../lib/matomoTagManager';
import { trackEvent as trackGAEvent } from '../lib/googleAnalytics';

const DashboardLayout: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [userRole, setUserRole] = useState<string>('');
  const [linkedOsteopathName, setLinkedOsteopathName] = useState<string>('');

  // Track window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Déterminer le rôle de l'utilisateur et les informations de liaison
  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) return;
      
      if (isAdmin(user)) {
        setUserRole('admin');
      } else if (await isSubstitute(user)) {
        setUserRole('substitute');
        
        // Récupérer le nom de l'ostéopathe titulaire
        try {
          const linkedOsteopathId = await getLinkedOsteopathId(user);
          if (linkedOsteopathId) {
            const osteopathRef = doc(db, 'users', linkedOsteopathId);
            const osteopathDoc = await getDoc(osteopathRef);
            if (osteopathDoc.exists()) {
              const osteopathData = osteopathDoc.data();
              setLinkedOsteopathName(`${osteopathData.firstName} ${osteopathData.lastName}`);
            }
          }
        } catch (error) {
          console.error('Error getting linked osteopath name:', error);
        }
      } else {
        setUserRole('osteopath');
      }
    };
    
    checkUserRole();
  }, [user]);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      // Track logout event
      trackEvent('User', 'Logout', 'Dashboard');
      trackGAEvent('logout', {
        method: 'dashboard_menu'
      });
      
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    if (mobileMenuOpen) setMobileMenuOpen(false);
  };

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const isSectionCollapsed = (section: string) => {
    return collapsedSections[section] || false;
  };

  const navItems = [
    { path: '/', label: 'Tableau de bord', icon: <Home size={20} /> },
    { path: '/patients', label: 'Patients', icon: <Users size={20} /> },
    { path: '/consultations', label: 'Consultations & Agenda', icon: <Calendar size={20} /> },
    { path: '/invoices', label: 'Factures', icon: <FileText size={20} /> },
    { path: '/statistics', label: 'Statistiques', icon: <BarChart2 size={20} /> },
    { path: '/settings', label: 'Paramètres', icon: <Settings size={20} /> },
    { path: '/resources', label: 'Ressources', icon: <Book size={20} /> },
    { path: '/referral', label: 'Parrainage', icon: <Share2 size={20} /> },
  ];

  const isSmallScreen = windowWidth < 768;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top navigation */}
      <header className="bg-white sticky top-0 z-30 h-16 border-b border-gray-200">
        <div className="h-full flex items-center justify-between px-4">
          <div className="flex items-center space-x-4">
            <button 
              className="md:hidden p-2 text-gray-500 hover:text-gray-900 touch-target"
              onClick={toggleMobileMenu}
              aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="flex items-center">
              <img src="/Icon-logo-osteoapp-bleu.png" alt="OsteoApp Logo" width={24} height={24} className="mr-2" />
              <span className="ml-2 text-xl font-bold text-gray-900">OsteoApp</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            <button 
              className="p-2 text-gray-500 hover:text-gray-900 relative touch-target"
              aria-label="Notifications"
              onClick={() => {
                trackEvent('UI', 'Click', 'Notifications');
                trackGAEvent('click_notifications');
              }}
            >
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full"></span>
            </button>
            
            {/* Admin indicator */}
            {isAdmin(user) && (
              <div className="hidden sm:flex items-center bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                <Shield size={12} className="mr-1" />
                Admin
              </div>
            )}
            
            {/* Substitute indicator */}
            {userRole === 'substitute' && (
              <div className="hidden sm:flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                <User size={12} className="mr-1" />
                Remplaçant
              </div>
            )}
            
            <div className="relative">
              <button 
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 touch-target"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <span className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center">
                  <User size={16} />
                </span>
                <span className="hidden md:block text-sm font-medium truncate max-w-[120px]">
                  {user?.displayName || user?.email}
                </span>
                {userRole === 'substitute' && linkedOsteopathName && (
                  <div className="hidden md:block text-xs text-gray-500 truncate max-w-[120px]">
                    pour {linkedOsteopathName}
                  </div>
                )}
              </button>
              
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50 border border-gray-200">
                  {isAdmin(user) && (
                    <button 
                      onClick={() => {
                        trackEvent('Navigation', 'Admin Panel', 'From Dashboard');
                        trackGAEvent('navigate_to_admin', { source: 'user_menu' });
                        navigate('/admin');
                        setUserMenuOpen(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Shield size={16} className="mr-2" />
                      Administration
                    </button>
                  )}
                  <button 
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <LogOut size={16} className="mr-2" />
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar for desktop */}
        <aside className="hidden md:flex md:w-64 flex-col bg-white border-r border-gray-200 h-[calc(100vh-4rem)] sticky top-16">
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  `flex items-center px-4 py-3 text-sm font-medium rounded-lg ${
                    isActive 
                      ? 'bg-primary-50 text-primary-600' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
                onClick={() => {
                  trackEvent('Navigation', 'Menu Click', item.label);
                  trackGAEvent('navigate_menu', { 
                    destination: item.path,
                    menu_item: item.label
                  });
                }}
              >
                <span className="mr-3">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Mobile menu */}
        <div className={`nav-mobile ${mobileMenuOpen ? 'open' : 'closed'} md:hidden`}>
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
            <div className="flex items-center">
              <img src="/Icon-logo-osteoapp-bleu.png" alt="OsteoApp Logo" width={24} height={24} className="mr-2" />
              <span className="ml-2 text-xl font-bold text-gray-900">OsteoApp</span>
            </div>
            <button 
              className="p-2 text-gray-500 hover:text-gray-900 touch-target"
              onClick={closeMobileMenu}
              aria-label="Fermer le menu"
            >
              <X size={24} />
            </button>
          </div>
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  `flex items-center px-4 py-3 text-sm font-medium rounded-lg ${
                    isActive 
                      ? 'bg-primary-50 text-primary-600' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
                onClick={() => {
                  trackEvent('Navigation', 'Mobile Menu Click', item.label);
                  trackGAEvent('navigate_mobile_menu', { 
                    destination: item.path,
                    menu_item: item.label
                  });
                  closeMobileMenu();
                }}
              >
                <span className="mr-3">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-200">
            {isAdmin(user) && (
              <button 
                onClick={() => {
                  trackEvent('Navigation', 'Admin Panel', 'From Mobile Menu');
                  trackGAEvent('navigate_to_admin', { source: 'mobile_menu' });
                  navigate('/admin');
                  closeMobileMenu();
                }}
                className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 mb-2 touch-target"
              >
                <Shield size={20} className="mr-3" />
                Administration
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 touch-target"
            >
              <LogOut size={20} className="mr-3" />
              Déconnexion
            </button>
          </div>
        </div>

        {/* Main content */}
        <main 
          className="flex-1 overflow-y-auto p-4 md:p-6" 
          onClick={() => {
            setUserMenuOpen(false);
            if (isSmallScreen) {
              setMobileMenuOpen(false);
            }
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;