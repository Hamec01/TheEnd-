import { IsString, Length } from 'class-validator';

export class UnequipItemInstanceDto {
  @IsString()
  @Length(1, 100)
  characterId!: string;

  @IsString()
  @Length(1, 100)
  itemInstanceId!: string;
}
