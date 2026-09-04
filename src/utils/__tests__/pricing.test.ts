import { calculateSubtotal, calculateDiscount, calculateTax, calculateTotal } from '../pricing';

describe('Pricing utilities', () => {
  it('calculates subtotal correctly', () => {
    const items = [
      { price: 10000, quantity: 2 },
      { price: 15000, quantity: 1 }
    ];
    expect(calculateSubtotal(items)).toBe(35000);
  });

  it('calculates discount correctly', () => {
    expect(calculateDiscount(100000, 10)).toBe(10000);
  });

  it('calculates tax correctly', () => {
    // subtotal = 100k, discount = 10k => 90k. tax = 11% => 9900
    expect(calculateTax(100000, 10000, 11)).toBe(9900);
  });

  it('calculates total correctly', () => {
    expect(calculateTotal(100000, 10000, 9900)).toBe(99900);
  });
});
