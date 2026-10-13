import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import type { DiagramPoint, ElectricalDiagram } from "./contract";
import { DiagramComponentSymbol } from "./DiagramPreview";

export type EditorTool = "select" | "pan" | "component" | "terminal" | "wire";
export type EditorSelection =
  | { kind: "diagram" }
  | { kind: "component"; componentId: string }
  | { kind: "terminal"; componentId: string; terminalId: string }
  | { kind: "wire"; wireId: string };
export type WireDraft = { from: { componentId: string; terminalId: string }; points: DiagramPoint[] } | null;
export type CanvasTransform = { x: number; y: number; scale: number };

type Props = {
  diagram: ElectricalDiagram;
  tool: EditorTool;
  selection: EditorSelection;
  wireDraft: WireDraft;
  backgroundUrl: string;
  backgroundOpacity: number;
  backgroundVisible: boolean;
  backgroundView?: { x: number; y: number; width: number; height: number };
  componentType: ElectricalDiagram["components"][number]["type"] | null;
  transform: CanvasTransform;
  fitVersion: number;
  onTransform: (transform: CanvasTransform) => void;
  onSelect: (selection: EditorSelection) => void;
  onMoveComponent: (componentId: string, dx: number, dy: number) => void;
  onMoveTerminal: (componentId: string, terminalId: string, point: DiagramPoint) => void;
  onPlaceTerminal: (point: DiagramPoint) => void;
  onWireTerminal: (componentId: string, terminalId: string, point: DiagramPoint) => void;
  onWirePoint: (point: DiagramPoint) => void;
  onCreateComponent: (type: ElectricalDiagram["components"][number]["type"], bounds: { x: number; y: number; width: number; height: number }) => void;
};

type DragState =
  | { kind: "pan"; pointerId: number; startClient: DiagramPoint; base: CanvasTransform }
  | { kind: "frame"; pointerId: number; start: DiagramPoint; current: DiagramPoint }
  | { kind: "component"; pointerId: number; componentId: string; start: DiagramPoint; current: DiagramPoint }
  | { kind: "terminal"; pointerId: number; componentId: string; terminalId: string; current: DiagramPoint };

const GRID = 10;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const snap = (value: number) => Math.round(value / GRID) * GRID;

