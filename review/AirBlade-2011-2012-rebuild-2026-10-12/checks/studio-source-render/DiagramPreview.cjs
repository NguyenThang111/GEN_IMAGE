"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagramComponentSymbol = DiagramComponentSymbol;
exports.DiagramPreview = DiagramPreview;
const jsx_runtime_1 = require("C:\\Users\\thang\\OneDrive\\Documents\\PlatformIO\\Projects\\test\\review\\diagram-studio-tools-integration\\apps\\web\\node_modules\\react\\jsx-runtime.js");
const diagram_text_1 = require("./diagram-text.cjs");
const VectorDiagramDrawing_1 = require("./VectorDiagramDrawing.cjs");
const stroke = "currentColor";
function TerminalDots({ component }) {
    return (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: component.terminals.map(terminal => (0, jsx_runtime_1.jsx)("circle", { cx: terminal.x, cy: terminal.y, r: "4", className: "diagramTerminal" }, component.id + "." + terminal.id)) });
}
function DiagramComponentSymbol({ component }) {
    const layout = (0, diagram_text_1.resolveComponentTextLayout)(component);
    if (layout && ['load-list', 'note-box', 'component'].includes(layout.kind))
        return (0, jsx_runtime_1.jsxs)("g", { "data-component-id": component.id, "data-text-kind": layout.kind, className: "diagramTextObject", children: [(0, jsx_runtime_1.jsx)(VectorDiagramDrawing_1.VectorDiagramDrawing, { drawing: { version: 1, elements: [...(layout.paths ?? []), ...layout.texts] } }), !component.textLayout && layout.kind === "component" && (0, jsx_runtime_1.jsx)(TerminalDots, { component: component })] });
    const explicitText = !!layout?.texts.length;
    const centerX = component.x + component.width / 2;
    const centerY = component.y + component.height / 2;
    const first = component.terminals[0];
    const second = component.terminals[1];
    let symbol;
    switch (component.type) {
        case "battery": {
            const bodyX = centerX - 36;
            const bodyY = centerY - 26;
            symbol = (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("rect", { x: bodyX, y: bodyY, width: "72", height: "52", rx: "4" }), (0, jsx_runtime_1.jsx)("line", { x1: first.x, y1: first.y, x2: bodyX, y2: bodyY + 36 }), (0, jsx_runtime_1.jsx)("line", { x1: second.x, y1: second.y, x2: bodyX + 72, y2: bodyY + 16 }), (0, jsx_runtime_1.jsx)("text", { x: bodyX + 20, y: bodyY + 34, children: "\u2212" }), (0, jsx_runtime_1.jsx)("text", { x: bodyX + 53, y: bodyY + 34, className: "diagramPositive", children: "+" })] });
            break;
        }
        case "fuse": {
            const x1 = centerX - 31;
            const x2 = centerX + 31;
            symbol = (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("line", { x1: first.x, y1: first.y, x2: x1, y2: centerY }), (0, jsx_runtime_1.jsx)("rect", { x: x1, y: centerY - 12, width: "62", height: "24", rx: "12" }), (0, jsx_runtime_1.jsx)("path", { d: "M " + (x1 + 8) + " " + centerY + " C " + (x1 + 20) + " " + (centerY - 10) + ", " + (x2 - 20) + " " + (centerY + 10) + ", " + (x2 - 8) + " " + centerY }), (0, jsx_runtime_1.jsx)("line", { x1: x2, y1: centerY, x2: second.x, y2: second.y })] });
            break;
        }
        case "relay": {
            const bodyX = centerX - 38;
            const bodyY = centerY - 28;
            symbol = (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("rect", { x: bodyX, y: bodyY, width: "76", height: "56", rx: "5" }), (0, jsx_runtime_1.jsx)("line", { x1: bodyX + 12, y1: bodyY + 17, x2: bodyX + 52, y2: bodyY + 9 }), (0, jsx_runtime_1.jsx)("path", { d: "M " + (bodyX + 14) + " " + (bodyY + 39) + " q 8 -12 16 0 q 8 12 16 0 q 8 -12 16 0" }), component.terminals.map(terminal => (0, jsx_runtime_1.jsx)("line", { x1: terminal.x, y1: terminal.y, x2: Math.max(bodyX, Math.min(bodyX + 76, terminal.x)), y2: Math.max(bodyY, Math.min(bodyY + 56, terminal.y)) }, "lead-" + terminal.id))] });
            break;
        }
        case "switch": {
            const leftX = first.x + 24;
            const rightX = second.x - 24;
            const contactY = (first.y + second.y) / 2;
            symbol = (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("line", { x1: first.x, y1: first.y, x2: leftX, y2: contactY }), (0, jsx_runtime_1.jsx)("line", { x1: rightX, y1: contactY, x2: second.x, y2: second.y }), (0, jsx_runtime_1.jsx)("circle", { cx: leftX, cy: contactY, r: "5" }), (0, jsx_runtime_1.jsx)("circle", { cx: rightX, cy: contactY, r: "5" }), (0, jsx_runtime_1.jsx)("line", { x1: leftX + 4, y1: contactY, x2: rightX - 5, y2: contactY - 14 })] });
            break;
        }
        case "selectorSwitch": {
            const third = component.terminals[2];
            const contactX = first.x + Math.min(32, component.width * .28);
            symbol = (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("line", { x1: first.x, y1: first.y, x2: contactX, y2: first.y }), (0, jsx_runtime_1.jsx)("circle", { cx: contactX, cy: first.y, r: "5" }), (0, jsx_runtime_1.jsx)("circle", { cx: second.x - 18, cy: second.y, r: "5" }), (0, jsx_runtime_1.jsx)("circle", { cx: third.x - 18, cy: third.y, r: "5" }), (0, jsx_runtime_1.jsx)("line", { x1: contactX + 4, y1: first.y, x2: second.x - 22, y2: second.y }), (0, jsx_runtime_1.jsx)("line", { x1: second.x - 18, y1: second.y, x2: second.x, y2: second.y }), (0, jsx_runtime_1.jsx)("line", { x1: third.x - 18, y1: third.y, x2: third.x, y2: third.y })] });
            break;
        }
        case "flasher":
            symbol = (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("rect", { x: centerX - 34, y: centerY - 20, width: "68", height: "40", rx: "5" }), (0, jsx_runtime_1.jsx)("path", { d: "M " + (centerX - 27) + " " + (centerY + 9) + " h10 v-18 h10 v18 h10 v-18 h10 v18 h10" }), (0, jsx_runtime_1.jsx)("line", { x1: first.x, y1: first.y, x2: centerX - 34, y2: centerY }), (0, jsx_runtime_1.jsx)("line", { x1: centerX + 34, y1: centerY, x2: second.x, y2: second.y })] });
            break;
        case "diode":
            symbol = (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("line", { x1: first.x, y1: first.y, x2: centerX - 22, y2: centerY }), (0, jsx_runtime_1.jsx)("path", { d: "M " + (centerX - 22) + " " + (centerY - 17) + " L " + (centerX + 12) + " " + centerY + " L " + (centerX - 22) + " " + (centerY + 17) + " Z" }), (0, jsx_runtime_1.jsx)("line", { x1: centerX + 12, y1: centerY - 19, x2: centerX + 12, y2: centerY + 19 }), (0, jsx_runtime_1.jsx)("line", { x1: centerX + 12, y1: centerY, x2: second.x, y2: second.y })] });
            break;
        case "lamp":
            symbol = (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("line", { x1: first.x, y1: first.y, x2: centerX - 20, y2: centerY }), (0, jsx_runtime_1.jsx)("circle", { cx: centerX, cy: centerY, r: "20" }), (0, jsx_runtime_1.jsx)("line", { x1: centerX - 13, y1: centerY - 13, x2: centerX + 13, y2: centerY + 13 }), (0, jsx_runtime_1.jsx)("line", { x1: centerX + 13, y1: centerY - 13, x2: centerX - 13, y2: centerY + 13 }), (0, jsx_runtime_1.jsx)("line", { x1: centerX + 20, y1: centerY, x2: second.x, y2: second.y })] });
            break;
        case "ecm":
        case "scu":
            symbol = (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("rect", { x: component.x, y: component.y, width: component.width, height: component.height, rx: "6" }), !explicitText && (0, jsx_runtime_1.jsx)("text", { x: centerX, y: centerY + 6, className: "diagramUnitLabel", children: component.type.toUpperCase() }), component.terminals.map(terminal => (0, jsx_runtime_1.jsx)("line", { x1: terminal.x, y1: terminal.y, x2: Math.max(component.x, Math.min(component.x + component.width, terminal.x)), y2: Math.max(component.y, Math.min(component.y + component.height, terminal.y)) }, "lead-" + terminal.id))] });
            break;
        case "acg":
            symbol = (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("circle", { cx: centerX, cy: centerY, r: Math.min(42, component.width / 2, component.height / 2) }), !explicitText && (0, jsx_runtime_1.jsx)("text", { x: centerX, y: centerY + 6, className: "diagramUnitLabel", children: "Y" }), component.terminals.map(terminal => (0, jsx_runtime_1.jsx)("line", { x1: terminal.x, y1: terminal.y, x2: centerX, y2: centerY }, "lead-" + terminal.id))] });
            break;
        case "connector":
            symbol = (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("rect", { x: centerX - 18, y: component.y, width: "36", height: component.height, rx: "3" }), component.terminals.map((terminal, index) => (0, jsx_runtime_1.jsxs)("g", { children: [(0, jsx_runtime_1.jsx)("line", { x1: terminal.x, y1: terminal.y, x2: centerX, y2: terminal.y }), (0, jsx_runtime_1.jsx)("circle", { cx: centerX, cy: component.y + ((index + 1) * component.height) / (component.terminals.length + 1), r: "3" })] }, "socket-" + terminal.id))] });
            break;
        case "gauge":
            symbol = (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("circle", { cx: centerX, cy: centerY, r: Math.min(30, component.width / 2, component.height / 2) }), (0, jsx_runtime_1.jsx)("path", { d: `M ${centerX - 24} ${centerY + 10} A 26 26 0 0 1 ${centerX + 24} ${centerY + 10}` }), (0, jsx_runtime_1.jsx)("line", { x1: centerX, y1: centerY + 8, x2: centerX + 16, y2: centerY - 8 })] });
            break;
        case "sensor":
        case "ignitionCoil":
        case "sparkPlug":
        case "motor":
        case "injector":
        case "pump":
        case "valve":
        case "loadGroup":
        case "sender":
        case "connectorBox":
        case "pinout":
        case "cluster":
        case "rotor":
        case "speaker":
        case "assembly":
        case "coil":
        case "led":
        case "remote":
        case "annotationBox":
        case "solenoid":
        case "buzzer":
        case "indicator":
        case "device":
            symbol = (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("rect", { x: component.x, y: component.y, width: component.width, height: component.height, rx: "5" }), !explicitText && (0, jsx_runtime_1.jsx)("text", { x: centerX, y: centerY + 5, className: "diagramUnitLabel", children: component.type === "motor" ? "M" : component.type === "pump" ? "P" : component.type === "sensor" ? "S" : "•" }), component.terminals.map(terminal => (0, jsx_runtime_1.jsx)("line", { x1: terminal.x, y1: terminal.y, x2: centerX, y2: centerY }, "lead-" + terminal.id))] });
            break;
        case "ground":
            symbol = (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("line", { x1: first.x, y1: first.y, x2: first.x, y2: first.y + 18 }), (0, jsx_runtime_1.jsx)("line", { x1: first.x - 18, y1: first.y + 18, x2: first.x + 18, y2: first.y + 18 }), (0, jsx_runtime_1.jsx)("line", { x1: first.x - 12, y1: first.y + 27, x2: first.x + 12, y2: first.y + 27 }), (0, jsx_runtime_1.jsx)("line", { x1: first.x - 6, y1: first.y + 36, x2: first.x + 6, y2: first.y + 36 })] });
            break;
        case "horn":
            symbol = (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("path", { d: "M " + (centerX - 24) + " " + (centerY - 8) + " h 14 l 16 -14 v 44 l -16 -14 h -14 Z" }), (0, jsx_runtime_1.jsx)("path", { d: "M " + (centerX + 14) + " " + (centerY - 15) + " Q " + (centerX + 30) + " " + centerY + " " + (centerX + 14) + " " + (centerY + 15) }), component.terminals.map(terminal => (0, jsx_runtime_1.jsx)("path", { d: "M " + terminal.x + " " + terminal.y + " H " + centerX }, "lead-" + terminal.id))] });
            break;
        case "junction":
            symbol = (0, jsx_runtime_1.jsx)("circle", { cx: first.x, cy: first.y, r: "6", className: "diagramJunction" });
            break;
    }
    const labelY = component.type === "ground" ? first.y + 56 : Math.max(component.y + component.height, ...component.terminals.map(terminal => terminal.y)) + 24;
    return (0, jsx_runtime_1.jsxs)("g", { "data-component-id": component.id, className: "diagramComponent diagramComponent-" + component.type, children: [symbol, (0, jsx_runtime_1.jsx)(TerminalDots, { component: component }), layout ? (0, jsx_runtime_1.jsx)(VectorDiagramDrawing_1.VectorDiagramDrawing, { drawing: { version: 1, elements: layout.texts } }) : (0, jsx_runtime_1.jsx)("text", { x: centerX, y: labelY, className: "diagramObjectLabel", xmlSpace: "preserve", children: (0, diagram_text_1.wrapDiagramLines)((0, diagram_text_1.normalizeLabelLines)(component.label).split(/\r?\n/), Math.max(120, component.width), 12).map((line, n) => (0, jsx_runtime_1.jsx)("tspan", { x: centerX, dy: n ? 18 : 0, children: line }, n)) })] });
}
function DiagramPreview({ diagram }) {
    if (diagram.drawing)
        return (0, jsx_runtime_1.jsx)("div", { className: "diagramCanvas", "data-testid": "diagram-preview", children: (0, jsx_runtime_1.jsxs)("svg", { role: "img", "aria-label": (diagram.vehicleModel ?? diagram.vehicleTitle) + " — " + diagram.circuitTitle, viewBox: "0 0 " + diagram.canvas.width + " " + diagram.canvas.height, preserveAspectRatio: "xMidYMid meet", children: [(0, jsx_runtime_1.jsx)("rect", { width: diagram.canvas.width, height: diagram.canvas.height, fill: diagram.drawing.background ?? "#ffffff" }), (0, jsx_runtime_1.jsx)(VectorDiagramDrawing_1.VectorDiagramDrawing, { drawing: diagram.drawing })] }) });
    return (0, jsx_runtime_1.jsx)("div", { className: "diagramCanvas", "data-testid": "diagram-preview", children: (0, jsx_runtime_1.jsxs)("svg", { role: "img", "aria-label": diagram.vehicleTitle + " — " + diagram.circuitTitle, viewBox: "0 0 " + diagram.canvas.width + " " + diagram.canvas.height, preserveAspectRatio: "xMidYMid meet", children: [(0, jsx_runtime_1.jsx)("rect", { className: "diagramBackground", width: diagram.canvas.width, height: diagram.canvas.height, fill: diagram.canvas.background ?? "#ffffff" }), (0, jsx_runtime_1.jsx)("g", { className: "diagramWires", children: diagram.wires.map(wire => {
                        const points = wire.points.map(point => point.x + "," + point.y).join(" ");
                        const labelPoint = wire.points[Math.floor(wire.points.length / 2)];
                        return (0, jsx_runtime_1.jsxs)("g", { "data-wire-id": wire.id, children: [(0, jsx_runtime_1.jsx)("polyline", { points: points, stroke: wire.primaryColor, fill: "none", strokeWidth: "4", strokeLinecap: "round", strokeLinejoin: "round" }), wire.stripeColor && (0, jsx_runtime_1.jsx)("polyline", { points: points, stroke: wire.stripeColor, fill: "none", strokeWidth: "2", strokeDasharray: "10 9", strokeLinecap: "round", strokeLinejoin: "round", className: "diagramWireStripe" }), wire.labels ? (0, jsx_runtime_1.jsx)(VectorDiagramDrawing_1.VectorDiagramDrawing, { drawing: { version: 1, elements: wire.labels } }) : (0, jsx_runtime_1.jsx)("text", { x: labelPoint.x + 6, y: labelPoint.y - 8, className: "diagramWireCode", children: wire.code })] }, wire.id);
                    }) }), (0, jsx_runtime_1.jsx)("g", { color: stroke, children: diagram.components.map(component => (0, jsx_runtime_1.jsx)(DiagramComponentSymbol, { component: component }, component.id)) }), diagram.annotations?.map(annotation => (0, jsx_runtime_1.jsx)("g", { "data-annotation-id": annotation.id, children: (0, jsx_runtime_1.jsx)(VectorDiagramDrawing_1.VectorDiagramDrawing, { drawing: { version: 1, elements: annotation.elements } }) }, annotation.id))] }) });
}
