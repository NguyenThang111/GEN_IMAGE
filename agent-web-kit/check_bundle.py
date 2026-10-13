"""Portable starter checks. This tool deliberately never certifies PASS.

Reference coordinates are source pixels; candidate coordinates are canvas pixels.
Python 3.9+, stdlib for model checks, Pillow for full image decode/inspection.
"""
import argparse
import hashlib
import json
import math
import sys
import unicodedata
from pathlib import Path


COVERAGE = ('all_text', 'all_nets', 'all_symbols', 'clean_image', 'app_render')


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def exact(value):
    if not isinstance(value, str):
        raise ValueError('Text must be a string')
    # Preserve whitespace, accents, case, punctuation, numbers and subscripts.
    return unicodedata.normalize('NFC', value)


def point(value):
    p = (value['x'], value['y']) if isinstance(value, dict) else value
    if not isinstance(p, (list, tuple)) or len(p) != 2 or not all(finite(v) for v in p):
        raise ValueError('Invalid coordinate')
    return tuple(p)


def identifier(value):
    if not isinstance(value, str) or not value or '.' in value:
        raise ValueError('IDs must be nonempty strings without dots in this adapter')
    return value


def terminal_key(value):
    return identifier(value['componentId']) + '.' + identifier(value['terminalId'])


def distance(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0, min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / (dx*dx+dy*dy or 1)))
    return math.dist(p, (a[0]+t*dx, a[1]+t*dy))


def path_distance(p, points):
    return min(distance(p, a, b) for a, b in zip(points, points[1:]))


def sample(points):
    for a, b in zip(points, points[1:]):
        count = max(1, math.ceil(math.dist(a, b) / 3))
        if count > 20000:
            raise ValueError('Route too large for starter')
        for i in range(count):
            yield (a[0]+(b[0]-a[0])*i/count, a[1]+(b[1]-a[1])*i/count)
    yield points[-1]


def flatten(drawing):
    if drawing.get('version') != 1:
        raise ValueError('Adapter requires drawing.version=1')
    symbols = drawing.get('symbols', {})
    if not isinstance(symbols, dict) or not isinstance(drawing.get('elements'), list):
        raise ValueError('Invalid drawing structure')
    items, limitations = [], []

    def walk(e, m=(1, 0, 0, 1, 0, 0), owner=None, role=None, stack=()):
        if not isinstance(e, dict):
            raise ValueError('Invalid drawing element')
        a, b, c, d, tx, ty = m

        def transform(p):
            x, y = point(p)
            return (a*x+c*y+tx, b*x+d*y+ty)

        own = owner if owner is not None else e.get('owner', '')
        use_role = e.get('role', role or '')
        kind = e.get('kind')
        if kind == 'use':
            name = e['symbol']
            if name in stack or len(stack) >= 16 or name not in symbols:
                raise ValueError('Missing or recursive symbol: ' + str(name))
            matrix = e['matrix']
            if not isinstance(matrix, list) or len(matrix) != 6 or not all(finite(v) for v in matrix):
                raise ValueError('Invalid symbol matrix')
            A, B, C, D, X, Y = matrix
            if abs(A*D-B*C) < 1e-8:
                raise ValueError('Singular symbol matrix')
            nxt = (a*A+c*B, b*A+d*B, a*C+c*D, b*C+d*D, a*X+c*Y+tx, b*X+d*Y+ty)
            for child in symbols[name]:
                walk(child, nxt, own, use_role, stack+(name,))
            return
        item = dict(e, owner=own, role=use_role)
        scale = math.sqrt(abs(a*d-b*c))
        if kind == 'path':
            if not isinstance(e.get('points'), list) or len(e['points']) < 2:
                raise ValueError('Path requires at least two points')
            item['points'] = [transform(p) for p in e['points']]
            if not finite(e.get('width', 1.5)) or e.get('width', 1.5) <= 0:
                raise ValueError('Invalid path width')
            item['width'] = e.get('width', 1.5)*scale
        elif kind == 'text':
            item['text'] = exact(e['text'])
            item['x'], item['y'] = transform((e['x'], e['y']))
            if not finite(e.get('size', 14)) or not 0 < e.get('size', 14) <= 300:
                raise ValueError('Invalid text size')
            if not finite(e.get('rotate', 0)):
                raise ValueError('Invalid text rotation')
            if e.get('anchor', 'middle') not in ('start', 'middle', 'end'):
                raise ValueError('Invalid text anchor')
            item['size'] = e.get('size', 14)*scale
            item['rotate'] = e.get('rotate', 0)+math.degrees(math.atan2(b, a))
            if a*d-b*c < 0 or abs(a*c+b*d) > 1e-6 or abs(math.hypot(a,b)-math.hypot(c,d)) > 1e-6:
                limitations.append(('TEXT_TRANSFORM_REVIEW', own))
        else:
            raise ValueError('Unsupported primitive: ' + str(kind))
        items.append(item)

    for e in drawing['elements']:
        walk(e)
    return items, limitations


