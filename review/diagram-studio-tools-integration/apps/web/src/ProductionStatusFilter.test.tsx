import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {filterProductionLots,ProductionStatusFilter} from './ProductionStatusFilter';
import type {ProductionLot} from './api';
describe('Production status filter',()=>{
  const lots=['NEW','IN_PROGRESS','WAITING_TEST','TESTING','DONE'].map((status,index)=>({id:String(index),status})) as ProductionLot[];
  it('includes unclaimed lots under the default in-progress filter',()=>{expect(filterProductionLots(lots,'IN_PROGRESS').map(l=>l.status)).toEqual(['NEW','IN_PROGRESS']);});
  it.each(['WAITING_TEST','TESTING','DONE'] as const)('filters %s without changing lots',filter=>{expect(filterProductionLots(lots,filter).map(l=>l.status)).toEqual([filter]);expect(lots).toHaveLength(5);});
  it('retains all rows beyond the old 30-row limit',()=>{const many=Array.from({length:45},(_,i)=>({...lots[1],id:String(i)}));expect(filterProductionLots(many,'ALL')).toHaveLength(45);expect(filterProductionLots(many,'IN_PROGRESS')).toHaveLength(45);});
  it('renders counts and exactly one selected filter',()=>{const html=renderToStaticMarkup(<ProductionStatusFilter lots={lots} value="IN_PROGRESS" onChange={()=>{}}/>);expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);expect(html).toContain('Đang làm<span>2</span>');expect(html).toContain('Tất cả<span>5</span>');});
  it('handles an empty list',()=>{expect(filterProductionLots([],'DONE')).toEqual([]);});
});
