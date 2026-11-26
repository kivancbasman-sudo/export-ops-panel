import { FreightTier, Shipment, PalletData } from '../types';

export function calculateFreight(weight: number, tiers: FreightTier[] = [], minAmount: number = 270) {
  let rate = 0;
  
  if (tiers && tiers.length > 0) {
    const sortedTiers = [...tiers].sort((a, b) => a.maxWeight - b.maxWeight);
    for (const tier of sortedTiers) {
      if (weight < tier.maxWeight) {
        rate = tier.rate;
        break;
      }
    }
    if (rate === 0) {
      rate = sortedTiers[sortedTiers.length - 1].rate;
    }
  } else {
    if (weight < 45) rate = 7.7;
    else if (weight < 100) rate = 6.9;
    else if (weight < 300) rate = 5.0;
    else if (weight < 500) rate = 4.28;
    else if (weight < 1000) rate = 3.9;
    else rate = 3.54;
  }

  const rawAmount = weight * rate;
  const finalFreight = Math.max(minAmount, rawAmount);
  
  return {
    rate,
    amount: finalFreight,
    isMinAmount: rawAmount < minAmount
  };
}

export function formatNumber(num: number | null | undefined, decimals: number = 2): string {
  if (num == null || isNaN(num)) return '';
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

const TURKISH_MONTHS: Record<string, number> = {
  ocak: 0,
  şubat: 1, subat: 1,
  mart: 2,
  nisan: 3,
  mayıs: 4, mayis: 4,
  haziran: 5,
  temmuz: 6,
  ağustos: 7, agustos: 7,
  eylül: 8, eylul: 8,
  ekim: 9,
  kasım: 10, kasim: 10,
  aralık: 11, aralik: 11,
};

/**
 * Validates a strict calendar date to prevent JavaScript date overflow
 * (e.g. 31.02.2026, 31.04.2026, 32.01.2026 are strictly rejected)
 */
export function isValidCalendarDate(day: number, month: number, year: number): boolean {
  if (!day || !month || !year || isNaN(day) || isNaN(month) || isNaN(year)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2100) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

export function parseDateFlexible(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (!s) return null;

  // Check DD.MM.YYYY or DD.MM.YY (e.g. 21.08.2026, 21/08/2026, 21-08-2026, 21.08.26)
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmy) {
    let year = Number(dmy[3]);
    if (dmy[3].length === 2) {
      year += year < 70 ? 2000 : 1900;
    }
    const month = Number(dmy[2]);
    const day = Number(dmy[1]);
    if (!isValidCalendarDate(day, month, year)) return null;
    return new Date(year, month - 1, day);
  }

  // Check Turkish text (e.g. "18 Eylül 2026" or "18 Eylül 2026 Cuma (38. Hafta)")
  const textMatch = s.toLowerCase().match(/^(\d{1,2})\s+([a-zçğıöşü]+)\s+(\d{4})/i);
  if (textMatch) {
    const monthKey = textMatch[2].toLowerCase();
    const monthIndex = TURKISH_MONTHS[monthKey];
    if (monthIndex !== undefined) {
      const year = Number(textMatch[3]);
      const month = monthIndex + 1;
      const day = Number(textMatch[1]);
      if (!isValidCalendarDate(day, month, year)) return null;
      return new Date(year, monthIndex, day);
    }
  }

  // Check YYYY-MM-DD (e.g. 2026-08-21)
  const ymd = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (!isValidCalendarDate(day, month, year)) return null;
    return new Date(year, month - 1, day);
  }

  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  // Verify parsed date against components to catch any native overflow
  if (!isValidCalendarDate(d.getDate(), d.getMonth() + 1, d.getFullYear())) return null;
  return d;
}

export function formatShipmentDateDetailed(dateStr: string | undefined): string {
  if (!dateStr) return 'Tarih seçilmedi';
  
  const d = parseDateFlexible(dateStr);
  if (!d) return 'Geçersiz tarih';
  const dateFmt = new Intl.DateTimeFormat('tr-TR', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric', 
    weekday: 'long' 
  }).format(d);
  const weekNo = getISOWeekNumber(d);
  return `${dateFmt} (${weekNo}. Hafta)`;
}

export function formatShipmentDateWithoutWeek(dateStr: string | undefined): string {
  if (!dateStr) return 'Tarih seçilmedi';
  
  const d = parseDateFlexible(dateStr);
  if (!d) return 'Geçersiz tarih';
  return new Intl.DateTimeFormat('tr-TR', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric', 
    weekday: 'long' 
  }).format(d);
}

