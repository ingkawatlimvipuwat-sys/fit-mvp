import { describe, it, expect } from 'vitest';
import { createFixedWindowLimiter, clientIpFrom } from './rate-limit';

describe('createFixedWindowLimiter', () => {
  it('allows up to the limit then refuses with the time left in the window', () => {
    const now = 0;
    const lim = createFixedWindowLimiter({ limit: 3, windowMs: 60_000, now: () => now });
    for (let i = 0; i < 3; i++) expect(lim.hit('a')).toEqual({ allowed: true, retryAfterSec: 0 });
    expect(lim.hit('a')).toEqual({ allowed: false, retryAfterSec: 60 });
  });

  it('rounds the wait up and opens a new window at the boundary', () => {
    let now = 0;
    const lim = createFixedWindowLimiter({ limit: 1, windowMs: 60_000, now: () => now });
    expect(lim.hit('a').allowed).toBe(true);
    now = 59_000;
    expect(lim.hit('a')).toEqual({ allowed: false, retryAfterSec: 1 });
    now = 60_000;
    expect(lim.hit('a').allowed).toBe(true);
  });

  it('counts keys separately', () => {
    const now = 0;
    const lim = createFixedWindowLimiter({ limit: 1, windowMs: 60_000, now: () => now });
    expect(lim.hit('a').allowed).toBe(true);
    expect(lim.hit('b').allowed).toBe(true);
    expect(lim.hit('a').allowed).toBe(false);
  });

  it('prunes expired windows when full', () => {
    let now = 0;
    const lim = createFixedWindowLimiter({ limit: 5, windowMs: 60_000, maxKeys: 2, now: () => now });
    lim.hit('a');
    lim.hit('b');
    now = 60_000;
    lim.hit('c');
    expect(lim.size()).toBe(1);
  });

  it('clears the map (fails open) when full and nothing has expired', () => {
    let now = 0;
    const lim = createFixedWindowLimiter({ limit: 5, windowMs: 60_000, maxKeys: 2, now: () => now });
    lim.hit('a');
    lim.hit('b');
    now = 1;
    expect(lim.hit('c').allowed).toBe(true);
    expect(lim.size()).toBe(1);
  });
});

describe('clientIpFrom', () => {
  it('takes the first x-forwarded-for entry', () => {
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
  });
  it('falls back to x-real-ip', () => {
    expect(clientIpFrom(new Headers({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
  });
  it('falls back to unknown', () => {
    expect(clientIpFrom(new Headers())).toBe('unknown');
  });
  it('ignores a blank x-forwarded-for', () => {
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': '  ', 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
  });
});
