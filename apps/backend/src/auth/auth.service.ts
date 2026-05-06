import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { isFileStorageMode } from '../config/storage-mode';
import { RuntimeCharacterStore } from '../characters/runtime-character-store';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto.login.dto';
import { RegisterDto } from './dto.register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtimeStore: RuntimeCharacterStore,
  ) {}

  async register(dto: RegisterDto): Promise<{ id: string; login: string; createdAt: Date }> {
    const login = String(dto.login ?? '').trim();
    const password = String(dto.password ?? '');

    if (!login || !password) {
      throw new BadRequestException('Login and password are required.');
    }

    if (isFileStorageMode()) {
      const existing = await this.runtimeStore.findAccountByLogin(login);
      if (existing) {
        throw new ConflictException('Login is already used.');
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const account = await this.runtimeStore.createAuthAccount({ login, passwordHash });

      return {
        id: account.id,
        login: account.login ?? login,
        createdAt: new Date(account.createdAt),
      };
    }

    const existing = await this.prisma.account.findUnique({ where: { login } });
    if (existing) {
      throw new ConflictException('Login is already used.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const account = await this.prisma.account.create({
      data: {
        login,
        passwordHash,
      },
      select: {
        id: true,
        login: true,
        createdAt: true,
      },
    });

    return account;
  }

  async login(dto: LoginDto): Promise<{ id: string; login: string; createdAt: Date }> {
    const login = String(dto.login ?? '').trim();
    const password = String(dto.password ?? '');

    if (!login || !password) {
      throw new BadRequestException('Login and password are required.');
    }

    if (isFileStorageMode()) {
      const account = await this.runtimeStore.findAccountByLogin(login);
      if (!account?.passwordHash) {
        throw new UnauthorizedException('Invalid login or password.');
      }

      const ok = await bcrypt.compare(password, account.passwordHash);
      if (!ok) {
        throw new UnauthorizedException('Invalid login or password.');
      }

      return {
        id: account.id,
        login: account.login ?? login,
        createdAt: new Date(account.createdAt),
      };
    }

    const account = await this.prisma.account.findUnique({
      where: { login },
      select: {
        id: true,
        login: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    if (!account) {
      throw new UnauthorizedException('Invalid login or password.');
    }

    const ok = await bcrypt.compare(dto.password, account.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid login or password.');
    }

    return {
      id: account.id,
      login: account.login,
      createdAt: account.createdAt,
    };
  }
}
