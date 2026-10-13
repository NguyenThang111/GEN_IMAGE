"""Reject unsupported component types against an explicitly supplied consumer profile.

Usage: python tools/check_component_types.py --profile profile.json --input folder
Profile must contain supportedTypes; never derive it from the candidate files.
"""
import argparse,json,sys,hashlib
from pathlib import Path

def check(diagram,supported):
    errors=[]
    for index,c in enumerate(diagram.get('components',[])):
        if c.get('type') not in supported:
            errors.append(f"components[{index}] id={c.get('id')} type={c.get('type')}: unsupported type")
    return errors

def main():
    p=argparse.ArgumentParser();p.add_argument('--profile',required=True,type=Path);p.add_argument('--input',required=True,type=Path);p.add_argument('--out',type=Path);a=p.parse_args()
    profile=json.loads(a.profile.read_text('utf8'));supported=profile.get('supportedTypes')
    if not isinstance(supported,list) or not supported or not all(isinstance(x,str) for x in supported):
        p.error('Profile must contain a nonempty supportedTypes list from the intended consumer')
    files=sorted(a.input.glob('*.schema.json')) if a.input.is_dir() else [a.input]
    if not files:p.error('No schema files found')
    results=[]
    for f in files:
        errors=check(json.loads(f.read_text('utf8')),supported)
        results.append(dict(file=str(f),sha256=hashlib.sha256(f.read_bytes()).hexdigest(),errors=errors))
        print(f.name+(': PASS' if not errors else ': FAIL\n'+'\n'.join(errors)))
    result=dict(profilePath=str(a.profile),profileSha256=hashlib.sha256(a.profile.read_bytes()).hexdigest(),scope='Component types only; does not prove graph, render, field retention or electrical source approval',files=results)
    if a.out:a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    return int(any(r['errors'] for r in results))
if __name__=='__main__':sys.exit(main())
