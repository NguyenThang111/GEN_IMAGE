import 'reflect-metadata';
import { validate } from 'class-validator';
import { FinishedProductCategory } from './finished-product.entity';
import { plainToInstance } from 'class-transformer';
import { CreateFinishedProductDto, UpdateFinishedProductDto, UpdateStockCountSheetDto } from './inventory.dto';

describe('Finished Product category DTO',()=>{
  it.each(Object.values(FinishedProductCategory))('accepts category %s when creating',async(category)=>{
    const dto=Object.assign(new CreateFinishedProductDto(),{name:'Thành phẩm test',category});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('requires a valid category when creating',async()=>{
    expect((await validate(Object.assign(new CreateFinishedProductDto(),{name:'Thiếu tag'}))).some(error=>error.property==='category')).toBe(true);
    expect((await validate(Object.assign(new CreateFinishedProductDto(),{name:'Sai tag',category:'BOX'}))).some(error=>error.property==='category')).toBe(true);
  });

  it('allows Admin to update only the category',async()=>{
    expect(await validate(Object.assign(new UpdateFinishedProductDto(),{category:FinishedProductCategory.DEVICE}))).toHaveLength(0);
  });
});

describe('Stock count sheet DTO',()=>{
  it('accepts a complete physical count line',async()=>{
    const dto=plainToInstance(UpdateStockCountSheetDto,{lines:[{ownerType:'FINISHED_PRODUCT',ownerId:'00000000-0000-4000-8000-000000000001',countedQuantity:12,note:'Đếm tại kệ A'}]});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects negative counts and invalid owner types',async()=>{
    const dto=plainToInstance(UpdateStockCountSheetDto,{lines:[{ownerType:'MATERIAL',ownerId:'00000000-0000-4000-8000-000000000001',countedQuantity:-1}]});
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
