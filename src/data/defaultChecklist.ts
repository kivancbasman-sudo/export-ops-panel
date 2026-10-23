import { ChecklistItemTemplate } from "../types";

export const defaultChecklist: ChecklistItemTemplate[] = [
  { id: "chk_1", text: "Haftalık uçuş rezervasyonları yapılır", order: 1 },
  { id: "chk_2", text: "\"Üretim sevkiyat\" grubundan haftalık sevk adetleri doğrulanır", order: 2 },
  { id: "chk_3", text: "Satış takip grubundan ender beyin onayı da alınır", order: 3 },
  { id: "chk_4", text: "Sevk edilecek miktar kesinleştiğinde dış ticaret birimine übf çalışmalarına başlamaları için talep yapılır", order: 4 },
  { id: "chk_5", text: "Sevk edilecek miktar kesinleştiğinde depoya sevk adetleri paylaşılır.", order: 5 },
  { id: "chk_6", text: "Depodan paketleme ön bilgileri gelince sırasıyla I7X, SALT65, D7X belgeleri oluşturulur", order: 6 },
  { id: "chk_7", text: "SALT65 DI belge numarası ile depoya mailine dönüş yapılır, THY kapak dosyası eklenir", order: 7 },
  { id: "chk_8", text: "D7X belge numarası telegram grubu üzerinden depoya ön hazırlıkları için paylaşılır.", order: 8 },
  { id: "chk_9", text: "Forwarder firmaya yükleme talimatı iletilir", order: 9 },
  { id: "chk_10", text: "Gümrükçüye yükleme günü saati bilgisi verilmesi", order: 10 },
  { id: "chk_11", text: "Übf oluşturuldu bildirimi geldiğinde sbbup üzerinden onaylanır. Yeni sbif oluşturulur", order: 11 },
  { id: "chk_12", text: "Sbif ID düşünce gümrükçü ile tescil için gerekli belgeler paylaşılır", order: 12 },
  { id: "chk_13", text: "Belgeler aynı zamanda mal beraberi gönderilmek için çıktı alınıp hazırlanır", order: 13 },
  { id: "chk_14", text: "Tr fatura ve packing list forwarder'a konşimento onayı verilirken paylaşılır.", order: 14 },
  { id: "chk_15", text: "Sevk günü üretim tamamlandı mı, sevk etmeye uygun mu INVT04 üzerinden kontrol edilir, üretim sevkiyat grubundan teyit alınır", order: 15 },
  { id: "chk_16", text: "D7X belgesi kontrol edilir, tarihi güncellenir ve oluşan D7X belge no deponun stok çıkış işlemleri için paylaşılır.", order: 16 },
  { id: "chk_17", text: "INVT05 üzerinden e-irsaliye onayı için entegratöre gönderilir, I7X-D7X birbirine bağla", order: 17 },
  { id: "chk_18", text: "Packing list ve irsaliye belgeleri depoya mail atılır.", order: 18 },
  { id: "chk_19", text: "Orijinal konşimento fiyatsız olarak gümrükçü ile paylaşılır.", order: 19 }
];
