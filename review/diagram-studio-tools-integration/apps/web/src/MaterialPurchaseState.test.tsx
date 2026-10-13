import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {MaterialPurchaseState} from './MaterialPurchaseState';
import type {PurchaseRequest} from './api';

describe('Material purchase state',()=>{
  const request=(id:string,status:PurchaseRequest['status'],extra:Partial<PurchaseRequest>={})=>({id,itemId:'material',status,requestedQty:'20',orderCode:null,orderUrl:null,...extra}) as PurchaseRequest;
  const render=(requests:PurchaseRequest[])=>renderToStaticMarkup(<MaterialPurchaseState itemId="material" unit="unit" requests={requests}/>);
  it('distinguishes requested and ordered, totals only open orders for this material',()=>{
    const html=render([request('a','REQUESTED'),request('b','ORDERED',{orderCode:'ORDER-1',orderUrl:'https://example.com/order'}),request('c','ORDERED',{requestedQty:'10'}),request('d','RECEIVED',{orderCode:'RECEIVED-ONLY'}),request('e','CANCELLED',{orderCode:'CANCELLED-ONLY'}),request('f','ORDERED',{itemId:'other',orderCode:'OTHER-ONLY'})]);
    expect(html).toContain('ĐANG MUA · 30 unit');expect(html).toContain('CHỜ MUA · 20 unit');expect(html).toContain('ORDER-1');expect(html).toContain('href="https://example.com/order"');expect(html).not.toContain('RECEIVED-ONLY');expect(html).not.toContain('CANCELLED-ONLY');expect(html).not.toContain('OTHER-ONLY');
  });
  it('shows an explicit empty state without implying that stock was received',()=>{expect(render([])).toContain('Không có yêu cầu mua đang mở.');});
  it('does not render unsafe order links',()=>{const html=render([request('a','ORDERED',{orderUrl:'javascript:alert(1)'})]);expect(html).not.toContain('href=');expect(html).toContain('Chưa có link đơn');});
});
