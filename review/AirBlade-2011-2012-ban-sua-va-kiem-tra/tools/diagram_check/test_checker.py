"""Fault injection against actual candidate files; source facts remain frozen."""
import copy
import json
import tempfile
import unittest
from pathlib import Path

from check import source_palette
from core import Audit, verify_source
from reference import CANDIDATES, SOURCE, references

class FaultInjection(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.refs=references();cls.palette=source_palette(cls.refs)
        cls.docs={n:json.loads(next(CANDIDATES.glob(n+'. *.json')).read_text('utf8')) for n in ['02','10']}
    def setUp(self):self.d=copy.deepcopy(self.docs['02'])
    def codes(self,d=None,n='02',layout=False):return {i['code'] for i in Audit(d or self.d,self.refs[n],self.palette).run(layout=layout).issues}
    def wire(self,name):return next(w for w in self.d['wires'] if w['id']==name)
    def test_reordering_battery_terminals_does_not_swap_polarity(self):
        next(c for c in self.d['components'] if c['id']=='battery')['terminals'].reverse()
        self.assertFalse({'BATTERY_POLARITY','BATTERY_GLYPH_POLARITY'} & self.codes())
    def test_swap_battery_connections_even_with_matching_endpoints(self):
        a=self.wire('battery-ground');b=self.wire('battery-feed')
        a['from'],b['from']=b['from'],a['from'];a['points'][0],b['points'][0]=b['points'][0],a['points'][0]
        self.assertIn('BATTERY_POLARITY',self.codes());self.assertIn('NET_MISSING',self.codes())
    def test_swap_battery_glyph_without_changing_data(self):
        for e in self.d['drawing']['symbols']['battery']:
            if e['kind']=='path' and not e.get('closed') and len(e['points'])==2:
                e['points']=[[100-x,y] for x,y in e['points']]
        self.assertIn('BATTERY_GLYPH_POLARITY',self.codes())
    def test_swapped_relay_semantic_roles(self):
        a=self.wire('main-relay-feed');b=self.wire('ignition-relay')
        a['to'],b['to']=b['to'],a['to'];a['points'][-1],b['points'][-1]=b['points'][-1],a['points'][-1]
        self.assertIn('NET_SHORT',self.codes())
    def test_mirror_relay_glyph_roles_only(self):
        for e in self.d['drawing']['symbols']['relay']:
            if e['kind']=='path':e['points']=[[x,149-y] for x,y in e['points']]
        self.assertIn('RELAY_GLYPH_ROLE',self.codes())
    def test_removed_wire_leaves_ghost_drawing(self):
        self.d['wires'].remove(self.wire('switch-horn'))
        self.assertTrue({'NET_MISSING','GHOST_WIRE'}<=self.codes())
    def test_removed_graphics_for_existing_wire(self):
        self.d['drawing']['elements']=[e for e in self.d['drawing']['elements'] if not(e.get('owner')=='switch-horn' and e.get('role')=='wire')]
        self.assertIn('WIRE_NOT_DRAWN',self.codes())
    def test_extra_battery_short(self):
        self.d['wires'].append(dict(id='bad-bridge',**{'from':{'componentId':'battery','terminalId':'negative'},'to':{'componentId':'battery','terminalId':'positive'}},points=[{'x':92,'y':411},{'x':151,'y':411}],code='G',primaryColor='#0ec05b'))
        self.assertIn('BATTERY_SHORT',self.codes())
    def test_shift_route_but_keep_drawing(self):
        self.wire('battery-ground')['points'][1]['y']-=40
        self.assertIn('STALE_WIRE_DRAWING',self.codes())
    def test_wrong_stripe_in_both_data_and_drawing(self):
        self.wire('main-relay-feed')['stripeColor']='#0000ff'
        for e in self.d['drawing']['elements']:
            if e.get('owner')=='main-relay-feed' and e.get('stroke')=='#ffffff':e['stroke']='#0000ff'
        self.assertIn('SOURCE_WIRE_COLOR',self.codes())
    def test_missing_stripe_only_on_drawing(self):
        self.d['drawing']['elements']=[e for e in self.d['drawing']['elements'] if not(e.get('owner')=='main-relay-feed' and e.get('stroke')=='#ffffff')]
        self.assertIn('WIRE_STRIPE_MISSING',self.codes())
    def test_white_wire_outline_is_not_reported_as_wrong_color(self):
        self.assertNotIn('WIRE_PRIMARY_COLOR',self.codes())
    def test_missing_ecm_pin_label_in_drawing(self):
        d=copy.deepcopy(self.docs['10'])
        d['drawing']['elements']=[e for e in d['drawing']['elements'] if not(e.get('kind')=='text' and e.get('owner')=='ecm' and e.get('text')=='THL')]
        self.assertIn('REFERENCE_TEXT',self.codes(d,'10',True))
    def test_old_incorrect_thl_pin_is_rejected(self):
        d=copy.deepcopy(self.docs['10'])
        next(t for c in d['components'] if c['id']=='ecm' for t in c['terminals'] if t['id']=='p5')['label']='3 THL'
        self.assertIn('REFERENCE_PIN_LABEL',self.codes(d,'10'))
    def test_actual_text_pixels_cross_wire(self):
        self.d['drawing']['elements'].append(dict(kind='text',text='R/W',x=570,y=360,size=18,owner='test',role='annotation'))
        self.assertIn('TEXT_WIRE',self.codes(layout=True))
    def test_later_fill_hides_existing_text(self):
        self.d['drawing']['elements'] += [dict(kind='text',text='ABC',x=600,y=200,size=20),dict(kind='path',points=[[560,170],[640,170],[640,210],[560,210]],closed=True,fill='#ffffff',stroke='none')]
        self.assertIn('TEXT_OCCLUDED',self.codes(layout=True))
    def test_rotated_text_clips_canvas(self):
        self.d['drawing']['elements'].append(dict(kind='text',text='ABCDE',x=5,y=1,size=20,rotate=-90))
        self.assertIn('TEXT_CLIPPED',self.codes(layout=True))
    def test_duplicate_terminal(self):
        self.d['components'][0]['terminals'].append(copy.deepcopy(self.d['components'][0]['terminals'][0]))
        self.assertIn('DUPLICATE_TERMINAL',self.codes())
    def test_duplicate_wire(self):
        self.d['wires'].append(copy.deepcopy(self.d['wires'][0]));self.assertIn('DUPLICATE_WIRE',self.codes())
    def test_nan_coordinate_fails_closed(self):
        self.d['wires'][0]['points'][0]['x']=float('nan');self.assertIn('INVALID_INPUT',self.codes())
    def test_empty_path_fails_closed(self):
        self.d['wires'][0]['points']=[];self.assertIn('INVALID_INPUT',self.codes())
    def test_malformed_terminal_object_fails_closed(self):
        self.d['components'][0]['terminals']=[None];self.assertIn('INVALID_INPUT',self.codes())
    def test_named_pin_mapping_for_new_battery(self):
        from symbols import battery
        shapes,matrix,_=battery((92,411),(151,411))
        self.d['drawing']['symbols']['new-battery']=shapes
        for e in self.d['drawing']['elements']:
            if e.get('kind')=='use' and e.get('owner')=='battery':e['symbol']='new-battery';e['matrix']=matrix
        self.assertNotIn('BATTERY_GLYPH_POLARITY',self.codes())
        # Flip both signs geometrically, keeping all data and posts unchanged.
        for e in shapes:
            if e['kind']=='path' and not e.get('closed') and len(e['points'])==2:e['points']=[[60-x,y] for x,y in e['points']]
        self.assertIn('BATTERY_GLYPH_POLARITY',self.codes())
    def test_new_relay_ports_are_exact(self):
        from symbols import relay
        pins={'contact-left':(798,356),'contact-right':(874,356),'coil-left':(798,430),'coil-right':(874,430)}
        shapes,matrix,_=relay(pins)
        self.d['drawing']['symbols']['new-relay']=shapes
        for e in self.d['drawing']['elements']:
            if e.get('kind')=='use' and e.get('owner')=='main-relay':e['symbol']='new-relay';e['matrix']=matrix
        self.assertFalse({'RELAY_DRAWN_PIN','RELAY_GLYPH_ROLE'} & self.codes())
    def test_recursive_symbol_fails_closed(self):
        self.d['drawing']['symbols']['battery'].append(dict(kind='use',symbol='battery',matrix=[1,0,0,1,0,0]))
        self.assertIn('INVALID_INPUT',self.codes())
    def test_unsupported_shape_is_not_silently_ignored(self):
        self.d['drawing']['elements'].append(dict(kind='bitmap'));self.assertIn('INVALID_INPUT',self.codes())
    def test_modified_source_hash_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            p=Path(temp)/'source.png';p.write_bytes(b'changed')
            self.assertFalse(verify_source(p,'0'*64))
    def test_partial_coverage_never_passes(self):
        from repair_verified import repair
        fixed,_=repair(self.d,self.refs['02'])
        r=Audit(fixed,self.refs['02'],self.palette).run().result()
        self.assertEqual(r['errors'],0);self.assertEqual(r['status'],'NEEDS_REVIEW')
    def test_reference_consistency(self):
        lock=json.loads(Path(__file__).with_name('source-lock.json').read_text('utf8'))
        for ref in self.refs.values():
            ports=[p for group in ref['nets'] for p in group]
            self.assertEqual(len(ports),len(set(ports)),ref['number'])
            anchors=[a['ref'] for a in ref['anchors']]
            self.assertEqual(len(anchors),len(set(anchors)),ref['number'])
            self.assertTrue(set(anchors)<=set(ports),ref['number'])
            self.assertTrue(verify_source(SOURCE/ref['source'],lock[ref['source']]))

if __name__=='__main__':unittest.main(verbosity=2)
