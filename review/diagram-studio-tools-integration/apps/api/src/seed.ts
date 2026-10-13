import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { AppModule } from './app.module';
import { User, UserRole } from './users/user.entity';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const users = app.get<Repository<User>>(getRepositoryToken(User));
  const accounts = [
    { username: 'admin', displayName: 'Admin', role: UserRole.ADMIN, passwordEnv: 'SEED_PASSWORD' },
    { username: 'thang', displayName: 'THẮNG', role: UserRole.MEMBER, passwordEnv: 'SEED_PASSWORD_THANG' },
    { username: 'vinh', displayName: 'VINH', role: UserRole.MEMBER, passwordEnv: 'SEED_PASSWORD_VINH' },
    { username: 'phu', displayName: 'PHÚ', role: UserRole.MEMBER, passwordEnv: 'SEED_PASSWORD_PHU' },
    { username: 'giang', displayName: 'GIANG', role: UserRole.MEMBER, passwordEnv: 'SEED_PASSWORD_GIANG' },
    { username: 'nam', displayName: 'NAM', role: UserRole.MEMBER, passwordEnv: 'SEED_PASSWORD_NAM' },
    { username: 'my', displayName: 'MỸ', role: UserRole.MEMBER, passwordEnv: 'SEED_PASSWORD_MY' },
    { username: 'quangbk', displayName: 'QUANG BK', role: UserRole.MEMBER, passwordEnv: 'SEED_PASSWORD_QUANGBK' },
    { username: 'phongbk', displayName: 'PHONG BK', role: UserRole.MEMBER, passwordEnv: 'SEED_PASSWORD_PHONGBK' },
    { username: 'minhbk', displayName: 'MINH BK', role: UserRole.MEMBER, passwordEnv: 'SEED_PASSWORD_MINHBK' },
  ];
  for (const account of accounts) {
    const existing = await users.findOneBy({ username: account.username });
    const { passwordEnv: _, ...profile } = account;
    const configuredPassword = process.env[account.passwordEnv];
    const passwordHash = existing && !configuredPassword
      ? undefined
      : await bcrypt.hash(configuredPassword ?? process.env.SEED_PASSWORD ?? 'auto2tech123', 12);
    await users.save(users.create({ ...existing, ...profile, passwordHash, isActive: true }));
  }
  await users.update(['hung', 'lan', 'kienbk', 'thanhbk'].map((username) => ({ username })), { isActive: false });
  await app.close();
  process.stdout.write(`Seeded ${accounts.length} accounts\n`);
}

void seed();