class Audit:
    def __init__(self):
        self.issues = []
        self.statistics = {}

    def issue(self, code, message, severity='error', **details):
        self.issues.append(dict(code=code, message=message, severity=severity, **details))

    def result(self):
        errors = sum(i['severity'] == 'error' for i in self.issues)
        return dict(version=1, status='FAIL' if errors else 'NEEDS_REVIEW', errors=errors,
                    reviewItems=sum(i['severity'] == 'review' for i in self.issues),
                    statistics=self.statistics, issues=self.issues,
                    scope='Starter only: no raster glyph collision, symbol role/polarity glyph, full visual or browser certification')


def audit_diagram(data, ref):
    audit = Audit()
    try:
        _model(audit, data, ref)
    except (KeyError, TypeError, ValueError, AttributeError, IndexError, OverflowError) as exc:
        audit.issue('INVALID_INPUT', str(exc))
    coverage = ref.get('coverage', {}) if isinstance(ref, dict) else {}
    coverage = coverage if isinstance(coverage, dict) else {}
    for key in COVERAGE:
        if coverage.get(key) is not True:
            audit.issue('COVERAGE_' + key.upper(), 'Reference coverage is incomplete', 'review')
    audit.issue('STARTER_LIMITATIONS', 'Run raster/layout, full symbols and actual web import/export tests separately', 'review')
    return audit


