import React from 'react';
import { Clock, Zap, Coins, BarChart3, ChevronRight, X, Sparkles } from 'lucide-react';
import { AiConversionRecord } from '../../types/aiStats';

interface AiMetricsCardProps {
  record: AiConversionRecord;
  onOpenStatsModal: () => void;
  onDismiss?: () => void;
}

export const AiMetricsCard: React.FC<AiMetricsCardProps> = ({
  record,
  onOpenStatsModal,
  onDismiss,
}) => {
  const durationSec = (record.durationMs / 1000).toFixed(2);
  const costUsdFormatted = record.costUsd < 0.0001
    ? `$${record.costUsd.toFixed(6)}`
    : `$${record.costUsd.toFixed(5)}`;
  const costTryFormatted = `${record.costTry.toFixed(3)} ₺`;

  return (
    <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50/90 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border border-blue-200/80 dark:border-amber-800/50 rounded-lg p-3 sm:p-3.5 shadow-xs transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Title & Quick Status */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-blue-600 dark:bg-amber-600 text-white shadow-xs shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-stone-100 uppercase tracking-wide">
                AI Dönüştürme Raporu
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-100 dark:bg-stone-800 text-blue-800 dark:text-amber-300 border border-blue-200 dark:border-stone-700">
                {record.modelUsed || 'Gemini'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-stone-400 mt-0.5">
              İşlem tamamlandı • {record.blocksCount} blok, {record.rowsCount} satır çeki listesi üretildi
            </p>
          </div>
        </div>

        {/* Center: Key Metrics Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Duration */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white dark:bg-stone-800 border border-slate-200 dark:border-stone-700 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-amber-400 shrink-0" />
            <span className="text-slate-600 dark:text-stone-400 text-[11px]">Süre:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-stone-100">
              {durationSec} sn
            </span>
          </div>

          {/* Tokens */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white dark:bg-stone-800 border border-slate-200 dark:border-stone-700 shadow-2xs" title={`Girdi: ${record.promptTokens.toLocaleString('tr-TR')} | Çıktı: ${record.candidatesTokens.toLocaleString('tr-TR')}`}>
            <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
            <span className="text-slate-600 dark:text-stone-400 text-[11px]">Token:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-stone-100">
              {record.totalTokens.toLocaleString('tr-TR')}
            </span>
            <span className="text-[10px] font-mono text-slate-400 dark:text-stone-500 hidden md:inline">
              ({record.promptTokens} in / {record.candidatesTokens} out)
            </span>
          </div>

          {/* Cost USD & TL */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs" title={`1 USD = ${record.exchangeRate.toFixed(2)} TL kuru ile hesaplanmıştır`}>
            <Coins className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-emerald-800 dark:text-emerald-300 text-[11px]">Maliyet:</span>
            <span className="font-mono font-bold text-emerald-900 dark:text-emerald-200">
              {costUsdFormatted}
            </span>
            <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
              (~{costTryFormatted})
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenStatsModal}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 dark:bg-amber-600 dark:hover:bg-amber-500 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
            title="Tüm geçmiş dönüşümleri ve kümülatif maliyet grafiğini gör"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Detaylı İstatistikler</span>
            <ChevronRight className="w-3 h-3" />
          </button>

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-stone-200 transition cursor-pointer"
              title="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
