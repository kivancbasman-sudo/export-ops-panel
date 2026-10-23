import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';

dotenv.config();

const args = process.argv.slice(2);
let PORT = Number(process.env.PORT) || 3000;
let HOST = '0.0.0.0';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    PORT = Number(args[i + 1]) || PORT;
  }
  if (args[i] === '--host' && args[i + 1]) {
    HOST = args[i + 1];
  }
}

const app = express();
app.use(express.json({ limit: '15mb' }));

// Health check endpoint for container probes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Shared Gemini AI client with required User-Agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper to call Gemini with resilient model fallback
async function generateWithFallback(options: {
  contents: string;
  systemInstruction: string;
}) {
  const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      console.log(`[AI Parse] Calling ${model}...`);
      const apiCall = ai.models.generateContent({
        model,
        contents: options.contents,
        config: {
          systemInstruction: options.systemInstruction,
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              blocks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    targetTable: { type: Type.STRING },
                    rows: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          palletNo: { type: Type.STRING },
                          palletDimensions: { type: Type.STRING },
                          palletTare: { type: Type.NUMBER },
                          boxDimensions: { type: Type.STRING },
                          itemCode: { type: Type.STRING },
                          itemDescription: { type: Type.STRING },
                          boxPieceCount: { type: Type.NUMBER },
                          boxCount: { type: Type.NUMBER },
                          boxWeight: { type: Type.NUMBER },
                        },
                        required: [
                          'palletNo',
                          'palletDimensions',
                          'boxDimensions',
                          'itemCode',
                          'itemDescription',
                          'boxPieceCount',
                          'boxCount',
                          'boxWeight',
                        ],
                      },
                    },
                  },
                  required: ['title', 'rows'],
                },
              },
            },
            required: ['blocks'],
          },
        },
      });

      // 35s timeout protection against stalled upstream connections
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${model} zaman aşımına uğradı (35s)`)), 35000)
      );

      const response = await Promise.race([apiCall, timeoutPromise]);
      if (response && response.text) {
        return { text: response.text, modelUsed: model };
      }
    } catch (err: any) {
      console.warn(`[AI Parse] Model ${model} failed:`, err?.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error('Yapay zeka modelleri yanıt veremedi.');
}

// Helper to cleanly separate package/box count (kap/koli sayısı) from item description
function cleanItemDescriptionAndBoxCount(
  rawDescription: string,
  currentBoxCount?: number
): { itemDescription: string; boxCount: number } {
  let boxCount =
    typeof currentBoxCount === 'number' && !isNaN(currentBoxCount) && currentBoxCount > 0
      ? currentBoxCount
      : 1;

  if (!rawDescription) {
    return { itemDescription: '', boxCount };
  }

  let desc = String(rawDescription).trim();

  // Pattern 1: Leading quantity with package unit keyword (Kap, Koli, Kutu, Paket, Pk, Kolı, Adet Kap, etc.)
  const packageKeywordLeading = /^\s*(\d+)\s*(?:x\s*)?(?:[-–—/:]\s*)?(?:adet\s+)?(?:kap|koli|kolı|kutu|paket|pk)\b[.\s\-_/:]*(.+)$/i;
  const matchKeyword = desc.match(packageKeywordLeading);
  if (matchKeyword) {
    const parsed = parseInt(matchKeyword[1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      boxCount = parsed;
      desc = matchKeyword[2].trim();
    }
  }

  // Pattern 2: Trailing quantity with package unit keyword
  const packageKeywordTrailing = /^(.*?)\s*[-–—/:]?\s*(\d+)\s*(?:adet\s+)?(?:kap|koli|kolı|kutu|paket|pk)\s*$/i;
  const matchTrailing = desc.match(packageKeywordTrailing);
  if (matchTrailing && matchTrailing[1].trim()) {
    const parsed = parseInt(matchTrailing[2], 10);
    if (!isNaN(parsed) && parsed > 0) {
      boxCount = parsed;
      desc = matchTrailing[1].trim();
    }
  }

  // Pattern 3: If boxCount is known and description starts with that number
  if (boxCount > 0) {
    const boxCountPrefixRegex = new RegExp(`^\\s*${boxCount}\\s*(?:x\\s*|adet\\s+)?(?:kap|koli|kolı|kutu|paket|pk)?\\b[.\\s\\-_/:]*(.+)`, 'i');
    const matchPrefix = desc.match(boxCountPrefixRegex);
    if (matchPrefix && matchPrefix[1].trim()) {
      desc = matchPrefix[1].trim();
    }
  }

  // Pattern 4: If boxCount was default (1) and description starts with a number followed by space or separator and letters
  if (boxCount <= 1) {
    const generalCountPrefix = /^\s*(\d{1,4})\s*(?:[-–—/:]|\s+)\s*([A-Za-zÇĞİÖŞÜçğıöşü].+)$/;
    const matchGeneral = desc.match(generalCountPrefix);
    if (matchGeneral) {
      const parsed = parseInt(matchGeneral[1], 10);
      const remainder = matchGeneral[2].trim();
      if (!isNaN(parsed) && parsed > 0 && parsed <= 500 && remainder.length >= 2) {
        if (!/^(?:cm|mm|kg|gr|m|gr\/m2)\b/i.test(remainder)) {
          boxCount = parsed;
          desc = remainder;
        }
      }
    }
  }

  // Remove leftover leading/trailing punctuation
  desc = desc.replace(/^[\s\-_/:]+/, '').replace(/[\s\-_/:]+$/, '').trim();

  return { itemDescription: desc, boxCount };
}

// API endpoint for AI-powered parsing
app.post('/api/parse', async (req: Request, res: Response) => {
  try {
    const { rawText } = req.body;
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({ error: 'Lütfen analiz edilecek sevkiyat metnini sağlayın.' });
    }

    const systemInstruction = `Uzman depo ve lojistik veri mühendisisin. Ham kargo metinlerini analiz edip STANDART 9 SÜTUNLU ÇEKİ LİSTESİ yapısına dönüştüreceksin.

