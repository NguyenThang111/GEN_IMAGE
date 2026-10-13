import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {InventoryView} from './App';
import type {Api,InventoryItem,PurchaseRequest} from './api';

describe('Material grid',()=>{
  const items=[{id:'material-a',name:'Cuộn cảm 15nH 0603',groupName:'CUỘN CẢM',sku:'L15',location:'D11',onHandQty:'15',minimumStock:'100',isLowStock:true,needsCount:true,lastCountedAt:null},{id:'material-b',name:'Chưa kiểm vật tư',groupName:'Khác',sku:null,location:null,onHandQty:null,minimumStock:'30',isLowStock:false,needsCount:false,lastCountedAt:null}] as InventoryItem[];
  const props={api:{} as Api,items,products:[],sellableProducts:[],requests:[{itemId:'material-a',status:'ORDERED',requestedQty:'25'}] as PurchaseRequest[],people:[],admin:true,openStockCountSheets:0,onOpenStockCount:()=>{},onUpdated:async()=>{},initialTab:'materials' as const};
  it('renders an accessible card for each material with all stock badges',()=>{
    const html=renderToStaticMarkup(<InventoryView {...props}/>);
    expect(html.match(/class="materialCard"/g)).toHaveLength(2);expect(html).toContain('aria-label="Chi tiết Cuộn cảm 15nH 0603"');expect(html).toContain('D11');expect(html).toContain('SẮP HẾT');expect(html).toContain('CẦN KIỂM');expect(html).toContain('ĐANG MUA +25');expect(html).toContain('CHƯA KIỂM');expect(html).toContain('Chưa có vị trí');expect(html).not.toContain('inventoryHeader');
  });
  it('keeps search and signal filters outside cards',()=>{const html=renderToStaticMarkup(<InventoryView {...props}/>);expect(html).toContain('aria-label="Tìm vật tư"');expect(html).toContain('inventorySignals');});
  it('preserves empty search/list state',()=>{expect(renderToStaticMarkup(<InventoryView {...props} items={[]}/>)).toContain('Không có vật tư phù hợp.');});
});
