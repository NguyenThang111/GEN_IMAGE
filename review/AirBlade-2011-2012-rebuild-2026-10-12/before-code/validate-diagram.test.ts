import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fixture from "./fixtures/vision-k2c-horn.schema.json";
import { SUPPORTED_COMPONENT_TYPES, type ElectricalDiagram } from "./contract";
import { DiagramPreview } from "./DiagramPreview";
import { validateDiagram, validateDiagramInput } from "./validate-diagram";

const cloneFixture = () => structuredClone(fixture) as ElectricalDiagram;

describe("Diagram Studio F01 contract", () => {
  it("accepts the untouched Vision K2C horn fixture", () => {
    const result = validateDiagramInput(fixture);
    expect(result.errors).toEqual([]);
    expect(result.diagram?.components).toHaveLength(12);
    expect(result.diagram?.wires).toHaveLength(11);
  });

  it("renders the fixture canvas, all components and all wires", () => {
    const markup = renderToStaticMarkup(createElement(DiagramPreview, { diagram: fixture as ElectricalDiagram }));
    expect(markup).toContain('viewBox="0 0 1400 700"');
    expect((markup.match(/data-wire-id=/g) ?? [])).toHaveLength(11);
    expect((markup.match(/class="diagramComponent /g) ?? [])).toHaveLength(12);
  });

  it("rejects a missing endpoint", () => {
    const diagram = cloneFixture();
    diagram.wires[0].to.terminalId = "missing";
    expect(validateDiagram(diagram)).toContain("Missing endpoint: battery-ground -> battery-ground.missing");
  });

  it("rejects a detached route endpoint", () => {
    const diagram = cloneFixture();
    diagram.wires[0].points[0].x += 1;
    expect(validateDiagram(diagram)).toContain("Wire start does not meet terminal: battery-ground");
  });

  it("rejects a diagonal segment", () => {
    const diagram = cloneFixture();
    diagram.wires[0].points[1].x += 1;
    expect(validateDiagram(diagram)).toContain("Non-orthogonal wire segment: battery-ground");
  });

  it("rejects an invalid physical wire color", () => {
    const diagram = cloneFixture();
    diagram.wires[0].primaryColor = "green";
    expect(validateDiagram(diagram)).toContain("Invalid wire color: battery-ground");
  });

  it("rejects parallel trace clearance below 16 canvas units", () => {
    const diagram = cloneFixture();
    const wire = diagram.wires.find(item => item.id === "ignition-feed");
    if (!wire) throw new Error("Fixture wire missing");
    wire.points[1].y = 298;
    wire.points[2].y = 298;
    expect(validateDiagram(diagram).some(error => error.startsWith("Trace clearance below 16:"))).toBe(true);
  });

  it("matches the full EasyScan F01 symbol inventory and rejects unknown types", () => {
    expect(SUPPORTED_COMPONENT_TYPES).toEqual(expect.arrayContaining(["ecm", "scu", "acg", "connector", "sensor", "motor", "device"]));
    const diagram = cloneFixture();
    diagram.components[0].type = "unknown" as ElectricalDiagram["components"][number]["type"];
    expect(validateDiagram(diagram)).toContain("Unsupported component type: battery -> unknown");
  });

  it("supports and renders the turn-signal symbol inventory", () => {
    expect(SUPPORTED_COMPONENT_TYPES).toEqual(expect.arrayContaining(["flasher", "diode", "lamp", "selectorSwitch"]));
    const diagram = cloneFixture();
    diagram.components = [
      { id: "flasher", type: "flasher", x: 100, y: 100, width: 100, height: 70, label: "CHỚP XI-NHAN", terminals: [{ id: "in", x: 100, y: 135 }, { id: "out", x: 200, y: 135 }] },
      { id: "diode", type: "diode", x: 260, y: 100, width: 100, height: 70, label: "ĐI-ỐT", terminals: [{ id: "in", x: 260, y: 135 }, { id: "out", x: 360, y: 135 }] },
      { id: "selector", type: "selectorSwitch", x: 420, y: 80, width: 120, height: 110, label: "CÔNG TẮC XI-NHAN", terminals: [{ id: "in", x: 420, y: 135 }, { id: "left", x: 540, y: 110 }, { id: "right", x: 540, y: 165 }] },
      { id: "lamp", type: "lamp", x: 620, y: 100, width: 90, height: 70, label: "ĐÈN XI-NHAN", terminals: [{ id: "in", x: 620, y: 135 }, { id: "ground", x: 710, y: 135 }] },
    ];
    diagram.wires = [];
    const markup = renderToStaticMarkup(createElement(DiagramPreview, { diagram }));
    ["flasher", "diode", "selectorSwitch", "lamp"].forEach(type => expect(markup).toContain("diagramComponent-" + type));
  });
});
