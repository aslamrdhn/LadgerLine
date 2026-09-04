export interface RecipeIngredient {
  qty: number;
  averageCost: number;
}

export interface LineItem {
  id: string;
  qty: number;
  grossPrice: number; // Harga total inclusive pajak (jika taxRate > 0). The prompt implies extracting tax from this gross.
}

/**
 * The Engine Bible - PRD v12.0
 * Mengunci logika matematika akuntansi agar tidak bisa dimanipulasi.
 * Kelas ini murni (pure functions) dan tidak memanggil database langsung.
 */
export class FinancialCalculationService {
  /**
   * Menghitung HPP berdasarkan resep dan kemasan (Snapshot).
   * 
   * @param ingredients Array of ingredients used in the recipe
   * @param packagingCost Additional packaging cost per portion
   * @returns Total HPP per portion
   */
  static calculateDirectHPP(ingredients: RecipeIngredient[], packagingCost: number): number {
    const totalIngredients = ingredients.reduce((sum, item) => sum + (item.qty * item.averageCost), 0);
    return totalIngredients + packagingCost;
  }

  /**
   * Banker's Rounding (Round half to even).
   * Menghindari bias pembulatan pada transaksi finansial.
   */
  static bankersRound(num: number): number {
    const m = Math.pow(10, 0); // Pembulatan ke integer (Rupiah)
    const d = num * m;
    const f = Math.floor(d);
    if (d - f === 0.5) {
      return f % 2 === 0 ? f / m : (f + 1) / m;
    }
    return Math.round(d) / m;
  }

  /**
   * Memisahkan PB1 10% dari Gross Price menggunakan metode Banker's Rounding di level baris item.
   * Asumsi: Gross Price yang diinput sudah termasuk pajak PB1.
   * 
   * @param items List of line items
   * @param taxRate Rate pajak (default 0.1 untuk PB1 10%)
   * @returns Rincian Gross, Net, Tax dan koreksi pembulatan.
   */
  static separateTaxAndRevenue(items: LineItem[], taxRate: number = 0.10) {
    let totalGross = 0;
    let totalTax = 0;
    let totalNet = 0;
    let totalRoundingDifference = 0;

    const processedItems = items.map(item => {
      const lineGross = item.qty * item.grossPrice;
      
      // Jika Gross = Net + Tax, dan Tax = Net * taxRate
      // Maka Gross = Net * (1 + taxRate)
      // Net = Gross / (1 + taxRate)
      const lineNetExact = lineGross / (1 + taxRate);
      const lineTaxExact = lineGross - lineNetExact;

      const roundedNet = FinancialCalculationService.bankersRound(lineNetExact);
      const roundedTax = FinancialCalculationService.bankersRound(lineTaxExact);

      // Selisih antara perhitungan eksak vs pembulatan
      // Nilai ini harus ditrack sebagai rounding amount agar totalGross tetap balance (Gross = Net + Tax + Rounding)
      const lineRoundingDiff = lineGross - (roundedNet + roundedTax);

      totalGross += lineGross;
      totalNet += roundedNet;
      totalTax += roundedTax;
      totalRoundingDifference += lineRoundingDiff;

      return {
        ...item,
        lineGross,
        lineNet: roundedNet,
        lineTax: roundedTax,
        lineRoundingDiff
      };
    });

    return {
      processedItems,
      totalGross,
      totalNet,
      totalTax,
      roundingAmount: totalRoundingDifference
    };
  }

  /**
   * Menghitung selisih Blind Close antara nominal fisik dan sistem.
   * 
   * @param systemExpectedCash Nominal uang yang seharusnya ada menurut sistem (POS)
   * @param actualPhysicalCash Nominal uang fisik yang dihitung oleh kasir
   * @returns Selisih (Positif = lebih, Negatif = kurang)
   */
  static calculateVariance(systemExpectedCash: number, actualPhysicalCash: number): number {
    return actualPhysicalCash - systemExpectedCash;
  }
}
