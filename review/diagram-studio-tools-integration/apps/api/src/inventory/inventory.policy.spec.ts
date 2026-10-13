import { BadRequestException } from '@nestjs/common';
import { calculateBalance, suggestNormalization } from './inventory.policy';
import { InventoryTransactionType as Type } from './inventory-transaction.entity';

describe('Inventory balance policy', () => {
  it('requires normalization before IN/OUT', () => expect(() => calculateBalance(Type.IN, 2, null)).toThrow(BadRequestException));
  it('supports opening adjustment and movements', () => {
    expect(calculateBalance(Type.ADJUSTMENT, 10, null)).toBe(10);
    expect(calculateBalance(Type.IN, 3, 10)).toBe(13);
    expect(calculateBalance(Type.OUT, 4, 13)).toBe(9);
  });
  it('overwrites the current balance for every physical stock count', () => {
    expect(calculateBalance(Type.STOCK_COUNT, 7, 10)).toBe(7);
    expect(calculateBalance(Type.ADJUSTMENT, 7, 10)).toBe(7);
  });
  it('rejects negative stock', () => expect(() => calculateBalance(Type.OUT, 11, 10)).toThrow(BadRequestException));
});

describe('Inventory normalization suggestion', () => {
  it('keeps pure numeric stock as a review-only suggestion', () => {
    expect(suggestNormalization('1680', 'IC')).toEqual({ quantity: 1680, unit: 'unit', reason: 'Số tồn từ Sheet; Admin cần xác nhận' });
  });
  it('converts one reel to 4,000 units', () => {
    expect(suggestNormalization('1 cuộn', 'TỤ').quantity).toBe(4000);
    expect(suggestNormalization('1 cuộn', 'TỤ').unit).toBe('unit');
  });
  it('converts decimal packaging and rejects ambiguous text', () => {
    expect(suggestNormalization('0,5 cuộn', 'TRỞ').quantity).toBe(2000);
    expect(suggestNormalization('1 Túi', 'LED / BUZZER / BUTTON')).toEqual({quantity:1000,unit:'unit',reason:'1 túi × 1.000 unit'});
    expect(suggestNormalization('0.5 túi', 'LED').quantity).toBe(500);
    expect(suggestNormalization('Đủ', 'IC').quantity).toBeNull();
  });
});
