import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../users/user.entity';
import { ActivationService } from './activation.service';

describe('ActivationService',()=>{
  const repository={find:jest.fn(),create:jest.fn((value)=>value),save:jest.fn(async(value)=>({...value,id:'activation-1'}))};
  const service=new ActivationService(repository as never);
  const admin={id:'admin-1',username:'admin',displayName:'Admin',role:UserRole.ADMIN};
  const member={id:'member-1',username:'member',displayName:'Member',role:UserRole.MEMBER};
  beforeEach(()=>jest.clearAllMocks());
  it('blocks member history',async()=>expect(service.history(member)).rejects.toBeInstanceOf(ForbiddenException));
  it('forces Auto2Tech paid',async()=>{const row=await service.generate({series:'01-02-03-04-05-06-07-08',product:'SCANBOX',packageCode:'SMARTKEY',source:'Auto2Tech',paymentStatus:'UNPAID'},admin);expect(row.paymentStatus).toBe('PAID');expect(row.activationCode).toBe('7927');});
  it('keeps dealer unpaid input',async()=>{const row=await service.generate({series:'01-02-03-04-05-06-07-08',product:'KEYSCAN',packageCode:'RH850',source:'TAD',paymentStatus:'UNPAID'},admin);expect(row.paymentStatus).toBe('UNPAID');});
});
