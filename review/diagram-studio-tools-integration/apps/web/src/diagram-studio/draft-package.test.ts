import { describe, expect, it } from "vitest";
import { buildDraftReview, getDraftPaths, slugifyDiagramName } from "./DiagramConverterView";
import type { ElectricalDiagram } from "./contract";

const diagram: ElectricalDiagram = { schemaVersion: 1, reviewStatus: "draft", id: "honda-vision-k2c-smartkey-starting", vehicleId: "honda-vision-k2c-smartkey", vehicleTitle: "Honda Vision K2C Smartkey", circuitTitle: "Mạch khởi động", canvas: { width: 1883, height: 870 }, components: [], wires: [] };

describe("Diagram draft package", () => {
  it("keeps the source, schema and review in one ID-based circuit folder", () => {
    const paths = getDraftPaths(diagram, "source.JPG");
    expect(paths).toEqual({ root: "honda-vision-k2c-smartkey", circuit: "starting", json: "honda-vision-k2c-smartkey/starting/honda-vision-k2c-smartkey-starting.schema.json", markdown: "honda-vision-k2c-smartkey/starting/honda-vision-k2c-smartkey-starting.review.md", image: "honda-vision-k2c-smartkey/starting/honda-vision-k2c-smartkey-starting.source.jpg" });
  });

  it("links the source image and schema relatively for Codex review", () => {
    const paths = getDraftPaths(diagram, "source.jpg");
    const markdown = buildDraftReview(diagram, { model: "gpt-5.5", warnings: ["Thiếu pin"], uncertainItems: [] }, ["Missing endpoint"], "38770-K2C-V01", paths);
    expect(markdown).toContain("![Ảnh sơ đồ gốc](./honda-vision-k2c-smartkey-starting.source.jpg)");
    expect(markdown).toContain("./honda-vision-k2c-smartkey-starting.schema.json");
    expect(markdown).toContain("ECM ID: 38770-K2C-V01");
    expect(markdown).toContain("Missing endpoint");
  });

  it("normalizes Vietnamese labels into stable folder slugs", () => {
    expect(slugifyDiagramName("Mạch đèn phanh", "diagram")).toBe("mach-den-phanh");
  });
});
