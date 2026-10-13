"""Transcribe the supplied SH Mode 2023-2025 circuit images into editable JSON.
Source photographs are used only on the review page, never in the JSON renderer.
Run: python tools/build_sh_mode.py
"""
import json, math, hashlib, html, zipfile, statistics
from pathlib import Path
from PIL import Image
from schematic_symbols import library, line, rect, ellipse, text, coil, zigzag
from rebuild_airblade import wire_graphics
from render_schematic import render, flatten
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'FILE ANH'/'SH Mode 2023-2025'
OUT=ROOT/'File JSON chuẩn'/'SH Mode 2023-2025'
PALETTE={'R':'#e21b3b','G':'#0bc45b','Bl':'#333333','W':'#ffffff','Y':'#ffff00','Bu':'#00bee5','Lb':'#96dff0','Br':'#aa9076','Gr':'#a1a4a6','O':'#f59a54','Lg':'#a4d638','P':'#f39daf'}
SYMS=library(); PALE='#ffffa0'; GREY='#d1d1d3'; INK='#454545'
COLOR_INFO=dict(method='median RGB of a 3x3 source-image patch; screenshot/watermark colors, not restoration of original wire paint',samples={})
for code,n,xx,yy in [('R',2,215,345),('G',2,44,366),('Bl',2,870,345),('Br',6,800,273),('Y',3,1102,285),('Lg',2,1048,345),('Lb',3,1102,390),('Bu',7,950,268),('Gr',10,1010,520),('P',7,940,234),('O',12,455,453),('W',6,900,179)]:
 source=sorted(SRC.glob('*.PNG'))[n-1];im=Image.open(source).convert('RGB');ox,oy=(yy,im.height-1-xx) if n==12 else (xx,yy)
 patch=[im.getpixel((px,py)) for px in range(ox-1,ox+2) for py in range(oy-1,oy+2)]
 rgb=[int(statistics.median(v[j] for v in patch)) for j in range(3)];value='#'+''.join(f'{v:02x}' for v in rgb)
 PALETTE[code]=value;COLOR_INFO['samples'][code]=dict(sourceImage=source.name,x=ox,y=oy,patchSize=3,rgb=rgb,hex=value)

class Circuit:
 def __init__(self,n,title,slug,portrait=False):
  self.source=sorted(SRC.glob('*.PNG'))[n-1]; im=Image.open(self.source)
  self.portrait=portrait
  self.width,self.height=im.size if not portrait else (im.height,im.width)
  self.d=dict(schemaVersion=1,reviewStatus='draft',sourceImage=self.source.name,id='sh-mode-2023-2025-'+slug,vehicleId='thang',vehicleTitle='thang',vehicleModel='Honda SH Mode 2023–2025',circuitTitle=title,canvas=dict(width=self.width,height=self.height,background='#ffffff'),components=[],wires=[],sourceCrop=dict(x=0,y=0,width=im.width,height=im.height),sourceTransform=dict(rotateClockwise=90 if portrait else 0),reviewMetadata=dict(vectorPreviewGenerated=True,targetAppVerified=False,electricalSimulationValidated=False,source='supplied SH Mode screenshots',visualReview='manual comparison; see review-report.json'),renderContract='Render drawing.version=1; PNG/SVG are generated from JSON without source-image embedding.')
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
    a,b=ts;e += [line([[a['x'],a['y']],[x+w*.2,a['y']]]),line([[x+w*.8,b['y']],[b['x'],b['y']]]),ellipse(x+w*.2,a['y'],6),ellipse(x+w*.8,b['y'],6),line([[x+w*.28+w*.44*t/40,a['y']-9*math.sin(t/40*math.pi)**2] for t in range(41)])]
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
  if self.n==12:elems+=wire_graphics(next(w for w in self.d['wires'] if w['id']=='dlc-power'),True)
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

def simple_circuits():
 c=Circuit(2,'Mạch còi','horn');c.supply(394,345,273,492,712,'HORN')
 c.C('horn-switch','switch',921,307,87,53,'CÔNG TẮC CÒI',[('in',921,345),('out',1008,345)],sym='push-switch')
 c.C('horn','horn',1124,263,63,88,'CÒI',[('in',1139,345),('out',1170,345)],sym='horn');c.G('horn-ground',1230,416)
 c.W('fuse-switch','load-fuse.out','horn-switch.in','Bl');c.W('switch-horn','horn-switch.out','horn.in','Lg');c.W('horn-ground','horn.out','horn-ground.in','G',[(1230,345)],label=(1205,335));done(c)
 c=Circuit(3,'Mạch xi nhan','turn-signals');c.supply(381,345,211,376,541,'METER,TAIL…')
 c.C('diode','diode',699,329,35,31,'ĐI ỐT',[('in',699,345),('out',734,345)])
 c.C('flasher','flasher',822,317,79,47,'CHỚP XI NHAN',[('in',822,345),('out',901,345)])
 c.C('turn-switch','selectorSwitch',1004,313,67,61,'CÔNG TẮC\nXI NHAN',[('in',1004,345),('left',1071,329),('right',1071,358)])
 c.C('left-lamp','lamp',1152,231,92,58,'ĐÈN XI NHAN TRÁI',[('in',1152,253),('out',1152,269)],sym='bulb');c.G('left-ground',1128,309)
 c.C('right-lamp','lamp',1152,415,92,58,'ĐÈN XI NHAN PHẢI',[('in',1152,435),('out',1152,451)],sym='bulb');c.G('right-ground',1128,491)
 for wid,a,b,co in [('fuse-diode','load-fuse.out','diode.in','Bl/Br'),('diode-flasher','diode.out','flasher.in','Bl'),('flasher-switch','flasher.out','turn-switch.in','Gr/Bu')]:c.W(wid,a,b,co)
 c.W('left-feed','turn-switch.left','left-lamp.in','Y',[(1102,329),(1102,253)],label=(1092,294));c.W('right-feed','turn-switch.right','right-lamp.in','Lb',[(1102,358),(1102,435)],label=(1090,398))
 c.W('left-ground','left-lamp.out','left-ground.in','G',[(1128,269)],label=(1138,294));c.W('right-ground','right-lamp.out','right-ground.in','G',[(1128,451)],label=(1140,477));done(c)
 c=Circuit(4,'Mạch đèn phanh','brake-light');c.supply(400,352,270,486,702,'METER,TAIL…');c.J('brake-feed',909,352);c.J('brake-out',1065,350)
 c.C('front-brake','switch',944,250,86,47,'CÔNG TẮC PHANH TRƯỚC',[('in',944,279),('out',1030,279)])
 c.C('rear-brake','switch',944,398,86,48,'',[('in',944,427),('out',1030,427)]);c.note('CÔNG TẮC PHANH SAU',987,470)
 c.C('brake-lamp','lamp',1148,332,100,61,'ĐÈN PHANH',[('in',1148,350),('out',1148,373)],sym='headlamp');c.G('lamp-ground',1153,456)
 c.W('load-brake-feed','load-fuse.out','brake-feed.n','Bl/Br');c.W('front-brake-feed','brake-feed.n','front-brake.in','Bl/Br',[(909,279)],label=False);c.W('rear-brake-feed','brake-feed.n','rear-brake.in','Bl/Br',[(909,427)],label=False)
 c.W('front-out','front-brake.out','brake-out.n','G/Y',[(1065,279)],label=(1048,358));c.W('rear-out','rear-brake.out','brake-out.n','G/Y',[(1065,427)],label=False);c.W('lamp-feed','brake-out.n','brake-lamp.in','G/Y');c.W('lamp-ground','brake-lamp.out','lamp-ground.in','G',[(1153,373)],label=(1140,420));done(c)
 c=Circuit(5,'Mạch báo xăng','fuel-gauge');c.supply(376,326,278,503,730,'METER,TAIL…')
 c.C('fuel-gauge','gauge',1036,49,143,141,'ĐỒNG HỒ BÁO XĂNG',[('power',1073,190),('ground',1106,190),('signal',1142,190)])
 c.C('fuel-sender','sender',1069,544,119,113,'',[('ground',1106,544),('signal',1142,544)],sym='sender');c.note('PHAO XĂNG',1128,686,18)
 c.J('fuel-ground',1106,389);c.G('gauge-ground',1038,447)
 c.W('gauge-feed','load-fuse.out','fuel-gauge.power','Bl/Br',[(1073,326)],label=(948,316));c.W('gauge-common','fuel-gauge.ground','fuel-ground.n','G/Bl',label=(1071,378));c.W('ground-return','fuel-ground.n','gauge-ground.in','G/Bl',[(1038,389)],label=False);c.W('sender-return','fuel-ground.n','fuel-sender.ground','G/Bl',label=False);c.W('sender-signal','fuel-gauge.signal','fuel-sender.signal','Y/W',label=(1168,386));done(c)
 c=Circuit(7,'Mạch báo tốc độ xe','speed-signal');c.supply(214,165,271,489,708,'METER,TAIL…')
 c.C('cluster','cluster',1079,141,162,259,'CỤM ĐỒNG HỒ',[('power',1079,165,'6'),('vs-in',1079,234,'2'),('vs-return',1079,268,'4'),('ecm-out',1079,321,'3'),('ground',1079,374,'8')])
 c.C('vs-rotor','rotor',625,203,100,100,caption=False,sym='rotor');c.C('vs','sensor',735,205,107,92,'',[('signal',842,234),('return',842,268)]);c.note('CẢM BIẾN VS',790,322,18)
 c.C('ecm','ecm',1073,460,175,144,'ECM',[('speed',1073,533,'A19')]);c.G('cluster-ground',1009,435)
 c.W('cluster-power','load-fuse.out','cluster.power','Bl/Br');c.W('vs-signal','vs.signal','cluster.vs-in','P/G');c.W('vs-return','vs.return','cluster.vs-return','Bu/G');c.W('speed-ecm','cluster.ecm-out','ecm.speed','P/G',[(913,321),(913,533)],label=(1030,522));c.W('cluster-ground','cluster.ground','cluster-ground.in','G/Bl',[(1009,374)],label=(1048,364));
 c.extra += [ellipse(1168,265,46),line([[1140,267],[1178,267]],INK,4)]
 for i in range(9):
  a=math.radians(190+i*20);c.extra.append(line([[1168+39*math.cos(a),265+39*math.sin(a)],[1168+45*math.cos(a),265+45*math.sin(a)]]))
 done(c)

def comb(c,cid,x,y,labels,step=19):
 terms=[('in',x,y)]
 c.C(cid,'loadGroup',x,y,25,(len(labels)-1)*step,terms=terms,caption=False)
 e=[line([[x,y],[x,y+(len(labels)-1)*step]],width=1.5)]
 for i,s in enumerate(labels):e += [line([[x,y+i*step],[x+25,y+i*step]],width=1.5),text(s,x+30,y+i*step+4,11,'start')]
 c.cg[cid]=[dict(v,owner=cid,role='symbol') for v in e]

