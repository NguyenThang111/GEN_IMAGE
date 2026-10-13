import type { FinishedProduct, InventoryItem, SellableProduct } from "./api";

export type CapacityMaterialStatus = "ĐỦ" | "GIỚI HẠN" | "CHƯA KIỂM" | "THIẾU VẬT TƯ";

export type ProductCapacityComponent = {
  name: string;
  quantityPerProduct: number;
  onHandQty: number;
  quantityNeededForMaximum: number;
  quantityToProduceForMaximum: number;
  status: "ĐỦ CẤU HÌNH" | "CHƯA CÓ CẤU THÀNH" | "THIẾU THÀNH PHẨM";
};

export type ProductCapacityMaterial = {
  itemId: string;
  name: string;
  groupName: string;
  sku: string;
  unit: string;
  usedBy: string[];
  quantityPerProduct: number;
  onHandQty: number | null;
  quantityForMaximum: number;
  remainingQty: number | null;
  status: CapacityMaterialStatus;
};

export type ProductCapacityReport = {
  productName: string;
  packedStock: number;
  maxAdditionalUnits: number;
  totalAfterProduction: number;
  components: ProductCapacityComponent[];
  materials: ProductCapacityMaterial[];
};

type CapacityState = {
  componentNeeds: Map<string, number>;
  materialNeeds: Map<string, number>;
  valid: boolean;
};

const numeric = (value: string | number | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function calculateProductCapacity(
  product: SellableProduct,
  finishedProducts: FinishedProduct[],
  inventoryItems: InventoryItem[],
): ProductCapacityReport {
  const finishedById = new Map(finishedProducts.map((item) => [item.id, item]));
  const materialById = new Map(inventoryItems.map((item) => [item.id, item]));

  const stateFor = (units: number): CapacityState => {
    const componentNeeds = new Map<string, number>();
    const materialNeeds = new Map<string, number>();
    let valid = product.bom.length > 0 || product.materialBom.length > 0;

    for (const productLine of product.bom) {
      const component = finishedById.get(productLine.finishedProductId);
      if (!component) {
        valid = false;
        continue;
      }
      const needed = units * numeric(productLine.quantityPerProduct);
      const toProduce = Math.max(0, needed - numeric(component.onHandQty));
      componentNeeds.set(component.id, (componentNeeds.get(component.id) ?? 0) + toProduce);
      if (toProduce > 0 && component.bom.length === 0) valid = false;
      for (const materialLine of component.bom) {
        const materialNeed = toProduce * numeric(materialLine.quantityPerProduct);
        materialNeeds.set(materialLine.itemId, (materialNeeds.get(materialLine.itemId) ?? 0) + materialNeed);
      }
    }

    for (const materialLine of product.materialBom) {
      const materialNeed = units * numeric(materialLine.quantityPerProduct);
      materialNeeds.set(materialLine.itemId, (materialNeeds.get(materialLine.itemId) ?? 0) + materialNeed);
    }

    for (const [itemId, required] of materialNeeds) {
      const material = materialById.get(itemId);
      if (!material || (material.onHandQty === null && required > 0) || numeric(material.onHandQty) < required) {
        valid = false;
      }
    }
    return { componentNeeds, materialNeeds, valid };
  };

  let low = 0;
  let high = 1;
  while (high <= 1_000_000 && stateFor(high).valid) {
    low = high;
    high *= 2;
  }
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (stateFor(middle).valid) low = middle;
    else high = middle;
  }

  const maximumState = stateFor(low);
  const nextState = stateFor(low + 1);
  const fullMaterialPerProduct = new Map<string, number>();
  const usedBy = new Map<string, Set<string>>();
  const configuredMaterialIds = new Set<string>();

  const components = product.bom.map((productLine) => {
    const component = finishedById.get(productLine.finishedProductId);
    const quantityPerProduct = numeric(productLine.quantityPerProduct);
    if (!component) {
      return {
        name: "Thành phẩm không còn trong Kho",
        quantityPerProduct,
        onHandQty: 0,
        quantityNeededForMaximum: low * quantityPerProduct,
        quantityToProduceForMaximum: 0,
        status: "THIẾU THÀNH PHẨM" as const,
      };
    }
    for (const materialLine of component.bom) {
      configuredMaterialIds.add(materialLine.itemId);
      fullMaterialPerProduct.set(
        materialLine.itemId,
        (fullMaterialPerProduct.get(materialLine.itemId) ?? 0) + quantityPerProduct * numeric(materialLine.quantityPerProduct),
      );
      const names = usedBy.get(materialLine.itemId) ?? new Set<string>();
      names.add(component.name);
      usedBy.set(materialLine.itemId, names);
    }
    return {
      name: component.name,
      quantityPerProduct,
      onHandQty: numeric(component.onHandQty),
      quantityNeededForMaximum: low * quantityPerProduct,
      quantityToProduceForMaximum: maximumState.componentNeeds.get(component.id) ?? 0,
      status: component.bom.length ? "ĐỦ CẤU HÌNH" as const : "CHƯA CÓ CẤU THÀNH" as const,
    };
  });

  for (const materialLine of product.materialBom) {
    configuredMaterialIds.add(materialLine.itemId);
    fullMaterialPerProduct.set(
      materialLine.itemId,
      (fullMaterialPerProduct.get(materialLine.itemId) ?? 0) + numeric(materialLine.quantityPerProduct),
    );
    const names = usedBy.get(materialLine.itemId) ?? new Set<string>();
    names.add("Đóng bộ trực tiếp");
    usedBy.set(materialLine.itemId, names);
  }

  const statusOrder: Record<CapacityMaterialStatus, number> = {
    "CHƯA KIỂM": 0,
    "THIẾU VẬT TƯ": 1,
    "GIỚI HẠN": 2,
    "ĐỦ": 3,
  };
  const materials = [...configuredMaterialIds].map((itemId): ProductCapacityMaterial => {
    const material = materialById.get(itemId);
    const required = maximumState.materialNeeds.get(itemId) ?? 0;
    const requiredForNext = nextState.materialNeeds.get(itemId) ?? 0;
    const onHandQty = material?.onHandQty === null ? null : material ? numeric(material.onHandQty) : null;
    const status: CapacityMaterialStatus = !material
      ? "THIẾU VẬT TƯ"
      : material.onHandQty === null
        ? "CHƯA KIỂM"
        : requiredForNext > numeric(material.onHandQty)
          ? "GIỚI HẠN"
          : "ĐỦ";
    return {
      itemId,
      name: material?.name ?? "Vật tư không còn trong Kho",
      groupName: material?.groupName ?? "—",
      sku: material?.sku ?? "",
      unit: material?.unit ?? "unit",
      usedBy: [...(usedBy.get(itemId) ?? [])],
      quantityPerProduct: fullMaterialPerProduct.get(itemId) ?? 0,
      onHandQty,
      quantityForMaximum: required,
      remainingQty: onHandQty === null ? null : onHandQty - required,
      status,
    };
  }).sort((left, right) => statusOrder[left.status] - statusOrder[right.status] || left.name.localeCompare(right.name, "vi"));

  return {
    productName: product.name,
    packedStock: numeric(product.onHandQty),
    maxAdditionalUnits: low,
    totalAfterProduction: numeric(product.onHandQty) + low,
    components,
    materials,
  };
}

