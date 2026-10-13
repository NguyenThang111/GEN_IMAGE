import { InventoryBomKind } from './inventory-item.entity';

export type AuditInventoryItem = {
  id: string;
  name: string;
  bomKind: InventoryBomKind | null;
  isActive: boolean;
  sourceSheetName?: string | null;
  sourceRow?: number | null;
};

export type CatalogMaterialRecord = {
  name: string;
  sourceRow: number;
};

export function normalizeMaterialName(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ');
}

export function matchesCatalogMaterial(item: AuditInventoryItem, record: CatalogMaterialRecord) {
  if (item.sourceSheetName === 'Kho' && item.sourceRow === record.sourceRow) return true;
  return normalizeMaterialName(item.name) === normalizeMaterialName(record.name);
}

export function duplicateMaterialGroups(items: AuditInventoryItem[]) {
  const groups = new Map<string, AuditInventoryItem[]>();
  for (const item of items.filter((candidate) => candidate.isActive)) {
    const key = normalizeMaterialName(item.name);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

export function unassignedBoardComponents(items: AuditInventoryItem[], assignedItemIds: Set<string>) {
  return items.filter((item) => item.isActive && item.bomKind === InventoryBomKind.BOARD_COMPONENT && !assignedItemIds.has(item.id));
}
