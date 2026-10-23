import React, { useState } from 'react';
import { Plane, Settings, List, Calculator, Calendar, HardDrive, Lock, AlertTriangle, AlertCircle, Download, RotateCcw, Trash2, X, FileSpreadsheet } from 'lucide-react';
import { getISOWeekNumber } from '../utils/calculations';
import { useAppStore } from '../store/useAppStore';
import { SunMoonSwitch } from './ui/SunMoonSwitch';
import { PWAInstallButton } from './ui/PWAInstallButton';
import { OfflineIndicator } from './ui/OfflineIndicator';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const {
    localFileState,
    lockApp,
    isStorageQuotaExceeded,
    dismissStorageQuotaWarning,
    exportDataNow,
    lastDeletedNotice,
    undoLastDelete,
    dismissDeletedNotice,
  } = useAppStore();
  const [justBackedUp, setJustBackedUp] = useState(false);
  const now = new Date();
  const currentWeek = getISOWeekNumber(now);
  const todayFormatted = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);

  return (
    <div className="h-screen h-[100dvh] bg-slate-300 dark:bg-[#141210] text-slate-900 dark:text-stone-100 flex flex-col font-sans transition-colors duration-200 overflow-hidden">
      <header className="bg-slate-800 dark:bg-[#1c1917] text-white h-12 flex items-center px-2 sm:px-3 lg:px-4 shrink-0 shadow-md z-10 border-b border-transparent dark:border-stone-800 overflow-x-auto no-scrollbar select-none gap-2">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2 mr-1 sm:mr-3 lg:mr-4 shrink-0">
          <Plane className="w-5 h-5 text-amber-400 shrink-0" />
          <h1 className="text-sm font-bold tracking-wider hidden xl:inline whitespace-nowrap">İHRACAT OPERASYON PANELİ</h1>
          <h1 className="text-sm font-bold tracking-wider hidden sm:inline xl:hidden whitespace-nowrap">İHRACAT PANELİ</h1>
          <h1 className="text-sm font-bold tracking-wider sm:hidden whitespace-nowrap">İHRACAT</h1>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center h-full gap-0.5 shrink-0">
          <button
            onClick={() => onTabChange('shipments')}
            className={`h-full px-1.5 sm:px-2 md:px-2.5 flex items-center gap-1 sm:gap-1.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 transition-none cursor-pointer ${
              activeTab === 'shipments' ? 'border-blue-400 dark:border-amber-400 bg-white/10 dark:bg-amber-500/15 dark:text-amber-200' : 'border-transparent hover:bg-white/5 dark:text-stone-300 dark:hover:text-stone-100'
            }`}
            title="Sevkiyatlar Listesi"
          >
            <List className="w-3.5 h-3.5 shrink-0" />
            <span>Sevkiyatlar</span>
          </button>
          <button
            onClick={() => onTabChange('calculator')}
            className={`h-full px-1.5 sm:px-2 md:px-2.5 flex items-center gap-1 sm:gap-1.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 transition-none cursor-pointer ${
              activeTab === 'calculator' ? 'border-blue-400 dark:border-amber-400 bg-white/10 dark:bg-amber-500/15 dark:text-amber-200' : 'border-transparent hover:bg-white/5 dark:text-stone-300 dark:hover:text-stone-100'
            }`}
            title="Navlun Hesaplama"
          >
            <Calculator className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden 2xl:inline">Navlun Hesaplama</span>
            <span className="2xl:hidden">Navlun</span>
          </button>
          <button
            onClick={() => onTabChange('packing-list')}
            className={`h-full px-1.5 sm:px-2 md:px-2.5 flex items-center gap-1 sm:gap-1.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 transition-none cursor-pointer ${
              activeTab === 'packing-list' ? 'border-blue-400 dark:border-amber-400 bg-white/10 dark:bg-amber-500/15 dark:text-amber-200' : 'border-transparent hover:bg-white/5 dark:text-stone-300 dark:hover:text-stone-100'
            }`}
            title="Kargo & Çeki Listesi Dönüştürücü"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden 2xl:inline">Çeki Listesi Dönüştürücü</span>
            <span className="2xl:hidden">Çeki Listesi</span>
          </button>
          <button
            onClick={() => onTabChange('settings')}
            className={`h-full px-1.5 sm:px-2 md:px-2.5 flex items-center gap-1 sm:gap-1.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 transition-none cursor-pointer ${
              activeTab === 'settings' ? 'border-blue-400 dark:border-amber-400 bg-white/10 dark:bg-amber-500/15 dark:text-amber-200' : 'border-transparent hover:bg-white/5 dark:text-stone-300 dark:hover:text-stone-100'
            }`}
            title="Ayarlar & Şablonlar"
          >
            <Settings className="w-3.5 h-3.5 shrink-0" />
            <span>Ayarlar</span>
          </button>
        </nav>

        {/* Dynamic spacer pushing right controls */}
        <div className="flex-1 min-w-[4px]" />

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
          {/* Quick JSON Backup Button */}
          <button
            onClick={() => {
              exportDataNow('sevkiyat_tam_yedek');
              setJustBackedUp(true);
              setTimeout(() => setJustBackedUp(false), 2500);
            }}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 bg-slate-700/80 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 dark:bg-stone-800/90 dark:hover:bg-stone-800 dark:border-stone-700 rounded text-xs text-slate-100 dark:text-stone-100 transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-xs"
            title="Tüm verilerin (sevkiyatlar, şablonlar, ayarlar) tam JSON yedeğini bilgisayara indir"
          >
            <Download className="w-3.5 h-3.5 text-blue-400 dark:text-amber-400 shrink-0" />
            <span className="hidden sm:inline font-semibold">{justBackedUp ? 'İndirildi ✓' : 'JSON Yedek'}</span>
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Sun - Moon Dark Mode Switch */}
          <SunMoonSwitch />

          {/* Local File Status Display: Error / Connected / Disconnected */}
          {localFileState.status === 'error' ? (
            <button
              onClick={() => onTabChange('settings')}
              className="flex items-center gap-1.5 px-2 py-1 bg-red-950 hover:bg-red-900 border border-red-600 rounded text-xs text-red-200 animate-pulse cursor-pointer shrink-0"
              title={`Masaüstü Dosya Kayıt Uyarısı:\n${localFileState.errorMessage || 'Yazma izni kesildi'}\n(Ayarları açıp yeniden bağlanmak için tıklayın)`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="font-bold text-[11px] whitespace-nowrap">Yedek Hatası!</span>
            </button>
          ) : localFileState.isConnected ? (
            <button
              onClick={() => onTabChange('settings')}
              className="flex items-center gap-1.5 px-2 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/70 rounded text-xs shadow-xs text-emerald-300 transition-colors cursor-pointer shrink-0"
              title={`Masaüstü Dosyası Bağlı:\n• Dosya: ${localFileState.fileName}\n• Son Otomatik Kayıt: ${localFileState.lastSavedAt || '-'}\n• Her değişiklik masaüstündeki bu dosyaya anında kaydedilir.\n(Ayarları açmak için tıklayın)`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden 2xl:inline text-[11px] font-mono text-emerald-200 max-w-[120px] truncate">{localFileState.fileName}</span>
              <span className="hidden sm:inline text-[11px] font-bold text-emerald-300 whitespace-nowrap">Yerel Canlı</span>
            </button>
          ) : (
            <button
              onClick={() => onTabChange('settings')}
              className="flex items-center gap-1 px-2 py-1 bg-amber-950/50 hover:bg-amber-900/70 border border-amber-700/60 rounded text-xs text-amber-300 transition-colors cursor-pointer shrink-0"
              title="Masaüstü fiziksel JSON dosyası bağlı değil. Herhangi bir çökmede veri kaybetmemek için masaüstü dosyanızı bağlayın."
            >
              <HardDrive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden sm:inline text-[11px] font-medium">Masaüstü Bağla</span>
            </button>
          )}

          <div 
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 bg-slate-900/70 dark:bg-stone-950/90 border border-slate-700 dark:border-stone-800 rounded text-xs shadow-xs shrink-0 whitespace-nowrap"
            title={`Bugün: ${todayFormatted} (ISO ${currentWeek}. Hafta)`}
          >
            <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden lg:inline text-slate-300 dark:text-stone-300 font-medium">{todayFormatted}</span>
            <span className="hidden lg:inline text-slate-500 dark:text-stone-600">|</span>
            <span className="font-bold text-amber-300 tracking-wide bg-amber-950/70 border border-amber-800/70 px-1.5 py-0.5 rounded text-[11px]">
              {currentWeek}. Hafta
            </span>
          </div>

          <button
            onClick={lockApp}
            className="flex items-center gap-1 px-2 py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 hover:text-red-100 rounded text-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            title="Paneli Kilitle (PIN Kodu İster)"
          >
            <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="hidden md:inline font-medium">Kilitle</span>
          </button>
        </div>
      </header>

      {/* Quota Exceeded Warning Banner */}
      {isStorageQuotaExceeded && (
        <div className="bg-red-700 text-white px-4 py-2 text-xs flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 animate-bounce text-amber-300" />
            <span>
              <strong>DİKKAT: Tarayıcı Depolama Sınırı Aşıldı!</strong> Tarayıcınız yeni sevkiyatları hafızaya alamıyor olabilir. Veri kaybı yaşamamak için lütfen <strong>Ayarlar &gt; Masaüstü Dosyası</strong> bağlayın veya eski kayıtları arşivleyin.
            </span>
          </div>
          <button 
            onClick={dismissStorageQuotaWarning} 
            className="font-bold text-white hover:text-red-200 px-2 py-0.5 cursor-pointer text-sm"
            title="Uyarıyı Kapat"
          >
            ×
          </button>
        </div>
      )}

      <main className="flex-1 min-h-0 p-2 sm:p-3 md:p-4 flex justify-center min-w-0 w-full overflow-hidden">
        <div className="w-full max-w-[1180px] min-w-0 h-full min-h-0 flex flex-col">
          {children}
        </div>
      </main>

      {/* Offline Status Toast */}
      <OfflineIndicator />

      {/* Undo Delete Toast */}
      {lastDeletedNotice && (
        <div 
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-slate-900 dark:bg-stone-900 text-white px-3.5 py-2.5 rounded-md shadow-2xl border border-slate-700 dark:border-stone-700 animate-in fade-in slide-in-from-bottom-3"
        >
          <div className="flex items-center gap-2 text-xs">
            <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              &ldquo;<strong className="font-semibold text-amber-300">{lastDeletedNotice.title}</strong>&rdquo; çöp kutusuna taşındı.
            </span>
          </div>
          <div className="flex items-center gap-1.5 ml-2 border-l border-slate-700 dark:border-stone-700 pl-2.5">
            <button
              type="button"
              onClick={undoLastDelete}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Geri Al</span>
            </button>
            <button
              type="button"
              onClick={dismissDeletedNotice}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
              title="Kapat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
