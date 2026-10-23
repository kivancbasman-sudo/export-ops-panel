import { EmailTemplate } from "../types";

export const defaultEmailTemplates: EmailTemplate[] = [
  {
    id: "tpl_depo",
    name: "Depo Çıkış Maili",
    order: 1,
    subject: "Depo Çıkış Talimatı - {D7X_NO} / Booking: {BOOKING_NO}",
    attachments: [
      "D7X İrsaliye",
      "DI Paketleme Listesi",
      "THY / Havayolu Kapak Dosyası"
    ],
    body: `Merhaba Depo Ekibi,

{TARIH} tarihli sevkiyatımıza ait depo çıkış ve yükleme bilgileri aşağıdadır. İlgili ürünlerin hazırlanarak araca yüklenmesini rica ederiz.

• D7X İrsaliye No: {D7X_NO}
• DI Paketleme No: {DI_NO}
• Booking No: {BOOKING_NO}
• AWB No: {AWB_NO}
• PO Numaraları: {PO_NO}
• Toplam Palet / Koli: {PALET_SAYISI} Palet / {KOLI_SAYISI} Koli
• Palet Ölçüleri:
{PALET_BOYUTU}
• Brüt / Şarj Edilebilir Ağırlık: {BRUT_KILO} kg
• Operasyon Sorumlusu: {SORUMLU}

Ekte yer alan belgeler:
{EKLER}

Yükleme tamamlandıktan sonra fiili çıkış bilgisinin paylaşılmasını rica ederiz.

İyi çalışmalar.`
  },
  {
    id: "tpl_gumruk",
    name: "Gümrük & Beyanname Maili",
    order: 2,
    subject: "Gümrük Tescil Evrakları - {I7X_NO} / AWB: {AWB_NO} / Booking: {BOOKING_NO}",
    attachments: [
      "I7X Fatura",
      "D7X İrsaliye",
      "DI Paketleme Listesi",
      "SBİF Belgesi",
      "Konşimento Talimatı"
    ],
    body: `Sayın Gümrük Müşavirliği Ekibi,

Aşağıdaki ihracat sevkiyatımız için gümrük beyannamesi işlemlerinin başlatılmasını rica ederiz:

• Fatura No (I7X): {I7X_NO}
• D7X İrsaliye No: {D7X_NO}
• Booking No: {BOOKING_NO}
• AWB No: {AWB_NO}
• PO No: {PO_NO}
• Yurtdışı Fatura No: {YURTDISI_FATURA_NO}
• Sevkiyat Tarihi: {TARIH}
• Koli / Ağırlık: {KOLI_SAYISI} Koli / {BRUT_KILO} kg
• İhracat Sorumlusu: {SORUMLU}

Ekteki belgeler:
{EKLER}

Beyanname açıldıktan sonra tescil numarasının tarafımıza iletilmesini rica ederiz.

Saygılarımızla.`
  },
  {
    id: "tpl_prealert",
    name: "Müşteri Sevkiyat Bildirimi (Pre-Alert)",
    order: 3,
    subject: "Shipping Advice / Pre-Alert - PO: {PO_NO} - AWB: {AWB_NO}",
    attachments: [
      "Commercial Invoice (Yurtdışı Fatura)",
      "Packing List (DI)",
      "Air Waybill (AWB Kopya)"
    ],
    body: `Dear Customer,

We are pleased to inform you that your order has been dispatched. Please find the shipping details below:

• PO Number(s): {PO_NO}
• Booking Reference: {BOOKING_NO}
• Air Waybill (AWB): {AWB_NO}
• Commercial Invoice No: {YURTDISI_FATURA_NO}
• Shipment Date: {TARIH}
• Total Pallets / Boxes: {PALET_SAYISI} Pallets / {KOLI_SAYISI} Boxes
• Gross / Chargeable Weight: {BRUT_KILO} kg

Attached shipping documents:
{EKLER}

Please let us know if you require any additional documents or information.

Best regards,
{SORUMLU}
Export Operations`
  },
  {
    id: "tpl_forwarder",
    name: "Acenta & Forwarder Konşimento Onayı",
    order: 4,
    subject: "Konşimento Onayı & Evraklar - Booking: {BOOKING_NO} / AWB: {AWB_NO}",
    attachments: [
      "TR Fatura (I7X)",
      "Packing List (DI)",
      "Onaylı Konşimento Taslağı"
    ],
    body: `Merhaba,

{BOOKING_NO} numaralı rezervasyonumuza istinaden konşimento onayı ve sevkiyat evraklarımız ektedir:

• Booking No: {BOOKING_NO}
• AWB No: {AWB_NO}
• D7X İrsaliye No: {D7X_NO}
• Toplam: {PALET_SAYISI} Palet / {KOLI_SAYISI} Koli
• Brüt / Şarj Edilebilir Kilo: {BRUT_KILO} kg
• Sevk Tarihi: {TARIH}
• Sorumlu: {SORUMLU}

Ekteki belgeler:
{EKLER}

Uçuş takip detaylarının tarafımıza iletilmesini rica ederiz.

İyi çalışmalar.`
  }
];
