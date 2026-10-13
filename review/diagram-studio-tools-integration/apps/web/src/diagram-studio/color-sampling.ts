export type ColorSample = { hex: string; rgb: [number,number,number]; spread: number; warning: string | null };
export function medianColorSample(pixels: Uint8ClampedArray): ColorSample {
 if(!pixels.length || pixels.length%4) throw new Error('Vùng lấy mẫu RGB chưa hợp lệ.');
 const channels: number[][]=[[],[],[]];
 for(let i=0;i<pixels.length;i+=4) { if(pixels[i+3]!==255) throw new Error('Vùng có pixel trong suốt; chọn điểm nằm trên dây.');for(let j=0;j<3;j++)channels[j].push(pixels[i+j]); }
 const rgb=channels.map(values=>{values.sort((a,b)=>a-b);return values[Math.floor(values.length/2)];}) as [number,number,number];
 const spread=Math.max(...channels.map(v=>v[v.length-1]-v[0]));
 return {rgb,hex:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join(''),spread,warning:spread>32?'Vùng có nhiều màu: có thể chạm sọc, mép dây hoặc nền. Lấy lại điểm ở giữa một màu trước khi dùng.':null};
}
