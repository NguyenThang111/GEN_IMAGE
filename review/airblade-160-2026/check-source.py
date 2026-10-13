"""Check the hand-read reference without importing any diagram generator."""
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'File JSON chuẩn'/'AIR BLADE 160 2026'
reference=json.loads(Path(__file__).with_name('source-reference.json').read_text('utf-8'))
checks=[]
errors=[]
for name,expected in reference['circuits'].items():
    d=json.loads((OUT/name).read_text('utf-8'))
    components={c['id']:c for c in d['components']}
    for cid,labels in expected.get('pins',{}).items():
        actual={t.get('label') for t in components[cid]['terminals']}
        for label in labels:
            if label not in actual:errors.append(name+': missing source pin '+cid+' / '+label)
    for cid,rating in expected.get('fuses',{}).items():
        if components[cid].get('ratingAmps')!=rating:errors.append(name+': fuse rating '+cid)
    adjacency={cid+'.'+t['id']:set() for cid,c in components.items() for t in c['terminals']}
    for w in d['wires']:
        a=w['from']['componentId']+'.'+w['from']['terminalId'];b=w['to']['componentId']+'.'+w['to']['terminalId']
        adjacency[a].add(b);adjacency[b].add(a)
    for a,b in expected.get('connections',[]):
        seen={a};todo=[a]
        while todo:
            current=todo.pop()
            for neighbor in adjacency[current]-seen:seen.add(neighbor);todo.append(neighbor)
        if b not in seen:errors.append(name+': source network disconnected '+a+' / '+b)
    source=ROOT/'FILE ANH'/'AIR BLADE 160 2026'/d['sourceImage']
    if hashlib.sha256(source.read_bytes()).hexdigest()!=d['reviewMetadata']['sourceSha256']:errors.append(name+': source hash changed')
    checks.append(dict(file=name,pinLabels=sum(len(v) for v in expected.get('pins',{}).values()),fuseRatings=len(expected.get('fuses',{})),networks=len(expected.get('connections',[]))))
report=dict(status='PASS_SELECTED_SOURCE_CHECKS' if not errors else 'FAIL',coverage=reference['coverage'],errors=errors,checks=checks)
(OUT/'source-reference-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(status=report['status'],diagrams=len(checks),pinLabels=sum(c['pinLabels'] for c in checks),fuseRatings=sum(c['fuseRatings'] for c in checks),networks=sum(c['networks'] for c in checks),errors=errors),ensure_ascii=True))
if errors:raise SystemExit(1)
