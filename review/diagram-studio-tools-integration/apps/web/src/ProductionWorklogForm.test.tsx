import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {ProductionWorklogForm,ProductionWorklogTag,ProductionLotCreatedDate,productionWorklogOutputs} from './ProductionWorklogForm';
import type {FinishedProduct,SellableProduct} from './api';

describe('Production Worklog groups',()=>{
  it('renders the API creation date in its own cell',()=>{
    const html=renderToStaticMarkup(<ProductionLotCreatedDate createdAt="2026-09-20T08:00:00.000Z"/>);
    expect(html).toContain('class="productionLotCreatedDate"');
    expect(html).toContain('20/09/2026');
    expect(html).toContain('dateTime="2026-09-20T08:00:00.000Z"');
  });
  it('uses Vietnam time when creation crosses the UTC date boundary',()=>{
    const html=renderToStaticMarkup(<ProductionLotCreatedDate createdAt="2026-09-20T18:00:00.000Z"/>);
    expect(html).toContain('21/09/2026');
  });
  it('does not invent a date when creation data is unavailable',()=>{
    const html=renderToStaticMarkup(<ProductionLotCreatedDate createdAt=""/>);
    expect(html).toContain('<span>—</span>');
    expect(html).not.toContain('<time');
  });
  const finished=[
    {id:'board',name:'Board KeyScan',category:'PCB',isActive:true,productionReady:true,isProductionOutput:false},
    {id:'cable',name:'Cáp chính',category:'CABLE',isActive:true,productionReady:true,isProductionOutput:true},
    {id:'hidden',name:'Board ẩn',category:'PCB',isActive:false,productionReady:true,isProductionOutput:true},
    {id:'unready',name:'Board chưa cấu hình',category:'PCB',isActive:true,productionReady:false,isProductionOutput:true},
  ] as FinishedProduct[];
  const sellable=[{id:'device',name:'Máy KeyScan',isActive:true},{id:'old',name:'Máy cũ',isActive:false}] as SellableProduct[];
  it('offers only active ready PCB boards for soldering, including legacy non-output boards',()=>{
    expect(productionWorklogOutputs('SOLDER',finished,sellable)).toEqual([{value:'F:board',label:'Board KeyScan',outputType:'FINISHED_PRODUCT',outputId:'board'}]);
  });
  it('keeps cable/machine choices separate from PCB boards',()=>{
    expect(productionWorklogOutputs('CABLE',finished,sellable).map(item=>item.value)).toEqual(['F:cable','S:device']);
  });
  it('uses explicit action for tags, not the product name or code',()=>{
    expect(renderToStaticMarkup(<ProductionWorklogTag actionType="SOLDER"/>)).toContain('solder">HÀN MẠCH');
    for(const actionType of ['ASSEMBLE','PACK','TEST'] as const)expect(renderToStaticMarkup(<ProductionWorklogTag actionType={actionType}/>)).toContain('cable">LÀM CÁP / BỌC MÁY');
  });
  it('renders the simple group/output/quantity form with no detailed solder checklist',()=>{
    const html=renderToStaticMarkup(<ProductionWorklogForm finishedProducts={finished} sellableProducts={sellable} busy={false} error="" onClose={()=>{}} onCreate={async()=>{}}/>);
    expect(html).toContain('Nhóm công việc');expect(html).toContain('Hàn mạch');expect(html).toContain('Số lượng mục tiêu');
    expect(html).not.toContain('Board KeyScan');expect(html).toContain('Cáp chính');expect(html).toContain('Máy KeyScan');
  });
  it('shows server errors inside the modal',()=>{
    const html=renderToStaticMarkup(<ProductionWorklogForm finishedProducts={finished} sellableProducts={sellable} busy={false} error="Không tạo được" onClose={()=>{}} onCreate={async()=>{}}/>);
    expect(html).toContain('role="alert">Không tạo được');
  });
});
