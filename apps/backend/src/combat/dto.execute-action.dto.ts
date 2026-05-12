import { IsInt, IsObject, IsString, Length, Min } from 'class-validator';

/**
 * DTO for POST /combat/:battleId/action
 * The `command` field is a CombatCommand object — we accept it as a plain object
 * and let the service normalize + validate it via normalizeCombatCommand().
 */
export class ExecuteCombatActionDto {
  @IsString()
  @Length(1, 100)
  actorId!: string;

  @IsInt()
  @Min(0)
  roundNumber!: number;

  @IsObject()
  command!: Record<string, unknown>;
}