/**
 * Sevkiyatın elle girilmesi gereken tüm hücrelerini/hanelerini kontrol eder.
 * Boş veya eksik olan alanların listesini döndürür.
 */
export function getShipmentMissingFields(shipment: Partial<Shipment> | undefined | null): string[] {
  if (!shipment) return ['Tüm sevkiyat bilgileri'];
  const missing: string[] = [];

  // 1. Genel Bilgiler
  if (!shipment.title?.trim()) {
    missing.push('Sevkiyat Başlığı / İsim');
  }
  if (!shipment.shipmentDate?.trim()) {
    missing.push('Sevkiyat Tarihi');
  }
  // Sorumlu Personel: 'Seçiniz' (boş/tanımsız) kaldığında eksik bilgisi verir. 'Boş Bırak' veya bir personel seçildiğinde eksik bilgi uyarısı kalkar.
  if (!shipment.responsiblePerson || !shipment.responsiblePerson.trim()) {
    missing.push('Sorumlu Personel');
  }

  // 2. Belgeler
  if (!shipment.bookingNo?.trim()) {
    missing.push('Booking No');
  }
  if (!shipment.awbNo?.trim()) {
    missing.push('AWB No');
  }

  const i7xVal = (shipment.i7xNo || '').replace(/^I7X-/, '').trim();
  if (!i7xVal) {
    missing.push('I7X Fatura No');
  }

  const d7xVal = (shipment.d7xNo || '').replace(/^D7X-/, '').trim();
  if (!d7xVal) {
    missing.push('D7X İrsaliye No');
  }

  const diVal = (shipment.diNo || '').replace(/^DI-/, '').trim();
  if (!diVal) {
    missing.push('DI Paketleme No');
  }

  const hasPo = Array.isArray(shipment.poNo) && shipment.poNo.some(p => p && p.trim().length > 0);
  if (!hasPo) {
    missing.push('PO No');
  }

  const hasCustomInv = Array.isArray(shipment.customInvoiceNo) && shipment.customInvoiceNo.some(c => c && c.trim().length > 0);
  if (!hasCustomInv) {
    missing.push('Yurtdışı Fatura No');
  }

  if (!shipment.eIrsaliyeNo?.trim()) {
    missing.push('E-İrsaliye No');
  }
  if (!shipment.eArsivNo?.trim()) {
    missing.push('E-Arşiv Fatura No');
  }
  if (!shipment.sbifNo?.trim()) {
    missing.push('SBİF No');
  }
  if (!shipment.sbifId?.trim()) {
    missing.push('SBİF ID');
  }

  // 3. Palet ve Koli Bilgileri
  if (!shipment.pallets || shipment.pallets.length === 0) {
    missing.push('Palet Bilgisi (Palet eklenmemiş)');
  } else {
    shipment.pallets.forEach((p, pIdx) => {
      const pLabel = `${pIdx + 1}. Palet`;
      if (!p.palletDimensions?.trim()) {
        missing.push(`${pLabel}: Palet Ölçüsü`);
      }
      if (p.palletWeight == null || Number(p.palletWeight) <= 0) {
        missing.push(`${pLabel}: Palet Dara (kg)`);
      }

      if (!p.products || p.products.length === 0) {
        missing.push(`${pLabel}: Ürün Bilgisi (Ürün eklenmemiş)`);
      } else {
        p.products.forEach((prod, prIdx) => {
          const prodLabel = `${pLabel} / ${prIdx + 1}. Ürün`;
          const missingProdFields: string[] = [];
          if (!prod.boxDimensions?.trim()) missingProdFields.push('Koli Ölçüsü');
          if (!prod.materialCode?.trim()) missingProdFields.push('Malz. Kodu');
          if (!prod.materialDescription?.trim()) missingProdFields.push('Malz. Tanımı');
          if (prod.itemsPerBox == null || Number(prod.itemsPerBox) <= 0) missingProdFields.push('Koli İçi Adet');
          if (prod.boxCount == null || Number(prod.boxCount) <= 0) missingProdFields.push('Koli Adedi');
          if (prod.boxWeight == null || Number(prod.boxWeight) <= 0) missingProdFields.push('Koli Ağırlığı');

          if (missingProdFields.length > 0) {
            missing.push(`${prodLabel}: ${missingProdFields.join(', ')}`);
          }
        });
      }
    });
  }

  return missing;
}

/**
 * Sevkiyat tarihinin bugünden ileri bir tarih (yarın veya sonrası) olup olmadığını kontrol eder.
 */
