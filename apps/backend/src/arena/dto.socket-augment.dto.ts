import { IsString, Length } from 'class-validator';

export class SocketAugmentDto {
  @IsString()
  @Length(1, 100)
  characterId!: string;

  @IsString()
  @Length(1, 100)
  itemInstanceId!: string;

  @IsString()
  @Length(1, 100)
  socketId!: string;

  @IsString()
  @Length(1, 100)
  augmentItemId!: string;
}
