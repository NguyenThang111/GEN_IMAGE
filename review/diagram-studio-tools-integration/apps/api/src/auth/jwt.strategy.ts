import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from './auth.types';
import { UsersService } from '../users/users.service';
import { isCurrentSession } from './session-version';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly users: UsersService) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: config.get('JWT_SECRET') ?? 'dev-only-secret' });
  }
  async validate(payload: AuthUser & { sub: string; sessionVersion?: number }): Promise<AuthUser> {
    if (!payload.sub) throw new UnauthorizedException();
    const user = await this.users.findActiveById(payload.sub);
    if (!user || !isCurrentSession(payload, user)) throw new UnauthorizedException();
    return { id: user.id, username: user.username, displayName: user.displayName, role: user.role };
  }
}
