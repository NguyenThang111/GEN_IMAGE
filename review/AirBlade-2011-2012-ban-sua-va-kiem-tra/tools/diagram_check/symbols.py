"""New pin-aware battery/relay drawings, constructed from source anchor geometry.

No import or geometry copied from the previous symbol library. Pins are explicit
named roles, never determined by the order of component.terminals. The body and
coil proportions remain a vector reconstruction, not a pixel-exact source claim.
"""
import math

INK='#555555'

def path(pts,**kw):return dict(kind='path',points=[list(p) for p in pts],stroke=INK,width=1.4,**kw)
def rect(x,y,w,h,fill):return path([(x,y),(x+w,y),(x+w,y+h),(x,y+h)],closed=True,fill=fill)
def circle(x,y,r):return path([(x+r*math.cos(i*math.pi/32),y+r*math.sin(i*math.pi/32)) for i in range(64)],closed=True,fill='#ffffff')

def battery(negative,positive):
    distance=math.dist(negative,positive);s=distance/60
    ux=(positive[0]-negative[0])/60;uy=(positive[1]-negative[1])/60
    # Body extends perpendicular to the line from minus to plus, as in the source.
    matrix=[ux,uy,-uy,ux,negative[0],negative[1]]
    shapes=[rect(-20,9,100,64,'#e5e5e5'),rect(-8,0,16,9,'#ffffff'),rect(52,0,16,9,'#ffffff'),
        circle(0,23,9.5),circle(60,23,9.5)]
    minus=path([(-8,23),(8,23)]);minus['stroke']='#5cac83';minus['width']=1
    plus1=path([(52,23),(68,23)]);plus1['stroke']='#d16473';plus1['width']=1
    plus2=path([(60,15),(60,31)]);plus2['stroke']='#d16473';plus2['width']=1
    shapes.extend([minus,plus1,plus2,dict(kind='text',text='ẮC QUY',x=30,y=58,size=14,anchor='middle',bold=True,fill='#343434')])
    return shapes,matrix,dict(negative=[0,0],positive=[60,0])

def relay(pins,vertical=False,open_contact=False):
    """Four source-coordinate ports define orientation and contact/coil spacing."""
    contacts=[(k,p) for k,p in pins.items() if 'contact' in k]
    coils=[(k,p) for k,p in pins.items() if 'coil' in k]
    axis=1 if vertical else 0
    contacts.sort(key=lambda t:t[1][axis]);coils.sort(key=lambda t:t[1][axis])
    # For vertical relay, local +x runs DOWN; local +y runs RIGHT.
    start=contacts[0][1];end=contacts[1][1]
    width=abs(end[axis]-start[axis])
    # Source frames are axis-aligned; a 1px raster difference between opposite
    # contacts must not tilt the body and displace the coil's boundary ports.
    ux,uy=(0,1) if vertical else (1,0)
    vx,vy=(uy,-ux) if vertical else (-uy,ux)
    def local(p):
        delta=(p[0]-start[0],p[1]-start[1])
        return (delta[0]*ux+delta[1]*uy,delta[0]*vx+delta[1]*vy)
    coil_left=local(coils[0][1]);coil_right=local(coils[1][1])
    gap=(coil_left[1]+coil_right[1])/2
    # Source has 18-24px above contacts and 14-17px below coils.
    margin=20 if not vertical else 22
    shapes=[rect(0,-margin,width,gap+margin+16,'#fbfca7')]
    radius=6.5;left=width*.23;right=width*.76
    right_y=local(end)[1]
    shapes += [path([(0,0),(left-radius,0)]),path([(right+radius,right_y),(width,right_y)]),circle(left,0,radius),circle(right,right_y,radius)]
    bar=[(left-2,0),(left+9,-13),(right+1,-13)] if open_contact else [(left-2,-12),(right+1,-12)]
    shapes.append(path(bar))
    begin=width*.16;finish=width*.84
    shapes.extend([path([coil_left,(begin,gap)]),path([(finish,gap),coil_right])])
    points=[]
    for i in range(241):
        t=i/240;phase=t*math.pi*8
        points.append((begin+(finish-begin)*t+6.5*math.sin(phase),gap-5*(1-math.cos(phase))))
    shapes.append(path(points))
    anchors={k:list(local(p)) for k,p in pins.items()}
    return shapes,[ux,uy,vx,vy,*start],anchors
