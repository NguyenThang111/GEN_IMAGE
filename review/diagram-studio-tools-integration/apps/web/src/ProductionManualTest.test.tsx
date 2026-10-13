import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {ProductionTestAction} from './App';
import {Api,type ProductionLot} from './api';

afterEach(()=>vi.unstubAllGlobals());
describe('Manual-only production Test',()=>{
  const lot={id:'lot',status:'WAITING_TEST',testProfileKey:null,testClaimedById:'tester'} as ProductionLot;
  const props={lot,currentUser:{id:'tester',role:'MEMBER' as const},disabled:false,canOperate:true,onClaim:vi.fn(),onResult:vi.fn()};
  it('offers a direct claim without a device-method choice',()=>{
    const action=ProductionTestAction(props)!;
    const html=renderToStaticMarkup(action);
    expect(html).toContain('Nhận Test');expect(html).not.toContain('ESP32');expect(html).not.toContain('Cloud');
    action.props.onClick();expect(props.onClaim).toHaveBeenCalledWith(lot);
  });
  it('only offers result entry to the tester or Admin',()=>{
    const testing={...lot,status:'TESTING' as const};
    expect(renderToStaticMarkup(<ProductionTestAction {...props} lot={testing}/>)).toContain('Nhập kết quả');
    expect(renderToStaticMarkup(<ProductionTestAction {...props} lot={testing} currentUser={{id:'other',role:'MEMBER'}}/>)).not.toContain('Nhập kết quả');
    expect(renderToStaticMarkup(<ProductionTestAction {...props} lot={testing} currentUser={{id:'admin',role:'ADMIN'}}/>)).toContain('Nhập kết quả');
  });
  it('disables claim for unrelated members and during submission',()=>{
    expect(renderToStaticMarkup(<ProductionTestAction {...props} canOperate={false}/>)).toContain('disabled');
    expect(renderToStaticMarkup(<ProductionTestAction {...props} disabled/>)).toContain('disabled');
    expect(renderToStaticMarkup(<ProductionTestAction {...props} lot={{...lot,status:'DONE'}}/>)).toBe('');
  });
  it('uses the manual claim/result endpoints and has no publish API',async()=>{
    const mock=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({})});vi.stubGlobal('fetch',mock);
    const api=new Api('test-only');
    await api.claimProductionTest('lot');
    await api.completeProductionTest('lot',{testedQuantity:20,passedQuantity:18,failedQuantity:2});
    expect(mock.mock.calls[0][0]).toContain('/production/lots/lot/claim-test');
    expect(mock.mock.calls[1][0]).toContain('/production/lots/lot/test-result');
    expect('publishProductionDeviceTest' in api).toBe(false);
  });
});
