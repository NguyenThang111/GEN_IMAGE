import { describe, expect, it } from "vitest";
import type { FinishedProduct, InventoryItem, SellableProduct } from "./api";
import { buildProductCapacityCsv, calculateProductCapacity } from "./product-capacity";

const product = {
  id: "easy",
  name: "Máy đọc lỗi Easyscan",
  onHandQty: "53.000",
  minimumStock: "0.000",
  note: null,
  isActive: true,
  bom: [
    { id: "line-a", productId: "easy", finishedProductId: "a", quantityPerProduct: "1.000" },
    { id: "line-b", productId: "easy", finishedProductId: "b", quantityPerProduct: "1.000" },
  ],
  materialBom: [],
} as SellableProduct;

const inventory = (id: string, name: string, onHandQty: string | null) => ({
  id,
  name,
  groupName: "TEST",
  sku: null,
  unit: "unit",
  onHandQty,
  isActive: true,
}) as InventoryItem;

const finished = (id: string, name: string, onHandQty: string, itemId: string) => ({
  id,
  name,
  sku: null,
  onHandQty,
  minimumStock: "0.000",
  location: null,
  note: null,
  isActive: true,
  bom: [{ id: `bom-${id}`, productId: id, itemId, quantityPerProduct: id === "a" ? "1.000" : "2.000" }],
}) as FinishedProduct;

describe("EasyScan maximum material BOM export", () => {
  it("uses finished stock first and aggregates shared raw material", () => {
    const report = calculateProductCapacity(
      product,
      [finished("a", "Board", "1.000", "shared"), finished("b", "Vali", "0.000", "shared")],
      [inventory("shared", "Vật tư dùng chung", "8.000")],
    );

    expect(report.maxAdditionalUnits).toBe(3);
    expect(report.totalAfterProduction).toBe(56);
    expect(report.materials[0]).toMatchObject({
      quantityPerProduct: 3,
      quantityForMaximum: 8,
      remainingQty: 0,
      status: "GIỚI HẠN",
    });
  });

  it("does not assume uncounted material is available beyond finished stock", () => {
    const report = calculateProductCapacity(
      {...product, bom: [product.bom[0]]},
      [finished("a", "Board", "2.000", "unknown")],
      [inventory("unknown", "Tụ chưa kiểm", null)],
    );

    expect(report.maxAdditionalUnits).toBe(2);
    expect(report.materials[0].status).toBe("CHƯA KIỂM");
  });

  it("exports Vietnamese UTF-8 CSV with packaging and electronics", () => {
    const report = calculateProductCapacity(
      product,
      [finished("a", "Board", "0.000", "board-part"), finished("b", "Vali", "0.000", "case")],
      [inventory("board-part", "SS34", "10.000"), inventory("case", "Vali nhỏ", "10.000")],
    );
    const csv = buildProductCapacityCsv(report);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"VẬT TƯ"');
    expect(csv).toContain('"SS34"');
    expect(csv).toContain('"Vali nhỏ"');
  });

  it("counts direct packaging materials without pretending they are finished products", () => {
    const report = calculateProductCapacity(
      {...product, bom: [product.bom[0]], materialBom: [{id:"packing",productId:"easy",itemId:"case",quantityPerProduct:"1.000"}]},
      [finished("a", "Device EasyScan", "10.000", "board-part")],
      [inventory("board-part", "SS34", "100.000"), inventory("case", "Vali nhỏ", "3.000")],
    );

    expect(report.maxAdditionalUnits).toBe(3);
    expect(report.materials.find(line=>line.itemId==="case")).toMatchObject({
      quantityPerProduct: 1,
      quantityForMaximum: 3,
      usedBy: ["Đóng bộ trực tiếp"],
      status: "GIỚI HẠN",
    });
  });
});
