import { GoogleGenAI } from '@google/genai';
import { logger } from '../logger.js';

let aiClientInstance: GoogleGenAI | null = null;

export const getAiClient = (): GoogleGenAI | null => {
  if (!aiClientInstance && process.env.GEMINI_API_KEY) {
    try {
      logger.info('[GEMINI] Initializing modern GoogleGenAI client...');
      aiClientInstance = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build-ledgerline-pos'
          }
        }
      });
    } catch (err: any) {
      logger.error(`[GEMINI] GoogleGenAI initialization failed: ${err.message}`);
      aiClientInstance = null;
    }
  }
  return aiClientInstance;
};

export class AiService {
  static async generateBusinessInsight(storeData: {
    name: string;
    storeAddress: string;
    totalPemasukan: number;
    totalPengeluaran: number;
    lowStockMaterials: any[];
    criticalProducts: any[];
  }): Promise<string> {
    const client = getAiClient();
    if (!client) {
      throw new Error('Kunci API Gemini tidak terkonfigurasi. Silakan tambahkan GEMINI_API_KEY di menu Secrets.');
    }

    const {
      name,
      storeAddress,
      totalPemasukan,
      totalPengeluaran,
      lowStockMaterials,
      criticalProducts
    } = storeData;

    const netProfit = totalPemasukan - totalPengeluaran;

    const materialsText = lowStockMaterials.length > 0 
      ? lowStockMaterials.map(m => `- ${m.name || m.name}: Sisa ${m.stockQuantity || m.stock_quantity} ${m.stockUnit || m.stock_unit} (Batas Minim: ${m.warningLimit || m.warning_limit}). Supplier: ${m.supplierName || m.supplier_name} (${m.supplierContact || m.supplier_contact})`).join('\n')
      : 'Semua bahan baku dalam kondisi aman.';

    const productsText = criticalProducts.length > 0
      ? criticalProducts.map(p => `- ${p.name}: Sisa ${p.stock} porsi (Batas Minim: ${p.warningLimit || p.warning_limit}). Supplier: ${p.supplierName || p.supplier_name} (${p.supplierContact || p.supplier_contact})`).join('\n')
      : 'Semua stok produk aman di etalase.';

    const promptMessage = `
      Anda adalah seorang Konsultan Bisnis Kopi Senior dan Expert Manajemen UMKM Keuangan Buku-Kas.
      Menganalisis sistem point of sale (POS) kedai kopi bernama "${name}" di "${storeAddress}".
      
      Data Keuangan & Stok Saat ini:
      1. Total Pemasukan: Rp ${totalPemasukan.toLocaleString('id-ID')}
      2. Total Pengeluaran: Rp ${totalPengeluaran.toLocaleString('id-ID')}
      3. Laba Bersih Sementara: Rp ${netProfit.toLocaleString('id-ID')}
      
      Bahan Baku yang hampir habis:
      ${materialsText}
      
      Produk etalase hampir habis:
      ${productsText}

      Tugas Anda:
      Berikan ulasan singkat (Maksimum 250 kata), ramah, elegan, profesional, dan dalam Bahasa Indonesia yang berisi:
      1. Analisis singkat performa keuangan (apakah keuangan sehat/laba memadai berkaca dari omset Buku-Kas).
      2. Langkah taktis darurat menangani bahan baku/stok yang menipis (khususnya menghubungi supplier relevan dengan nomor kontak mereka).
      3. Tips inovasi menu unik / pemasaran berbiaya murah agar penjualan langganan coffee shop per bulan semakin ramai.
    `;

    try {
      const response = await client.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: promptMessage,
        config: {
          temperature: 0.7,
        }
      });
      return response.text || 'Tidak ada insight yang dihasilkan.';
    } catch (err: any) {
      logger.error(`[AI SERVICE] generateContent failed: ${err.message}`);
      throw new Error(`Gagal memanggil modul analisis pintar Gemini AI: ${err.message}`);
    }
  }
}
