import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminSkillDefinition, ArenaCombatEntity } from '@theend/rpg-domain';
import { DamageKind, SkillResourceType, SkillType, validateSkillDefinition } from '@theend/rpg-domain';
import { ContentService } from '../content/content.service';
import { PrismaService } from '../prisma/prisma.service';

export interface SkillCooldownEntry {
  skillId: string;
  remainingRounds: number;
  oncePerCombat?: boolean;
}

export interface SkillExecutionResult {
  logs: string[];
  resourcesSpent: Record<string, number>;
  damageDone: Array<{
    targetId: string;
    amount: number;
    damageKind: DamageKind;
    element?: string;
  }>;
  healingDone: Array<{
    targetId: string;
    amount: number;
    healType: string;
  }>;
  effectsApplied: Array<{
    targetId: string;
    effectType: string;
    durationTurns?: number;
  }>;
  cooldownStarted: number;
  oncePerCombat: boolean;
}

@Injectable()
export class SkillRuntimeService {
  constructor(
    private readonly contentService: ContentService,
    private readonly prisma: PrismaService,
  ) {}

  async validateSkillUse(
    characterId: string,
    skillId: string,
    cooldowns: SkillCooldownEntry[],
    actor: ArenaCombatEntity,
  ): Promise<{ valid: boolean; reason?: string }> {
    await this.contentService.ensureInitialized();

    const def = this.contentService.getCollectionEntry('skills', skillId) as AdminSkillDefinition | null;
    if (!def) {
      return { valid: false, reason: `Skill not found: ${skillId}` };
    }
    if (!def.isPublished) {
      return { valid: false, reason: 'Skill is not published' };
    }
    if (def.isHidden) {
      return { valid: false, reason: 'Skill is hidden' };
    }

    // Check character knows skill
    const known = await this.prisma.characterSkill.findUnique({
      where: { characterId_skillId: { characterId, skillId } },
    });
    if (!known) {
      return { valid: false, reason: `Character has not learned skill: ${skillId}` };
    }

    // Check loadout
    const loadout = await this.prisma.characterSkillLoadout.findUnique({
      where: { characterId },
    });
    const slots = (loadout?.slots ?? []) as Array<{ skillId: string | null; unlocked: boolean }>;
    const equipped = slots.some((s) => s.unlocked && s.skillId === skillId);
    if (!equipped) {
      return { valid: false, reason: `Skill ${skillId} is not equipped in loadout` };
    }

    // Cooldown check
    const cooldown = cooldowns.find((c) => c.skillId === skillId);
    if (cooldown && cooldown.remainingRounds > 0) {
      return { valid: false, reason: `Skill ${skillId} is on cooldown (${cooldown.remainingRounds} rounds)` };
    }

    // Resource check
    const validation = validateSkillDefinition(def);
    if (validation.length > 0) {
      return { valid: false, reason: `Skill definition invalid: ${validation[0]}` };
    }

    if (!def.costs.isFree) {
      for (const cost of def.costs.resources) {
        if (cost.type === SkillResourceType.MP) {
          if (actor.currentMp < cost.amount) {
            return { valid: false, reason: `Not enough MP (need ${cost.amount}, have ${actor.currentMp})` };
          }
        } else if (cost.type === SkillResourceType.STAMINA) {
          if (actor.currentStamina < cost.amount) {
            return { valid: false, reason: `Not enough Stamina (need ${cost.amount}, have ${actor.currentStamina})` };
          }
        } else if (cost.type === SkillResourceType.HP) {
          if (actor.currentHp <= cost.amount) {
            return { valid: false, reason: `Not enough HP (need ${cost.amount}, have ${actor.currentHp})` };
          }
        }
      }
    }

    return { valid: true };
  }

