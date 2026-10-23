import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showBackOnlineToast, setShowBackOnlineToast] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBackOnlineToast(true);
      const timer = setTimeout(() => setShowBackOnlineToast(false), 3000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBackOnlineToast(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (showBackOnlineToast) {
    return (
      <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded bg-emerald-700 text-white px-3 py-1.5 text-xs font-medium shadow-lg animate-fade-in">
        <Wifi className="w-3.5 h-3.5" />
        İnternet bağlantısı yeniden kuruldu.
      </div>
    );
  }

  if (isOnline) return null;

  return (
    <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded bg-amber-600 dark:bg-amber-700 text-white px-3 py-1.5 text-xs font-semibold shadow-lg">
      <WifiOff className="w-3.5 h-3.5 animate-pulse" />
      <span>Çevrimdışı Mod — Verileriniz yerel depolama ve masaüstü dosyasında güvenle saklanmaktadır.</span>
    </div>
  );
};
