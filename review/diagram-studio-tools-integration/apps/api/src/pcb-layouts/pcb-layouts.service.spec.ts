import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuthUser } from '../auth/auth.types';
import { RealtimeGateway } from '../tasks/realtime.gateway';
import { UserRole } from '../users/user.entity';
import { PcbLayout, PcbLayoutProduct } from './pcb-layout.entity';
import { PcbLayoutsService } from './pcb-layouts.service';

const actor=(role=UserRole.MEMBER):AuthUser=>({id:'user-1',username:'user',displayName:'User',role});
const file=(text:string)=>({originalname:'keyscan.html',mimetype:'text/html',size:Buffer.byteLength(text),buffer:Buffer.from(text)});

describe('PcbLayoutsService',()=>{
  const realtime={emitTask:jest.fn()} as unknown as RealtimeGateway;
  beforeEach(()=>jest.clearAllMocks());

  it('blocks members from replacing a layout',async()=>{
    const service=new PcbLayoutsService({} as Repository<PcbLayout>,realtime);
    await expect(service.upload('KEYSCAN',file('<html>Interactive BOM</html>'),actor())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a regular HTML page',async()=>{
    const service=new PcbLayoutsService({} as Repository<PcbLayout>,realtime);
    await expect(service.upload('KEYSCAN',file('<html><body>Page</body></html>'),actor(UserRole.ADMIN))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lets a member update shared progress and broadcasts it',async()=>{
    const layout={id:'layout-1',product:PcbLayoutProduct.KEYSCAN,progress:{Sourced:'1'},progressVersion:1,updatedById:'admin'} as unknown as PcbLayout;
    const repository={findOneBy:jest.fn().mockResolvedValue(layout),save:jest.fn().mockImplementation(async value=>value)} as unknown as Repository<PcbLayout>;
    const service=new PcbLayoutsService(repository,realtime);
    const saved=await service.updateProgress('KEYSCAN',{checkbox:'Placed',refs:'2,3'},actor());
    expect(saved.progress).toEqual({Sourced:'1',Placed:'2,3'});
    expect(saved.progressVersion).toBe(2);
    expect(realtime.emitTask).toHaveBeenCalledWith('pcb-layout.updated',saved);
  });
});
