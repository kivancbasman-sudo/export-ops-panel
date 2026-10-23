import { Shipment, EmailTemplate } from '../types';
import { formatNumber, formatShipmentDateWithoutWeek, getISOWeekNumber, parseDateFlexible } from './calculations';

export interface TemplateVariable {
  key: string;
  label: string;
  description: string;
  sample: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: '{D7X_NO}', label: 'D7X İrsaliye No', description: 'Sevkiyatın D7X irsaliye numarası', sample: 'D7X-123456' },
  { key: '{I7X_NO}', label: 'I7X Fatura No', description: 'Sevkiyatın I7X fatura numarası', sample: 'I7X-987654' },
  { key: '{DI_NO}', label: 'DI Paketleme No', description: 'DI paketleme/çeki listesi numarası', sample: 'DI-554433' },
  { key: '{BOOKING_NO}', label: 'Booking No', description: 'Havayolu/taşıyıcı rezervasyon numarası', sample: 'BKG-998811' },
  { key: '{AWB_NO}', label: 'AWB No', description: 'Hava konşimento numarası (Air Waybill)', sample: '020-12345678' },
  { key: '{PO_NO}', label: 'PO Numaraları', description: 'Sipariş (PO) numaraları listesi', sample: 'PO-1001, PO-1002' },
  { key: '{YURTDISI_FATURA_NO}', label: 'Yurtdışı Fatura No', description: 'Yurtdışı gümrük fatura numaraları', sample: 'EXP-2026-001' },
  { key: '{E_IRSALIYE_NO}', label: 'E-İrsaliye No', description: 'Resmi E-İrsaliye numarası', sample: 'GIB20260000001' },
  { key: '{E_ARSIV_NO}', label: 'E-Arşiv Fatura No', description: 'Resmi E-Arşiv fatura numarası', sample: 'EAR20260000001' },
  { key: '{SBIF_NO}', label: 'SBİF No', description: 'Serbest Bölge İşlem Formu numarası', sample: 'SBİF-10293' },
  { key: '{SBIF_ID}', label: 'SBİF ID', description: 'Serbest Bölge İşlem Formu ID numarası', sample: '984726' },
  { key: '{TARIH}', label: 'Sevkiyat Tarihi', description: 'Sevkiyat tarihi ve gün adı', sample: '22 Eylül 2026 Salı' },
  { key: '{HAFTA_NO}', label: 'Hafta Numarası', description: 'Sevkiyat tarihinin ISO hafta numarası (1-53)', sample: '38' },
  { key: '{HAFTA}', label: 'Hafta (Metin)', description: 'Sevkiyat haftası (örn: 38. Hafta)', sample: '38. Hafta' },
  { key: '{SORUMLU}', label: 'Sorumlu Personel', description: 'Operasyondan sorumlu kişi', sample: 'Kıvanç' },
  { key: '{BASLIK}', label: 'Sevkiyat Başlığı', description: 'Sevkiyatın başlığı/müşteri adı', sample: 'Frankfurt Sevkiyatı' },
  { key: '{PALET_SAYISI}', label: 'Palet Sayısı', description: 'Toplam palet adedi', sample: '4' },
  { key: '{PALET_BOYUTU}', label: 'Palet Boyutu', description: 'Palet ölçüleri (alt alta ve cm ile)', sample: '1. Palet: 80x120x147 cm\n2. Palet: 80x120x114 cm' },
  { key: '{PALET_OLCULERI}', label: 'Palet Ölçüleri', description: 'Palet ölçüleri (alt alta ve cm ile)', sample: '1. Palet: 80x120x147 cm\n2. Palet: 80x120x114 cm' },
  { key: '{KOLI_SAYISI}', label: 'Koli Sayısı', description: 'Toplam koli adedi', sample: '120' },
  { key: '{BRUT_KILO}', label: 'Brüt/Şarj Kilo', description: 'Şarj edilebilir / brüt ağırlık (kg)', sample: '1.450' },
  { key: '{FATURA_TUTARI}', label: 'Fatura Tutarı', description: 'Toplam fatura tutarı ($)', sample: '$14,500.00' },
  { key: '{EKLER}', label: 'Eklenecek Belgeler', description: 'Şablonda tanımlı belgelerin liste hali', sample: '1. D7X İrsaliye\n2. DI Paketleme' }
];

export interface RenderedEmail {
  subject: string;
  body: string;
  missingPlaceholders: { key: string; label: string }[];
  attachments: { name: string; isProvidedInShipment: boolean }[];
}

