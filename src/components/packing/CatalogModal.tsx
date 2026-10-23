import React, { useState } from 'react';
import { CatalogItem } from '../../types/packingConverter';
import { DEFAULT_CATALOG } from '../../data/defaultCatalog';
import {
  X,
  Plus,
  Trash2,
  Search,
  Database,
  RotateCcw,
} from 'lucide-react';

interface CatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: CatalogItem[];
  setCatalog: React.Dispatch<React.SetStateAction<CatalogItem[]>>;
}

export const CatalogModal: React.FC<CatalogModalProps> = ({
  isOpen,
  onClose,
  catalog,
  setCatalog,
}) => {
  const [search, setSearch] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPieces, setNewPieces] = useState<number>(500);
  const [newWeight, setNewWeight] = useState<number>(11.4);
  const [newDim, setNewDim] = useState('280x380x330');
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!isOpen) return null;

  const filteredCatalog = catalog.filter(
    (c) =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newDesc.trim()) return;

    const newItem: CatalogItem = {
      id: `cat-${Date.now()}`,
      code: newCode.trim(),
      description: newDesc.trim(),
      defaultBoxPieces: newPieces,
      defaultBoxWeight: newWeight,
      defaultBoxDimensions: newDim,
    };

    const updated = [newItem, ...catalog];
    setCatalog(updated);
    try {
      localStorage.setItem('packing_catalog', JSON.stringify(updated));
    } catch (e) {
      console.error('LocalStorage yazma hatası:', e);
    }
    setNewCode('');
    setNewDesc('');
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    const updated = catalog.filter((c) => c.id !== id);
    setCatalog(updated);
    try {
      localStorage.setItem('packing_catalog', JSON.stringify(updated));
    } catch (e) {
      console.error('LocalStorage yazma hatası:', e);
    }
  };

  const handleResetToDefault = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    setCatalog(DEFAULT_CATALOG);
    try {
      localStorage.setItem('packing_catalog', JSON.stringify(DEFAULT_CATALOG));
    } catch (e) {
      console.error('LocalStorage yazma hatası:', e);
    }
    setConfirmReset(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-md w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl font-sans text-slate-900 dark:text-stone-100 overflow-hidden">
        {/* Header */}
        <div className="p-3.5 border-b border-slate-300 dark:border-stone-700 flex items-center justify-between bg-slate-100 dark:bg-stone-800/90">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600 dark:text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-stone-100 uppercase tracking-wide">
                Malzeme Kod Havuzu (Katalog)
              </h2>
              <p className="text-xs text-slate-500 dark:text-stone-400">
                Ayrıştırma esnasında otomatik eşleştirilen ürün ve stok kodları
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

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-200 dark:border-stone-700 flex flex-col sm:flex-row gap-2 items-center justify-between bg-white dark:bg-stone-900">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kod veya açıklama ile ara (P017, LET-P, CG1)..."
              className="w-full pl-8 pr-3 py-1 bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 rounded text-xs text-slate-900 dark:text-stone-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 dark:focus:border-amber-400"
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 dark:bg-amber-600 dark:hover:bg-amber-500 text-white text-xs font-semibold rounded flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Kod</span>
            </button>
            <button
              onClick={handleResetToDefault}
              className={`p-1 border rounded transition cursor-pointer ${
                confirmReset
                  ? 'bg-rose-600 text-white border-rose-700'
                  : 'bg-white dark:bg-stone-800 hover:bg-slate-100 dark:hover:bg-stone-700 text-slate-600 dark:text-stone-300 border-slate-300 dark:border-stone-700'
              }`}
              title={confirmReset ? 'Sıfırlamak için tekrar tıklayın' : 'Varsayılanlara Sıfırla'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddItem}
            className="p-3.5 border-b border-slate-300 dark:border-stone-700 bg-slate-50 dark:bg-stone-800/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs"
          >
            <div>
              <label className="font-semibold text-slate-700 dark:text-stone-300 text-[11px]">Malzeme Kodu</label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Örn: P0170226006"
                required
                className="w-full mt-0.5 px-2.5 py-1 bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 rounded text-xs text-slate-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-stone-300 text-[11px]">Malzeme Açıklaması</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Örn: PR1-SS Rev.6 WCRE TELEMETRY SWITCHES"
                required
                className="w-full mt-0.5 px-2.5 py-1 bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 rounded text-xs text-slate-900 dark:text-stone-100"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 col-span-1 sm:col-span-2">
              <div>
                <label className="font-semibold text-slate-700 dark:text-stone-300 text-[11px]">Koli İçi</label>
                <input
                  type="number"
                  value={newPieces}
                  onChange={(e) => setNewPieces(Number(e.target.value))}
                  className="w-full mt-0.5 px-2 py-1 bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 rounded text-xs text-slate-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-stone-300 text-[11px]">Koli Kg</label>
                <input
                  type="number"
                  step="0.01"
                  value={newWeight}
                  onChange={(e) => setNewWeight(Number(e.target.value))}
                  className="w-full mt-0.5 px-2 py-1 bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 rounded text-xs text-slate-900 dark:text-stone-100"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-stone-300 text-[11px]">Koli Ölçüsü</label>
                <input
                  type="text"
                  value={newDim}
                  onChange={(e) => setNewDim(e.target.value)}
                  className="w-full mt-0.5 px-2 py-1 bg-white dark:bg-stone-950 border border-slate-300 dark:border-stone-700 rounded text-xs text-slate-900 dark:text-stone-100"
                />
              </div>
            </div>
            <div className="col-span-1 sm:col-span-2 flex justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-2.5 py-1 text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200 text-xs cursor-pointer"
              >
                İptal
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-slate-800 hover:bg-slate-900 dark:bg-amber-600 dark:hover:bg-amber-500 text-white rounded text-xs font-semibold cursor-pointer"
              >
                Kaydet
              </button>
            </div>
          </form>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-stone-800 p-2 bg-white dark:bg-stone-900">
          {filteredCatalog.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-stone-400">
              Eşleşen stok kodu bulunamadı.
            </div>
          ) : (
            filteredCatalog.map((item) => (
              <div
                key={item.id}
                className="p-2.5 hover:bg-slate-50 dark:hover:bg-stone-800/60 flex items-center justify-between gap-2 group transition rounded"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-stone-100 bg-slate-100 dark:bg-stone-800 px-1.5 py-0.5 rounded border border-slate-300 dark:border-stone-700">
                      {item.code}
                    </span>
                    {item.defaultBoxDimensions && (
                      <span className="text-[11px] text-slate-500 dark:text-stone-400 font-mono">
                        {item.defaultBoxDimensions}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-800 dark:text-stone-200 font-medium mt-0.5">{item.description}</p>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition cursor-pointer"
                  title="Kodu Sil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 border-t border-slate-300 dark:border-stone-700 bg-slate-100 dark:bg-stone-800/90 text-right text-xs text-slate-500 dark:text-stone-400 font-mono">
          Toplam {catalog.length} kayıtlı stok kodu
        </div>
      </div>
    </div>
  );
};
