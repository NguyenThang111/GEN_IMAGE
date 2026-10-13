"""Independent, read-only schematic checks. No imports from the old generator/audit.

The expected facts come exclusively from reference.py + locked source PNGs.
The vector interpreter below is only an observation of the candidate, not truth.
"""
import copy
import hashlib
import itertools
import math
import re
import unicodedata
from collections import defaultdict, deque
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageColor

SCALE = 2

def finite(x):
    return isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x)

def xy(p):
    return (p['x'],p['y'])

def key(p):
    return p['componentId']+'.'+p['terminalId']

def box(points, pad=0):
    xs,ys=zip(*points)
    return [min(xs)-pad,min(ys)-pad,max(xs)+pad,max(ys)+pad]

def overlap(a,b):
    return a[0]<b[2] and a[2]>b[0] and a[1]<b[3] and a[3]>b[1]

def canonical(s):
    # Preserve accents, punctuation, numbers and letter case. Whitespace is typography.
    return re.sub(r'\s+','',unicodedata.normalize('NFC',str(s)))

def segment_distance(p,a,b):
    vx,vy=b[0]-a[0],b[1]-a[1]
    t=max(0,min(1,((p[0]-a[0])*vx+(p[1]-a[1])*vy)/(vx*vx+vy*vy or 1)))
    return math.dist(p,(a[0]+t*vx,a[1]+t*vy))

def sample_path(points, step=3):
    out=[]
    for a,b in zip(points,points[1:]):
        n=max(1,math.ceil(math.dist(a,b)/step))
        out.extend([(a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n) for i in range(n)])
    return out+[points[-1]]

def path_distance(p,points):
    return min(segment_distance(p,a,b) for a,b in zip(points,points[1:]))

def color(s):
    return ImageColor.getrgb(s)[:3]

def color_delta(a,b):
    return math.dist(color(a),color(b))

@lru_cache(maxsize=256)
def font(size,bold):
    name='arialbd.ttf' if bold else 'arial.ttf'
    path=Path('C:/Windows/Fonts')/name
    if not path.exists():
        path=Path('/usr/share/fonts/truetype/dejavu')/('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')
    return ImageFont.truetype(str(path),size)

def flatten(d):
    """Reject unknown primitives/cycles; never quietly drop them from the audit."""
    result=[]
    symbols=d['drawing'].get('symbols',{})
    def walk(e,m=(1,0,0,1,0,0),owner=None,role=None,stack=()):
        a,b,c,f,tx,ty=m
        def transform(p):return (a*p[0]+c*p[1]+tx,b*p[0]+f*p[1]+ty)
        if e['kind']=='use':
            name=e['symbol']
            if name in stack or len(stack)>20:raise ValueError('Symbol recursion: '+name)
            A,B,C,D,X,Y=e['matrix']
            if not all(finite(v) for v in [A,B,C,D,X,Y]) or abs(A*D-B*C)<1e-8:
                raise ValueError('Invalid symbol matrix')
            nm=(a*A+c*B,b*A+f*B,a*C+c*D,b*C+f*D,a*X+c*Y+tx,b*X+f*Y+ty)
            for child in symbols[name]:walk(child,nm,e.get('owner',owner),e.get('role',role),stack+(name,))
            return
        r=copy.deepcopy(e)
        r['owner']=owner if owner is not None else e.get('owner','')
        r['role']=e.get('role',role or '')
        scale=math.sqrt(abs(a*f-b*c))
        if e['kind']=='text':
            if not isinstance(e['text'],str):raise ValueError('Text must be a string')
            if not all(finite(e.get(k,default)) for k,default in [('x',None),('y',None),('size',14),('rotate',0)]):raise ValueError('Invalid text geometry')
            r['x'],r['y']=transform((e['x'],e['y']))
            r['size']=e.get('size',14)*scale
            if not 0<r['size']<=300:raise ValueError('Unsafe text size')
            if e.get('anchor','middle') not in ('start','middle','end'):raise ValueError('Unknown text anchor')
            r['rotate']=e.get('rotate',0)+math.degrees(math.atan2(b,a))
        elif e['kind']=='path':
            pts=e['points']
            if len(pts)<2 or any(len(p)!=2 or not all(finite(v) for v in p) for p in pts):raise ValueError('Invalid path points')
            r['points']=[transform(p) for p in pts]
            r['width']=e.get('width',1.5)*scale
            if not finite(r['width']) or not 0<=r['width']<=300:raise ValueError('Invalid stroke width')
        else:raise ValueError('Unsupported primitive: '+str(e.get('kind')))
        for k in ('stroke','fill'):
            if r.get(k,'none')!='none':color(r[k])
        if len(result)>100000:raise ValueError('Too many drawing elements')
        r['_index']=len(result);result.append(r)
    if d['drawing'].get('version')!=1:raise ValueError('Unsupported drawing version')
    for e in d['drawing']['elements']:walk(e)
    return result

