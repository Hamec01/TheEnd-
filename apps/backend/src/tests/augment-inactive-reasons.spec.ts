import { describe, expect, it } from 'vitest';
import {
  augmentContextMismatchReason,
  augmentMissingOrDisabledReason,
  augmentMissingPayloadReason,
  augmentTypeMismatchReason,
} from '../content/augment-inactive-reasons';

describe('augment inactive reasons', () => {
  it('returns shared missing/disabled reason', () => {
    expect(augmentMissingOrDisabledReason()).toBe('Предмет-аугмент не найден или отключён');
  });

  it('returns payload-missing reason with item name', () => {
    expect(augmentMissingPayloadReason('Guard Stone')).toContain('Guard Stone');
  });

  it('returns type mismatch reason with type', () => {
    expect(augmentTypeMismatchReason('Guard Stone', 'magic_stone')).toContain('magic_stone');
  });

  it('returns context mismatch reason with contexts list', () => {
    expect(augmentContextMismatchReason('Guard Stone', ['weapon', 'combat'])).toContain('weapon, combat');
  });
});
