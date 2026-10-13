import { calculateMaterialPlan } from './inventory-material-plan.policy';

describe('calculateMaterialPlan', () => {
  const items = [
    { id: 'jack', name: 'JACK Honda', groupName: 'JACK', sku: null, unit: 'unit', onHandQty: '20', expectedIncoming: 5, purchaseLinks: ['https://shop.example/jack'] },
    { id: 'wire', name: 'Dây điện', groupName: 'DÂY', sku: null, unit: 'unit', onHandQty: null, expectedIncoming: 0, purchaseLinks: [] },
    { id: 'case', name: 'Vali', groupName: 'ĐÓNG GÓI', sku: null, unit: 'unit', onHandQty: '2', expectedIncoming: 1, purchaseLinks: [] },
  ];
  const finishedProducts = [
    { id: 'cable', name: 'Cáp Honda', onHandQty: '3', bom: [{ itemId: 'jack', quantityPerProduct: '1' }, { itemId: 'wire', quantityPerProduct: '2' }], componentBom: [] },
    { id: 'device', name: 'Device EasyScan', onHandQty: '1', bom: [], componentBom: [{ componentProductId: 'cable', quantityPerProduct: '2' }] },
  ];
  const sellableProducts = [{ id: 'easy', name: 'EasyScan', bom: [{ finishedProductId: 'device', quantityPerProduct: '1' }], materialBom: [{ itemId: 'case', quantityPerProduct: '1' }] }];

  it('uses child finished stock, expands nested BOM and subtracts ordered materials', () => {
    const plan = calculateMaterialPlan({ outputType: 'SELLABLE_PRODUCT', outputId: 'easy', quantity: 5, items, finishedProducts, sellableProducts });
    expect(plan.output).toMatchObject({ name: 'EasyScan', quantity: 5 });
    expect(plan.components).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'device', requiredQty: 5, stockUsedQty: 1, productionQty: 4 }),
      expect.objectContaining({ id: 'cable', requiredQty: 8, stockUsedQty: 3, productionQty: 5 }),
    ]));
    expect(plan.materials.find((line) => line.itemId === 'jack')).toMatchObject({ requiredQty: 5, onHandQty: 20, orderedQty: 5, purchaseQty: 0, status: 'ĐỦ' });
    expect(plan.materials.find((line) => line.itemId === 'jack')?.purchaseLinks).toEqual(['https://shop.example/jack']);
    expect(plan.materials.find((line) => line.itemId === 'wire')).toMatchObject({ requiredQty: 10, onHandQty: null, purchaseQty: 10, status: 'CHƯA KIỂM' });
    expect(plan.materials.find((line) => line.itemId === 'case')).toMatchObject({ requiredQty: 5, onHandQty: 2, orderedQty: 1, purchaseQty: 2, status: 'CẦN MUA' });
  });

  it('does not subtract stock of the selected finished output', () => {
    const plan = calculateMaterialPlan({ outputType: 'FINISHED_PRODUCT', outputId: 'cable', quantity: 5, items, finishedProducts, sellableProducts });
    expect(plan.components).toContainEqual(expect.objectContaining({ id: 'cable', requiredQty: 5, stockUsedQty: 0, productionQty: 5 }));
    expect(plan.materials.find((line) => line.itemId === 'jack')?.requiredQty).toBe(5);
  });

  it('falls back to the legacy purchase URL when the link list is empty', () => {
    const legacyItems = items.map((item) => item.id === 'wire'
      ? { ...item, purchaseUrl: 'https://detail.1688.com/legacy-wire', purchaseLinks: [] }
      : item);
    const plan = calculateMaterialPlan({ outputType: 'SELLABLE_PRODUCT', outputId: 'easy', quantity: 5, items: legacyItems, finishedProducts, sellableProducts });

    expect(plan.materials.find((line) => line.itemId === 'wire')?.purchaseLinks).toEqual(['https://detail.1688.com/legacy-wire']);
  });

  it('warns instead of recursing forever for cyclic BOM', () => {
    const cyclic = [{ id: 'a', name: 'A', onHandQty: '0', bom: [], componentBom: [{ componentProductId: 'a', quantityPerProduct: '1' }] }];
    const plan = calculateMaterialPlan({ outputType: 'FINISHED_PRODUCT', outputId: 'a', quantity: 1, items: [], finishedProducts: cyclic, sellableProducts: [] });
    expect(plan.warnings[0]).toContain('vòng lặp');
  });
});
