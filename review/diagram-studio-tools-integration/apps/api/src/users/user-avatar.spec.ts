const sharp = require('sharp') as (input:Buffer|{create:{width:number;height:number;channels:3;background:string}})=>import('sharp').Sharp;
import { normalizeUserAvatar } from './user-avatar';
import { UsersService } from './users.service';
import { User, UserRole } from './user.entity';
import { getMetadataArgsStorage } from 'typeorm';

describe('Admin member avatars',()=>{
  const admin={id:'admin',username:'admin',displayName:'Admin',role:UserRole.ADMIN};
  const member={...admin,id:'member',role:UserRole.MEMBER};
  async function file(){const buffer=await sharp({create:{width:320,height:200,channels:3,background:'#4678aa'}}).png().toBuffer();return {buffer,size:buffer.length,mimetype:'image/png'};}
  function setup(){const users={exist:jest.fn().mockResolvedValue(true),update:jest.fn().mockResolvedValue({affected:1})};return {users,service:new UsersService(users as never)};}
  it('decodes, resizes and re-encodes to 192px WebP',async()=>{
    const value=await normalizeUserAvatar(await file());const meta=await sharp(Buffer.from(value.split(',')[1],'base64')).metadata();
    expect(value.startsWith('data:image/webp;base64,')).toBe(true);expect(meta).toMatchObject({width:192,height:192,format:'webp'});expect(meta.exif).toBeUndefined();
  });
  it('allows Admin to save a member image with no unrelated profile writes',async()=>{
    const {users,service}=setup();const result=await service.uploadAvatar('member',await file(),admin);
    expect(users.update).toHaveBeenCalledWith({id:'member',isActive:true},{avatarDataUrl:result.avatarDataUrl});expect(Object.keys(result).sort()).toEqual(['avatarDataUrl','id']);
  });
  it.each(['member','other'])('blocks a Member uploading to %s',async id=>{
    const {users,service}=setup();await expect(service.uploadAvatar(id,await file(),member)).rejects.toThrow('Chỉ Admin');expect(users.update).not.toHaveBeenCalled();
  });
  it('rejects missing or inactive users',async()=>{
    const {users,service}=setup();users.exist.mockResolvedValue(false);await expect(service.uploadAvatar('missing',await file(),admin)).rejects.toThrow('Không tìm thấy');expect(users.update).not.toHaveBeenCalled();
  });
  it('rejects missing files',async()=>{const {service}=setup();await expect(service.uploadAvatar('member',undefined,admin)).rejects.toThrow('Chọn ảnh');});
  it('rejects incorrect MIME, fake files, unsupported SVG and oversized input',async()=>{
    const png=await file();const {service,users}=setup();
    for(const invalid of [{...png,mimetype:'image/jpeg'},{buffer:Buffer.from('fake'),size:4,mimetype:'image/png'},{...png,mimetype:'image/svg+xml'},{...png,size:3*1024*1024+1}])await expect(service.uploadAvatar('member',invalid,admin)).rejects.toThrow();
    expect(users.update).not.toHaveBeenCalled();
  });
  it('does not select image data by default in auth or other user relations',()=>{
    const column=getMetadataArgsStorage().columns.find(c=>c.target===User&&c.propertyName==='avatarDataUrl');expect(column?.options.select).toBe(false);
  });
});
