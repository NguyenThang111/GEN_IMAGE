import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postcss from 'postcss';

// Advisory source audit: candidates are not proof of a rendered theme defect.
const root = fileURLToPath(new URL('../src/', import.meta.url));
const findings = [];
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { await scan(file); continue; }
    if (!file.endsWith('.css')) continue;
    const css = postcss.parse(await readFile(file, 'utf8'), { from: file });
    css.walkDecls(decl => {
      if (!/^(background|background-color|color|border.*|box-shadow)$/.test(decl.prop)) return;
      const colors = decl.value.match(/#[\da-f]{3,8}\b|\bwhite\b/gi) ?? [];
      const light = colors.some(value => {
        let hex = value === 'white' ? 'ffffff' : value.slice(1);
        if (hex.length === 3 || hex.length === 4) hex = hex.split('').map(c => c + c).join('');
        const rgb = [0,2,4].map(i => parseInt(hex.slice(i,i+2),16));
        return rgb.every(v => v >= 220);
      });
      if (!light) return;
      findings.push({ file:path.relative(root,file), line:decl.source.start.line, selector:decl.parent.selector, property:decl.prop, value:decl.value });
    });
  }
}
await scan(root);
console.log(JSON.stringify({ note:'Review light hard-coded colors in dark mode; light-theme and status colors may be intentional. Runtime checks still required.', count:findings.length, findings }, null, 2));
