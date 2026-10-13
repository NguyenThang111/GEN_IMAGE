export type MaterialPlanOutputType = 'SELLABLE_PRODUCT' | 'FINISHED_PRODUCT';

export type MaterialPlanInventoryItem = {
  id: string;
  name: string;
  groupName: string;
  sku: string | null;
  unit: string | null;
  onHandQty: string | null;
  expectedIncoming?: number;
  purchaseUrl?: string | null;
  purchaseLinks: string[];
};

export type MaterialPlanFinishedProduct = {
  id: string;
  name: string;
  onHandQty: string;
  bom: { itemId: string; quantityPerProduct: string }[];
  componentBom: { componentProductId: string; quantityPerProduct: string }[];
};

export type MaterialPlanSellableProduct = {
  id: string;
  name: string;
  bom: { finishedProductId: string; quantityPerProduct: string }[];
  materialBom: { itemId: string; quantityPerProduct: string }[];
};

export type MaterialPlanStatus = 'ĐỦ' | 'CẦN MUA' | 'CHƯA KIỂM' | 'THIẾU CẤU HÌNH';

export type MaterialPlanResult = {
  output: { type: MaterialPlanOutputType; id: string; name: string; quantity: number };
  materials: {
    itemId: string;
    name: string;
    groupName: string;
    sku: string;
    unit: string;
    usedBy: string[];
    requiredQty: number;
    onHandQty: number | null;
    orderedQty: number;
    purchaseQty: number;
    purchaseLinks: string[];
    status: MaterialPlanStatus;
  }[];
  components: { id: string; name: string; requiredQty: number; stockUsedQty: number; productionQty: number }[];
  warnings: string[];
};