export function DiagramEditorCanvas(props: Props) {
  const { diagram, tool, selection, wireDraft, backgroundUrl, backgroundOpacity, backgroundVisible, transform } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [cursor, setCursor] = useState<DiagramPoint>({ x: 0, y: 0 });

  const canvasPoint = (clientX: number, clientY: number): DiagramPoint => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: snap((clientX - rect.left - transform.x) / transform.scale), y: snap((clientY - rect.top - transform.y) / transform.scale) };
  };

  const previewDiagram = useMemo(() => {
    if (!drag || drag.kind === "pan" || drag.kind === "frame") return diagram;
    const next = structuredClone(diagram);
    if (drag.kind === "component") {
      const component = next.components.find(item => item.id === drag.componentId);
      if (component) {
        const dx = drag.current.x - drag.start.x;
        const dy = drag.current.y - drag.start.y;
        component.x += dx;
        component.y += dy;
        component.terminals.forEach(terminal => { terminal.x += dx; terminal.y += dy; });
      }
    } else {
      const terminal = next.components.find(item => item.id === drag.componentId)?.terminals.find(item => item.id === drag.terminalId);
      if (terminal) Object.assign(terminal, drag.current);
    }
    return next;
  }, [diagram, drag]);

  useEffect(() => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = Math.min(rect.width / diagram.canvas.width, rect.height / diagram.canvas.height) * 0.92;
    props.onTransform({ scale, x: (rect.width - diagram.canvas.width * scale) / 2, y: (rect.height - diagram.canvas.height * scale) / 2 });
  }, [diagram.canvas.height, diagram.canvas.width, props.fitVersion]);

  function beginBackground(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.target !== event.currentTarget && (event.target as Element).closest("[data-editor-layer]")) return;
    const point = canvasPoint(event.clientX, event.clientY);
    if (tool === "pan") {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({ kind: "pan", pointerId: event.pointerId, startClient: { x: event.clientX, y: event.clientY }, base: transform });
    } else if (tool === "component" && props.componentType) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({ kind: "frame", pointerId: event.pointerId, start: point, current: point });
    } else if (tool === "terminal") props.onPlaceTerminal(point);
    else if (tool === "wire" && wireDraft) props.onWirePoint(point);
    else props.onSelect({ kind: "diagram" });
  }

  function pointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    setCursor(canvasPoint(event.clientX, event.clientY));
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.kind === "pan") props.onTransform({ ...drag.base, x: drag.base.x + event.clientX - drag.startClient.x, y: drag.base.y + event.clientY - drag.startClient.y });
    else if (drag.kind === "component" || drag.kind === "frame") setDrag({ ...drag, current: canvasPoint(event.clientX, event.clientY) });
    else setDrag({ ...drag, current: canvasPoint(event.clientX, event.clientY) });
  }

  function pointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.kind === "component") props.onMoveComponent(drag.componentId, drag.current.x - drag.start.x, drag.current.y - drag.start.y);
    if (drag.kind === "frame" && props.componentType) {
      const x = Math.min(drag.start.x, drag.current.x);
      const y = Math.min(drag.start.y, drag.current.y);
      const width = Math.max(20, Math.abs(drag.current.x - drag.start.x));
      const height = Math.max(20, Math.abs(drag.current.y - drag.start.y));
      props.onCreateComponent(props.componentType, { x, y, width, height });
    }
    if (drag.kind === "terminal") props.onMoveTerminal(drag.componentId, drag.terminalId, drag.current);
    setDrag(null);
  }

  function wheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextScale = clamp(transform.scale * (event.deltaY < 0 ? 1.12 : 0.89), 0.12, 4);
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;
    const diagramX = (clientX - transform.x) / transform.scale;
    const diagramY = (clientY - transform.y) / transform.scale;
    props.onTransform({ scale: nextScale, x: clientX - diagramX * nextScale, y: clientY - diagramY * nextScale });
  }

  const draftPoints = wireDraft?.points ?? [];
  return <div className="diagramEditorCanvas" ref={wrapRef}>
    <svg onPointerDown={beginBackground} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => setDrag(null)} onWheel={wheel}>
      <defs><pattern id="diagram-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse"><path d={"M " + GRID + " 0 L 0 0 0 " + GRID} /></pattern></defs>
      <g transform={"translate(" + transform.x + " " + transform.y + ") scale(" + transform.scale + ")"}>
        <rect width={diagram.canvas.width} height={diagram.canvas.height} className="diagramEditorPaper" />
        {backgroundUrl && backgroundVisible && <image href={backgroundUrl} x={-(props.backgroundView?.x ?? 0)} y={-(props.backgroundView?.y ?? 0)} width={props.backgroundView?.width ?? diagram.canvas.width} height={props.backgroundView?.height ?? diagram.canvas.height} preserveAspectRatio="none" opacity={backgroundOpacity} pointerEvents="none" />}
        <rect width={diagram.canvas.width} height={diagram.canvas.height} fill="url(#diagram-grid)" className="diagramGrid" pointerEvents="none" />
        <g data-editor-layer="wires">{previewDiagram.wires.map(wire => {
          const points = wire.points.map(point => point.x + "," + point.y).join(" ");
          const selected = selection.kind === "wire" && selection.wireId === wire.id;
          return <g key={wire.id} className={selected ? "editorSelected" : ""} onPointerDown={event => { event.stopPropagation(); props.onSelect({ kind: "wire", wireId: wire.id }); }}><polyline className="editorWireHit" points={points} /><polyline className="editorWire" points={points} stroke={wire.primaryColor} />{wire.stripeColor && <polyline className="editorWireStripe" points={points} stroke={wire.stripeColor} />}</g>;
        })}</g>
        {draftPoints.length > 0 && <polyline className="editorWireDraft" points={draftPoints.map(point => point.x + "," + point.y).join(" ")} />}
        {drag?.kind === "frame" && <rect className="editorComponentFrame" x={Math.min(drag.start.x, drag.current.x)} y={Math.min(drag.start.y, drag.current.y)} width={Math.abs(drag.current.x - drag.start.x)} height={Math.abs(drag.current.y - drag.start.y)} />}
        <g data-editor-layer="components">{previewDiagram.components.map(component => {
          const selected = selection.kind === "component" && selection.componentId === component.id;
          return <g key={component.id} className={selected ? "editorSelected" : ""} onPointerDown={event => {
            event.stopPropagation();
            if (tool !== "select") { props.onSelect({ kind: "component", componentId: component.id }); return; }
            const point = canvasPoint(event.clientX, event.clientY);
            (event.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(event.pointerId);
            props.onSelect({ kind: "component", componentId: component.id });
            setDrag({ kind: "component", pointerId: event.pointerId, componentId: component.id, start: point, current: point });
          }}><DiagramComponentSymbol component={component} />
          {component.terminals.map(terminal => {
            const terminalSelected = selection.kind === "terminal" && selection.componentId === component.id && selection.terminalId === terminal.id;
            return <circle key={"editor-" + terminal.id} cx={terminal.x} cy={terminal.y} r="9" className={terminalSelected ? "editorTerminal selected" : "editorTerminal"} onPointerDown={event => {
              event.stopPropagation();
              if (tool === "wire") { props.onWireTerminal(component.id, terminal.id, { x: terminal.x, y: terminal.y }); return; }
              props.onSelect({ kind: "terminal", componentId: component.id, terminalId: terminal.id });
              if (tool === "select") { (event.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(event.pointerId); setDrag({ kind: "terminal", pointerId: event.pointerId, componentId: component.id, terminalId: terminal.id, current: { x: terminal.x, y: terminal.y } }); }
            }} />;
          })}</g>;
        })}</g>
      </g>
    </svg>
    <div className="diagramCoordinateReadout">X {cursor.x} · Y {cursor.y}</div><div className="diagramZoomReadout">{Math.round(transform.scale * 100)}%</div>
  </div>;
}
