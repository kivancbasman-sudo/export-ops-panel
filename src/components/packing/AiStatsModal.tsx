import React, { useState } from 'react';
import {
  X,
  BarChart3,
  Clock,
  Zap,
  Coins,
  Download,
  Trash2,
  RefreshCw,
  Sliders,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  AiConversionRecord,
  AiStatsSummary,
} from '../../types/aiStats';
import {
  exportAiStatsCsv,
  clearAiConversionRecords,
  setSavedUsdTryRate,
  computeAiStatsSummary,
} from '../../utils/aiStatsStorage';

interface AiStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: AiConversionRecord[];
  onRecordsUpdated: () => void;
}

export const AiStatsModal: React.FC<AiStatsModalProps> = ({
  isOpen,
  onClose,
  records,
  onRecordsUpdated,
}) => {
  const summary: AiStatsSummary = computeAiStatsSummary(records);
  const [exchangeRateInput, setExchangeRateInput] = useState<string>(
    summary.exchangeRate.toFixed(2)
  );
  const [isSavedRateNotice, setIsSavedRateNotice] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  if (!isOpen) return null;

  const handleSaveExchangeRate = () => {
    const parsed = parseFloat(exchangeRateInput.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      setSavedUsdTryRate(parsed);
      setIsSavedRateNotice(true);
      setTimeout(() => setIsSavedRateNotice(false), 2000);
      onRecordsUpdated();
    }
  };

  const handleClearHistory = () => {
    clearAiConversionRecords();
    setShowClearConfirm(false);
    onRecordsUpdated();
  };

  const handleExport = () => {
    exportAiStatsCsv(records);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-900 dark:text-stone-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-stone-800 flex items-center justify-between bg-slate-50 dark:bg-stone-850">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-600 dark:bg-amber-600 text-white shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                AI Dönüştürme İstatistikleri ve Maliyet Takibi
              </h2>
              <p className="text-xs text-slate-500 dark:text-stone-400">
                Tarayıcıda biriken çeki listesi ayrıştırma süresi, token ve maliyet telemetrisi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-stone-200 rounded-md transition cursor-pointer"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 1. Cumulative KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Conversions */}
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-stone-800/70 border border-slate-200 dark:border-stone-700">
              <div className="flex items-center justify-between text-slate-500 dark:text-stone-400 text-xs font-medium mb-1">
                <span>Toplam İşlem</span>
                <RefreshCw className="w-4 h-4 text-blue-600 dark:text-amber-400" />
              </div>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-stone-100">
                {summary.totalConversions}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-stone-500 mt-0.5">
                Başarılı AI çeki listesi dönüşümü
              </p>
            </div>

            {/* Total / Average Duration */}
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-stone-800/70 border border-slate-200 dark:border-stone-700">
              <div className="flex items-center justify-between text-slate-500 dark:text-stone-400 text-xs font-medium mb-1">
                <span>Yanıt Süresi</span>
                <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-stone-100">
                {(summary.averageDurationMs / 1000).toFixed(2)} sn
              </div>
              <p className="text-[11px] text-slate-400 dark:text-stone-500 mt-0.5">
                Ortalama • Toplam {(summary.totalDurationMs / 1000).toFixed(1)} sn
              </p>
            </div>

            {/* Total Tokens */}
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-stone-800/70 border border-slate-200 dark:border-stone-700">
              <div className="flex items-center justify-between text-slate-500 dark:text-stone-400 text-xs font-medium mb-1">
                <span>Toplam Token</span>
                <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              </div>
              <div className="text-xl font-bold font-mono text-slate-900 dark:text-stone-100">
                {summary.totalTokens.toLocaleString('tr-TR')}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-stone-500 mt-0.5" title={`Girdi: ${summary.totalPromptTokens.toLocaleString('tr-TR')} / Çıktı: ${summary.totalCandidatesTokens.toLocaleString('tr-TR')}`}>
                {summary.totalPromptTokens.toLocaleString('tr-TR')} in / {summary.totalCandidatesTokens.toLocaleString('tr-TR')} out
              </p>
            </div>

            {/* Total Cost */}
            <div className="p-3.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
              <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-xs font-medium mb-1">
                <span>Kümülatif Maliyet</span>
                <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-900 dark:text-emerald-200">
                {summary.totalCostTry.toFixed(3)} ₺
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5 font-mono">
                ${summary.totalCostUsd.toFixed(5)} USD
              </p>
            </div>
          </div>

          {/* 2. Currency Rate Setting & Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-100/70 dark:bg-stone-850 rounded-lg border border-slate-200 dark:border-stone-800">
            <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-stone-300">
              <Sliders className="w-4 h-4 text-slate-500 dark:text-stone-400 shrink-0" />
              <span>
                <strong>USD / TL Kuru:</strong> Maliyetler 1 USD =
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={exchangeRateInput}
                  onChange={(e) => setExchangeRateInput(e.target.value)}
                  className="w-16 px-1.5 py-0.5 text-center font-mono font-bold text-xs bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-slate-900 dark:text-stone-100"
                />
                <span>₺ üzerinden hesaplanır.</span>
                <button
                  type="button"
                  onClick={handleSaveExchangeRate}
                  className="px-2 py-0.5 bg-blue-600 dark:bg-amber-600 hover:bg-blue-700 dark:hover:bg-amber-500 text-white rounded text-xs font-medium transition cursor-pointer"
                >
                  Uygula
                </button>
                {isSavedRateNotice && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold animate-in fade-in">
                    <Check className="w-3 h-3" /> Güncellendi
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-stone-400">
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Google Gemini Flash/Lite resmi birim token fiyatlandırması esastır.</span>
            </div>
          </div>

          {/* 3. Detailed Conversion History Table */}
          <div>
            <div className="flex items-center justify-between pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-stone-300">
                Geçmiş AI Dönüşümleri ({records.length})
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-stone-400">
                Tarayıcı yerel hafızasında (localStorage) saklanmaktadır
              </span>
            </div>

            {records.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 dark:border-stone-800 rounded-lg text-slate-400 dark:text-stone-600 text-xs">
                Henüz kayıtlı bir AI dönüştürme işlemi bulunmuyor. Yeni bir metin dönüştürdüğünüzde buraya otomatik eklenecektir.
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-stone-800 rounded-lg overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-slate-50 dark:bg-stone-850 text-slate-700 dark:text-stone-300 sticky top-0 z-10 border-b border-slate-200 dark:border-stone-800 font-semibold">
                    <tr>
                      <th className="px-3 py-2 text-left">Tarih &amp; Saat</th>
                      <th className="px-2.5 py-2 text-center">Model</th>
                      <th className="px-2.5 py-2 text-right">Süre</th>
                      <th className="px-2.5 py-2 text-right">Girdi / Çıktı Token</th>
                      <th className="px-2.5 py-2 text-right">Toplam Token</th>
                      <th className="px-2.5 py-2 text-right">Maliyet (USD)</th>
                      <th className="px-3 py-2 text-right">Maliyet (TL)</th>
                      <th className="px-2.5 py-2 text-center">Blok/Satır</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-stone-800 font-mono text-slate-800 dark:text-stone-200 bg-white dark:bg-stone-900">
                    {records.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-stone-800/50 transition">
                        <td className="px-3 py-2 text-left font-sans text-slate-600 dark:text-stone-400 whitespace-nowrap">
                          {new Date(r.timestamp).toLocaleDateString('tr-TR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="px-2.5 py-2 text-center whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-stone-800 text-slate-700 dark:text-stone-300">
                            {r.modelUsed || 'Flash'}
                          </span>
                        </td>
                        <td className="px-2.5 py-2 text-right whitespace-nowrap font-bold text-slate-900 dark:text-stone-100">
                          {(r.durationMs / 1000).toFixed(2)} sn
                        </td>
                        <td className="px-2.5 py-2 text-right text-slate-600 dark:text-stone-400 whitespace-nowrap">
                          {r.promptTokens} / {r.candidatesTokens}
                        </td>
                        <td className="px-2.5 py-2 text-right font-bold text-slate-900 dark:text-stone-100 whitespace-nowrap">
                          {r.totalTokens.toLocaleString('tr-TR')}
                        </td>
                        <td className="px-2.5 py-2 text-right text-slate-700 dark:text-stone-300 whitespace-nowrap">
                          ${r.costUsd < 0.0001 ? r.costUsd.toFixed(6) : r.costUsd.toFixed(5)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {r.costTry.toFixed(4)} ₺
                        </td>
                        <td className="px-2.5 py-2 text-center text-slate-500 dark:text-stone-400 whitespace-nowrap text-[11px]">
                          {r.blocksCount}b / {r.rowsCount}s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-stone-800 bg-slate-50 dark:bg-stone-850 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {records.length > 0 && (
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
                title="Geçmişi Excel uyumlu CSV dosyası olarak indir"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV Raporu İndir</span>
              </button>
            )}

            {records.length > 0 && !showClearConfirm && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-300 dark:border-stone-700 text-slate-600 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-medium transition cursor-pointer"
                title="Tüm geçmiş dönüştürme kayıtlarını temizle"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Geçmişi Temizle</span>
              </button>
            )}

            {showClearConfirm && (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-900 text-xs text-red-800 dark:text-red-300 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                <span>Tüm istatistikler silinsin mi?</span>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="px-2 py-0.5 bg-red-600 text-white rounded font-bold hover:bg-red-700 cursor-pointer text-xs ml-1"
                >
                  Evet, Sil
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-0.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded text-slate-700 dark:text-stone-300 hover:bg-slate-100 cursor-pointer text-xs"
                >
                  Vazgeç
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-200 dark:bg-stone-800 hover:bg-slate-300 dark:hover:bg-stone-700 text-slate-800 dark:text-stone-200 text-xs font-semibold transition cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
