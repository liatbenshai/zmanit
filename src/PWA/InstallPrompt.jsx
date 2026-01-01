import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../UI/Button';
import Modal from '../UI/Modal';
import toast from 'react-hot-toast';

/**
 * רכיב להצגת הודעה להתקנת האפליקציה כ-PWA
 */
function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // בדיקה אם האפליקציה כבר מותקנת
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // בדיקת סוג מכשיר
    const userAgent = navigator.userAgent || navigator.vendor;
    const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    const isAndroidDevice = /android/i.test(userAgent);
    
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    // בדיקה אם כבר דחינו את ההודעה
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed = (new Date() - dismissedDate) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Android Chrome - beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // הצג אחרי 2 שניות
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS - הצג הוראות אחרי 3 שניות
    if (isIOSDevice) {
      setTimeout(() => setShowPrompt(true), 3000);
    }

    // האזנה להתקנה מוצלחת
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      toast.success('🎉 האפליקציה הותקנה בהצלחה!');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Android Chrome
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast.success('✅ האפליקציה מותקנת!');
        setShowPrompt(false);
      }
      
      setDeferredPrompt(null);
    } else if (isIOS) {
      // iOS - הצג מודל עם הוראות
      setShowIOSModal(true);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
  };

  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg safe-area-inset-top"
        >
          <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">📱</span>
              </div>
              <div>
                <p className="font-bold text-sm">התקיני את האפליקציה</p>
                <p className="text-xs opacity-90">
                  גישה מהירה מהמסך הראשי
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleInstall}
                size="sm"
                className="bg-white text-blue-600 hover:bg-gray-100 font-bold px-4"
              >
                {isIOS ? 'איך?' : '✓ התקן'}
              </Button>
              <button
                onClick={handleDismiss}
                className="text-white/80 hover:text-white text-2xl px-2"
                aria-label="סגור"
              >
                ×
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* מודל הוראות iOS */}
      <Modal
        isOpen={showIOSModal}
        onClose={() => setShowIOSModal(false)}
        title="התקנה ב-iPhone/iPad"
      >
        <div className="space-y-4 text-right">
          <p className="text-gray-600 dark:text-gray-400">
            כדי להתקין את האפליקציה במכשיר Apple:
          </p>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-2xl">1️⃣</span>
              <div>
                <p className="font-medium">לחצי על כפתור השיתוף</p>
                <p className="text-sm text-gray-500">
                  הכפתור בתחתית הדפדפן (Safari) - מרובע עם חץ למעלה
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-2xl">2️⃣</span>
              <div>
                <p className="font-medium">גללי למטה ובחרי "הוסף למסך הבית"</p>
                <p className="text-sm text-gray-500">
                  Add to Home Screen
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-2xl">3️⃣</span>
              <div>
                <p className="font-medium">לחצי "הוסף"</p>
                <p className="text-sm text-gray-500">
                  האפליקציה תופיע במסך הבית שלך
                </p>
              </div>
            </div>
          </div>
          
          <div className="pt-4 flex justify-end">
            <Button onClick={() => setShowIOSModal(false)}>
              הבנתי!
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default InstallPrompt;