  resolveSkillExecution(
    def: AdminSkillDefinition,
    actor: ArenaCombatEntity,
    target: ArenaCombatEntity | null,
    skillLevel = 1,
  ): SkillExecutionResult {
    const logs: string[] = [];
    const resourcesSpent: Record<string, number> = {};
    const damageDone: SkillExecutionResult['damageDone'] = [];
    const healingDone: SkillExecutionResult['healingDone'] = [];
    const effectsApplied: SkillExecutionResult['effectsApplied'] = [];

    // Deduct resources
    if (!def.costs.isFree) {
      for (const cost of def.costs.resources) {
        const amount = cost.amount + (cost.amountPerLevel ?? 0) * Math.max(0, skillLevel - 1);
        const key = cost.type.toLowerCase();
        resourcesSpent[key] = (resourcesSpent[key] ?? 0) + amount;
      }
    }

    logs.push(`${actor.name} uses ${def.name}`);

    // Calculate damage
    if (target && def.damage.length > 0) {
      for (const dmgComp of def.damage) {
        const baseDamage = this.randomInt(dmgComp.minDamage, dmgComp.maxDamage);
        const scalingBonus = dmgComp.scalingStat
          ? Math.floor(this.getActorStat(actor, dmgComp.scalingStat) * (dmgComp.scalingMultiplier ?? 0))
          : 0;
        let finalDamage = baseDamage + scalingBonus;

        // Crit
        if (dmgComp.canCrit && Math.random() < 0.05 + (dmgComp.critChanceBonus ?? 0) / 100) {
          const critMultiplier = dmgComp.critDamageMultiplier ?? 1.5;
          finalDamage = Math.floor(finalDamage * critMultiplier);
          logs.push(`Critical hit!`);
        }

        // Apply armor penetration / resistance
        const penetration = (dmgComp.armorPenetrationPercent ?? 0) / 100;
        const targetArmor = this.getTargetArmor(target, dmgComp.damageKind);
        const mitigated = targetArmor * (1 - penetration);
        finalDamage = Math.max(1, finalDamage - mitigated);

        damageDone.push({
          targetId: target.id,
          amount: Math.round(finalDamage),
          damageKind: dmgComp.damageKind,
          element: dmgComp.elements?.[0],
        });

        logs.push(`Deals ${Math.round(finalDamage)} ${dmgComp.damageKind} damage to ${target.name}`);
      }
    }

    // Calculate healing
    if (def.healing.length > 0) {
      const healTarget = target ?? actor;
      for (const healComp of def.healing) {
        const baseHeal = this.randomInt(healComp.minHeal, healComp.maxHeal);
        const scalingBonus = healComp.scalingStat
          ? Math.floor(this.getActorStat(actor, healComp.scalingStat) * (healComp.scalingMultiplier ?? 0))
          : 0;
        const finalHeal = baseHeal + scalingBonus;

        healingDone.push({
          targetId: healTarget.id,
          amount: Math.round(finalHeal),
          healType: healComp.healType,
        });

        logs.push(`Heals ${Math.round(finalHeal)} ${healComp.healType} on ${healTarget.name}`);
      }
    }

    // Apply effects
    if (target && def.effects.length > 0) {
      for (const effectComp of def.effects) {
        if (Math.random() * 100 <= effectComp.chancePercent) {
          effectsApplied.push({
            targetId: target.id,
            effectType: effectComp.effectType,
            durationTurns: effectComp.durationTurns,
          });
          logs.push(`Applied ${effectComp.effectType} to ${target.name}`);
        }
      }
    }

    return {
      logs,
      resourcesSpent,
      damageDone,
      healingDone,
      effectsApplied,
      cooldownStarted: def.cooldown.cooldownTurns,
      oncePerCombat: def.cooldown.oncePerCombat ?? false,
    };
  }

  async executeSkill(
    characterId: string,
    skillId: string,
    skillLevel = 1,
    cooldowns: SkillCooldownEntry[],
    actor: ArenaCombatEntity,
    target: ArenaCombatEntity | null,
  ): Promise<SkillExecutionResult> {
    const { valid, reason } = await this.validateSkillUse(characterId, skillId, cooldowns, actor);
    if (!valid) {
      throw new BadRequestException(reason);
    }

    const def = this.contentService.getCollectionEntry('skills', skillId) as AdminSkillDefinition;
    return this.resolveSkillExecution(def, actor, target, skillLevel);
  }

  getSkillDefinition(skillId: string): AdminSkillDefinition | null {
    return this.contentService.getCollectionEntry('skills', skillId) as AdminSkillDefinition | null;
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private getActorStat(actor: ArenaCombatEntity, statKey: string): number {
    const map: Record<string, keyof ArenaCombatEntity> = {
      strength: 'strength',
      constitution: 'constitution',
      dexterity: 'dexterity',
      intelligence: 'intelligence',
      luck: 'luck',
      perception: 'perception',
      willpower: 'willpower',
      hp: 'currentHp',
      mp: 'currentMp',
      stamina: 'currentStamina',
    };
    const key = map[statKey.toLowerCase()];
    return key ? (actor[key] as number ?? 0) : 0;
  }

  private getTargetArmor(target: ArenaCombatEntity, damageKind: DamageKind): number {
    // Basic mitigation based on constitution for physical, willpower for magic
    if (damageKind === DamageKind.PHYSICAL) {
      return Math.max(0, Math.floor(target.constitution * 0.3));
    }
    if (damageKind === DamageKind.ELEMENTAL || damageKind === DamageKind.MAGIC) {
      return Math.max(0, Math.floor(target.willpower * 0.2));
    }
    return 0;
  }
}
