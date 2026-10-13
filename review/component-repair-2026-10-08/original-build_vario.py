# -*- coding: utf-8 -*-
"""Transcribe the 12 supplied Honda Vario 2023-2025 schematics into editable vector JSON.
Run: python tools/build_vario.py
"""
import json, math, hashlib, html, zipfile, statistics
from pathlib import Path
from PIL import Image
from schematic_symbols import library, line, rect, ellipse, text as symbol_text, coil, zigzag
from rebuild_airblade import wire_graphics as base_wire_graphics
from render_schematic import render, flatten
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'FILE ANH'/'Vario 2023 - 2025'
OUT=ROOT/'File JSON chuẩn'/'Vario 2023 - 2025'
PALETTE={'R':'#e21b3b','G':'#0bc45b','Bl':'#333333','W':'#ffffff','Y':'#ffff00','Bu':'#00bee5','Lb':'#96dff0','Br':'#aa9076','Gr':'#a1a4a6','O':'#f59a54','Lg':'#a4d638','P':'#f39daf'}
SYMS=library(); PALE='#ffffa0'; GREY='#d1d1d3'; INK='#454545'
COLOR_INFO=dict(method='median RGB of a 3x3 patch of supplied Vario image; source screenshot colors',samples={})
for code,n,xx,yy in [('R',2,210,341),('G',2,37,365),('Bl',2,879,341),('W',2,372,340),('Y',6,880,286),('Bu',6,871,179),('Lb',3,1111,405),('O',3,1080,347),('Lg',2,1089,341),('Gr',10,1053,497),('Br',8,283,599),('P',7,894,371)]:
 source=sorted(SRC.glob('*.PNG'))[n-1]; im=Image.open(source).convert('RGB')
 patch=[im.getpixel((px,py)) for px in range(xx-1,xx+2) for py in range(yy-1,yy+2)]
 rgb=[int(statistics.median(v[j] for v in patch)) for j in range(3)]; value='#'+''.join(f'{v:02x}' for v in rgb)
 PALETTE[code]=value; COLOR_INFO['samples'][code]=dict(sourceImage=source.name,x=xx,y=yy,patchSize=3,rgb=rgb,hex=value)

def text(*args,**kw):
 color=kw.pop('fill',None); e=symbol_text(*args,**kw)
 if color:e['fill']=color
 return e

def wire_graphics(w,overview=False):
 e=base_wire_graphics(w,overview)
 if w['primaryColor']!='#ffffff' and min(int(w['primaryColor'][i:i+2],16) for i in (1,3,5))>240:
  e.insert(0,dict(line([[p['x'],p['y']] for p in w['points']],'#8a8a8a',(5 if overview else 8)+1.5),owner=w['id'],role='wire'))
 return e

class Circuit:
 def __init__(self,n,title,slug,portrait=False):
  self.source=sorted(SRC.glob('*.PNG'))[n-1]; im=Image.open(self.source)
  self.portrait=portrait
  self.width,self.height=im.size if not portrait else (im.height,im.width)
  self.d=dict(schemaVersion=1,reviewStatus='draft',sourceImage=self.source.name,id='vario-2023-2025-'+slug,vehicleId='thang',vehicleTitle='thang',vehicleModel='Honda Vario 2023–2025',circuitTitle=title,canvas=dict(width=self.width,height=self.height,background='#ffffff'),components=[],wires=[],sourceCrop=dict(x=0,y=0,width=im.width,height=im.height),sourceTransform=dict(rotateClockwise=90 if portrait else 0),reviewMetadata=dict(vectorPreviewGenerated=True,targetAppVerified=False,electricalSimulationValidated=False,source='supplied Vario screenshots',visualReview='manual comparison; see review-report.json'),renderContract='Render drawing.version=1; PNG/SVG are generated from JSON without source-image embedding.')
  self.d['colorReference']=COLOR_INFO
  self.n=n;self.title=title;self.extra=[];self.cmap={};self.cg={}
 def note(self,s,x,y,size=13,anchor='middle',rotate=0):
  self.extra.append(dict(text(s,x,y,size,anchor,rotate),role='annotation',owner='annotation'))
 def C(self,cid,typ,x,y,w,h,label='',terms=(),sym=None,fill=None,caption=True,**kw):
  c=dict(id=cid,type=typ,x=x,y=y,width=w,height=h,label=label,terminals=[dict(id=t[0],x=t[1],y=t[2],**({'label':t[3]} if len(t)>3 else {})) for t in terms],**kw)
  self.d['components'].append(c);self.cmap[cid]=c;e=[]
  def use(name,nw=100,nh=100,rotation=0):
   if rotation==0:m=[w/nw,0,0,h/nh,x,y]
   elif rotation==90:m=[0,h/nw,-w/nh,0,x+w,y]
   elif rotation==-90:m=[0,-h/nw,w/nh,0,x,y+h]
   e.append(dict(kind='use',symbol=name,matrix=m))
  ts=c['terminals']
  if typ=='junction':
   if w>0:e.append(ellipse(x,y,w/2,fill=fill or INK,stroke='none'))
  elif typ=='ground':
   color=fill or PALETTE['G'];e.extend([line([[x+w/2-ww/2,y+yy],[x+w/2+ww/2,y+yy]],color,5) for ww,yy in [(w,0),(w*.65,8),(w*.3,16)]])
  elif typ=='battery':
   e+=[rect(x,y+9,w,h-9,GREY)]
   for i,t in enumerate(ts):
    e+=[rect(t['x']-7,y,14,9,'white'),ellipse(t['x'],y+h*.33,min(9,h*.15)),line([[t['x']-7,y+h*.33],[t['x']+7,y+h*.33]],'#78a58d' if i==0 else '#c46574',1)]
    if i==1:e.append(line([[t['x'],y+h*.33-min(7,h*.12)],[t['x'],y+h*.33+min(7,h*.12)]],'#c46574',1))
   e.append(text('ẮC QUY',x+w/2,y+h*.84,min(14,w*.18,h*.22)))
  elif typ in ('fuse','switch','selectorSwitch','diode','flasher') and sym is None:
   e.append(rect(x,y,w,h,PALE if typ in ('switch','selectorSwitch','flasher') else GREY if typ=='diode' else 'white'))
   if typ=='fuse':
    a,b=ts;e += [line([[a['x'],a['y']],[x+w*.2,a['y']]]),line([[x+w*.8,b['y']],[b['x'],b['y']]]),ellipse(x+w*.2,a['y'],min(6,w*.09)),ellipse(x+w*.8,b['y'],min(6,w*.09)),line([[x+w*.28+w*.44*t/40,a['y']-9*math.sin(t/40*math.pi)**2] for t in range(41)])]
   elif typ=='switch':
    for a,b in zip(ts[::2],ts[1::2]):
     yy=a['y'];e += [line([[a['x'],yy],[x+w*.25,yy]]),line([[x+w*.8,b['y']],[b['x'],b['y']]]),ellipse(x+w*.25,yy,6),ellipse(x+w*.78,b['y'],6),line([[x+w*.25+3,yy-2],[x+w*.8,yy-18]],width=2)]
   elif typ=='selectorSwitch':
    a,b,c0=ts;e += [line([[a['x'],a['y']],[x+w*.28,a['y']]]),line([[x+w*.75,b['y']],[b['x'],b['y']]]),line([[x+w*.75,c0['y']],[c0['x'],c0['y']]]),ellipse(x+w*.28,a['y'],5),ellipse(x+w*.72,b['y'],5),ellipse(x+w*.72,c0['y'],5),line([[x+w*.3,a['y']],[x+w*.74,b['y']-5]])]
   elif typ=='diode':
    a,b=ts;yy=a['y'];e += [line([[a['x'],yy],[b['x'],yy]]),line([[x+w*.35,yy-8],[x+w*.65,yy],[x+w*.35,yy+8]],closed=True,fill=INK),line([[x+w*.68,yy-8],[x+w*.68,yy+8]])]
   elif typ=='flasher':use('flasher',100,60)
  elif typ=='relay':
   e.append(rect(x,y,w,h,PALE));a,b,c0,d=ts
   for t,xx in [(a,x+w*.23),(b,x+w*.75),(c0,x+w*.17),(d,x+w*.83)]:e.append(line([[t['x'],t['y']],[xx,t['y']]]))
   e += [ellipse(x+w*.23,a['y'],5),ellipse(x+w*.75,b['y'],5),line([[x+w*.23+2,a['y']-2],[x+w*.75,b['y']-14 if kw.get('startRelay') else b['y']-2]]),coil(x+w*.17,c0['y'],w*.66,11,4)]
  elif typ in ('ecm','scu','cluster','connectorBox'):
   e.append(rect(x,y,w,h,fill or (PALE if typ=='ecm' else '#39c7e8' if typ=='scu' else GREY)))
   for t in ts:
    lab=t.get('label',t['id'])
    side=t.get('side')
    if abs(t['y']-y)<2 or abs(t['y']-(y+h))<2:
     top=abs(t['y']-y)<2; by=y if top else y+h-16
     bw=max(22,len(lab)*6+4);e += [rect(t['x']-bw/2,by,bw,16,'white',width=.8),text(lab,t['x'],by+12,10)]
    else:
     left=abs(t['x']-x)<2;bw=min(w*.45,max(24,len(lab)*6+5));bx=x if left else x+w-bw
     e += [rect(bx,t['y']-8,bw,16,'white',width=.8),text(lab,bx+bw/2,t['y']+4,10)]
   if label and typ in ('ecm','scu'):e.append(text(label,x+w/2,y+h*.66,min(42,w/3,h/2)))
  elif cid in ('vs','vs-rotor') and typ=='sensor':
   for xx,yy,ww,hh in [(0,.15,.38,.69),(.38,0,.25,1),(.63,.16,.14,.68),(.77,.20,.13,.60),(.90,.22,.10,.56)]:e.append(rect(x+w*xx,y+h*yy,w*ww,h*hh,PALE))
  elif typ=='gauge':
   e += [rect(x,y,w,h,GREY),ellipse(x+w/2,y+h*.45,w*.33,h*.34),line([[x+w*.5,y+h*.45],[x+w*.5,y+h*.73]],INK,3),ellipse(x+w*.5,y+h*.73,3,fill=INK),text('E',x+w*.29,y+h*.34,10),text('F',x+w*.71,y+h*.34,10)]
   for i in range(6):e.append(line([[x+w*.37+i*w*.048,y+h*.3],[x+w*.37+i*w*.048,y+h*.35]]))
  elif typ=='lamp' and sym=='headlamp':
   a,b=ts;yy1=a['y'];yy2=b['y'];cx=x+w*.72;cy=y+h*.5
   e += [ellipse(cx,cy,w*.27,h*.5),rect(x,y+h*.13,w*.72,h*.74,'white'),line([[x+w*.14,y-5],[x+w*.14,y+h+5]],width=2),line([[x+w*.19,y-5],[x+w*.19,y+h+5]])]
   for yy in [yy1,yy2]:e += [line([[x,yy],[x+w*.43,yy]]),coil(x+w*.43,yy,w*.25,6,3),line([[x+w*.68,yy],[x+w*.86,yy]])]
   e.append(line([[x+w*.86,yy1],[x+w*.86,yy2],[x,yy2]]))
  elif typ=='lamp' and cid=='position':
   a,b=ts;yy=(a['y']+b['y'])/2;e += [ellipse(x+w*.68,y+h*.5,w*.32,h*.48),rect(x,y+h*.2,w*.49,h*.6,'white'),line([[a['x'],a['y']],[x+w*.6,a['y']],[x+w*.6,yy-7]]),line([[b['x'],b['y']],[x+w*.6,b['y']],[x+w*.6,yy+7]]),line([[x+w*.5,yy-5],[x+w*.7,yy-5],[x+w*.6,yy+5]],closed=True,fill=INK),line([[x+w*.49,yy+6],[x+w*.71,yy+6]]),line([[x+w*.73,yy],[x+w*.83,yy-8]]),line([[x+w*.76,yy+4],[x+w*.87,yy-4]])]
  elif typ=='sender' and sym=='sender':
   a,b=ts;e += [rect(x,y,w,h,GREY),line([[a['x'],a['y']],[a['x'],y+16],[x+17,y+16]]),zigzag(x+23,y+24,25,h*.62,4),line([[b['x'],b['y']],[b['x'],y+13],[x+w*.74,y+13],[x+w*.74,y+h*.47]]),ellipse(x+w*.74,y+h*.47,5,fill=INK),line([[x+w*.74,y+h*.47],[x+w*1.14,y+h*.62]],width=2),ellipse(x+w*1.28,y+h*.68,w*.20,h*.12,fill=GREY),line([[x+w*.63,y+h*.4],[x+w*.41,y+h*.37],[x+w*.55,y+h*.51]],width=2)]
  elif sym:
   dims={'battery':(100,83),'fuse':(100,46),'switch':(100,56),'push-switch':(100,64),'sender':(100,66),'headlamp':(100,100),'ignition-coil':(68,100),'spark-plug':(66,113),'ckp':(48,100),'thermistor':(100,65),'tp':(100,65),'oxygen':(44,100),'valve':(100,60),'injector':(88,60),'bulb':(100,100)}
   use(sym,*dims.get(sym,(100,100)),rotation=kw.get('rotation',0))
  else:e.append(rect(x,y,w,h,fill or PALE))
  if caption and label and typ not in ('ecm','scu','battery','junction','ground'):
   lines=label.split('\n')
   for i,s in enumerate(lines):e.append(text(s,x+w/2,y-8-(len(lines)-1-i)*15,14 if self.n in (2,3,4,5,7) else 12))
  for el in e:el.update(owner=cid,role='symbol')
  self.cg[cid]=e;return c
 def T(self,ref):
  cid,tid=ref.rsplit('.',1);return next(t for t in self.cmap[cid]['terminals'] if t['id']==tid)
 def J(self,cid,x,y,dot=0,color=None):return self.C(cid,'junction',x,y,dot,dot,terms=[('n',x,y)],fill=color)
 def G(self,cid,x,y,code='G',w=32):return self.C(cid,'ground',x-w/2,y,w,20,terms=[('in',x,y)],fill=PALETTE[code])
 def W(self,wid,a,b,code,via=(),label=None,width=None):
  ta,tb=self.T(a),self.T(b);pts=[(ta['x'],ta['y']),*via,(tb['x'],tb['y'])]
  # Remove duplicate neighboring vertices; keep at least two for zero-length links.
  pts=[p for i,p in enumerate(pts) if not i or p!=pts[i-1]]
  if len(pts)==1:pts*=2
  cols=code.split('/')
  w=dict(id=wid,**{'from':dict(componentId=a.rsplit('.',1)[0],terminalId=a.rsplit('.',1)[1]),'to':dict(componentId=b.rsplit('.',1)[0],terminalId=b.rsplit('.',1)[1])},points=[dict(x=x,y=y) for x,y in pts],code=code,primaryColor=PALETTE.get(cols[0],INK),state='controlled',labels=[])
  if len(cols)>1:w['stripeColor']=PALETTE[cols[1]]
  if label is None and code:
   segs=[(math.dist(p,q),p,q) for p,q in zip(pts,pts[1:])];_,p,q=max(segs,key=lambda s:s[0]);lx=(p[0]+q[0])/2;ly=(p[1]+q[1])/2
   if p[1]==q[1]:ly-=9
   else:lx+=12
   label=(lx,ly)
  if label and code:w['labels']=[text(code,*label,10 if self.portrait else 14)]
  if width:w['strokeWidth']=width
  self.d['wires'].append(w);return w
 def finish(self):
  elems=[]
  for comp in self.d['components']:
   if comp['type']=='assembly':elems+=self.cg[comp['id']]
  for w in self.d['wires']:
   parts=wire_graphics(w,self.portrait)
   if w.get('strokeWidth'):
    for e in parts:e['width']=w['strokeWidth']
   elems+=parts
  for c in self.d['components']:
   if c['type']!='assembly':elems+=self.cg[c['id']]
  for w in self.d['wires']:elems += [dict(t,owner=w['id'],role='wire-label') for t in w['labels']]
  elems+=self.extra;used={e['symbol'] for e in elems if e['kind']=='use'}
  self.d['drawing']=dict(version=1,background='#ffffff',fontFamily='Arial',symbols={s:SYMS[s] for s in used},elements=elems)
  return self.d
 def supply(self,by,fy,fx,kx,hx=None,hy=None):
  # Source-specific shared 20A MAIN / key / 7.5A secondary chain.
  bbx,bwidth,bheight,bn,bp=(58,80,59,74,121) if self.n==3 else (70,106,78,91,154)
  self.C('battery','battery',bbx,by,bwidth,bheight,terms=[('neg',bn,by),('pos',bp,by)])
  self.G('battery-ground',42,by+32)
  self.W('battery-ground','battery.neg','battery-ground.in','G',[(bn,fy),(42,fy)],label=(65,fy-10))
  self.C('main-fuse','fuse',fx,fy-20,88,40,'CẦU CHÌ (20A) MAIN',[('in',fx,fy),('out',fx+88,fy)])
  self.W('battery-main','battery.pos','main-fuse.in','R',[(bp,fy)],label=(170 if self.n==3 else 214,fy-10))
  self.C('key','switch',kx,fy-24,88,48,'KHÓA ĐIỆN',[('in',kx,fy),('out',kx+88,fy)])
  self.W('main-key','main-fuse.out','key.in','R/W')
  if hx is not None:
   self.C('load-fuse','fuse',hx,fy-20,88,40,'CẦU CHÌ (7,5A) '+hy,[('in',hx,fy),('out',hx+88,fy)])
   self.W('key-load','key.out','load-fuse.in','R/G')
  return self


