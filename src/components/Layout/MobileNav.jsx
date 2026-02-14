import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * ניווט תחתון לנייד - 5 עמודים
 */
function MobileNav() {
  const location = useLocation();

  const navLinks = [
    { path: '/dashboard', label: 'דשבורד', icon: '🏠' },
    { path: '/daily', label: 'יומי', icon: '📅' },
    { path: '/weekly', label: 'שבועי', icon: '📆' },
    { path: '/insights', label: 'תובנות', icon: '💡' },
    { path: '/settings', label: 'הגדרות', icon: '⚙️' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden z-40 glass-bottom safe-area-inset-bottom">
      <div className="flex justify-around items-center h-16 px-1">
        {navLinks.map(link => {
          const isActive = location.pathname === link.path;

          return (
            <Link
              key={link.path}
              to={link.path}
              className="flex flex-col items-center justify-center flex-1 py-1.5 relative"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-x-1 -top-0.5 h-0.5 bg-blue-500 rounded-full"
                  transition={{ type: 'spring', duration: 0.3 }}
                />
              )}
              <span className={`text-xl transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                {link.icon}
              </span>
              <span className={`text-[11px] mt-0.5 font-medium transition-colors ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}>
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileNav;
