"""Run: python tools/diagram_check/check.py [--input DIR] [--ocr] [--exports DIR]."""
import argparse
import hashlib
import json
import sys
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

from core import Audit, canonical, color_delta, render, verify_source
from reference import CANDIDATES, OUTPUT, SOURCE, references
from report import write_report

# Hand-selected visible color samples in ORIGINAL source screenshots.
# Used independently of the candidate's colorReference field.
PALETTE_SAMPLES = {'R':('02',310,419),'G':('02',174,470),'Bl':('02',810,494),
 'Br':('02',1225,420),'Lg':('02',1450,419),'Y':('01',326,590),
 'P':('09',571,320),'O':('09',1200,405),'Lb':('09',1200,505),
 'Bu':('09',1200,634),'Gr':('09',610,456)}

def source_palette(refs,folder=SOURCE,locks=None):
    result={'W':'#ffffff'}
    for code,(n,x,y) in PALETTE_SAMPLES.items():
        path=folder/refs[n]['source']
        if not path.exists() or (locks and not verify_source(path,locks.get(refs[n]['source']))):continue
        with Image.open(path) as im:
            rgb=np.median(np.array(im.convert('RGB').crop((x-1,y-1,x+2,y+2))).reshape(-1,3),axis=0).astype(int)
        result[code]='#'+''.join('%02x'%v for v in rgb)
    return result

def pixel_diagnostics(source,candidate,out,number):
    """Difference image is evidence to inspect, not an electrical correctness score."""
    import cv2
    a=np.asarray(source.convert('RGB'));b=np.asarray(candidate.resize(source.size,Image.Resampling.LANCZOS).convert('RGB'))
    def edges(im):
        # Suppress faint background logos, keep dark and saturated source strokes.
        mask=np.min(im,axis=2)<170
        edge=cv2.Canny(im,60,150)>0
        return (edge & cv2.dilate(mask.astype('uint8'),np.ones((3,3),np.uint8)).astype(bool)).astype(np.uint8)
    ea,eb=edges(a),edges(b);kernel=np.ones((5,5),np.uint8)
    missing=ea.astype(bool)&~cv2.dilate(eb,kernel).astype(bool)
    extra=eb.astype(bool)&~cv2.dilate(ea,kernel).astype(bool)
    overlay=np.full_like(a,255);overlay[ea.astype(bool)|eb.astype(bool)]=[190,190,190]
    overlay[missing]=[215,45,65];overlay[extra]=[30,110,220]
    filename=number+'-difference.png';Image.fromarray(overlay).save(out/filename)
    return dict(file=filename,sourceEdgesWithoutNearbyCandidate=int(missing.sum()),
        candidateEdgesWithoutNearbySource=int(extra.sum()),
        interpretation='Đỏ: nét nguồn chưa có nét dựng gần đó; xanh: nét dựng khác nguồn. Sai biệt phông, nền và nét vẽ có thể tạo tín hiệu; không phải điểm đúng điện.')

