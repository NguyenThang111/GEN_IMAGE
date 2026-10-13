import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { diagramPngSize } from "./export-diagram-image";
import { DiagramJsonEditor } from "./DiagramJsonEditor";
import fixture from "./fixtures/vision-k2c-horn.schema.json";
import type { ElectricalDiagram } from "./contract";

describe("Diagram image export", () => {
  it.each([
    [{ width: 1400, height: 700 }, { width: 2800, height: 1400 }],
    [{ width: 8000, height: 4000 }, { width: 4096, height: 2048 }],
    [{ width: 700, height: 1400 }, { width: 1400, height: 2800 }],
    [{ width: 1, height: 10000 }, { width: 1, height: 4096 }],
  ])("bounds raster memory while preserving proportions", (canvas, expected) => {
    expect(diagramPngSize(canvas)).toEqual(expected);
  });
  it("renders JSON and exactly one preview together with local export controls", () => {
    const html = renderToStaticMarkup(createElement(DiagramJsonEditor, { diagram: fixture as ElectricalDiagram, canSave: true, onPreview: () => {}, onSave: async () => {}, onEditingChange: () => {} }));
    expect(html).toContain('class="diagramManualWorkspace"');
    expect(html).toContain('class="diagramManualCode"');
    expect(html).toContain('class="diagramManualPreview"');
    expect((html.match(/data-testid="diagram-preview"/g) ?? [])).toHaveLength(1);
    expect(html).toContain("Tải PNG");
    expect(html).toContain("Tải SVG");
    expect(html).toContain("chỉ lưu DB khi bấm Lưu");
  });
});
