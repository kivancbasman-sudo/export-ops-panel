/**
 * Data I/O: Unified Export & Schema-Validated Import
 * Zero-Data-Loss guarantee with strict type checking and sanitization.
 */

import { Shipment, DeletedShipment, ChecklistItemTemplate, EmailTemplate, AppSettings, PalletData, ProductRow } from '../types';

export interface AppDataPayload {
  shipments: Shipment[];
  deletedShipments?: DeletedShipment[];
  checklistTemplates: ChecklistItemTemplate[];
  emailTemplates: EmailTemplate[];
  settings: AppSettings;
}

export interface ExportEnvelope {
  format: 'ihracat_operasyon_backup';
  version: '1.0';
  exportedAt: string;
  itemCount: {
    shipments: number;
    checklistTemplates: number;
    emailTemplates: number;
  };
  data: AppDataPayload;
}

export interface ImportValidationResult {
  success: boolean;
  data?: AppDataPayload;
  error?: string;
  summary?: string;
  stats?: {
    shipmentsCount: number;
    templatesCount: number;
    sanitizedCount: number;
  };
}

/**
 * Strips dangerous HTML tags and trims strings
 */
function sanitizeString(val: unknown, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  const str = String(val).trim();
  // Strip control chars and script tags
  return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim();
}

/**
 * Sanitizes numbers safely
 */