def text_mask(e):
    """Actual glyph pixels at 2x, including accents and arbitrary rotations."""
    f=font(max(1,round(e.get('size',14)*SCALE)),e.get('bold',True))
    anchor={'start':'ls','middle':'ms','end':'rs'}[e.get('anchor','middle')]
    extent=math.ceil(f.getlength(e['text'])+f.size*3+10)
    if extent>16000:raise ValueError('Text too long')
    im=Image.new('L',(extent*2,extent*2))
    ImageDraw.Draw(im).text((extent,extent),e['text'],font=f,anchor=anchor,fill=255)
    im=im.rotate(-e.get('rotate',0),resample=Image.Resampling.BICUBIC)
    bounds=im.getbbox()
    if not bounds:return Image.new('L',(1,1)),(round(e['x']*SCALE),round(e['y']*SCALE))
    return im.crop(bounds),(round(e['x']*SCALE-extent+bounds[0]),round(e['y']*SCALE-extent+bounds[1]))

def paint_path(im,e,offset=(0,0),stroke_only=False,mask=False):
    draw=ImageDraw.Draw(im)
    pts=[(p[0]*SCALE-offset[0],p[1]*SCALE-offset[1]) for p in e['points']]
    fill=e.get('fill','none');stroke=e.get('stroke','#555555')
    if not stroke_only and e.get('closed') and fill!='none':draw.polygon(pts,fill=255 if mask else fill)
    if stroke!='none' and e.get('width',1.5)>0:
        if e.get('closed'):pts=pts+[pts[0]]
        draw.line(pts,fill=255 if mask else stroke,width=max(1,round(e.get('width',1.5)*SCALE)),joint='curve')

def render(d,items):
    im=Image.new('RGB',(round(d['canvas']['width']*SCALE),round(d['canvas']['height']*SCALE)),'white')
    for e in items:
        if e['kind']=='path':paint_path(im,e)
        else:
            mask,origin=text_mask(e)
            im.paste(e.get('fill','#343434'),origin,mask)
    return im

