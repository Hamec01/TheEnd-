import { Module } from '@nestjs/common';
import { RuntimeCharacterStore } from '../characters/runtime-character-store';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, RuntimeCharacterStore],
  exports: [AuthService],
})
export class AuthModule {}
