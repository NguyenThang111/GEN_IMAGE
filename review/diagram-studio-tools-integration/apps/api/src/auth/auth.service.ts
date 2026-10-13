import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersService, private readonly jwt: JwtService) {}
  async login(username: string, password: string) {
    const user = await this.users.findByUsernameWithPassword(username);
    if (!user?.isActive || !(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException('Invalid credentials');
    const profile = { id: user.id, username: user.username, displayName: user.displayName, role: user.role };
    return { accessToken: await this.jwt.signAsync({ sub: user.id, sessionVersion: user.sessionVersion ?? 0, ...profile }), user: profile };
  }
}
