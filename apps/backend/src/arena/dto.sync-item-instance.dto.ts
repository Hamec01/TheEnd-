import { IsObject, IsOptional, IsString, Length } from 'class-validator';

export class SyncItemInstanceDto {
  @IsString()
  @Length(1, 100)
  characterId!: string;

  @IsString()
  @Length(1, 100)
  itemId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  itemInstanceId?: string;

  @IsOptional()
  @IsObject()
  state?: Record<string, unknown> | null;
}
