"""Synthetic fixtures test the checker, not any real motorcycle schematic."""
import contextlib
import copy
import hashlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from check_bundle import Audit, audit_diagram, audit_files, load_json, main

try:
    from PIL import Image, ImageDraw
except ImportError:
    Image = None


def fixture():
    data = {
        'canvas': {'width': 200, 'height': 120},
        'components': [
            {'id': 'battery', 'type': 'battery', 'terminals': [
                {'id': 'positive', 'label': '+', 'x': 20, 'y': 70},
                {'id': 'negative', 'label': '−', 'x': 20, 'y': 100}]},
            {'id': 'fuse', 'type': 'fuse', 'terminals': [
                {'id': 'in', 'label': '1', 'x': 100, 'y': 70},
                {'id': 'out', 'label': '2', 'x': 130, 'y': 70}]}],
        'wires': [{'id': 'feed', 'from': {'componentId': 'battery', 'terminalId': 'positive'},
                   'to': {'componentId': 'fuse', 'terminalId': 'in'},
                   'points': [{'x': 20, 'y': 70}, {'x': 100, 'y': 70}], 'primaryColor': '#ff0000'}],
        'drawing': {'version': 1, 'symbols': {}, 'elements': [
            {'kind': 'text', 'text': 'Ắc quy', 'x': 20, 'y': 30, 'owner': 'battery'},
            {'kind': 'text', 'text': '20A', 'x': 110, 'y': 30, 'owner': 'fuse'},
            {'kind': 'text', 'text': 'Bl', 'x': 60, 'y': 60, 'owner': 'feed'},
            {'kind': 'text', 'text': 'O₂', 'x': 170, 'y': 30, 'owner': 'sensor'},
            {'kind': 'path', 'points': [[20, 70], [100, 70]], 'stroke': '#ff0000', 'owner': 'feed', 'role': 'wire'}]}}
    ref = {
        'source': {'width': 220, 'height': 140, 'crop': [10, 10, 200, 120], 'sha256': '0'*64},
        'canvas': {'width': 200, 'height': 120},
        'coverage': {k: False for k in ('all_text', 'all_nets', 'all_symbols', 'clean_image', 'app_render')},
        'texts': [{'id': 't'+str(i), 'text': e['text'], 'owner': e['owner'],
                   'xy': [e['x']+10, e['y']+10], 'reviewed': True}
                  for i, e in enumerate(data['drawing']['elements']) if e['kind'] == 'text'],
        'anchors': [{'ref': c['id']+'.'+t['id'], 'xy': [t['x']+10, t['y']+10],
                     'label': t['label'], 'reviewed': True}
                    for c in data['components'] for t in c['terminals']],
        'nets': [['battery.positive', 'fuse.in'], ['battery.negative'], ['fuse.out']], 'unresolved': []}
    # Deliberately constructed fixture for fault injection. No real-source certification.
    return data, ref