def power():
 c=Circuit(1,'Mạch cấp nguồn','power')
 c.C('battery','battery',75,342,82,61,terms=[('neg',92,342),('pos',141,342)]);c.G('battery-ground',54,359)
 c.J('positive',141,222);c.J('key-feed',314,222);c.J('main-out',574,223);c.J('key-load',490,401)
 c.W('battery-ground','battery.neg','battery-ground.in','G',[(92,296),(54,296)],label=(73,286));c.W('battery-positive','battery.pos','positive.n','R',label=False)
 c.C('starter-feed','loadGroup',201,280,11,30,'',[('in',201,298)]);c.cg['starter-feed']=[dict(line([[195,293],[208,298],[195,304]],PALETTE['R'],closed=True,fill=PALETTE['R']),owner='starter-feed',role='symbol')];c.note('TIẾP ĐIỂM',246,301);c.note('RƠ LE',246,315);c.note('KHỞI ĐỘNG/SẠC',246,329,12)
 c.W('starter-feed','battery.pos','starter-feed.in','R',[(165,298)],label=(177,291))
 c.C('backup','fuse',200,85,68,30,'CẦU CHÌ (7,5A) BACKUP',[('in',200,100),('out',268,100)])
 comb(c,'backup-loads',345,66,['BỘ ĐIỀU KHIỂN KHÓA THÔNG MINH (SCU)','ĐÈN LED MẶT KHÓA ĐIỆN','CỤM ĐỒNG HỒ'])
 c.J('backup-out',345,100);c.W('backup-input','positive.n','backup.in','R',[(141,100)],label=(168,92));c.W('backup-output','backup.out','backup-out.n','Lg/Bl');c.W('backup-loads','backup-out.n','backup-loads.in','Bl',label=False)
 c.note('Bl',359,80,11)
 c.C('main-fuse','fuse',200,207,68,30,'CẦU CHÌ (20A) MAIN',[('in',200,222),('out',268,222)])
 c.C('main-relay','relay',413,203,68,75,'RƠ LE CHÍNH',[('contact-in',413,222),('contact-out',481,222),('coil-in',413,264),('coil-out',481,264)])
 c.G('relay-ground',374,282);c.W('main-input','positive.n','main-fuse.in','R');c.W('main-tap','main-fuse.out','key-feed.n','R/W',label=False);c.W('main-relay-feed','key-feed.n','main-relay.contact-in','R/W');c.W('relay-ground','main-relay.coil-in','relay-ground.in','G',[(374,264)],label=(393,254))
 c.C('key','switch',387,319,68,96,'KHÓA ĐIỆN',[('in1',387,343),('out1',455,343),('in2',387,401),('out2',455,401)])
 c.W('key-upper-feed','key-feed.n','key.in1','R/W',[(314,343)],label=(347,333));c.W('key-lower-feed','key-feed.n','key.in2','R/W',[(314,401)],label=(346,391))
 c.C('fi','fuse',573,327,68,30,'CẦU CHÌ (7,5A) FI',[('in',573,343),('out',641,343)])
 c.J('fi-output',820,343);comb(c,'fi-loads',957,291,['CUỘN HÚT RƠ LE KHỞI ĐỘNG/SẠC','GIẮC CHẨN ĐOÁN (DLC)','ECM','BỘ ĐIỀU KHIỂN KHÓA THÔNG MINH (SCU)'],18)
 c.W('key-fi','key.out1','fi.in','R/G');c.W('fi-out','fi.out','fi-output.n','Bl/W');c.W('fi-loads','fi-output.n','fi-loads.in','Bl/W',[(957,343)],label=False);c.W('relay-control','fi-output.n','main-relay.coil-out','Bl/W',[(820,264)],label=(654,254))
 c.W('relay-main-out','main-relay.contact-out','main-out.n','Bl/Y')
 c.C('starter-supply','loadGroup',795,99,8,14,terms=[('in',795,106)]);c.cg['starter-supply']=[dict(line([[789,100],[800,106],[789,112]],INK,closed=True,fill=INK),owner='starter-supply',role='symbol')];c.note('TIẾP ĐIỂM RƠ LE KHỞI ĐỘNG/SẠC',811,109,11,'start')
 c.W('starter-supply','main-out.n','starter-supply.in','Bl/Y',[(574,106)],label=(673,97))
 c.C('usb','fuse',651,143,67,30,'CẦU CHÌ (7,5A) USB',[('in',651,159),('out',718,159)]);c.J('usb-split',574,159)
 c.W('usb-split','main-out.n','usb-split.n','Bl/Y',label=False);c.W('usb-feed','usb-split.n','usb.in','Bl/Y');c.C('usb-output','loadGroup',795,153,8,14,terms=[('in',795,159)]);c.cg['usb-output']=[dict(line([[790,153],[801,159],[790,165]],INK,closed=True,fill=INK),owner='usb-output',role='symbol')];c.note('BỘ SẠC USB',810,162,11,'start');c.W('usb-out','usb.out','usb-output.in','Bl/P')
 c.C('pump-fuse','fuse',651,207,67,30,'CẦU CHÌ (10A) F/PUMP',[('in',651,223),('out',718,223)]);comb(c,'engine-loads',957,151,['VAN TỪ KIỂM SOÁT LỌC KHÍ BÌNH XĂNG','VAN TỪ CẦM CHỪNG NHANH','MÔ TƠ BƠM XĂNG','KIM PHUN','MÔ BIN SƯỜN'],18)
 c.W('pump-feed','main-out.n','pump-fuse.in','Bl/Y');c.W('engine-output','pump-fuse.out','engine-loads.in','Bl',[(957,223)],label=(869,215))
 c.W('key-output','key.out2','key-load.n','R/G',label=False)
 for cid,yy,lab,co,dest,dlabel in [('horn',401,'HORN','Bl',(728,401),'CÔNG TẮC CÒI'),('head',463,'H/L','Br',(728,463),'CỤM ĐÈN PHA LED')]:
  c.C(cid+'-fuse','fuse',573,yy-16,68,32,'CẦU CHÌ (7,5A) '+lab,[('in',573,yy),('out',641,yy)])
  c.W(cid+'-feed','key-load.n',cid+'-fuse.in','R/G',[(490,yy)],label=(529,yy-8));c.C(cid+'-load','loadGroup',dest[0],dest[1]-7,8,14,terms=[('in',*dest)]);c.cg[cid+'-load']=[dict(line([[dest[0]-7,dest[1]-6],[dest[0]+7,dest[1]],[dest[0]-7,dest[1]+6]],PALETTE[co],closed=True,fill=PALETTE[co]),owner=cid+'-load',role='symbol')];c.W(cid+'-out',cid+'-fuse.out',cid+'-load.in',co);c.note(dlabel,dest[0]+18,dest[1]+4,11,'start')
 c.C('meter-fuse','fuse',573,511,68,32,'CẦU CHÌ (7,5A) METER,TAIL…',[('in',573,527),('out',641,527)])
 c.W('meter-feed','key-load.n','meter-fuse.in','R/G',[(490,527)],label=(532,518));comb(c,'meter-loads',800,527,['ĐÈN HẬU','ĐÈN BIỂN SỐ','ĐÈN VỊ TRÍ','CÔNG TẮC PHANH TRƯỚC/SAU','CÔNG TẮC AN TOÀN','CỤM ĐỒNG HỒ'],18);c.W('meter-out','meter-fuse.out','meter-loads.in','Bl/Br')
 c.C('diode','diode',840,640,22,20,'PHI ĐI ỐT',[('in',840,650),('out',862,650)]);c.W('diode-feed','meter-loads.in','diode.in','Bl/Br',[(800,650)],label=False);c.C('flasher-load','loadGroup',929,643,8,14,terms=[('in',929,650)]);c.cg['flasher-load']=[dict(line([[922,644],[936,650],[922,656]],INK,closed=True,fill=INK),owner='flasher-load',role='symbol')];c.W('flasher-feed','diode.out','flasher-load.in','Bl');c.note('RƠ LE XI NHAN',941,654,11,'start');done(c)

def lighting():
 c=Circuit(6,'Mạch đèn đêm và đèn pha LED','lighting-led');c.supply(313,273,256,432,610,'H/L')
 c.J('key-split',555,273);c.W('key-meter-split','key.out','key-split.n','R/G',label=False)
 c.C('meter-fuse','fuse',610,422,71,32,'CẦU CHÌ (7,5A) METER,TAIL…',[('in',610,438),('out',681,438)]);c.W('meter-feed','key-split.n','meter-fuse.in','R/G',[(555,438)],label=False)
 c.C('head-led','connectorBox',1059,149,194,179,'CỤM ĐÈN PHA LED',[('hi',1059,179,'6 SW-HI'),('lo',1059,211,'5 SW-LO'),('switch-common',1059,242,'4 SW-N'),('power',1059,273,'3 H/L +'),('ground',1059,303,'1 GND')],fill='#c3e6f2')
 c.C('dimmer','selectorSwitch',779,163,71,65,'CÔNG TẮC\nPHA CỐT',[('in',779,195),('hi',850,179),('lo',850,211)])
 c.C('cluster','connectorBox',1055,22,198,78,'CỤM ĐỒNG HỒ',[('hi-plus',1055,46,'13 HIGH BEAM +'),('hi-minus',1055,76,'14 HIGH BEAM -')],fill=GREY)
 c.J('common',745,195);c.J('low',927,211,15,PALETTE['G']);c.G('head-ground',993,342)
 c.W('led-power','load-fuse.out','head-led.power','Br');c.W('led-ground','head-led.ground','head-ground.in','G',[(993,303)],label=(1010,294))
 c.W('led-switch-common','head-led.switch-common','common.n','Bl',[(745,242)],label=(1016,233));c.W('dimmer-common','common.n','dimmer.in','Bl');c.W('cluster-high-plus','common.n','cluster.hi-plus','Bl',[(745,46)],label=(1015,37))
 c.W('dimmer-hi','dimmer.hi','head-led.hi','W',label=(894,170));c.W('dimmer-low','dimmer.lo','low.n','G/O');c.W('led-low','low.n','head-led.lo','G/O');c.W('cluster-high-minus','low.n','cluster.hi-minus','G/O',[(927,76)],label=(1010,67))
 c.J('tail-feed',759,438);c.W('meter-output','meter-fuse.out','tail-feed.n','Bl/Br')
 for cid,x,y,sy,label,gg in [('position',919,420,'bulb','ĐÈN VỊ TRÍ',877),('license',921,515,'bulb','ĐÈN BIỂN SỐ',877),('tail',902,622,'headlamp','ĐÈN HẬU',906)]:
  ww=90 if cid=='tail' else 84;hh=63 if cid=='tail' else 54;yy=y+18;rr=y+38
  c.C(cid,'lamp',x,y,ww,hh,label,[('feed',x,yy),('ground',x,rr)],sym=sy);c.G(cid+'-ground',gg,y+70)
  c.W(cid+'-feed','tail-feed.n',cid+'.feed','Bl/Br',[(759,yy)],label=(799,yy-9) if cid!='position' else False);c.W(cid+'-ground',cid+'.ground',cid+'-ground.in','G',[(gg,rr)],label=(890,rr+3))
 c.note('16P',1046,111,10);c.note('6P',1047,337,10)
 for yy,ss in [(200,'ĐÈN PHA (HI)'),(270,'ĐÈN COS (LO)')]:
  c.note(ss,1183,yy-21,10);c.extra += [line([[1142,yy],[1228,yy]]),line([[1177,yy-8],[1191,yy],[1177,yy+8]],closed=True,fill='#e0485e'),line([[1193,yy-9],[1193,yy+9]])]
 c.extra += [rect(1158,31,84,58,'#777777')];c.note('ĐÈN BÁO PHA',1200,45,10);c.extra += [line([[1171,73],[1224,73]],'#ffffff'),line([[1193,65],[1207,73],[1193,81]],'#ffffff',closed=True,fill='#ffffff')]
 pinout(c,'led-pinout',1110,352,90,70,3,2,['1','2','3','4','5','6'],colors=['G',None,'Br','Bl','G/O','W'],title='ĐẦU NỐI ĐỰC (6 CHÂN)\nPHÍA BỘ ĐÈN PHA')
 c.note('Lưu ý: Màu dây của đầu nối cụm đèn pha LED là màu nhìn từ phía bó dây sườn.',30,c.height-20,12,'start');done(c)

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

