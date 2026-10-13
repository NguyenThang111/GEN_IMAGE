"""Apply only independently verified corrections to NEW review copies.

Not a re-generator from legacy JSON. Untested candidate content is preserved and
continues to fail/require review. No original, app DB or earlier deliverable is overwritten.
"""
import copy
import json
from pathlib import Path

from reference import CANDIDATES, ROOT, references
from core import Audit, render
from symbols import battery, relay

DEST=ROOT/'Bản sửa đã đối chiếu'/'01.AirBlade-2011-2012'

def repair(d,ref):
    d=copy.deepcopy(d);changes=[];x0,y0=ref['crop'][:2]
    expected={a['ref']:(a['xy'][0]-x0,a['xy'][1]-y0) for a in ref['anchors']}
    # Only battery and relay anchor facts have been selected for this correction.
    selected={c['id'] for c in d['components'] if c['type'] in ('battery','relay')}
    for c in d['components']:
        if c['id'] not in selected:continue
        for t in c['terminals']:
            k=c['id']+'.'+t['id']
            if k in expected:
                p=expected[k]
                if (t['x'],t['y'])!=p:changes.append('Đưa đầu chân '+k+' về tọa độ đọc từ ảnh nguồn.')
                t['x'],t['y']=p
    # Adjust actual wire endpoints and their corresponding drawing endpoints;
    # stripe endpoints are clipped to the newly observed wire extent as needed.
    for w in d['wires']:
        for end,index in [('from',0),('to',-1)]:
            k=w[end]['componentId']+'.'+w[end]['terminalId']
            if w[end]['componentId'] not in selected or k not in expected:continue
            old=[w['points'][index]['x'],w['points'][index]['y']];new=list(expected[k])
            if old==new:continue
            w['points'][index]=dict(x=new[0],y=new[1])
            for e in d['drawing']['elements']:
                if e.get('kind')!='path' or e.get('role')!='wire' or e.get('owner')!=w['id']:continue
                for j,p in enumerate(e['points']):
                    if p==old:e['points'][j]=list(new)
    library={}
    for c in d['components']:
        if c['id'] not in selected:continue
        owned={t['id']:expected[c['id']+'.'+t['id']] for t in c['terminals'] if c['id']+'.'+t['id'] in expected}
        if c['type']=='battery':
            neg=ref['battery']['negative'].split('.')[1];pos=ref['battery']['positive'].split('.')[1]
            shapes,matrix,pins=battery(owned[neg],owned[pos])
            # Same convention for consumers using terminal arrays, while names
            # and explicit labels remain the authoritative polarity contract.
            c['terminals'].sort(key=lambda t:0 if t['id']==neg else 1)
            for t in c['terminals']:t['label']='−' if t['id']==neg else '+'
            c['polarity']={'negativeTerminalId':neg,'positiveTerminalId':pos}
        else:
            if len(owned)!=4:continue
            contact=[p for k,p in owned.items() if 'contact' in k]
            vertical=abs(contact[0][1]-contact[1][1])>abs(contact[0][0]-contact[1][0])
            shapes,matrix,pins=relay(owned,vertical,'starter' in c['id'])
        symbol='verified-'+c['id'];d['drawing']['symbols'][symbol]=shapes
        library[symbol]=dict(primitives=shapes,ports=pins,source=ref['source'],geometryOnly=True)
        replaced=False
        for i,e in enumerate(d['drawing']['elements']):
            if e.get('kind')=='use' and e.get('owner')==c['id']:
                d['drawing']['elements'][i]=dict(kind='use',symbol=symbol,matrix=matrix,owner=c['id'],role='symbol');replaced=True
        if not replaced:raise ValueError('No symbol instance for '+c['id'])
        c['symbol']=symbol
        changes.append('Vẽ lại '+c['id']+' bằng mẫu có chân định danh, khớp mốc nguồn.')
    if ref['number']=='10':
        elements=d['drawing']['elements']
        # Pin labels have bounded white strips. Smaller lettering maintains
        # clearance without moving any electrical anchor or erasing a label.
        for e in elements:
            if e.get('kind')!='text':continue
            if e.get('owner')=='ecm' and e.get('text') in ['S/RELAY','FI WARN','TW WARN']:
                e['size']=10;e['y']=441
            if e.get('owner')=='ecm' and e.get('text')=='SSTAND':e['y']=505
            if e.get('text')=='Ghi chú':e['x']=1351;e['y']=715
            if e.get('text')=='DTC / MÃ MIL':e['y']=642
            if e.get('text')=='ĐỘNG CƠ KHÔNG KHỞI ĐỘNG NẾU CÓ HƯ HỎNG':e['y']=529;e['size']=12
            if e.get('text')=='CẮM ĐẦU CỰC NÀY ĐỂ ĐỌC DTC / MÃ MIL':
                e['text']='CÁC ĐẦU CỰC NGẮN ĐỂ ĐỌC DTC / MÃ MIL';e['x']=1440;e['y']=550;e['size']=11.5
            if e.get('text')=='(12)':e['x']=721;e['y']=201;e['size']=11
        for e in elements:
            if e.get('kind')=='path' and not e.get('owner'):
                xs=[p[0] for p in e['points']];ys=[p[1] for p in e['points']]
                if min(xs)>=710 and max(xs)<=729 and min(ys)>=207 and max(ys)<=227:
                    for p in e['points']:p[1]+=13
        for text,x,y in [('( ) :',1374,708),(':',1407,693),(':',1440,690)]:
            elements.append(dict(kind='text',text=text,x=x,y=y,size=12,rotate=-90,bold=True,anchor='middle',owner='annotation',role='annotation',fill='#343434'))
        # The title is intentionally in a GAP in the frame in the source.
        # Replace that frame only, leaving every annotation symbol intact.
        for i,e in enumerate(elements):
            if e.get('kind')=='path' and e.get('closed') and len(e.get('points',[]))==4:
                pts=e['points'];xs=[p[0] for p in pts];ys=[p[1] for p in pts]
                if min(xs)>1300 and max(xs)>1440 and min(ys)<450 and max(ys)>740:
                    e['closed']=False;e['fill']='none'
                    e['points']=[[min(xs),679],[min(xs),min(ys)],[max(xs),min(ys)],[max(xs),max(ys)],[min(xs),max(ys)],[min(xs),751]]
        changes.append('Chỉnh 4 nhãn chân ECM và khung ghi chú để không cắt nét chữ; chép lại nguyên văn dòng đọc mã lỗi theo ảnh.')
    d['reviewStatus']='draft'
    d.setdefault('reviewMetadata',{}).update(targetAppVerified=False,independentReview='partial',
        corrections=changes,referenceSource='tools/diagram_check/reference.py')
    return d,library

def main():
    DEST.mkdir(parents=True,exist_ok=True);libs={};log={}
    for n,ref in references().items():
        p=next(CANDIDATES.glob(n+'. *.json'));original=json.loads(p.read_text('utf8'));d,lib=repair(original,ref)
        for k in ['schemaVersion','id','vehicleId','vehicleTitle']:
            if d[k]!=original[k]:raise ValueError('Identity changed '+k)
        (DEST/p.name).write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf8')
        audit=Audit(d,ref).run();preview=render(d,audit.items)
        (DEST/'preview').mkdir(exist_ok=True);preview.save(DEST/'preview'/(p.stem+'.png'))
        libs[n]=lib;log[n]=d['reviewMetadata']['corrections'];print(n,len(audit.issues),'findings')
    (DEST/'verified-symbols.json').write_text(json.dumps(libs,ensure_ascii=False,indent=2),encoding='utf8')
    (DEST/'corrections.json').write_text(json.dumps(log,ensure_ascii=False,indent=2),encoding='utf8')
    print(DEST)

if __name__=='__main__':main()
