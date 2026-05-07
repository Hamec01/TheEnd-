/**
 * format-item-effect.spec.ts
 *
 * Tests for formatItemEffect — verifies Russian human-readable strings for each effect type.
 */

import { describe, expect, it } from 'vitest';
import { formatItemEffect } from '../content/item-effects.formatter';
import type { ItemEffect } from '../content/content.types';

describe('formatItemEffect', () => {
  it('incoming_damage_modifier negative percent → "+N% к защите от …"', () => {
    const effect: ItemEffect = { type: 'incoming_damage_modifier', percent: -30, physicalType: 'blunt' };
    const result = formatItemEffect(effect);
    expect(result).toBe('+30% к защите от дробящего урона');
  });

  it('crit_chance_taken_modifier negative → "-N% шанс получить критический удар"', () => {
    const effect: ItemEffect = { type: 'crit_chance_taken_modifier', percent: -3 };
    const result = formatItemEffect(effect);
    expect(result).toBe('-3% к шансу получить критический удар');
  });

  it('armor_penetration → "Игнорирует N% брони цели"', () => {
    const effect: ItemEffect = { type: 'armor_penetration', percent: -15 };
    const result = formatItemEffect(effect);
    expect(result).toBe('Игнорирует 15% брони цели');
  });

  it('apply_status with trigger on_hit → "При попадании: N% шанс наложить …"', () => {
    const effect: ItemEffect = {
      type: 'apply_status',
      statusId: 'blind',
      chancePercent: 10,
      durationTurns: 1,
      trigger: 'on_hit',
    };
    const result = formatItemEffect(effect);
    expect(result).toContain('При попадании');
    expect(result).toContain('10%');
    expect(result).toContain('ослепление');
    expect(result).toContain('1 ход');
  });

  it('stat_bonus for strength', () => {
    const effect: ItemEffect = { type: 'stat_bonus', stat: 'strength', flat: 5 };
    const result = formatItemEffect(effect);
    expect(result).toContain('силе');
  });

  it('lifesteal → "Вампиризм N%…"', () => {
    const effect: ItemEffect = { type: 'lifesteal', percent: 8 };
    const result = formatItemEffect(effect);
    expect(result).toContain('Вампиризм');
    expect(result).toContain('8%');
  });

  it('status_immunity → "Иммунитет к эффекту"', () => {
    const effect: ItemEffect = { type: 'status_immunity', statusId: 'stun' };
    const result = formatItemEffect(effect);
    expect(result).toContain('Иммунитет');
    expect(result).toContain('оглушение');
  });

  it('outgoing_damage_modifier with element → formatSignedNumber + "стихийного"', () => {
    const effect: ItemEffect = { type: 'outgoing_damage_modifier', percent: 20, damageCategory: 'elemental' };
    const result = formatItemEffect(effect);
    expect(result).toContain('+20%');
    expect(result).toContain('стихийного');
  });

  it('fire element damage', () => {
    const effect: ItemEffect = { type: 'outgoing_damage_modifier', percent: 15, elementType: 'fire' };
    const result = formatItemEffect(effect);
    expect(result).toContain('огненного');
  });

  it('dodge_chance_modifier', () => {
    const effect: ItemEffect = { type: 'dodge_chance_modifier', percent: 5 };
    const result = formatItemEffect(effect);
    expect(result).toContain('уклонени');
  });

  it('extra_attack_chance', () => {
    const effect: ItemEffect = { type: 'extra_attack_chance', percent: 10 };
    const result = formatItemEffect(effect);
    expect(result).toContain('дополнительной атак');
  });

  it('unknown effect type returns fallback string', () => {
    const effect = { type: 'totally_unknown_type' } as unknown as ItemEffect;
    const result = formatItemEffect(effect);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});
