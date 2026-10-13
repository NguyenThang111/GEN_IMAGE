import catalog = require('./catalog.kho.json');

export type BoardKey = 'EASYSCAN' | 'SCANBOX' | 'KEYSCAN';
export type BoardQuantityField = 'easycanQtyPerBoard' | 'scanboxQtyPerBoard' | 'easyscuQtyPerBoard';

export const BOARD_DEFINITIONS: Array<{
  key: BoardKey;
  sku: string;
  name: string;
  pcbSku: string;
  pcbName: string;
  quantityField: BoardQuantityField;
  sourceSheet: string;
}> = [
  { key: 'EASYSCAN', sku: 'BOARD-EASYSCAN', name: 'Board mạch EasyScan', pcbSku: 'PCB-EASYSCAN', pcbName: 'PCB trần EasyScan', quantityField: 'easycanQtyPerBoard', sourceSheet: 'EASYCAN' },
  { key: 'SCANBOX', sku: 'BOARD-SCANBOX', name: 'Board mạch ScanBox', pcbSku: 'PCB-SCANBOX', pcbName: 'PCB trần ScanBox', quantityField: 'scanboxQtyPerBoard', sourceSheet: 'SCANBOX' },
  { key: 'KEYSCAN', sku: 'BOARD-KEYSCAN', name: 'Board mạch KeyScan', pcbSku: 'PCB-KEYSCAN', pcbName: 'PCB trần KeyScan', quantityField: 'easyscuQtyPerBoard', sourceSheet: 'EASYSCU' },
];

export const BOARD_COMPONENT_GROUPS = new Set([
  'TỤ', 'TRỞ', 'IC', 'DIODE / TVS / ZENER', 'CUỘN CẢM',
  'THẠCH ANH / DAO ĐỘNG', 'CONNECTOR / JACK / SOCKET',
  'LED / BUZZER / BUTTON', 'RELAY', 'TRANSISTOR', 'PCB',
]);

export const EASYSCAN_IMPORT_CORRECTIONS: Record<string, { from: string; to: string }> = {
  'SS34 cho MC': { from: '2', to: '1' },
  '1N4007': { from: '1', to: '2' },
  'Trở 150R 0603': { from: '3', to: '1' },
};

export const KEYSCAN_IMPORT_CORRECTIONS: Record<string, { to: string }> = {
  'Trở 330R': { to: '13' },
  'Trở 30R 0603': { to: '3' },
  'Trở 510R 0603': { to: '2' },
};

export type CatalogBoardRecord = {
  name: string;
  sourceRow: number;
  easycanQtyPerBoard?: string | null;
  scanboxQtyPerBoard?: string | null;
  easyscuQtyPerBoard?: string | null;
};

export const BOARD_CATALOG = catalog as CatalogBoardRecord[];

export const SOURCE_DOUBLE_CHECKS = [] as Array<{
  boardKey: BoardKey;
  type: 'BOM_MISSING_MATERIAL' | 'SOURCE_CONFLICT';
  itemName: string;
  sourceSheet: string;
  sourceRow: number;
  message: string;
}>;
