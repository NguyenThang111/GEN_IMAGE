import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css=readFileSync(new URL('./task-list.css',import.meta.url),'utf8');
function luminance(hex:string){
  const rgb=hex.match(/[a-f\d]{2}/gi)!.map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
describe('Muted Task topic palette',()=>{
  const rules=[...css.matchAll(/(?:^|\n)([^\n]*\[data-topic="([^"]+)"\]) \{([^}]+)\}/g)];
  it('has light and dark tokens for all eleven stable topic slots',()=>expect(rules).toHaveLength(22));
  it.each(rules.map(match=>[match[1],match[3]]))('%s keeps normal-size label contrast >= 4.5:1',(selector,body)=>{
    const bg=body.match(/--subject-bg: (#[a-f\d]{6})/)![1];
    const text=body.match(/--subject-text: (#[a-f\d]{6})/)![1];
    const a=luminance(bg),b=luminance(text);
    expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toBeGreaterThanOrEqual(4.5);
  });
});
