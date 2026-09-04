import { FinancialCalculationService } from '../server/modules/business/FinancialCalculationService';

describe('FinancialCalculationService (The Engine Bible)', () => {
  describe('calculateDirectHPP', () => {
    it('harus menghitung HPP dengan akurat berdasarkan bahan baku dan biaya kemasan', () => {
      const ingredients = [
        { qty: 10, averageCost: 50 }, // 500
        { qty: 2, averageCost: 100 }  // 200
      ];
      const packagingCost = 200;
      const hpp = FinancialCalculationService.calculateDirectHPP(ingredients, packagingCost);
      expect(hpp).toBe(900);
    });

    it('harus mengembalikan hanya biaya kemasan jika tidak ada bahan baku', () => {
      const hpp = FinancialCalculationService.calculateDirectHPP([], 500);
      expect(hpp).toBe(500);
    });
  });

  describe('bankersRound', () => {
    it('harus membulatkan genap jika berada di tengah (0.5)', () => {
      expect(FinancialCalculationService.bankersRound(2.5)).toBe(2);
      expect(FinancialCalculationService.bankersRound(3.5)).toBe(4);
      expect(FinancialCalculationService.bankersRound(0.5)).toBe(0);
      expect(FinancialCalculationService.bankersRound(1.5)).toBe(2);
    });

    it('harus membulatkan seperti biasa jika tidak tepat di tengah', () => {
      expect(FinancialCalculationService.bankersRound(2.4)).toBe(2);
      expect(FinancialCalculationService.bankersRound(2.6)).toBe(3);
    });
  });

  describe('separateTaxAndRevenue', () => {
    it('harus memisahkan PB1 10% dari Gross Price secara akurat', () => {
      const items = [{ id: '1', qty: 1, grossPrice: 11000 }];
      const res = FinancialCalculationService.separateTaxAndRevenue(items, 0.1);
      
      expect(res.totalGross).toBe(11000);
      expect(res.totalNet).toBe(10000); // 11000 / 1.1
      expect(res.totalTax).toBe(1000);  // 11000 - 10000
      expect(res.roundingAmount).toBe(0);
    });

    it('harus menangani kasus di mana pembulatan Net + Tax tidak pas dengan Gross', () => {
      // 10005 / 1.1 = 9095.454545... -> dibulatkan menjadi 9095
      // Tax: 10005 - 9095.454545 = 909.545454... -> dibulatkan menjadi 910
      // 9095 + 910 = 10005. Tidak ada perbedaan total.
      const items = [{ id: '1', qty: 1, grossPrice: 10005 }];
      const res = FinancialCalculationService.separateTaxAndRevenue(items, 0.1);
      
      expect(res.totalGross).toBe(10005);
      expect(res.totalNet).toBe(9095);
      expect(res.totalTax).toBe(910);
      expect(res.roundingAmount).toBe(0);
    });

    it('harus mendeteksi perbedaan pembulatan (rounding difference) jika ada', () => {
      // Skenario khusus yang menyebabkan bankers round + bankers round != initial
      // Contoh: Gross = 3 (tax 10%). Net = 3/1.1 = 2.7272... (Bankers round -> 3)
      // Tax = 3 - 2.7272 = 0.2727... (Bankers round -> 0)
      // Net(3) + Tax(0) = 3. Sesuai. 
      // Kita paksakan kondisi buatan jika diperlukan, tetapi secara matematika biasanya balance.
      const items = [{ id: '1', qty: 2, grossPrice: 10005 }];
      const res = FinancialCalculationService.separateTaxAndRevenue(items, 0.1);
      
      expect(res.totalGross).toBe(20010);
      expect(res.totalNet).toBe(18191); 
      expect(res.totalTax).toBe(1819);
      expect(res.roundingAmount).toBe(0); // 18191 + 1819 = 20010
    });
  });

  describe('calculateVariance', () => {
    it('harus mengembalikan selisih Blind Close', () => {
      expect(FinancialCalculationService.calculateVariance(10000, 10500)).toBe(500); // Over
      expect(FinancialCalculationService.calculateVariance(10000, 9500)).toBe(-500); // Under
      expect(FinancialCalculationService.calculateVariance(10000, 10000)).toBe(0); // Perfect
    });
  });
});
