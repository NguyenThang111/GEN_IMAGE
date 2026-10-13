export type DiagramPoint = { x: number; y: number };

export const SUPPORTED_COMPONENT_TYPES = ["battery", "fuse", "relay", "switch", "selectorSwitch", "scu", "ecm", "acg", "connector", "ground", "junction", "horn", "flasher", "diode", "lamp", "gauge", "sensor", "ignitionCoil", "sparkPlug", "motor", "injector", "pump", "valve", "device"] as const;
export type DiagramComponentType = (typeof SUPPORTED_COMPONENT_TYPES)[number];

export type DiagramTerminal = DiagramPoint & { id: string; label?: string };
export type DiagramComponent = {
  id: string;
  type: DiagramComponentType;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  subtitle?: string;
  terminals: DiagramTerminal[];
};
export type WireEndpoint = { componentId: string; terminalId: string };
export type DiagramWire = {
  id: string;
  from: WireEndpoint;
  to: WireEndpoint;
  points: DiagramPoint[];
  code: string;
  primaryColor: string;
  stripeColor?: string;
  state?: "static-live" | "controlled" | "reference";
};
export type ElectricalDiagram = {
  schemaVersion?: number;
  reviewStatus?: "draft" | "layout-reviewed" | "electrically-reviewed";
  sourceImage?: string;
  id: string;
  vehicleId: string;
  vehicleTitle: string;
  circuitTitle: string;
  canvas: { width: number; height: number };
  components: DiagramComponent[];
  wires: DiagramWire[];
};
