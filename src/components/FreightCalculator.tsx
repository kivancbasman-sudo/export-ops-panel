import React, { useState, useEffect } from 'react';
import { Calculator, Box, Scale, DollarSign, CheckCircle2, X } from 'lucide-react';
import { NumberInput } from './ui/NumberInput';
import { calculateFreight, formatNumber } from '../utils/calculations';
import { Button } from './ui/Button';
import { useAppStore } from '../store/useAppStore';

export interface FreightCalculatorProps {
  initialGrossWeight?: number;
  initialChargeableWeight?: number;
  sourceShipmentTitle?: string;
  onClearPrefill?: () => void;
}

export function FreightCalculator({
  initialGrossWeight,
  initialChargeableWeight,
  sourceShipmentTitle,
  onClearPrefill
}: FreightCalculatorProps = {}) {
  const { settings } = useAppStore();
  
  // Volumetric Calc State
  const [transportType, setTransportType] = useState<number>(5000);
  const [width, setWidth] = useState<number | ''>('');
  const [length, setLength] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [grossWeight, setGrossWeight] = useState<number | ''>(initialGrossWeight ?? '');
  
  // Freight Calc State
  const [chargeableWeight, setChargeableWeight] = useState<number | ''>(initialChargeableWeight ?? '');
  const [manualRate, setManualRate] = useState<number | ''>('');
  const [useManualRate, setUseManualRate] = useState(false);
  
  // Currency State
  const [exchangeRate, setExchangeRate] = useState<number | ''>('');

  useEffect(() => {
    if (initialGrossWeight !== undefined) {
      setGrossWeight(initialGrossWeight);
    }
    if (initialChargeableWeight !== undefined) {
      setChargeableWeight(initialChargeableWeight);
    }
  }, [initialGrossWeight, initialChargeableWeight]);

  // Volumetric Results
  const volumetricWeight = (Number(width) * Number(length) * Number(height) * Number(quantity)) / transportType;
  const recommendedChargeable = Math.max(volumetricWeight || 0, Number(grossWeight) || 0);

  // Freight Results
  const baseCalc = calculateFreight(Number(chargeableWeight) || 0, settings.freightTiers, settings.minFreightAmount);
  const rateToUse = useManualRate ? (Number(manualRate) || 0) : baseCalc.rate;
  
  let calculatedAmount = (Number(chargeableWeight) || 0) * rateToUse;
  let isMinAmount = false;
  
  if (!useManualRate && calculatedAmount < settings.minFreightAmount && (Number(chargeableWeight) || 0) > 0) {
    calculatedAmount = settings.minFreightAmount;
    isMinAmount = true;
  }

  const totalAmountUSD = calculatedAmount + settings.awbFee;
  const totalAmountTRY = totalAmountUSD * (Number(exchangeRate) || 0);

  const handleTransferWeight = () => {
    if (recommendedChargeable > 0) {
      setChargeableWeight(recommendedChargeable);
    }
  };

  return (
    <div className="bg-slate-100 dark:bg-stone-900 border border-slate-400 dark:border-stone-800 shadow-sm flex flex-col h-full min-h-0 transition-colors">
      <div className="bg-slate-200 dark:bg-stone-800/90 border-b border-slate-400 dark:border-stone-700 px-4 py-3 flex items-center shadow-sm shrink-0">
        <Calculator className="w-5 h-5 text-slate-700 dark:text-amber-400 mr-2" />
        <h2 className="text-lg font-bold text-slate-800 dark:text-stone-100 tracking-wide uppercase">Navlun Hesaplama Aracı</h2>
      </div>

      <div className="p-4 flex-1 min-h-0 overflow-y-auto">
        <div className="flex flex-col gap-6 max-w-5xl mx-auto">
          {sourceShipmentTitle && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-md p-3 flex items-center justify-between text-amber-950 dark:text-amber-200 text-xs shadow-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>{sourceShipmentTitle}</strong> sevkiyatından veriler aktarıldı: 
                  <span className="font-mono ml-1 font-bold">Brüt: {initialGrossWeight} kg</span>, 
                  <span className="font-mono ml-1 font-bold">Şarj Edilebilir: {initialChargeableWeight} kg</span>
                </span>
              </div>
              {onClearPrefill && (
                <button 
                  onClick={onClearPrefill} 
                  className="text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 flex items-center gap-1 font-bold text-[11px] p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer"
                  title="Aktarılan verileri temizle"
                >
                  <X className="w-3.5 h-3.5" /> Temizle
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Volumetric Calculator */}
        <section className="bg-slate-100 dark:bg-stone-900 border border-slate-400 dark:border-stone-800 shadow-sm rounded-sm">
          <div className="bg-slate-200 dark:bg-stone-800 p-3 border-b border-slate-400 dark:border-stone-700 flex items-center">
            <Box className="w-4 h-4 mr-2 text-slate-600 dark:text-stone-400" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-stone-100">Hacimsel Ağırlık Hesaplama</h3>
          </div>
          
          <div className="p-4 flex flex-col gap-4">
            <div className="flex gap-4 items-center bg-white dark:bg-stone-800/90 p-3 border border-slate-300 dark:border-stone-700 rounded-sm">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-stone-300 cursor-pointer font-medium">
                <input 
                  type="radio" 
                  name="transportType" 
                  value={5000} 
                  checked={transportType === 5000} 
                  onChange={() => setTransportType(5000)} 
                  className="text-amber-600 focus:ring-amber-500"
                />
                Express Kurye (/5000)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-stone-300 cursor-pointer font-medium">
                <input 
                  type="radio" 
                  name="transportType" 
                  value={6000} 
                  checked={transportType === 6000} 
                  onChange={() => setTransportType(6000)} 
                  className="text-amber-600 focus:ring-amber-500"
                />
                Hava Kargo (/6000)
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <NumberInput label="En (cm)" value={width} onChange={setWidth} />
              <NumberInput label="Boy (cm)" value={length} onChange={setLength} />
              <NumberInput label="Yükseklik (cm)" value={height} onChange={setHeight} />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Koli/Palet Adedi" value={quantity} onChange={setQuantity} />
              <NumberInput label="Brüt Ağırlık (kg)" value={grossWeight} onChange={setGrossWeight} decimals={2} />
            </div>

            <div className="mt-4 p-4 bg-white dark:bg-stone-800/90 border border-slate-300 dark:border-stone-700 rounded-sm">
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-slate-600 dark:text-stone-400">Hacimsel Ağırlık:</span>
                <span className="font-mono font-medium text-slate-800 dark:text-stone-200">{formatNumber(volumetricWeight)} kg</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold border-t border-slate-200 dark:border-stone-700 pt-2">
                <span className="text-slate-800 dark:text-stone-100">Hesaplanabilir Ağırlık:</span>
                <span className="font-mono text-blue-700 dark:text-amber-400">{formatNumber(recommendedChargeable)} kg</span>
              </div>
              
              <Button 
                onClick={handleTransferWeight} 
                className="w-full mt-4 flex items-center justify-center gap-2 cursor-pointer"
                disabled={recommendedChargeable <= 0}
              >
                <Scale className="w-4 h-4" />
                Navlun Hesabına Aktar
              </Button>
            </div>
          </div>
        </section>

        {/* Freight Calculator */}
        <section className="bg-slate-100 dark:bg-stone-900 border border-slate-400 dark:border-stone-800 shadow-sm rounded-sm">
          <div className="bg-slate-200 dark:bg-stone-800 p-3 border-b border-slate-400 dark:border-stone-700 flex items-center">
            <DollarSign className="w-4 h-4 mr-2 text-slate-600 dark:text-stone-400" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-stone-100">Navlun Hesaplama</h3>
          </div>
          
          <div className="p-4 flex flex-col gap-4">
            <div className="bg-amber-50/40 dark:bg-stone-800/90 border border-amber-200/80 dark:border-stone-700 p-4 rounded-sm flex flex-col gap-4">
              <NumberInput 
                label="Hesaplanabilir Ağırlık (kg)" 
                value={chargeableWeight} 
                onChange={setChargeableWeight} 
                decimals={2} 
                className="bg-white dark:bg-stone-900 font-bold"
              />
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-stone-300">Fiyat (Barem / Manuel)</label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 dark:text-stone-400">
                    <input 
                      type="checkbox" 
                      checked={useManualRate} 
                      onChange={(e) => {
                        setUseManualRate(e.target.checked);
                        if (!e.target.checked) setManualRate('');
                        else setManualRate(baseCalc.rate);
                      }}
                      className="rounded border-slate-400 dark:border-stone-600 text-amber-600 focus:ring-amber-500"
                    />
                    Manuel Fiyat Gir
                  </label>
                </div>
                
                {useManualRate ? (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-stone-400 text-sm">$</span>
                    <NumberInput 
                      value={manualRate} 
                      onChange={setManualRate} 
                      decimals={2} 
                      className="pl-8"
                    />
                  </div>
                ) : (
                  <div className="h-9 px-3 border border-slate-300 dark:border-stone-700 bg-slate-50 dark:bg-stone-900 rounded-sm flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800 dark:text-stone-200">
                      ${formatNumber(baseCalc.rate)} <span className="text-xs text-slate-500 dark:text-stone-400 font-normal">/ kg (Otomatik Barem)</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2 p-4 bg-white dark:bg-stone-800/90 border border-slate-300 dark:border-stone-700 rounded-sm shadow-xs flex flex-col gap-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-stone-400">Navlun Tutarı:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-stone-200">
                  ${formatNumber(calculatedAmount)}
                  {isMinAmount && (
                    <span className="text-[10px] ml-2 text-amber-700 bg-amber-100 border border-amber-300 dark:text-amber-300 dark:bg-amber-950/60 dark:border-amber-800 px-1.5 py-0.5 rounded font-medium">
                      MİN TUTAR ({settings.minFreightAmount}$)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-stone-400">AWB Ücreti:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-stone-200">${formatNumber(settings.awbFee)}</span>
              </div>
              <div className="flex justify-between items-center text-base font-bold border-t border-slate-200 dark:border-stone-700 pt-3 mt-1">
                <span className="text-slate-900 dark:text-stone-100">TOPLAM:</span>
                <span className="font-mono text-xl font-extrabold text-blue-700 dark:text-amber-400">${formatNumber(totalAmountUSD)}</span>
              </div>
            </div>

            {/* Currency Conversion Section */}
            <div className="border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800/90 p-4 rounded-sm flex flex-col gap-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-stone-400 text-sm font-medium">₺</span>
                <NumberInput 
                  label="USD / TRY Kuru"
                  value={exchangeRate} 
                  onChange={setExchangeRate} 
                  decimals={4} 
                  className="pl-8"
                  placeholder="Güncel kur (Örn: 32.50)"
                />
              </div>
              {Number(exchangeRate) > 0 && totalAmountUSD > 0 && (
                <div className="flex justify-between items-center text-lg font-bold bg-slate-100 dark:bg-stone-900 p-3 rounded-sm border border-slate-200 dark:border-stone-700">
                  <span className="text-slate-800 dark:text-stone-200">TL KARŞILIĞI:</span>
                  <span className="font-mono text-slate-900 dark:text-stone-100">₺{formatNumber(totalAmountTRY)}</span>
                </div>
              )}
            </div>
            
          </div>
        </section>
          </div>
        </div>
      </div>
    </div>
  );
}
