import { describe, it, expect } from 'vitest';
import {
  normaliseCustomerToken, sameMeasurements, decideSessionWrite,
  SESSION_WRITE_CAP, DUPLICATE_WINDOW_MS,
} from './session-gate';

describe('normaliseCustomerToken', () => {
  it('keeps a uuid, trims whitespace, and keeps 64 characters', () => {
    const id = crypto.randomUUID();
    expect(normaliseCustomerToken(id)).toBe(id);
    expect(normaliseCustomerToken('  abc  ')).toBe('abc');
    expect(normaliseCustomerToken('a'.repeat(64))).toBe('a'.repeat(64));
  });

  it.each(['', '   ', undefined, 42, 'a'.repeat(65), 'has space', '<script>'])('rejects %j', v => {
    expect(normaliseCustomerToken(v)).toBeNull();
  });
});

describe('sameMeasurements', () => {
  it('is true for equal bags, including two empty ones', () => {
    expect(sameMeasurements({ chest_cm: 100, hip_cm: 90 }, { chest_cm: 100, hip_cm: 90 })).toBe(true);
    expect(sameMeasurements({}, {})).toBe(true);
  });
  it('is false when keys or values differ', () => {
    expect(sameMeasurements({ chest_cm: 100 }, { chest_cm: 100, hip_cm: 90 })).toBe(false);
    expect(sameMeasurements({ chest_cm: 100, hip_cm: 90 }, { chest_cm: 100 })).toBe(false);
    expect(sameMeasurements({ chest_cm: 100 }, { chest_cm: 101 })).toBe(false);
  });
  it('is false for stored values that are not a plain object', () => {
    for (const stored of [null, [], 'x']) expect(sameMeasurements({ chest_cm: 100 }, stored)).toBe(false);
  });
});

describe('decideSessionWrite', () => {
  const now = Date.parse('2026-10-26T10:00:00Z');
  const measurements = { chest_cm: 100 };
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const last = (ms: number, m: unknown = { chest_cm: 100 }) => ({ customer_measurements: m, created_at: ago(ms) });

  it('inserts below the cap and skips at it', () => {
    expect(decideSessionWrite({ recentCount: 0, last: null, measurements, now })).toBe('insert');
    expect(decideSessionWrite({ recentCount: SESSION_WRITE_CAP - 1, last: null, measurements, now })).toBe('insert');
    expect(decideSessionWrite({ recentCount: SESSION_WRITE_CAP, last: null, measurements, now })).toBe('skip_cap');
  });

  it('fails open when the count failed', () => {
    expect(decideSessionWrite({ recentCount: null, last: null, measurements, now })).toBe('insert');
  });

  it('skips a duplicate within the window, even over the cap', () => {
    expect(decideSessionWrite({ recentCount: 500, last: last(DUPLICATE_WINDOW_MS - 1000), measurements, now })).toBe('skip_duplicate');
  });

  it('inserts at exactly the window, for different measurements, or for a garbage timestamp', () => {
    expect(decideSessionWrite({ recentCount: 0, last: last(DUPLICATE_WINDOW_MS), measurements, now })).toBe('insert');
    expect(decideSessionWrite({ recentCount: 0, last: last(60_000, { chest_cm: 101 }), measurements, now })).toBe('insert');
    expect(decideSessionWrite({
      recentCount: 0, last: { customer_measurements: { chest_cm: 100 }, created_at: 'garbage' }, measurements, now,
    })).toBe('insert');
  });
});
