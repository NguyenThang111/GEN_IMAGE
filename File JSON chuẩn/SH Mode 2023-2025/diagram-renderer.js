/* Vector extension v1 for the reviewed schematic JSON. No dependencies.
 * Use: container.replaceChildren(SchematicRenderer.render(data)).
 * Existing editors can retain their legacy renderer for data without `drawing`.
 */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  function element(tag, attributes = {}) {
    const el = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, String(value));
    return el;
  }
  function flatten(data) {
    if (data.drawing?.version !== 1) throw new Error('JSON cần có lớp drawing.version = 1 để vẽ đủ chi tiết.');
    const result = [], symbols = data.drawing.symbols || {};
    function emit(item, matrix = [1, 0, 0, 1, 0, 0], depth = 0) {
      if (depth > 16) throw new Error('Symbol lồng nhau quá sâu.');
      const [a, b, c, d, tx, ty] = matrix;
      const xy = (x, y) => [a * x + c * y + tx, b * x + d * y + ty];
      const factor = Math.sqrt(Math.abs(a * d - b * c));
      if (item.kind === 'use') {
        if (!symbols[item.symbol]) throw new Error('Thiếu symbol: ' + item.symbol);
        const [A, B, C, D, X, Y] = item.matrix;
        const next = [a*A+c*B, b*A+d*B, a*C+c*D, b*C+d*D, a*X+c*Y+tx, b*X+d*Y+ty];
        for (const child of symbols[item.symbol]) emit(child, next, depth + 1);
      } else if (item.kind === 'text') {
        const [x, y] = xy(item.x, item.y);
        result.push({...item, x, y, size: (item.size || 14) * factor, rotate: (item.rotate || 0) + Math.atan2(b, a)*180/Math.PI});
      } else if (item.kind === 'path') {
        result.push({...item, points: item.points.map(p => xy(...p)), width: (item.width ?? 1.5) * factor});
      } else throw new Error('Kiểu nét vẽ chưa hỗ trợ: ' + item.kind);
    }
    for (const item of data.drawing.elements) emit(item);
    return result;
  }
  function render(data) {
    const {width, height} = data.canvas;
    if (!(width > 0 && height > 0 && width <= 20000 && height <= 20000)) throw new Error('Kích thước canvas không hợp lệ.');
    const svg = element('svg', {xmlns:NS, viewBox:`0 0 ${width} ${height}`, width, height, role:'img', 'aria-label':data.circuitTitle || 'Sơ đồ'});
    svg.append(element('rect', {width:'100%', height:'100%', fill:'#ffffff'}));
    for (const item of flatten(data)) {
      if (item.kind === 'text') {
        const node = element('text', {x:item.x, y:item.y, fill:item.fill || '#343434', 'font-family':'Arial, sans-serif', 'font-size':item.size, 'font-weight':item.bold === false ? 400 : 700, 'text-anchor':item.anchor || 'middle', transform:`rotate(${item.rotate || 0} ${item.x} ${item.y})`});
        node.textContent = item.text; svg.append(node);
      } else {
        svg.append(element(item.closed ? 'polygon' : 'polyline', {points:item.points.map(p => p.join(',')).join(' '), fill:item.fill || 'none', stroke:item.stroke || '#555555', 'stroke-width':item.width, 'stroke-linejoin':'round', 'stroke-linecap':item.cap || 'butt'}));
      }
    }
    return svg;
  }
  function svgString(data) { return new XMLSerializer().serializeToString(render(data)); }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href=url; a.download=name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function pngBlob(data, scale = 2) {
    const url=URL.createObjectURL(new Blob([svgString(data)],{type:'image/svg+xml;charset=utf-8'}));
    try {
      const image=new Image(); image.src=url; await image.decode();
      const canvas=document.createElement('canvas'); canvas.width=Math.round(data.canvas.width*scale); canvas.height=Math.round(data.canvas.height*scale);
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);
      return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Không xuất được PNG.')),'image/png'));
    } finally {URL.revokeObjectURL(url);}
  }
  root.SchematicRenderer={render,flatten,svgString,pngBlob,download};
})(globalThis);