export function isFutureShipment(dateStr: string | undefined | null): boolean {
  if (!dateStr) return false;
  const d = parseDateFlexible(dateStr);
  if (!d) return false;
  const today = new Date();
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  return d.getTime() > endOfToday.getTime();
}

/**
 * Sevkiyat listesinde dikkate alınan eksik alanlar.
 * Tarihi bugünden ileri olan (gelecek tarihli) sevkiyatlar listede eksik bilgi olarak işaretlenmez.
 */
export function getShipmentListMissingFields(shipment: Partial<Shipment> | undefined | null): string[] {
  if (!shipment) return [];
  if (isFutureShipment(shipment.shipmentDate)) {
    return [];
  }
  return getShipmentMissingFields(shipment);
}

/**
 * Bir paletin Net, Dara ve Brüt ağırlıklarını hesaplar.
 */
export function calculatePalletWeights(pallet: PalletData | undefined | null) {
  if (!pallet) return { netWeight: 0, tareWeight: 0, grossWeight: 0 };
  
  const netWeight = (pallet.products || []).reduce((acc, pr) => {
    return acc + ((Number(pr.boxCount) || 0) * (Number(pr.boxWeight) || 0));
  }, 0);
  const tareWeight = Number(pallet.palletWeight) || 0;
  const grossWeight = netWeight + tareWeight;

  return {
    netWeight: Math.round(netWeight * 100) / 100,
    tareWeight: Math.round(tareWeight * 100) / 100,
    grossWeight: Math.round(grossWeight * 100) / 100
  };
}

/**
 * Bir sevkiyatın palet sayısı, Net, Dara ve Brüt ağırlıklarını dinamik olarak hesaplar.
 */
export function calculateShipmentWeights(shipment: Partial<Shipment> | undefined | null) {
  if (!shipment) return { totalPallets: 0, netWeight: 0, tareWeight: 0, grossWeight: 0 };
  
  const pallets = shipment.pallets || [];
  const totalPallets = pallets.length;
  
  let netWeight = 0;
  let tareWeight = 0;

  pallets.forEach(p => {
    const pw = calculatePalletWeights(p);
    netWeight += pw.netWeight;
    tareWeight += pw.tareWeight;
  });

  let grossWeight = netWeight + tareWeight;
  
  // Eğer palet yoksa fakat sevkiyata ait girilmiş chargeableWeight varsa brüt ağırlık için yedek olarak değerlendir
  if (grossWeight === 0 && Number(shipment.chargeableWeight) > 0) {
    grossWeight = Number(shipment.chargeableWeight);
  }

  return {
    totalPallets,
    netWeight: Math.round(netWeight * 100) / 100,
    tareWeight: Math.round(tareWeight * 100) / 100,
    grossWeight: Math.round(grossWeight * 100) / 100
  };
}

/**
 * Verilen yıl ve ISO hafta numarası için haftanın Pazartesi ve Pazar günlerini döndürür.
 */
export function getISOWeekDateRange(year: number, week: number): { start: Date; end: Date } {
  // ISO hafta 1, yılın ilk Perşembe gününü içeren haftadır
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const isoWeekStart = new Date(simple);
  if (dow <= 4) {
    isoWeekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  } else {
    isoWeekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  }
  const isoWeekEnd = new Date(isoWeekStart);
  isoWeekEnd.setUTCDate(isoWeekStart.getUTCDate() + 6);
  return { start: isoWeekStart, end: isoWeekEnd };
}

/**
 * Benzersiz rastgele kimlik (ID) üretir.
 */
