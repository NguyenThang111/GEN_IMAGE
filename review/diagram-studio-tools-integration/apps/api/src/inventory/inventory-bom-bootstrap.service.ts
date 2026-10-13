import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BOARD_COMPONENT_GROUPS, BOARD_DEFINITIONS, EASYSCAN_IMPORT_CORRECTIONS, KEYSCAN_IMPORT_CORRECTIONS } from './board-bom.config';
import { normalizeMaterialName } from './board-bom.policy';
import { FinishedProduct, FinishedProductCategory } from './finished-product.entity';
import { InventoryBomKind, InventoryItem } from './inventory-item.entity';
import { ProductBomItem } from './product-bom-item.entity';
import { FinishedProductComponentItem } from './finished-product-component-item.entity';
import { SellableProduct } from './sellable-product.entity';
import { SellableProductBomItem } from './sellable-product-bom-item.entity';
import { SellableProductMaterialItem } from './sellable-product-material-item.entity';

export const EASYSCAN_SUPPORT_FINISHED_PRODUCTS = [
  { name: 'Cáp 3 đầu Vespa, SYM, SU', materials: ['JACK 6 cái', 'JACK Cap Vespa To', 'JACK SU 2p', 'JACK SYM'] },
  { name: 'Cáp chích lấy nguồn Dương', materials: ['Dây đồng hồ vạn năng', 'JACK kẹp cá sấu nhỏ'] },
  { name: 'Cáp ECM Honda4p cũ', materials: ['JACK 4 Honda', 'JACK 6 cái'] },
  { name: 'Cáp ECM Honda6p đỏ', materials: ['JACK 6 cái', 'JACK đỏ Euro6p'] },
  { name: 'Cáp ECM Yamaha', materials: ['Đầu 3 Cái Ya', 'JACK 3 Đực Ya', 'JACK 6 cái'] },
  { name: 'Cáp nguồn DC hoàn thiện', materials: ['CÁP Nguồn DC'] },
] as const;

export const EASYSCAN_DIRECT_MATERIALS = ['Vali nhỏ', 'Decal vali Easyscan', 'Kẹp dây', 'Kẹp máy'] as const;

export const SCANBOX_NEW_MATERIALS = [
  'Hộp đen',
  'Mica ScanBox',
  'Decal hộp ScanBox',
  'Decal vali ScanBox',
] as const;

export const SCANBOX_NEW_SUPPORT_FINISHED_PRODUCTS = [
  { name: 'Cáp chích lấy nguồn Dương ScanBox', materials: ['Dây đồng hồ vạn năng', 'Kẹp to ra đầu DC'] },
] as const;

export const SCANBOX_DIRECT_MATERIALS = ['Vali to', 'Decal vali ScanBox'] as const;

export const OBSOLETE_PACKAGING_FINISHED_PRODUCTS = [
  'Decal hộp Easyscan',
  'Decal vali Easyscan',
  'Đế kẹp máy Easyscan',
  'Kẹp cáp Easyscan',
  'Vali đựng Easyscan',
  'Decal hộp ScanBox',
  'Decal vali ScanBox',
  'Vali đựng ScanBox',
] as const;

export const SCANBOX_REUSED_SUPPORT_FINISHED_PRODUCT_NAMES = [
  'Cáp ECM Honda4p cũ',
  'Cáp ECM Honda6p đỏ',
  'Cáp ECM Yamaha',
  'Cáp 3 đầu Vespa, SYM, SU',
  'Cáp nguồn DC hoàn thiện',
] as const;

