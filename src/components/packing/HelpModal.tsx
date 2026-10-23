import React from 'react';
import { X, BookOpen, CheckCircle, Calculator, FileSpreadsheet } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-md w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans text-slate-900 dark:text-stone-100">
        {/* Header */}
        <div className="p-3.5 border-b border-slate-300 dark:border-stone-700 flex items-center justify-between bg-slate-100 dark:bg-stone-800/90">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600 dark:text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-stone-100 uppercase tracking-wide">
                Sistem Talimatı &amp; Format Rehberi
              </h2>
              <p className="text-xs text-slate-500 dark:text-stone-400">Çeki listesi standartları ve dönüştürme kuralları</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-stone-200 hover:bg-slate-200 dark:hover:bg-stone-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-700 dark:text-stone-300 bg-white dark:bg-stone-900">
          {/* Section 1 */}
          <div className="border border-slate-200 dark:border-stone-700 p-3.5 rounded bg-slate-50 dark:bg-stone-800/40 space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900 dark:text-stone-100 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 dark:text-amber-400" />
              1. Standart 9 Sütunlu Çeki Listesi Yapısı
            </h3>
            <p className="text-slate-600 dark:text-stone-400">
              Her bir palet ve malzeme eşleşmesi bağımsız bir satır olarak listelenir:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2 font-mono text-[11px]">
              <li className="bg-white dark:bg-stone-900 p-2 rounded border border-slate-200 dark:border-stone-700">
                <strong className="text-slate-900 dark:text-stone-100">A - Palet No:</strong> 1, 2, 3...
              </li>
              <li className="bg-white dark:bg-stone-900 p-2 rounded border border-slate-200 dark:border-stone-700">
                <strong className="text-slate-900 dark:text-stone-100">B - Palet Ölçüleri:</strong> 80x120x114 vb.
              </li>
              <li className="bg-white dark:bg-stone-900 p-2 rounded border border-slate-200 dark:border-stone-700">
                <strong className="text-slate-900 dark:text-stone-100">C - Palet Ağırlığı:</strong> 7,5 kg (Dara)
              </li>
              <li className="bg-white dark:bg-stone-900 p-2 rounded border border-slate-200 dark:border-stone-700">
                <strong className="text-slate-900 dark:text-stone-100">D - Koli Ölçüleri:</strong> 280x380x330 vb.
              </li>
              <li className="bg-white dark:bg-stone-900 p-2 rounded border border-slate-200 dark:border-stone-700">
                <strong className="text-slate-900 dark:text-stone-100">E - Malzeme Kodu:</strong> Girdide varsa alınır, yoksa boş bırakılır (kod havuzu devre dışıdır)
              </li>
              <li className="bg-white dark:bg-stone-900 p-2 rounded border border-slate-200 dark:border-stone-700">
                <strong className="text-slate-900 dark:text-stone-100">F - Malzeme Açıklaması:</strong> Girdi metnindeki tam tanım
              </li>
              <li className="bg-white dark:bg-stone-900 p-2 rounded border border-slate-200 dark:border-stone-700">
                <strong className="text-slate-900 dark:text-stone-100">G - Koli İçi Adet:</strong> Alt notlardan veya girdiden alınır (ürünler tekildir; 500 veya 200 adet olabilir)
              </li>
              <li className="bg-white dark:bg-stone-900 p-2 rounded border border-slate-200 dark:border-stone-700">
                <strong className="text-slate-900 dark:text-stone-100">H - Koli Sayısı:</strong> Kap / Koli adedi
              </li>
              <li className="bg-white dark:bg-stone-900 p-2 rounded border border-slate-200 dark:border-stone-700 sm:col-span-2">
                <strong className="text-slate-900 dark:text-stone-100">I - Koli Ağırlığı:</strong> Birim koli ağırlığı (kg)
              </li>
            </ul>
          </div>

          {/* Section 2 */}
          <div className="border border-slate-200 dark:border-stone-700 p-3.5 rounded bg-slate-50 dark:bg-stone-800/40 space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900 dark:text-stone-100 flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-blue-600 dark:text-amber-400" />
              2. Matematiksel Sağlama Kuralları
            </h3>
            <div className="space-y-1 font-mono text-[11px] text-slate-800 dark:text-stone-200">
              <div className="p-1.5 bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 rounded">
                <strong>Toplam Malzeme Adeti</strong> = Koli İçi Adet × Koli Sayısı
              </div>
              <div className="p-1.5 bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 rounded">
                <strong>Net Ağırlık</strong> = Σ (Koli Sayısı × Koli Ağırlığı)
              </div>
              <div className="p-1.5 bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 rounded">
                <strong>Brüt Ağırlık</strong> = Net Ağırlık + 7,5 kg (Palet Ahşap Darası)
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div className="border border-slate-200 dark:border-stone-700 p-3.5 rounded bg-slate-50 dark:bg-stone-800/40 space-y-1.5">
            <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900 dark:text-stone-100 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              3. Excel ve Aktarım Uyumluluğu
            </h3>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-stone-400 text-[11px]">
              <li>
                <strong className="text-slate-800 dark:text-stone-200">Sayısal Hücre Standardı:</strong> Excel (.xlsx) dışa aktarımı gerçek sayısal (IEEE float) formatında kaydedilir. Harici ERP ve aktarım yazılımları ağırlık ve adetleri hatasız okur.
              </li>
              <li>
                <strong className="text-slate-800 dark:text-stone-200">Hücre Birleştirme Yoktur:</strong> Tüm satırlarda palet no ve dara tekrarlanır; formül ve filtreleme engellenmez.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-2.5 border-t border-slate-300 dark:border-stone-700 bg-slate-100 dark:bg-stone-800/90 text-right">
          <button
            onClick={onClose}
            className="px-3.5 py-1 bg-slate-800 hover:bg-slate-900 dark:bg-amber-600 dark:hover:bg-amber-500 text-white rounded text-xs font-semibold cursor-pointer transition shadow-xs"
          >
            Anladım, Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