def _model(audit, data, ref):
    canvas = data['canvas']
    width, height = canvas['width'], canvas['height']
    if not all(finite(v) and 0 < v <= 20000 for v in (width, height)):
        raise ValueError('Invalid canvas size')
    if ref['canvas'] != {'width': width, 'height': height}:
        audit.issue('CANVAS_REFERENCE', 'Reference and diagram canvas differ')
    source = ref['source']
    sw, sh = source['width'], source['height']
    crop = source['crop']
    if not isinstance(crop, list) or len(crop) != 4 or not all(finite(v) for v in crop):
        raise ValueError('Invalid source crop')
    x, y, cw, ch = crop
    if not all(finite(v) and v > 0 for v in (sw, sh, cw, ch)) or x < 0 or y < 0 or x+cw > sw or y+ch > sh:
        raise ValueError('Source crop outside original image')
    if source.get('transform', 'crop-scale') != 'crop-scale':
        raise ValueError('Starter supports crop-scale only; supply a tested adapter for deskew')

    def target(p):
        px, py = point(p)
        return ((px-x)*width/cw, (py-y)*height/ch)

    def tolerance(entry, default):
        value = entry.get('tolerance', default)
        if not finite(value) or value < 0:
            raise ValueError('Invalid reference tolerance')
        return value

    components, ports, edges, wires = {}, {}, {}, {}
    if not isinstance(data['components'], list) or not isinstance(data['wires'], list):
        raise ValueError('Components and wires must be lists')
    if not data['components']:
        audit.issue('EMPTY_DIAGRAM', 'Diagram has no components')
    for c in data['components']:
        cid = identifier(c['id'])
        if cid in components:
            audit.issue('DUPLICATE_COMPONENT', 'Duplicate component ID', owner=cid)
        components[cid] = c
        for field in ('x', 'y', 'width', 'height'):
            if field in c and (not finite(c[field]) or (field in ('width', 'height') and c[field] <= 0)):
                raise ValueError('Invalid component geometry: '+cid+'.'+field)
        if not isinstance(c['terminals'], list):
            raise ValueError('Terminals must be a list')
        for t in c['terminals']:
            key = cid+'.'+identifier(t['id'])
            point(t)
            if key in ports:
                audit.issue('DUPLICATE_TERMINAL', 'Duplicate terminal ID', owner=key)
            ports[key] = t
            edges.setdefault(key, set())
    for w in data['wires']:
        wid = identifier(w['id'])
        if wid in wires:
            audit.issue('DUPLICATE_WIRE', 'Duplicate wire ID', owner=wid)
        wires[wid] = w
        if not isinstance(w['points'], list) or len(w['points']) < 2:
            raise ValueError('Wire requires at least two points')
        pts = [point(p) for p in w['points']]
        keys = [terminal_key(w['from']), terminal_key(w['to'])]
        for key, p in zip(keys, (pts[0], pts[-1])):
            if key not in ports:
                audit.issue('MISSING_TERMINAL', 'Wire refers to unknown terminal', owner=wid, actual=key)
            elif math.dist(point(ports[key]), p) > .75:
                audit.issue('ENDPOINT_MISMATCH', 'Wire endpoint differs from terminal', owner=wid, actual=p, expected=point(ports[key]))
        if all(k in ports for k in keys):
            a, b = keys
            edges[a].add(b)
            edges[b].add(a)
    items, limitations = flatten(data['drawing'])
    for code, owner in limitations:
        audit.issue(code, 'Starter cannot certify reflected/sheared/nonuniform text geometry', 'review', owner=owner)

    text_items = [e for e in items if e['kind'] == 'text']
    used, seen_ids = set(), set()
    if not isinstance(ref['texts'], list) or not isinstance(ref['anchors'], list) or not isinstance(ref['nets'], list):
        raise ValueError('Reference texts, anchors and nets must be lists')
    for expected in ref['texts']:
        tid = identifier(expected['id'])
        if tid in seen_ids:
            audit.issue('REFERENCE_DUPLICATE_TEXT_ID', 'Duplicate reference text ID', owner=tid)
        seen_ids.add(tid)
        if expected.get('reviewed') is not True:
            audit.issue('REFERENCE_TEXT_UNREVIEWED', 'Text has not been checked against source', 'review', owner=tid)
        pos = target(expected['xy'])
        # Consume occurrences separately; one rendered label cannot satisfy two source labels.
        options = [(i, e) for i, e in enumerate(text_items) if i not in used
                   and exact(e['text']) == exact(expected['text'])
                   and ('owner' not in expected or expected['owner'] == e['owner'])
                   and math.dist((e['x'], e['y']), pos) <= tolerance(expected, 3)
                   and ('sourceTextId' not in e or e['sourceTextId'] == tid)]
        if not options:
            audit.issue('TEXT_MISSING_OR_CHANGED', 'Exact text occurrence not found at expected position', owner=tid,
                        expected=expected['text'], sourceXY=expected['xy'], canvasXY=pos)
        else:
            i, _ = min(options, key=lambda pair: math.dist((pair[1]['x'], pair[1]['y']), pos))
            used.add(i)
    for i, e in enumerate(text_items):
        if i not in used:
            audit.issue('TEXT_NOT_REFERENCED', 'Rendered text has no independent source entry', 'review', owner=e['owner'], actual=e['text'])

    anchor_ids = set()
    for anchor in ref['anchors']:
        key = anchor['ref']
        if key in anchor_ids:
            audit.issue('REFERENCE_DUPLICATE_ANCHOR', 'Duplicate reference anchor', owner=key)
        anchor_ids.add(key)
        if anchor.get('reviewed') is not True:
            audit.issue('REFERENCE_ANCHOR_UNREVIEWED', 'Anchor has not been checked against source', 'review', owner=key)
        if key not in ports:
            audit.issue('ANCHOR_MISSING', 'Reference terminal missing', owner=key)
        elif math.dist(point(ports[key]), target(anchor['xy'])) > tolerance(anchor, 1):
            audit.issue('ANCHOR_POSITION', 'Terminal moved from source anchor', owner=key, expected=target(anchor['xy']), actual=point(ports[key]))
        if key in ports and anchor.get('label') is not None and exact(ports[key].get('label', '')) != exact(anchor['label']):
            audit.issue('PIN_LABEL_CHANGED', 'Terminal label differs from source', owner=key, expected=anchor['label'], actual=ports[key].get('label'))
    for key in ports.keys()-anchor_ids:
        audit.issue('ANCHOR_NOT_REFERENCED', 'Terminal position not independently checked', 'review', owner=key)

    roots = {}
    for start in edges:
        if start in roots:
            continue
        stack = [start]
        roots[start] = start
        while stack:
            for nxt in edges[stack.pop()]:
                if nxt not in roots:
                    roots[nxt] = start
                    stack.append(nxt)
    groups, root_groups = {}, {}
    for gi, group in enumerate(ref['nets']):
        if not isinstance(group, list) or not group or not all(isinstance(k, str) for k in group):
            raise ValueError('Reference net must be a nonempty list of terminal keys')
        actual_roots = set()
        for key in group:
            if key in groups:
                audit.issue('REFERENCE_DUPLICATE_NET_PORT', 'Reference port belongs to multiple nets', owner=key)
            groups[key] = gi
            if key not in ports:
                audit.issue('NET_PORT_MISSING', 'Reference net terminal missing', owner=key)
            else:
                actual_roots.add(roots[key])
                root_groups.setdefault(roots[key], set()).add(gi)
        if len(actual_roots) > 1:
            audit.issue('NET_DISCONNECTED', 'Terminals joined in source are disconnected in candidate', expected=group)
    for root, grouped in root_groups.items():
        if len(grouped) > 1:
            audit.issue('NET_SHORT', 'Separate reference nets were merged by candidate wires', actual=[k for k, r in roots.items() if r == root])
    for key in ports.keys()-groups.keys():
        audit.issue('NET_NOT_REFERENCED', 'Terminal net has not been independently checked', 'review', owner=key)

    drawing_wires = {}
    for e in items:
        if e['kind'] == 'path' and e['role'] == 'wire':
            drawing_wires.setdefault(e['owner'], []).append(e)
    for wid in drawing_wires.keys()-wires.keys():
        audit.issue('GHOST_WIRE', 'Drawing wire has no data wire', owner=wid)
    for wid, w in wires.items():
        paths = drawing_wires.get(wid, [])
        if not paths:
            audit.issue('WIRE_NOT_DRAWN', 'Data wire has no owned path with role=wire', owner=wid)
            continue
        pts = [point(p) for p in w['points']]
        # Check all owned strokes, including stripes/outline, remain on the data route.
        if any(path_distance(p, pts) > .75 for e in paths for p in sample(e['points'])) or any(
            min(path_distance(p, e['points']) for e in paths) > .75 for p in sample(pts)
        ):
            audit.issue('STALE_WIRE_DRAWING', 'Rendered route differs from wire data', owner=wid)
        for field in ('primaryColor', 'stripeColor'):
            if field in w and not any(e.get('stroke', '').lower() == w[field].lower() for e in paths):
                audit.issue('WIRE_COLOR_MISSING', 'Data wire color/stripe is absent from drawing', owner=wid, expected=w[field], field=field)
    if ref.get('unresolved'):
        audit.issue('UNRESOLVED_SOURCE', 'Source still has unresolved areas', 'review', actual=ref['unresolved'])
    audit.statistics.update(components=len(components), wires=len(wires), terminals=len(ports),
                            renderedTexts=len(text_items), referenceTexts=len(ref['texts']),
                            referenceAnchors=len(ref['anchors']), referenceNets=len(ref['nets']))


