import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import { AuthUser } from '../auth/auth.types';
import { normalizeUserAvatar } from './user-avatar';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}
  findByUsernameWithPassword(username: string) {
    return this.users.createQueryBuilder('user').addSelect(['user.passwordHash', 'user.sessionVersion']).where('user.username = :username', { username }).getOne();
  }
  findActive() {
    return this.users.createQueryBuilder('user').addSelect('user.avatarDataUrl').where('user.isActive = :active',{active:true}).orderBy('user.displayName','ASC').getMany();
  }
  async uploadAvatar(id:string,file:{buffer:Buffer;mimetype:string;size:number}|undefined,actor:AuthUser){
    if(actor.role!==UserRole.ADMIN)throw new ForbiddenException('Chỉ Admin được thay ảnh thành viên');
    if(!file)throw new BadRequestException('Chọn ảnh thành viên');
    if(!await this.users.exist({where:{id,isActive:true}}))throw new NotFoundException('Không tìm thấy thành viên');
    const avatarDataUrl=await normalizeUserAvatar(file);
    await this.users.update({id,isActive:true},{avatarDataUrl});
    return {id,avatarDataUrl};
  }
  findActiveById(id: string) {
    return this.users.createQueryBuilder('user').addSelect('user.sessionVersion').where('user.id = :id AND user.isActive = true', { id }).getOne();
  }
  async updateEmail(id: string, email: string | null, actor: AuthUser) {
    if (actor.role !== UserRole.ADMIN) throw new ForbiddenException('Admin permission required');
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException();
    user.email = email?.trim().toLowerCase() || null;
    return this.users.save(user);
  }
}
