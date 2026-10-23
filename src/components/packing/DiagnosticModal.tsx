import React, { useState } from 'react';
import { DetailedDiagnosticReport, generateDiagnosticMarkdownReport } from '../../utils/packingValidator';
import { formatDecimal } from '../../utils/packingParser';
import {
  X,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  Download,
  Wrench,
  CheckCircle2,
} from 'lucide-react';

interface DiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: DetailedDiagnosticReport | null;
  blockTitle: string;
  onAutoFixTare?: () => void;
}

export const DiagnosticModal: React.FC<DiagnosticModalProps> = ({
  isOpen,
  onClose,
  report,
  blockTitle,
  onAutoFixTare,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'issues' | 'pallets'>('issues');

  if (!isOpen || !report) return null;

  const handleCopyReport = async () => {
    const md = generateDiagnosticMarkdownReport(report, blockTitle);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadReport = () => {
    const md = generateDiagnosticMarkdownReport(report, blockTitle);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Denetim_Raporu_${blockTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-md w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans text-slate-900 dark:text-stone-100">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-300 dark:border-stone-700 flex items-center justify-between bg-slate-100 dark:bg-stone-800/90">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded flex items-center justify-center border font-bold text-sm ${
                report.criticalCount > 0
                  ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                  : report.warningCount > 0
                  ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                  : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
              }`}
            >
              {report.criticalCount > 0 ? (
                <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              ) : report.warningCount > 0 ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-stone-100">
                  Denetim &amp; Doğrulama Raporu
                </h2>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                    report.isReadyForExport
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                  }`}
                >
                  {report.isReadyForExport ? 'Dışa Aktarıma Uygun' : 'Düzeltme Gerekli'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-stone-400 mt-0.5">
                {blockTitle} — Ölçü, koli, ağırlık ve dara doğrulaması
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-stone-200 hover:bg-slate-200 dark:hover:bg-stone-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Counts Row */}
        <div className="grid grid-cols-3 bg-white dark:bg-stone-900 border-b border-slate-300 dark:border-stone-700 text-center text-xs font-mono">
          <div className="p-2.5 border-r border-slate-200 dark:border-stone-700">
            <span className="text-[10px] text-slate-500 dark:text-stone-400 block uppercase font-sans font-semibold">
              Kritik Hatalar
            </span>
            <span
              className={`text-base font-bold ${
                report.criticalCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-stone-300'
              }`}
            >
              {report.criticalCount}
            </span>
          </div>
          <div className="p-2.5 border-r border-slate-200 dark:border-stone-700">
            <span className="text-[10px] text-slate-500 dark:text-stone-400 block uppercase font-sans font-semibold">
              Uyarılar
            </span>
            <span
              className={`text-base font-bold ${
                report.warningCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-stone-300'
              }`}
            >
              {report.warningCount}
            </span>
          </div>
          <div className="p-2.5">
            <span className="text-[10px] text-slate-500 dark:text-stone-400 block uppercase font-sans font-semibold">
              Palet Sayısı
            </span>
            <span className="text-base font-bold text-slate-900 dark:text-stone-100">
              {report.palletAudits.length}
            </span>
          </div>
        </div>

        {/* Tab Switcher & Actions */}
        <div className="px-4 py-2 border-b border-slate-200 dark:border-stone-700 flex items-center justify-between bg-slate-50 dark:bg-stone-800/50 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('issues')}
              className={`px-3 py-1 font-semibold rounded transition border cursor-pointer ${
                activeTab === 'issues'
                  ? 'bg-slate-800 dark:bg-amber-600 text-white border-slate-800 dark:border-amber-600'
                  : 'bg-white dark:bg-stone-800 text-slate-700 dark:text-stone-300 border-slate-300 dark:border-stone-700 hover:bg-slate-100 dark:hover:bg-stone-700'
              }`}
            >
              Bulgular ({report.totalIssues})
            </button>
            <button
              onClick={() => setActiveTab('pallets')}
              className={`px-3 py-1 font-semibold rounded transition border cursor-pointer ${
                activeTab === 'pallets'
                  ? 'bg-slate-800 dark:bg-amber-600 text-white border-slate-800 dark:border-amber-600'
                  : 'bg-white dark:bg-stone-800 text-slate-700 dark:text-stone-300 border-slate-300 dark:border-stone-700 hover:bg-slate-100 dark:hover:bg-stone-700'
              }`}
            >
              Palet Ağırlık Matrisi ({report.palletAudits.length})
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {onAutoFixTare && (
              <button
                onClick={onAutoFixTare}
                className="px-2.5 py-1 rounded bg-slate-100 dark:bg-stone-800 hover:bg-slate-200 dark:hover:bg-stone-700 text-slate-800 dark:text-stone-200 border border-slate-300 dark:border-stone-700 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                title="Tüm satırlardaki daraları 7,5 kg olarak tamamla"
              >
                <Wrench className="w-3.5 h-3.5 text-slate-600 dark:text-stone-400" />
                <span>Daraları 7,5 Yap</span>
              </button>
            )}
            <button
              onClick={handleCopyReport}
              className="px-2.5 py-1 rounded bg-white dark:bg-stone-850 hover:bg-slate-100 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-200 border border-slate-300 dark:border-stone-700 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
              title="Markdown Olarak Kopyala"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Kopyala</span>
            </button>
            <button
              onClick={handleDownloadReport}
              className="p-1 rounded bg-white dark:bg-stone-850 hover:bg-slate-100 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-200 border border-slate-300 dark:border-stone-700 transition cursor-pointer"
              title="Raporu İndir (.md)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab 1: Issues */}
        {activeTab === 'issues' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-white dark:bg-stone-900">
            {report.items.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto mb-2 opacity-80" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-stone-100">Tüm Veriler Standartlara Uygun</h4>
                <p className="text-xs text-slate-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
                  Eksik kod, format hatası veya ağırlık dengesizliği bulunamadı.
                </p>
              </div>
            ) : (
              report.items.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded border text-xs ${
                    item.severity === 'CRITICAL'
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900'
                      : item.severity === 'WARNING'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900'
                      : 'bg-slate-50 dark:bg-stone-800/40 border-slate-200 dark:border-stone-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase mt-0.5 border ${
                          item.severity === 'CRITICAL'
                            ? 'bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                            : item.severity === 'WARNING'
                            ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                            : 'bg-slate-100 dark:bg-stone-800 text-slate-800 dark:text-stone-200 border-slate-300 dark:border-stone-700'
                        }`}
                      >
                        {item.severity === 'CRITICAL' ? 'Hata' : 'Uyarı'}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 dark:text-stone-100">{item.title}</h4>
                          <span className="text-[10px] text-slate-500 dark:text-stone-400 font-mono">
                            {item.code}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-stone-300 mt-0.5">{item.message}</p>
                        {item.suggestedFix && (
                          <div className="mt-1.5 text-[11px] text-slate-600 dark:text-stone-300 bg-white dark:bg-stone-900 p-1.5 rounded border border-slate-200 dark:border-stone-700">
                            <strong>Çözüm:</strong> {item.suggestedFix}
                          </div>
                        )}
                      </div>
                    </div>
                    {item.column && (
                      <span className="text-[10px] font-mono bg-white dark:bg-stone-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-stone-700 text-slate-600 dark:text-stone-300 shrink-0">
                        {item.column}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Pallet Matrix */}
        {activeTab === 'pallets' && (
          <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-stone-900">
            <table className="w-full text-xs text-left border-collapse border border-slate-300 dark:border-stone-700 font-mono">
              <thead className="bg-[#f4f4f4] dark:bg-stone-800 text-slate-900 dark:text-stone-100 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-2 border border-slate-300 dark:border-stone-700">Palet No</th>
                  <th className="p-2 border border-slate-300 dark:border-stone-700 text-right">Beyan Brüt</th>
                  <th className="p-2 border border-slate-300 dark:border-stone-700 text-right">Net Kg</th>
                  <th className="p-2 border border-slate-300 dark:border-stone-700 text-right">Dara</th>
                  <th className="p-2 border border-slate-300 dark:border-stone-700 text-right">Hesap Brüt</th>
                  <th className="p-2 border border-slate-300 dark:border-stone-700 text-right">Fark</th>
                  <th className="p-2 border border-slate-300 dark:border-stone-700 text-center font-sans">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-stone-800 text-slate-800 dark:text-stone-200">
                {report.palletAudits.map((p) => (
                  <tr key={p.palletNo} className="hover:bg-slate-50 dark:hover:bg-stone-800/50">
                    <td className="p-2 border border-slate-300 dark:border-stone-700 font-bold text-slate-900 dark:text-stone-100">
                      Palet #{p.palletNo}
                    </td>
                    <td className="p-2 border border-slate-300 dark:border-stone-700 text-right">
                      {p.reportedGross !== undefined
                        ? `${formatDecimal(p.reportedGross)} kg`
                        : '–'}
                    </td>
                    <td className="p-2 border border-slate-300 dark:border-stone-700 text-right">
                      {formatDecimal(p.calculatedNet)} kg
                    </td>
                    <td className="p-2 border border-slate-300 dark:border-stone-700 text-right text-slate-500 dark:text-stone-400">
                      {formatDecimal(p.tare, 1)} kg
                    </td>
                    <td className="p-2 border border-slate-300 dark:border-stone-700 text-right font-bold text-slate-900 dark:text-stone-100">
                      {formatDecimal(p.calculatedGross)} kg
                    </td>
                    <td
                      className={`p-2 border border-slate-300 dark:border-stone-700 text-right font-bold ${
                        Math.abs(p.diff) > 0.3 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-stone-400'
                      }`}
                    >
                      {p.diff > 0 ? `+${formatDecimal(p.diff)}` : formatDecimal(p.diff)}
                    </td>
                    <td className="p-2 border border-slate-300 dark:border-stone-700 text-center font-sans">
                      {p.status === 'MATCH' ? (
                        <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
                          ✓ Birebir
                        </span>
                      ) : p.status === 'DISCREPANCY' ? (
                        <span className="text-amber-600 dark:text-amber-400 text-[11px] font-semibold">
                          ⚠ Sapma
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-stone-400 text-[11px]">Hesaplandı</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 border-t border-slate-300 dark:border-stone-700 bg-slate-100 dark:bg-stone-800/90 flex items-center justify-between text-xs text-slate-600 dark:text-stone-400">
          <span>
            {report.criticalCount === 0
              ? 'Tüm kritik alanlar geçerli. Güvenle dışa aktarabilirsiniz.'
              : `${report.criticalCount} kritik alan düzeltilmeyi bekliyor.`}
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1 bg-slate-800 hover:bg-slate-900 dark:bg-amber-600 dark:hover:bg-amber-500 text-white font-semibold rounded text-xs cursor-pointer shadow-xs"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