def ignition():
 c=Circuit(8,'Mạch đánh lửa','ignition')
 c.C('battery','battery',101,187,81,60,terms=[('neg',117,187),('pos',165,187)]);c.G('battery-ground',41,219)
 c.C('main-fuse','fuse',232,66,68,32,'CẦU CHÌ (20A) MAIN',[('in',232,82),('out',300,82)])
 c.J('main-feed',353,82);c.C('key','switch',413,113,68,40,'KHÓA ĐIỆN',[('in',413,137),('out',481,137)])
 c.C('fi','fuse',543,121,68,32,'CẦU CHÌ (7,5A) FI',[('in',543,137),('out',611,137)])
 c.C('main-relay','relay',681,60,67,92,'RƠ LE CHÍNH',[('contact-in',681,82),('contact-out',748,82),('coil-in',681,137),('coil-out',748,137)])
 c.C('pump-fuse','fuse',908,66,68,32,'CẦU CHÌ (10A) F/PUMP',[('in',908,82),('out',976,82)]);c.G('relay-ground',789,170)
 ecmterms=[('stand',427,573,'A25'),('stand-ground',467,573,'A26'),('ground',506,573,'B2'),('power',544,573,'A4'),('ignition',586,573,'A27'),('ckp-ihu',622,573,'A20'),('ckp-ihv',658,573,'A21'),('ckp-ihw',694,573,'A34'),('ckp-ground',731,573,'A39'),('ckp-out',767,573,'A2'),('ckp-pcb',803,573,'A22')]
 c.C('ecm','ecm',390,573,447,98,'ECM',ecmterms)
 c.C('stand','selectorSwitch',189,334,61,70,'CÔNG TẮC\nCHỐNG NGHIÊNG',[('in',189,389),('ground',250,351),('out',250,387)])
 c.C('ignition-coil','ignitionCoil',1150,190,45,78,'',[('power',1188,190),('control',1160,190),('ht',1173,268)],sym='ignition-coil');c.note('MÔ-BIN',1210,238,12,'start');c.note('SƯỜN',1210,253,12,'start')
 c.C('spark-plug','sparkPlug',1158,278,33,70,'',[('ht',1173,278)],sym='spark-plug');c.note('BUGI',1199,310,12)
 c.W('battery-ground','battery.neg','battery-ground.in','G',[(117,82),(41,82)],label=(78,73));c.W('main-input','battery.pos','main-fuse.in','R',[(165,82)])
 c.W('main-tap','main-fuse.out','main-feed.n','R/W',label=False);c.W('main-relay-feed','main-feed.n','main-relay.contact-in','R/W');c.W('key-feed','main-feed.n','key.in','R/W',[(353,137)]);c.W('key-fi','key.out','fi.in','R/G')
 c.J('fi-output',646,137);c.W('fi-output','fi.out','fi-output.n','Bl/W',label=False);c.W('relay-fi','fi-output.n','main-relay.coil-in','Bl/W',label=False);c.W('relay-ground','main-relay.coil-out','relay-ground.in','G',[(789,137)])
 c.W('ecm-power','fi-output.n','ecm.power','Bl/W',[(646,242),(544,242)],label=(596,233));c.W('pump-feed','main-relay.contact-out','pump-fuse.in','Bl/Y');c.W('coil-feed','pump-fuse.out','ignition-coil.power','Bl',[(1188,82)],label=(1083,73))
 c.W('ecm-ground','battery.neg','ecm.ground','G',[(99,148),(72,148),(72,277),(506,277)],label=(343,267));c.W('stand-input','ecm.stand','stand.out','G/W',[(427,387)],label=(360,377));c.W('stand-ground','ecm.stand-ground','stand.ground','G/Bl',[(467,351)],label=(368,341))
 c.W('ignition-control','ecm.ignition','ignition-coil.control','Y/G',[(586,272),(822,272),(822,149),(1160,149)],label=(992,140));c.W('coil-high-voltage','ignition-coil.ht','spark-plug.ht','',width=2)
 c.C('connector-6p','connector',855,270,42,248,'',[('i1',855,302),('o1',897,302),('i2',855,338),('o2',897,338),('i3',855,375),('o3',897,375),('i4',855,412),('o4',897,412),('i5',855,448),('o5',897,448),('i6',855,487),('o6',897,487)],fill=GREY)
 c.cg['connector-6p']=[dict(rect(855,270,42,248,GREY),owner='connector-6p',role='symbol'),dict(line([[870,270],[870,347],[885,347],[885,440],[870,440],[870,518]]),owner='connector-6p',role='symbol')];c.note('ĐẦU NỐI 6P',876,260)
 ports=[('ihu',622,'W/R',302,1131),('ihv',658,'W/Bu',338,1095),('ihw',694,'W/Bl',375,1059),('ground',731,'G',412,1023),('out',767,'Br/R',448,987),('pcb',803,'Bu/Y',487,951)]
 c.C('ckp','sensor',916,572,251,56,'CẢM BIẾN CKP',[(tid,xx,572) for tid,_,_,_,xx in ports],fill=PALE);c.cg['ckp'] += [dict(rect(1030,628,27,17,PALE),owner='ckp',role='symbol')]
 for i,(tid,ex,code,yy,cx) in enumerate(ports,1):
  c.W('ckp-'+tid+'-ecm','ecm.ckp-'+tid,'connector-6p.i'+str(i),code,[(ex,yy)],label=(ex+41,yy-8));c.W('connector-'+tid,'connector-6p.i'+str(i),'connector-6p.o'+str(i),code,label=False);c.W('ckp-'+tid+'-sensor','connector-6p.o'+str(i),'ckp.'+tid,code,[(cx,yy)],label=(cx-60,yy-8))
 done(c)

