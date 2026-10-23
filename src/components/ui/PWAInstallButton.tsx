import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-xs transition-colors shadow-2xs cursor-pointer shrink-0 whitespace-nowrap"
        title="Uygulamayı Bilgisayara / Masaüstüne Yükle (PWA)"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Uygulamayı Yükle</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1 px-2 py-1 border border-slate-600 dark:border-stone-600 text-slate-300 dark:text-stone-300 hover:bg-slate-700/60 rounded text-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          title="iPhone / iPad Ana Ekrana Ekle"
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Ana Ekrana Ekle</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-lg bg-white dark:bg-[#1c1917] border border-slate-300 dark:border-stone-700 p-5 shadow-2xl text-slate-800 dark:text-stone-100">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 dark:border-stone-800">
                <h3 className="text-sm font-bold text-blue-600 dark:text-amber-400 flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  iPhone / iPad Kurulumu
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-slate-600 dark:text-stone-400 dark:hover:text-white p-1 rounded hover:bg-slate-100 dark:hover:bg-stone-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-600 dark:text-stone-300 leading-relaxed mb-4">
                1. Safari alt çubuğundaki <strong className="text-slate-900 dark:text-stone-100">Paylaş (Kare ve yukarı ok)</strong> simgesine dokunun.<br />
                2. Aşağı kaydırıp <strong className="text-slate-900 dark:text-stone-100">"Ana Ekrana Ekle"</strong> seçeneğini seçin.<br />
                3. Sağ üstteki <strong className="text-slate-900 dark:text-stone-100">Ekle</strong> butonuna basarak doğrudan uygulama gibi kullanın.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 dark:bg-amber-600 dark:hover:bg-amber-500 text-white font-bold rounded text-xs transition-colors shadow-xs"
              >
                Anladım
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