def ocr_observations(engine,source,audit):
    image=source
    rotated=audit.ref['number']=='10'
    if rotated:image=source.rotate(-90,expand=True)
    result,_=engine(np.asarray(image),use_cls=True)
    observed=[]
    texts=[e for e in audit.items if e['kind']=='text']
    def ocr_key(s):
        s=s.replace('Đ','D').replace('đ','d')
        if re.fullmatch(r'[A-Za-z]{1,3}(?:/[A-Za-z]{1,3})?',s):s=s.replace('BI','Bl')
        s=''.join(c for c in unicodedata.normalize('NFD',s) if not unicodedata.combining(c))
        return re.sub(r'[^a-z0-9/+−-]','',s.casefold())
    for quad,txt,score in result or []:
        if score<.82:continue
        norm=ocr_key(txt)
        if norm.startswith(('vina','minhphong')) or norm in ['mpa','inam']:continue
        if rotated:quad=[[y,source.height-x] for x,y in quad]
        xs,ys=zip(*quad);b=[min(xs),min(ys),max(xs),max(ys)]
        nearby=[e for e in texts if b[0]-35<e['x']<b[2]+35 and b[1]-35<e['y']<b[3]+35]
        seen=bool(norm) and any(norm in ocr_key(e['text']) for e in nearby)
        observed.append(dict(text=txt,confidence=round(float(score),3),box=b,matchedApprox=seen))
        if not seen:audit.issue('OCR_CANDIDATE','OCR đọc “'+txt+'”; cần đối chiếu chữ/hình trong vùng này. OCR có thể đọc sai dấu.',bounds=b,severity='review')
    return observed

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,default=CANDIDATES)
    parser.add_argument('--out',type=Path,default=OUTPUT)
    parser.add_argument('--source',type=Path,default=SOURCE)
    parser.add_argument('--only',choices=list(references()),help='Two-digit circuit number')
    parser.add_argument('--ocr',action='store_true',help='Additional suggestions only; OCR is not ground truth')
    parser.add_argument('--exports',type=Path,help='PNG exported from web, names 01.png .. 10.png; cropped diagram only')
    args=parser.parse_args(argv);args.out.mkdir(parents=True,exist_ok=True)
    refs=references();locks=json.loads(Path(__file__).with_name('source-lock.json').read_text('utf8'))
    palette=source_palette(refs,args.source,locks)
    engine=None
    if args.ocr:
        from rapidocr_onnxruntime import RapidOCR
        engine=RapidOCR(intra_op_num_threads=2,inter_op_num_threads=1)
    data=dict(version=1,createdAt=datetime.now(timezone.utc).isoformat(),circuits=[],
        policy='Fail closed. Expected electrical facts must be transcribed from original PNG; never generate reference facts from a candidate.',
        paletteFromSource=palette,scope='Đối chiếu theo ảnh; không mô phỏng điện; không xác nhận đã sửa website.')
    data['referenceSha256']=hashlib.sha256(Path(__file__).with_name('reference.py').read_bytes()).hexdigest()
    for number,ref in refs.items():
        if args.only and number!=args.only:continue
        files=sorted(args.input.glob(number+'. *.json'))
        if len(files)!=1:
            print(number,'INPUT_COUNT',len(files))
            audit=Audit({},ref);audit.issue('INPUT_COUNT','Cần đúng một JSON cho mạch '+number)
            r=audit.result();r.update(number=number,file=number,canvas=ref['crop'][2:],assets={});data['circuits'].append(r);continue
        path=files[0]
        try:d=json.loads(path.read_text('utf-8-sig'),parse_constant=lambda s:(_ for _ in ()).throw(ValueError('Non-finite JSON '+s)))
        except (ValueError,OSError) as exc:
            audit=Audit({},ref);audit.issue('INVALID_JSON',str(exc));d={}
        else:audit=Audit(d,ref,palette).run()
        assets={};diagnostic={};ocr=[]
        source_path=args.source/ref['source']
        if not verify_source(source_path,locks.get(ref['source'])):
            audit.issue('SOURCE_HASH','Ảnh nguồn thiếu hoặc đã thay đổi; các mốc đối chiếu chưa được xác nhận lại.')
        else:
            x,y,w,h=ref['crop']
            with Image.open(source_path) as src:source=src.convert('RGB').crop((x,y,x+w,y+h))
            assets['source']=number+'-source.png';source.save(args.out/assets['source'])
            if audit.items and not any(i['code']=='INVALID_INPUT' for i in audit.issues):
                candidate=render(d,audit.items);assets['render']=number+'-render.png';candidate.save(args.out/assets['render'])
                diagnostic=pixel_diagnostics(source,candidate,args.out,number)
                if diagnostic['sourceEdgesWithoutNearbyCandidate']>50:
                    audit.issue('IMAGE_DIFFERENCE','Có nét nguồn chưa khớp bản dựng. Xem ảnh sai biệt; nền/phông chữ có thể gây khác biệt.',severity='review',difference=diagnostic['file'])
                if engine:ocr=ocr_observations(engine,source,audit)
                if args.exports:
                    exp=args.exports/(number+'.png')
                    if exp.exists():
                        with Image.open(exp) as im:app=im.convert('RGB')
                        if app.size not in [(w,h),(w*2,h*2)]:audit.issue('APP_REGISTRATION','Ảnh app phải được cắt đúng canvas; kích thước hiện tại '+str(app.size))
                        else:
                            assets['export']=number+'-app.png';app.save(args.out/assets['export'])
                            audit.issue('APP_EXPORT_REVIEW','Đã nạp ảnh app để đối chiếu; cần kiểm tra dấu cực, số chân và dây trên ảnh này.',severity='review')
                            diagnostic['app']=pixel_diagnostics(source,app,args.out,number+'-app')
                    else:audit.issue('APP_EXPORT_MISSING','Chưa có ảnh app '+number+'.png',severity='review')
        r=audit.result();r.update(number=number,file=path.name,canvas=ref['crop'][2:],assets=assets,
            candidateSha256=hashlib.sha256(path.read_bytes()).hexdigest(),sourceSha256=locks.get(ref['source']),
            reference=ref,imageDifference=diagnostic,ocrObservations=ocr)
        data['circuits'].append(r);print(number,r['status'],r['errors'],'errors,',r['reviewItems'],'review',flush=True)
    data['summary']=dict(circuits=len(data['circuits']),errors=sum(r['errors'] for r in data['circuits']),
        reviewItems=sum(r['reviewItems'] for r in data['circuits']),passCount=0)
    write_report(data,args.out)
    print('Report:',args.out/'index.html')
    return 1 if data['summary']['errors'] else 2 # 2 is incomplete; never silently certify partial evidence.

if __name__=='__main__':sys.exit(main())