def start_idle(n):
 idle=n==10;c=Circuit(n,'Mạch dừng động cơ tạm thời (Idling Stop)' if idle else 'Mạch khởi động','idling-stop' if idle else 'starting')
 # Coordinates are transcribed separately for the two source pages.
 if idle:
  bx,by,bneg,bpos=111,197,127,175;fy=128;fx=212;kx=383;ky1,ky2=265,326;ffx=512;rx,ry=384,109;sr_x,sr_y=745,38;busx=669;ey=380;ex,ew=98,1129
  top=[('ground',148,ey,'B2'),('power',669,ey,'A4'),('speed',943,ey,'A19'),('idle-ind',977,ey,'A17'),('starter-y',1115,ey,'A28'),('starter-r',1189,ey,'B1')]
  bottom=[('acg-u',146,451,'C3'),('acg-v',208,451,'C2'),('acg-w',276,451,'C1'),('ckp-ihu',442,451,'A20'),('ckp-ihv',465,451,'A21'),('ckp-ihw',488,451,'A34'),('ckp-out',511,451,'A2'),('ckp-pcb',534,451,'A22'),('ckp-ground',557,451,'A39'),('idle-switch',645,451,'A23'),('stand',680,451,'A25'),('stand-ground',863,451,'A26'),('tp-vcc',950,451,'A13'),('tp-signal',981,451,'A36'),('sensor-ground',1074,451,'A12'),('ect',1123,451,'A37')]
  groundx=52;gx=82;gby=302;relay_coil_y=182;starter_in_y=50;starter_r_y=79;starter_out_y=65;starter_coil_y=105;starter_w=65;starter_h=82
 else:
  bx,by,bneg,bpos=97,193,113,160;fy=125;fx=198;kx=369;ky1,ky2=262,323;ffx=499;rx,ry=369,107;sr_x,sr_y=689,35;busx=630;ey=377;ex,ew=70,1179
  top=[('ground',133,ey,'B2'),('power',630,ey,'A4'),('scu-start',1092,ey,'A32'),('starter-y',1179,ey,'A28'),('starter-r',1216,ey,'B1')]
  bottom=[('acg-u',240,448,'C3'),('acg-v',304,448,'C2'),('acg-w',372,448,'C1'),('ckp-ihu',539,448,'A20'),('ckp-ihv',563,448,'A21'),('ckp-ihw',586,448,'A34'),('ckp-out',609,448,'A2'),('ckp-pcb',633,448,'A22'),('ckp-ground',656,448,'A39'),('stand',864,448,'A25'),('stand-ground',1033,448,'A26')]
  groundx=37;gx=68;gby=299;relay_coil_y=178;starter_in_y=47;starter_r_y=75;starter_out_y=62;starter_coil_y=102;starter_w=65;starter_h=82
 c.C('battery','battery',bx,by,79,58,terms=[('neg',bneg,by),('pos',bpos,by)]);c.G('battery-ground',groundx,228 if not idle else 230)
 c.C('main-fuse','fuse',fx,fy-15,65,30,'CẦU CHÌ (20A) MAIN',[('in',fx,fy),('out',fx+65,fy)])
 c.J('main-split',308 if idle else 294,fy)
 c.C('main-relay','relay',rx,ry,65,87,'RƠ LE CHÍNH',[('contact-in',rx,fy),('contact-out',rx+65,fy),('coil-in',rx,relay_coil_y),('coil-out',rx+65,relay_coil_y)])
 c.C('key','switch',kx,ky1-20,65,93,'KHÓA ĐIỆN',[('in1',kx,ky1),('out1',kx+65,ky1),('in2',kx,ky2),('out2',kx+65,ky2)])
 c.C('meter-fuse','fuse',ffx,ky1-16,65,32,'CẦU CHÌ (7,5A) METER,TAIL…',[('in',ffx,ky1),('out',ffx+65,ky1)])
 c.C('fi','fuse',ffx,ky2-16,65,32,'CẦU CHÌ (7,5A) FI',[('in',ffx,ky2),('out',ffx+65,ky2)])
 c.C('ecm','ecm',ex,ey,ew,71,'ECM',top+bottom)
 c.C('starter-relay','relay',sr_x,sr_y,starter_w,starter_h,'RƠ LE ĐỀ/SẠC',[('contact-in',sr_x,starter_in_y),('contact-out',sr_x+starter_w,starter_out_y),('coil-in',sr_x,starter_coil_y),('coil-out',sr_x+starter_w,starter_coil_y)],startRelay=True)
 c.cmap['starter-relay']['terminals'].append(dict(id='battery',x=sr_x,y=starter_r_y));c.cg['starter-relay'] += [dict(line([[sr_x,starter_r_y],[sr_x+15,starter_r_y]]),owner='starter-relay',role='symbol'),dict(ellipse(sr_x+15,starter_r_y,5),owner='starter-relay',role='symbol')]
 c.J('battery-split',bpos,158 if idle else 154);c.J('fi-bus',busx,ky2,16,INK);c.J('relay-bus',busx,relay_coil_y,16,INK);c.G('relay-ground',351 if idle else 335,212 if idle else 207)
 c.W('battery-ground','battery.neg','battery-ground.in','G',[(bneg,79 if idle else 75),(groundx,79 if idle else 75)],label=(82,69))
 c.W('battery-split','battery.pos','battery-split.n','R',label=False);c.W('main-feed','battery-split.n','main-fuse.in','R',[(bpos,fy)]);c.W('main-tap','main-fuse.out','main-split.n','R/W',label=False);c.W('main-relay-in','main-split.n','main-relay.contact-in','R/W')
 for which,yy in [(1,ky1),(2,ky2)]:c.W('key-feed-'+str(which),'main-split.n','key.in'+str(which),'R/W',[(308 if idle else 294,yy)])
 c.W('key-meter','key.out1','meter-fuse.in','R/G');c.W('key-fi','key.out2','fi.in','R/G');c.W('fi-bus','fi.out','fi-bus.n','Bl/W');c.W('fi-to-relay-bus','fi-bus.n','relay-bus.n','Bl/W',label=False);c.W('main-relay-coil','main-relay.coil-out','relay-bus.n','Bl/W');c.W('main-relay-ground','main-relay.coil-in','relay-ground.in','G',[(351 if idle else 335,relay_coil_y)],label=(352,relay_coil_y-10))
 c.W('ecm-power','fi-bus.n','ecm.power','Bl/W',label=False)
 c.W('starter-control','relay-bus.n','starter-relay.coil-in','Bl/W',[(busx,starter_coil_y)],label=(650 if idle else 655,starter_coil_y-10))
 bend=585 if idle else 530;c.W('starter-contact-feed','main-relay.contact-out','starter-relay.contact-in','Bl/Y',[(bend,fy),(bend,starter_in_y)],label=(670 if idle else 607,starter_in_y-10))
 battery_bus_x=153 if idle else 138;upper=79 if idle else 75;c.W('starter-battery','battery.pos','starter-relay.battery','R',[(battery_bus_x,158 if idle else 154),(battery_bus_x,upper)],label=(414,upper-10))
 c.W('starter-r-ecm','starter-relay.contact-out','ecm.starter-r','R/Y',[(1189 if idle else 1216,starter_out_y)],label=(1000,starter_out_y-9));c.W('starter-y-ecm','starter-relay.coil-out','ecm.starter-y','Y',[(1115 if idle else 1179,starter_coil_y)],label=(970,starter_coil_y-10))
 c.W('ecm-ground','battery.neg','ecm.ground','G',[(bneg-22,158 if idle else 154),(gx,158 if idle else 154),(gx,gby),(148 if idle else 133,gby)],label=(86,145))
 # ACG phase terminals and CKP six separate conductors.
 if idle:acx,acy,acw,ach=137,525,145,151;ap=[('u',146,637),('v',208,525),('w',276,637)];ckx,cky=309,526;ckedge=330;ckyy=[543,566,589,612,636,659]
 else:acx,acy,acw,ach=230,525,145,151;ap=[('u',240,637),('v',304,525),('w',372,637)];ckx,cky=405,525;ckedge=426;ckyy=[541,565,589,612,636,659]
 c.C('acg','acg',acx,acy,acw,ach,'',ap,sym='acg');c.note('MÁY PHÁT/KHỞI ĐỘNG',acx+acw/2,692,12)
 for tid,co in [('u','R/Y'),('v','R/W'),('w','R/Bu')]:c.W('acg-'+tid,'ecm.acg-'+tid,'acg.'+tid,co,label=(c.T('ecm.acg-'+tid)['x']-14,495))
 c.C('ckp','sensor',ckx,cky,21,150,'',[(tid,ckedge,yy) for tid,yy in zip(['ihu','ihv','ihw','out','pcb','ground'],ckyy)],fill=PALE);c.note('CẢM BIẾN CKP 6 DÂY',ckx+60,695,12)
 for tid,code,yy in zip(['ihu','ihv','ihw','out','pcb','ground'],['W/R','W/Bu','W/Bl','Br/R','Bu/Y','G'],ckyy):
  t=c.T('ecm.ckp-'+tid);c.W('ckp-'+tid,'ecm.ckp-'+tid,'ckp.'+tid,code,[(t['x'],yy)],label=(480 if not idle else 388,yy-8))
 if idle:
  c.C('stand','switch',729,506,66,33,'CÔNG TẮC\nCHỐNG NGHIÊNG',[('in',729,524),('out',795,524)])
  c.C('idle-switch','switch',729,591,66,34,'CÔNG TẮC\nDỪNG CẦM CHỪNG',[('in',729,612),('out',795,612)])
  c.J('stand-ground',863,524,12,PALETTE['G']);c.W('stand-control','ecm.stand','stand.in','G/W',[(680,524)]);c.W('stand-ground-feed','ecm.stand-ground','stand-ground.n','G/Bl',label=False);c.W('stand-ground','stand-ground.n','stand.out','G/Bl');c.W('idle-switch-input','ecm.idle-switch','idle-switch.in','Bl/G',[(645,612)]);c.W('idle-switch-return','idle-switch.out','stand-ground.n','G/Bl',[(863,612)])
  c.C('cluster','cluster',860,166,129,78,'CỤM ĐỒNG HỒ',[('power',860,203,'6'),('ground',989,203,'8'),('vs-return',873,244,'4'),('vs-signal',906,244,'2'),('ecm-speed',943,244,'3'),('idle-ind',977,244,'15')])
  c.note('ĐÈN BÁO',925,187,8);c.note('DỪNG CẦM CHỪNG',925,195,8);c.extra += [ellipse(925,209,12),line([[919,202],[929,209],[919,216]],closed=True,fill=INK),line([[932,202],[932,216]])]
  c.J('meter-feed',717,ky1);c.W('meter-to-cluster','meter-fuse.out','meter-feed.n','Bl/Br');c.W('cluster-power','meter-feed.n','cluster.power','Bl/Br',[(717,203)],label=(799,194));c.G('cluster-ground',1035,226);c.W('cluster-ground','cluster.ground','cluster-ground.in','G/Bl',[(1035,203)])
  c.C('vs-rotor','rotor',709,287,39,40,caption=False,sym='rotor');c.C('vs','sensor',769,285,21,49,'',[('return',790,293),('signal',790,327)],fill=PALE);c.note('CẢM BIẾN VS',774,355)
  c.W('vs-return','vs.return','cluster.vs-return','Bu/G',[(873,293)]);c.W('vs-signal','vs.signal','cluster.vs-signal','P/G',[(906,327)]);c.W('speed-ecm','cluster.ecm-speed','ecm.speed','P/G',label=(953,312));c.W('idle-ind-ecm','cluster.idle-ind','ecm.idle-ind','Gr/Bl',label=(993,319))
  c.C('tp','sensor',939,563,85,55,'',[('vcc',950,563),('signal',981,563),('ground',1010,563)],sym='tp');c.note('CẢM BIẾN TP',981,637,11)
  c.C('ect','sensor',1064,563,69,44,'',[('ground',1074,563),('signal',1123,563)],sym='thermistor');c.note('CẢM BIẾN ECT',1100,637,11)
  c.J('sensor-ground',1074,500);c.W('sensor-ground-feed','ecm.sensor-ground','sensor-ground.n','Gr',label=False);c.W('ect-ground','sensor-ground.n','ect.ground','Gr',label=False);c.W('tp-ground','sensor-ground.n','tp.ground','Gr',[(1010,500)],label=(1024,530));c.W('tp-vcc','ecm.tp-vcc','tp.vcc','Y/O');c.W('tp-signal','ecm.tp-signal','tp.signal','Y/Bu');c.W('ect-signal','ecm.ect','ect.signal','P')
 else:
  c.C('stand','switch',913,552,66,36,'CÔNG TẮC\nCHỐNG NGHIÊNG',[('in',913,575),('out',979,575)]);c.W('stand-control','ecm.stand','stand.in','G/W',[(864,575)]);c.W('stand-ground','ecm.stand-ground','stand.out','G/Bl',[(1033,575)])
  c.C('scu','scu',1022,133,92,91,'SCU',[('power',1022,178,'2'),('ground',1114,178,'3'),('start',1043,224,'15'),('ecm-start',1092,224,'19')])
  c.C('safety','switch',723,239,65,35,'CÔNG TẮC AN TOÀN',[('in',723,262),('out',788,262)])
  c.C('starter-switch','switch',897,234,65,40,'CÔNG TẮC KHỞI ĐỘNG',[('in',897,262),('out',962,262)],sym='push-switch');c.G('scu-ground',1149,199)
  c.W('meter-safety','meter-fuse.out','safety.in','Bl/Br');c.W('safety-start','safety.out','starter-switch.in','Bu/G');c.W('start-scu','starter-switch.out','scu.start','G/W',[(1043,262)]);c.W('scu-ecm','scu.ecm-start','ecm.scu-start','G/W');c.W('scu-power','relay-bus.n','scu.power','Bl/W');c.W('scu-ground','scu.ground','scu-ground.in','G',[(1149,178)])
 done(c)

