"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorDiagramDrawing = VectorDiagramDrawing;
const jsx_runtime_1 = require("C:\\Users\\thang\\OneDrive\\Documents\\PlatformIO\\Projects\\test\\review\\diagram-studio-tools-integration\\apps\\web\\node_modules\\react\\jsx-runtime.js");
const diagram_text_1 = require("./diagram-text.cjs");
const react_1 = require("C:\\Users\\thang\\OneDrive\\Documents\\PlatformIO\\Projects\\test\\review\\diagram-studio-tools-integration\\apps\\web\\node_modules\\react\\index.js");
const vector_drawing_1 = require("./vector-drawing.cjs");
function VectorDiagramDrawing({ drawing }) {
    const data = (0, react_1.useMemo)(() => { const errors = (0, vector_drawing_1.validateVectorDrawing)(drawing); return { errors, elements: errors.length ? [] : (0, vector_drawing_1.flattenVectorDrawing)(drawing) }; }, [drawing]);
    if (data.errors.length)
        return (0, jsx_runtime_1.jsx)("text", { x: 20, y: 35, fill: "#b91c1c", fontSize: 16, children: "L\u1EDBp vector ch\u01B0a h\u1EE3p l\u1EC7. Ki\u1EC3m tra JSON tr\u01B0\u1EDBc khi xu\u1EA5t." });
    return (0, jsx_runtime_1.jsx)("g", { "data-drawing-version": "1", fontFamily: drawing.fontFamily ?? 'Arial, sans-serif', children: data.elements.map((e, i) => e.kind === 'text' ?
            (0, jsx_runtime_1.jsx)("text", { xmlSpace: "preserve", "data-owner": e.owner, "data-role": e.role, x: e.x, y: e.y, fontSize: e.size, textAnchor: e.anchor ?? 'middle', fontWeight: e.bold === false ? 400 : 700, fill: e.fill ?? '#343434', transform: e.rotate ? 'rotate(' + e.rotate + ' ' + e.x + ' ' + e.y + ')' : undefined, children: e.text.includes("\n") ? (0, diagram_text_1.splitDiagramText)(e).map((line, n) => (0, jsx_runtime_1.jsx)("tspan", { x: e.x, y: line.y, children: line.text }, n)) : e.text }, i) :
            e.closed ? (0, jsx_runtime_1.jsx)("polygon", { "data-owner": e.owner, "data-role": e.role, points: e.points.map(p => p.join(',')).join(' '), stroke: e.stroke ?? '#555555', strokeWidth: e.width, fill: e.fill ?? 'none', strokeLinejoin: "round", strokeLinecap: e.cap ?? 'butt' }, i) :
                (0, jsx_runtime_1.jsx)("polyline", { "data-owner": e.owner, "data-role": e.role, points: e.points.map(p => p.join(',')).join(' '), stroke: e.stroke ?? '#555555', strokeWidth: e.width, fill: e.fill ?? 'none', strokeLinejoin: "round", strokeLinecap: e.cap ?? 'butt' }, i)) });
}
