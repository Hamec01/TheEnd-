import { IsString, Length } from 'class-validator';

export class UnsocketAugmentDto {
  @IsString()
  @Length(1, 100)
  characterId!: string;

  @IsString()
  @Length(1, 100)
  itemInstanceId!: string;

  @IsString()
  @Length(1, 100)
  socketId!: string;
}
