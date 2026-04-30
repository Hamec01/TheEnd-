import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto.login.dto';
import { RegisterDto } from './dto.register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto): Promise<{ id: string; login: string; createdAt: Date }> {
    const existing = await this.prisma.account.findUnique({ where: { login: dto.login } });
    if (existing) {
      throw new ConflictException('Login is already used.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const account = await this.prisma.account.create({
      data: {
        login: dto.login,
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
    const account = await this.prisma.account.findUnique({
      where: { login: dto.login },
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