class Audit:
    def __init__(self,d,ref,palette=None):
        self.d=d;self.ref=copy.deepcopy(ref);self.issues=[];self.ports={};self.adj=defaultdict(list);self.items=[]
        self.stats={};self.palette=palette or {}
    def issue(self,code,message,owner='',bounds=None,severity='error',**extra):
        item=dict(code=code,severity=severity,message=message,owner=owner)
        if bounds:item['box']=[round(v,2) for v in bounds]
        item.update(extra);self.issues.append(item)
    def source_xy(self,p):return (p[0]-self.ref['crop'][0],p[1]-self.ref['crop'][1])
    def schema(self):
        d=self.d
        if not isinstance(d,dict):raise ValueError('Root must be an object')
        cv=d['canvas']
        if not all(finite(cv[k]) and 0<cv[k]<=8000 for k in ['width','height']):raise ValueError('Invalid canvas')
        crop=d.get('sourceCrop',{})
        if [crop.get(k) for k in ['x','y','width','height']]!=self.ref['crop']:
            self.issue('SOURCE_REGISTRATION','Khung cắt không trùng mốc ảnh đã đối chiếu; chưa thể dùng tọa độ này.')
        if [cv['width'],cv['height']]!=self.ref['crop'][2:]:self.issue('CANVAS_SIZE','Canvas khác vùng sơ đồ nguồn.')
        if d.get('sourceImage')!=self.ref['source']:self.issue('SOURCE_BINDING','JSON đang chỉ sang ảnh khác.')
        seen=set()
        for c in d['components']:
            if not isinstance(c['id'],str) or not c['id']:raise ValueError('Invalid component ID')
            if c['id'] in seen:self.issue('DUPLICATE_COMPONENT','Trùng ID linh kiện.',c['id'])
            seen.add(c['id'])
            for t in c['terminals']:
                if not isinstance(t['id'],str) or not t['id']:raise ValueError('Invalid terminal ID')
                k=c['id']+'.'+t['id']
                if k in self.ports:self.issue('DUPLICATE_TERMINAL','Trùng ID chân.',k)
                if not all(finite(t.get(v)) for v in ['x','y']):raise ValueError('Invalid terminal coordinates '+k)
                self.ports[k]=t
        seen=set()
        for w in d['wires']:
            wid=w['id']
            if not isinstance(wid,str) or not wid:raise ValueError('Invalid wire ID')
            if wid in seen:self.issue('DUPLICATE_WIRE','Trùng ID dây.',wid)
            seen.add(wid)
            pts=w['points']
            if len(pts)<2 or any(not all(finite(p.get(k)) for k in ['x','y']) for p in pts):raise ValueError('Invalid wire path '+wid)
            ends=[key(w['from']),key(w['to'])]
            for k,p in zip(ends,[pts[0],pts[-1]]):
                if k not in self.ports:self.issue('UNKNOWN_TERMINAL','Dây tham chiếu chân không tồn tại: '+k,wid)
                elif math.dist(xy(self.ports[k]),xy(p))>.1:
                    self.issue('WIRE_ENDPOINT','Đầu nét dây khác tọa độ chân '+k,wid,box([xy(p),xy(self.ports[k])],8))
            if all(k in self.ports for k in ends):
                self.adj[ends[0]].append((ends[1],w));self.adj[ends[1]].append((ends[0],w))
        self.items=flatten(d)
        self.stats.update(components=len(d['components']),wires=len(d['wires']),primitives=len(self.items))
    def route(self,start,end):
        q=deque([(start,[])]);seen={start}
        while q:
            k,path=q.popleft()
            if k==end:return path
            for nxt,w in self.adj[k]:
                if nxt not in seen:seen.add(nxt);q.append((nxt,path+[w]))
        return None
    def electrical(self):
        for a in self.ref['anchors']:
            k=a['ref'];expected=self.source_xy(a['xy']);actual=self.ports.get(k)
            if actual is None:self.issue('REFERENCE_PORT_MISSING','Thiếu chân có trên ảnh gốc.',k,box([expected],12));continue
            if math.dist(expected,xy(actual))>2:
                self.issue('REFERENCE_PORT_POSITION','Vị trí chân sai so với ảnh gốc.',k,box([expected,xy(actual)],12),expected=expected,actual=xy(actual))
            if a.get('label') and canonical(actual.get('label',''))!=canonical(a['label']):
                self.issue('REFERENCE_PIN_LABEL','Ký hiệu chân phải là '+a['label'],k,box([expected],15),actual=actual.get('label'))
        groups=self.ref['nets'];membership={p:i for i,g in enumerate(groups) for p in g}
        if self.ref['coverage']['all_nets']:
            for c in self.d['components']:
                if c.get('type')=='junction':continue
                for t in c['terminals']:
                    k=c['id']+'.'+t['id']
                    if k not in membership:
                        self.issue('REFERENCE_NET_COVERAGE','Chân chưa có mạng đối chiếu độc lập: '+k,k,severity='review')
                        self.ref['coverage']['all_nets']=False
        for group in groups:
            for other in group[1:]:
                if self.route(group[0],other) is None:self.issue('NET_MISSING','Thiếu liên kết theo ảnh: '+group[0]+' ↔ '+other,other)
        # Detect incorrect unions; components are never treated as internal wires.
        reported=set()
        for a,b in itertools.combinations(membership,2):
            if membership[a]!=membership[b] and self.route(a,b) is not None:
                pair=tuple(sorted((membership[a],membership[b])))
                if pair not in reported:self.issue('NET_SHORT','Hai mạng riêng trên ảnh bị nối chung: '+a+' ↔ '+b,a);reported.add(pair)
        batt=self.ref['battery'];pos,neg=batt['positive'],batt['negative']
        if self.route(pos,neg) is not None:self.issue('BATTERY_SHORT','Hai cực ắc quy nối chung bằng dây.', 'battery')
        for k,expected in [(pos,'R'),(neg,'G')]:
            incident=self.adj[k]
            if not incident:self.issue('BATTERY_DISCONNECTED','Cực ắc quy không nối dây: '+k,k)
            for _,w in incident:
                if w.get('code')!=expected:self.issue('BATTERY_POLARITY','Theo ảnh, '+k+' phải nối dây '+expected,w['id'],box([xy(self.ports[k])],18))
        for a,b,code in self.ref['edges']:
            route=self.route(a,b)
            if route is not None and any(w.get('code')!=code for w in route):
                self.issue('REFERENCE_WIRE_CODE','Theo ảnh, '+a+' ↔ '+b+' phải là '+code,a,actual=[w.get('code') for w in route])
        for w in self.d['wires']:
            for code,field in zip(w.get('code','').split('/'),['primaryColor','stripeColor']):
                if code in self.palette and (not w.get(field) or color_delta(w[field],self.palette[code])>12):
                    self.issue('SOURCE_WIRE_COLOR','Màu '+field+' không khớp mẫu '+code+' trên ảnh nguồn.',w['id'],expected=self.palette[code],actual=w.get(field))
        self.stats.update(referenceAnchors=len(self.ref['anchors']),referenceNets=len(groups),referenceWireCodes=len(self.ref['edges']))
    def graphics(self):
        owned=defaultdict(list)
        for e in self.items:owned[e['owner']].append(e)
        wires={w['id']:w for w in self.d['wires']}
        for wid,w in wires.items():
            paths=[e for e in owned[wid] if e['kind']=='path' and e.get('role')=='wire']
            pts=[xy(p) for p in w['points']]
            if not paths:self.issue('WIRE_NOT_DRAWN','Dữ liệu có dây nhưng hình không vẽ.',wid,box(pts,5));continue
            # A white wire often has a wider dark outline for visibility. That
            # outline is not the primary conductor color. Select a full route
            # with the stated color; short stripe segments cannot qualify.
            full=[e for e in paths if math.dist(e['points'][0],pts[0])<.6 and math.dist(e['points'][-1],pts[-1])<.6]
            primary=[e for e in full if color_delta(e.get('stroke','#555555'),w['primaryColor'])<3]
            base=max(primary or full or paths,key=lambda e:e.get('width',1.5))
            # Symmetric distance catches an added detour as well as a missing segment.
            err=max(max(path_distance(p,base['points']) for p in sample_path(pts,5)),
                    max(path_distance(p,pts) for p in sample_path(base['points'],5)))
            if err>.6:self.issue('STALE_WIRE_DRAWING','Nét vẽ không đồng bộ đường đi trong dữ liệu.',wid,box(pts,5),distance=round(err,2))
            if color_delta(base.get('stroke','#555555'),w['primaryColor'])>3:
                self.issue('WIRE_PRIMARY_COLOR','Màu dây vẽ khác màu dữ liệu.',wid,box(pts,5))
            stripe=w.get('stripeColor')
            if stripe:
                stripes=[e for e in paths if e is not base and color_delta(e.get('stroke','#555555'),stripe)<3]
                if not stripes:self.issue('WIRE_STRIPE_MISSING','Thiếu hoặc sai màu sọc dây.',wid,box(pts,5))
                elif any(max(path_distance(p,pts) for p in e['points'])>.7 for e in stripes):
                    self.issue('WIRE_STRIPE_ROUTE','Sọc dây lệch đường đi dữ liệu.',wid,box(pts,5))
        for owner,items in owned.items():
            if owner not in wires and any(e.get('role')=='wire' for e in items):
                self.issue('GHOST_WIRE','Hình còn dây không tồn tại trong dữ liệu.',owner)
        for c in self.d['components']:
            if c.get('type')!='relay':continue
            shapes=[e for e in owned[c['id']] if e['kind']=='path']
            # Observe boundary-reaching lead strokes; border rectangles are not leads.
            frames=[e for e in shapes if e.get('closed') and len(e['points'])==4]
            if not frames:self.issue('RELAY_UNVERIFIED','Không nhận diện được khung/đầu chân relay.',c['id'],severity='review');continue
            frame=max(frames,key=lambda e:abs((box(e['points'])[2]-box(e['points'])[0])*(box(e['points'])[3]-box(e['points'])[1])))
            bounds=box(frame['points']);border=frame['points']+[frame['points'][0]]
            leads=[]
            for e in shapes:
                if e.get('closed') or len(e['points'])!=2:continue
                for p in e['points']:
                    if path_distance(p,border)<.3:leads.append(p)
            for t in c['terminals']:
                dist=min((math.dist(xy(t),p) for p in leads),default=999)
                if dist>1.25:self.issue('RELAY_DRAWN_PIN','Chân relay trên hình lệch đầu dây %.2f px.'%dist,c['id']+'.'+t['id'],box([xy(t)],18),distance=round(dist,3))
            coils=[e for e in shapes if not e.get('closed') and len(e['points'])>30]
            contacts=[e for e in shapes if e.get('closed') and len(e['points'])>12]
            if len(coils)!=1 or len(contacts)!=2:
                self.issue('RELAY_GEOMETRY_UNVERIFIED','Chưa nhận diện được một cuộn dây và hai tiếp điểm.',c['id'],bounds,severity='review')
            else:
                coil_points=coils[0]['points']
                centers=[tuple((lo+hi)/2 for lo,hi in zip(box(e['points'])[:2],box(e['points'])[2:])) for e in contacts]
                for t in c['terminals']:
                    p=xy(t);dc=path_distance(p,coil_points);dt=min(math.dist(p,q) for q in centers)
                    if ('coil' in t['id'] and dc>dt) or ('contact' in t['id'] and dt>dc):
                        self.issue('RELAY_GLYPH_ROLE','Hình cuộn dây/tiếp điểm không khớp chức năng chân.',c['id']+'.'+t['id'],box([p],22))
        # Polarity is inferred from actual line strokes, never array order or ID alone.
        paths=[e for e in owned['battery'] if e['kind']=='path' and not e.get('closed') and len(e['points'])==2 and 4<math.dist(*e['points'])<30]
        crosses=[];used=set()
        for i,a in enumerate(paths):
            for j,b in enumerate(paths[:i]):
                ca=tuple((v+w)/2 for v,w in zip(*a['points']));cb=tuple((v+w)/2 for v,w in zip(*b['points']))
                va=np.subtract(a['points'][1],a['points'][0]);vb=np.subtract(b['points'][1],b['points'][0])
                if math.dist(ca,cb)<1 and abs(float(va@vb))/(np.linalg.norm(va)*np.linalg.norm(vb))<.15:
                    crosses.append(ca);used.update([i,j])
        negative=[tuple((v+w)/2 for v,w in zip(*a['points'])) for i,a in enumerate(paths) if i not in used]
        for polarity,marks in [('positive',crosses),('negative',negative)]:
            target=self.ports.get(self.ref['battery'][polarity]);other=self.ports.get(self.ref['battery']['negative' if polarity=='positive' else 'positive'])
            if target and other:
                matched=[p for p in marks if math.dist(p,xy(target))<35 and math.dist(p,xy(target))+4<math.dist(p,xy(other))]
                if not matched:self.issue('BATTERY_GLYPH_POLARITY','Dấu '+('+' if polarity=='positive' else '−')+' không nằm ở đúng cực trên hình.', 'battery',box([xy(target)],35))
    def text_checks(self):
        texts=[e for e in self.items if e['kind']=='text']
        masks=[]
        for e in texts:
            mask,origin=text_mask(e)
            bounds=[origin[0]/SCALE,origin[1]/SCALE,(origin[0]+mask.width)/SCALE,(origin[1]+mask.height)/SCALE]
            masks.append((e,mask,origin,bounds))
            w,h=self.d['canvas']['width'],self.d['canvas']['height']
            if bounds[0]<0 or bounds[1]<0 or bounds[2]>w or bounds[3]>h:self.issue('TEXT_CLIPPED','Chữ vượt mép ảnh: '+e['text'],e['owner'],bounds)
        for expected,roi in self.ref['texts']:
            p0=self.source_xy(roi[:2]);p1=self.source_xy(roi[2:]);bounds=[*p0,*p1]
            nearby=[e for e,_,_,b in masks if overlap(b,bounds)]
            matched=any(canonical(e['text'])==canonical(expected) for e in nearby)
            if expected=='O₂' and not matched:
                # A subscript may be two SVG texts. Verify the small glyph's
                # relative baseline, not merely that O and 2 occur somewhere.
                for letter in nearby:
                    if letter['text']!='O':continue
                    for sub in nearby:
                        if sub['text']!='2' or sub['size']>=letter['size']*.9:continue
                        angle=math.radians(letter.get('rotate',0))
                        dx,dy=sub['x']-letter['x'],sub['y']-letter['y']
                        along=dx*math.cos(angle)+dy*math.sin(angle)
                        down=-dx*math.sin(angle)+dy*math.cos(angle)
                        if 0<along<letter['size'] and 0<down<letter['size']*.7:matched=True
            if not matched:
                self.issue('REFERENCE_TEXT','Thiếu hoặc sai chữ trong vùng ảnh gốc: '+expected,'',bounds,expected=expected,nearby=[e['text'] for e in nearby])
        paths=[(e,box(e['points'],e.get('width',1.5)/2)) for e in self.items if e['kind']=='path']
        for i,(e,mask,origin,bounds) in enumerate(masks):
            a=np.asarray(mask)>70
            for other,om,oo,ob in masks[:i]:
                if not overlap(bounds,ob):continue
                shared=Image.new('L',mask.size);shared.paste(om,(oo[0]-origin[0],oo[1]-origin[1]))
                pixels=int(np.count_nonzero(a & (np.asarray(shared)>70)))
                if pixels>=3:self.issue('TEXT_OVERLAP','Chữ chồng nét: '+e['text']+' / '+other['text'],e['owner'],bounds,pixels=pixels)
            hits={}
            for path,pb in paths:
                if not overlap(bounds,pb):continue
                # All strokes matter, including same component frames and internal strokes.
                stroke=Image.new('L',mask.size);paint_path(stroke,path,origin,stroke_only=True,mask=True)
                pixels=int(np.count_nonzero(a & (np.asarray(stroke)>70)))
                if pixels>=4:
                    group=(path['owner'],path.get('role'))
                    hits[group]=max(hits.get(group,0),pixels)
                if path['_index']>e['_index'] and path.get('closed') and path.get('fill','none')!='none':
                    cover=Image.new('L',mask.size);paint_path(cover,path,origin,mask=True)
                    hidden=int(np.count_nonzero(a & (np.asarray(cover)>70)))
                    if hidden>=max(4,int(a.sum()*.03)):self.issue('TEXT_OCCLUDED','Hình vẽ sau che mất chữ: '+e['text'],e['owner'],bounds,cover=path['owner'],pixels=hidden)
            for (owner,role),pixels in hits.items():
                self.issue('TEXT_WIRE' if role=='wire' else 'TEXT_STROKE','Nét chữ '+e['text']+' chạm '+owner,e['owner'],bounds,other=owner,pixels=pixels)
        self.stats.update(referenceTexts=len(self.ref['texts']),textItems=len(texts))
    def run(self,layout=True):
        try:
            self.schema();self.electrical();self.graphics()
            if layout:self.text_checks()
        except (KeyError,TypeError,ValueError,IndexError,OverflowError,AttributeError) as exc:
            self.issue('INVALID_INPUT','Không thể kiểm tra đầy đủ: '+str(exc))
        for k,covered in self.ref['coverage'].items():
            if not covered:self.issue('COVERAGE_'+k.upper(),'Chưa xác minh toàn bộ: '+k,severity='review')
        return self
    def result(self):
        errors=sum(i['severity']=='error' for i in self.issues)
        return dict(status='FAIL' if errors else 'NEEDS_REVIEW',errors=errors,
            reviewItems=sum(i['severity']=='review' for i in self.issues),coverage=self.ref['coverage'],
            statistics=self.stats,issues=self.issues,
            verdict='Chưa đủ điều kiện xác nhận giống ảnh gốc. Không dùng kết quả nội bộ để chứng nhận app.')

def verify_source(path,expected_hash):
    return path.exists() and hashlib.sha256(path.read_bytes()).hexdigest()==expected_hash