function csvCell(value: string | number | null) {
  const text = value === null ? "CHƯA KIỂM" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildProductCapacityCsv(report: ProductCapacityReport) {
  const rows: Array<Array<string | number | null>> = [
    ["TỔNG QUAN"],
    ["Sản phẩm", "Tồn packed", "Đóng thêm tối đa", "Tổng sau khi đóng"],
    [report.productName, report.packedStock, report.maxAdditionalUnits, report.totalAfterProduction],
    [],
    ["THÀNH PHẨM"],
    ["Tên thành phẩm", "Định mức / sản phẩm", "Tồn rời", "Cần cho mức tối đa", "Cần sản xuất", "Trạng thái"],
    ...report.components.map((line) => [line.name, line.quantityPerProduct, line.onHandQty, line.quantityNeededForMaximum, line.quantityToProduceForMaximum, line.status]),
    [],
    ["VẬT TƯ"],
    ["Tên vật tư", "Nhóm", "SKU", "Đơn vị", "Thuộc thành phẩm", "Định mức đầy đủ / sản phẩm", "Tồn hiện tại", "Dùng cho mức tối đa", "Tồn còn lại", "Trạng thái"],
    ...report.materials.map((line) => [
      line.name,
      line.groupName,
      line.sku,
      line.unit,
      line.usedBy.join(" | "),
      line.quantityPerProduct,
      line.onHandQty,
      line.quantityForMaximum,
      line.remainingQty,
      line.status,
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
