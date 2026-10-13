"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diagramForExport = diagramForExport;
exports.deterministicDiagramJson = deterministicDiagramJson;
// Keep provenance, detailed vector drawings, pin labels and wire annotations on round trips.
// Sort extension keys so JSON stays deterministic without discarding supported source data.
const extraFields = (value, known) => Object.fromEntries(Object.keys(value).filter(key => !known.includes(key)).sort().map(key => [key, value[key]]));
const componentJson = (component) => ({
    ...extraFields(component, ["id", "type", "x", "y", "width", "height", "label", "subtitle", "terminals"]),
    id: component.id,
    type: component.type,
    x: component.x,
    y: component.y,
    width: component.width,
    height: component.height,
    label: component.label,
    ...(component.subtitle ? { subtitle: component.subtitle } : {}),
    terminals: component.terminals.map(terminal => ({
        ...extraFields(terminal, ["id", "label", "x", "y"]),
        id: terminal.id,
        ...(terminal.label ? { label: terminal.label } : {}),
        x: terminal.x,
        y: terminal.y,
    })),
});
const wireJson = (wire) => ({
    ...extraFields(wire, ["id", "from", "to", "points", "code", "primaryColor", "stripeColor", "state"]),
    id: wire.id,
    from: { componentId: wire.from.componentId, terminalId: wire.from.terminalId },
    to: { componentId: wire.to.componentId, terminalId: wire.to.terminalId },
    points: wire.points.map(point => ({ x: point.x, y: point.y })),
    code: wire.code,
    primaryColor: wire.primaryColor,
    ...(wire.stripeColor ? { stripeColor: wire.stripeColor } : {}),
    ...(wire.state ? { state: wire.state } : {}),
});
function diagramForExport(diagram) {
    return {
        ...extraFields(diagram, ["schemaVersion", "reviewStatus", "sourceImage", "id", "vehicleId", "vehicleTitle", "circuitTitle", "canvas", "components", "wires"]),
        schemaVersion: diagram.schemaVersion ?? 1,
        reviewStatus: diagram.reviewStatus ?? "draft",
        ...(diagram.sourceImage ? { sourceImage: diagram.sourceImage } : {}),
        id: diagram.id,
        vehicleId: diagram.vehicleId,
        vehicleTitle: diagram.vehicleTitle,
        circuitTitle: diagram.circuitTitle,
        canvas: { ...diagram.canvas, width: diagram.canvas.width, height: diagram.canvas.height },
        components: diagram.components.map(componentJson),
        wires: diagram.wires.map(wireJson),
    };
}
function deterministicDiagramJson(diagram) {
    return JSON.stringify(diagramForExport(diagram), null, 2) + "\n";
}
