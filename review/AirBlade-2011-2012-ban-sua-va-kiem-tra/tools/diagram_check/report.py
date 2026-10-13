"""Standalone comparison report; all resources are local and no network is used."""
import html
import json

PAGE = r'''<!doctype html><html lang="vi"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kiểm tra sơ đồ theo ảnh gốc</title>
<style>
*{box-sizing:border-box}body{margin:0;font:15px system-ui;color:#182638;background:#eff3f7}
header{background:#12283f;color:white;padding:18px 24px}h1{font-size:23px;margin:0 0 8px}p{margin:8px 0;line-height:1.5}
main{padding:18px}select,button,input{font:inherit;padding:8px;border:1px solid #9aaabd;border-radius:5px;background:white}
.toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0}.bad{color:#ab2020;font-weight:700}.review{color:#795014}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}.panel{background:white;border:1px solid #b4c1ce;min-width:0;border-radius:6px}
.label{padding:8px 12px;background:#e4ebf3;font-weight:600}.viewport{height:480px;overflow:auto}.stage{position:relative}.stage img{width:100%;display:block}.overlay{position:absolute;inset:0;pointer-events:none}.mark{position:absolute;border:2px solid #ee2437;background:#ff003015;pointer-events:none}
.zoomdetail{max-height:300px;overflow:auto}.zoomdetail img{max-width:none;display:block}
.tablewrap{max-height:450px;overflow:auto;background:white}table{border-collapse:collapse;width:100%}th,td{padding:9px;text-align:left;border-bottom:1px solid #e1e6ec;vertical-align:top}thead{position:sticky;top:0;background:#dce5ef}tr[data-i]{cursor:pointer}tr[data-i]:hover{background:#fff1d6}code{font-size:12px;overflow-wrap:anywhere}summary{cursor:pointer;padding:10px}
.counts{padding:12px;background:white;border-left:5px solid #c33434}#coverage{font-size:14px}.pill{background:#eef2f7;border:1px solid #c5d1de;border-radius:4px;padding:3px 8px}
@media(max-width:800px){.pair{grid-template-columns:1fr}.viewport{height:360px}}
</style><header><h1>Kiểm tra sơ đồ theo ảnh gốc</h1>
<p>Bản kiểm tra độc lập. Ảnh nguồn và bảng đối chiếu được giữ riêng với JSON cần kiểm tra.</p></header>
<main><div class="counts" id="summary"></div>
<div class="toolbar"><label>Mạch <select id="circuit"></select></label><label>Phóng to <input id="zoom" type="range" min="60" max="300" step="20" value="100"></label><span id="zoomvalue">100%</span><button id="reset">Xóa vùng đánh dấu</button><a href="report.json">Tải báo cáo JSON</a></div>
<p id="coverage"></p><p><a id="difference" target="_blank">Xem ảnh đánh dấu nét khác nhau (đỏ: nguồn, xanh: bản dựng)</a></p><div class="pair">
<div class="panel"><div class="label">Ảnh PNG gốc · đã cắt phần giao diện app</div><div class="viewport" id="leftview"><div class="stage" id="leftstage"><img id="source" alt="Ảnh gốc"><div class="overlay" id="leftmarks"></div></div></div></div>
<div class="panel"><div class="label" id="renderlabel">JSON dựng lại bằng bộ kiểm tra</div><div class="viewport" id="rightview"><div class="stage" id="rightstage"><img id="candidate" alt="Hình dựng JSON"><div class="overlay" id="rightmarks"></div></div></div></div>
</div><p>Chọn một lỗi để đánh dấu vùng và xem cận cảnh. Lỗi mạng nối dây có thể liên quan nhiều vùng; xem tên chân trong báo cáo.</p>
<div class="pair" id="details" hidden><div class="panel zoomdetail"><canvas id="detailLeft"></canvas></div><div class="panel zoomdetail"><canvas id="detailRight"></canvas></div></div>
<div class="toolbar"><label>Mức <select id="severity"><option value="all">Tất cả</option><option value="error">Lỗi</option><option value="review">Cần đối chiếu</option></select></label><label>Nhóm <select id="group"><option value="all">Tất cả</option><option value="BATTERY">Ắc quy</option><option value="RELAY">Relay</option><option value="NET">Mạng nối dây</option><option value="TEXT">Chữ</option><option value="WIRE">Dây và màu</option><option value="REFERENCE">Đối chiếu ảnh</option><option value="COVERAGE">Phần chưa xác minh</option></select></label></div>
<div class="tablewrap"><table><thead><tr><th>Mức / mã</th><th>Đối tượng</th><th>Phát hiện</th></tr></thead><tbody id="issues"></tbody></table></div>
<details><summary>Cách hiểu kết quả</summary><p>FAIL: phát hiện lỗi cần sửa. NEEDS_REVIEW: chưa thấy lỗi trong các phép kiểm tra đã chạy nhưng chưa đủ dữ liệu để xác nhận toàn bộ. Công cụ không tự cho PASS khi chưa đối chiếu hết chữ, mạng dây, hình linh kiện và ảnh xuất từ app.</p><p>Không lấy hình dựng cũ làm đáp án. Kiểm tra mạng chỉ dùng dây dẫn; không tự nối xuyên relay, công tắc, cầu chì hoặc hợp nhất các điểm mass. Phân tích điểm ảnh và OCR là gợi ý kiểm tra, không chứng minh đúng điện.</p><p>Ảnh dựng tại đây sử dụng lớp drawing của JSON. Nếu website chỉ đọc components/wires, cần đối chiếu ảnh website xuất bằng tham số --exports. Báo cáo này không xác nhận website đã sửa.</p></details>
</main><script id="data" type="application/json">__DATA__</script><script>
const data=JSON.parse(document.getElementById('data').textContent),$=s=>document.getElementById(s);
let active=null,busy=false;
for(const r of data.circuits){const o=document.createElement('option');o.value=r.number;o.textContent=r.file;$('circuit').append(o)}
function clearMarks(){$('leftmarks').replaceChildren();$('rightmarks').replaceChildren();$('details').hidden=true}
function renderRows(){const fragment=document.createDocumentFragment();active.issues.forEach((issue,i)=>{if($('severity').value!=='all'&&issue.severity!==$('severity').value)return;if($('group').value!=='all'&&!issue.code.includes($('group').value))return;const row=document.createElement('tr');row.dataset.i=i;let cell=row.insertCell();cell.className=issue.severity==='error'?'bad':'review';cell.textContent=(issue.severity==='error'?'Lỗi':'Cần kiểm tra')+' · '+issue.code;cell=row.insertCell();const code=document.createElement('code');code.textContent=issue.owner||'—';cell.append(code);cell=row.insertCell();cell.textContent=issue.message;row.addEventListener('click',()=>highlight(issue));fragment.append(row)});$('issues').replaceChildren(fragment)}
function highlight(issue){clearMarks();let b=issue.box;if(!b)return;const w=active.canvas[0],h=active.canvas[1];b=[Math.max(0,b[0]-12),Math.max(0,b[1]-12),Math.min(w,b[2]+12),Math.min(h,b[3]+12)];if(b[2]<=b[0]||b[3]<=b[1])return;for(const name of ['leftmarks','rightmarks']){const mark=document.createElement('div');mark.className='mark';Object.assign(mark.style,{left:b[0]/w*100+'%',top:b[1]/h*100+'%',width:(b[2]-b[0])/w*100+'%',height:(b[3]-b[1])/h*100+'%'});$(name).append(mark)}$('details').hidden=false;for(const [canvasName,imageName] of [['detailLeft','source'],['detailRight','candidate']]){const c=$(canvasName),im=$(imageName),scale=im.naturalWidth/w;c.width=Math.ceil((b[2]-b[0])*3);c.height=Math.ceil((b[3]-b[1])*3);if(im.complete&&im.naturalWidth)c.getContext('2d').drawImage(im,b[0]*scale,b[1]*scale,(b[2]-b[0])*scale,(b[3]-b[1])*scale,0,0,c.width,c.height)}}
function change(){active=data.circuits.find(r=>r.number===$('circuit').value);clearMarks();$('source').src=active.assets.source||'';$('candidate').src=active.assets.export||active.assets.render||'';$('difference').hidden=!active.imageDifference?.file;$('difference').href=active.imageDifference?.file||'';$('renderlabel').textContent=active.assets.export?'Ảnh PNG xuất từ website · cần đối chiếu':'JSON dựng lại bằng bộ kiểm tra';$('summary').textContent=active.status+' · '+active.errors+' lỗi · '+active.reviewItems+' mục cần kiểm tra. '+active.verdict;$('coverage').textContent='Đã đối chiếu '+(active.statistics.referenceAnchors||0)+' vị trí chân, '+(active.statistics.referenceNets||0)+' mạng, '+(active.statistics.referenceTexts||0)+' mục chữ. Chưa hoàn tất: '+Object.entries(active.coverage).filter(([k,v])=>!v).map(([k])=>({all_nets:'toàn bộ mạng nối dây',all_text:'toàn bộ chữ',all_symbols:'toàn bộ hình linh kiện',app_render:'bản xuất trên website'}[k]||k)).join(', ')+'.';renderRows()}
$('circuit').addEventListener('change',change);$('severity').addEventListener('change',renderRows);$('group').addEventListener('change',renderRows);$('reset').addEventListener('click',clearMarks);$('zoom').addEventListener('input',()=>{for(const n of ['leftstage','rightstage'])$(n).style.width=$('zoom').value+'%';$('zoomvalue').textContent=$('zoom').value+'%'});
for(const [a,b] of [['leftview','rightview'],['rightview','leftview']])$(a).addEventListener('scroll',()=>{if(busy)return;busy=true;$(b).scrollTop=$(a).scrollTop;$(b).scrollLeft=$(a).scrollLeft;requestAnimationFrame(()=>busy=false)});
if(data.circuits.length)change();else $('summary').textContent='Không tìm thấy file JSON cần kiểm tra.';
</script></html>'''

def write_report(data,out):
    (out/'report.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
    payload=json.dumps(data,ensure_ascii=False).replace('<','\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
    (out/'index.html').write_text(PAGE.replace('__DATA__',payload),encoding='utf8')
