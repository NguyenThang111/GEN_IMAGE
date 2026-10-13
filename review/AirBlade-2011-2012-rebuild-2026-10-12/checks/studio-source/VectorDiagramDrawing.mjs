import { jsx as _jsx } from "react/jsx-runtime";
import { splitDiagramText } from './diagram-text.mjs';
import { useMemo } from 'react';
import { flattenVectorDrawing, validateVectorDrawing } from './vector-drawing.mjs';
export function VectorDiagramDrawing({ drawing }) {
    const data = useMemo(() => { const errors = validateVectorDrawing(drawing); return { errors, elements: errors.length ? [] : flattenVectorDrawing(drawing) }; }, [drawing]);
    if (data.errors.length)
        return _jsx("text", { x: 20, y: 35, fill: "#b91c1c", fontSize: 16, children: "L\u1EDBp vector ch\u01B0a h\u1EE3p l\u1EC7. Ki\u1EC3m tra JSON tr\u01B0\u1EDBc khi xu\u1EA5t." });
    return _jsx("g", { "data-drawing-version": "1", fontFamily: drawing.fontFamily ?? 'Arial, sans-serif', children: data.elements.map((e, i) => e.kind === 'text' ?
            _jsx("text", { xmlSpace: "preserve", "data-owner": e.owner, "data-role": e.role, x: e.x, y: e.y, fontSize: e.size, textAnchor: e.anchor ?? 'middle', fontWeight: e.bold === false ? 400 : 700, fill: e.fill ?? '#343434', transform: e.rotate ? 'rotate(' + e.rotate + ' ' + e.x + ' ' + e.y + ')' : undefined, children: e.text.includes("\n") ? splitDiagramText(e).map((line, n) => _jsx("tspan", { x: e.x, y: line.y, children: line.text }, n)) : e.text }, i) :
            e.closed ? _jsx("polygon", { "data-owner": e.owner, "data-role": e.role, points: e.points.map(p => p.join(',')).join(' '), stroke: e.stroke ?? '#555555', strokeWidth: e.width, fill: e.fill ?? 'none', strokeLinejoin: "round", strokeLinecap: e.cap ?? 'butt' }, i) :
                _jsx("polyline", { "data-owner": e.owner, "data-role": e.role, points: e.points.map(p => p.join(',')).join(' '), stroke: e.stroke ?? '#555555', strokeWidth: e.width, fill: e.fill ?? 'none', strokeLinejoin: "round", strokeLinecap: e.cap ?? 'butt' }, i)) });
}
