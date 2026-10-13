import { duplicateMaterialGroups, matchesCatalogMaterial, normalizeMaterialName, unassignedBoardComponents } from './board-bom.policy';
import { InventoryBomKind } from './inventory-item.entity';
import { BOARD_CATALOG, KEYSCAN_IMPORT_CORRECTIONS, SOURCE_DOUBLE_CHECKS } from './board-bom.config';
import {
  EASYSCAN_DIRECT_MATERIALS,
  OBSOLETE_PACKAGING_FINISHED_PRODUCTS,
  SCANBOX_DIRECT_MATERIALS,
  SCANBOX_NEW_MATERIALS,
  SCANBOX_NEW_SUPPORT_FINISHED_PRODUCTS,
  SCANBOX_REUSED_SUPPORT_FINISHED_PRODUCT_NAMES,
} from './inventory-bom-bootstrap.service';

describe('board BOM audit policy', () => {
  const item = (id:string,name:string,bomKind:InventoryBomKind|null=InventoryBomKind.BOARD_COMPONENT,isActive=true) => ({id,name,bomKind,isActive});

  it('normalizes whitespace and casing for duplicate checks', () => {
    expect(normalizeMaterialName('  MP1584EN  ')).toBe(normalizeMaterialName('mp1584en'));
    expect(duplicateMaterialGroups([item('1','MP1584EN'),item('2',' mp1584en ')])).toHaveLength(1);
  });

  it('keeps a renamed imported material linked by its stable source row', () => {
    expect(matchesCatalogMaterial({
      ...item('wst','Mofest - WST2N7002'),
      sourceSheetName:'Kho',
      sourceRow:52,
    },{name:'WST2N7002',sourceRow:52})).toBe(true);
  });

  it('does not match a renamed material from another source row', () => {
    expect(matchesCatalogMaterial({
      ...item('other','Mofest - WST2N7002'),
      sourceSheetName:'Kho',
      sourceRow:51,
    },{name:'WST2N7002',sourceRow:52})).toBe(false);
  });

  it('falls back to the normalized name for legacy materials without source metadata', () => {
    expect(matchesCatalogMaterial(item('legacy',' wst2n7002 '),{name:'WST2N7002',sourceRow:52})).toBe(true);
  });

  it('ignores inactive duplicates', () => {
    expect(duplicateMaterialGroups([item('1','MP1584EN'),item('2','MP1584EN',InventoryBomKind.BOARD_COMPONENT,false)])).toHaveLength(0);
  });

  it('only reports active board components not used by a board', () => {
    const result=unassignedBoardComponents([
      item('used','SS34'),
      item('missing','Tụ 100nF'),
      item('other','Vali',InventoryBomKind.OTHER),
    ],new Set(['used']));
    expect(result.map((entry)=>entry.id)).toEqual(['missing']);
  });

  it('keeps the approved KeyScan 330R quantity at 13', () => {
    expect(KEYSCAN_IMPORT_CORRECTIONS['Trở 330R'].to).toBe('13');
  });

  it('uses the approved KeyScan resistor mapping', () => {
    expect(KEYSCAN_IMPORT_CORRECTIONS['Trở 30R 0603'].to).toBe('3');
    expect(KEYSCAN_IMPORT_CORRECTIONS['Trở 510R 0603'].to).toBe('2');
    const keyScanNames=BOARD_CATALOG.filter((record)=>Number(record.easyscuQtyPerBoard)>0).map((record)=>record.name);
    expect(keyScanNames).not.toEqual(expect.arrayContaining(['Trở 20R 0603','Trở 22R 0603','Trở 520R 0603']));
  });

  it('maps C1 / 103 to a ScanBox material instead of a double-check warning', () => {
    expect(BOARD_CATALOG).toEqual(expect.arrayContaining([
      expect.objectContaining({name:'Tụ 103',scanboxQtyPerBoard:'1'}),
    ]));
    expect(SOURCE_DOUBLE_CHECKS).toEqual([]);
  });

  it('keeps the approved ScanBox packaging and cable configuration', () => {
    expect(SCANBOX_REUSED_SUPPORT_FINISHED_PRODUCT_NAMES).toEqual([
      'Cáp ECM Honda4p cũ',
      'Cáp ECM Honda6p đỏ',
      'Cáp ECM Yamaha',
      'Cáp 3 đầu Vespa, SYM, SU',
      'Cáp nguồn DC hoàn thiện',
    ]);
    expect(SCANBOX_NEW_MATERIALS).toEqual(['Hộp đen', 'Mica ScanBox', 'Decal hộp ScanBox', 'Decal vali ScanBox']);
    expect(SCANBOX_NEW_SUPPORT_FINISHED_PRODUCTS).toEqual(expect.arrayContaining([
      {name:'Cáp chích lấy nguồn Dương ScanBox',materials:['Dây đồng hồ vạn năng','Kẹp to ra đầu DC']},
    ]));
    expect(EASYSCAN_DIRECT_MATERIALS).toEqual(['Vali nhỏ','Decal vali Easyscan','Kẹp dây','Kẹp máy']);
    expect(SCANBOX_DIRECT_MATERIALS).toEqual(['Vali to','Decal vali ScanBox']);
    expect(OBSOLETE_PACKAGING_FINISHED_PRODUCTS).toEqual(expect.arrayContaining(['Decal hộp Easyscan','Vali đựng ScanBox']));
  });
});
