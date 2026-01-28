
import { GoogleGenAI, Type } from "@google/genai";
import { TaxRecord } from "./types";

const taxRecordSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      nama: { type: Type.STRING, description: "Nama Wajib Pajak" },
      nop: { type: Type.STRING, description: "Nomor Objek Pajak" },
      arrears: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            year: { type: Type.INTEGER },
            kurangBayar: { type: Type.NUMBER, description: "Nilai dari kolom Kurang Bayar. Jika LUNAS atau NIHIL, berikan 0." }
          },
          required: ["year", "kurangBayar"]
        }
      }
    },
    required: ["nama", "nop", "arrears"]
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function processTaxPDF(
  fileBase64: string, 
  mimeType: string, 
  yearConfig: { start: number; end: number },
  retries = 5 // Menambah jumlah percobaan menjadi 5 kali
): Promise<TaxRecord[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Tugas: Ekstrak data piutang PBB-P2 dari gambar/dokumen ini ke format JSON.
    
    INSTRUKSI KRITIKAL:
    1. BACA BARIS DEMI BARIS: Pastikan 'Kurang Bayar' sesuai dengan 'Tahun' di baris yang sama.
    2. FORMAT NOP: NOP biasanya '14.06.XX.XX.XXX-XXXX.X'.
    3. MATA UANG: Ambil nilai numerik saja. Jika 'LUNAS', 'NIHIL', atau '0', isi 0.
    4. TAHUN: Rentang ${yearConfig.start} - ${yearConfig.end}.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: fileBase64, mimeType } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: taxRecordSchema
      }
    });

    const textOutput = response.text || "[]";
    const rawData = JSON.parse(textOutput);
    
    return rawData.map((item: any) => {
      const arrearsMap: Record<number, number | null> = {};
      for (let y = yearConfig.start; y <= yearConfig.end; y++) arrearsMap[y] = null;

      if (item.arrears && Array.isArray(item.arrears)) {
        item.arrears.forEach((a: any) => {
          if (a.year >= yearConfig.start && a.year <= yearConfig.end) {
            arrearsMap[a.year] = a.kurangBayar;
          }
        });
      }

      const total = (Object.values(arrearsMap) as (number | null)[]).reduce<number>((sum, val) => {
        return sum + (val !== null && val > 0 ? val : 0);
      }, 0);

      return {
        nama: item.nama || "Tanpa Nama",
        nop: item.nop ? item.nop.replace(/\s/g, '') : "00.00.000.000.000-0000.0",
        arrears: arrearsMap,
        total,
        notes: [],
        updatedAt: new Date().toISOString()
      };
    });

  } catch (error: any) {
    // Jika terkena batasan kuota (429) atau server sibuk (503)
    if ((error.status === 429 || error.status === 503 || error.message?.includes('429')) && retries > 0) {
      // Tunggu lebih lama setiap kali gagal (Exponential Backoff)
      // Percobaan 1: 5 detik, 2: 10 detik, 3: 15 detik...
      const waitTime = (6 - retries) * 5000;
      console.warn(`Rate limit hit. Waiting ${waitTime/1000}s before retry...`);
      await delay(waitTime);
      return processTaxPDF(fileBase64, mimeType, yearConfig, retries - 1);
    }
    throw error;
  }
}
