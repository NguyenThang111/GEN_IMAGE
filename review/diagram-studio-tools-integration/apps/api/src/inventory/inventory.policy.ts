import { BadRequestException } from '@nestjs/common';
import { InventoryTransactionType } from './inventory-transaction.entity';

export const CANONICAL_INVENTORY_UNITS = ['unit'] as const;
export const UNITS_PER_REEL = 4000;
export const UNITS_PER_BAG = 1000;

export type NormalizationSuggestion = {
  quantity: number | null;
  unit: typeof CANONICAL_INVENTORY_UNITS[number];
  reason: string;
};

export function suggestNormalization(sourceStockText: string | null, _groupName: string): NormalizationSuggestion {
  const source = sourceStockText?.trim() ?? '';
  const reel = source.match(/^(\d+(?:[.,]\d+)?)\s*cuộn$/iu);
  if (reel) {
    const reels = Number(reel[1].replace(',', '.'));
    return { quantity: reels * UNITS_PER_REEL, unit: 'unit', reason: `${reels} cuộn × ${UNITS_PER_REEL.toLocaleString('vi-VN')} unit` };
  }
  const bag = source.match(/^(\d+(?:[.,]\d+)?)\s*túi$/iu);
  if (bag) {
    const bags = Number(bag[1].replace(',', '.'));
    return { quantity: bags * UNITS_PER_BAG, unit: 'unit', reason: `${bags} túi × ${UNITS_PER_BAG.toLocaleString('vi-VN')} unit` };
  }
  if (/^\d+(?:[.,]\d+)?$/u.test(source)) {
    return { quantity: Number(source.replace(',', '.')), unit: 'unit', reason: 'Số tồn từ Sheet; Admin cần xác nhận' };
  }
  return { quantity: null, unit: 'unit', reason: source ? 'Dữ liệu mơ hồ; Admin nhập thủ công' : 'Sheet chưa có tồn; Admin nhập thủ công' };
}

export function calculateBalance(type: InventoryTransactionType, quantity: number, current: number | null) {
  const isCount=type===InventoryTransactionType.ADJUSTMENT||type===InventoryTransactionType.STOCK_COUNT;
  if (!Number.isFinite(quantity)) throw new BadRequestException('Quantity must be finite');
  if (!isCount && quantity <= 0) throw new BadRequestException('IN/OUT quantity must be positive');
  if (isCount && quantity < 0) throw new BadRequestException('Adjusted balance cannot be negative');
  if (current === null && !isCount) throw new BadRequestException('Opening balance is required first');
  const next = isCount ? quantity : type === InventoryTransactionType.IN ? current! + quantity : current! - quantity;
  if (next < 0) throw new BadRequestException('Stock cannot be negative');
  return next;
}