KURALLAR:
1. KOD HAVUZU YOK: Kodlar tekil ürünleri temsil eder. Girdide açıkça ürün kodu belirtilmemişse 'itemCode' KESİNLİKLE boş string ("") olmalıdır. Asla kod uydurma.
2. MALZEME AÇIKLAMASI & KAP/KOLİ SAYISI AYRIMI (ÇOK ÖNEMLİ): Girdi metninde kap/koli sayısı ile ürün tanımı bir arada yazılmış olabilir (örnekler: "8 Kap Lat D Bay G", "12 Koli Tişört", "20 Kap ...", "15 Koli ...", "5 PK ...", "6 Kutu ...").
   - Başta veya sonda yer alan kap/koli sayısı (örneğin: 8, 12, 20) KESİNLİKLE 'boxCount' (Koli Sayısı) alanına aktarılmalıdır.
   - 'itemDescription' (Malzeme Açıklaması) alanında KESİNLİKLE başa veya sona kap/koli sayısı ya da "Kap", "Koli", "Kutu", "Paket", "Pk" gibi paketleme birimleri YAZILMAMALIDIR!
   - 'itemDescription' SADECE saf ürün tanımını içermelidir (Örnek: "8 Kap Lat D Bay G" girdisi için -> boxCount: 8, itemDescription: "Lat D Bay G"). Ürün açıklamasının başına kap sayısını veya 'Kap' ibaresini ASLA ekleme veya bırakma.
3. ÇOKLU MALZEME: Bir palette birden fazla malzeme (+ veya alt satır) varsa her malzeme için ayrı satır oluştur.
4. KOLİ İÇİ vs TOPLAM ADET: 'boxPieceCount' TEK 1 koli içindeki ürün adedidir. Palet toplam adediyle karıştırma (Sağlama: Toplam = boxPieceCount * boxCount).
5. ALT NOT EŞLEŞTİRME: Alt serbest koli tanımlarını (ölçü, koli içi adet, kg) doğru malzeme varyantıyla eşleştir (örn: MOS:360 ile standart varyantı karıştırma).
6. TEKRARLAYAN ALANLAR & DARA: Her satırda palletNo, palletDimensions ve palletTare (7.5) eksiksiz doldurulmalıdır.
7. FORMAT: Sayısal değerleri float/number formatında döndür.`;

    const prompt = `Ham sevkiyat metnini analiz edip standart çeki listesi bloklarını ve satırlarını çıkar:\n\n${rawText}`;

    const { text, modelUsed } = await generateWithFallback({
      contents: prompt,
      systemInstruction,
    });

    let cleanedText = (text || '').trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
    }

    const parsedJson = JSON.parse(cleanedText || '{}');

    // Post-process rows to ensure itemDescription and boxCount are clean and separated properly
    if (parsedJson.blocks && Array.isArray(parsedJson.blocks)) {
      for (const block of parsedJson.blocks) {
        if (block.rows && Array.isArray(block.rows)) {
          for (const row of block.rows) {
            const { itemDescription: cleanDesc, boxCount: cleanCount } = cleanItemDescriptionAndBoxCount(
              row.itemDescription || '',
              Number(row.boxCount) || 1
            );
            row.itemDescription = cleanDesc;
            row.boxCount = cleanCount;
          }
        }
      }
    }

    return res.json({
      success: true,
      data: parsedJson,
      modelUsed,
    });
  } catch (error: any) {
    console.error('Gemini parse error:', error);
    return res.status(500).json({
      error: error.message || 'Yapay zeka ayrıştırma sırasında hata oluştu.',
    });
  }
});

// Vite server setup in development mode or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('dist')));
    app.get('{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

startServer();
