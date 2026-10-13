"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateVectorDrawing = validateVectorDrawing;
exports.flattenVectorDrawing = flattenVectorDrawing;
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const record = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const color = (v) => v === undefined || typeof v === 'string' && /^(?:#[0-9a-f]{3}|#[0-9a-f]{4}|#[0-9a-f]{6}|#[0-9a-f]{8}|white|black|none|transparent|currentColor)$/i.test(v);
const MAX_ELEMENTS = 30000, MAX_POINTS = 350000;
function validateVectorDrawing(value) {
    if (!record(value) || value.version !== 1 || !Array.isArray(value.elements))
        return ['drawing: version=1 and elements array required'];
    const errors = [];
    if (!color(value.background))
        errors.push('drawing: invalid background');
    if (value.fontFamily !== undefined && (typeof value.fontFamily !== 'string' || value.fontFamily.length > 100))
        errors.push('drawing: invalid font family');
    if (value.symbols !== undefined && !record(value.symbols))
        return ['drawing: symbols must be an object'];
    const symbols = (value.symbols ?? {});
    let count = 0, points = 0;
    const check = (items, at) => {
        if (!Array.isArray(items)) {
            errors.push(at + ': array required');
            return;
        }
        for (const e of items) {
            if (++count > MAX_ELEMENTS) {
                errors.push('drawing: too many elements');
                return;
            }
            if (!record(e)) {
                errors.push(at + ': invalid element');
                continue;
            }
            if (e.owner !== undefined && typeof e.owner !== 'string' || e.role !== undefined && typeof e.role !== 'string')
                errors.push(at + ': invalid owner/role');
            if (e.kind === 'path') {
                if (!Array.isArray(e.points) || e.points.length < 2 || !e.points.every(p => Array.isArray(p) && p.length === 2 && p.every(finite)))
                    errors.push(at + ': invalid path points');
                points += Array.isArray(e.points) ? e.points.length : 0;
                if (!color(e.stroke) || !color(e.fill) || e.width !== undefined && (!finite(e.width) || e.width < 0 || e.width > 1000) || e.closed !== undefined && typeof e.closed !== 'boolean' || e.cap !== undefined && !['butt', 'round', 'square'].includes(String(e.cap)))
                    errors.push(at + ': invalid path style');
            }
            else if (e.kind === 'text') {
                if (typeof e.text !== 'string' || e.text.length > 10000 || !finite(e.x) || !finite(e.y) || e.size !== undefined && (!finite(e.size) || e.size <= 0 || e.size > 1000) || e.rotate !== undefined && !finite(e.rotate) || e.lineHeight !== undefined && (!finite(e.lineHeight) || e.lineHeight <= 0 || e.lineHeight > 1000) || e.bold !== undefined && typeof e.bold !== 'boolean' || !color(e.fill) || e.anchor !== undefined && !['start', 'middle', 'end'].includes(String(e.anchor)))
                    errors.push(at + ': invalid text');
            }
            else if (e.kind === 'use') {
                if (typeof e.symbol !== 'string' || !Object.hasOwn(symbols, String(e.symbol)) || !Array.isArray(e.matrix) || e.matrix.length !== 6 || !e.matrix.every(finite))
                    errors.push(at + ': unknown symbol or invalid transform');
            }
            else
                errors.push(at + ': unsupported vector primitive ' + String(e.kind));
        }
    };
    check(value.elements, 'drawing.elements');
    for (const [id, items] of Object.entries(symbols))
        check(items, 'drawing.symbols.' + id);
    if (points > MAX_POINTS)
        errors.push('drawing: too many path points');
    if (!errors.length) {
        try {
            flattenVectorDrawing(value);
        }
        catch (e) {
            errors.push(e instanceof Error ? e.message : 'drawing: invalid symbol graph');
        }
    }
    return [...new Set(errors)];
}
function flattenVectorDrawing(drawing) {
    const result = [];
    let points = 0;
    const emit = (e, m, stack, owner, role) => {
        const [a, b, c, d, tx, ty] = m;
        const xy = (x, y) => [a * x + c * y + tx, b * x + d * y + ty];
        if (e.kind === 'use') {
            if (stack.includes(e.symbol) || stack.length >= 20)
                throw new Error('drawing: cyclic/deep symbol reference ' + e.symbol);
            const children = drawing.symbols?.[e.symbol];
            if (!children)
                throw new Error('drawing: unknown symbol ' + e.symbol);
            const [A, B, C, D, X, Y] = e.matrix;
            const next = [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * X + c * Y + tx, b * X + d * Y + ty];
            for (const child of children)
                emit(child, next, [...stack, e.symbol], e.owner ?? owner, e.role ?? role);
            return;
        }
        if (result.length >= MAX_ELEMENTS)
            throw new Error('drawing: expanded element limit exceeded');
        const scale = Math.sqrt(Math.abs(a * d - b * c));
        const identity = { owner: owner ?? e.owner, role: role ?? e.role };
        if (e.kind === 'text') {
            const [x, y] = xy(e.x, e.y);
            const item = { ...e, ...identity, x, y, size: (e.size ?? 14) * scale, rotate: (e.rotate ?? 0) + Math.atan2(b, a) * 180 / Math.PI, ...(e.lineHeight === undefined ? {} : { lineHeight: e.lineHeight * scale }) };
            if (![x, y, item.size, item.rotate].every(finite))
                throw new Error('drawing: non-finite transformed text');
            result.push(item);
        }
        else {
            points += e.points.length;
            if (points > MAX_POINTS)
                throw new Error('drawing: expanded point limit exceeded');
            const item = { ...e, ...identity, points: e.points.map(p => xy(...p)), width: (e.width ?? 1.5) * scale };
            if (!finite(item.width) || !item.points.every(p => p.every(finite)))
                throw new Error('drawing: non-finite transformed path');
            result.push(item);
        }
    };
    for (const e of drawing.elements)
        emit(e, [1, 0, 0, 1, 0, 0], []);
    return result;
}