export function renderEmailTemplate(
  template: EmailTemplate,
  shipment: Partial<Shipment>
): RenderedEmail {
  const missingPlaceholders: { key: string; label: string }[] = [];

  // 1. Calculate pallets & weight
  const pallets = shipment.pallets || [];
  const palletCount = pallets.length;
  const boxCount = pallets.reduce((acc, p) => acc + (p.products || []).reduce((prAcc, pr) => prAcc + (pr.boxCount || 0), 0), 0);
  const netWeight = pallets.reduce((acc, p) => acc + (p.products || []).reduce((prAcc, pr) => prAcc + ((pr.boxCount || 0) * (pr.boxWeight || 0)), 0), 0);
  const tareWeight = pallets.reduce((acc, p) => acc + (p.palletWeight || 0), 0);
  const totalWeight = netWeight + tareWeight;
  const chargeableWeight = shipment.chargeableWeight || Math.round(totalWeight);

  // Helper to clean manual prefixes and redundant cm suffixes
  const cleanDimension = (dimStr: string): string => {
    let cleaned = (dimStr || '').trim();
    // Strip leading labels like "1. Palet:", "Palet 1:", "1.Palet:", "Palet:", etc.
    cleaned = cleaned.replace(/^(?:\d+\s*[\.\)]\s*)?(?:palet|pallet)\s*(?:\d+)?\s*[:\-\s]\s*/i, '').trim();
    cleaned = cleaned.replace(/^(?:\d+\s*[\.\)]\s*)?(?:palet|pallet)\s*(?:\d+)?\s*[:\-\s]\s*/i, '').trim();
    // Strip trailing cm/sm
    cleaned = cleaned.replace(/\s*(?:cm|sm)\.?$/i, '').trim();
    return cleaned;
  };

  // Pallet dimensions formatting: line by line with "cm" at the end of each line
  const palletLines: string[] = [];
  pallets.forEach((p, idx) => {
    const raw = (p.palletDimensions || '').trim();
    if (raw) {
      const clean = cleanDimension(raw);
      if (clean) {
        palletLines.push(`${idx + 1}. Palet: ${clean} cm`);
      }
    }
  });

  const palletDimensionsString = palletLines.join('\n');

  // 2. Format POs and Custom Invoices
  const poString = Array.isArray(shipment.poNo)
    ? shipment.poNo.filter(Boolean).join(', ')
    : (shipment.poNo || '');

  const customInvoiceString = Array.isArray(shipment.customInvoiceNo)
    ? shipment.customInvoiceNo.filter(Boolean).join(', ')
    : (shipment.customInvoiceNo || '');

  // 3. Format Date & Week (Mail şablonu {TARIH} değişkeni için: hafta numarası hariç, sadece gün ve tarih örn. 22 Eylül 2026 Salı)
  const dateFormatted = shipment.shipmentDate
    ? formatShipmentDateWithoutWeek(shipment.shipmentDate)
    : '';

  const parsedDate = parseDateFlexible(shipment.shipmentDate);
  const weekNumber = parsedDate ? getISOWeekNumber(parsedDate) : null;
  const weekString = weekNumber ? String(weekNumber) : '';
  const weekText = weekNumber ? `${weekNumber}. Hafta` : '';

  // 4. Attachments formatting
  const attachmentList = (template.attachments || []).map((att, idx) => `${idx + 1}. ${att}`).join('\n');

  // Values map
  const valueMap: Record<string, { value: string; label: string; isMissing: boolean }> = {
    '{D7X_NO}': {
      value: shipment.d7xNo?.trim() || '',
      label: 'D7X İrsaliye No',
      isMissing: !shipment.d7xNo?.trim()
    },
    '{I7X_NO}': {
      value: shipment.i7xNo?.trim() || '',
      label: 'I7X Fatura No',
      isMissing: !shipment.i7xNo?.trim()
    },
    '{DI_NO}': {
      value: shipment.diNo?.trim() || '',
      label: 'DI Paketleme No',
      isMissing: !shipment.diNo?.trim()
    },
    '{BOOKING_NO}': {
      value: shipment.bookingNo?.trim() || '',
      label: 'Booking No',
      isMissing: !shipment.bookingNo?.trim()
    },
    '{AWB_NO}': {
      value: shipment.awbNo?.trim() || '',
      label: 'AWB No',
      isMissing: !shipment.awbNo?.trim()
    },
    '{PO_NO}': {
      value: poString || '',
      label: 'PO No',
      isMissing: !poString
    },
    '{YURTDISI_FATURA_NO}': {
      value: customInvoiceString || '',
      label: 'Yurtdışı Fatura No',
      isMissing: !customInvoiceString
    },
    '{E_IRSALIYE_NO}': {
      value: shipment.eIrsaliyeNo?.trim() || '',
      label: 'E-İrsaliye No',
      isMissing: !shipment.eIrsaliyeNo?.trim()
    },
    '{E_ARSIV_NO}': {
      value: shipment.eArsivNo?.trim() || '',
      label: 'E-Arşiv Fatura No',
      isMissing: !shipment.eArsivNo?.trim()
    },
    '{SBIF_NO}': {
      value: shipment.sbifNo?.trim() || '',
      label: 'SBİF No',
      isMissing: !shipment.sbifNo?.trim()
    },
    '{SBIF_ID}': {
      value: shipment.sbifId?.trim() || '',
      label: 'SBİF ID',
      isMissing: !shipment.sbifId?.trim()
    },
    '{TARIH}': {
      value: dateFormatted || '',
      label: 'Sevkiyat Tarihi',
      isMissing: !dateFormatted
    },
    '{HAFTA_NO}': {
      value: weekString,
      label: 'Hafta Numarası',
      isMissing: !weekString
    },
    '{HAFTA_NUMARASI}': {
      value: weekString,
      label: 'Hafta Numarası',
      isMissing: !weekString
    },
    '{WEEK_NO}': {
      value: weekString,
      label: 'Hafta Numarası',
      isMissing: !weekString
    },
    '{HAFTA}': {
      value: weekText,
      label: 'Sevkiyat Haftası',
      isMissing: !weekText
    },
    '{SORUMLU}': {
      value: (shipment.responsiblePerson && shipment.responsiblePerson !== 'Boş Bırak') ? shipment.responsiblePerson : 'İhracat Operasyon',
      label: 'Sorumlu Personel',
      isMissing: false
    },
    '{BASLIK}': {
      value: shipment.title?.trim() || 'İhracat Sevkiyatı',
      label: 'Sevkiyat Başlığı',
      isMissing: false
    },
    '{PALET_SAYISI}': {
      value: palletCount ? String(palletCount) : '0',
      label: 'Palet Sayısı',
      isMissing: palletCount === 0
    },
    '{PALET_BOYUTU}': {
      value: palletDimensionsString || '',
      label: 'Palet Boyutu',
      isMissing: !palletDimensionsString
    },
    '{PALET_OLCULERI}': {
      value: palletDimensionsString || '',
      label: 'Palet Boyutu',
      isMissing: !palletDimensionsString
    },
    '{KOLI_SAYISI}': {
      value: boxCount ? String(boxCount) : '0',
      label: 'Koli Sayısı',
      isMissing: boxCount === 0
    },
    '{BRUT_KILO}': {
      value: chargeableWeight ? formatNumber(chargeableWeight) : '0',
      label: 'Brüt / Şarj Ağırlık',
      isMissing: chargeableWeight === 0
    },
    '{FATURA_TUTARI}': {
      value: shipment.invoiceTotalAmount ? `$${formatNumber(shipment.invoiceTotalAmount, 2)}` : '$0.00',
      label: 'Fatura Tutarı',
      isMissing: !shipment.invoiceTotalAmount
    },
    '{EKLER}': {
      value: attachmentList || '(Ek belge belirtilmedi)',
      label: 'Eklenecek Belgeler',
      isMissing: false
    }
  };

  let renderedSubject = template.subject || '';
  let renderedBody = template.body || '';

  // Scan and replace all variables
  Object.entries(valueMap).forEach(([key, info]) => {
    const isUsedInSubject = renderedSubject.includes(key);
    const isUsedInBody = renderedBody.includes(key);

    if (isUsedInSubject || isUsedInBody) {
      if (info.isMissing && !missingPlaceholders.some(m => m.key === key)) {
        missingPlaceholders.push({ key, label: info.label });
      }

      const replacement = info.value || `[${info.label}: Belirtilmedi]`;
      renderedSubject = renderedSubject.replaceAll(key, replacement);
      renderedBody = renderedBody.replaceAll(key, replacement);
    }
  });

  // Attachments check against shipment
  const attachments = (template.attachments || []).map(att => {
    const lower = att.toLowerCase();
    let isProvided = false;
    if (lower.includes('d7x') && shipment.d7xNo?.trim()) isProvided = true;
    else if (lower.includes('i7x') && shipment.i7xNo?.trim()) isProvided = true;
    else if (lower.includes('di') && shipment.diNo?.trim()) isProvided = true;
    else if (lower.includes('awb') && shipment.awbNo?.trim()) isProvided = true;
    else if (lower.includes('booking') && shipment.bookingNo?.trim()) isProvided = true;
    else if (lower.includes('e-irsaliye') && shipment.eIrsaliyeNo?.trim()) isProvided = true;
    else if (lower.includes('e-arşiv') && shipment.eArsivNo?.trim()) isProvided = true;
    else if (lower.includes('yurtdışı') && customInvoiceString) isProvided = true;
    else if (lower.includes('sbif') && (shipment.sbifNo?.trim() || shipment.sbifId?.trim())) isProvided = true;
    else {
      // General attachment
      isProvided = true;
    }
    return { name: att, isProvidedInShipment: isProvided };
  });

  return {
    subject: renderedSubject,
    body: renderedBody,
    missingPlaceholders,
    attachments
  };
}