def indicator(c,cid,x,y,w,h,label,terms,fill=GREY):
 c.C(cid,'indicator',x,y,w,h,'',terms,fill=fill);e=[rect(x,y,w,h,fill),ellipse(x+w/2,y+h/2,min(w,h)*.32),line([[x+w*.39,y+h*.27],[x+w*.61,y+h*.5],[x+w*.39,y+h*.73]],closed=True,fill=INK),line([[x+w*.64,y+h*.27],[x+w*.64,y+h*.73]])]
 c.cg[cid]=[dict(v,owner=cid,role='symbol') for v in e]
 if label:c.note(label,x+w/2,y-9,10)

def smartkey():
 c=Circuit(11,'Sơ đồ nguyên lý hệ thống khóa thông minh (Smartkey)','smartkey',True)
 c.C('battery','battery',64,49,63,45,terms=[('neg',77,49),('pos',114,49)]);c.G('battery-ground',49,70,w=20)
 c.C('main-fuse','fuse',128,126,53,24,'CẦU CHÌ (20A) MAIN',[('in',128,138),('out',181,138)])
 c.C('backup-fuse','fuse',128,182,53,24,'CẦU CHÌ (7,5A) BACK UP',[('in',128,194),('out',181,194)])
 c.J('battery-supply',222,138);c.J('main-bus',27,572);c.J('backup-feed',53,238);c.J('backup-cluster',253,238);c.J('key-output',290,572)
 left=[('battery',310,238,'1 B+'),('sol-plus',310,298,'4 SOL+'),('sol-minus',310,323,'5 SOL-'),('alarm',310,365,'16 ALARM IND'),('face-led',310,412,'21 FACE LED'),('knob',310,504,'6 KNOB SW'),('main',310,794,'2 MAIN SW'),('start',310,871,'15 ST SW'),('entry',310,938,'14 ENTRY MODE'),('ground',310,998,'3 GND')]
 right=[('smart',505,251,'7 SMART IND'),('buzzer-plus',505,346,'12 BUZZER+'),('buzzer-minus',505,365,'13 BUZZER-'),('left-turn',505,472,'8 WINKER L'),('right-turn',505,619,'9 WINKER R'),('imoid',505,761,'10 IMOID'),('imoau',505,785,'11 IMOAU'),('engine-start',505,809,'19 ENG START')]
 c.C('scu','scu',310,204,195,826,'',left+right);c.note('BỘ ĐIỀU KHIỂN THÔNG MINH',408,188,16)
 c.W('battery-ground','battery.neg','battery-ground.in','G',[(77,30),(49,30)],label=(63,25));c.W('battery-feed','battery.pos','battery-supply.n','R',[(114,30),(222,30)],label=(168,26))
 c.W('main-feed','battery-supply.n','main-fuse.out','R');c.W('backup-feed','battery-supply.n','backup-fuse.out','R',[(222,194)]);c.W('main-bus','main-fuse.in','main-bus.n','R/W',[(27,138)],label=(79,133))
 c.W('backup-output','backup-fuse.in','backup-feed.n','Lg/Bl',[(53,194)],label=(82,187));c.W('backup-scu-split','backup-feed.n','backup-cluster.n','Lg/Bl',label=(168,230));c.W('scu-battery','backup-cluster.n','scu.battery','Lg/Bl',label=False)
 c.C('cluster','cluster',583,199,110,71,'CỤM ĐỒNG HỒ',[('power',583,217,'7'),('indicator',583,251,'16')]);c.note('ĐÈN BÁO HỆ THỐNG',638,248,8);c.note('KHÓA THÔNG MINH',638,258,8)
 c.extra += [ellipse(639,224,10),line([[634,218],[643,224],[634,230]],closed=True,fill=INK),line([[646,218],[646,230]])]
 c.W('cluster-battery','backup-cluster.n','cluster.power','Lg/Bl',[(253,138),(537,138),(537,217)],label=(410,128));c.W('cluster-indicator','scu.smart','cluster.indicator','Gr')
 c.C('buzzer','speaker',617,328,26,56,'CÒI ĐIỆN TỬ',[('plus',617,346),('minus',617,365)],sym='speaker');c.W('buzzer-plus','scu.buzzer-plus','buzzer.plus','Bu');c.W('buzzer-minus','scu.buzzer-minus','buzzer.minus','G')
 c.C('key-assembly','assembly',115,283,88,360,'',caption=False,fill='#a1d8ab');c.note('KHÓA TAY LÁI THÔNG MINH',160,276,10)
 c.C('key-solenoid','coil',130,293,72,34,'',[('plus',131,298),('minus',203,323)],caption=False)
 c.cg['key-solenoid']=[dict(el,owner='key-solenoid',role='symbol') for el in [line([[131,298],[131,323],[141,323]]),coil(141,323,48,6,5),line([[189,323],[203,323]])]];c.note('CUỘN DÂY',160,340,9)
 c.W('sol-plus','scu.sol-plus','key-solenoid.plus','Bl');c.W('sol-minus','scu.sol-minus','key-solenoid.minus','Bl')
 c.J('key-led-supply',53,412)
 c.W('key-led-power','backup-feed.n','key-led-supply.n','Bl',label=False)
 for cid,yy,pin,lab in [('alarm',365,'alarm','ĐÈN BÁO ĐỘNG'),('face',412,'face-led','ĐÈN VÒNG TRÒN KHÓA ĐIỆN')]:
  c.C(cid+'-led','led',130,yy-10,73,20,'',[('in',131,yy),('out',203,yy)],caption=False)
  c.cg[cid+'-led']=[dict(el,owner=cid+'-led',role='symbol') for el in [line([[131,yy],[203,yy]]),ellipse(160,yy,10),line([[155,yy-6],[164,yy],[155,yy+6]],closed=True,fill=INK),line([[165,yy-7],[165,yy+7]])]]
  c.note(lab,164,yy+22,8)
  c.W(cid+'-led-feed','key-led-supply.n',cid+'-led.in','Bl',[(53,yy)],label=False);c.W(cid+'-led-control','scu.'+pin,cid+'-led.out','Bl')
 c.C('knob','switch',127,476,57,48,'',[('in',127,504),('out',184,504)],sym='push-switch');c.note('CÔNG TẮC NÚM',158,532,9);c.G('knob-ground',53,529,w=20)
 c.W('knob-ground','knob.in','knob-ground.in','G',[(53,504)],label=(76,496));c.W('knob-control','knob.out','scu.knob','Bl')
 c.C('key','switch',133,554,55,70,'',[('in1',133,572),('out1',188,572),('in2',133,606),('out2',188,606)]);c.note('CÔNG TẮC KHÓA ĐIỆN',162,637,9)
 c.W('key-upper-feed','main-bus.n','key.in1','R/W');c.W('key-lower-feed','main-bus.n','key.in2','R/W',[(27,606)]);c.W('key-upper-out','key.out1','key-output.n','R/G')
 c.C('meter-fuse','fuse',132,683,53,24,'CẦU CHÌ (7,5A) METER,TAIL…',[('in',132,695),('out',185,695)]);c.C('fi','fuse',132,782,53,24,'CẦU CHÌ (7,5A) FI',[('in',132,794),('out',185,794)])
 c.J('fi-input',64,794)
 c.W('key-meter','key.out2','meter-fuse.out','R/G',[(264,606),(264,695)]);c.W('key-fi-lower','key-output.n','fi-input.n','R/G',[(290,740),(64,740)],label=(177,735))
 c.W('fi-input','fi-input.n','fi.in','R/G');c.W('fi-scu','fi.out','scu.main','Bl/W')
 c.C('safety','switch',78,850,53,32,'CÔNG TẮC AN TOÀN',[('in',78,871),('out',131,871)]);c.C('start','switch',187,841,68,42,'CÔNG TẮC KHỞI ĐỘNG',[('in',187,871),('out',255,871)],sym='push-switch')
 c.W('meter-safety','meter-fuse.in','safety.in','Bl/Br',[(27,695),(27,871)],label=(46,862));c.W('safety-start','safety.out','start.in','Bu/G');c.W('start-scu','start.out','scu.start','G/W')
 for cid,yy,code,title in [('left',456,'Y','ĐÈN XI NHAN TRÁI'),('right',604,'Lb','ĐÈN XI NHAN PHẢI')]:
  c.C(cid+'-lamp','lamp',598,yy,75,46,title,[('feed',598,yy+16),('ground',598,yy+31)],sym='bulb');c.G(cid+'-ground',570,yy+68,w=20)
  c.W(cid+'-feed','scu.'+cid+'-turn',cid+'-lamp.feed',code);c.W(cid+'-ground',cid+'-lamp.ground',cid+'-ground.in','G',[(570,yy+31)],label=False)
 c.C('ecm','ecm',585,741,92,89,'ECM',[('imoid',585,761,'A35'),('imoau',585,785,'A33'),('start',585,809,'A32')])
 for a,b,co in [('imoid','imoid','Bu'),('imoau','imoau','P'),('engine-start','start','G/W')]:c.W('scu-ecm-'+a,'scu.'+a,'ecm.'+b,co)
 c.C('test-connector','connector',148,928,21,30,'ĐẦU NỐI KIỂM TRA',[('entry',169,938)],fill='white');c.cg['test-connector']=[dict(el,owner='test-connector',role='symbol') for el in [rect(148,928,21,30,'white','#e25b76'),line([[148,933],[159,933],[159,953],[153,953],[153,942],[148,942]],'#e25b76')]];c.note('BỘ TIẾP HỢP KIỂM TRA',98,947,8);c.W('entry-test','test-connector.entry','scu.entry','Bl/G')
 c.G('scu-ground',162,1018,w=22);c.W('scu-ground','scu.ground','scu-ground.in','G',[(162,998)],label=(240,989))
 c.C('fob','remote',575,876,46,117,'FOB',caption=False,fill='#222222');c.cg['fob'] += [dict(rect(583,890,29,86,'#a9adaf'),owner='fob',role='symbol'),dict(ellipse(597,919,8,fill='#555555'),owner='fob',role='symbol'),dict(rect(588,944,18,18,'#555555'),owner='fob',role='symbol')];c.note('FOB',596,1028,21)
 c.note('LF ANTENNA',458,959,9);c.note('RF UNIT',458,998,9)
 c.extra += [line([[516,950],[545,925]],width=2),line([[531,971],[552,948]],width=2),line([[536,925],[545,925],[542,935]],closed=True,fill=INK),line([[531,971],[532,961],[540,969]],closed=True,fill=INK)]
 pinout(c,'scu-pinout',311,1064,194,131,7,3,list(range(1,22)),title='ĐẦU NỐI 21P SCU\n(ĐẦU CỰC LỒI PHÍA SCU)');done(c)

