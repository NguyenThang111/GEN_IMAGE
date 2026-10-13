import { validate } from 'class-validator';
import { ProductionService } from './production.service';
import { UpsertWorkSessionDto } from './production.dto';
import { UserRole } from '../users/user.entity';

describe('Production registration start time',()=>{
  const actor={id:'member',username:'phongbk',displayName:'PHONG BK',role:UserRole.MEMBER};
  const input={userId:actor.id,workDate:'2026-09-14',isRegistered:true};
  function setup(row:any=null){
    const sessions={findOneBy:jest.fn().mockResolvedValue(row),create:jest.fn(value=>value),save:jest.fn(async value=>value)};
    const service=Object.create(ProductionService.prototype) as ProductionService;
    Object.assign(service,{sessions,users:{exist:jest.fn().mockResolvedValue(true)},assertUnlocked:jest.fn(),ensurePaymentRequest:jest.fn(),realtime:{emitInventory:jest.fn()}});
    return {service,sessions};
  }
  it.each([undefined,null,'','8:00','24:00','08:60','08:00:00'])('rejects new registration without valid HH:mm (%s)',async plannedStartTime=>{
    const {service,sessions}=setup();
    await expect(service.upsertSession({...input,plannedStartTime},actor)).rejects.toThrow('giờ bắt đầu');
    expect(sessions.save).not.toHaveBeenCalled();
  });
  it.each(['00:00','08:00','23:59'])('saves a valid time %s without computing hours',async plannedStartTime=>{
    const {service}=setup();
    await expect(service.upsertSession({...input,plannedStartTime},actor)).resolves.toMatchObject({plannedStartTime,hoursWorked:null,updatedById:actor.id});
  });
  it('edits own time without erasing hours, including an old registration',async()=>{
    const {service}=setup({id:'old',isRegistered:true,hoursWorked:'5.50',plannedStartTime:null});
    await expect(service.upsertSession({...input,plannedStartTime:'09:30'},actor)).resolves.toMatchObject({id:'old',plannedStartTime:'09:30',hoursWorked:'5.50'});
  });
  it('preserves legacy registrations when reporting actual hours',async()=>{
    const {service}=setup({isRegistered:true,hoursWorked:null,plannedStartTime:null});
    await expect(service.upsertSession({...input,hoursWorked:4},actor)).resolves.toMatchObject({plannedStartTime:null,hoursWorked:'4.00'});
  });
  it('preserves scheduled time when reporting actual hours',async()=>{
    const {service}=setup({isRegistered:true,plannedStartTime:'10:00'});
    await expect(service.upsertSession({...input,hoursWorked:3},actor)).resolves.toMatchObject({plannedStartTime:'10:00',hoursWorked:'3.00'});
  });
  it('cancels without time and requires a new time on re-registration',async()=>{
    const {service,sessions}=setup({isRegistered:true,plannedStartTime:'08:00',hoursWorked:'2.00'});
    const canceled=await service.upsertSession({...input,isRegistered:false},actor);
    expect(canceled).toMatchObject({isRegistered:false,plannedStartTime:null,hoursWorked:'2.00'});
    sessions.findOneBy.mockResolvedValue(canceled);
    await expect(service.upsertSession(input,actor)).rejects.toThrow('giờ bắt đầu');
  });
  it('cannot clear a registered time',async()=>{
    const {service}=setup({isRegistered:true,plannedStartTime:'08:00'});
    await expect(service.upsertSession({...input,plannedStartTime:null},actor)).rejects.toThrow('giờ bắt đầu');
  });
  it('enforces member ownership but allows Admin',async()=>{
    const {service}=setup();const dto={...input,userId:'other',plannedStartTime:'08:00'};
    await expect(service.upsertSession(dto,actor)).rejects.toThrow('chính mình');
    await expect(service.upsertSession(dto,{...actor,role:UserRole.ADMIN})).resolves.toMatchObject({userId:'other',plannedStartTime:'08:00'});
  });
  it('respects existing payment locks',async()=>{
    const {service,sessions}=setup();Object.assign(service,{assertUnlocked:jest.fn().mockRejectedValue(new Error('locked'))});
    await expect(service.upsertSession({...input,plannedStartTime:'08:00'},actor)).rejects.toThrow('locked');
    expect(sessions.save).not.toHaveBeenCalled();
  });
  it.each(['8:00','24:00','08:60','08:00:00',''])('validates time format at the DTO boundary (%s)',async plannedStartTime=>{
    const dto=Object.assign(new UpsertWorkSessionDto(),{...input,userId:'889e36be-fb72-4662-804e-15cc3e3f11e3',plannedStartTime});
    expect((await validate(dto)).some(error=>error.property==='plannedStartTime')).toBe(true);
  });
});