def load_json(path):
    def reject(value):
        raise ValueError('Non-finite JSON literal: '+value)

    def pairs(values):
        obj = {}
        for key, value in values:
            if key in obj:
                raise ValueError('Duplicate JSON object key: '+key)
            obj[key] = value
        return obj
    return json.loads(Path(path).read_text(encoding='utf-8-sig'), parse_constant=reject, object_pairs_hook=pairs)


def image_file(audit, path, kind, expected_size=None):
    if not path or not Path(path).is_file():
        audit.issue('IMAGE_MISSING', 'Required image is missing', kind=kind, file=str(path))
        return
    p = Path(path)
    metadata = dict(file=str(p), sha256=hashlib.sha256(p.read_bytes()).hexdigest())
    try:
        from PIL import Image
    except ImportError:
        audit.issue('IMAGE_DECODE_NOT_RUN', 'Install Pillow to verify actual image bytes', 'review', kind=kind)
        audit.statistics.setdefault('images', {})[kind] = metadata
        return
    try:
        with Image.open(p) as im:
            im.verify()
        with Image.open(p) as im:
            im.load()
            size = im.size
            metadata.update(size=list(size), format=im.format)
            if expected_size and size != tuple(expected_size):
                audit.issue('IMAGE_SIZE', 'Image does not match declared coordinate system', kind=kind, expected=expected_size, actual=size)
            extrema = im.convert('RGB').getextrema()
            alpha = im.getchannel('A').getextrema() if 'A' in im.getbands() else None
            if all(lo == hi for lo, hi in extrema) or alpha == (0, 0):
                audit.issue('IMAGE_BLANK', 'Image is uniform or fully transparent', kind=kind)
    except (OSError, ValueError, SyntaxError, Image.DecompressionBombError) as exc:
        audit.issue('IMAGE_INVALID', 'Cannot decode image: '+str(exc), kind=kind, file=str(p))
    audit.statistics.setdefault('images', {})[kind] = metadata