def pgmfi():
 c=Circuit(12,'Sơ đồ nguyên lý hệ thống phun xăng điện tử (PGM-FI)','pgm-fi',True)
 # The final two originals are sideways; portrait coordinates are an exact 90° view transform.
 c.C('battery','battery',103,147,49,45,terms=[('neg',110,147),('pos',142,147)]);c.G('battery-ground',31,183,w=20)
 c.C('main-fuse','fuse',177,40,34,18,'CẦU CHÌ (20A) MAIN',[('in',177,49),('out',211,49)])
 c.J('main-bus',270,49);c.J('battery-feed',142,115)
 c.C('key','switch',330,29,47,65,'CÔNG TẮC MÁY',[('in1',330,49),('out1',377,49),('in2',330,84),('out2',377,84)])
 c.C('meter-fuse','fuse',476,40,34,18,'CẦU CHÌ T/ĐỒNG HỒ (7,5A)',[('in',476,49),('out',510,49)])
 c.C('fi','fuse',476,75,34,18,'CẦU CHÌ FI (7,5A)',[('in',476,84),('out',510,84)])
 c.C('main-relay','relay',326,132,55,75,'RƠ LE CHÍNH',[('contact-in',326,191),('contact-out',381,191),('coil-in',326,146),('coil-out',381,146)])
 c.C('pump-fuse','fuse',442,140,34,18,'CẦU CHÌ FI/PUMP (10A)',[('in',442,149),('out',476,149)])
 c.C('starter-relay','relay',460,181,66,85,'RƠ LE ĐỀ/SẠC',[('contact-in',460,191),('contact-out',526,209),('coil-in',460,253),('coil-out',526,253)],startRelay=True)
 c.cmap['starter-relay']['terminals'].append(dict(id='battery',x=460,y=223));c.cg['starter-relay'] += [dict(line([[460,223],[475,223]]),owner='starter-relay',role='symbol'),dict(ellipse(475,223,5),owner='starter-relay',role='symbol')]
 left=[('ground',267,253,'B2 N(-)'),('ckp-pcb',267,275,'A22 PCB'),('ckp-out',267,296,'A2 VOUT'),('ckp-ground',267,313,'A39 P-GND'),('ckp-ihu',267,337,'A20 IHU'),('ckp-ihv',267,360,'A21 IHV'),('ckp-ihw',267,382,'A34 IHW'),('tp-vcc',267,413,'A13 VCC(5v)'),('tp',267,440,'A36 THR'),('sensor-ground',267,465,'A12 SG'),('iat',267,499,'A24 TA'),('ect',267,581,'A37 TW'),('oxygen',267,685,'A38 O₂'),('kline',267,753,'A29 K-LINE'),('scs',267,772,'A30 SCS'),('lg',267,792,'A26 LG'),('idle-switch',267,866,'A23 ID-SW'),('stand',267,916,'A25 SS-SW'),('imoau',267,956,'A33 IMOAU'),('imoid',267,980,'A35 IMOID'),('start',267,1004,'A32 ST-SW')]
 right=[('starter-y',415,253,'S/RELAY A28'),('starter-r',415,282,'P(+) B1'),('power',415,313,'BATT A4'),('pcs',415,368,'PCS A1'),('pump',415,417,'F-PUMP A5'),('solv',415,453,'SOLV A14'),('injector',415,526,'INJ A8'),('ignition',415,601,'IGN A27'),('acg-u',415,778,'U-PHASE C3'),('acg-v',415,824,'V-PHASE C2'),('acg-w',415,870,'W-PHASE C1'),('idle-ind',415,916,'IS-IND A17'),('mil',415,937,'ENG CHECK A18'),('speed',415,978,'SP-SE A19'),('temp-warn',415,1004,'TW-IND A3')]
 c.C('ecm','ecm',267,239,148,771,'',left+right);c.note('ECM',300,553,19);c.note('(33-2)',304,532,9)
 c.J('fi-bus',659,113,7,INK);c.J('power-bus',633,526,8,INK);c.J('power-tap',633,191,7,INK);c.J('meter-bus',689,934,8,INK)
 c.W('battery-ground','battery.neg','battery-ground.in','G',[(110,49),(31,49)],label=(71,43));c.W('battery-positive','battery.pos','battery-feed.n','R',label=False);c.W('main-feed','battery-feed.n','main-fuse.in','R',[(142,49)])
 c.W('main-split','main-fuse.out','main-bus.n','R/W');c.W('key-main','main-bus.n','key.in1','R/W',label=False);c.W('key-fi-input','main-bus.n','key.in2','R/W',[(270,84)],label=False)
 c.W('meter-input','key.out1','meter-fuse.in','R/G');c.W('fi-input','key.out2','fi.in','R/G');c.W('meter-bus','meter-fuse.out','meter-bus.n','Bl/Br',[(689,49)],label=(592,43));c.W('fi-bus','fi.out','fi-bus.n','Bl/W',[(659,84)],label=(600,76))
 c.W('main-relay-feed','main-bus.n','main-relay.contact-in','R/W',[(270,191)],label=False);c.G('relay-ground',299,154,w=20);c.W('main-relay-ground','main-relay.coil-in','relay-ground.in','G',[(299,146)],label=False);c.W('main-relay-control','fi-bus.n','main-relay.coil-out','Bl/W',[(410,113),(410,146)],label=(512,105))
 c.W('ecm-power','fi-bus.n','ecm.power','Bl/W',[(659,313)],label=(595,305));c.W('starter-fi','fi-bus.n','starter-relay.coil-out','Bl/W',[(659,253)],label=(594,245))
 c.W('main-starter','main-relay.contact-out','starter-relay.contact-in','Bl/Y');c.W('pump-feed','main-relay.contact-out','pump-fuse.in','Bl/Y',[(437,191),(437,149)],label=False)
 c.W('starter-battery','battery-feed.n','starter-relay.battery','R',[(157,115),(202,115),(202,223)],label=(316,217))
 c.W('starter-y','starter-relay.coil-in','ecm.starter-y','Y');c.W('starter-r','starter-relay.contact-out','ecm.starter-r','R/Y',[(561,209),(561,282)],label=(501,277))
 c.W('ecm-ground','battery.neg','ecm.ground','G',[(85,116),(65,116),(65,254)],label=(193,247))
 c.W('power-distribution','pump-fuse.out','power-tap.n','Bl',[(633,149)]);c.W('power-trunk','power-tap.n','power-bus.n','Bl',label=False)
 ckps=[('pcb',275,'Bu/Y'),('out',296,'Br/R'),('ground',313,'G'),('ihu',337,'W/R'),('ihv',360,'W/Bu'),('ihw',382,'W/Bl')]
 c.C('ckp','sensor',135,265,20,125,'',[(tid,155,yy) for tid,yy,_ in ckps],fill=PALE);c.note('CẢM BIẾN CKP',82,329,10);c.note('(52-1,52-2)',82,304,9)
 for tid,yy,code in ckps:c.W('ckp-'+tid,'ckp.'+tid,'ecm.ckp-'+tid,code,label=(200,yy-6))
 c.C('tp','sensor',120,404,39,70,'',[('vcc',159,413),('signal',159,440),('ground',159,465)],caption=False,fill=PALE)
 c.cg['tp'] += [dict(zigzag(141,415,8,42,5),owner='tp',role='symbol'),dict(line([[159,440],[145,440],[150,435]],width=1),owner='tp',role='symbol')];c.note('CẢM BIẾN TP',72,456,10);c.note('(8-1,8-2)',73,419,9)
 c.C('iat','sensor',121,486,34,65,'',[('signal',155,499),('ground',155,542)],caption=False,fill=PALE);c.C('ect','sensor',122,571,34,62,'',[('signal',156,581),('ground',156,623)],caption=False,fill=PALE)
 for cid,lab,ty in [('iat','IAT',507),('ect','ECT',598)]:
  xx=c.cmap[cid]['x'];yy=c.cmap[cid]['y'];c.cg[cid] += [dict(zigzag(xx+16,yy+13,9,35,4),owner=cid,role='symbol'),dict(line([[xx+5,yy+20],[xx+26,yy+45]]),owner=cid,role='symbol')];c.note('CẢM BIẾN '+lab,71,ty+23,10)
 c.note('(9-1,9-2)',72,501,9);c.note('(7-1,7-2)',72,580,9)
 c.J('sensor-ground',219,465);c.J('iat-ground',219,542);c.J('ect-ground',219,623)
 c.W('tp-vcc','tp.vcc','ecm.tp-vcc','Y/O');c.W('tp-signal','tp.signal','ecm.tp','Y/Bu');c.W('sensor-ground','ecm.sensor-ground','sensor-ground.n','Gr');c.W('tp-ground','sensor-ground.n','tp.ground','Gr',label=False);c.W('iat-ground-bus','sensor-ground.n','iat-ground.n','Gr',label=False);c.W('ect-ground-bus','iat-ground.n','ect-ground.n','Gr',label=False)
 c.W('iat-ground','iat-ground.n','iat.ground','Gr',label=False);c.W('ect-ground','ect-ground.n','ect.ground','Gr',label=False);c.W('iat-signal','iat.signal','ecm.iat','W/G');c.W('ect-signal','ect.signal','ecm.ect','P')
 c.C('oxygen','sensor',91,656,54,45,'',[('ground',145,667),('signal',145,684)],caption=False,fill=PALE);c.cg['oxygen'] += [dict(line([[105,669],[105,693],[110,688],[118,688],[122,694],[128,686]]),owner='oxygen',role='symbol')];c.note('CẢM BIẾN OXY',48,691,9);c.note('(21-1,21-2)',48,664,9)
 c.C('oxygen-connector','connector',181,655,14,43,'',[('g-in',181,667),('g-out',195,667),('s-in',181,684),('s-out',195,684)],caption=False,fill=GREY)
 c.W('oxygen-ground','oxygen.ground','oxygen-connector.g-in','Gr');c.W('oxygen-ground-bridge','oxygen-connector.g-in','oxygen-connector.g-out','Gr',label=False);c.W('oxygen-ground-return','oxygen-connector.g-out','ect-ground.n','Gr',[(219,667)],label=False)
 c.W('oxygen-signal','oxygen.signal','oxygen-connector.s-in','Bl');c.W('oxygen-bridge','oxygen-connector.s-in','oxygen-connector.s-out','Bl',label=False);c.W('oxygen-ecm','oxygen-connector.s-out','ecm.oxygen','Bl/Br')
 # Actuators: six independent ECM control lines sharing the F/PUMP output bus.
 c.C('pcs','valve',493,359,58,20,'',[('control',493,368),('power',551,368)],caption=False,fill=GREY);c.cg['pcs'] += [dict(coil(500,370,43,5,8),owner='pcs',role='symbol')];c.note('VAN TỪ KIỂM SOÁT',530,342,10);c.note('LỌC KHÍ BÌNH XĂNG',530,353,10)
 c.C('pump','pump',502,398,39,39,'BƠM XĂNG',[('control',502,417),('power',541,417)],sym='pump')
 c.C('solv','valve',500,461,32,39,'',[('control',510,461),('power',525,461)],sym='valve');c.note('VAN TỪ',569,483,10);c.note('CẦM CHỪNG NHANH',569,496,9)
 c.C('injector','injector',487,541,42,44,'KIM PHUN',[('control',516,541),('power',524,541)],sym='injector')
 c.C('coil','ignitionCoil',500,601,38,58,'',[('control',510,601),('power',530,601),('ht',519,659)],sym='ignition-coil');c.note('MÔ-BIN SƯỜN',590,643,10)
 c.C('spark-plug','sparkPlug',504,669,28,55,'',[('ht',519,669)],sym='spark-plug');c.note('BUGI',552,688,10)
 for tid,cid,co,control,yy in [('pcs','pcs','Bu','control',368),('pump','pump','Br','control',417),('solv','solv','O/Bl','control',453),('injector','injector','P/Bu','control',526),('ignition','coil','Y/G','control',601)]:
  ref=cid+'.'+control;tx=c.T(ref)['x'];c.W('control-'+tid,'ecm.'+tid,ref,co,[(tx,yy)],label=(461,yy-7))
  t=c.T(cid+'.power');c.W('power-'+cid,'power-bus.n',cid+'.power','Bl',[(633,yy),(t['x'],yy)],label=(588,yy-7))
 c.W('coil-high-voltage','coil.ht','spark-plug.ht','',width=1.5)
 for ss,xx,yy in [('(88-1)',593,350),('(82-1)',590,472),('(12-1)',589,551),('(91-1)',590,635)]:c.note(ss,xx,yy,9)
 c.C('dlc','connector',154,726,16,74,'DLC',[('power',170,734),('kline',170,753),('scs',170,772),('ground',170,792)],caption=False,fill='white');c.cg['dlc']=[dict(el,owner='dlc',role='symbol') for el in [rect(154,726,16,74,'white','#e7738d'),rect(137,726,10,42,'white','#e7738d'),line([[137,768],[117,775],[117,792],[137,792]],'#e7738d')]];c.note('DLC',160,720,10);c.note('ĐẦU NỐI SCS',90,770,10)
 c.W('dlc-power','fi-bus.n','dlc.power','Bl/W',[(659,734)],label=(201,728));c.W('dlc-kline','dlc.kline','ecm.kline','O/W');c.W('dlc-scs','dlc.scs','ecm.scs','Br');c.W('dlc-ground','dlc.ground','ecm.lg','G/Bl')
 c.J('ground-bus',46,866);c.W('dlc-ground-bus','dlc.ground','ground-bus.n','G/Bl',[(216,792),(216,812),(46,812)],label=(79,806))
 c.C('idle-switch','switch',137,851,36,23,'CÔNG TẮC DỪNG CẦM CHỪNG',[('in',137,866),('out',173,866)]);c.W('idle-switch-ground','ground-bus.n','idle-switch.in','G/Bl');c.W('idle-switch','idle-switch.out','ecm.idle-switch','Bl/G')
 c.C('stand','switch',138,903,36,25,'CÔNG TẮC CHỐNG NGHIÊNG',[('in',138,916),('out',174,916)]);c.W('stand-ground','ground-bus.n','stand.in','G/Bl',[(46,916)],label=(96,910));c.W('stand-control','stand.out','ecm.stand','G/W')
 c.C('scu','scu',108,945,88,74,'SCU',[('start-switch',108,981,'15'),('imoau',196,956,'11'),('imoid',196,980,'10'),('start',196,1004,'19')])
 c.W('scu-ground','ground-bus.n','scu.start-switch','G/W',[(46,981)],label=(67,974));c.W('scu-imoau','scu.imoau','ecm.imoau','P');c.W('scu-imoid','scu.imoid','ecm.imoid','Bu');c.W('scu-start','scu.start','ecm.start','G/W')
 c.C('acg','acg',477,787,74,74,'',[('u',534,788),('v',477,824),('w',534,860)],sym='acg');c.note('MÁY PHÁT/KHỞI ĐỘNG',610,824,10)
 c.W('acg-u','ecm.acg-u','acg.u','R/Y',[(534,778)],label=False);c.W('acg-v','ecm.acg-v','acg.v','R/W');c.W('acg-w','ecm.acg-w','acg.w','R/Bu',[(534,870)],label=False)
 c.C('cluster','cluster',471,904,113,168,'CỤM ĐỒNG HỒ',[('idle',471,916,'15'),('mil',471,937,'12'),('speed',471,978,'3'),('temp',471,1004,'11'),('vs-return',471,1037,'4'),('vs-signal',471,1058,'2'),('power',584,934,'6'),('ground',584,1038,'8')])
 c.W('cluster-power','meter-bus.n','cluster.power','Bl/Br');c.W('cluster-idle','ecm.idle-ind','cluster.idle','Gr/Bl');c.W('cluster-mil','ecm.mil','cluster.mil','W/Bu');c.W('cluster-speed','ecm.speed','cluster.speed','P/G');c.W('cluster-temp','ecm.temp-warn','cluster.temp','Lg/R')
 for yy,lab in [(937,'MIL'),(983,'IDLING STOP'),(1044,'ĐÈN CẢNH BÁO')]:c.note(lab,527,yy-13,9);c.extra += [ellipse(527,yy,9),line([[522,yy-5],[531,yy],[522,yy+5]],closed=True,fill=INK)]
 c.note('NHIỆT ĐỘ ĐỘNG CƠ',527,1036,8)
 c.G('cluster-ground',628,1064,w=20);c.W('cluster-ground','cluster.ground','cluster-ground.in','G/Bl',[(628,1038)],label=(608,1032))
 c.C('vs-rotor','rotor',133,1033,37,35,'',caption=False,sym='rotor');c.C('vs','sensor',174,1030,21,42,'',[('return',195,1037),('signal',195,1058)],fill=PALE);c.note('CẢM BIẾN VS',86,1068,10);c.note('(11-1)',108,1040,9)
 c.W('vs-return','vs.return','cluster.vs-return','Bu/G');c.W('vs-signal','vs.signal','cluster.vs-signal','P/G')
 c.C('start-switch','switch',214,1096,37,26,'CÔNG TẮC KHỞI ĐỘNG',[('in',214,1116),('out',251,1116)],sym='push-switch');c.C('safety','switch',509,1099,43,26,'CÔNG TẮC AN TOÀN',[('in',509,1116),('out',552,1116)])
 c.W('start-scu','scu.start-switch','start-switch.in','G/W',[(31,981),(31,1116)],label=False);c.W('start-safety','start-switch.out','safety.in','Bu/G');c.W('safety-meter','safety.out','meter-bus.n','Bl/Br',[(689,1116)],label=False)
 c.extra += [rect(10,1155,230,105,'white')]
 c.note('Ghi chú:',43,1165,13,'start');c.note('DTC / MÃ MIL',89,1180,10);c.note('ĐỘNG CƠ KHÔNG KHỞI ĐỘNG',123,1205,9);c.note('NẾU CÓ HƯ HỎNG',123,1218,9);c.note('CÁC ĐẦU CỰC NGẮN ĐỂ ĐỌC',123,1243,9);c.note('DTC / MÃ MIL',123,1255,9)
 # Readable reference pinouts: the original 39P grid runs in reverse across each row.
 pinout(c,'ecm-39p',260,1163,181,79,13,3,list(range(13,0,-1))+list(range(26,13,-1))+list(range(39,26,-1)),title='ĐẦU NỐI 39P CỰC LỒI PHÍA ECM (A)')
 # 5P/3P connector drawing is shown as adjacent stacked banks, preserving each visible label.
 c.C('ecm-bc','pinout',478,1164,198,78,'',caption=False);el=[rect(490,1164,67,76,'white',width=1),rect(561,1164,115,76,'white',width=1)]
 for i,ss in enumerate(['B2','B3','B4','B5','B1']):
  xx,yy=[(494,1169),(494,1190),(494,1220),(552,1220),(552,1169)][i];el += [line([[xx,yy],[xx+29,yy]]),text(ss,xx,yy-4,9)]
 for ss,xx,yy in [('C2',642,1169),('C3',672,1199),('C1',642,1220)]:el += [line([[xx-34,yy],[xx,yy]]),text(ss,xx+4,yy+3,9)]
 c.cg['ecm-bc']=[dict(e,owner='ecm-bc',role='symbol') for e in el];c.note('ĐẦU NỐI 5P/3P CỰC LỒI PHÍA ECM (B VÀ C)',575,1260,10)
 # Diagnostic legend and yellow MIL pictograms are source annotations, not components.
 for xx,yy in [(34,303),(51,423),(51,504),(51,584),(16,662),(277,532),(578,345),(548,469),(548,550),(548,632),(101,1039),(22,1173)]:
  c.extra += [rect(xx,yy-7,14,13,'#ffff5a',width=.7),ellipse(xx+7,yy,4,3,stroke=INK,width=.8),line([[xx+4,yy-4],[xx+5,yy-6],[xx+9,yy-6],[xx+10,yy-4]],INK,.8)]
 for xx,yy in [(124,303),(599,550),(599,632),(27,1203)]:
  c.extra += [line([[xx-4,yy-5],[xx+4,yy+5]],INK,.8),line([[xx-4,yy+5],[xx+4,yy-5]],INK,.8),ellipse(xx,yy,5,stroke=INK,width=.5)]
 c.extra += [rect(22,1233,8,16,'white','#e7738d',.8),line([[22,1241],[17,1241],[17,1250],[22,1250]],'#e7738d',.8)]
 done(c)

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
 return dict(errors=errors,warnings=warnings,componentCount=len(cs),wireCount=len(ids),netCount=len(groups),nets=list(groups.values()),checks=dict(uniqueIds=not any('duplicate' in s for s in errors),terminalReferences=not any('unknown' in s for s in errors),wireEndpoints=not any('endpoint' in s for s in errors),verticesInsideCanvas=not any('canvas' in s for s in errors),noEmbeddedSourceBitmaps=True))