const numeric = (value: string | number | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function calculateMaterialPlan(input: {
  outputType: MaterialPlanOutputType;
  outputId: string;
  quantity: number;
  items: MaterialPlanInventoryItem[];
  finishedProducts: MaterialPlanFinishedProduct[];
  sellableProducts: MaterialPlanSellableProduct[];
}): MaterialPlanResult {
  const itemById = new Map(input.items.map((item) => [item.id, item]));
  const finishedById = new Map(input.finishedProducts.map((item) => [item.id, item]));
  const sellableById = new Map(input.sellableProducts.map((item) => [item.id, item]));
  const remainingFinishedStock = new Map(input.finishedProducts.map((item) => [item.id, numeric(item.onHandQty)]));
  const materialNeeds = new Map<string, { quantity: number; usedBy: Set<string> }>();
  const componentNeeds = new Map<string, { name: string; requiredQty: number; stockUsedQty: number; productionQty: number }>();
  const warnings = new Set<string>();

  const addMaterial = (itemId: string, quantity: number, path: string[]) => {
    if (quantity <= 0) return;
    const current = materialNeeds.get(itemId) ?? { quantity: 0, usedBy: new Set<string>() };
    current.quantity += quantity;
    current.usedBy.add(path.join(' → '));
    materialNeeds.set(itemId, current);
  };

  const expandFinished = (productId: string, requiredQty: number, consumeStock: boolean, path: string[], stack: Set<string>) => {
    const product = finishedById.get(productId);
    if (!product) {
      warnings.add(`Thiếu Thành phẩm ${productId} trong Cấu thành ${path.join(' → ')}.`);
      return;
    }
    if (stack.has(productId)) {
      warnings.add(`Phát hiện vòng lặp Cấu thành tại ${[...path, product.name].join(' → ')}.`);
      return;
    }

    const available = consumeStock ? remainingFinishedStock.get(productId) ?? 0 : 0;
    const stockUsedQty = consumeStock ? Math.min(requiredQty, available) : 0;
    const productionQty = Math.max(0, requiredQty - stockUsedQty);
    if (consumeStock) remainingFinishedStock.set(productId, available - stockUsedQty);
    const component = componentNeeds.get(productId) ?? { name: product.name, requiredQty: 0, stockUsedQty: 0, productionQty: 0 };
    component.requiredQty += requiredQty;
    component.stockUsedQty += stockUsedQty;
    component.productionQty += productionQty;
    componentNeeds.set(productId, component);
    if (productionQty <= 0) return;

    const nextPath = [...path, product.name];
    if (!product.bom.length && !product.componentBom.length) {
      warnings.add(`${product.name} chưa có Cấu thành để tính phần cần sản xuất.`);
      return;
    }
    for (const line of product.bom) addMaterial(line.itemId, productionQty * numeric(line.quantityPerProduct), nextPath);
    const nextStack = new Set(stack).add(productId);
    for (const line of product.componentBom) {
      expandFinished(line.componentProductId, productionQty * numeric(line.quantityPerProduct), true, nextPath, nextStack);
    }
  };

  let outputName = '';
  if (input.outputType === 'SELLABLE_PRODUCT') {
    const product = sellableById.get(input.outputId);
    if (!product) throw new Error('Sellable product not found');
    outputName = product.name;
    if (!product.bom.length && !product.materialBom.length) warnings.add(`${product.name} chưa có Cấu thành.`);
    for (const line of product.materialBom) addMaterial(line.itemId, input.quantity * numeric(line.quantityPerProduct), [product.name, 'Đóng gói trực tiếp']);
    for (const line of product.bom) expandFinished(line.finishedProductId, input.quantity * numeric(line.quantityPerProduct), true, [product.name], new Set());
  } else {
    const product = finishedById.get(input.outputId);
    if (!product) throw new Error('Finished product not found');
    outputName = product.name;
    expandFinished(product.id, input.quantity, false, [], new Set());
  }

  const statusOrder: Record<MaterialPlanStatus, number> = { 'THIẾU CẤU HÌNH': 0, 'CHƯA KIỂM': 1, 'CẦN MUA': 2, 'ĐỦ': 3 };
  const materials = [...materialNeeds.entries()].map(([itemId, need]) => {
    const item = itemById.get(itemId);
    const currentPurchaseLinks = (item?.purchaseLinks ?? []).map((link) => link.trim()).filter(Boolean);
    const purchaseLinks = [...new Set(currentPurchaseLinks.length ? currentPurchaseLinks : [item?.purchaseUrl?.trim() ?? ''].filter(Boolean))].slice(0, 2);
    const onHandQty = item?.onHandQty === null || !item ? null : numeric(item.onHandQty);
    const orderedQty = item ? numeric(item.expectedIncoming) : 0;
    const purchaseQty = Math.max(0, need.quantity - numeric(onHandQty) - orderedQty);
    const status: MaterialPlanStatus = !item
      ? 'THIẾU CẤU HÌNH'
      : onHandQty === null
        ? 'CHƯA KIỂM'
        : purchaseQty > 0
          ? 'CẦN MUA'
          : 'ĐỦ';
    if (!item) warnings.add(`Vật tư ${itemId} trong Cấu thành không còn tồn tại hoặc đã ngưng sử dụng.`);
    return {
      itemId,
      name: item?.name ?? 'Vật tư không còn trong Kho',
      groupName: item?.groupName ?? '—',
      sku: item?.sku ?? '',
      unit: item?.unit ?? 'unit',
      usedBy: [...need.usedBy],
      requiredQty: need.quantity,
      onHandQty,
      orderedQty,
      purchaseQty,
      purchaseLinks,
      status,
    };
  }).sort((left, right) => statusOrder[left.status] - statusOrder[right.status] || left.name.localeCompare(right.name, 'vi'));

  return {
    output: { type: input.outputType, id: input.outputId, name: outputName, quantity: input.quantity },
    materials,
    components: [...componentNeeds.entries()].map(([id, value]) => ({ id, ...value })),
    warnings: [...warnings],
  };
}
