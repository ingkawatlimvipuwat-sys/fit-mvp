export interface LimitResult { allowed: boolean; retryAfterSec: number }

/**
 * Fixed-window counter per key, held in this server instance's memory only.
 * Instances do not share it and a cold start empties it, so it is a speed
 * bump, not a guarantee. Memory is bounded: at maxKeys, expired windows are
 * dropped, and if that is not enough the map is cleared (fails open).
 */
export function createFixedWindowLimiter(opts: {
  limit: number; windowMs: number; maxKeys?: number; now?: () => number;
}): { hit(key: string): LimitResult; size(): number } {
  const { limit, windowMs } = opts;
  const maxKeys = opts.maxKeys ?? 5000;
  const now = opts.now ?? Date.now;
  const windows = new Map<string, { count: number; resetAt: number }>();

  return {
    hit(key: string): LimitResult {
      const t = now();
      let entry = windows.get(key);
      if (!entry || entry.resetAt <= t) {
        if (!entry && windows.size >= maxKeys) {
          for (const [k, w] of windows) if (w.resetAt <= t) windows.delete(k);
          if (windows.size >= maxKeys) windows.clear();
        }
        entry = { count: 0, resetAt: t + windowMs };
        windows.set(key, entry);
      }
      entry.count += 1;
      if (entry.count > limit) {
        return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - t) / 1000)) };
      }
      return { allowed: true, retryAfterSec: 0 };
    },
    size: () => windows.size,
  };
}

/** The caller's IP as Vercel reports it: first x-forwarded-for entry, else x-real-ip, else 'unknown'. Never logged or stored. */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  const real = headers.get('x-real-ip')?.trim();
  return real || 'unknown';
}