def main():
 OUT.mkdir(parents=True,exist_ok=True);(OUT/'preview').mkdir(exist_ok=True);(OUT/'source').mkdir(exist_ok=True)
 power();simple_circuits();lighting();ignition();start_idle(9);start_idle(10);smartkey();pgmfi()
 reports=[];entries=[];payload=[];checksums=[]
 for c in sorted(ALL,key=lambda x:x.n):
  d=c.finish();name=f'{c.n:02d}. {c.title}';jsonfile=OUT/(name+'.json')
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
  reports.append(dict(file=name+'.json',**report,manualReview='source and generated preview compared visually',targetAppVerified=False))
  payload.append(saved);checksums.append(dict(file=str(c.source.relative_to(ROOT)),sha256=d['reviewMetadata']['sourceSha256'],width=Image.open(c.source).width,height=Image.open(c.source).height,reviewRotationClockwise=90 if c.portrait else 0))
 (OUT/'manifest.json').write_text(json.dumps(dict(vehicle='Honda SH Mode 2023–2025',circuits=entries),ensure_ascii=False,indent=2),encoding='utf8')
 (OUT/'source-checksums.json').write_text(json.dumps(checksums,ensure_ascii=False,indent=2),encoding='utf8')
 (OUT/'review-report.json').write_text(json.dumps(dict(status='draft',method='manual source transcription; structural JSON and render validation',allStructuralChecksPassed=True,targetAppVerified=False,browserUiTested=False,reviewPageChecks='JavaScript syntax and local asset existence only; browser unavailable',electricalSimulationValidated=False,limitations=['Ký hiệu được vẽ lại bằng vector, hình dáng không trùng từng pixel với ảnh nguồn.','Ảnh gốc có watermark; preview dùng nền trắng và không tái tạo watermark.','FOB là hình vector minh họa thay cho ảnh chụp trong sơ đồ Smartkey.','Hai sơ đồ Smartkey và PGM-FI xoay 90 độ theo chiều kim đồng hồ để đọc; sourceTransform lưu phép xoay.','Giắc tham chiếu 6P/21P/39P/5P/3P giữ nhãn/số chân nhìn thấy; đường viền vỏ giắc được giản lược.','Chưa kiểm thử nhập/xuất trên ứng dụng đích hoặc kiểm chứng điện thực tế.'],circuits=reports),ensure_ascii=False,indent=2),encoding='utf8')
 (OUT/'diagram-renderer.js').write_bytes((ROOT/'web'/'diagram-renderer.js').read_bytes())
 make_review(entries,payload)
 (OUT/'README.md').write_text('''# SH Mode 2023–2025\n\n12 mạch JSON theo ảnh trong FILE ANH/SH Mode 2023-2025. Mỗi mạch có PNG 2× và SVG dựng từ JSON. Mở review.html để xem ảnh gốc và bản dựng cạnh nhau, hoặc chọn chồng ảnh để kiểm tra sai lệch. Trang mở trực tiếp từ file, không cần mạng.\n\nGiữ schemaVersion=1 và vehicleId/vehicleTitle=thang theo bộ AirBlade để tương thích kiểm tra project hiện tại. Tên xe thật nằm trong vehicleModel. ID các mạch dùng tiền tố sh-mode-2023-2025.\n\nLớp components/wires lưu linh kiện, chân và đường dây; drawing lưu vector chi tiết. Khi chỉnh components/wires cần dựng lại drawing để preview đồng bộ. sourceTransform ghi chiều xoay của hai sơ đồ dọc. Không dùng bitmap ảnh gốc trong drawing.\n\nreview-report.json ghi kiểm tra tham chiếu chân, tọa độ đầu dây, ID và các giới hạn đối chiếu. Trạng thái draft vì chưa kiểm thử ứng dụng đích và chưa kiểm chứng điện thực tế. Màu dây lấy trung vị RGB vùng 3×3 từ ảnh; tọa độ gốc nằm trong colorReference. Trang review đã kiểm tra cú pháp JavaScript và các liên kết file, chưa chạy trong trình duyệt do phiên không có trình duyệt khả dụng. Đây là bản chép theo ảnh được cung cấp, không phải tài liệu sửa chữa chính hãng.\n\nDựng lại: python tools/build_sh_mode.py\nDựng riêng: python tools/render_schematic.py "File JSON chuẩn/SH Mode 2023-2025/02. Mạch còi.json" --out "review/sh-mode-horn" --scale 2\n''',encoding='utf8')
 archive=ROOT/'review'/'SH-Mode-2023-2025-JSON-preview.zip';archive.parent.mkdir(exist_ok=True)
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
  for f in OUT.rglob('*'):
   if f.is_file():z.write(f,'SH Mode 2023-2025/'+str(f.relative_to(OUT)).replace('\\','/'))
  for f in SRC.glob('*.PNG'):z.write(f,'FILE ANH/SH Mode 2023-2025/'+f.name)
  z.write(Path(__file__),'tools/build_sh_mode.py')
  for f in ['render_schematic.py','schematic_symbols.py','rebuild_airblade.py']:z.write(ROOT/'tools'/f,'tools/'+f)
 print(json.dumps(dict(circuits=len(entries),components=sum(r['componentCount'] for r in reports),wires=sum(r['wireCount'] for r in reports),out=str(OUT),archive=str(archive)),ensure_ascii=False))

