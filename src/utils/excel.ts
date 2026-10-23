import { Shipment, PalletData, ProductRow } from '../types';
import { generateId, isValidCalendarDate } from './calculations';

// Lazy-load ExcelJS dynamically to keep initial bundle ultra-light
async function getExcelJS() {
  const mod = await import('exceljs');
  return mod.default || mod;
}

// --- GENERAL DATA EXCEL ---
const generalHeaders = [
  "Başlık", "Sevkiyat Tarihi", "Booking No", "AWB No", "PO Numaraları",
  "Gümrük Fatura Numaraları", "I7X No", "D7X No", "DI No", "E-Arşiv No",
  "E-İrsaliye No", "SBİF No", "SBİF ID", "Fatura Toplam Tutarı", "Ücrete Tabi Ağırlık", "Sorumlu Kişi", "Notlar"
];

export function formatDateToDMY(dateVal: any): string {
  if (!dateVal && dateVal !== 0) return "";
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    const day = dateVal.getDate();
    const month = dateVal.getMonth() + 1;
    const year = dateVal.getFullYear();
    if (!isValidCalendarDate(day, month, year)) return "";
    return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
  }

  const s = String(dateVal).trim();
  if (!s) return "";

  // Already DD.MM.YYYY (e.g. 21.08.2026)
  const dmyMatch = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    if (!isValidCalendarDate(day, month, year)) return "";
    return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
  }

  // YYYY-MM-DD (e.g. 2026-08-21)
  const ymdMatch = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    if (!isValidCalendarDate(day, month, year)) return "";
    return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
  }

  // Fallback JS Date parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    if (!isValidCalendarDate(day, month, year)) return "";
    return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
  }

  return s;
}

