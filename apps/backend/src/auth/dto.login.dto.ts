import { IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(3, 40)
  @Matches(/^[a-zA-Z0-9_@.-]+$/)
  login!: string;

  @IsString()
  @Length(5, 100)
  password!: string;
}