export function generateId(prefix: string = ''): string {
  const randomStr = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${Date.now()}_${randomStr}` : randomStr;
}

export type UniqueDocFieldKey =
  | 'bookingNo'
  | 'customInvoiceNo'
  | 'i7xNo'
  | 'd7xNo'
  | 'diNo'
  | 'eArsivNo'
  | 'eIrsaliyeNo'
  | 'sbifNo'
  | 'sbifId';

export interface ConflictingShipmentRef {
  id: string;
  title: string;
  shipmentDate?: string;
  isCancelled?: boolean;
}

export interface DocumentConflict {
  field: UniqueDocFieldKey;
  label: string;
  value: string;
  normalizedValue: string;
  isSelfDuplicate?: boolean;
  otherShipments: ConflictingShipmentRef[];
}

function normalizeDocNumber(val: string | undefined | null, stripPrefix?: RegExp): string {
  if (!val) return '';
  let clean = String(val).trim();
  if (stripPrefix) {
    clean = clean.replace(stripPrefix, '').trim();
  }
  return clean.replace(/\s+/g, ' ').toUpperCase();
}

function getShipmentDisplayName(s: Shipment): string {
  const title = s.title?.trim();
  if (title) return title;
  if (s.bookingNo?.trim()) return `Sevkiyat (${s.bookingNo.trim()})`;
  return 'İsimsiz Sevkiyat';
}

const SINGLE_UNIQUE_DOC_FIELDS: {
  key: Exclude<UniqueDocFieldKey, 'customInvoiceNo'>;
  label: string;
  stripPrefix?: RegExp;
}[] = [
  { key: 'bookingNo', label: 'Booking No' },
  { key: 'i7xNo', label: 'I7X Fatura', stripPrefix: /^I7X[-\s_.:]*/i },
  { key: 'd7xNo', label: 'D7X İrsaliye', stripPrefix: /^D7X[-\s_.:]*/i },
  { key: 'diNo', label: 'DI Paketleme', stripPrefix: /^DI[-\s_.:]*/i },
  { key: 'eArsivNo', label: 'E-Arşiv Fatura No' },
  { key: 'eIrsaliyeNo', label: 'E-İrsaliye No' },
  { key: 'sbifNo', label: 'SBİF No' },
  { key: 'sbifId', label: 'SBİF ID' },
];

/**
 * Belgeler bölümündeki benzersiz olması gereken alanlarda (AWB No ve PO No hariç)
 * diğer sevkiyatlarla veya aynı sevkiyat içinde çakışan/mükerrer numaraları tespit eder.
 */
export function findDocumentConflicts(
  current: Omit<Shipment, 'id' | 'createdAt'>,
  currentId: string | null | undefined,
  allShipments: Shipment[]
): DocumentConflict[] {
  const conflicts: DocumentConflict[] = [];
  const otherShipmentsList = allShipments.filter(
    s => !currentId || currentId === 'new' || s.id !== currentId
  );

  // 1. Tekil metin alanları (Booking No, I7X, D7X, DI, E-Arşiv, E-İrsaliye, SBİF No, SBİF ID)
  for (const fieldDef of SINGLE_UNIQUE_DOC_FIELDS) {
    const rawVal = current[fieldDef.key];
    const normVal = normalizeDocNumber(rawVal, fieldDef.stripPrefix);
    if (!normVal) continue;

    const matched: ConflictingShipmentRef[] = [];
    for (const other of otherShipmentsList) {
      const otherNorm = normalizeDocNumber(other[fieldDef.key], fieldDef.stripPrefix);
      if (otherNorm && otherNorm === normVal) {
        matched.push({
          id: other.id,
          title: getShipmentDisplayName(other),
          shipmentDate: other.shipmentDate,
          isCancelled: other.isCancelled,
        });
      }
    }

    if (matched.length > 0) {
      conflicts.push({
        field: fieldDef.key,
        label: fieldDef.label,
        value: String(rawVal).trim(),
        normalizedValue: normVal,
        otherShipments: matched,
      });
    }
  }

  // 2. Çoklu alan: Yurtdışı Fatura No (customInvoiceNo) - hem kendi içinde hem diğer sevkiyatlarda kontrol
  const currentInvoices = Array.isArray(current.customInvoiceNo) ? current.customInvoiceNo : [];
  if (currentInvoices.length > 0) {
    const counts = new Map<string, { raw: string; count: number }>();
    for (const inv of currentInvoices) {
      const norm = normalizeDocNumber(inv);
      if (!norm) continue;
      const existing = counts.get(norm);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(norm, { raw: inv.trim(), count: 1 });
      }
    }

    for (const [normVal, info] of counts.entries()) {
      const matched: ConflictingShipmentRef[] = [];
      for (const other of otherShipmentsList) {
        const otherInvoices = Array.isArray(other.customInvoiceNo) ? other.customInvoiceNo : [];
        const hasMatch = otherInvoices.some(inv => normalizeDocNumber(inv) === normVal);
        if (hasMatch) {
          matched.push({
            id: other.id,
            title: getShipmentDisplayName(other),
            shipmentDate: other.shipmentDate,
            isCancelled: other.isCancelled,
          });
        }
      }

      const isSelfDuplicate = info.count > 1;
      if (isSelfDuplicate || matched.length > 0) {
        conflicts.push({
          field: 'customInvoiceNo',
          label: 'Yurtdışı Fatura No',
          value: info.raw,
          normalizedValue: normVal,
          isSelfDuplicate,
          otherShipments: matched,
        });
      }
    }
  }

  return conflicts;
}


