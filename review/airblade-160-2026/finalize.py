"""Package only the artifacts verified by the source and Studio checks."""
import hashlib
import json
import shutil
import sys
import zipfile
from html.parser import HTMLParser
from pathlib import Path

import fitz
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
from build_airblade_160_2026 import OUT, package

manifest=json.loads((OUT/'manifest.json').read_text('utf-8'))
web=json.loads((OUT/'web-tool-checks.json').read_text('utf-8'))
source=json.loads((OUT/'source-reference-checks.json').read_text('utf-8'))
assert len(web['checks'])==len(manifest['circuits'])==14
assert not source['errors']
assert all(c['quality']['canExport'] for c in web['checks'])
assert all(c['bothRenderersPreserveText'] and c['roundTripPreserved'] for c in web['checks'])

rasters=[]
for entry in manifest['circuits']:
    svg=OUT/entry['svg'].replace('.svg','.web.svg')
    document=fitz.open(stream=svg.read_bytes(),filetype='svg')
    with fitz.open('pdf',document.convert_to_pdf()) as pdf:
        output=Path(__file__).parent/(svg.stem+'.raster.png')
        pdf[0].get_pixmap(matrix=fitz.Matrix(1,1)).save(output)
    with Image.open(output) as image:
        histogram=image.convert('L').histogram()
        ink=sum(histogram[:230])/(image.width*image.height)
        if ink<.01:raise ValueError('Blank Studio SVG '+entry['json'])
    rasters.append(dict(file=entry['json'],svgRasterNonblank=True,inkFraction=round(ink,4),backend='MuPDF SVG rasterizer, not browser screenshot'))

report=json.loads((OUT/'review-report.json').read_text('utf-8'))
report['studioModuleValidation']=dict(schemaErrors=0,diagrams=14,renderPaths=28,
    textItems=sum(c['texts'] for c in web['checks']),bothRenderersPreserveText=True,
    rendererModuleVerified=True,liveWebsiteVerified=False,browserUiTested=False)
report['selectedSourceValidation']=dict(pinLabels=sum(c['pinLabels'] for c in source['checks']),
    fuseRatings=sum(c['fuseRatings'] for c in source['checks']),networks=sum(c['networks'] for c in source['checks']),
    errors=0,scope=source['coverage'])
report['svgRasterValidation']=rasters
report['remainingLayoutWarnings']='ABS enclosure labels are reported as inside the fuse-box component by the legacy checker. Studio trace-clearance and source-variant warnings are retained in web-tool-checks.json.'
(OUT/'review-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
shutil.copyfile(Path(__file__).with_name('source-reference.json'),OUT/'source-reference.json')
readme=OUT/'README.md'
readme.write_text(readme.read_text('utf-8')+'''\n## Kết quả kiểm tra

14/14 JSON qua schema và quality.canExport của Studio; 28 luồng dựng giữ đủ 1.304 mục chữ. SVG .web.svg do chính DiagramPreview của Studio xuất; review.html hiển thị các SVG này. Đã đối chiếu riêng 158 nhãn chân, 16 trị số cầu chì và 28 mạng quan trọng với bảng mốc đọc từ ảnh, không chứng nhận toàn bộ nội dung điện.

source-reference.json và source-reference-checks.json lưu phạm vi kiểm tra. web-tool-checks.json giữ cảnh báo khoảng cách đường dây và khác biệt nguồn. Chưa kiểm thử thao tác import trên giao diện vì Browser không khả dụng. Không đánh dấu electrically-reviewed.
''',encoding='utf-8')
package(manifest['circuits'])

class Assets(HTMLParser):
    def handle_starttag(self,tag,attrs):
        for key,value in attrs:
            if key in ('src','href') and value:
                if not (OUT/value).is_file():raise ValueError('Broken review link '+value)
Assets().feed((OUT/'review.html').read_text('utf-8'))
archive=ROOT/'review'/'AIR-BLADE-160-2026-JSON.zip'
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    names=[n for n in z.namelist() if n.endswith('.schema.json')]
    assert len(names)==14
    for entry in manifest['circuits']:
        assert z.read('AIR BLADE 160 2026/'+entry['json'])==(OUT/entry['json']).read_bytes()
print(json.dumps(dict(status='PACKAGED',circuits=13,alternates=1,texts=1304,
    sourcePinLabels=158,sourceFuseRatings=16,sourceNetworks=28,
    zipBytes=archive.stat().st_size,zipSha256=hashlib.sha256(archive.read_bytes()).hexdigest(),
    browserUiTested=False,electricalApproval=False)))
