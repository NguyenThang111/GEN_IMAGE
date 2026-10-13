"""Facts transcribed from source PNGs, NOT generated from candidate JSON.

Coordinates are in the ORIGINAL 1687 x 952 screenshots. Candidate IDs below
are bindings only. Updating a candidate must never regenerate these facts.
Coverage is deliberately partial until every symbol, string and net is reviewed.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'FILE ANH' / '01.AirBlade-2011-2012'
CANDIDATES = ROOT / 'File JSON chuẩn' / '01.AirBlade-2011-2012'
OUTPUT = ROOT / 'review' / 'independent-check'
CROP = [127, 64, 1499, 844]

# number, source timestamp, negative post, positive post, main relay binding,
# contact input/output and coil input/output. Pixel tolerance reflects source AA.
TABLE = [
 ('01','08-37-20',(202,459),(257,459),'main-relay',
  [('contact-in',917,336),('contact-out',994,336),('coil-left',917,412),('coil-right',994,412)]),
 ('02','08-37-27',(219,475),(278,475),'main-relay',
  [('contact-left',925,420),('contact-right',1001,420),('coil-left',925,494),('coil-right',1001,494)]),
 ('03','08-37-33',(219,502),(278,502),'main-relay',
  [('contact-left',718,447),('contact-right',794,447),('coil-left',718,521),('coil-right',794,521)]),
 ('04','08-37-39',(221,451),(282,451),'main-relay',
  [('contact-left',735,394),('contact-right',813,394),('coil-left',735,471),('coil-right',813,471)]),
 ('05','08-37-45',(209,343),(269,343),'main-relay',
  [('contact-left',923,288),('contact-right',999,288),('coil-left',923,362),('coil-right',999,362)]),
 ('06','08-37-50',(218,437),(276,437),'main-relay',
  [('contact-left',707,382),('contact-right',783,382),('coil-left',707,456),('coil-right',783,456)]),
 ('07','08-37-55',(218,301),(275,301),None,[]),
 ('08','08-38-06',(241,345),(300,345),'relay-main',
  [('contact-in',964,135),('contact-out',1040,135),('coil-left',964,187),('coil-right',1040,187)]),
 ('09','08-38-12 (1)',(213,349),(273,349),'relay-main',
  [('contact-left',774,141),('contact-right',849,142),('coil-left',774,219),('coil-right',849,219)]),
 ('10','08-38-16',(260,844),(260,788),'main-relay',
  [('contact-top',222,313),('contact-bottom',222,389),('coil-top',289,313),('coil-bottom',289,389)]),
]

def port(name, xy, label=None):
    return dict(ref=name, xy=list(xy), label=label)

def net(*ports):
    return list(ports)

def references():
    result = {}
    for number, stamp, negative, positive, relay, pins in TABLE:
        neg, pos = ('neg','pos') if number == '10' else ('negative','positive')
        anchors = [port('battery.'+neg, negative),port('battery.'+pos,positive)]
        anchors += [port(relay+'.'+name,(x,y)) for name,x,y in pins]
        result[number] = dict(number=number,source='Screenshot from 2026-09-30 '+stamp+'.png',
            crop=CROP, anchors=anchors, nets=[], edges=[], texts=[],
            battery=dict(negative='battery.'+neg,positive='battery.'+pos),
            coverage=dict(all_nets=False,all_text=False,all_symbols=False,app_render=False),
            method='Đọc trực tiếp ảnh PNG; tọa độ gốc. ID chỉ liên kết với đối tượng cần kiểm tra.')

    horn = result['02']
    horn['anchors'] += [port(k,v) for k,v in {
        'ground-battery.in':(174,517),'fuse-main.left':(425,420),'fuse-main.right':(507,420),
        'fuse-fi.left':(425,494),'fuse-fi.right':(507,494),'ignition-switch.left':(649,494),
        'ignition-switch.right':(727,494),'ecm.top':(1070,594),
        'fuse-turn-horn.left':(1129,420),'fuse-turn-horn.right':(1212,420),
        'horn-switch.left':(1325,420),'horn-switch.right':(1408,420),
        'horn.left':(1497,420),'horn.right':(1540,420),'ground-horn.in':(1579,483)}.items()]
    horn['nets'] = [
        net('battery.negative','ground-battery.in'),
        net('battery.positive','fuse-main.left','fuse-fi.left'),
        net('fuse-main.right','main-relay.contact-left'),
        net('fuse-fi.right','ignition-switch.left'),
        net('ignition-switch.right','main-relay.coil-left'),
        net('main-relay.coil-right','ecm.top'),
        net('main-relay.contact-right','fuse-turn-horn.left'),
        net('fuse-turn-horn.right','horn-switch.left'),
        net('horn-switch.right','horn.left'),net('horn.right','ground-horn.in')]
    # Edge color codes are transcribed, not inferred from names or standard practice.
    horn['edges'] = [
        ('battery.negative','ground-battery.in','G'),
        ('battery.positive','fuse-main.left','R'),('battery.positive','fuse-fi.left','R'),
        ('fuse-main.right','main-relay.contact-left','R/W'),
        ('fuse-fi.right','ignition-switch.left','R/Bl'),
        ('ignition-switch.right','main-relay.coil-left','Bl'),
        ('main-relay.coil-right','ecm.top','W/Bl'),
        ('main-relay.contact-right','fuse-turn-horn.left','R/Y'),
        ('fuse-turn-horn.right','horn-switch.left','Bl/Br'),
        ('horn-switch.right','horn.left','Lg'),('horn.right','ground-horn.in','G')]
    horn['coverage']['all_nets'] = True
    # ROIs encompass the reference label with room for small typesetting changes.
    horn['texts'] = [
        ('ẮC QUY',[195,511,300,546]),('CẦU CHÌ (20A) MAIN',[390,366,548,397]),
        ('CẦU CHÌ (10A) FI',[399,445,539,474]),('CÔNG TẮC MÁY',[621,434,754,468]),
        ('RƠ LE CHÍNH',[905,363,1015,398]),('CẦU CHÌ (10A) TURN,HORN...',[1055,374,1284,401]),
        ('CÔNG TẮC CÒI',[1303,347,1447,381]),('CÒI',[1479,310,1551,341]),
        ('ECM',[1027,594,1115,653]),('R/W',[666,396,721,417]),
        ('R/Bl',[522,469,573,491]),('W/Bl',[1010,466,1068,490]),
        ('Bl/Br',[1238,394,1295,418]),('Lg',[1432,394,1478,418])]

    start = result['08']
    start['anchors'] += [port(k,v) for k,v in {
        'relay-starter.contact-in':(372,462),'relay-starter.contact-out':(372,545),
        'relay-starter.coil-top':(424,462),'relay-starter.coil-bottom':(424,545),
        'fuse-main.left':(441,135),'fuse-main.right':(524,135),
        'fuse-fi.left':(441,231),'fuse-fi.right':(524,231),
        'switch-ignition.left':(666,231),'switch-ignition.right':(744,230),
        'fuse-turn-horn.left':(1201,135),'fuse-turn-horn.right':(1284,135),
        'switch-brake-rear.top':(1340,295),'switch-brake-rear.bottom':(1340,373),
        'switch-brake-front.top':(1482,295),'switch-brake-front.bottom':(1482,373),
        'switch-start.left':(1155,498),'switch-start.right':(1235,498),
        'switch-side-stand.left':(1162,597),'switch-side-stand.right':(1240,597),
        'motor-starter.power':(372,685),'motor-starter.left-lug':(305,693),
        'motor-starter.right-lug':(438,693),'motor-starter.bottom':(372,804),
        'resistor.top':(1412,563),'resistor.bottom':(1412,648),
        'ground-battery.top':(151,380),'ground-motor-wire.top':(557,760),
        'ground-motor.top':(372,834),'ground-side-stand.top':(1290,654),
        'ground-resistor.top':(1412,678)}.items()]
    for pin,x in [(33,825),(1,876),(7,928),(29,977),(25,1027)]:
        start['anchors'].append(port('ecm.pin-'+str(pin),(x,665),str(pin)))
        start['texts'].append((str(pin),[x-12,663,x+12,696]))
    start['nets'] = [
        net('battery.negative','ground-battery.top','motor-starter.left-lug'),
        net('battery.positive','fuse-main.left','fuse-fi.left','relay-starter.contact-in'),
        net('fuse-main.right','relay-main.contact-in'),net('fuse-fi.right','switch-ignition.left'),
        net('switch-ignition.right','relay-main.coil-left','relay-starter.coil-top','ecm.pin-1'),
        net('relay-main.coil-right','ecm.pin-7'),net('relay-main.contact-out','fuse-turn-horn.left'),
        net('fuse-turn-horn.right','switch-brake-front.top','switch-brake-rear.top'),
        net('switch-brake-front.bottom','switch-brake-rear.bottom','switch-start.right','resistor.top'),
        net('switch-start.left','ecm.pin-29'),net('ecm.pin-25','switch-side-stand.left'),
        net('switch-side-stand.right','ground-side-stand.top'),
        net('relay-starter.coil-bottom','ecm.pin-33'),net('relay-starter.contact-out','motor-starter.power'),
        net('motor-starter.right-lug','ground-motor-wire.top'),
        net('motor-starter.bottom','ground-motor.top'),net('resistor.bottom','ground-resistor.top')]
    start['edges'] = [('fuse-main.right','relay-main.contact-in','R/W'),
        ('fuse-fi.right','switch-ignition.left','R/Bl'),('relay-main.coil-right','ecm.pin-7','W/Bl'),
        ('relay-starter.coil-bottom','ecm.pin-33','Y/G'),('relay-starter.contact-out','motor-starter.power','R/W'),
        ('switch-start.left','ecm.pin-29','Y/G'),('ecm.pin-25','switch-side-stand.left','G/W')]
    start['coverage']['all_nets'] = True

    total = result['10']
    upper = [(7,'PRC',501),(20,'SOLV',563),(1,'IGP',656),(8,'FLR',735),(16,'INJ',805),
             (11,'IGP-LS',918),(33,'S/RELAY',1164),(22,'FI WARN',1229),(18,'TW WARN',1300)]
    lower = [(12,'PCP',501),(23,'PCM',557),(6,'VCC',645),(5,'THL',672),(4,'SG1',698),
             (14,'TA',749),(24,'TW',849),(31,'SG2',893),(3,'O₂',955),(25,'SSTAND',1051),
             (30,'K-LINE',1146),(15,'SCS',1171),(2,'LG',1197),(10,'PG2',1226),(9,'PG1',1252),(29,'STSW',1354)]
    for rows,y,roi_y in [(upper,461,(460,536)),(lower,614,(540,616))]:
        for pin,name,x in rows:
            total['anchors'].append(port('ecm.p'+str(pin),(x,y),str(pin)+' '+name))
            # Source prints number and signal in separate places along each white pin strip.
            total['texts'].extend([(str(pin),[x-11,roi_y[0],x+11,roi_y[1]]),
                                   (name,[x-11,roi_y[0],x+11,roi_y[1]])])
    total['anchors'] += [port(k,v) for k,v in {
        'starter-relay.contact-in':(860,140),'starter-relay.contact-out':(942,140),
        'starter-relay.coil-in':(860,190),'starter-relay.coil-out':(942,190),
        'tp.vcc':(645,756),'tp.signal':(672,756),'tp.return':(698,756),
        'oxygen.signal':(955,733),'ckp.left':(501,703),'ckp.right':(557,703),
        'iat.signal':(749,761),'iat.return':(793,761),'ect.signal':(849,760),'ect.return':(893,760),
        'dlc.bl':(1120,717),'dlc.ow':(1146,717),'dlc.br':(1171,717),'dlc.gbl':(1197,717)}.items()]
    total['nets'] = [
        net('battery.pos','fuse-main.bottom','fuse-fi.bottom','starter-relay.contact-in'),
        net('battery.neg','battery-ground.in'),
        net('fuse-main.top','main-relay.contact-bottom','regulator.rw'),
        net('fuse-fi.top','ignition-switch.bottom','capacitor.bottom'),
        net('capacitor.top','capacitor-ground.in'),net('regulator.g','regulator-ground.in'),
        net('regulator.y1','acg.phase-bottom'),net('regulator.y2','acg.phase-left'),net('regulator.y3','acg.phase-top'),
        net('main-relay.contact-top','fuse-horn.bottom'),net('main-relay.coil-top','ecm.p7'),
        net('main-relay.coil-bottom','ignition-switch.top','ecm.p1','starter-relay.coil-in',
            'idle-valve.upper','fuel-pump.top','injector.upper','ignition-coil.upper','dlc.bl'),
        net('starter-relay.coil-out','ecm.p33'),net('starter-relay.contact-out','starter-motor.pos'),
        net('starter-motor.neg','starter-ground.in'),net('idle-valve.lower','ecm.p20'),
        net('fuel-pump.bottom','ecm.p8'),net('injector.lower','ecm.p16'),net('ignition-coil.lower','ecm.p11'),
        net('ignition-coil.ht','spark-plug.ht'),net('mil.bottom','ecm.p22'),net('temperature-lamp.bottom','ecm.p18'),
        net('fuse-horn.top','mil.top','temperature-lamp.top','front-brake-switch.top','rear-brake-switch.top'),
        net('front-brake-switch.bottom','rear-brake-switch.bottom','starter-switch.top'),
        net('starter-switch.bottom','ecm.p29'),net('ecm.p12','ckp.left'),net('ecm.p23','ckp.right'),
        net('ecm.p6','tp.vcc'),net('ecm.p5','tp.signal'),net('ecm.p4','tp.return','iat.return'),
        net('ecm.p14','iat.signal'),net('ecm.p24','ect.signal'),net('ecm.p31','ect.return'),
        net('ecm.p3','oxygen.signal'),net('ecm.p25','side-stand-switch.top'),
        net('side-stand-switch.bottom','stand-ground.in'),net('ecm.p30','dlc.ow'),net('ecm.p15','dlc.br'),
        net('ecm.p2','ecm.p10','ecm.p9','dlc.gbl','ecm-ground.in')]
    total['edges'] = [('ecm.p5','tp.signal','W/R'),('ecm.p3','oxygen.signal','Bl/O'),
        ('ecm.p12','ckp.left','Bu/Y'),('ecm.p23','ckp.right','W/Y'),('ecm.p6','tp.vcc','Y/O'),
        ('ecm.p4','tp.return','G/O'),('ecm.p4','iat.return','G/O'),('ecm.p14','iat.signal','Gr/Bu'),
        ('ecm.p24','ect.signal','P/W'),('ecm.p31','ect.return','G/R'),
        ('main-relay.coil-top','ecm.p7','W/Bl'),('starter-relay.coil-out','ecm.p33','Y/G'),
        ('injector.lower','ecm.p16','P/Bu'),('ignition-coil.lower','ecm.p11','Y/Bu'),
        ('ecm.p25','side-stand-switch.top','G/W'),('ecm.p30','dlc.ow','O/W'),('ecm.p15','dlc.br','Br')]
    total['coverage']['all_nets'] = True
    total['texts'] += [
        ('Ghi chú',[1460,730,1490,825]),
        ('DTC / MÃ MIL',[1480,650,1515,770]),
        ('ĐỘNG CƠ KHÔNG KHỞI ĐỘNG NẾU CÓ HƯ HỎNG',[1510,433,1549,781]),
        ('CÁC ĐẦU CỰC NGẮN ĐỂ ĐỌC DTC / MÃ MIL',[1544,467,1580,782])]
    # Further nets traced visually on the remaining supplied PNGs. These are
    # explicit source facts; no candidate is loaded by this module.
    bindings={
        '03':('ground-battery.in','fuse-main','fuse-fi','engine-switch','fuse-turn-horn'),
        '04':('battery-ground.top','main-fuse','fi-fuse','ignition-switch','turn-horn-fuse'),
        '05':('ground-battery.in','fuse-main','fuse-fi','ignition-switch','fuse-turn-horn'),
        '06':('ground-battery.in','fuse-main','fuse-fi','ignition-switch','fuse-turn'),
        '09':('ground-battery.top','fuse-main','fuse-fi','switch-ign','fuse-turn')}
    for n,(ground,main,fi,ign,turn) in bindings.items():
        r=result[n];rel='relay-main' if n=='09' else 'main-relay'
        r['nets']=[net('battery.negative',ground),net('battery.positive',main+'.left',fi+'.left'),
            net(main+'.right',rel+'.contact-left'),net(fi+'.right',ign+'.left'),
            net(ign+'.right',rel+'.coil-left'),net(rel+'.coil-right','ecm.top'),
            net(rel+'.contact-right',turn+'.left')]
        r['edges']=[('battery.negative',ground,'G'),('battery.positive',main+'.left','R'),
            ('battery.positive',fi+'.left','R'),(main+'.right',rel+'.contact-left','R/W'),
            (fi+'.right',ign+'.left','R/Bl'),(ign+'.right',rel+'.coil-left','Bl'),
            (rel+'.coil-right','ecm.top','W/Bl'),(rel+'.contact-right',turn+'.left','R/Y')]
    result['03']['nets'] += [net('fuse-turn-horn.right','flasher.left'),net('flasher.right','diode.left'),
        net('diode.right','turn-switch.common'),net('turn-switch.upper','turn-left.feed'),
        net('turn-switch.lower','turn-right.feed'),net('turn-left.return','ground-left.in'),net('turn-right.return','ground-right.in')]
    result['03']['edges'] += [('fuse-turn-horn.right','flasher.left','Bl/Br'),('flasher.right','diode.left','Gr'),
        ('diode.right','turn-switch.common','Gr'),('turn-switch.upper','turn-left.feed','O'),
        ('turn-switch.lower','turn-right.feed','Lb')]
    result['04']['nets'] += [net('turn-horn-fuse.right','front-brake-switch.left','rear-brake-switch.left'),
        net('front-brake-switch.right','rear-brake-switch.right','brake-tail-lamp.upper-left','load-resistor.top'),
        net('brake-tail-lamp.lower-left','lamp-ground.top'),net('load-resistor.bottom','resistor-ground.top')]
    result['04']['edges'] += [('front-brake-switch.right','rear-brake-switch.right','G/Y'),
        ('brake-tail-lamp.lower-left','lamp-ground.top','G'),('load-resistor.bottom','resistor-ground.top','G')]
    result['05']['nets'] += [net('fuse-turn-horn.right','fuel-gauge.upper-left'),
        net('fuel-gauge.middle-left','fuel-sender.top-left'),
        net('fuel-gauge.lower-left','fuel-sender.top-right','ground-fuel.in')]
    result['05']['edges'] += [('fuse-turn-horn.right','fuel-gauge.upper-left','Bl/Br'),
        ('fuel-gauge.middle-left','fuel-sender.top-left','Y/W'),('fuel-gauge.lower-left','fuel-sender.top-right','G/Bl')]
    result['06']['nets'][-1].append('fuse-head.left')
    result['06']['nets'] += [net('fuse-head.right','night-switch.in1'),net('fuse-turn.right','night-switch.in2'),
        net('night-switch.out1','dimmer.common'),net('dimmer.upper','high-indicator.feed','headlamp.high'),
        net('dimmer.lower','headlamp.low'),net('high-indicator.return','ground-high.in'),net('headlamp.return','ground-head.in'),
        net('night-switch.out2','position.feed','license.feed','tail.feed'),net('position.return','ground-position.in'),
        net('license.return','ground-license.in'),net('tail.return','ground-tail.in')]
    result['06']['edges'] += [('fuse-head.right','night-switch.in1','Y'),('fuse-turn.right','night-switch.in2','Bl/Br'),
        ('night-switch.out1','dimmer.common','Bu/W'),('dimmer.upper','headlamp.high','Bu'),('dimmer.lower','headlamp.low','W'),
        ('night-switch.out2','position.feed','Br'),('night-switch.out2','license.feed','Br'),('night-switch.out2','tail.feed','Br')]
    result['07']['nets'] = [net('battery.negative','ground-battery.in'),net('battery.positive','fuse-fi.left'),
        net('fuse-fi.right','capacitor.top','main-switch.in'),net('capacitor.bottom','ground-capacitor.in'),
        net('main-switch.out','ecm.pin-1','ignition-coil.right'),net('ecm.pin-11','ignition-coil.left'),
        net('ecm.pin-12','ckp.upper'),net('ecm.pin-23','ckp.lower'),
        net('ecm.pin-25','side-stand-switch.right'),
        net('ecm.pin-9','ecm.pin-2','ecm.pin-10','ground-ecm.in','side-stand-switch.left'),
        net('ignition-coil.hv','spark-plug.top')]
    result['07']['edges'] = [('main-switch.out','ecm.pin-1','Bl'),('main-switch.out','ignition-coil.right','Bl'),
        ('ecm.pin-11','ignition-coil.left','Y/Bu'),('ecm.pin-12','ckp.upper','Bu/Y'),
        ('ecm.pin-23','ckp.lower','W/Y'),('ecm.pin-25','side-stand-switch.right','G/W')]
    for pin,x in [(23,914),(12,954),(1,994),(11,1035),(25,1075),(9,1115),(2,1155),(10,1201)]:
        result['07']['anchors'].append(port('ecm.pin-'+str(pin),(x,679),str(pin)))
        result['07']['texts'].append((str(pin),[x-12,679,x+12,705]))
    result['09']['nets'][1].append('fuse-answer.left')
    result['09']['nets'] += [net('fuse-answer.right','led-seat.upper','led-key.upper','locator.p1'),
        net('fuse-turn.right','locator.p6'),net('led-seat.lower','locator.p7'),net('led-key.lower','locator.p8'),
        net('locator.p10','ground-locator.top'),net('locator.p3','lamp-left.upper'),
        net('locator.p2','lamp-right.upper'),net('locator.p4','horn.upper'),net('locator.p5','horn.lower'),
        net('lamp-left.lower','ground-left.top'),net('lamp-right.lower','ground-right.top')]
    result['09']['edges'] += [('fuse-answer.right','locator.p1','P/Bl'),('fuse-answer.right','led-seat.upper','P/Bl'),
        ('fuse-answer.right','led-key.upper','P/Bl'),('fuse-turn.right','locator.p6','Bl/Br'),
        ('led-seat.lower','locator.p7','Gr'),('led-key.lower','locator.p8','Gr'),
        ('locator.p10','ground-locator.top','G'),('locator.p3','lamp-left.upper','O'),
        ('locator.p2','lamp-right.upper','Lb'),('locator.p4','horn.upper','Bu'),('locator.p5','horn.lower','G/P')]
    for pin,x in [(10,774),(8,817),(7,858),(1,899),(6,940),(3,986),(2,1032),(4,1078),(5,1124)]:
        result['09']['anchors'].append(port('locator.p'+str(pin),(x,684),str(pin)))
        result['09']['texts'].append((str(pin),[x-12,706,x+12,740]))
    for n in ['03','04','05','06','07','09']:result[n]['coverage']['all_nets']=True
    power=result['01']
    power['nets']=[net('battery.negative','battery-ground.in'),
        net('battery.positive','fuse-answer-back.in','fuse-main.in','fuse-fi.in'),
        net('fuse-answer-back.out','answer-loads.in'),
        net('fuse-main.out','main-relay.contact-in','regulator.dc'),
        net('fuse-fi.out','ignition-switch.in','capacitor.positive'),
        net('ignition-switch.out','main-relay.coil-left','engine-loads.in'),
        net('main-relay.coil-right','ecm.relay-control'),
        net('main-relay.contact-out','fuse-headlight.in','fuse-turn-horn.in'),
        net('fuse-headlight.out','night-light-switch.in'),net('fuse-turn-horn.out','turn-loads.in'),
        net('capacitor.ground','capacitor-ground.in'),net('regulator.ground','regulator-ground.in'),
        net('regulator.ac-upper','acg.left'),net('regulator.ac-middle','acg.top'),net('regulator.ac-lower','acg.right')]
    power['edges']=[('fuse-answer-back.out','answer-loads.in','P/Bl'),
        ('fuse-main.out','main-relay.contact-in','R/W'),('fuse-main.out','regulator.dc','R/W'),
        ('fuse-fi.out','ignition-switch.in','R/Bl'),('ignition-switch.out','engine-loads.in','Bl'),
        ('main-relay.coil-right','ecm.relay-control','W/Bl'),
        ('main-relay.contact-out','fuse-headlight.in','R/Y'),('main-relay.contact-out','fuse-turn-horn.in','R/Y'),
        ('fuse-headlight.out','night-light-switch.in','Y'),('fuse-turn-horn.out','turn-loads.in','Bl/Br')]
    power['coverage']['all_nets']=True
    return result