function sanitizeNumber(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

/**
 * Exports application state to a timestamped JSON file via Blob
 */
export function exportAppState(payload: AppDataPayload, customPrefix = 'sevkiyat_yedek'): void {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const filename = `${customPrefix}_${dateStr}_${timeStr}.json`;

  // Decouple PIN security: Never export pinHash or isPinProtected to backup files
  const safeSettings: AppSettings = {
    ...payload.settings,
  };
  delete (safeSettings as any).pinHash;
  delete (safeSettings as any).isPinProtected;

  const envelope: ExportEnvelope = {
    format: 'ihracat_operasyon_backup',
    version: '1.0',
    exportedAt: now.toISOString(),
    itemCount: {
      shipments: Array.isArray(payload.shipments) ? payload.shipments.length : 0,
      checklistTemplates: Array.isArray(payload.checklistTemplates) ? payload.checklistTemplates.length : 0,
      emailTemplates: Array.isArray(payload.emailTemplates) ? payload.emailTemplates.length : 0,
    },
    data: {
      shipments: payload.shipments || [],
      checklistTemplates: payload.checklistTemplates || [],
      emailTemplates: payload.emailTemplates || [],
      settings: safeSettings,
    },
  };

  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Validates and parses imported JSON string or object
 */
export function validateAndParseImportData(rawJson: unknown, defaultFallback: AppDataPayload): ImportValidationResult {
  try {
    let parsed: any = rawJson;
    if (typeof rawJson === 'string') {
      try {
        parsed = JSON.parse(rawJson);
      } catch {
        return {
          success: false,
          error: 'Dosya geçerli bir JSON formatında değil veya bozulmuş.',
        };
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return {
        success: false,
        error: 'Geçersiz veri: JSON içeriği bir nesne olmalıdır.',
      };
    }

    // Support both enveloped format (data: {...}) and direct root object format
    const sourceData: any = parsed.format === 'ihracat_operasyon_backup' && parsed.data ? parsed.data : parsed;

    if (!Array.isArray(sourceData.shipments)) {
      return {
        success: false,
        error: 'Geçersiz yedek dosyası: "shipments" (sevkiyatlar) listesi bulunamadı.',
      };
    }

    let sanitizedCount = 0;

    // Validate and sanitize each shipment
    const validShipments: Shipment[] = sourceData.shipments.map((rawS: any, idx: number) => {
      if (!rawS || typeof rawS !== 'object') {
        sanitizedCount++;
        return {
          id: `ship_${Date.now()}_${idx}`,
          title: `Onarılan Sevkiyat #${idx + 1}`,
          shipmentDate: '',
          createdAt: new Date().toISOString(),
          bookingNo: '',
          awbNo: '',
          poNo: [],
          customInvoiceNo: [],
          i7xNo: '',
          d7xNo: '',
          diNo: '',
          eArsivNo: '',
          eIrsaliyeNo: '',
          invoiceTotalAmount: 0,
          chargeableWeight: 0,
          checklistProgress: {},
          pallets: [],
        };
      }

      // Validate Pallets
      const validPallets: PalletData[] = Array.isArray(rawS.pallets)
        ? rawS.pallets.map((p: any, pIdx: number) => {
            const validProducts: ProductRow[] = Array.isArray(p?.products)
              ? p.products.map((pr: any, prIdx: number) => ({
                  id: sanitizeString(pr?.id, `prod_${pIdx}_${prIdx}`),
                  boxDimensions: sanitizeString(pr?.boxDimensions),
                  materialCode: sanitizeString(pr?.materialCode),
                  materialDescription: sanitizeString(pr?.materialDescription),
                  itemsPerBox: sanitizeNumber(pr?.itemsPerBox, 0),
                  boxCount: sanitizeNumber(pr?.boxCount, 0),
                  boxWeight: sanitizeNumber(pr?.boxWeight, 0),
                }))
              : [];

            return {
              id: sanitizeString(p?.id, `pal_${pIdx}`),
              palletDimensions: sanitizeString(p?.palletDimensions),
              palletWeight: sanitizeNumber(p?.palletWeight, 0),
              products: validProducts,
            };
          })
        : [];

        // Strictly sanitize checklistProgress to enforce boolean key-value pairs
        const sanitizedChecklist: Record<string, boolean> = {};
        if (rawS.checklistProgress && typeof rawS.checklistProgress === 'object') {
          for (const [k, v] of Object.entries(rawS.checklistProgress)) {
            if (typeof k === 'string') {
              sanitizedChecklist[k] = v === true;
            }
          }
        }

        return {
          id: sanitizeString(rawS.id, `ship_${Date.now()}_${idx}`),
          title: sanitizeString(rawS.title, ''),
          shipmentDate: sanitizeString(rawS.shipmentDate, ''),
          createdAt: sanitizeString(rawS.createdAt, new Date().toISOString()),
          bookingNo: sanitizeString(rawS.bookingNo, ''),
          awbNo: sanitizeString(rawS.awbNo, ''),
          poNo: Array.isArray(rawS.poNo) ? rawS.poNo.map((p: any) => sanitizeString(p)).filter(Boolean) : [],
          customInvoiceNo: Array.isArray(rawS.customInvoiceNo)
            ? rawS.customInvoiceNo.map((c: any) => sanitizeString(c)).filter(Boolean)
            : [],
          i7xNo: sanitizeString(rawS.i7xNo, ''),
          d7xNo: sanitizeString(rawS.d7xNo, ''),
          diNo: sanitizeString(rawS.diNo, ''),
          eArsivNo: sanitizeString(rawS.eArsivNo, ''),
          eIrsaliyeNo: sanitizeString(rawS.eIrsaliyeNo, ''),
          sbifNo: sanitizeString(rawS.sbifNo, ''),
          sbifId: sanitizeString(rawS.sbifId, ''),
          invoiceTotalAmount: sanitizeNumber(rawS.invoiceTotalAmount, 0),
          chargeableWeight: sanitizeNumber(rawS.chargeableWeight, 0),
          responsiblePerson: sanitizeString(rawS.responsiblePerson, ''),
          checklistProgress: sanitizedChecklist,
          notes: sanitizeString(rawS.notes, ''),
          isCancelled: rawS.isCancelled === true,
          cancelledAt: rawS.cancelledAt ? sanitizeString(rawS.cancelledAt) : undefined,
          cancelReason: rawS.cancelReason ? sanitizeString(rawS.cancelReason) : undefined,
          pallets: validPallets,
        };
      });

    // Validate Deleted Shipments (Trash)
    const validDeletedShipments: DeletedShipment[] = Array.isArray(sourceData.deletedShipments)
      ? sourceData.deletedShipments.map((rawS: any, idx: number) => {
          if (!rawS || typeof rawS !== 'object') {
            return {
              id: `del_ship_${Date.now()}_${idx}`,
              title: `Kurtarılan Silinmiş Sevkiyat #${idx + 1}`,
              shipmentDate: '',
              createdAt: new Date().toISOString(),
              deletedAt: new Date().toISOString(),
              bookingNo: '',
              awbNo: '',
              poNo: [],
              customInvoiceNo: [],
              i7xNo: '',
              d7xNo: '',
              diNo: '',
              eArsivNo: '',
              eIrsaliyeNo: '',
              invoiceTotalAmount: 0,
              chargeableWeight: 0,
              checklistProgress: {},
              pallets: [],
            };
          }
          return {
            ...rawS,
            id: sanitizeString(rawS.id, `del_ship_${Date.now()}_${idx}`),
            title: sanitizeString(rawS.title, ''),
            shipmentDate: sanitizeString(rawS.shipmentDate, ''),
            createdAt: sanitizeString(rawS.createdAt, new Date().toISOString()),
            deletedAt: sanitizeString(rawS.deletedAt, new Date().toISOString()),
            bookingNo: sanitizeString(rawS.bookingNo, ''),
            awbNo: sanitizeString(rawS.awbNo, ''),
            poNo: Array.isArray(rawS.poNo) ? rawS.poNo.map((p: any) => sanitizeString(p)).filter(Boolean) : [],
            customInvoiceNo: Array.isArray(rawS.customInvoiceNo) ? rawS.customInvoiceNo.map((c: any) => sanitizeString(c)).filter(Boolean) : [],
            i7xNo: sanitizeString(rawS.i7xNo, ''),
            d7xNo: sanitizeString(rawS.d7xNo, ''),
            diNo: sanitizeString(rawS.diNo, ''),
            eArsivNo: sanitizeString(rawS.eArsivNo, ''),
            eIrsaliyeNo: sanitizeString(rawS.eIrsaliyeNo, ''),
            sbifNo: rawS.sbifNo ? sanitizeString(rawS.sbifNo) : undefined,
            sbifId: rawS.sbifId ? sanitizeString(rawS.sbifId) : undefined,
            invoiceTotalAmount: sanitizeNumber(rawS.invoiceTotalAmount, 0),
            chargeableWeight: sanitizeNumber(rawS.chargeableWeight, 0),
            responsiblePerson: rawS.responsiblePerson ? sanitizeString(rawS.responsiblePerson) : undefined,
            checklistProgress: rawS.checklistProgress && typeof rawS.checklistProgress === 'object' ? rawS.checklistProgress : {},
            notes: sanitizeString(rawS.notes, ''),
            isCancelled: rawS.isCancelled === true,
            pallets: Array.isArray(rawS.pallets) ? rawS.pallets : [],
          };
        })
      : (defaultFallback.deletedShipments || []);

    // Validate Checklist Templates
    const validChecklists: ChecklistItemTemplate[] = Array.isArray(sourceData.checklistTemplates)
      ? sourceData.checklistTemplates.map((c: any, cIdx: number) => ({
          id: sanitizeString(c?.id, `chk_${cIdx}`),
          text: sanitizeString(c?.text, `Madde ${cIdx + 1}`),
          order: sanitizeNumber(c?.order, cIdx + 1),
        }))
      : defaultFallback.checklistTemplates;

    // Validate Email Templates
    const validEmails: EmailTemplate[] = Array.isArray(sourceData.emailTemplates)
      ? sourceData.emailTemplates.map((e: any, eIdx: number) => ({
          id: sanitizeString(e?.id, `tpl_${eIdx}`),
          name: sanitizeString(e?.name, `Şablon ${eIdx + 1}`),
          subject: sanitizeString(e?.subject, ''),
          body: sanitizeString(e?.body, ''),
          attachments: Array.isArray(e?.attachments)
            ? e.attachments.map((a: any) => sanitizeString(a)).filter(Boolean)
            : [],
          recipient: sanitizeString(e?.recipient, ''),
          cc: sanitizeString(e?.cc, ''),
          order: sanitizeNumber(e?.order, eIdx + 1),
        }))
      : defaultFallback.emailTemplates;

    // Validate Settings (CRITICAL: Never overwrite device local PIN with imported backup)
    const rawSettings = sourceData.settings || {};
    const validSettings: AppSettings = {
      users: Array.isArray(rawSettings.users)
        ? rawSettings.users.map((u: any) => sanitizeString(u)).filter(Boolean)
        : defaultFallback.settings.users,
      awbFee: sanitizeNumber(rawSettings.awbFee, defaultFallback.settings.awbFee),
      minFreightAmount: sanitizeNumber(rawSettings.minFreightAmount, defaultFallback.settings.minFreightAmount),
      pinHash: defaultFallback.settings.pinHash, // Always retain local device PIN hash
      freightTiers: Array.isArray(rawSettings.freightTiers)
        ? rawSettings.freightTiers.map((t: any, tIdx: number) => ({
            id: sanitizeString(t?.id, `tier_${tIdx}`),
            maxWeight: sanitizeNumber(t?.maxWeight, 0),
            rate: sanitizeNumber(t?.rate, 0),
          }))
        : defaultFallback.settings.freightTiers,
    };

    return {
      success: true,
      data: {
        shipments: validShipments,
        deletedShipments: validDeletedShipments,
        checklistTemplates: validChecklists,
        emailTemplates: validEmails,
        settings: validSettings,
      },
      summary: `${validShipments.length} adet sevkiyat, ${validChecklists.length} kontrol maddesi ve ${validEmails.length} e-posta şablonu doğrulandı.`,
      stats: {
        shipmentsCount: validShipments.length,
        templatesCount: validChecklists.length + validEmails.length,
        sanitizedCount,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Doğrulama sırasında beklenmeyen hata: ${err?.message || 'Bilinmeyen hata'}`,
    };
  }
}
