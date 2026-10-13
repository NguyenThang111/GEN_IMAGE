import { validateVectorDrawing } from "./vector-drawing";
import { SUPPORTED_COMPONENT_TYPES, type ElectricalDiagram } from "./contract";

export type DiagramValidation = { diagram: ElectricalDiagram | null; errors: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function validateDiagramInput(input: unknown): DiagramValidation {
  if (!isRecord(input)) return { diagram: null, errors: ["JSON root must be an object"] };
  const errors: string[] = [];
  if (!Array.isArray(input.components)) errors.push("components must be an array");
  if (!Array.isArray(input.wires)) errors.push("wires must be an array");
  if (!isRecord(input.canvas) || !isFiniteNumber(input.canvas.width) || !isFiniteNumber(input.canvas.height)) errors.push("canvas width/height must be numbers");
  for (const field of ["id", "vehicleId", "vehicleTitle", "circuitTitle"] as const) {
    if (typeof input[field] !== "string" || !input[field]) errors.push(field + " must be a non-empty string");
  }
  if (errors.length) return { diagram: null, errors };
  // Imported/manual JSON must be safe for the SVG renderer before geometry review.
  const canvas = input.canvas as Record<string, number>;
  if (canvas.width <= 0 || canvas.height <= 0) errors.push("canvas width/height must be positive");
  if (input.schemaVersion !== undefined && input.schemaVersion !== 1) errors.push("Unsupported schema version");
  const optionalText = (value: unknown) => value === undefined || typeof value === "string";
  if (!optionalText(input.sourceImage)) errors.push("sourceImage must be a string");
  (input.components as unknown[]).forEach((component, index) => {
    const path = `components[${index}]`;
    if (!isRecord(component) || typeof component.id !== "string" || !component.id || typeof component.label !== "string" || !optionalText(component.subtitle) || !Array.isArray(component.terminals)) {
      errors.push(`${path}: invalid id, label or terminals`); return;
    }
    if (!SUPPORTED_COMPONENT_TYPES.includes(component.type as typeof SUPPORTED_COMPONENT_TYPES[number])) errors.push(`${path}: unsupported type`);
    if (![component.x, component.y, component.width, component.height].every(isFiniteNumber) || Number(component.width) < 0 || Number(component.height) < 0) errors.push(`${path}: invalid geometry`);
    if (component.textLayout !== undefined) {
      const layout=component.textLayout;
      if(!isRecord(layout) || !["load-list","note-box","component"].includes(String(layout.kind)) || !Array.isArray(layout.texts) || !layout.texts.every(t=>isRecord(t)&&t.kind==="text") || layout.paths!==undefined && (!Array.isArray(layout.paths)||!layout.paths.every(p=>isRecord(p)&&p.kind==="path")) || layout.padding!==undefined && (!isFiniteNumber(layout.padding)||layout.padding<0)) errors.push(path+": invalid textLayout");
      else errors.push(...validateVectorDrawing({version:1,elements:[...(layout.paths as unknown[] ?? []),...layout.texts]}).map(e=>path+": "+e));
    }
    const minTerminals = component.type === "selectorSwitch" ? 3 : ["battery", "fuse", "switch", "flasher", "diode", "lamp"].includes(String(component.type)) ? 2 : ["ground", "junction"].includes(String(component.type)) ? 1 : 0;
    if (component.terminals.length < minTerminals) errors.push(`${path}: ${component.type} requires at least ${minTerminals} terminals`);
    component.terminals.forEach((terminal, terminalIndex) => {
      if (!isRecord(terminal) || typeof terminal.id !== "string" || !terminal.id || !optionalText(terminal.label) || !isFiniteNumber(terminal.x) || !isFiniteNumber(terminal.y)) errors.push(`${path}.terminals[${terminalIndex}]: invalid terminal`);
    });
  });
  (input.wires as unknown[]).forEach((wire, index) => {
    const path = `wires[${index}]`;
    if (!isRecord(wire) || typeof wire.id !== "string" || !wire.id || typeof wire.code !== "string" || typeof wire.primaryColor !== "string" || !optionalText(wire.stripeColor) || !Array.isArray(wire.points)) {
      errors.push(`${path}: invalid id, code, color or points`); return;
    }
    if(wire.labels!==undefined) {
      if(!Array.isArray(wire.labels)||!wire.labels.every(e=>isRecord(e)&&e.kind==="text"))errors.push(path+": invalid text labels");
      else errors.push(...validateVectorDrawing({version:1,elements:wire.labels}).map(e=>path+": "+e));
    }
    if (wire.points.length < 2 || !wire.points.every(point => isRecord(point) && isFiniteNumber(point.x) && isFiniteNumber(point.y))) errors.push(`${path}: at least two valid points required`);
    for (const endpoint of [wire.from, wire.to]) {
      if (!isRecord(endpoint) || typeof endpoint.componentId !== "string" || typeof endpoint.terminalId !== "string") errors.push(`${path}: invalid endpoint`);
    }
  });
  if(input.annotations !== undefined) {
    if(!Array.isArray(input.annotations)) errors.push("annotations must be an array");
    else {
      const ids=new Set<string>();
      for(const annotation of input.annotations) {
        if(!isRecord(annotation) || typeof annotation.id!=="string" || !annotation.id || !Array.isArray(annotation.elements) || !annotation.elements.every(e=>isRecord(e)&&["text","path"].includes(String(e.kind)))) {errors.push("annotations: invalid text object");continue;}
        if(ids.has(annotation.id))errors.push("annotations: duplicate id");ids.add(annotation.id);
        errors.push(...validateVectorDrawing({version:1,elements:annotation.elements}));
      }
    }
  }
  if (input.drawing !== undefined) errors.push(...validateVectorDrawing(input.drawing));
  if (input.sourceTransform !== undefined && (!isRecord(input.sourceTransform) || ![0,90,180,270].includes(input.sourceTransform.rotateClockwise as number))) errors.push("sourceTransform: rotation must be 0, 90, 180 or 270");
  if (input.sourceCrop !== undefined && (!isRecord(input.sourceCrop) || !['x','y','width','height'].every(k=>isFiniteNumber(input.sourceCrop && (input.sourceCrop as Record<string,unknown>)[k]) && Number.isInteger((input.sourceCrop as Record<string,unknown>)[k])) || Number((input.sourceCrop as Record<string,unknown>).x)<0 || Number((input.sourceCrop as Record<string,unknown>).y)<0 || Number((input.sourceCrop as Record<string,unknown>).width)<=0 || Number((input.sourceCrop as Record<string,unknown>).height)<=0)) errors.push('sourceCrop: non-negative origin and positive integer size required');
  for (const field of ['reviewMetadata','colorReference']) if (input[field] !== undefined && !isRecord(input[field])) errors.push(field + ' must be an object');
  if (errors.length) return { diagram: null, errors };
  const diagram = input as ElectricalDiagram;
  return { diagram, errors: validateDiagram(diagram) };
}

export function validateDiagram(diagram: ElectricalDiagram): string[] {
  const errors: string[] = diagram.drawing ? validateVectorDrawing(diagram.drawing) : [];
  const componentIds = new Set<string>();
  const terminalKeys = new Set<string>();
  const terminalPoints = new Map<string, { x: number; y: number }>();
  const wireIds = new Set<string>();
  const routedSegments: { wireId: string; orientation: "horizontal" | "vertical"; fixed: number; min: number; max: number }[] = [];

  if (diagram.schemaVersion !== undefined && diagram.schemaVersion !== 1) errors.push("Unsupported schema version: " + diagram.schemaVersion);
  if (diagram.reviewStatus !== undefined && !["draft", "layout-reviewed", "electrically-reviewed"].includes(diagram.reviewStatus)) errors.push("Unsupported review status: " + diagram.id);

  diagram.components.forEach((component, index) => {
    if (!isRecord(component) || typeof component.id !== "string" || !Array.isArray(component.terminals)) { errors.push("Invalid component at index " + index); return; }
    if (!SUPPORTED_COMPONENT_TYPES.includes(component.type)) errors.push("Unsupported component type: " + component.id + " -> " + component.type);
    if (componentIds.has(component.id)) errors.push("Duplicate component: " + component.id);
    componentIds.add(component.id);
    component.terminals.forEach((terminal, terminalIndex) => {
      if (!isRecord(terminal) || typeof terminal.id !== "string" || !isFiniteNumber(terminal.x) || !isFiniteNumber(terminal.y)) { errors.push("Invalid terminal: " + component.id + "[" + terminalIndex + "]"); return; }
      const key = component.id + "." + terminal.id;
      if (terminalKeys.has(key)) errors.push("Duplicate terminal: " + key);
      terminalKeys.add(key);
      terminalPoints.set(key, terminal);
    });
  });

  diagram.wires.forEach((wire, index) => {
    if (!isRecord(wire) || typeof wire.id !== "string" || !isRecord(wire.from) || !isRecord(wire.to) || !Array.isArray(wire.points)) { errors.push("Invalid wire at index " + index); return; }
    if (wireIds.has(wire.id)) errors.push("Duplicate wire: " + wire.id);
    wireIds.add(wire.id);
    [wire.from, wire.to].forEach(endpoint => {
      const key = endpoint.componentId + "." + endpoint.terminalId;
      if (!terminalKeys.has(key)) errors.push("Missing endpoint: " + wire.id + " -> " + key);
    });
    const pointsAreValid = wire.points.every(point => isRecord(point) && isFiniteNumber(point.x) && isFiniteNumber(point.y));
    if (!pointsAreValid) { errors.push("Invalid wire points: " + wire.id); return; }
    const firstPoint = wire.points[0];
    const lastPoint = wire.points[wire.points.length - 1];
    const fromPoint = terminalPoints.get(wire.from.componentId + "." + wire.from.terminalId);
    const toPoint = terminalPoints.get(wire.to.componentId + "." + wire.to.terminalId);
    if (!firstPoint || (fromPoint && (firstPoint.x !== fromPoint.x || firstPoint.y !== fromPoint.y))) errors.push("Wire start does not meet terminal: " + wire.id);
    if (!lastPoint || (toPoint && (lastPoint.x !== toPoint.x || lastPoint.y !== toPoint.y))) errors.push("Wire end does not meet terminal: " + wire.id);
    wire.points.slice(1).forEach((point, pointIndex) => {
      const previous = wire.points[pointIndex];
      if (point.x !== previous.x && point.y !== previous.y) { errors.push("Non-orthogonal wire segment: " + wire.id); return; }
      const horizontal = point.y === previous.y;
      routedSegments.push({ wireId: wire.id, orientation: horizontal ? "horizontal" : "vertical", fixed: horizontal ? point.y : point.x, min: horizontal ? Math.min(previous.x, point.x) : Math.min(previous.y, point.y), max: horizontal ? Math.max(previous.x, point.x) : Math.max(previous.y, point.y) });
    });
    if (!/^#[0-9a-f]{6}$/i.test(wire.primaryColor)) errors.push("Invalid wire color: " + wire.id);
    if (wire.stripeColor && !/^#[0-9a-f]{6}$/i.test(wire.stripeColor)) errors.push("Invalid stripe color: " + wire.id);
  });

  routedSegments.forEach((left, leftIndex) => routedSegments.slice(leftIndex + 1).forEach(right => {
    if (left.wireId === right.wireId || left.orientation !== right.orientation) return;
    const leftWire = diagram.wires.find(wire => wire.id === left.wireId);
    const rightWire = diagram.wires.find(wire => wire.id === right.wireId);
    if (!leftWire || !rightWire) return;
    const sharesTerminal = [leftWire.from, leftWire.to].some(leftEndpoint => [rightWire.from, rightWire.to].some(rightEndpoint => leftEndpoint.componentId === rightEndpoint.componentId && leftEndpoint.terminalId === rightEndpoint.terminalId));
    if (sharesTerminal) return;
    const overlap = Math.min(left.max, right.max) - Math.max(left.min, right.min);
    const clearance = Math.abs(left.fixed - right.fixed);
    if (overlap >= 16 && clearance < 16) errors.push("Trace clearance below 16: " + left.wireId + " <> " + right.wireId);
  }));
  return errors;
}
