"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitDiagramText = splitDiagramText;
exports.textLayoutLabel = textLayoutLabel;
exports.normalizeLabelLines = normalizeLabelLines;
exports.sourceLabelLines = sourceLabelLines;
exports.wrapDiagramLines = wrapDiagramLines;
exports.terminalSourceLabel = terminalSourceLabel;
exports.resolveComponentTextLayout = resolveComponentTextLayout;
function splitDiagramText(e) {
    const step = e.lineHeight ?? (e.size ?? 14) * 1.3;
    return e.text.split(/\r?\n/).map((text, index) => ({ ...e, text, y: e.y + index * step }));
}
function textLayoutLabel(layout) {
    return layout.texts.flatMap(e => e.text.split(/\r?\n/)).join('\n');
}
// Legacy drafts may only have label/terminals, with no vector text layout.
// Fit visible text inside its box without changing any terminal or wire data.
function normalizeLabelLines(label) {
    return label.replace(/\\r\\n|\\n|\\r/g, '\n').replace(/\r\n?/g, '\n');
}
function sourceLabelLines(label) {
    return normalizeLabelLines(label).replace(/\s+(?=\d+P(?:\s*\/\s*[A-Za-z]{1,3})?\s*:)/g, '\n').split('\n').map(s => s.trim()).filter(Boolean);
}
let measurementContext;
function textWidth(text, size) {
    if (measurementContext === undefined) {
        measurementContext = null;
        if (typeof document !== 'undefined')
            try {
                measurementContext = document.createElement('canvas').getContext('2d');
            }
            catch { /* SSR uses conservative font metrics. */ }
    }
    if (measurementContext) {
        measurementContext.font = '700 ' + size + 'px Arial';
        return measurementContext.measureText(text).width;
    }
    return Array.from(text).reduce((sum, ch) => sum + (/[ilI1.,:;!| ]/.test(ch) ? .32 : /[MWĐ]/.test(ch) ? .9 : .64) * size, 0);
}
function wrapDiagramLines(lines, width, size) {
    return lines.flatMap(line => {
        if (textWidth(line, size) <= width)
            return [line];
        const out = [];
        let current = '';
        for (const word of line.split(/\s+/)) {
            const next = current ? current + ' ' + word : word;
            if (current && textWidth(next, size) > width) {
                out.push(current);
                current = word;
            }
            else
                current = next;
        }
        if (current)
            out.push(current);
        return out;
    });
}
function framePath(c) {
    return { kind: 'path', points: [[c.x, c.y], [c.x + c.width, c.y], [c.x + c.width, c.y + c.height], [c.x, c.y + c.height]], closed: true, fill: '#ffffff', stroke: '#777777', width: 1, owner: c.id, role: 'symbol' };
}
function terminalSourceLabel(t) {
    const pin = (typeof t.pin === 'string' || typeof t.pin === 'number') ? String(t.pin) : '';
    const label = t.label ?? '';
    return pin && !label.split(/\s+/).includes(pin) ? (pin + ' ' + label).trim() : label || pin || (/^(?:[A-Z]\d+|\d+)$/.test(t.id) ? t.id : '');
}
function resolveComponentTextLayout(c) {
    if (c.textLayout)
        return c.textLayout;
    const symbol = c.symbolType ?? c.type;
    const lines = sourceLabelLines(c.label);
    const isNote = symbol === 'annotationBox' || /^(?:legend|note|annotation)(?:$|[-_\d])/i.test(c.id) || /^(?:ghi chú|lưu ý|note)(?=\s|:|$)/iu.test(c.label) || /\d+P(?:\s*\/\s*[A-Za-z]{1,3})?\s*:\s*Đầu nối/iu.test(c.label);
    if (isNote && lines.length) {
        const padding = Math.min(10, c.width * .08, c.height * .08);
        const hasTitle = /^(?:GHI CHÚ|LƯU Ý|NOTE)\s*:?$/iu.test(lines[0]);
        const title = hasTitle ? lines[0] : undefined;
        const body = hasTitle ? lines.slice(1) : lines;
        const heading = title ? Math.min(14, c.height * .18) : 0;
        const titleBaseline = Math.round(c.y + padding + heading * .57);
        const bodyTop = title ? titleBaseline + 14 : c.y + padding;
        const availableHeight = c.y + c.height - padding - bodyTop;
        let size = 10, wrapped = wrapDiagramLines(body, c.width - 2 * padding, size);
        while (size > 6 && size + (wrapped.length - 1) * size * 2 + size * .25 > availableHeight) {
            size -= .5;
            wrapped = wrapDiagramLines(body, c.width - 2 * padding, size);
        }
        const texts = [];
        if (title)
            texts.push({ kind: 'text', text: title, x: c.x + c.width / 2, y: titleBaseline, size: heading, anchor: 'middle', owner: c.id });
        wrapped.forEach((text, index) => texts.push({ kind: 'text', text, x: c.x + padding, y: bodyTop + size + index * size * 2, size, anchor: 'start', owner: c.id }));
        const paths = [framePath(c)];
        if (title)
            paths.push({ kind: 'path', points: [[c.x + padding, titleBaseline + 7], [c.x + c.width - padding, c.y + padding + heading + 6]], stroke: '#777777', width: 1, owner: c.id });
        return { kind: 'note-box', texts, paths, padding };
    }
    const labelled = c.terminals.map(t => ({ t, text: terminalSourceLabel(t) })).filter(row => row.text);
    const isBox = ['ecm', 'scu', 'cluster', 'connectorBox', 'pinout', 'device'].includes(symbol) || (c.type === 'connector' && c.width >= 70);
    if (isBox && labelled.length && c.width >= 50) {
        const texts = labelled.map(({ t, text }) => {
            const right = t.x > c.x + c.width / 2;
            const size = Math.min(10, Math.max(6, (c.width - 16) / Math.max(1, textWidth(text, 1))));
            return { kind: 'text', text, x: right ? c.x + c.width - 8 : c.x + 8, y: t.y + size * .35, size, anchor: right ? 'end' : 'start', owner: c.id, role: 'terminal-label' };
        });
        const pinList = labelled.map(row => row.text).join(' ').replace(/\s+/g, ' ').trim();
        if (c.label.replace(/\s+/g, ' ').trim() !== pinList && c.label.trim())
            texts.push({ kind: 'text', text: normalizeLabelLines(c.label), x: c.x + c.width / 2, y: c.y - 8, size: 12, anchor: 'middle', owner: c.id, role: 'component-label' });
        return { kind: 'component', texts, paths: [framePath(c)] };
    }
    if ((symbol === 'loadGroup' || (c.type === 'device' && !c.terminals.length)) && lines.length) {
        const padding = Math.min(10, c.width * .08);
        let size = 12, wrapped = wrapDiagramLines(lines, c.width - 2 * padding, size);
        while (size > 6 && wrapped.length * size * 1.4 > c.height - 2 * padding) {
            size -= .5;
            wrapped = wrapDiagramLines(lines, c.width - 2 * padding, size);
        }
        return { kind: symbol === 'loadGroup' ? 'load-list' : 'component', padding, paths: [framePath(c)], texts: wrapped.map((text, index) => ({ kind: 'text', text, x: c.x + padding, y: c.y + padding + size + index * size * 1.4, size, anchor: 'start', owner: c.id })) };
    }
    return undefined;
}
