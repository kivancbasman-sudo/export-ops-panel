export interface ChecklistItemTemplate {
  id: string;
  text: string;
  order: number;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  attachments: string[]; // e.g. ["D7X İrsaliye", "DI Paketleme Listesi"]
  recipient?: string;
  cc?: string;
  order: number;
}

export interface ProductRow {
  id: string;
  boxDimensions: string;
  materialCode: string;
  materialDescription: string;
  itemsPerBox: number;
  boxCount: number;
  boxWeight: number;
}

export interface PalletData {
  id: string;
  palletDimensions: string;
  palletWeight: number;
  products: ProductRow[];
}

export interface FreightTier {
  id: string;
  maxWeight: number;
  rate: number;
}

export interface AppSettings {
  users: string[];
  awbFee: number;
  minFreightAmount: number;
  freightTiers: FreightTier[];
  pinHash?: string;
}

export interface Shipment {
  id: string;
  title?: string;
  shipmentDate?: string;
  createdAt: string;
  // Document Fields
  bookingNo: string;
  awbNo: string;
  poNo: string[];
  customInvoiceNo?: string[];
  i7xNo: string;
  d7xNo: string;
  diNo: string;
  eArsivNo: string;
  eIrsaliyeNo: string;
  sbifNo?: string;
  sbifId?: string;
  
  // Finance & Freight
  invoiceTotalAmount: number;
  chargeableWeight: number;

  // Operations
  responsiblePerson?: string;
  checklistProgress: Record<string, boolean>; // checklist template ID -> boolean
  notes?: string;
  isCancelled?: boolean;
  cancelledAt?: string;
  cancelReason?: string;

  // Pallets
  pallets: PalletData[];
}

export interface DeletedShipment extends Shipment {
  deletedAt: string;
}

