import { describe, expect, it } from "vitest";
import { normalizeVehicleReferenceTitle } from "./DiagramProjectManagerView";
import { slugifyDiagramName } from "./DiagramConverterView";

describe("Diagram project App Ref title", () => {
  it("removes the mutable list number and derives a stable vehicle id", () => {
    const title = normalizeVehicleReferenceTitle("23. AIR BLADE 2022 - 2025 (160 / ABS)");
    expect(title).toBe("AIR BLADE 2022 - 2025 (160 / ABS)");
    expect(slugifyDiagramName(title, "")).toBe("air-blade-2022-2025-160-abs");
  });

  it("preserves a title copied without a list number", () => {
    expect(normalizeVehicleReferenceTitle("ADV 2023 (160) (CAMBODIA)"))
      .toBe("ADV 2023 (160) (CAMBODIA)");
  });
});