def audit_files(audit, ref, source, clean, web_export):
    src = ref.get('source', {}) if isinstance(ref, dict) else {}
    src = src if isinstance(src, dict) else {}
    expected_hash = src.get('sha256')
    if not isinstance(expected_hash, str) or len(expected_hash) != 64 or any(c not in '0123456789abcdef' for c in expected_hash):
        audit.issue('SOURCE_HASH_INVALID', 'Reference needs the original SHA-256, lowercase hex')
    elif source and Path(source).is_file() and hashlib.sha256(Path(source).read_bytes()).hexdigest() != expected_hash:
        audit.issue('SOURCE_HASH_MISMATCH', 'Original source differs from locked reference')
    source_size = (src['width'], src['height']) if all(k in src for k in ('width', 'height')) else None
    canvas = ref.get('canvas', {}) if isinstance(ref, dict) else {}
    canvas = canvas if isinstance(canvas, dict) else {}
    canvas_size = (canvas['width'], canvas['height']) if all(k in canvas for k in ('width', 'height')) else None
    image_file(audit, source, 'source', source_size)
    image_file(audit, clean, 'clean', canvas_size)
    image_file(audit, web_export, 'web-export', canvas_size)
    audit.issue('IMAGE_CONTENT_REVIEW', 'Valid image files do not prove preserved glyphs/wires or a real web export; compare crops and renderer evidence', 'review')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('diagram', 'reference', 'source', 'clean', 'web-export', 'out'):
        parser.add_argument('--'+name, required=True, type=Path)
    args = parser.parse_args(argv)
    input_paths = [args.diagram, args.reference, args.source, args.clean, args.web_export]
    if args.out.resolve() in [p.resolve() for p in input_paths]:
        parser.error('--out must not overwrite any input file')
    try:
        ref = load_json(args.reference)
        data = load_json(args.diagram)
    except (OSError, ValueError) as exc:
        audit = Audit()
        audit.issue('INVALID_JSON', str(exc))
    else:
        audit = audit_diagram(data, ref)
        audit_files(audit, ref, args.source, args.clean, args.web_export)
    report = audit.result()
    report['artifacts'] = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in input_paths if p.is_file()}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(report['status'], 'errors='+str(report['errors']), 'review='+str(report['reviewItems']), str(args.out))
    return 1 if report['errors'] else 2


if __name__ == '__main__':
    sys.exit(main())