class ModelTests(unittest.TestCase):
    def setUp(self):
        self.data, self.ref = fixture()

    def codes(self):
        return {i['code'] for i in audit_diagram(self.data, self.ref).issues}

    def test_correct_synthetic_model_has_no_errors_but_needs_review(self):
        report = audit_diagram(self.data, self.ref).result()
        self.assertEqual(report['errors'], 0)
        self.assertEqual(report['status'], 'NEEDS_REVIEW')

    def test_setting_all_coverage_true_cannot_certify_pass(self):
        self.ref['coverage'] = {key: True for key in self.ref['coverage']}
        self.assertEqual(audit_diagram(self.data, self.ref).result()['status'], 'NEEDS_REVIEW')
        self.assertIn('STARTER_LIMITATIONS', self.codes())

    def test_deleted_label(self):
        self.data['drawing']['elements'].pop(1)
        self.assertIn('TEXT_MISSING_OR_CHANGED', self.codes())

    def test_changed_ampere_number(self):
        self.data['drawing']['elements'][1]['text'] = '10A'
        self.assertIn('TEXT_MISSING_OR_CHANGED', self.codes())

    def test_l_not_capital_i(self):
        self.data['drawing']['elements'][2]['text'] = 'BI'
        self.assertIn('TEXT_MISSING_OR_CHANGED', self.codes())

    def test_removed_vietnamese_accent(self):
        self.data['drawing']['elements'][0]['text'] = 'Ac quy'
        self.assertIn('TEXT_MISSING_OR_CHANGED', self.codes())

    def test_subscript_is_not_plain_number(self):
        self.data['drawing']['elements'][3]['text'] = 'O2'
        self.assertIn('TEXT_MISSING_OR_CHANGED', self.codes())

    def test_unicode_nfc_equivalence(self):
        import unicodedata
        self.data['drawing']['elements'][0]['text'] = unicodedata.normalize('NFD', 'Ắc quy')
        self.assertNotIn('TEXT_MISSING_OR_CHANGED', self.codes())

    def test_whitespace_is_preserved(self):
        self.data['drawing']['elements'][0]['text'] = 'Ắcquy'
        self.assertIn('TEXT_MISSING_OR_CHANGED', self.codes())

    def test_one_duplicate_occurrence_cannot_cover_two_reference_entries(self):
        extra = copy.deepcopy(self.ref['texts'][1])
        extra['id'] = 'duplicate-occurrence'
        self.ref['texts'].append(extra)
        self.assertIn('TEXT_MISSING_OR_CHANGED', self.codes())

    def test_text_at_wrong_position(self):
        self.data['drawing']['elements'][1]['x'] += 20
        self.assertIn('TEXT_MISSING_OR_CHANGED', self.codes())

    def test_duplicate_reference_text_id(self):
        self.ref['texts'][1]['id'] = self.ref['texts'][0]['id']
        self.assertIn('REFERENCE_DUPLICATE_TEXT_ID', self.codes())

    def test_source_text_id_mismatch(self):
        self.data['drawing']['elements'][0]['sourceTextId'] = 'wrong'
        self.assertIn('TEXT_MISSING_OR_CHANGED', self.codes())

    def test_changed_pin_number(self):
        self.data['components'][1]['terminals'][0]['label'] = '3'
        self.assertIn('PIN_LABEL_CHANGED', self.codes())

    def test_duplicate_terminal(self):
        c = self.data['components'][0]
        c['terminals'].append(copy.deepcopy(c['terminals'][0]))
        self.assertIn('DUPLICATE_TERMINAL', self.codes())

    def test_duplicate_component(self):
        self.data['components'].append(copy.deepcopy(self.data['components'][0]))
        self.assertIn('DUPLICATE_COMPONENT', self.codes())

    def test_duplicate_wire(self):
        self.data['wires'].append(copy.deepcopy(self.data['wires'][0]))
        self.assertIn('DUPLICATE_WIRE', self.codes())

    def test_endpoint_not_at_terminal(self):
        self.data['wires'][0]['points'][0]['x'] += 2
        self.assertIn('ENDPOINT_MISMATCH', self.codes())

    def test_swapped_battery_connection_even_with_updated_endpoint(self):
        self.data['wires'][0]['from']['terminalId'] = 'negative'
        self.data['wires'][0]['points'][0]['y'] = 100
        self.assertTrue({'NET_DISCONNECTED', 'NET_SHORT'} <= self.codes())

    def test_no_connection_through_fuse_is_inferred(self):
        self.assertNotIn('NET_SHORT', self.codes())

    def test_deleted_wire_with_ghost_drawing(self):
        self.data['wires'].clear()
        self.assertTrue({'NET_DISCONNECTED', 'GHOST_WIRE'} <= self.codes())

    def test_data_wire_without_graphics(self):
        self.data['drawing']['elements'] = [e for e in self.data['drawing']['elements'] if e['kind'] != 'path']
        self.assertIn('WIRE_NOT_DRAWN', self.codes())

    def test_stale_graphics(self):
        self.data['drawing']['elements'][-1]['points'].insert(1, [60, 80])
        self.assertIn('STALE_WIRE_DRAWING', self.codes())

    def test_missing_stripe(self):
        self.data['wires'][0]['stripeColor'] = '#ffffff'
        self.assertIn('WIRE_COLOR_MISSING', self.codes())

    def test_missing_terminal_reference(self):
        self.data['wires'][0]['to']['terminalId'] = 'unknown'
        self.assertIn('MISSING_TERMINAL', self.codes())

    def test_nan_coordinate(self):
        self.data['components'][0]['terminals'][0]['x'] = float('nan')
        self.assertIn('INVALID_INPUT', self.codes())

    def test_nonfinite_component_geometry(self):
        self.data['components'][0]['width'] = float('inf')
        self.assertIn('INVALID_INPUT', self.codes())

    def test_empty_diagram_is_an_error(self):
        self.data['components'] = []
        self.assertIn('EMPTY_DIAGRAM', self.codes())

    def test_empty_wire_points(self):
        self.data['wires'][0]['points'] = []
        self.assertIn('INVALID_INPUT', self.codes())

    def test_unknown_primitive(self):
        self.data['drawing']['elements'].append({'kind': 'bitmap'})
        self.assertIn('INVALID_INPUT', self.codes())

    def test_recursive_symbol(self):
        self.data['drawing']['symbols']['loop'] = [{'kind': 'use', 'symbol': 'loop', 'matrix': [1,0,0,1,0,0]}]
        self.data['drawing']['elements'].append({'kind': 'use', 'symbol': 'loop', 'matrix': [1,0,0,1,0,0]})
        self.assertIn('INVALID_INPUT', self.codes())

    def test_singular_matrix(self):
        self.data['drawing']['symbols']['one'] = []
        self.data['drawing']['elements'].append({'kind': 'use', 'symbol': 'one', 'matrix': [0,0,0,0,0,0]})
        self.assertIn('INVALID_INPUT', self.codes())

    def test_symbol_expansion_inherits_owner_and_transforms_coordinates(self):
        e = self.data['drawing']['elements'][1]
        self.data['drawing']['symbols']['fuse-label'] = [dict(e, x=0, y=0, owner='local')]
        self.data['drawing']['elements'][1] = {'kind': 'use', 'symbol': 'fuse-label', 'owner': 'fuse', 'matrix': [1,0,0,1,110,30]}
        self.assertNotIn('TEXT_MISSING_OR_CHANGED', self.codes())

    def test_mirrored_text_requires_review(self):
        e = self.data['drawing']['elements'][1]
        self.data['drawing']['symbols']['label'] = [dict(e, x=0, y=0)]
        self.data['drawing']['elements'][1] = {'kind': 'use', 'symbol': 'label', 'owner': 'fuse', 'matrix': [-1,0,0,1,110,30]}
        self.assertIn('TEXT_TRANSFORM_REVIEW', self.codes())

    def test_crop_scale_reference(self):
        self.ref['source']['width'] *= 2
        self.ref['source']['height'] *= 2
        self.ref['source']['crop'] = [v*2 for v in self.ref['source']['crop']]
        for e in self.ref['texts']+self.ref['anchors']:
            e['xy'] = [v*2 for v in e['xy']]
        self.assertEqual(audit_diagram(self.data, self.ref).result()['errors'], 0)

    def test_crop_outside_source(self):
        self.ref['source']['crop'][0] = 999
        self.assertIn('INVALID_INPUT', self.codes())

    def test_unsupported_deskew_does_not_silently_use_crop_scale(self):
        self.ref['source']['transform'] = 'homography'
        self.assertIn('INVALID_INPUT', self.codes())

    def test_duplicate_reference_net_port(self):
        self.ref['nets'][1].append('battery.positive')
        self.assertIn('REFERENCE_DUPLICATE_NET_PORT', self.codes())

    def test_malformed_input_is_a_report_not_a_crash(self):
        for bad in (None, {}, [], {'canvas': None}):
            self.assertEqual(audit_diagram(bad, self.ref).result()['status'], 'FAIL')

    def test_malformed_reference_is_a_report_not_a_crash(self):
        for bad in (None, {}, [], {'coverage': None}, {'coverage': []}, {'source': None}):
            self.assertEqual(audit_diagram(self.data, bad).result()['status'], 'FAIL')


