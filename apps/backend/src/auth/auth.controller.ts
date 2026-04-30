import { Body, Controller, Post } from '@nestjs/common';
import { LoginDto } from './dto.login.dto';
import { RegisterDto } from './dto.register.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<{ id: string; login: string; createdAt: Date }> {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto): Promise<{ id: string; login: string; createdAt: Date }> {
    return this.authService.login(dto);
  }
}
