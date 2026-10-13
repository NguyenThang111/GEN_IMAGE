import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ProductionModule, ProductionOutputType } from './production-entry.entity';
import { CreateProductionEntryDto } from './production.dto';

describe('Production report DTO',()=>{
  const base={userId:'11111111-1111-4111-8111-111111111111',workDate:'2026-08-15',module:ProductionModule.SUPPORT,workType:'Báo cáo ngày',outputType:ProductionOutputType.LABEL,outputLabel:'Việc đã làm'};

  it('lets the server derive Incharge Lots and still validates supplied ids',async()=>{
    expect(await validate(Object.assign(new CreateProductionEntryDto(),base,{lotIds:[]}))).toHaveLength(0);
    expect(await validate(Object.assign(new CreateProductionEntryDto(),base))).toHaveLength(0);
    expect(await validate(Object.assign(new CreateProductionEntryDto(),base,{lotIds:['22222222-2222-4222-8222-222222222222']}))).toHaveLength(0);
    expect((await validate(Object.assign(new CreateProductionEntryDto(),base,{lotIds:['not-a-uuid']}))).some(error=>error.property==='lotIds')).toBe(true);
  });

  it('validates each structured daily report line',async()=>{
    const valid=plainToInstance(CreateProductionEntryDto,{...base,reportItems:[{lotId:'22222222-2222-4222-8222-222222222222',stage:'ASSEMBLE',quantity:20,result:'PASSED',note:'Đã bấm cos'}]});
    expect(await validate(valid)).toHaveLength(0);
    const invalid=plainToInstance(CreateProductionEntryDto,{...base,reportItems:[{lotId:'not-a-lot',stage:'UNKNOWN',quantity:0,result:'DONE'}]});
    expect((await validate(invalid)).some(error=>error.property==='reportItems')).toBe(true);
  });
});