@Injectable()
export class InventoryBomBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InventoryBomBootstrapService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    await this.dataSource.query(`DO $$ BEGIN
      CREATE TYPE inventory_items_bomkind_enum AS ENUM ('BOARD_COMPONENT', 'OTHER');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await this.dataSource.query('ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS "bomKind" inventory_items_bomkind_enum');
    await this.dataSource.transaction(async (manager) => {
      let items = await manager.find(InventoryItem);

      for (const item of items) {
        if (item.bomKind !== null) continue;
        const hasBoardQuantity = [item.easycanQtyPerBoard,item.scanboxQtyPerBoard,item.easyscuQtyPerBoard].some((value) => value !== null && Number(value) > 0);
        item.bomKind = hasBoardQuantity || BOARD_COMPONENT_GROUPS.has(item.groupName.trim().toLocaleUpperCase('vi-VN'))
          ? InventoryBomKind.BOARD_COMPONENT
          : InventoryBomKind.OTHER;
        await manager.save(item);
      }

      const mp1584 = items.filter((item) => item.isActive && normalizeMaterialName(item.name) === 'mp1584en');
      if (mp1584.length > 1) {
        const canonical = mp1584.find((item) => item.groupName.trim().toLocaleUpperCase('vi-VN') === 'IC') ?? mp1584[0];
        for (const duplicate of mp1584.filter((item) => item.id !== canonical.id)) {
          canonical.scanboxQtyPerBoard ??= duplicate.scanboxQtyPerBoard;
          canonical.purchaseUrl ??= duplicate.purchaseUrl;
          if (!canonical.purchaseLinks.length && duplicate.purchaseLinks.length) canonical.purchaseLinks = duplicate.purchaseLinks;
          duplicate.isActive = false;
          await manager.save(duplicate);
        }
        canonical.bomKind = InventoryBomKind.BOARD_COMPONENT;
        await manager.save(canonical);
      }

      for (const [name, correction] of Object.entries(EASYSCAN_IMPORT_CORRECTIONS)) {
        const item = items.find((candidate) => candidate.isActive && candidate.name === name);
        if (item && Number(item.easycanQtyPerBoard) === Number(correction.from)) {
          item.easycanQtyPerBoard = Number(correction.to).toFixed(3);
          item.bomKind = InventoryBomKind.BOARD_COMPONENT;
          await manager.save(item);
        }
      }
      for (const [name, correction] of Object.entries(KEYSCAN_IMPORT_CORRECTIONS)) {
        const item = items.find((candidate) => candidate.isActive && candidate.name === name);
        if (item && Number(item.easyscuQtyPerBoard) !== Number(correction.to)) {
          item.easyscuQtyPerBoard = Number(correction.to).toFixed(3);
          item.bomKind = InventoryBomKind.BOARD_COMPONENT;
          await manager.save(item);
        }
      }

      items = await manager.find(InventoryItem);
      for (const definition of [
        { name: 'Mica EasyScan', groupName: 'Máy EASYSCAN', sku: null },
        { name: 'Mica KeyScan', groupName: 'KEYSCAN', sku: null },
        { name: 'Tem bảo hành EasyScan', groupName: 'Máy EASYSCAN', sku: 'TEM-BH-EASYSCAN' },
      ]) {
        if (items.some((item) => item.isActive && normalizeMaterialName(item.name) === normalizeMaterialName(definition.name))) continue;
        const material = await manager.save(manager.create(InventoryItem, {
          groupName: definition.groupName, name: definition.name, sku: definition.sku, unit: 'unit', onHandQty: null,
          easycanQtyPerBoard: null, scanboxQtyPerBoard: null, easyscuQtyPerBoard: null,
          bomKind: InventoryBomKind.OTHER, purchaseUrl: null, purchaseLinks: [], price: null,
          location: null, minimumStock: '100.000', note: 'Số lượng chưa kiểm', lastCountedAt: null,
          lastCountedById: null, checkRequestedAt: null, checkRequestedById: null,
          sourceSpreadsheetId: null, sourceSheetName: null, sourceRow: null,
          sourceStockText: null, sourceSnapshot: null, isActive: true,
        }));
        items.push(material);
      }
      const pcbByBoard = new Map<string, InventoryItem>();
      for (const board of BOARD_DEFINITIONS) {
        let pcb = items.find((item) => item.sku === board.pcbSku);
        if (!pcb) {
          pcb = await manager.save(manager.create(InventoryItem, {
            groupName: 'PCB', name: board.pcbName, sku: board.pcbSku, unit: 'unit', onHandQty: null,
            easycanQtyPerBoard: null, scanboxQtyPerBoard: null, easyscuQtyPerBoard: null,
            bomKind: InventoryBomKind.BOARD_COMPONENT, purchaseUrl: null, purchaseLinks: [], price: null,
            location: null, minimumStock: '100.000', note: 'Số lượng chưa kiểm', lastCountedAt: null,
            lastCountedById: null, checkRequestedAt: null, checkRequestedById: null,
            sourceSpreadsheetId: null, sourceSheetName: board.sourceSheet, sourceRow: null,
            sourceStockText: null, sourceSnapshot: null, isActive: true,
          }));
          items.push(pcb);
        }
        pcbByBoard.set(board.key, pcb);
      }

      const boardProducts = new Map<string, FinishedProduct>();
      for (const board of BOARD_DEFINITIONS) {
        let product = await manager.findOne(FinishedProduct, { where: { sku: board.sku } });
        const created = !product;
        if (!product) {
          product = await manager.save(manager.create(FinishedProduct, {
            sku: board.sku, name: board.name, onHandQty: '0.000', minimumStock: '0.000',
            category: FinishedProductCategory.PCB,
            location: null, note: `Cấu thành linh kiện từ ${board.sourceSheet}`, isActive: true,
          }));
        }
        product.category = FinishedProductCategory.PCB;
        product.isProductionOutput = false;
        product.productionReady = true;
        await manager.save(product);
        boardProducts.set(board.key, product);
        const currentLines = await manager.find(ProductBomItem, { where: { productId: product.id } });
        const hasOnlySeedPcb = currentLines.length === 1 && currentLines[0].itemId === pcbByBoard.get(board.key)?.id;
        const mappedItems = items.filter((item) => item.isActive && Number(item[board.quantityField]) > 0);
        if (created || currentLines.length === 0 || (hasOnlySeedPcb && mappedItems.length > 0)) {
          await manager.delete(ProductBomItem, { productId: product.id });
          const lines = mappedItems.map((item) => manager.create(ProductBomItem, {
            productId: product!.id, itemId: item.id, quantityPerProduct: Number(item[board.quantityField]).toFixed(3),
          }));
          const pcb = pcbByBoard.get(board.key)!;
          lines.push(manager.create(ProductBomItem, { productId: product.id, itemId: pcb.id, quantityPerProduct: '1.000' }));
          await manager.save(lines);
        }
      }

      const easyScanSupportProducts: FinishedProduct[] = [];
      for (const definition of EASYSCAN_SUPPORT_FINISHED_PRODUCTS) {
        let product = await manager.find(FinishedProduct).then((rows) => rows.find((candidate) =>
          normalizeMaterialName(candidate.name) === normalizeMaterialName(definition.name),
        ));
        if (!product) {
          product = await manager.save(manager.create(FinishedProduct, {
            sku: null,
            name: definition.name,
            category: FinishedProductCategory.CABLE,
            onHandQty: '0.000',
            minimumStock: '0.000',
            location: null,
            note: 'Thành phẩm cấu thành Máy đọc lỗi Easyscan',
            isActive: true,
          }));
        }
        product.category = FinishedProductCategory.CABLE;
        await manager.save(product);
        easyScanSupportProducts.push(product);
        const currentLines = await manager.find(ProductBomItem, { where: { productId: product.id } });
        if (currentLines.length) continue;
        const materialLines = definition.materials.map((name) => ({
          name,
          item: items.find((candidate) => candidate.isActive &&
            normalizeMaterialName(candidate.name) === normalizeMaterialName(name)),
        }));
        const missing = materialLines.filter((line) => !line.item).map((line) => line.name);
        if (missing.length) {
          this.logger.warn(`Không tạo được Cấu thành ${definition.name}; thiếu vật tư: ${missing.join(', ')}`);
          continue;
        }
        await manager.save(materialLines.map((line) => manager.create(ProductBomItem, {
          productId: product!.id,
          itemId: line.item!.id,
          quantityPerProduct: '1.000',
        })));
      }

      for (const name of SCANBOX_NEW_MATERIALS) {
        const exists = items.some((item) => item.isActive &&
          normalizeMaterialName(item.name) === normalizeMaterialName(name));
        if (exists) continue;
        const material = await manager.save(manager.create(InventoryItem, {
          groupName: 'SCANBOX / BAO BÌ', name, sku: null, unit: 'unit', onHandQty: null,
          easycanQtyPerBoard: null, scanboxQtyPerBoard: null, easyscuQtyPerBoard: null,
          bomKind: InventoryBomKind.OTHER, purchaseUrl: null, purchaseLinks: [], price: null,
          location: null, minimumStock: '100.000', note: 'Số lượng chưa kiểm', lastCountedAt: null,
          lastCountedById: null, checkRequestedAt: null, checkRequestedById: null,
          sourceSpreadsheetId: null, sourceSheetName: null, sourceRow: null,
          sourceStockText: null, sourceSnapshot: null, isActive: true,
        }));
        items.push(material);
      }

      const allFinishedProducts = await manager.find(FinishedProduct);
      const scanBoxSupportProducts = SCANBOX_REUSED_SUPPORT_FINISHED_PRODUCT_NAMES.map((name) =>
        allFinishedProducts.find((candidate) => candidate.isActive &&
          normalizeMaterialName(candidate.name) === normalizeMaterialName(name)),
      ).filter((product): product is FinishedProduct => Boolean(product));
      for (const definition of SCANBOX_NEW_SUPPORT_FINISHED_PRODUCTS) {
        let product = allFinishedProducts.find((candidate) => candidate.isActive &&
          normalizeMaterialName(candidate.name) === normalizeMaterialName(definition.name));
        if (!product) {
          product = await manager.save(manager.create(FinishedProduct, {
            sku: null,
            name: definition.name,
            category: FinishedProductCategory.CABLE,
            onHandQty: '0.000',
            minimumStock: '0.000',
            location: null,
            note: 'Thành phẩm cấu thành Máy đọc lỗi ScanBox',
            isActive: true,
          }));
          allFinishedProducts.push(product);
        }
        product.category = FinishedProductCategory.CABLE;
        await manager.save(product);
        scanBoxSupportProducts.push(product);
        const currentLines = await manager.find(ProductBomItem, { where: { productId: product.id } });
        if (currentLines.length) continue;
        const materialLines = definition.materials.map((name) => ({
          name,
          item: items.find((candidate) => candidate.isActive &&
            normalizeMaterialName(candidate.name) === normalizeMaterialName(name)),
        }));
        const missing = materialLines.filter((line) => !line.item).map((line) => line.name);
        if (missing.length) {
          this.logger.warn(`Không tạo được Cấu thành ${definition.name}; thiếu vật tư: ${missing.join(', ')}`);
          continue;
        }
        await manager.save(materialLines.map((line) => manager.create(ProductBomItem, {
          productId: product!.id,
          itemId: line.item!.id,
          quantityPerProduct: '1.000',
        })));
      }

      const deviceByBoard = new Map<string, FinishedProduct>();
      const deviceDefinitions = [
        { boardKey: 'EASYSCAN', name: 'Device EasyScan hoàn thiện', ready: true, materials: ['Hộp đen nhỏ', 'Mica EasyScan', 'Decal hộp Easyscan', 'Tem bảo hành EasyScan'] },
        { boardKey: 'SCANBOX', name: 'Device ScanBox hoàn thiện', ready: true, materials: ['Hộp đen', 'Mica ScanBox', 'Decal hộp ScanBox'] },
        { boardKey: 'KEYSCAN', name: 'Device KeyScan hoàn thiện', ready: false, materials: ['Mica KeyScan'] },
      ];
      for (const definition of deviceDefinitions) {
        let device = await manager.find(FinishedProduct).then((rows) => rows.find((candidate) =>
          candidate.isActive && normalizeMaterialName(candidate.name) === normalizeMaterialName(definition.name),
        ));
        if (!device) {
          device = await manager.save(manager.create(FinishedProduct, {
            sku: `DEVICE-${definition.boardKey}`,
            name: definition.name,
            category: FinishedProductCategory.DEVICE,
            onHandQty: '0.000',
            minimumStock: '0.000',
            location: null,
            note: definition.ready ? 'Device đã lắp vỏ, mica, decal và test.' : 'Chưa đủ cấu hình vỏ và decal KeyScan.',
            isProductionOutput: true,
            productionReady: definition.ready,
            isActive: true,
          }));
        } else {
          device.category = FinishedProductCategory.DEVICE;
          device.isProductionOutput = true;
          device.productionReady = definition.ready;
          await manager.save(device);
        }
        deviceByBoard.set(definition.boardKey, device);
        const board = boardProducts.get(definition.boardKey);
        if (board && !await manager.findOne(FinishedProductComponentItem, { where: { productId: device.id, componentProductId: board.id } })) {
          await manager.save(manager.create(FinishedProductComponentItem, { productId: device.id, componentProductId: board.id, quantityPerProduct: '1.000' }));
        }
        for (const materialName of definition.materials) {
          const material = items.find((item) => item.isActive && normalizeMaterialName(item.name) === normalizeMaterialName(materialName));
          if (material && !await manager.findOne(ProductBomItem, { where: { productId: device.id, itemId: material.id } })) {
            await manager.save(manager.create(ProductBomItem, { productId: device.id, itemId: material.id, quantityPerProduct: '1.000' }));
          }
        }
      }

      for (const obsoleteName of OBSOLETE_PACKAGING_FINISHED_PRODUCTS) {
        const obsolete = (await manager.find(FinishedProduct)).find((candidate) =>
          candidate.isActive && normalizeMaterialName(candidate.name) === normalizeMaterialName(obsoleteName),
        );
        if (!obsolete) continue;
        await manager.delete(SellableProductBomItem, { finishedProductId: obsolete.id });
        obsolete.isActive = false;
        obsolete.isProductionOutput = false;
        await manager.save(obsolete);
      }

      const coreSellableProducts = [
        { boardKey: 'EASYSCAN', name: 'Máy đọc lỗi Easyscan', note: null, supportProducts: easyScanSupportProducts, directMaterials: EASYSCAN_DIRECT_MATERIALS },
        { boardKey: 'SCANBOX', name: 'Máy đọc lỗi ScanBox', note: 'Cấu thành gồm Device ScanBox, bộ cáp và phụ kiện đóng gói.', supportProducts: scanBoxSupportProducts, directMaterials: SCANBOX_DIRECT_MATERIALS },
        { boardKey: 'KEYSCAN', name: 'Máy KeyScan', note: 'Cấu thành ban đầu gồm Device KeyScan; bổ sung cáp và phụ kiện sau khi chốt.', supportProducts: [], directMaterials: [] },
      ];
      const sellableProducts = await manager.find(SellableProduct);
      for (const definition of coreSellableProducts) {
        let product = sellableProducts.find((candidate) =>
          normalizeMaterialName(candidate.name) === normalizeMaterialName(definition.name),
        );
        if (!product) {
          product = await manager.save(manager.create(SellableProduct, {
            name: definition.name,
            onHandQty: '0.000',
            minimumStock: '0.000',
            note: definition.note,
            isActive: true,
          }));
          sellableProducts.push(product);
        }
        const board = boardProducts.get(definition.boardKey);
        const device = deviceByBoard.get(definition.boardKey);
        if (!board || !device) continue;
        await manager.delete(SellableProductBomItem, { productId: product.id, finishedProductId: board.id });
        const obsoleteBoxDecal = definition.boardKey === 'EASYSCAN' ? 'Decal hộp Easyscan' : definition.boardKey === 'SCANBOX' ? 'Decal hộp ScanBox' : null;
        const obsolete = obsoleteBoxDecal ? (await manager.find(FinishedProduct)).find((candidate) => normalizeMaterialName(candidate.name) === normalizeMaterialName(obsoleteBoxDecal)) : null;
        if (obsolete) await manager.delete(SellableProductBomItem, { productId: product.id, finishedProductId: obsolete.id });
        const existing = await manager.findOne(SellableProductBomItem, {
          where: { productId: product.id, finishedProductId: device.id },
        });
        if (!existing) {
          await manager.save(manager.create(SellableProductBomItem, {
            productId: product.id,
            finishedProductId: device.id,
            quantityPerProduct: '1.000',
          }));
        }
        for (const supportProduct of definition.supportProducts) {
          const supportLine = await manager.findOne(SellableProductBomItem, {
            where: { productId: product.id, finishedProductId: supportProduct.id },
          });
          if (!supportLine) {
            await manager.save(manager.create(SellableProductBomItem, {
              productId: product.id,
              finishedProductId: supportProduct.id,
              quantityPerProduct: '1.000',
            }));
          }
        }
        for (const materialName of definition.directMaterials) {
          const material = items.find((item) => item.isActive && normalizeMaterialName(item.name) === normalizeMaterialName(materialName));
          if (!material) {
            this.logger.warn(`Không thêm được Vật tư đóng gói ${materialName} vào ${definition.name}`);
            continue;
          }
          const existingMaterial = await manager.findOne(SellableProductMaterialItem, {
            where: { productId: product.id, itemId: material.id },
          });
          if (!existingMaterial) {
            await manager.save(manager.create(SellableProductMaterialItem, {
              productId: product.id,
              itemId: material.id,
              quantityPerProduct: '1.000',
            }));
          }
        }
      }
    });
    this.logger.log('Board product configuration is ready');
  }
}