ALL=[]
def done(c):ALL.append(c)

def comb(c,cid,x,y,labels,step=19):
 terms=[('in',x,y)]
 c.C(cid,'loadGroup',x,y,25,(len(labels)-1)*step,terms=terms,caption=False)
 e=[line([[x,y],[x,y+(len(labels)-1)*step]],width=1.5)]
 for i,s in enumerate(labels):e += [line([[x,y+i*step],[x+25,y+i*step]],width=1.5),text(s,x+30,y+i*step+4,11,'start')]
 c.cg[cid]=[dict(v,owner=cid,role='symbol') for v in e]

def pinout(c,cid,x,y,w,h,cols,rows,labels,colors=None,title=''):
 c.C(cid,'pinout',x,y,w,h,'',caption=False);e=[rect(x,y,w,h,'white',width=2),rect(x+5,y+5,w-10,h-10,'white',width=1)]
 cw=(w-18)/cols;ch=(h-18)/rows
 for i,lab in enumerate(labels):
  xx=x+9+(i%cols)*cw;yy=y+9+(i//cols)*ch;e += [rect(xx,yy,cw,ch,'white',width=.8)]
  if colors is None:e.append(text(str(lab),xx+cw/2,yy+ch*.68,min(11,ch*.6,cw*.65)))
  else:
   col=colors[i]
   if col:
    e.append(ellipse(xx+cw/2,yy+ch/2,min(cw,ch)*.3,fill=PALETTE[col.split('/')[0]]))
    if '/' in col:e.append(line([[xx+cw/2,yy+ch*.2],[xx+cw/2,yy+ch*.8]],PALETTE[col.split('/')[1]],3))
   else:e += [line([[xx+5,yy+4],[xx+cw-5,yy+ch-4]]),line([[xx+5,yy+ch-4],[xx+cw-5,yy+4]])]
 c.cg[cid]=[dict(el,owner=cid,role='symbol') for el in e]
 if title:
  for i,s in enumerate(title.split('\n')):c.note(s,x+w/2,y+h+22+i*16,12)


def owned(c,cid,e):
 c.cg[cid]=[dict(v,owner=cid,role='symbol') for v in e]

def fuse(c,cid,x,y,label,w=72):
 return c.C(cid,'fuse',x,y-16,w,32,label,[('in',x,y),('out',x+w,y)])

def supply(c,by,fy,fx,kx,lx,bx=75,bn=90,bp=140,keycode='Bl/W',loadcode='Bl',load='METER'):
 c.C('battery','battery',bx,by,80,60,terms=[('neg',bn,by),('pos',bp,by)])
 c.G('battery-ground',38,fy+50)
 c.W('battery-ground','battery.neg','battery-ground.in','G',[(bn,fy),(38,fy)],label=(63,fy-9))
 fuse(c,'main-fuse',fx,fy,'CẦU CHÌ (20A) MAIN')
 c.C('key','switch',kx,fy-22,72,40,'CÔNG TẮC MÁY',[('in',kx,fy),('out',kx+72,fy)])
 fuse(c,'load-fuse',lx,fy,'CẦU CHÌ (7,5A) '+load)
 c.W('battery-main','battery.pos','main-fuse.in','R',[(bp,fy)])
 c.W('main-key','main-fuse.out','key.in','R/W')
 c.W('key-load','key.out','load-fuse.in',keycode)
 return c

def connector(c,cid,x,y,rows,vertical=True,label=''):
 # rows: id, coordinate, input colour, output colour. Each physical pin has two faces.
 if vertical:y=min(r[1] for r in rows)-9;w,h=18,max(r[1] for r in rows)-min(r[1] for r in rows)+18
 else:x=min(r[1] for r in rows)-9;w,h=max(r[1] for r in rows)-min(r[1] for r in rows)+18,18
 ts=[]
 for tid,pos,_,_ in rows:
  ts += [(tid+'-in',x if vertical else pos,pos if vertical else y),(tid+'-out',x+w if vertical else pos,pos if vertical else y+h)]
 c.C(cid,'connector',x,y,w,h,'',ts,caption=False,pinCount=int(label.split('P')[0]) if label and label.split('P')[0].isdigit() else len(rows),representedPins=len(rows),connectorLabel=label)
 e=[rect(x,y,w,h,GREY),line([[x+w*.38,y],[x+w*.38,y+h*.35],[x+w*.7,y+h*.35],[x+w*.7,y+h*.65],[x+w*.38,y+h*.65],[x+w*.38,y+h]])]
 owned(c,cid,e)
 for tid,_,co,_ in rows:c.W(cid+'-'+tid,cid+'.'+tid+'-in',cid+'.'+tid+'-out',co,label=False)
 if label:c.note(label,x+w/2+(25 if not vertical else 0),y+h+17,10)
 return c.cmap[cid]

def led(c,cid,x,y,w,h,label,ts,channels=1):
 c.C(cid,'lamp',x,y,w,h,'',ts,caption=False,technology='LED')
 e=[rect(x,y,w,h,'white'),rect(x+4,y+5,6,h-10,'white')]
 ys=[t[2] for t in ts]
 for k in range(channels):
  yy=y+h*(k+.5)/channels
  e += [line([[ts[min(k,len(ts)-1)][1],ys[min(k,len(ys)-1)]],[x+w*.48,ys[min(k,len(ys)-1)]],[x+w*.48,yy-8]]),line([[x+w*.34,yy-8],[x+w*.62,yy-8],[x+w*.48,yy+5]],closed=True,fill=INK),line([[x+w*.33,yy+6],[x+w*.63,yy+6]]),line([[x+w*.66,yy],[x+w*.85,yy-9]]),line([[x+w*.72,yy+5],[x+w*.92,yy-4]])]
 e += [line([[ts[-1][1],ys[-1]],[x+w*.48,ys[-1]],[x+w*.48,y+h-12]])]
 owned(c,cid,e)
 if label:
  for k,s in enumerate(label.split('\n')):c.note(s,x+w/2,y-9-(len(label.split('\n'))-1-k)*15,13)

def legend(c,items,x=26,y=32,w=235):
 h=40+len(items)*20;c.C('legend','annotationBox',x,y,w,h,'',caption=False)
 e=[rect(x,y,w,h,'white',stroke='#aaaaaa',width=1),text('GHI CHÚ',x+w/2,y+18,14),line([[x+8,y+24],[x+w-8,y+24]],width=1)]
 for i,s in enumerate(items):e.append(text(s,x+10,y+42+i*20,10,'start'))
 owned(c,'legend',e)

def sensor6(c,x,y,w,h,ports,label='CẢM BIẾN CKP 6 DÂY'):
 c.C('ckp','sensor',x,y,w,h,'',ports,caption=False,signalNames=['U','V','W','GND','OUT','PUL'])
 e=[rect(x,y,w,h,PALE)]
 for t in ports:
  if len(t)>3:e.append(text(t[3],x+w/2,t[2]+3,9))
 owned(c,'ckp',e)
 if label:c.note(label,x+w/2,y+h+25,12)

def starter(c,x,y,w=72,h=86,ys=None):
 yi,yb,yo,yc=ys or (y+15,y+40,y+30,y+75)
 c.C('starter-relay','relay',x,y,w,h,'RƠ LE ĐỀ/SẠC',[('contact-in',x,yi),('contact-out',x+w,yo),('coil-in',x,yc),('coil-out',x+w,yc)],startRelay=True)
 c.cmap['starter-relay']['terminals'].append(dict(id='battery',x=x,y=yb))
 e=[rect(x,y,w,h,PALE),line([[x,yi],[x+15,yi]]),ellipse(x+15,yi,5),line([[x,yb],[x+15,yb]]),ellipse(x+15,yb,5),line([[x+20,yi+3],[x+w-15,yo]]),ellipse(x+w-15,yo,5),line([[x+w-10,yo],[x+w,yo]]),line([[x,yc],[x+12,yc]]),coil(x+12,yc,w-24,11,5),line([[x+w-12,yc],[x+w,yc]])]
 owned(c,'starter-relay',e);c.note('RƠ LE ĐỀ/SẠC',x+w/2,y-9,10 if c.portrait else 12)

def power():
 c=Circuit(1,'Mạch cấp nguồn','power')
 c.C('battery','battery',73,520,100,74,terms=[('neg',90,520),('pos',155,520)])
 c.G('battery-ground',45,546);c.W('battery-ground','battery.neg','battery-ground.in','G',[(90,471),(45,471)],label=(68,461))
 c.J('positive',155,471);c.J('main-bus',426,471,15,PALETTE['R']);c.J('key-input',426,395,15,PALETTE['R'])
 fuse(c,'backup',238,159,'CẦU CHÌ (7,5A) BACK UP',90);fuse(c,'main-fuse',238,471,'CẦU CHÌ (20A) MAIN',90)
 c.W('battery-positive','battery.pos','positive.n','R',label=False);c.W('backup-input','positive.n','backup.in','R',[(155,159)],label=(176,150));c.W('main-input','positive.n','main-fuse.in','R')
 comb(c,'backup-loads',468,101,['BỘ ĐIỀU KHIỂN KHÓA THÔNG MINH','CỤM ĐÈN PHA TRƯỚC','CỤM ĐỒNG HỒ'],30)
 c.W('backup-output','backup.out','backup-loads.in','R',[(468,159)],label=(390,150))
 c.C('key','switch',524,356,124,135,'KHÓA ĐIỆN',[('in1',524,395),('out1',648,395),('in2',524,471),('out2',648,471)])
 c.C('main-relay','relay',799,219,89,95,'RƠ LE CHÍNH',[('contact-in',799,242),('contact-out',888,242),('coil-in',799,296),('coil-out',888,296)])
 c.J('key-out',710,395,15,INK);c.J('fi-split',961,395,15,INK);c.J('relay-out',961,242,15,INK);c.J('lighting-feed',710,726,16,INK)
 c.W('main-output','main-fuse.out','main-bus.n','R/W');c.W('main-key-input','main-bus.n','key-input.n','R/W',label=False)
 c.W('key-input1','key-input.n','key.in1','R/W');c.W('key-input2','main-bus.n','key.in2','R/W')
 c.W('relay-main','key-input.n','main-relay.contact-in','R/W',[(426,242)])
 c.W('key-out','key.out1','key-out.n','Bl/W',label=False);c.W('fi-split','key-out.n','fi-split.n','Bl/W')
 c.W('relay-control','key-out.n','main-relay.coil-in','Bl/W',[(710,296)])
 c.G('relay-ground',951,342);c.W('relay-ground','main-relay.coil-out','relay-ground.in','G/W',[(951,296)])
 c.W('relay-output','main-relay.contact-out','relay-out.n','Bl/Bu')
 specs=[('usb',107,'USB','Bl/Bu','Bu'),('pump',242,'F/P, INJ','Bl/Bu','Bl/R'),('fi',395,'FI','Bl/W','Bl/R'),('meter',594,'METER','Bl/W','Bl'),('lt',726,'LT','Bl/Y','Bl'),('hl',818,'H/L','Bl/Y','Br/R')]
 c.W('key-lights','key.out2','lighting-feed.n','Bl/Y',[(710,471)],label=(683,460))
 for cid,yy,cap,ci,co in specs:
  fuse(c,cid,1061,yy,'CẦU CHÌ (7,5A) '+cap,89)
  ref='relay-out.n' if cid in ('usb','pump') else 'fi-split.n' if cid in ('fi','meter') else 'lighting-feed.n'
  rx=c.T(ref)['x'];c.W(cid+'-feed',ref,cid+'.in',ci,[(rx,yy)],label=(1025,yy-9))
  labels={'usb':['BỘ SẠC USB'],'pump':['VAN TỪ CẦM CHỪNG NHANH','KIM PHUN','MÔ BIN SƯỜN','MÔ TƠ BƠM XĂNG'],'fi':['ECM','GIẮC CHẨN ĐOÁN','CUỘN HÚT RƠ LE ĐỀ/SẠC'],'meter':['BỘ ĐIỀU KHIỂN KHÓA THÔNG MINH','CÔNG TẮC PHANH TRƯỚC/SAU','CỤM ĐỒNG HỒ','RƠ LE XI NHAN','CÔNG TẮC CÒI'],'lt':['CỤM ĐÈN PHA LED (ĐÈN VỊ TRÍ)','ĐÈN HẬU','ĐÈN BIỂN SỐ'],'hl':['CỤM ĐÈN PHA LED']}[cid]
  ty={'pump':156,'fi':338,'meter':475,'lt':668}.get(cid,yy)
  comb(c,cid+'-loads',1289,ty,labels,30)
  c.W(cid+'-out',cid+'.out',cid+'-loads.in',co,[(1289,yy)],label=(1220,yy-10))
 done(c)

def simple_circuits():
 c=Circuit(2,'Mạch còi','horn');supply(c,404,341,287,506,735)
 c.C('horn-switch','switch',952,312,72,40,'CÔNG TẮC CÒI',[('in',952,341),('out',1024,341)],sym='push-switch')
 c.C('horn','horn',1130,277,50,68,'CÒI',[('in',1144,341),('out',1167,341)],sym='horn');c.G('horn-ground',1237,395)
 c.W('meter-switch','load-fuse.out','horn-switch.in','Bl');c.W('switch-horn','horn-switch.out','horn.in','Lg');c.W('horn-return','horn.out','horn-ground.in','G/W',[(1237,341)],label=(1205,332));done(c)
 c=Circuit(3,'Mạch xi nhan','turn-signals');supply(c,427,363,193,369,559)
 c.C('flasher','flasher',720,334,82,47,'RƠ LE XI NHAN',[('in',720,363),('out',802,363),('ground',760,381)])
 c.G('flasher-ground',760,447);c.W('meter-flasher','load-fuse.out','flasher.in','Bl');c.W('flasher-ground','flasher.ground','flasher-ground.in','G/W')
 c.C('turn-switch','selectorSwitch',892,333,69,61,'CÔNG TẮC\nXI NHAN',[('in',892,363),('left',961,347),('right',961,380)])
 c.W('flasher-switch','flasher.out','turn-switch.in','Gr')
 for cid,yy,co,cap in [('left',253,'O','ĐÈN XI NHAN\nTRÁI'),('right',460,'Lb','ĐÈN XI NHAN\nPHẢI')]:
  led(c,cid+'-lamp',1190,yy-21,42,77,cap,[('in',1190,yy),('out',1190,yy+33)])
  c.G(cid+'-ground',1144,yy+68);c.W(cid+'-feed','turn-switch.'+cid,cid+'-lamp.in',co,[(1111,347 if cid=='left' else 380),(1111,yy)],label=(1145,yy-8))
  c.W(cid+'-ground',cid+'-lamp.out',cid+'-ground.in','G/W',[(1144,yy+33)],label=(1163,yy+27))
 done(c)
 c=Circuit(4,'Mạch đèn phanh','brake-light');supply(c,410,348,208,422,621)
 c.J('brake-feed',794,347,12,INK);c.J('brake-out',963,347,12,PALETTE['G'])
 c.C('front-brake','switch',844,267,69,40,'CT PHANH TRƯỚC',[('in',844,290),('out',913,290)])
 c.C('rear-brake','switch',844,387,69,32,'CT PHANH SAU',[('in',844,407),('out',913,407)],sym='push-switch')
 c.W('meter-brakes','load-fuse.out','brake-feed.n','Bl')
 for cid,yy in [('front',290),('rear',407)]:
  c.W(cid+'-feed','brake-feed.n',cid+'-brake.in','Bl',[(794,yy)])
  c.W(cid+'-out',cid+'-brake.out','brake-out.n','G/Y',[(963,yy)])
 connector(c,'tail-6p',1064,338,[('stop',347,'G/Y','G/Y'),('ground',371,'G/W','G')],label='6P / Bl')
 led(c,'brake-lamp',1178,315,38,111,'ĐÈN PHANH/ĐÈN HẬU',[('stop',1178,347),('ground',1178,371)],2)
 c.W('stop-connector','brake-out.n','tail-6p.stop-in','G/Y');c.W('connector-stop','tail-6p.stop-out','brake-lamp.stop','G/Y')
 c.G('lamp-ground',1018,425);c.W('ground-connector','lamp-ground.in','tail-6p.ground-in','G/W',[(1018,371)])
 c.W('connector-ground','tail-6p.ground-out','brake-lamp.ground','G')
 legend(c,['6P / Bl : Đầu nối 6 chân, màu đen']);done(c)
 c=Circuit(5,'Mạch báo xăng','fuel-gauge');supply(c,150,102,205,433,774,bx=66,bn=80,bp=132)
 c.C('cluster','cluster',1072,65,181,172,'CỤM ĐỒNG HỒ',[('power',1072,102,'16 IGN'),('fuel',1072,150,'13 FUEL'),('ground',1072,198,'6 GND')]);c.note('16P / Gr',1080,249,10)
 c.extra += [rect(1153,117,86,66,'#777777'),text('F',1163,129,10,fill='white'),text('E',1163,177,10,fill='white')]
 for k in range(6):c.extra.append(line([[1170,128+k*7],[1192-k*3,128+k*7]],'white',4))
 c.W('cluster-power','load-fuse.out','cluster.power','Bl');c.J('fuel-return',993,198,12,INK);c.G('cluster-ground',993,261)
 c.W('cluster-return','cluster.ground','fuel-return.n','G');c.W('cluster-ground','fuel-return.n','cluster-ground.in','G/Bl')
 connector(c,'sender-5p',843,384,[('fuel',852,'Y/W','R'),('ground',881,'G/Bl','Bl')],vertical=False,label='5P')
 c.C('fuel-sender','sender',819,493,100,110,'',[('signal',852,493),('ground',881,493)],sym='sender');c.note('PHAO XĂNG',868,631,17)
 c.W('fuel-signal','cluster.fuel','sender-5p.fuel-in','Y/W',[(852,150)],label=(834,363));c.W('fuel-return','fuel-return.n','sender-5p.ground-in','G/Bl',[(881,198)],label=(899,363))
 c.W('sender-signal','sender-5p.fuel-out','fuel-sender.signal','R');c.W('sender-ground','sender-5p.ground-out','fuel-sender.ground','Bl')
 legend(c,['16P / Gr : Đầu nối 16 chân, màu xám','5P : Đầu nối 5 chân'],1025,592,235);done(c)
 c=Circuit(7,'Mạch báo tốc độ xe','speed-signal');supply(c,170,123,201,428,769,bx=62,bn=77,bp=127)
 c.C('cluster','cluster',1075,85,180,272,'CỤM ĐỒNG HỒ',[('power',1075,123,'16 IGN'),('vs-pulse',1075,170,'11 SP NO ABS'),('vs-vcc',1075,218,'2 SP VCC'),('speed',1075,266,'5 SP OUT'),('ground',1075,314,'6 GND')]);c.note('16P / Gr',1084,371,10)
 c.extra += [rect(1162,188,82,67,'#777777'),text('0',1202,240,42,fill='white'),text('km/h',1221,257,9,fill='white')]
 c.C('ecm','ecm',1077,471,180,136,'',[('speed',1077,538,'A7 SP-SE')]);c.note('ECM',1200,550,30);c.note('39P / Bl',1080,623,10)
 connector(c,'vs-2p',657,359,[('pulse',667,'Bl/R','Bl/R'),('vcc',702,'Bl/Bu','Bl/Bu')],vertical=False,label='')
 c.note('2P / Bl',742,375,10)
 c.C('vs','sensor',650,381,69,93,'',[('pulse',667,381,'PULSE'),('vcc',702,381,'VCC')],caption=False)
 owned(c,'vs',[rect(659,381,52,93,PALE),rect(650,421,69,24,PALE),text('PULSE',672,402,9,rotate=-90),text('VCC',700,401,9,rotate=-90)])
 c.C('vs-rotor','rotor',648,483,76,76,'',caption=False,sym='rotor');c.note('CẢM BIẾN VS',584,449,16)
 c.W('cluster-power','load-fuse.out','cluster.power','Bl')
 for tid,yy,co in [('pulse',170,'Bl/R'),('vcc',218,'Bl/Bu')]:
  tx=c.T('vs-2p.'+tid+'-in')['x'];c.W('vs-'+tid,'cluster.vs-'+tid,'vs-2p.'+tid+'-in',co,[(tx,yy)],label=(tx-15 if tid=='pulse' else tx+25,310));c.W('vs-'+tid+'-sensor','vs-2p.'+tid+'-out','vs.'+tid,co,label=False)
 c.W('cluster-ecm','cluster.speed','ecm.speed','P/G',[(894,266),(894,538)],label=(1018,527))
 connector(c,'ground-9p',965,324,[('ground',988,'G','G/Bl')],vertical=False,label='9P')
 c.G('cluster-ground',988,389);c.W('cluster-ground-input','cluster.ground','ground-9p.ground-in','G',[(988,314)])
 c.W('cluster-ground','ground-9p.ground-out','cluster-ground.in','G/Bl')
 legend(c,['39P / Bl : Đầu nối 39 chân, màu đen','16P / Gr : Đầu nối 16 chân, màu xám','9P : Đầu nối 9 chân','2P / Bl : Đầu nối 2 chân, màu đen'],22,552);done(c)

def lighting():
 c=Circuit(6,'Mạch đèn đêm và đèn pha LED','night-lighting')
 c.C('battery','battery',81,403,80,57,terms=[('neg',97,403),('pos',144,403)]);c.G('battery-ground',38,392)
 c.W('battery-ground','battery.neg','battery-ground.in','G',[(97,351),(38,351)],label=(63,342))
 fuse(c,'main-fuse',196,351,'CẦU CHÌ (20A) MAIN',68)
 c.C('key','switch',376,330,67,38,'CÔNG TẮC MÁY',[('in',376,351),('out',443,351)])
 c.J('key-out',511,351,12,INK);c.J('tail-feed',706,418,12,INK);c.J('tail-bus',706,584,12,INK)
 fuse(c,'hl',579,351,'CẦU CHÌ (7,5A) H/L',68);fuse(c,'lt',579,418,'CẦU CHÌ (7,5A) LT',68)
 c.W('main-input','battery.pos','main-fuse.in','R',[(144,351)]);c.W('key-main','main-fuse.out','key.in','R/W');c.W('key-out','key.out','key-out.n','Bl/Y');c.W('hl-input','key-out.n','hl.in','Bl/Y');c.W('lt-input','key-out.n','lt.in','Bl/Y',[(511,418)])
 c.C('dimmer','selectorSwitch',377,174,64,66,'CÔNG TẮC PHA CỐT',[('common',441,207),('low',377,187,'LO'),('high',377,227,'HI')],caption=False)
 owned(c,'dimmer',[rect(377,174,64,66,PALE),line([[441,207],[428,207],[395,187]]),ellipse(428,207,5),ellipse(395,187,5),ellipse(395,227,5),text('LO',411,185,9),text('HI',411,225,9)])
 c.note('CÔNG TẮC PHA CỐT',408,165,12)
 connector(c,'dimmer-8p',537,194,[('low',207,'G','Y'),('high',227,'Bu','G/W')],label='8P / Bl')
 c.G('dimmer-ground',673,261);c.W('dimmer-low','dimmer.common','dimmer-8p.low-in','G');c.W('dimmer-high','dimmer.high','dimmer-8p.high-in','Bu',label=False);c.W('dimmer-ground','dimmer-8p.high-out','dimmer-ground.in','G/W',[(673,227)])
 c.C('headlamp','connectorBox',930,209,306,285,'',[('high',930,250,'HI BEAM'),('dimmer',930,286,'DIMMER SW'),('hl',930,351,'VCC HL'),('position',930,418,'VCC PO'),('ground',930,452,'GND PA')],fill='#bce3ec');c.note('CỤM ĐÈN PHA LED',1090,197,18);c.note('8P / Bl',930,511,10)
 c.C('cluster','cluster',930,74,306,78,'CỤM ĐỒNG HỒ',[('high',930,112,'3 HIGH BEAM')]);c.note('16P / Gr',930,164,10)
 c.J('high-signal',1055,250,7,INK)
 c.W('hl-lamp','hl.out','headlamp.hl','Br/R');c.W('lt-bus','lt.out','tail-feed.n','Bl');c.W('position-feed','tail-feed.n','headlamp.position','Bl');c.W('tail-bus','tail-feed.n','tail-bus.n','Bl',label=False)
 c.W('dimmer-lamp','dimmer-8p.low-out','headlamp.dimmer','Y',[(706,207),(706,286)])
 c.W('high-indicator','headlamp.high','cluster.high','Bu',[(871,250),(871,112)])
 c.G('headlamp-ground',869,491);c.W('headlamp-ground','headlamp.ground','headlamp-ground.in','G/W',[(869,452)])
 for yy,lab in [(291,'HI'),(351,'LO'),(418,'PO')]:
  c.extra += [rect(1109,yy-20,57,37,'white',stroke='#bbbbbb',width=1),text('('+lab+')',1138,yy-24,9)]
  for xx in [1121,1143]:c.extra += [line([[xx,yy-7],[xx+13,yy],[xx,yy+7]],closed=True,fill='#e74459'),line([[xx+14,yy-8],[xx+14,yy+8]])]
 c.extra += [line([[1015,351],[1074,351],[1074,291],[1109,291]]),line([[1074,351],[1109,351]]),line([[1015,418],[1109,418]]),line([[1166,291],[1205,291],[1205,452],[1015,452]]),line([[1166,351],[1205,351]]),line([[1166,418],[1205,418]]),line([[1055,250],[1205,250],[1205,291]]),line([[1015,286],[1055,286],[1055,250]])]
 connector(c,'tail-3p',462,575,[('tail',584,'Bu','Bl'),('ground',612,'G','G/W')],label='3P / Bl')
 led(c,'tail-lamp',334,549,42,124,'',[('tail',376,584),('ground',376,612)],2);c.note('ĐÈN PHANH/ĐÈN HẬU',259,620,15)
 c.W('tail-feed','tail-bus.n','tail-3p.tail-out','Bl');c.W('tail-lamp','tail-3p.tail-in','tail-lamp.tail','Bu')
 c.G('tail-ground',524,656);c.W('tail-ground','tail-3p.ground-out','tail-ground.in','G/W',[(524,612)]);c.W('tail-return','tail-lamp.ground','tail-3p.ground-in','G')
 connector(c,'plate-6p',872,575,[('power',584,'Bl','Bl'),('ground',612,'G/W','G')],label='6P / Bl');connector(c,'plate-2p',987,575,[('power',584,'Bl','Br'),('ground',612,'G','G')],label='2P / Bl')
 led(c,'plate-lamp',1072,564,43,75,'',[('power',1072,584),('ground',1072,612)]);c.note('ĐÈN BIỂN SỐ',1180,600,16)
 c.W('plate-feed','tail-bus.n','plate-6p.power-in','Bl');c.W('plate-power1','plate-6p.power-out','plate-2p.power-in','Bl');c.W('plate-power2','plate-2p.power-out','plate-lamp.power','Br')
 c.G('plate-ground',832,656);c.W('plate-ground','plate-ground.in','plate-6p.ground-in','G/W',[(832,612)]);c.W('plate-return1','plate-6p.ground-out','plate-2p.ground-in','G');c.W('plate-return2','plate-2p.ground-out','plate-lamp.ground','G')
 legend(c,['16P / Gr : Đầu nối 16 chân, màu xám','8P / Bl : Đầu nối 8 chân, màu đen','6P / Bl : Đầu nối 6 chân, màu đen','3P / Bl : Đầu nối 3 chân, màu đen','2P / Bl : Đầu nối 2 chân, màu đen'],26,35,230);done(c)

def ignition():
 c=Circuit(8,'Mạch đánh lửa','ignition')
 c.C('battery','battery',127,211,85,53,terms=[('neg',145,211),('pos',195,211)]);c.G('battery-ground',65,235)
 c.W('battery-ground','battery.neg','battery-ground.in','G',[(145,81),(65,81)],label=(104,71))
 fuse(c,'main-fuse',253,81,'CẦU CHÌ (20A) MAIN');c.J('main-bus',361,81)
 c.C('key','switch',538,129,72,40,'CÔNG TẮC MÁY',[('in',538,152),('out',610,152)])
 c.C('main-relay','relay',731,63,72,104,'RƠ LE CHÍNH',[('contact-in',731,81),('contact-out',803,81),('coil-in',731,152),('coil-out',803,152)])
 c.J('key-bus',674,152,12,INK);fuse(c,'fi',538,251,'CẦU CHÌ (7,5A) FI');fuse(c,'pump-fuse',900,81,'CẦU CHÌ (7,5A) F/P INJ',68)
 c.G('relay-ground',842,207)
 c.W('battery-main','battery.pos','main-fuse.in','R',[(195,81)]);c.W('main-bus','main-fuse.out','main-bus.n','R/W',label=False);c.W('main-relay','main-bus.n','main-relay.contact-in','R/W')
 c.W('main-key','main-bus.n','key.in','R/W',[(361,152)]);c.W('key-output','key.out','key-bus.n','Bl/W',label=False);c.W('relay-control','key-bus.n','main-relay.coil-in','Bl/W');c.W('relay-ground','main-relay.coil-out','relay-ground.in','G/W',[(842,152)])
 c.W('fi-input','key-bus.n','fi.out','Bl/W',[(674,251)])
 ports=[('ihu',446,'W/R','A23'),('ihv',484,'W/Bu','A24'),('ihw',523,'W/Bl','A26'),('ckp-ground',561,'G','A10'),('vout',600,'Br/Bl','A9'),('pcb',639,'Bu/Y','A25')]
 c.C('ecm','ecm',331,405,667,272,'ECM',[('ground',401,405,'B2'),('power',463,405,'A8'),('ignition',968,405,'A27')]+[(tid,331,yy,pin) for tid,yy,_,pin in ports])
 c.W('fi-ecm','fi.in','ecm.power','Bl/R',[(463,251)]);c.W('ecm-ground','battery.neg','ecm.ground','G',[(122,160),(97,160),(97,318),(401,318)],label=(236,309))
 c.C('ckp','sensor',130,429,26,224,'CẢM BIẾN CKP',[(tid,156,yy) for tid,yy,_,_ in ports],fill=PALE);c.cg['ckp'] += [dict(rect(119,529,11,28,PALE),owner='ckp',role='symbol')]
 for tid,yy,co,_ in ports:c.W('ckp-'+tid,'ckp.'+tid,'ecm.'+tid,co,label=(248,yy-9))
 c.C('ignition-coil','ignitionCoil',1128,297,52,75,'',[('control',1139,297),('power',1167,297),('ht',1153,372)],sym='ignition-coil');c.note('MÔ-BIN SƯỜN',1222,346,11)
 c.C('spark-plug','sparkPlug',1135,372,35,96,'',[('ht',1153,372)],sym='spark-plug');c.note('BUGI',1180,428,12)
 c.W('relay-pump','main-relay.contact-out','pump-fuse.in','Bl/Bu');c.W('coil-power','pump-fuse.out','ignition-coil.power','Bl/R',[(1167,81)])
 c.W('ignition-control','ecm.ignition','ignition-coil.control','Y/Bu',[(968,253),(1139,253)],label=(1050,244));c.W('coil-ht','ignition-coil.ht','spark-plug.ht','',width=2)
 done(c)

def acg(c,x,y,w,h,terms):
 c.C('acg','acg',x,y,w,h,'',terms,caption=False)
 cx=x+w/2;cy=y+h/2;r=min(w,h)/2;e=[ellipse(cx,cy,r,fill=GREY,width=3)]
 for tid,tx,ty in terms:
  dx,dy=tx-cx,ty-cy;ll=math.hypot(dx,dy);ux,uy=dx/ll,dy/ll
  pts=[[cx+ux*t*r*.7-uy*5*math.sin(t*8*math.pi),cy+uy*t*r*.7+ux*5*math.sin(t*8*math.pi)] for t in [i/90 for i in range(91)]]
  e += [line(pts,width=1.5),line([[cx+ux*r*.7,cy+uy*r*.7],[tx,ty]],width=2),rect(tx-8,ty-8,16,16,INK),text(tid.upper(),tx,ty+4,10,fill='white')]
 owned(c,'acg',e);c.note('MÁY PHÁT/KHỞI ĐỘNG',cx,y+h+24,12)

def start_idle(n):
 idle=n==10;c=Circuit(n,'Mạch dừng động cơ tạm thời (Idling Stop)' if idle else 'Mạch khởi động','idling-stop' if idle else 'starting')
 if idle:
  bx,by,bn,bp=104,249,121,168;fx,fy=222,133;kx,ky=414,266;rx,ry=414,114;sr_x,sr_y=758,39;ffx=586;busx=534;powx=709;ex,ey,ew=40,376,1150;gx=81
  top=[('ground',81,ey,'B2'),('power',709,ey,'A8'),('starter-y',866,ey,'A32'),('starter-r',899,ey,'B1'),('mil',943,ey,'A3'),('speed',979,ey,'A7')]
  bottom=[('acg-u',60,449,'C1'),('acg-v',152,449,'C2'),('acg-w',244,449,'C3'),('ckp-ihu',431,449,'A23'),('ckp-ihv',455,449,'A24'),('ckp-ihw',479,449,'A26'),('ckp-ground',503,449,'A10'),('ckp-vout',527,449,'A9'),('ckp-pcb',551,449,'A25'),('idle-switch',708,449,'A20'),('stand',750,449,'A39'),('lg',918,449,'A11'),('tp-vcc',976,449,'A13'),('ignition',1007,449,'A27'),('sg',1099,449,'A12'),('ect',1149,449,'A37')]
  rcy=185;sy=(54,81,72,113)
 else:
  bx,by,bn,bp=90,255,107,154;fx,fy=208,134;kx,ky=439,287;rx,ry=434,117;sr_x,sr_y=763,43;ffx=597;busx=541;powx=728;ex,ey,ew=12,380,1257;gx=67
  top=[('ground',67,ey,'B2'),('power',728,ey,'A8'),('scu-start',1039,ey,'A35'),('starter-y',1225,ey,'A32'),('starter-r',1252,ey,'B1')]
  bottom=[('stand',313,453,'A39'),('lg',485,453,'A11'),('ckp-pcb',729,453,'A25'),('ckp-vout',753,453,'A9'),('ckp-ground',777,453,'A10'),('ckp-ihw',801,453,'A26'),('ckp-ihv',825,453,'A24'),('ckp-ihu',849,453,'A23'),('acg-w',1036,453,'C3'),('acg-v',1129,453,'C2'),('acg-u',1220,453,'C1')]
  rcy=187;sy=(58,85,77,117)
 c.C('battery','battery',bx,by,80,57,terms=[('neg',bn,by),('pos',bp,by)]);c.G('battery-ground',52 if idle else 38,276)
 c.W('battery-ground','battery.neg','battery-ground.in','G',[(bn,133 if idle else 136),(52 if idle else 38,133 if idle else 136)],label=(80,123))
 fuse(c,'main-fuse',fx,fy,'CẦU CHÌ (20A) MAIN');c.J('main-bus',354 if idle else 370,fy,12,PALETTE['R'])
 c.C('key','switch',kx,ky-22,72,40,'CÔNG TẮC MÁY',[('in',kx,ky),('out',kx+72,ky)])
 c.C('main-relay','relay',rx,ry,72,86,'RƠ LE CHÍNH',[('contact-in',rx,fy),('contact-out',rx+72,fy),('coil-in',rx,rcy),('coil-out',rx+72,rcy)])
 fuse(c,'fi',ffx,rcy,'CẦU CHÌ (7,5A) FI');fuse(c,'meter',ffx,ky,'CẦU CHÌ (7,5A) METER')
 c.C('ecm','ecm',ex,ey,ew,73,'ECM',top+bottom)
 c.J('key-bus',busx,ky,12,INK);c.J('relay-bus',busx,rcy,12,INK);c.J('fi-bus',powx,rcy,12,INK)
 starter(c,sr_x,sr_y,72,86,sy)
 c.W('battery-main','battery.pos','main-fuse.in','R',[(bp,fy)]);c.W('main-bus','main-fuse.out','main-bus.n','R/W',label=False);c.W('main-relay','main-bus.n','main-relay.contact-in','R/W');c.W('main-key','main-bus.n','key.in','R/W',[(354 if idle else 370,ky)])
 c.W('key-bus','key.out','key-bus.n','Bl/W',label=False);c.W('relay-bus','key-bus.n','relay-bus.n','Bl/W',label=False);c.W('main-coil','main-relay.coil-out','relay-bus.n','Bl/W',label=False)
 c.G('relay-ground',378 if idle else 399,216);c.W('relay-ground','main-relay.coil-in','relay-ground.in','G/W',[(378 if idle else 399,rcy)])
 c.W('fi-input','relay-bus.n','fi.in','Bl/W');c.W('meter-input','key-bus.n','meter.in','Bl/W')
 c.W('fi-output','fi.out','fi-bus.n','Bl/R',label=False);c.W('ecm-power','fi-bus.n','ecm.power','Bl/R',label=(powx-25,ey-45))
 c.W('starter-coil','fi-bus.n','starter-relay.coil-in','Bl/R',[(powx,sy[3])])
 c.W('starter-input','main-relay.contact-out','starter-relay.contact-in','Bl/Bu',[(566 if idle else 645,fy),(566 if idle else 645,sy[0])],label=(692,sy[0]-9))
 c.W('starter-battery','battery.pos','starter-relay.battery','R',[(149 if idle else 135,208),(149 if idle else 135,sy[1])],label=(447,sy[1]-9))
 c.W('starter-y','starter-relay.coil-out','ecm.starter-y','Y',[(866 if idle else 1225,sy[3])],label=(846 if idle else 1000,sy[3]-8))
 c.W('starter-r','starter-relay.contact-out','ecm.starter-r','R/Y',[(899 if idle else 1252,sy[2])],label=(877 if idle else 1040,sy[2]-8))
 c.W('ecm-ground','battery.neg','ecm.ground','G',[(98 if idle else 83,205),(gx,205)],label=(gx+13,ey-65))
 if idle:
  acg(c,76,530,155,158,[('u',60,641),('v',152,530),('w',244,641)])
  ckx,cky,ckw,ckh=272,527,44,154;ckports=[('ihu',316,545,'U'),('ihv',316,569,'V'),('ihw',316,593,'W'),('ground',316,617,'GND'),('vout',316,641,'OUT'),('pcb',316,665,'PUL')]
 else:
  acg(c,1052,526,151,158,[('u',1220,645),('v',1129,530),('w',1036,645)])
  ckx,cky,ckw,ckh=963,531,44,154;ckports=[('ihu',963,549,'U'),('ihv',963,573,'V'),('ihw',963,597,'W'),('ground',963,621,'GND'),('vout',963,645,'OUT'),('pcb',963,669,'PUL')]
 for tid,code in [('u','R/Bu'),('v','R/W'),('w','R/Y')]:
  t=c.T('ecm.acg-'+tid);target=c.T('acg.'+tid);c.W('acg-'+tid,'ecm.acg-'+tid,'acg.'+tid,code,[(t['x'],target['y'])],label=(t['x']+15,(t['y']+target['y'])/2))
 sensor6(c,ckx,cky,ckw,ckh,ckports)
 for tid,_,yy,_ in ckports:
  t=c.T('ecm.ckp-'+tid);code={'ihu':'W/R','ihv':'W/Bu','ihw':'W/Bl','ground':'G','vout':'Br/Bl','pcb':'Bu/Y'}[tid]
  c.W('ckp-'+tid,'ecm.ckp-'+tid,'ckp.'+tid,code,[(t['x'],yy)],label=(380 if idle else 896,yy-8))
 if idle:
  c.C('stand','switch',795,527,69,46,'CÔNG TẮC CHÂN\nCHỐNG NGHIÊNG',[('in',795,542),('out',864,557)])
  c.C('idle-switch','switch',795,618,69,40,'CÔNG TẮC\nDỪNG CẦM CHỪNG',[('in',795,642),('out',864,642)])
  c.J('logic-ground',918,557,12,PALETTE['G']);c.W('lg-feed','ecm.lg','logic-ground.n','G/Bl');c.W('stand-feed','ecm.stand','stand.in','Bu',[(750,542)])
  c.W('stand-return','stand.out','logic-ground.n','G/Bl');c.W('idle-feed','ecm.idle-switch','idle-switch.in','Bl/Bu',[(708,642)])
  c.W('idle-return','idle-switch.out','logic-ground.n','G/Bl',[(918,642)],label=False)
  c.C('cluster','cluster',1007,157,141,112,'CỤM ĐỒNG HỒ',[('power',1007,177,'16'),('mil',1007,208,'12'),('speed',1007,245,'5'),('pulse',1148,177,'11'),('vcc',1148,208,'2'),('ground',1148,244,'6')])
  c.note('ĐÈN BÁO',1083,198,8);c.note('DỪNG CẦM CHỪNG',1083,210,8);c.extra += [ellipse(1082,230,12),line([[1076,224],[1086,230],[1076,236]],closed=True,fill=INK)]
  c.W('cluster-power','meter.out','cluster.power','Bl',[(785,ky),(785,177)])
  c.W('mil-cluster','ecm.mil','cluster.mil','W/Bu',[(943,208)])
  c.W('speed-cluster','ecm.speed','cluster.speed','P/G',[(979,245)])
  c.G('cluster-ground',1193,293);c.W('cluster-return','cluster.ground','cluster-ground.in','G',[(1193,244)])
  c.C('vs','sensor',1207,503,58,58,'',[('pulse',1250,503),('vcc',1225,503)],caption=False)
  c.C('vs-rotor','rotor',1205,569,64,61,'',caption=False,sym='rotor');c.note('CẢM BIẾN VS',1235,650,12)
  c.W('vs-pulse','cluster.pulse','vs.pulse','Bl/R',[(1250,177)]);c.W('vs-vcc','cluster.vcc','vs.vcc','Bl/Bu',[(1225,208)])
  c.C('tp','sensor',964,547,84,44,'',[('vcc',976,547),('signal',1007,547),('ground',1038,547)],sym='tp');c.note('CẢM BIẾN TP',1006,617,12)
  c.C('ect','sensor',1089,547,71,44,'',[('ground',1099,547),('signal',1149,547)],sym='thermistor');c.note('CẢM BIẾN ECT',1124,617,12)
  c.J('sensor-ground',1099,496,12,PALETTE['Gr']);c.W('sensor-ground','ecm.sg','sensor-ground.n','Gr',label=False);c.W('ect-ground','sensor-ground.n','ect.ground','Gr',label=False);c.W('tp-ground','sensor-ground.n','tp.ground','Gr',[(1038,496)])
  c.W('tp-vcc','ecm.tp-vcc','tp.vcc','Y/O');c.W('tp-signal','ecm.ignition','tp.signal','Y/Bu');c.W('ect-signal','ecm.ect','ect.signal','P/W')
 else:
  c.C('stand','switch',362,515,70,40,'CÔNG TẮC\nCHÂN CHỐNG NGHIÊNG',[('in',362,538),('out',432,538)])
  c.W('stand-feed','ecm.stand','stand.in','Bu',[(313,538)]);c.W('stand-return','ecm.lg','stand.out','G/Bl',[(485,538)])
  fuse(c,'backup',208,205,'CẦU CHÌ (7,5A) BACK UP');c.J('battery-tap',154,205,12,PALETTE['R']);c.W('backup-input','battery.pos','battery-tap.n','R',label=False);c.W('backup-fuse','battery-tap.n','backup.in','R')
  c.C('scu','scu',848,262,140,96,'SCU',[('ign',848,287,'2'),('battery',848,333,'1'),('start',988,287,'15'),('ecm-start',988,333,'19')])
  c.J('meter-bus',794,287,12,INK);c.J('brake-out',998,238,12,PALETTE['G']);c.W('meter-bus','meter.out','meter-bus.n','Bl');c.W('scu-ign','meter-bus.n','scu.ign','Bl',label=False)
  c.W('backup-scu','backup.out','scu.battery','R',[(323,205),(323,333)])
  c.C('front-brake','switch',879,148,63,35,'CÔNG TẮC PHANH TRƯỚC',[('in',879,168),('out',942,168)])
  c.C('rear-brake','switch',879,219,63,36,'CÔNG TẮC PHANH SAU',[('in',879,238),('out',942,238)],sym='push-switch')
  for cid,yy,co in [('front',168,'Bl/Br'),('rear',238,'Bl')]:
   c.W(cid+'-feed','meter-bus.n',cid+'-brake.in',co,[(794,yy)]);c.W(cid+'-out',cid+'-brake.out','brake-out.n','G/Y',[(998,yy)])
  connector(c,'start-6p',1028,178,[('start',202,'G/Y','Y/G')],label='6P / Bl')
  c.C('start-switch','switch',1099,180,72,38,'CÔNG TẮC\nKHỞI ĐỘNG',[('in',1099,202),('out',1171,202)])
  connector(c,'start-8p',1092,264,[('start',287,'Y','G')],label='8P / Gr')
  c.W('brake-connector','brake-out.n','start-6p.start-in','G/Y',[(998,202)])
  c.W('connector-switch','start-6p.start-out','start-switch.in','Y/G')
  c.W('start-return','start-switch.out','start-8p.start-out','G',[(1198,202),(1198,287)])
  c.W('start-scu','start-8p.start-in','scu.start','Y');c.W('scu-ecm','scu.ecm-start','ecm.scu-start','Y/G',[(1039,333)])
  legend(c,['6P / Bl : Đầu nối 6 chân, màu đen','8P / Gr : Đầu nối 8 chân, màu xám'],13,633,230)
 done(c)

def smartkey():
 c=Circuit(11,'Sơ đồ nguyên lý hệ thống khóa thông minh (Smartkey)','smartkey',True)
 c.C('battery','battery',59,170,60,44,terms=[('neg',69,170),('pos',108,170)]);c.G('battery-ground',39,190,w=20)
 fuse(c,'backup',146,88,'CẦU CHÌ (7,5A) BACK UP',53);fuse(c,'main-fuse',146,141,'CẦU CHÌ (20A) MAIN',53)
 c.J('positive',108,141,10,PALETTE['R']);c.J('backup-out',263,88,10,PALETTE['R'])
 c.W('battery-ground','battery.neg','battery-ground.in','G',[(69,143),(39,143)],label=(54,135))
 c.W('battery-positive','battery.pos','positive.n','R',label=False);c.W('backup-feed','positive.n','backup.in','R',[(108,88)])
 c.W('main-feed','positive.n','main-fuse.in','R');c.W('backup-output','backup.out','backup-out.n','R')
 left=[('battery',310,222,'1 B+'),('sol-plus',310,313,'4 SOL+'),('sol-minus',310,337,'5 SOL-'),('knob',310,430,'6 KNOB SW'),('ground',310,468,'3 GND'),('ign',310,671,'2 MAIN SW'),('start',310,867,'15 START SW'),('entry',310,958,'14 ENTRY MODE')]
 right=[('smart-ind',488,222,'SMART IND 7'),('alarm-ind',488,269,'ALARM IND 16'),('left',488,361,'WINKER L 8'),('right',488,418,'WINKER R 9'),('buzzer-plus',488,669,'BUZZER+ 12'),('buzzer-minus',488,688,'BUZZER- 13'),('imoid',488,751,'IMOID 10'),('imoau',488,774,'IMOAU 11'),('ecm-start',488,798,'ENG START 19')]
 c.C('scu','scu',310,187,178,843,'',left+right,pinCount=21);c.note('BỘ ĐIỀU KHIỂN THÔNG MINH',392,162,14);c.note('(SCU)',394,179,15)
 for e in c.cg['scu']:
  if e['kind']=='text':e['size']=9
 c.W('scu-battery','backup-out.n','scu.battery','R',[(263,222)])
 c.C('lock','assembly',117,298,103,295,'',caption=False,fill='#a5dbb4');c.note('KHÓA TAY LÁI THÔNG MINH',178,289,13)
 owned(c,'lock',[rect(117,298,103,295,'#a5dbb4')])
 c.C('solenoid','solenoid',145,313,40,25,'CUỘN DÂY',[('plus',185,313),('minus',185,337)],caption=False,parentId='lock')
 owned(c,'solenoid',[line([[185,313],[145,313],[145,322]]),coil(145,334,40,8,4),line([[185,334],[185,337]])]);c.note('CUỘN DÂY',168,354,10)
 c.C('knob','switch',144,402,66,40,'CÔNG TẮC NÚM',[('in',144,430),('out',210,430)],sym='push-switch',parentId='lock')
 c.C('key','switch',137,525,64,40,'KHÓA ĐIỆN',[('in',137,547),('out',201,547)],parentId='lock');c.cg['key']=[e for e in c.cg['key'] if e.get('kind')!='text'];c.note('KHÓA ĐIỆN',169,579,10)
 c.J('lock-ground',260,468,10,INK);c.G('lock-ground-symbol',260,498,w=20)
 c.W('sol-plus','scu.sol-plus','solenoid.plus','Bl');c.W('sol-minus','scu.sol-minus','solenoid.minus','Bl')
 c.W('knob-signal','scu.knob','knob.out','Bl');c.W('knob-return','knob.in','lock-ground.n','Bl',[(129,430),(129,465)],label=False)
 c.W('scu-ground','scu.ground','lock-ground.n','G/Bl');c.W('lock-ground','lock-ground.n','lock-ground-symbol.in','G/Bl')
 c.W('key-main','main-fuse.out','key.in','R/W',[(237,141),(237,244),(63,244),(63,547)],label=(92,538))
 fuse(c,'meter',146,635,'CẦU CHÌ (7,5A) METER',54)
 c.J('ign-bus',77,671,10,INK);c.W('key-meter','key.out','meter.out','Bl/W',[(272,547),(272,635)],label=(245,627))
 c.W('meter-bus','meter.in','ign-bus.n','Bl',[(77,635)]);c.W('scu-ign','ign-bus.n','scu.ign','Bl')
 c.C('cluster','cluster',556,187,113,117,'CỤM ĐỒNG HỒ',[('smart',556,222,'15'),('alarm',556,269,'10'),('battery',669,213,'8'),('ground',669,265,'6')])
 c.note('ĐÈN BÁO HỆ THỐNG',613,205,7);c.note('KHÓA THÔNG MINH',613,214,7);c.note('ĐÈN BÁO ĐỘNG',613,257,8)
 for yy in [232,284]:c.extra += [ellipse(615,yy,12),line([[609,yy-6],[619,yy],[609,yy+6]],closed=True,fill=INK)]
 c.J('battery-trunk',715,213);c.W('cluster-battery','backup-out.n','battery-trunk.n','R',[(715,88)],label=(690,204));c.W('cluster-battery-in','battery-trunk.n','cluster.battery','R',label=False)
 c.W('scu-smart-ind','scu.smart-ind','cluster.smart','Gr/Bl');c.W('scu-alarm-ind','scu.alarm-ind','cluster.alarm','Bl')
 c.G('cluster-ground',693,294,w=20);c.W('cluster-ground','cluster.ground','cluster-ground.in','G',[(693,265)])
 c.C('front-lamps','connectorBox',571,335,97,104,'CỤM ĐÈN TRƯỚC',[('left',571,361,'L'),('right',571,418,'R'),('battery',668,361,'B+'),('ground',668,418,'GND')],fill=GREY)
 c.W('front-battery','battery-trunk.n','front-lamps.battery','R',[(715,361)]);c.G('front-ground',688,445,w=20);c.W('front-ground','front-lamps.ground','front-ground.in','G/W',[(688,418)])
 for yy in [374,426]:c.extra += [ellipse(623,yy,12),line([[617,yy-6],[627,yy],[617,yy+6]],closed=True,fill=INK)]
 c.J('left-split',545,361,10,PALETTE['O']);c.J('right-split',518,418,10,PALETTE['Lb'])
 c.W('left-scu','scu.left','left-split.n','O');c.W('left-front','left-split.n','front-lamps.left','O',label=False)
 c.W('right-scu','scu.right','right-split.n','Lb');c.W('right-front','right-split.n','front-lamps.right','Lb',label=False)
 for cid,yy,x,ref,co,cap in [('left',496,545,'left-split.n','O','ĐÈN XI NHAN TRÁI PHÍA SAU'),('right',586,518,'right-split.n','Lb','ĐÈN XI NHAN PHẢI PHÍA SAU')]:
  led(c,cid+'-rear',602,yy-8,64,28,'',[('feed',602,yy),('ground',602,yy+12)])
  c.note(cap,624,yy-18,9);c.G(cid+'-rear-ground',562,yy+47,w=20)
  c.W(cid+'-rear-feed',ref,cid+'-rear.feed',co,[(x,yy)])
  connector(c,cid+'-rear-connector',584,yy+6,[('ground',yy+12,'G/W','G')],label='')
  c.W(cid+'-rear-return',cid+'-rear.ground',cid+'-rear-connector.ground-out','G',label=False)
  c.W(cid+'-rear-ground',cid+'-rear-connector.ground-in',cid+'-rear-ground.in','G/W',[(562,yy+12)])
 c.C('buzzer','buzzer',631,646,32,53,'CÒI BÁO',[('plus',631,669),('minus',631,688)],sym='speaker')
 c.W('buzzer-plus','scu.buzzer-plus','buzzer.plus','Bu');c.W('buzzer-minus','scu.buzzer-minus','buzzer.minus','G')
 c.C('ecm','ecm',574,728,99,92,'',[('imoid',574,751,'A34 IMOID'),('imoau',574,774,'A6 IMOAU'),('start',574,798,'A35 ST-SW')])
 c.note('ECM',650,785,20)
 for tid,co in [('imoid','W'),('imoau','Gr/Bl')]:c.W('ecm-'+tid,'scu.'+tid,'ecm.'+tid,co)
 c.W('ecm-start','scu.ecm-start','ecm.start','Y/G')
 c.C('front-brake','switch',144,701,51,28,'CÔNG TẮC PHANH TRƯỚC',[('in',144,718),('out',195,718)])
 c.C('rear-brake','switch',144,764,51,27,'CÔNG TẮC PHANH SAU',[('in',144,781),('out',195,781)],sym='push-switch')
 c.J('brake-feed',77,718,10,INK);c.J('brake-out',272,781,10,INK);c.J('start-feed',77,867,10,INK)
 c.W('brake-bus','ign-bus.n','brake-feed.n','Bl',label=False)
 c.W('front-feed','brake-feed.n','front-brake.in','Bl/Br');c.W('rear-feed','brake-feed.n','rear-brake.in','Bl',[(77,781)])
 c.W('front-out','front-brake.out','brake-out.n','G/Y',[(272,718)]);c.W('rear-out','rear-brake.out','brake-out.n','G/Y',label=False)
 c.W('brake-start','brake-out.n','start-feed.n','G/Y',[(272,819),(77,819)],label=(218,812))
 c.C('start-switch','switch',144,849,51,28,'CÔNG TẮC KHỞI ĐỘNG',[('in',144,867),('out',195,867)])
 connector(c,'start-8p',248,854,[('start',867,'G','Y')],label='8P / Gr')
 c.W('start-feed','start-feed.n','start-switch.in','Y/G');c.W('start-connector','start-switch.out','start-8p.start-in','G');c.W('start-scu','start-8p.start-out','scu.start','Y')
 c.C('inspection','connector',187,951,19,26,'',[('entry',206,958)],caption=False,connectorLabel='Đầu nối kiểm tra')
 owned(c,'inspection',[rect(187,951,6,26,'white','#e7738d',1),rect(199,951,7,26,'white','#e7738d',1),line([[187,958],[180,958],[180,971],[187,971]],'#e7738d',1)])
 c.note('ĐẦU NỐI KIỂM TRA',205,934,10);c.note('BỘ TIẾP HỢP KIỂM TRA',121,971,9)
 c.W('inspection-entry','inspection.entry','scu.entry','Bl/G')
 c.extra += [rect(399,910,87,25,'white'),text('LF ANTENNA',442,927,10),rect(399,946,87,25,'white'),text('RF UNIT',442,963,10)]
 c.C('fob','remote',556,842,55,139,'',caption=False,illustration=True)
 owned(c,'fob',[rect(556,842,55,139,'#333333',width=2),rect(563,850,41,122,'#555555'),ellipse(583,876,10,fill='#555555'),rect(570,900,26,24,'#555555'),ellipse(583,945,10,fill='#555555'),ellipse(567,858,2,fill='#65bd83'),line([[575,883],[591,869]],'#888888',2),rect(576,907,14,11,'#555555','#888888',1),line([[575,950],[591,936]],'#888888',2)])
 c.note('THIẾT BỊ ĐIỀU KHIỂN',584,999,12);c.note('FOB',584,1024,22)
 c.extra += [line([[510,905],[544,870]],INK,3),line([[510,905],[516,888],[527,899]],INK,2),line([[544,924],[510,956]],INK,3),line([[510,956],[517,940],[528,950]],INK,2)]
 pinout(c,'scu-21p',306,1053,180,124,7,3,list(range(1,22)),title='ĐẦU NỐI 21P SCU\n(ĐẦU CỰC LỒI PHÍA SCU)')
 done(c)

def pgmfi():
 c=Circuit(12,'Sơ đồ nguyên lý hệ thống phun xăng điện tử (PGM-FI)','pgm-fi',True)
 c.C('battery','battery',91,240,52,39,terms=[('neg',100,240),('pos',133,240)]);c.G('battery-ground',33,205,w=20)
 c.W('battery-ground','battery.neg','battery-ground.in','G',[(100,162),(33,162)],label=(63,155))
 fuse(c,'backup',183,65,'CẦU CHÌ (7,5A) BACK UP',34);fuse(c,'main-fuse',183,105,'CẦU CHÌ (20A) MAIN',34)
 c.J('positive',133,105,9,PALETTE['R']);c.J('main-bus',270,105,9,PALETTE['R']);c.J('key-bus',431,105,9,INK)
 c.W('battery-positive','battery.pos','positive.n','R',label=False);c.W('backup-feed','positive.n','backup.in','R',[(133,65)])
 c.W('main-feed','positive.n','main-fuse.in','R');c.W('main-bus','main-fuse.out','main-bus.n','R/W',label=False)
 c.C('key','switch',331,91,41,23,'CÔNG TẮC MÁY',[('in',331,105),('out',372,105)])
 c.C('main-relay','relay',324,138,55,73,'RƠ LE CHÍNH',[('contact-in',324,195),('contact-out',379,195),('coil-in',324,151),('coil-out',379,151)])
 fuse(c,'fi',507,105,'CẦU CHÌ (7,5A) FI',34);fuse(c,'meter',507,151,'CẦU CHÌ (7,5A) METER',34);fuse(c,'pump-fuse',507,195,'CẦU CHÌ (7,5A) F/P, INJ',34)
 starter(c,495,225,58,71,(237,262,248,284))
 left=[('ground',285,294,'B2 N(-)'),('ckp-pcb',285,329,'A25 PCB'),('ckp-vout',285,349,'A9 VOUT'),('ckp-ground',285,369,'A10 P-GND'),('ckp-ihu',285,391,'A23 IHU'),('ckp-ihv',285,412,'A24 IHV'),('ckp-ihw',285,433,'A26 IHW'),('tp-vcc',285,472,'A13 VCC'),('tp',285,497,'A36 THR'),('sg',285,522,'A12 SG'),('ect',285,562,'A37 TW'),('iat',285,642,'A38 TA'),('oxygen',285,751,'A33 O₂'),('kline',285,818,'A22 K-LINE'),('scs',285,837,'A21 SCS'),('lg',285,857,'A11 LG'),('idle-switch',285,931,'A20 ID-SW'),('stand',285,982,'A39 SS-SW')]
 right=[('starter-y',427,283,'S/RELAY A32'),('starter-r',427,313,'P(+) B1'),('power',427,346,'BATT A8'),('pump',427,391,'F-PUMP A4'),('ignition',427,442,'IGN A27'),('solv',427,537,'SOLV A1'),('injector',427,610,'INJ A5'),('acg-u',427,688,'U-PHASE C3'),('acg-v',427,734,'V-PHASE C2'),('acg-w',427,779,'W-PHASE C1'),('imoau',427,830,'IMOAU A6'),('imoid',427,854,'IMOID A34'),('start',427,870,'ST-SW A35'),('mil',427,943,'M-TXD A3'),('speed',427,992,'SP-SE A7')]
 c.C('ecm','ecm',285,271,142,753,'',left+right,pinCount=39,connectorBanks=['A39P','B5P','C3P']);c.note('ECM',388,490,20);c.note('(33-2)',391,472,9)
 for e in c.cg['ecm']:
  if e['kind']=='text':e['size']=9
 c.J('fi-bus',672,284,9,INK);c.J('fi-load',672,346,9,INK);c.J('engine-bus',638,391,9,INK);c.J('engine-top',638,195,9,INK);c.J('meter-bus',695,833,9,INK);c.J('backup-bus',717,870,9,PALETTE['R'])
 c.W('main-key','main-bus.n','key.in','R/W');c.W('main-relay-input','main-bus.n','main-relay.contact-in','R/W',[(270,195)],label=False)
 c.W('key-bus','key.out','key-bus.n','Bl/W');c.W('fi-input','key-bus.n','fi.in','Bl/W');c.W('meter-input','key-bus.n','meter.in','Bl/W',[(431,151)],label=False)
 c.W('relay-coil','key-bus.n','main-relay.coil-out','Bl/W',[(431,151)],label=False)
 c.G('relay-ground',299,166,w=18);c.W('relay-ground','main-relay.coil-in','relay-ground.in','G/W',[(299,151)],label=False)
 c.W('fi-feed','fi.out','fi-bus.n','Bl/R',[(672,105)],label=(598,98));c.W('fi-down','fi-bus.n','fi-load.n','Bl/R',label=False);c.W('ecm-power','fi-load.n','ecm.power','Bl/R')
 c.W('starter-fi','fi-bus.n','starter-relay.coil-out','Bl/R');c.W('starter-y','starter-relay.coil-in','ecm.starter-y','Y',[(464,284),(464,283)],label=False)
 c.W('starter-r','starter-relay.contact-out','ecm.starter-r','R/Y',[(590,248),(590,313)])
 c.W('starter-battery','battery.pos','starter-relay.battery','R',[(145,205),(200,205),(200,262)],label=(280,254))
 c.W('starter-feed','main-relay.contact-out','starter-relay.contact-in','Bl/Bu',[(452,195),(452,237)])
 c.W('pump-fuse-feed','main-relay.contact-out','pump-fuse.in','Bl/Bu',label=False);c.W('engine-feed','pump-fuse.out','engine-top.n','Bl/R');c.W('engine-bus','engine-top.n','engine-bus.n','Bl/R',label=False)
 c.W('meter-feed','meter.out','meter-bus.n','Bl',[(695,151)],label=(581,144));c.W('backup-feed-bus','backup.out','backup-bus.n','R',[(717,65)],label=(301,58))
 c.W('ecm-ground','battery.neg','ecm.ground','G',[(78,203),(61,203),(61,294)],label=(217,287))
 ckports=[('pcb',146,329),('vout',146,349),('ground',146,369),('ihu',146,391),('ihv',146,412),('ihw',146,433)]
 sensor6(c,126,320,20,122,ckports,label='');c.note('CẢM BIẾN CKP',77,392,10);c.note('(52-1,52-2)',78,373,9)
 for tid,_,yy in ckports:
  co={'pcb':'Bu/Y','vout':'Br/Bl','ground':'G','ihu':'W/R','ihv':'W/Bu','ihw':'W/Bl'}[tid]
  c.W('ckp-'+tid,'ckp.'+tid,'ecm.ckp-'+tid,co,label=(211,yy-6))
 c.C('tp','sensor',107,464,39,69,'',[('vcc',146,472),('signal',146,497),('ground',146,522)],caption=False,fill=PALE)
 c.cg['tp'] += [dict(zigzag(124,475,8,42,5),owner='tp',role='symbol'),dict(line([[146,497],[126,497],[133,491]]),owner='tp',role='symbol')]
 c.note('CẢM BIẾN TP',63,514,10);c.note('(8-1,8-2)',64,487,9)
 for cid,sy,gy,top,label,dtc in [('ect',562,603,554,'ECT','(7-1,7-2)'),('iat',642,683,634,'IAT','(9-1,9-2)')]:
  c.C(cid,'sensor',112,top,30,58,'',[('signal',142,sy),('ground',142,gy)],caption=False,fill=PALE)
  c.cg[cid] += [dict(zigzag(127,top+10,8,37,4),owner=cid,role='symbol'),dict(line([[116,top+12],[138,top+46]]),owner=cid,role='symbol')]
  c.note('CẢM BIẾN '+label,63,top+43,10);c.note(dtc,64,top+16,9)
 c.C('oxygen','sensor',107,719,49,50,'',[('ground',156,731),('signal',156,751)],caption=False,fill=PALE)
 c.cg['oxygen'] += [dict(line([[118,758],[144,758],[144,734]]),owner='oxygen',role='symbol'),dict(line([[127,751],[127,763],[137,744],[137,757]]),owner='oxygen',role='symbol')]
 c.note('CẢM BIẾN OXY',61,759,10);c.note('(21-1,22-1)',66,734,9)
 c.J('sensor-ground',206,522,10,PALETTE['Gr']);c.J('ect-ground',206,603,10,PALETTE['Gr']);c.J('iat-ground',206,683,10,PALETTE['Gr'])
 c.W('tp-vcc','tp.vcc','ecm.tp-vcc','Y/O');c.W('tp-signal','tp.signal','ecm.tp','Y/Bu');c.W('sensor-ground-feed','ecm.sg','sensor-ground.n','Gr')
 c.W('tp-ground','tp.ground','sensor-ground.n','Gr',label=False);c.W('sensor-ground-ect','sensor-ground.n','ect-ground.n','Gr',label=False);c.W('sensor-ground-iat','ect-ground.n','iat-ground.n','Gr',label=False)
 c.W('ect-ground','ect.ground','ect-ground.n','Gr');c.W('iat-ground','iat.ground','iat-ground.n','Gr');c.W('oxygen-ground','oxygen.ground','iat-ground.n','Gr',[(206,731)])
 c.W('ect-signal','ect.signal','ecm.ect','P/W');c.W('iat-signal','iat.signal','ecm.iat','W/G');c.W('oxygen-signal','oxygen.signal','ecm.oxygen','Bl')
 c.C('fuel-pump','pump',505,376,33,32,'BƠM XĂNG',[('control',505,391),('power',538,391)],sym='pump')
 c.W('pump-control','ecm.pump','fuel-pump.control','Br/Y');c.W('pump-power','fuel-pump.power','engine-bus.n','Bl/R')
 c.C('ignition-coil','ignitionCoil',511,441,22,31,'',[('control',515,441),('power',529,441),('ht',522,472)],sym='ignition-coil')
 c.C('spark-plug','sparkPlug',514,472,17,44,'',[('ht',522,472)],sym='spark-plug');c.note('MÔ-BIN SƯỜN',584,478,10);c.note('(91-1)',588,462,9);c.note('BUGI',537,499,9)
 c.J('coil-power',638,442,9,INK);c.W('engine-coil-bus','engine-bus.n','coil-power.n','Bl/R',label=False)
 c.W('coil-power','coil-power.n','ignition-coil.power','Bl/R',[(529,442)],label=(587,436))
 c.W('ignition-control','ecm.ignition','ignition-coil.control','Y/Bu',[(498,442),(498,441)],label=(467,435));c.W('coil-ht','ignition-coil.ht','spark-plug.ht','',width=1)
 c.C('solenoid','valve',512,540,25,46,'',[('control',519,540),('power',533,540)],sym='valve');c.note('VAN TỪ CẦM CHỪNG NHANH',579,584,9);c.note('(82-1)',576,556,9)
 c.J('solenoid-power',638,537,9,INK);c.W('engine-solenoid-bus','coil-power.n','solenoid-power.n','Bl/R',label=False)
 c.W('solenoid-power','solenoid-power.n','solenoid.power','Bl/R',[(533,537)]);c.W('solenoid-control','ecm.solv','solenoid.control','O/Bl',[(519,537)])
 c.C('injector','injector',512,613,28,43,'',[('control',519,613),('power',533,613)],sym='injector');c.note('KIM PHUN',581,644,10);c.note('(12-1)',582,629,9)
 c.J('injector-power',638,610,9,INK);c.W('engine-injector-bus','solenoid-power.n','injector-power.n','Bl/R',label=False)
 c.W('injector-power','injector-power.n','injector.power','Bl/R',[(533,610)]);c.W('injector-control','ecm.injector','injector.control','P/Bu',[(519,610)])
 acg(c,493,696,57,84,[('u',546,688),('v',493,734),('w',546,779)])
 for tid,co in [('u','R/Y'),('v','R/W'),('w','R/Bu')]:c.W('acg-'+tid,'ecm.acg-'+tid,'acg.'+tid,co)
 c.C('dlc','connector',113,790,17,75,'',[('power',130,800),('kline',130,818),('scs',130,837),('lg',130,857)],caption=False,connectorLabel='6P / R')
 owned(c,'dlc',[rect(113,790,5,75,'white','#e7738d',1),rect(124,790,6,75,'white','#e7738d',1),line([[113,805],[105,805],[105,850],[113,850]],'#e7738d',1)])
 c.note('DLC',126,784,12);c.note('6P / R',126,881,9)
 c.J('dlc-power',672,800,9,INK);c.W('fi-dlc-bus','fi-load.n','dlc-power.n','Bl/R',label=False);c.W('dlc-power','dlc-power.n','dlc.power','Bl/R')
 for tid,co in [('kline','O/W'),('scs','Br'),('lg','G/Bl')]:c.W('dlc-'+tid,'dlc.'+tid,'ecm.'+tid,co)
 c.C('scs-adapter','connector',68,837,30,18,'',[('signal',98,837)],caption=False,illustration=True)
 owned(c,'scs-adapter',[rect(68,837,30,18,'white','#e7738d',1)]);c.note('ĐẦU NỐI SCS',63,829,9);c.W('scs-adapter','scs-adapter.signal','dlc.scs','',width=1)
 c.J('logic-ground',239,857,10,PALETTE['G']);c.J('logic-bus',69,931,10,PALETTE['G'])
 c.W('logic-ground','ecm.lg','logic-ground.n','G/Bl',label=False);c.W('logic-bus','logic-ground.n','logic-bus.n','G/Bl',[(239,892),(69,892)],label=(170,885))
 c.C('idle-switch','switch',151,920,40,23,'CÔNG TẮC DỪNG CẦM CHỪNG',[('ground',151,931),('signal',191,931)])
 c.C('stand','switch',151,971,40,23,'CÔNG TẮC CHỐNG NGHIÊNG',[('ground',151,982),('signal',191,982)])
 c.W('idle-ground','logic-bus.n','idle-switch.ground','G/Bl');c.W('idle-signal','idle-switch.signal','ecm.idle-switch','Bl/Bu')
 c.W('stand-ground','logic-bus.n','stand.ground','G/Bl',[(69,982)]);c.W('stand-signal','stand.signal','ecm.stand','Bu')
 c.C('scu','scu',506,814,106,74,'',[('imoau',506,830,'11'),('imoid',506,854,'10'),('start',506,870,'19'),('ign',612,833,'2'),('battery',612,870,'1')]);c.note('BỘ ĐIỀU KHIỂN',559,846,7);c.note('THÔNG MINH',559,855,7);c.note('(SCU)',559,866,8)
 c.W('scu-imoau','ecm.imoau','scu.imoau','Gr/Bl');c.W('scu-imoid','ecm.imoid','scu.imoid','W');c.W('scu-start','ecm.start','scu.start','Y/G')
 c.W('scu-ign','meter-bus.n','scu.ign','Bl');c.W('scu-battery','backup-bus.n','scu.battery','R')
 c.C('cluster','cluster',496,925,142,154,'CỤM ĐỒNG HỒ',[('mil',496,943,'12'),('speed',496,992,'5'),('pulse',496,1041,'11'),('vcc',496,1060,'2'),('power',638,943,'16'),('battery',638,996,'8'),('ground',638,1050,'6')])
 c.W('cluster-mil','ecm.mil','cluster.mil','W/Bu');c.W('cluster-speed','ecm.speed','cluster.speed','P/G')
 c.W('cluster-power','meter-bus.n','cluster.power','Bl',[(695,943)]);c.W('cluster-battery','backup-bus.n','cluster.battery','R',[(717,996)])
 c.G('cluster-ground',650,1082,w=20);c.W('cluster-ground','cluster.ground','cluster-ground.in','G',[(650,1050)])
 for yy,txt in [(951,'ĐÈN BÁO LỖI'),(990,'ĐÈN BÁO IDLING STOP'),(1048,'CẢNH BÁO NHIỆT ĐỘ ĐỘNG CƠ')]:
  c.note(txt,568,yy-17,7);c.extra += [ellipse(568,yy,11),line([[562,yy-5],[572,yy],[562,yy+5]],closed=True,fill=INK)]
 c.C('vs','sensor',146,1036,20,28,'',[('pulse',166,1041),('vcc',166,1060)],caption=False)
 c.C('vs-rotor','rotor',98,1035,30,33,'',caption=False,sym='rotor');c.note('CẢM BIẾN VS',128,1024,10);c.note('(11-1)',128,1008,9)
 c.W('vs-pulse','vs.pulse','cluster.pulse','Bl/R');c.W('vs-vcc','vs.vcc','cluster.vcc','Bl/Bu')
 pinout(c,'ecm-39p',282,1134,190,79,13,3,list(range(13,0,-1))+list(range(26,13,-1))+list(range(39,26,-1)),title='ĐẦU NỐI 39P (A) ECM\n(BÊN ECM ĐẦU CỰC DƯƠNG)')
 c.C('ecm-bc','pinout',514,1142,184,76,'',caption=False)
 e=[rect(516,1142,94,76,'white'),rect(614,1142,84,76,'white')]
 for label,xx,yy in [('B2',542,1142),('B1',591,1142),('B3',513,1174),('B5',513,1193),('B4',540,1218),('C2',666,1142),('C3',698,1174),('C1',698,1193)]:
  e += [line([[xx if label not in ('B3','B5','C3','C1') else xx-5,yy],[xx+15,yy]],width=1),text(label,xx,yy-5,9)]
 owned(c,'ecm-bc',e);c.note('ĐẦU NỐI 3P/5P (ĐEN) ECM',607,1236,11);c.note('(BÊN ECM ĐẦU CỰC DƯƠNG)',607,1252,10)
 legend(c,['( ) : DTC / MÃ MIL','ĐỘNG CƠ KHÔNG KHỞI ĐỘNG','NẾU CÓ HƯ HỎNG','CÁC ĐẦU CỰC NGẮN ĐỂ ĐỌC','DTC / MÃ MIL'],30,1141,234)
 done(c)

def enrich(c):
 # Add source-specific details before rendering; no topology changes are inferred.
 for comp in c.d['components']:
  if comp['type']=='fuse':comp['ratingAmps']=20 if '20A' in comp['label'] else 7.5
 if c.n==6:
  c.cg['headlamp']=[rect(930,209,306,285,'#bce3ec')]
  for tid,yy,lab in [('high',250,'HI BEAM'),('dimmer',286,'DIMMER SW'),('hl',351,'VCC HL'),('position',418,'VCC PO'),('ground',452,'GND PA')]:
   c.cg['headlamp'] += [line([[930,yy],[1015,yy]]),rect(930,yy-8,85,16,'white',width=.8),text(lab,972.5,yy+4,10)]
  owned(c,'headlamp',c.cg['headlamp'])
  c.extra += [line([[1015,250],[1055,250]]),ellipse(1074,351,3,fill=INK)]
  c.extra += [rect(1074,82,95,63,'#777777'),text('ĐÈN BÁO PHA',1121,96,10,fill='white'),line([[1105,117],[1137,117]],'white',2),line([[1116,107],[1130,117],[1116,127]],'white',2,closed=True),line([[1131,106],[1131,128]],'white',2)]
 if c.n in (10,11):
  # The image marks a G section near the cluster and a G/Bl return to ground.
  yy=244 if c.n==10 else 265;gx=1193 if c.n==10 else 693;end=293 if c.n==10 else 294
  wire=next(w for w in c.d['wires'] if w['id']=='cluster-return') if c.n==10 else next(w for w in c.d['wires'] if w['id']=='cluster-ground')
  c.d['wires'].remove(wire);c.J('cluster-ground-junction',gx,yy,10,INK)
  c.W('cluster-ground-G','cluster.ground','cluster-ground-junction.n','G',label=False)
  c.W('cluster-ground-GBl','cluster-ground-junction.n','cluster-ground.in','G/Bl',label=(gx-17,(yy+end)/2))
 if c.n==11:
  next(w for w in c.d['wires'] if w['id']=='left-rear-feed')['labels'][0].update(x=561,y=458)
 if c.n==10:
  # Preserve A27 exactly as printed on this source; PGM-FI prints A36 for TP.
  t=c.T('ecm.ignition');t['id']='tp-signal';t['label']='A27';t['sourceAmbiguity']='TP output labelled A27 here; A36 in supplied PGM-FI page'
  for w in c.d['wires']:
   for end in ('from','to'):
    if w[end]==dict(componentId='ecm',terminalId='ignition'):w[end]['terminalId']='tp-signal'
  c.d['reviewMetadata']['sourceDiscrepancies']=[dict(componentId='ecm',terminalId='tp-signal',sourceLabel='A27',otherSourceLabel='A36',resolution='Preserved each source label; no electrical correction inferred')]
 if c.n==12:
  # Connector shapes and their explicitly visible contacts, independent of the wiring graph.
  e=[rect(514,1142,96,76,'white'),rect(615,1142,83,76,'white')]
  for x,y,w,h in [(522,1147,32,16),(573,1147,30,16),(521,1174,32,12),(574,1174,29,12),(521,1196,32,12),(574,1196,29,12),(624,1147,51,16),(623,1174,52,12),(623,1196,52,12)]:
   e += [rect(x,y,w,h,'white',width=.7),line([[x+3,y+h/2],[x+w-3,y+h/2]],INK,3)]
  for label,x,y in [('B2',538,1136),('B1',591,1136),('B3',508,1183),('B5',508,1204),('B4',546,1220),('C2',650,1136),('C3',716,1183),('C1',716,1204)]:e.append(text(label,x,y,9))
  owned(c,'ecm-bc',e)
  c.extra=[e for e in c.extra if not (e.get('kind')=='text' and e['text']=='MÁY PHÁT/KHỞI ĐỘNG')]
  c.note('MÁY PHÁT/',598,727,10);c.note('KHỞI ĐỘNG',598,740,10)
  for x,y in [(29,373),(26,487),(28,570),(26,650),(20,734),(355,472),(553,462),(541,556),(554,629),(100,1008)]:
   c.extra += [rect(x,y-7,13,11,'#ffff5a',width=.7),line([[x+2,y],[x+2,y-4],[x+9,y-4],[x+11,y-1],[x+11,y+2],[x+2,y+2],[x+2,y]],width=.7)]
  c.extra += [line([[101,369],[109,377]]),line([[101,377],[109,369]])]
 # Long caption text uses less space in the portrait diagrams.
 if c.portrait:
  for e in c.extra:
   if e.get('kind')=='text' and e.get('owner')=='annotation' and len(e['text'])>22 and e['size']>11:e['size']=11

def layout(c):
 from render_schematic import text_box
 from audit_schematics import overlaps, hits_segment
 # Keep annotations inside the canvas, then move only wire labels to clear nearby items.
 fixed=[e for group in c.cg.values() for e in group if e['kind']=='text']+[e for e in c.extra if e['kind']=='text']
 for e in fixed:
  b=text_box(e)
  if b[0]<6:e['x']+=6-b[0]
  if b[2]>c.width-6:e['x']-=b[2]-(c.width-6)
 boxes=[text_box(e) for e in fixed]
 cb=[(q['x'],q['y'],q['x']+q['width'],q['y']+q['height']) for q in c.d['components'] if q['type'] not in ('ground','junction','assembly')]
 segs=[([p['x'],p['y']],[q['x'],q['y']]) for w in c.d['wires'] for p,q in zip(w['points'],w['points'][1:])]
 def clear(e):
  b=text_box(e)
  return b[0]>=4 and b[1]>=4 and b[2]<=c.width-4 and b[3]<=c.height-4 and not any(overlaps(b,x,1) for x in boxes+cb) and not any(hits_segment(b,a,z,4.5 if not c.portrait else 3) for a,z in segs)
 for w in c.d['wires']:
  for e in w['labels']:
   if not clear(e):
    ox,oy=e['x'],e['y'];b=text_box(e);tw=b[2]-b[0];candidates=[]
    for p,q in zip(w['points'],w['points'][1:]):
     if math.dist((p['x'],p['y']),(q['x'],q['y']))<15:continue
     for f in (.5,.25,.75):
      xx=p['x']+(q['x']-p['x'])*f;yy=p['y']+(q['y']-p['y'])*f
      for off in (11,19,27):
       if abs(p['y']-q['y'])<2:cs=[(xx,yy-off),(xx,yy+off+e['size']*.7)]
       else:cs=[(xx+tw/2+off,yy+e['size']*.3),(xx-tw/2-off,yy+e['size']*.3)]
       for x,y in cs:
        trial=dict(e,x=x,y=y)
        if clear(trial):candidates.append((math.hypot(x-ox,y-oy),x,y))
    if candidates:_,e['x'],e['y']=min(candidates)
   boxes.append(text_box(e))

def validate(d):
 errors=[];warnings=[];cs={c['id']:c for c in d['components']}
 if len(cs)!=len(d['components']):errors.append('duplicate component ids')
 ids=[w['id'] for w in d['wires']]
 if len(ids)!=len(set(ids)):errors.append('duplicate wire ids')
 for comp in d['components']:
  ts=comp['terminals'];tids=[t['id'] for t in ts]
  if len(tids)!=len(set(tids)):errors.append('duplicate terminals: '+comp['id'])
 for w in d['wires']:
  for endpoint,index in [('from',0),('to',-1)]:
   ref=w[endpoint];comp=cs.get(ref['componentId']);t=next((t for t in comp['terminals'] if t['id']==ref['terminalId']),None) if comp else None
   if t is None:errors.append(w['id']+': unknown '+endpoint);continue
   p=w['points'][index]
   if math.hypot(t['x']-p['x'],t['y']-p['y'])>.001:errors.append(w['id']+': endpoint does not touch terminal')
  for p in w['points']:
   if not(0<=p['x']<=d['canvas']['width'] and 0<=p['y']<=d['canvas']['height']):errors.append(w['id']+': vertex outside canvas')
 if any(e.get('kind') in ('image','bitmap') for e in d['drawing']['elements']):errors.append('embedded source bitmap')
 # An independent graph traversal groups electrically joined terminals via wires.
 parent={c['id']+'.'+t['id']:c['id']+'.'+t['id'] for c in d['components'] for t in c['terminals']}
 def find(x):
  while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
  return x
 for w in d['wires']:
  a=w['from']['componentId']+'.'+w['from']['terminalId'];b=w['to']['componentId']+'.'+w['to']['terminalId'];parent[find(a)]=find(b)
 groups={}
 for k in parent:groups.setdefault(find(k),[]).append(k)
 from audit_schematics import audit
 layout_warnings=audit(d)['layoutWarnings']
 warnings.extend(layout_warnings)
 return dict(errors=errors,warnings=warnings,sourceDiscrepancies=d['reviewMetadata'].get('sourceDiscrepancies',[]),componentCount=len(cs),wireCount=len(ids),netCount=len(groups),nets=list(groups.values()),checks=dict(uniqueIds=not any('duplicate' in s for s in errors),terminalReferences=not any('unknown' in s for s in errors),wireEndpoints=not any('endpoint' in s for s in errors),verticesInsideCanvas=not any('canvas' in s for s in errors),noEmbeddedSourceBitmaps=True,textInsideCanvas=not any(w.get('kind')=='out-of-canvas' for w in layout_warnings),noOverlappingText=not any(w.get('kind')=='text-text' for w in layout_warnings)))

def main():
 OUT.mkdir(parents=True,exist_ok=True);(OUT/'preview').mkdir(exist_ok=True);(OUT/'source').mkdir(exist_ok=True)
 power();simple_circuits();lighting();ignition();start_idle(9);start_idle(10);smartkey();pgmfi()
 reports=[];entries=[];payload=[];checksums=[]
 for c in sorted(ALL,key=lambda x:x.n):
  enrich(c);layout(c);d=c.finish();name=f'{c.n:02d}. {c.title}';jsonfile=OUT/(name+'.json')
  d['reviewMetadata']['sourceSha256']=hashlib.sha256(c.source.read_bytes()).hexdigest()
  jsonfile.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
  # Always parse the saved artifact before rendering: proves previews are from JSON.
  saved=json.loads(jsonfile.read_text(encoding='utf8'));report=validate(saved)
  if report['errors']:raise ValueError(name+': '+str(report['errors']))
  render(saved,OUT/'preview'/name,2)
  im=Image.open(c.source).convert('RGB')
  if c.portrait:im=im.transpose(Image.Transpose.ROTATE_270)
  im.save(OUT/'source'/(name+'.png'))
  entries.append(dict(number=c.n,title=c.title,json=name+'.json',png='preview/'+name+'.png',svg='preview/'+name+'.svg',source='source/'+name+'.png'))
  reports.append(dict(file=name+'.json',**report,manualReview='All 12 supplied images and generated previews compared visually; symbols redrawn with simplified outlines',targetAppVerified=False))
  payload.append(saved);checksums.append(dict(file=str(c.source.relative_to(ROOT)),sha256=d['reviewMetadata']['sourceSha256'],width=Image.open(c.source).width,height=Image.open(c.source).height,reviewRotationClockwise=90 if c.portrait else 0))
 (OUT/'manifest.json').write_text(json.dumps(dict(vehicle='Honda Vario 2023–2025',circuits=entries),ensure_ascii=False,indent=2),encoding='utf8')
 (OUT/'source-checksums.json').write_text(json.dumps(checksums,ensure_ascii=False,indent=2),encoding='utf8')
 (OUT/'review-report.json').write_text(json.dumps(dict(status='draft',method='manual source transcription; structural JSON and render validation',allStructuralChecksPassed=True,targetAppVerified=False,browserUiTested=False,reviewPageChecks='JavaScript syntax, embedded JSON equality, asset existence and dimensions checked; in-app browser unavailable',electricalSimulationValidated=False,limitations=['Ký hiệu được vẽ lại bằng vector, hình dáng không trùng từng pixel với ảnh nguồn.','Ảnh gốc có watermark; preview dùng nền trắng và không tái tạo watermark.','FOB là hình vector minh họa thay cho ảnh chụp trong sơ đồ Smartkey.','Hai sơ đồ Smartkey và PGM-FI xoay 90 độ theo chiều kim đồng hồ để đọc; sourceTransform lưu phép xoay.','Giắc tham chiếu 21P/39P/5P/3P giữ nhãn/số chân nhìn thấy; đường viền vỏ giắc được giản lược.','Ảnh Idling Stop ghi chân tín hiệu TP là A27; ảnh PGM-FI ghi A36. Giữ nguyên từng ảnh và ghi sourceDiscrepancies, chưa suy đoán sửa chân.','Chưa kiểm thử nhập/xuất trên ứng dụng đích hoặc kiểm chứng điện thực tế.'],circuits=reports),ensure_ascii=False,indent=2),encoding='utf8')
 (OUT/'diagram-renderer.js').write_bytes((ROOT/'web'/'diagram-renderer.js').read_bytes())
 make_review(entries,payload)
 (OUT/'README.md').write_text('''# Vario 2023–2025\n\n12 mạch JSON theo ảnh trong FILE ANH/Vario 2023 - 2025. Mỗi mạch có PNG 2× và SVG dựng từ JSON. Mở review.html để xem ảnh gốc và bản dựng cạnh nhau, hoặc chọn chồng ảnh để kiểm tra sai lệch. Trang mở trực tiếp từ file, không cần mạng.\n\nGiữ schemaVersion=1 và vehicleId/vehicleTitle=thang theo bộ AirBlade để tương thích kiểm tra project hiện tại. Tên xe thật nằm trong vehicleModel. ID các mạch dùng tiền tố vario-2023-2025.\n\nLớp components/wires lưu linh kiện, chân và đường dây; drawing lưu vector chi tiết. Khi chỉnh components/wires cần dựng lại drawing để preview đồng bộ. sourceTransform ghi chiều xoay của hai sơ đồ dọc. Không dùng bitmap ảnh gốc trong drawing.\n\nreview-report.json ghi kiểm tra tham chiếu chân, tọa độ đầu dây, ID và các giới hạn đối chiếu. Trạng thái draft vì chưa kiểm thử ứng dụng đích và chưa kiểm chứng điện thực tế. Màu dây lấy trung vị RGB vùng 3×3 từ ảnh; tọa độ gốc nằm trong colorReference. Trang review đã kiểm tra cú pháp JavaScript và các liên kết file, chưa chạy trong trình duyệt do phiên không có trình duyệt khả dụng. Ảnh Idling Stop ghi chân TP là A27, còn ảnh PGM-FI ghi A36; bộ JSON giữ nguyên nhãn theo từng ảnh, ghi rõ trong sourceDiscrepancies. Đây là bản chép theo ảnh được cung cấp, không phải tài liệu sửa chữa chính hãng.\n\nDựng lại: python tools/build_vario.py\nDựng riêng: python tools/render_schematic.py "File JSON chuẩn/Vario 2023 - 2025/02. Mạch còi.json" --out "review/vario-horn" --scale 2\n''',encoding='utf8')
 archive=ROOT/'review'/'Vario-2023-2025-JSON-preview.zip';archive.parent.mkdir(exist_ok=True)
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
  for f in OUT.rglob('*'):
   if f.is_file():z.write(f,'Vario 2023 - 2025/'+str(f.relative_to(OUT)).replace('\\','/'))
  for f in SRC.glob('*.PNG'):z.write(f,'FILE ANH/Vario 2023 - 2025/'+f.name)
  z.write(Path(__file__),'tools/build_vario.py')
  for f in ['render_schematic.py','schematic_symbols.py','rebuild_airblade.py','audit_schematics.py']:z.write(ROOT/'tools'/f,'tools/'+f)
 print(json.dumps(dict(circuits=len(entries),components=sum(r['componentCount'] for r in reports),wires=sum(r['wireCount'] for r in reports),out=str(OUT),archive=str(archive)),ensure_ascii=True))

def make_review(entries,payload):
 cards=[]
 for i,e in enumerate(entries):
  esc=lambda s:html.escape(s,quote=True)
  cards.append(f'<article id="c{i}"><h2>{e["number"]:02d}. {esc(e["title"])}</h2><nav><a href="{esc(e["json"])}" download>JSON</a><a href="{esc(e["png"])}" download>PNG 2×</a><a href="{esc(e["svg"])}" download>SVG</a><button data-reset="{i}">Dựng lại từ JSON</button><label><input class="overlay" type="checkbox"> Chồng ảnh</label><label class="slider">Độ mờ <input class="opacity" type="range" min="0" max="100" value="50"></label></nav><div class="pair"><figure><figcaption>Ảnh nguồn</figcaption><img class="original" src="{esc(e["source"])}" alt="Ảnh nguồn {esc(e["title"])}"></figure><figure><figcaption>Bản vector dựng từ JSON</figcaption><div class="vector" data-index="{i}"></div></figure></div><details><summary>Chỉnh JSON và dựng preview</summary><p>Thay đổi trong ô này chỉ ảnh hưởng phiên review. Tải JSON đã sửa bằng nút bên dưới.</p><textarea spellcheck="false" data-editor="{i}"></textarea><button data-apply="{i}">Áp dụng và dựng lại</button><button data-download="{i}">Tải JSON đang xem</button><output data-status="{i}"></output></details></article>')
 data=json.dumps(payload,ensure_ascii=False).replace('</','<\\/')
 page='''<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Review JSON Vario 2023–2025</title><style>
 *{box-sizing:border-box}body{margin:0;background:#eef2f6;color:#182a3a;font:15px Arial,sans-serif}header{padding:25px 28px;background:#143d56;color:white}h1{margin:0 0 10px;font-size:27px}header p{margin:8px 0;max-width:1100px;line-height:1.55}main{padding:20px;max-width:1800px;margin:auto}article{background:white;border:1px solid #cad7e0;border-radius:10px;margin-bottom:24px;padding:18px}h2{font-size:19px;margin:0 0 13px}nav{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:12px}a,button{color:#104970;border:1px solid #b7c7d2;background:#f5f9fb;border-radius:5px;padding:7px 12px;text-decoration:none;cursor:pointer}label{display:flex;align-items:center;gap:6px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}figure{margin:0;min-width:0}figcaption{background:#eaf0f4;padding:8px;text-align:center;font-size:13px}img,svg{width:100%;height:auto;display:block}.vector{background:white;overflow:hidden}details{margin-top:14px}summary{cursor:pointer;color:#104970}textarea{width:100%;height:280px;margin:10px 0;font:12px Consolas,monospace}.slider{display:none}article.overlaid .pair{display:block;position:relative}article.overlaid figure+figure{position:absolute;inset:0}article.overlaid figure+figure figcaption{visibility:hidden}article.overlaid .vector{background:transparent}article.overlaid .slider{display:flex}output{margin-left:12px;color:#335f34}footer{padding:18px;color:#526679;font-size:13px}@media(max-width:850px){.pair{grid-template-columns:1fr}main{padding:10px}header{padding:20px}article{padding:12px}}
 </style><header><h1>Vario 2023–2025 · 12 sơ đồ điện</h1><p>Ảnh nguồn bên trái, bản vector dựng trực tiếp từ JSON bên phải. Có thể tải từng JSON, PNG hoặc SVG; chồng ảnh để đối chiếu vị trí dây và ký hiệu.</p><p>Đã kiểm tra cấu trúc và đầu dây. Ký hiệu/vỏ giắc được vẽ lại; FOB là hình minh họa. Ảnh Idling Stop ghi TP A27, ảnh PGM-FI ghi A36; bản JSON giữ nguyên nhãn từng ảnh. Smartkey và PGM-FI được xoay dọc cho dễ đọc. Chưa kiểm thử ứng dụng đích hoặc kiểm chứng điện thực tế.</p></header><main>'''+''.join(cards)+'''</main><footer>Đối chiếu theo ảnh được cung cấp · Xem review-report.json và source-checksums.json để biết kiểm tra và nguồn.</footer><script src="diagram-renderer.js"></script><script id="data" type="application/json">'''+data+'''</script><script>
 const originals=JSON.parse(document.getElementById('data').textContent);const active=structuredClone(originals);
 function renderOne(i){const host=document.querySelector('.vector[data-index="'+i+'"]');host.replaceChildren(SchematicRenderer.render(active[i]));document.querySelector('[data-editor="'+i+'"]').value=JSON.stringify(active[i],null,2);const svg=host.querySelector('svg');svg.querySelector('rect')?.setAttribute('fill','transparent');}
 active.forEach((_,i)=>renderOne(i));
 document.addEventListener('click',e=>{let i;if(e.target.dataset.reset!==undefined){i=+e.target.dataset.reset;active[i]=structuredClone(originals[i]);renderOne(i);}if(e.target.dataset.apply!==undefined){i=+e.target.dataset.apply;try{const d=JSON.parse(document.querySelector('[data-editor="'+i+'"]').value);if(!d.drawing||!Array.isArray(d.drawing.elements))throw Error('Thiếu drawing.elements');active[i]=d;renderOne(i);document.querySelector('[data-status="'+i+'"]').textContent='Đã dựng lại từ JSON.';}catch(err){document.querySelector('[data-status="'+i+'"]').textContent=err.message;}}if(e.target.dataset.download!==undefined){i=+e.target.dataset.download;const u=URL.createObjectURL(new Blob([JSON.stringify(active[i],null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=(i+1).toString().padStart(2,'0')+'. '+active[i].circuitTitle+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}});
 document.querySelectorAll('article').forEach(a=>{const v=a.querySelector('.vector');a.querySelector('.overlay').addEventListener('change',e=>{a.classList.toggle('overlaid',e.target.checked);v.style.opacity=e.target.checked?a.querySelector('.opacity').value/100:1;});a.querySelector('.opacity').addEventListener('input',e=>{v.style.opacity=e.target.value/100;});});
 </script></html>'''
 (OUT/'review.html').write_text(page,encoding='utf8')

if __name__=='__main__':main()