export function parseExcelDateToISO(val: any): string {
  if (!val && val !== 0) return "";

  // Excel serial number (e.g. 45550)
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      const day = date.getUTCDate();
      if (!isValidCalendarDate(day, month, year)) return "";
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  if (val instanceof Date && !isNaN(val.getTime())) {
    const year = val.getFullYear();
    const month = val.getMonth() + 1;
    const day = val.getDate();
    if (!isValidCalendarDate(day, month, year)) return "";
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const s = String(val).trim();
  if (!s) return "";

  // DD.MM.YYYY (e.g. 21.08.2026) -> YYYY-MM-DD
  const dmyMatch = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    if (!isValidCalendarDate(day, month, year)) return "";
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // YYYY-MM-DD -> return normalized YYYY-MM-DD
  const ymdMatch = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    if (!isValidCalendarDate(day, month, year)) return "";
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    if (!isValidCalendarDate(day, month, year)) return "";
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return s;
}

function extractCellValue(cellVal: any): any {
  if (cellVal === null || cellVal === undefined) return '';
  if (typeof cellVal === 'object') {
    if (cellVal instanceof Date) return cellVal;
    if ('result' in cellVal) return cellVal.result;
    if ('text' in cellVal) return cellVal.text;
  }
  return cellVal;
}

export async function exportGeneralDataToExcel(shipments: Shipment[]): Promise<void> {
  const ExcelJS = await getExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'İhracat Operasyon Paneli';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Genel Bilgiler', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  worksheet.columns = generalHeaders.map(header => ({
    header,
    key: header,
    width: Math.max(header.length + 4, 16)
  }));

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }
  };

  const rows = shipments.length === 0 ? [{
    "Başlık": "Örnek Sevkiyat",
    "Sevkiyat Tarihi": "21.08.2026",
    "Booking No": "BKG-123456",
    "AWB No": "020-12345678",
    "PO Numaraları": "PO-1001, PO-1002",
    "Gümrük Fatura Numaraları": "INV-2026-001",
    "I7X No": "I7X-554433",
    "D7X No": "D7X-112233",
    "DI No": "DI-998877",
    "E-Arşiv No": "EAR2026000000001",
    "E-İrsaliye No": "GIB2026000000001",
    "SBİF No": "SBIF-2026-001",
    "SBİF ID": "ID-998877",
    "Fatura Toplam Tutarı": 12500.50,
    "Ücrete Tabi Ağırlık": 450.25,
    "Sorumlu Kişi": "Ahmet Yılmaz",
    "Notlar": "Örnek sevkiyat notu"
  }] : shipments.map(shipment => ({
    "Başlık": shipment.title || "",
    "Sevkiyat Tarihi": formatDateToDMY(shipment.shipmentDate),
    "Booking No": shipment.bookingNo || "",
    "AWB No": shipment.awbNo || "",
    "PO Numaraları": (shipment.poNo || []).join(", "),
    "Gümrük Fatura Numaraları": (shipment.customInvoiceNo || []).join(", "),
    "I7X No": shipment.i7xNo || "",
    "D7X No": shipment.d7xNo || "",
    "DI No": shipment.diNo || "",
    "E-Arşiv No": shipment.eArsivNo || "",
    "E-İrsaliye No": shipment.eIrsaliyeNo || "",
    "SBİF No": shipment.sbifNo || "",
    "SBİF ID": shipment.sbifId || "",
    "Fatura Toplam Tutarı": shipment.invoiceTotalAmount || 0,
    "Ücrete Tabi Ağırlık": shipment.chargeableWeight || 0,
    "Sorumlu Kişi": shipment.responsiblePerson || "",
    "Notlar": shipment.notes || ""
  }));

  rows.forEach(r => worksheet.addRow(r));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Toplu_Sevkiyatlar_${formatDateToDMY(new Date())}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importGeneralDataFromExcel(file: File): Promise<Partial<Shipment>[]> {
  const buffer = await file.arrayBuffer();
  const ExcelJS = await getExcelJS();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers: Record<number, string> = {};
  const json: Record<string, any>[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value ? String(cell.value).trim() : '';
      });
    } else {
      const rowData: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          rowData[header] = extractCellValue(cell.value);
        }
      });
      if (Object.keys(rowData).length > 0) {
        json.push(rowData);
      }
    }
  });

  const parseArr = (val: any) => val ? String(val).split(',').map(s => s.trim()).filter(Boolean) : [];

  return json.map(row => ({
    title: row["Başlık"] ? String(row["Başlık"]) : "",
    shipmentDate: parseExcelDateToISO(row["Sevkiyat Tarihi"]),
    bookingNo: row["Booking No"] ? String(row["Booking No"]) : "",
    awbNo: row["AWB No"] ? String(row["AWB No"]) : "",
    poNo: parseArr(row["PO Numaraları"]),
    customInvoiceNo: parseArr(row["Gümrük Fatura Numaraları"]),
    i7xNo: row["I7X No"] ? String(row["I7X No"]) : "",
    d7xNo: row["D7X No"] ? String(row["D7X No"]) : "",
    diNo: row["DI No"] ? String(row["DI No"]) : "",
    eArsivNo: row["E-Arşiv No"] ? String(row["E-Arşiv No"]) : "",
    eIrsaliyeNo: row["E-İrsaliye No"] ? String(row["E-İrsaliye No"]) : "",
    sbifNo: row["SBİF No"] ? String(row["SBİF No"]) : "",
    sbifId: row["SBİF ID"] ? String(row["SBİF ID"]) : "",
    invoiceTotalAmount: Number(row["Fatura Toplam Tutarı"]) || 0,
    chargeableWeight: Number(row["Ücrete Tabi Ağırlık"]) || 0,
    responsiblePerson: row["Sorumlu Kişi"] ? String(row["Sorumlu Kişi"]) : "",
    notes: row["Notlar"] ? String(row["Notlar"]) : ""
  }));
}

// --- PALLET DATA EXCEL ---
const palletHeaders = [
  "Palet No", "Palet Ölçüleri", "Palet Ağırlığı", 
  "Koli Ölçüleri", "Malzeme Kodu", "Malzeme Açıklaması", 
  "Koli İçi Adet", "Koli Sayısı", "Koli Ağırlığı"
];

