import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProductionReportWarnings } from './ProductionReportWarnings';
import type { ProductionOverview } from './api';
const warnings=[{entryId:'entry',userId:'minh',workDate:'2026-09-29',status:'WARNING',actualHours:4,expectedHours:3,deviationPercent:33.3,message:'Kiểm tra giờ đã nhập.'}] as ProductionOverview['productivityWarnings'];
function render(admin:boolean,items=warnings){return renderToStaticMarkup(<ProductionReportWarnings admin={admin} warnings={items} name={()=>'MINH BK'} onOpen={()=>{}}/>);}
describe('Compact report warnings',()=>{
  it('starts collapsed and explains this is not a failed Task verdict',()=>{
    const html=render(true);expect(html).toContain('<details');expect(html).not.toMatch(/<details[^>]*\bopen/);expect(html).toContain('Kiểm tra báo công');expect(html).toContain('không kết luận Task không đạt');expect(html).toContain('MINH BK');expect(html).toContain('29/09/2026');expect(html).toContain('Xem báo công');
  });
  it('hides warnings from members and omits empty/insufficient-data summaries',()=>{
    expect(render(false)).toBe('');expect(render(true,[])).toBe('');expect(render(true,[{...warnings[0],status:'INSUFFICIENT_DATA'}])).toBe('');
  });
});
