export type DiagramPoint = { x: number; y: number };

export const SUPPORTED_COMPONENT_TYPES = ["battery", "fuse", "relay", "switch", "selectorSwitch", "scu", "ecm", "acg", "connector", "ground", "junction", "horn", "flasher", "diode", "lamp", "gauge", "sensor", "ignitionCoil", "sparkPlug", "motor", "injector", "pump", "valve", "device", "loadGroup", "sender", "connectorBox", "pinout", "cluster", "rotor", "speaker", "assembly", "coil", "led", "remote", "annotationBox", "solenoid", "buzzer", "indicator"] as const;
export type DiagramComponentType = (typeof SUPPORTED_COMPONENT_TYPES)[number];

export type DiagramTerminal = DiagramPoint & { id: string; label?: string; [key: string]: unknown };
export type DiagramComponent = {
  [key: string]: unknown;
  id: string;
  type: DiagramComponentType;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  symbolType?: string;
  textLayout?: ComponentTextLayout;
  subtitle?: string;
  terminals: DiagramTerminal[];
};
export type WireEndpoint = { componentId: string; terminalId: string };
export type DiagramWire = {
  [key: string]: unknown;
  labels?: DrawingText[];
  strokeWidth?: number;
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
  [key: string]: unknown;
  vehicleModel?: string;
  drawing?: DiagramDrawing;
  annotations?: DiagramAnnotation[];
  sourceCrop?: { x: number; y: number; width: number; height: number };
  sourceTransform?: { rotateClockwise: 0 | 90 | 180 | 270 };
  reviewMetadata?: Record<string, unknown>;
  colorReference?: Record<string, unknown>;
  schemaVersion?: number;
  reviewStatus?: "draft" | "layout-reviewed" | "electrically-reviewed";
  sourceImage?: string;
  id: string;
  vehicleId: string;
  vehicleTitle: string;
  circuitTitle: string;
  canvas: { width: number; height: number; background?: string };
  components: DiagramComponent[];
  wires: DiagramWire[];
};

export type DrawingBase = { owner?: string; role?: string };
export type DrawingPath = DrawingBase & { kind: "path"; points: [number, number][]; stroke?: string; width?: number; fill?: string; closed?: boolean; cap?: "butt" | "round" | "square" };
export type DrawingText = DrawingBase & { kind: "text"; text: string; x: number; y: number; size?: number; fill?: string; anchor?: "start" | "middle" | "end"; rotate?: number; bold?: boolean; lineHeight?: number };
export type DrawingUse = DrawingBase & { kind: "use"; symbol: string; matrix: [number, number, number, number, number, number] };
export type DrawingElement = DrawingPath | DrawingText | DrawingUse;
export type DiagramDrawing = { version: 1; background?: string; fontFamily?: string; symbols?: Record<string, DrawingElement[]>; elements: DrawingElement[] };

export type ComponentTextLayout = { kind: "load-list" | "note-box" | "component"; texts: DrawingText[]; paths?: DrawingPath[]; padding?: number };
export type DiagramAnnotation = { id: string; elements: (DrawingPath | DrawingText)[] };
