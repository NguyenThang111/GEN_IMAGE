import { describe, expect, it } from "vitest";
import fixture from "./fixtures/vision-k2c-horn.schema.json";
import type { ElectricalDiagram } from "./contract";
import { deterministicDiagramJson } from "./deterministic-json";
import { validateDiagramInput } from "./validate-diagram";

describe("Diagram Studio deterministic export", () => {
  it("exports the same state byte-for-byte and remains F01-valid", () => {
    const diagram = fixture as ElectricalDiagram;
    const first = deterministicDiagramJson(diagram);
    const second = deterministicDiagramJson(structuredClone(diagram));
    expect(second).toBe(first);
    expect(first.endsWith("\n")).toBe(true);
    expect(validateDiagramInput(JSON.parse(first)).errors).toEqual([]);
  });

  it("does not embed browser image data", () => {
    const diagram = { ...fixture, sourceImage: "vision-source.png" } as ElectricalDiagram;
    const output = deterministicDiagramJson(diagram);
    expect(output).toContain('"sourceImage": "vision-source.png"');
    expect(output).not.toContain("blob:");
    expect(output).not.toContain("data:image");
  });
});