export async function exportPalletDataToExcel(pallets: PalletData[], filenameSuffix: string): Promise<void> {
  const ExcelJS = await getExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'İhracat Operasyon Paneli';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Palet ve Koli Bilgileri', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  worksheet.columns = palletHeaders.map(header => ({
    header,
    key: header,
    width: Math.max(header.length + 4, 15)
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }
  };

  const rows: any[] = [];
  
  if (pallets.length === 0) {
    rows.push({
      "Palet No": 1,
      "Palet Ölçüleri": "",
      "Palet Ağırlığı": 0,
      "Koli Ölçüleri": "",
      "Malzeme Kodu": "",
      "Malzeme Açıklaması": "",
      "Koli İçi Adet": 0,
      "Koli Sayısı": 0,
      "Koli Ağırlığı": 0
    });
  } else {
    pallets.forEach((pallet, pIdx) => {
      const palletNo = pIdx + 1;
      if (pallet.products.length === 0) {
        rows.push({
          "Palet No": palletNo,
          "Palet Ölçüleri": pallet.palletDimensions,
          "Palet Ağırlığı": pallet.palletWeight,
          "Koli Ölçüleri": "",
          "Malzeme Kodu": "",
          "Malzeme Açıklaması": "",
          "Koli İçi Adet": 0,
          "Koli Sayısı": 0,
          "Koli Ağırlığı": 0
        });
      } else {
        pallet.products.forEach(prod => {
          rows.push({
            "Palet No": palletNo,
            "Palet Ölçüleri": pallet.palletDimensions,
            "Palet Ağırlığı": pallet.palletWeight,
            "Koli Ölçüleri": prod.boxDimensions,
            "Malzeme Kodu": prod.materialCode,
            "Malzeme Açıklaması": prod.materialDescription,
            "Koli İçi Adet": prod.itemsPerBox,
            "Koli Sayısı": prod.boxCount,
            "Koli Ağırlığı": prod.boxWeight
          });
        });
      }
    });
  }

  rows.forEach(r => worksheet.addRow(r));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Sevkiyat_Paletler_${filenameSuffix}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importPalletDataFromExcel(file: File): Promise<PalletData[]> {
  const buffer = await file.arrayBuffer();
  const ExcelJS = await getExcelJS();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers: Record<number, string> = {};
  const json: Record<string, any>[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value ? String(cell.value).trim() : '';
      });
    } else {
      const rowData: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          rowData[header] = extractCellValue(cell.value);
        }
      });
      if (Object.keys(rowData).length > 0) {
        json.push(rowData);
      }
    }
  });

  const palletMap = new Map<number, PalletData>();

  json.forEach(row => {
    const pNo = Number(row["Palet No"]) || 1;
    
    if (!palletMap.has(pNo)) {
      palletMap.set(pNo, {
        id: generateId('pal'),
        palletDimensions: row["Palet Ölçüleri"] ? String(row["Palet Ölçüleri"]) : "",
        palletWeight: Number(row["Palet Ağırlığı"]) || 0,
        products: []
      });
    }

    const pallet = palletMap.get(pNo)!;
    
    // If there is product info
    if (row["Malzeme Kodu"] || row["Malzeme Açıklaması"]) {
      pallet.products.push({
        id: generateId('prod'),
        boxDimensions: row["Koli Ölçüleri"] ? String(row["Koli Ölçüleri"]) : "",
        materialCode: row["Malzeme Kodu"] ? String(row["Malzeme Kodu"]) : "",
        materialDescription: row["Malzeme Açıklaması"] ? String(row["Malzeme Açıklaması"]) : "",
        itemsPerBox: Number(row["Koli İçi Adet"]) || 0,
        boxCount: Number(row["Koli Sayısı"]) || 0,
        boxWeight: Number(row["Koli Ağırlığı"]) || 0,
      });
    }
  });

  return Array.from(palletMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(entry => entry[1]);
}