class FileTests(unittest.TestCase):
    def test_malformed_reference_does_not_crash_file_checker(self):
        for bad in (None, [], {'source': None, 'canvas': None}):
            audit = Audit()
            audit_files(audit, bad, None, None, None)
            self.assertIn('SOURCE_HASH_INVALID', {i['code'] for i in audit.issues})

    def test_strict_json_rejects_nan_and_duplicate_keys(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)/'bad.json'
            for text in ('{"x":NaN}', '{"x":Infinity}', '{"x":1,"x":2}'):
                p.write_text(text, encoding='utf-8')
                with self.assertRaises(ValueError):
                    load_json(p)

    def test_utf8_bom_is_supported(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)/'bom.json'
            p.write_text('{"text":"Ắc quy"}', encoding='utf-8-sig')
            self.assertEqual(load_json(p)['text'], 'Ắc quy')

    @unittest.skipIf(Image is None, 'Pillow needed for file image tests')
    def test_real_images_and_cli_exit_code_two(self):
        with tempfile.TemporaryDirectory() as folder:
            root, data, ref, args = self.package(folder)
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(main(args), 2)
            report = load_json(root/'report.json')
            self.assertEqual(report['errors'], 0)
            self.assertEqual(report['status'], 'NEEDS_REVIEW')
            self.assertIn('web-export', report['statistics']['images'])
            self.assertIn(str(root/'diagram.json'), report['artifacts'])

    @unittest.skipIf(Image is None, 'Pillow needed for file image tests')
    def test_source_hash_change_and_invalid_image_detected(self):
        with tempfile.TemporaryDirectory() as folder:
            root, _, ref, _ = self.package(folder)
            (root/'source.png').write_bytes(b'not an image')
            audit = Audit()
            audit_files(audit, ref, root/'source.png', root/'clean.png', root/'web.png')
            codes = {i['code'] for i in audit.issues}
            self.assertTrue({'SOURCE_HASH_MISMATCH', 'IMAGE_INVALID'} <= codes)

    @unittest.skipIf(Image is None, 'Pillow needed for file image tests')
    def test_wrong_export_size_and_blank_image(self):
        with tempfile.TemporaryDirectory() as folder:
            root, _, ref, _ = self.package(folder)
            Image.new('RGB', (10,10), 'white').save(root/'web.png')
            audit = Audit()
            audit_files(audit, ref, root/'source.png', root/'clean.png', root/'web.png')
            self.assertTrue({'IMAGE_SIZE', 'IMAGE_BLANK'} <= {i['code'] for i in audit.issues})

    @unittest.skipIf(Image is None, 'Pillow needed for file image tests')
    def test_missing_clean_image(self):
        with tempfile.TemporaryDirectory() as folder:
            root, _, ref, _ = self.package(folder)
            audit = Audit()
            audit_files(audit, ref, root/'source.png', root/'missing.png', root/'web.png')
            self.assertIn('IMAGE_MISSING', {i['code'] for i in audit.issues})

    @unittest.skipIf(Image is None, 'Pillow needed for file image tests')
    def test_cli_failure_code_one(self):
        with tempfile.TemporaryDirectory() as folder:
            root, data, _, args = self.package(folder)
            data['drawing']['elements'][1]['text'] = '10A'
            (root/'diagram.json').write_text(json.dumps(data), encoding='utf-8')
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(main(args), 1)

    @unittest.skipIf(Image is None, 'Pillow needed for file image tests')
    def test_cli_does_not_overwrite_input(self):
        with tempfile.TemporaryDirectory() as folder:
            root, _, _, args = self.package(folder)
            original = (root/'diagram.json').read_bytes()
            args[-1] = str(root/'diagram.json')
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                main(args)
            self.assertEqual((root/'diagram.json').read_bytes(), original)

    @unittest.skipIf(Image is None, 'Pillow needed for file image tests')
    def test_truncated_image_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root, _, ref, _ = self.package(folder)
            p = root/'web.png'
            p.write_bytes(p.read_bytes()[:50])
            audit = Audit()
            audit_files(audit, ref, root/'source.png', root/'clean.png', p)
            self.assertIn('IMAGE_INVALID', {i['code'] for i in audit.issues})

    def package(self, folder):
        root = Path(folder)
        data, ref = fixture()
        for name, size in [('source.png', (220,140)), ('clean.png', (200,120)), ('web.png', (200,120))]:
            im = Image.new('RGB', size, 'white')
            ImageDraw.Draw(im).line([(20,70), (100,70)], fill='red', width=2)
            im.save(root/name)
        ref['source']['sha256'] = hashlib.sha256((root/'source.png').read_bytes()).hexdigest()
        (root/'diagram.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
        (root/'reference.json').write_text(json.dumps(ref, ensure_ascii=False), encoding='utf-8')
        args = ['--diagram', str(root/'diagram.json'), '--reference', str(root/'reference.json'),
                '--source', str(root/'source.png'), '--clean', str(root/'clean.png'),
                '--web-export', str(root/'web.png'), '--out', str(root/'report.json')]
        return root, data, ref, args


if __name__ == '__main__':
    unittest.main(verbosity=2)
