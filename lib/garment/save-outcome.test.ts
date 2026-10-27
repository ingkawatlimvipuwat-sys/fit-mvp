import { describe, it, expect } from 'vitest';
import { COLOUR_FABRIC_NOT_SAVED, saveOutcome } from './save-outcome';

describe('saveOutcome', () => {
  it('is done for a clean save, create or edit', () => {
    expect(saveOutcome(false, { ok: true, id: 'x' })).toBe('done');
    expect(saveOutcome(true, { ok: true })).toBe('done');
  });

  it('create with a warning warns and leaves (a second Save would duplicate the garment)', () => {
    expect(saveOutcome(false, { ok: true, warning: COLOUR_FABRIC_NOT_SAVED })).toBe('warn_and_leave');
  });

  it('edit with a warning warns and stays so Save retries', () => {
    expect(saveOutcome(true, { ok: true, warning: COLOUR_FABRIC_NOT_SAVED })).toBe('warn_and_stay');
  });

  it.each([null, 'text', {}, { warning: 'other' }, undefined, 42])('treats %j as done', body => {
    expect(saveOutcome(false, body)).toBe('done');
    expect(saveOutcome(true, body)).toBe('done');
  });

  it('pins the wire value', () => {
    expect(COLOUR_FABRIC_NOT_SAVED).toBe('colour_fabric_not_saved');
  });
});
