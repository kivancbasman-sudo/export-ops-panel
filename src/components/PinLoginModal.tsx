import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Lock, KeyRound, Eye, EyeOff, ShieldAlert, ArrowRight, Clock, Calendar } from 'lucide-react';
import { SunMoonSwitch } from './ui/SunMoonSwitch';
import { PWAInstallButton } from './ui/PWAInstallButton';
import { OfflineIndicator } from './ui/OfflineIndicator';
import { AppLogo } from './ui/AppLogo';
import { getISOWeekNumber } from '../utils/calculations';

export function PinLoginModal() {
  const { unlockWithPin } = useAppStore();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Rate-limiting / brute-force protection
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const currentWeek = getISOWeekNumber(now);
  const todayFormatted = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);

  useEffect(() => {
    inputRef.current?.focus();
  }, [lockoutSeconds]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (lockoutSeconds > 0 || isSubmitting) return;

    if (!pin.trim()) {
      setErrorMessage('Lütfen PIN kodunu giriniz.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await unlockWithPin(pin.trim(), rememberMe);
      if (!res.success) {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        if (nextAttempts >= 5) {
          setLockoutSeconds(30);
          setErrorMessage('Çok sayıda hatalı giriş yapıldı. Güvenlik sebebiyle 30 saniye kilitlendi.');
        } else {
          setErrorMessage(res.message || 'Hatalı PIN kodu! Lütfen tekrar deneyin.');
        }
        setPin('');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Giriş yapılırken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-300 dark:bg-[#141210] text-slate-900 dark:text-stone-100 flex flex-col font-sans transition-colors duration-200 overflow-hidden">
      
      {/* Top Application Header - Identical to Main Layout for Seamless Visual Continuity */}
      <header className="bg-slate-800 dark:bg-[#1c1917] text-white h-12 flex items-center px-3 sm:px-4 shrink-0 shadow-md z-10 border-b border-transparent dark:border-stone-800 select-none justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2.5">
          <AppLogo className="w-6 h-6 shrink-0" />
          <h1 className="text-sm font-bold tracking-wider whitespace-nowrap">İHRACAT OPERASYON PANELİ</h1>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300">
            <Lock className="w-3 h-3 text-amber-400" />
            Güvenlik Girişi
          </span>
        </div>

        {/* Right side controls: Theme switch, Date, PWA install */}
        <div className="flex items-center gap-2 sm:gap-3">
          <PWAInstallButton />
          
          {/* Sun / Moon Switch - Theme can be toggled directly from the login screen */}
          <SunMoonSwitch showText={false} />

          {/* Calendar & ISO Week Badge */}
          <div 
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 bg-slate-900/70 dark:bg-stone-950/90 border border-slate-700 dark:border-stone-800 rounded text-xs shadow-xs shrink-0 whitespace-nowrap"
            title={`Bugün: ${todayFormatted} (ISO ${currentWeek}. Hafta)`}
          >
            <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden md:inline text-slate-300 dark:text-stone-300 font-medium">{todayFormatted}</span>
            <span className="hidden md:inline text-slate-500 dark:text-stone-600">|</span>
            <span className="font-bold text-amber-300 tracking-wide bg-amber-950/70 border border-amber-800/70 px-1.5 py-0.5 rounded text-[11px]">
              {currentWeek}. Hafta
            </span>
          </div>
        </div>
      </header>

      {/* Main Centered Login Area */}
      <main className="flex-1 min-h-0 p-4 flex items-center justify-center overflow-auto">
        <div className="w-full max-w-md bg-white dark:bg-stone-900 border border-slate-400 dark:border-stone-800 rounded-lg shadow-xl dark:shadow-2xl overflow-hidden transition-colors duration-200 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Top Header Banner */}
          <div className="bg-slate-100 dark:bg-stone-800/80 border-b border-slate-300 dark:border-stone-700 px-6 py-5 text-center relative transition-colors duration-200">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mx-auto mb-3 shadow-sm p-2 relative">
              <AppLogo className="w-full h-full" />
              <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-1 rounded-full shadow-md">
                <Lock className="w-3 h-3 stroke-[2.5]" />
              </div>
            </div>
            <h2 className="text-sm sm:text-base font-bold tracking-wide text-slate-900 dark:text-stone-100">
              GÜVENLİ ERİŞİM DOĞRULAMA
            </h2>
            <p className="text-xs text-slate-600 dark:text-stone-400 mt-1">
              Ticari ve operasyonel veriler için PIN kodu doğrulaması
            </p>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            
            {errorMessage && (
              <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 rounded text-xs text-red-800 dark:text-red-200 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed flex-1 font-medium">{errorMessage}</div>
              </div>
            )}

            {lockoutSeconds > 0 ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded text-center space-y-2">
                <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400 mx-auto animate-pulse" />
                <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">Güvenlik Bekleme Süresi</p>
                <div className="text-2xl font-mono font-bold text-amber-700 dark:text-amber-300">
                  00:{String(lockoutSeconds).padStart(2, '0')}
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-400/80">Lütfen süre bitene kadar bekleyin.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-stone-300">
                  Erişim PIN Kodu
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-stone-500">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    ref={inputRef}
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    disabled={lockoutSeconds > 0 || isSubmitting}
                    placeholder="PIN kodunu giriniz..."
                    className="w-full h-11 pl-10 pr-10 text-sm font-mono tracking-wider bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 focus:border-amber-500 rounded text-slate-900 dark:text-stone-100 placeholder-slate-400 dark:placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-stone-200 focus:outline-none cursor-pointer"
                    tabIndex={-1}
                    title={showPin ? 'PIN Kodunu Gizle' : 'PIN Kodunu Göster'}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-stone-400 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-white dark:bg-stone-950 border-slate-300 dark:border-stone-700 text-amber-600 focus:ring-amber-500"
                />
                <span>Bu cihazda oturumu hatırla</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={lockoutSeconds > 0 || isSubmitting || !pin.trim()}
              className="w-full h-11 mt-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-200 dark:disabled:bg-stone-800 disabled:text-slate-400 dark:disabled:text-stone-600 disabled:cursor-not-allowed text-white font-bold text-sm rounded shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isSubmitting ? 'Kontrol Ediliyor...' : 'Panele Giriş Yap'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

        </div>
      </main>

      {/* Offline Status Toast */}
      <OfflineIndicator />
    </div>
  );
}
