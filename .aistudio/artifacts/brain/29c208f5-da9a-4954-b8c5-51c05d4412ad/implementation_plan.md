# Uygulama Planı: Düzeltme Notlarını Kaldırma ve Token Optimizasyonu

Kullanıcı tercihi doğrultusunda, çeki listesi yapay zeka dönüşümünde **fazladan girdi ve çıktı tokeni harcayan** unsurların temizlenmesi ve şemanın sadeleştirilmesi planlanmaktadır.

## 1. Tespit Edilen Token İsrafları ve Çözüm Adımları

- **Çıktı (Output) Token İsrafı (`aiNotes`):**
  - **Sorun:** Model her ayrıştırma işleminde serbest metin olarak 50-150 token Türkçe düzeltme açıklaması üretmekteydi.
  - **Çözüm:** `server.ts` içerisindeki `responseSchema` yapısından `aiNotes` alanı tamamen çıkarılacak. Frontend'deki `currentBlock.notes` paneli kaldırılacak.

- **Girdi (Input) Şema İsrafı (Aşırı `description` metinleri):**
  - **Sorun:** Şemadaki her bir anahtar için uzun cümleler (`Palet Numarası (Örn: 1, 2)`, `1 Kolinin kg cinsinden birim ağırlığı (Örn: 11.40)` vb.) her API çağrısında girdi tokeni olarak harcanıyordu.
  - **Çözüm:** Kendini açıklayan alan adları korunarak (`palletNo`, `palletDimensions`, `boxDimensions`, `itemCode`, `itemDescription`, `boxPieceCount`, `boxCount`, `boxWeight`) gereksiz açıklama metinleri temizlenecek.

- **Tekrarlayan Sabit Veriler (`palletTare`):**
  - **Sorun:** Her satır için `palletTare: 7.5` üretilmesi 20 satırda 40 token israfına yol açıyordu.
  - **Çözüm:** Model çıktısında zorunlu olmaktan çıkarılacak veya ön yüzde varsayılan (7.5 kg) değeri atanacak.

- **Sistem İstemi (System Instruction) Sadeleştirmesi:**
  - **Sorun:** ~2.000 karakterlik istem metnindeki tekrarlı ifadeler girdi tokenlerini artırmaktadır.
  - **Çözüm:** Temel lojistik kuralları, 9 sütun yapısı ve kod havuzu yasağı korunarak net ve kompakt bir istem haline getirilecek (~%35 girdi tasarrufu).

- **Parametre Optimizasyonu:**
  - `temperature: 0.1` olarak sabitlenecek (deterministik ve gereksiz token üretimini engelleyen yapı).

---

## 2. Değiştirilecek Dosyalar

1. `server.ts`:
   - `responseSchema` sadeleştirilecek (`aiNotes` kaldırılacak, açıklamalar budanacak).
   - `systemInstruction` sıkılaştırılacak.
   - `temperature: 0.1` eklenecek.

2. `src/components/packing/PackingConverter.tsx`:
   - `currentBlock?.notes` görsel banner'ı kaldırılacak.
   - Veri haritalamasında `aiNotes` referansları temizlenecek.

---

## 3. Doğrulama ve Test
- TypeScript ve lint denetimi (`tsc --noEmit`).
- Proje derlemesi (`compile_applet`).
- Örnek sevkiyat metni ile `/api/parse` çağrısı yapılarak dönüştürme doğruluğu ve token tasarrufu teyit edilecek.