def make_review(entries,payload):
 cards=[]
 for i,e in enumerate(entries):
  esc=lambda s:html.escape(s,quote=True)
  cards.append(f'<article id="c{i}"><h2>{e["number"]:02d}. {esc(e["title"])}</h2><nav><a href="{esc(e["json"])}" download>JSON</a><a href="{esc(e["png"])}" download>PNG 2×</a><a href="{esc(e["svg"])}" download>SVG</a><button data-reset="{i}">Dựng lại từ JSON</button><label><input class="overlay" type="checkbox"> Chồng ảnh</label><label class="slider">Độ mờ <input class="opacity" type="range" min="0" max="100" value="50"></label></nav><div class="pair"><figure><figcaption>Ảnh nguồn</figcaption><img class="original" src="{esc(e["source"])}" alt="Ảnh nguồn {esc(e["title"])}"></figure><figure><figcaption>Bản vector dựng từ JSON</figcaption><div class="vector" data-index="{i}"></div></figure></div><details><summary>Chỉnh JSON và dựng preview</summary><p>Thay đổi trong ô này chỉ ảnh hưởng phiên review. Tải JSON đã sửa bằng nút bên dưới.</p><textarea spellcheck="false" data-editor="{i}"></textarea><button data-apply="{i}">Áp dụng và dựng lại</button><button data-download="{i}">Tải JSON đang xem</button><output data-status="{i}"></output></details></article>')
 data=json.dumps(payload,ensure_ascii=False).replace('</','<\\/')
 page='''<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Review JSON SH Mode 2023–2025</title><style>
 *{box-sizing:border-box}body{margin:0;background:#eef2f6;color:#182a3a;font:15px Arial,sans-serif}header{padding:25px 28px;background:#143d56;color:white}h1{margin:0 0 10px;font-size:27px}header p{margin:8px 0;max-width:1100px;line-height:1.55}main{padding:20px;max-width:1800px;margin:auto}article{background:white;border:1px solid #cad7e0;border-radius:10px;margin-bottom:24px;padding:18px}h2{font-size:19px;margin:0 0 13px}nav{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:12px}a,button{color:#104970;border:1px solid #b7c7d2;background:#f5f9fb;border-radius:5px;padding:7px 12px;text-decoration:none;cursor:pointer}label{display:flex;align-items:center;gap:6px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}figure{margin:0;min-width:0}figcaption{background:#eaf0f4;padding:8px;text-align:center;font-size:13px}img,svg{width:100%;height:auto;display:block}.vector{background:white;overflow:hidden}details{margin-top:14px}summary{cursor:pointer;color:#104970}textarea{width:100%;height:280px;margin:10px 0;font:12px Consolas,monospace}.slider{display:none}article.overlaid .pair{display:block;position:relative}article.overlaid figure+figure{position:absolute;inset:0}article.overlaid figure+figure figcaption{visibility:hidden}article.overlaid .vector{background:transparent}article.overlaid .slider{display:flex}output{margin-left:12px;color:#335f34}footer{padding:18px;color:#526679;font-size:13px}@media(max-width:850px){.pair{grid-template-columns:1fr}main{padding:10px}header{padding:20px}article{padding:12px}}
 </style><header><h1>SH Mode 2023–2025 · 12 sơ đồ điện</h1><p>Ảnh nguồn bên trái, bản vector dựng trực tiếp từ JSON bên phải. Có thể tải từng JSON, PNG hoặc SVG; chồng ảnh để đối chiếu vị trí dây và ký hiệu.</p><p>Đã kiểm tra cấu trúc và đầu dây. Ký hiệu/vỏ giắc được vẽ lại; FOB là hình minh họa. Smartkey và PGM-FI được xoay dọc cho dễ đọc. Chưa kiểm thử ứng dụng đích hoặc kiểm chứng điện thực tế.</p></header><main>'''+''.join(cards)+'''</main><footer>Đối chiếu theo ảnh được cung cấp · Xem review-report.json và source-checksums.json để biết kiểm tra và nguồn.</footer><script src="diagram-renderer.js"></script><script id="data" type="application/json">'''+data+'''</script><script>
 const originals=JSON.parse(document.getElementById('data').textContent);const active=structuredClone(originals);
 function renderOne(i){const host=document.querySelector('.vector[data-index="'+i+'"]');host.replaceChildren(SchematicRenderer.render(active[i]));document.querySelector('[data-editor="'+i+'"]').value=JSON.stringify(active[i],null,2);const svg=host.querySelector('svg');svg.querySelector('rect')?.setAttribute('fill','transparent');}
 active.forEach((_,i)=>renderOne(i));
 document.addEventListener('click',e=>{let i;if(e.target.dataset.reset!==undefined){i=+e.target.dataset.reset;active[i]=structuredClone(originals[i]);renderOne(i);}if(e.target.dataset.apply!==undefined){i=+e.target.dataset.apply;try{const d=JSON.parse(document.querySelector('[data-editor="'+i+'"]').value);if(!d.drawing||!Array.isArray(d.drawing.elements))throw Error('Thiếu drawing.elements');active[i]=d;renderOne(i);document.querySelector('[data-status="'+i+'"]').textContent='Đã dựng lại từ JSON.';}catch(err){document.querySelector('[data-status="'+i+'"]').textContent=err.message;}}if(e.target.dataset.download!==undefined){i=+e.target.dataset.download;const u=URL.createObjectURL(new Blob([JSON.stringify(active[i],null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=(i+1).toString().padStart(2,'0')+'. '+active[i].circuitTitle+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}});
 document.querySelectorAll('article').forEach(a=>{const v=a.querySelector('.vector');a.querySelector('.overlay').addEventListener('change',e=>{a.classList.toggle('overlaid',e.target.checked);v.style.opacity=e.target.checked?a.querySelector('.opacity').value/100:1;});a.querySelector('.opacity').addEventListener('input',e=>{v.style.opacity=e.target.value/100;});});
 </script></html>'''
 (OUT/'review.html').write_text(page,encoding='utf8')

if __name__=='__main__':main()
