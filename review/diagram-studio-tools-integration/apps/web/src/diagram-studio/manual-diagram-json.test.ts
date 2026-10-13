import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fixture from "./fixtures/vision-k2c-horn.schema.json";
import { DiagramPreview } from "./DiagramPreview";
import type { ElectricalDiagram } from "./contract";
import { parseManualDiagramJson } from "./manual-diagram-json";

const original = fixture as ElectricalDiagram;
describe("Manual circuit JSON", () => {
  it("accepts manual label/coordinate edits and resets review, without mutating the original", () => {
    const next = structuredClone(original);
    next.components[0].label = "Ắc quy đã chỉnh";
    next.components[0].x += 20;
    next.canvas.width = 1800;
    next.reviewStatus = "electrically-reviewed";
    const result = parseManualDiagramJson(JSON.stringify(next), original);
    expect(result.diagram).toMatchObject({ reviewStatus: "draft", canvas: { width: 1800 }, sourceImage: original.sourceImage });
    expect(result.diagram?.components[0].label).toBe("Ắc quy đã chỉnh");
    expect(original.components[0].label).not.toBe("Ắc quy đã chỉnh");
    expect(renderToStaticMarkup(createElement(DiagramPreview, { diagram: result.diagram! }))).toContain("Ắc quy đã chỉnh");
  });
  it("keeps geometry/topology diagnostics as editable draft issues", () => {
    const next = structuredClone(original);
    next.wires[0].points[0].x += 1;
    next.wires[0].to.terminalId = "missing";
    const result = parseManualDiagramJson(JSON.stringify(next), original);
    expect(result.diagram).not.toBeNull();
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("Missing endpoint"), expect.stringContaining("Wire start")]));
  });
  it.each(["id", "vehicleId", "vehicleTitle", "circuitTitle"])("rejects changing %s to another circuit", field => {
    const result = parseManualDiagramJson(JSON.stringify({ ...original, [field]: "other" }), original);
    expect(result.diagram).toBeNull();
    expect(result.errors[0]).toContain(field);
  });
  it.each(["{", "null", "[]", '{"components":{}}'])("rejects malformed input %s", text => {
    expect(parseManualDiagramJson(text, original).diagram).toBeNull();
  });
  it.each([
    (next: any) => { next.components[0] = null; },
    (next: any) => { next.components[0].label = {}; },
    (next: any) => { next.components[0].terminals = []; },
    (next: any) => { next.components[0].terminals[0] = null; },
    (next: any) => { next.components[0].x = "bad"; },
    (next: any) => { next.components[0].type = "unknown"; },
    (next: any) => { next.wires[0] = null; },
    (next: any) => { next.wires[0].points = []; },
    (next: any) => { next.wires[0].points[0] = null; },
    (next: any) => { next.wires[0].from = null; },
    (next: any) => { next.wires[0].code = {}; },
    (next: any) => { next.canvas.width = 0; },
    (next: any) => { next.schemaVersion = 99; },
  ])("blocks render-unsafe nested JSON", mutate => {
    const next = structuredClone(original);
    mutate(next);
    const result = parseManualDiagramJson(JSON.stringify(next), original);
    expect(result.diagram).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
