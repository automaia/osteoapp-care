import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook to save and restore scroll position
 */
export function useScrollPosition() {
  const { pathname } = useLocation();
  const scrollPositions = useRef<Record<string, number>>({});

  // Save scroll position when navigating away
  useEffect(() => {
    const handleScroll = () => {
      scrollPositions.current[pathname] = window.scrollY;
    };

    // Save initial position
    scrollPositions.current[pathname] = window.scrollY;

    // Add scroll event listener
    window.addEventListener('scroll', handleScroll);

    // Restore scroll position
    const savedPosition = scrollPositions.current[pathname];
    if (savedPosition !== undefined) {
      window.scrollTo(0, savedPosition);
    }

    return () => {
      // Save final position before unmounting
      scrollPositions.current[pathname] = window.scrollY;
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pathname]);

  // Function to manually save current scroll position
  const saveScrollPosition = () => {
    scrollPositions.current[pathname] = window.scrollY;
  };

  // Function to manually restore saved scroll position
  const restoreScrollPosition = () => {
    const savedPosition = scrollPositions.current[pathname];
    if (savedPosition !== undefined) {
      window.scrollTo(0, savedPosition);
    }
  };

  return { saveScrollPosition, restoreScrollPosition };
}

export default useScrollPosition;