import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { copyStoredObject } from './storage-copy';
import { STORAGE_PREFIX } from './photo-upload';

function stub(copyError: unknown = null) {
  const calls: [string, string][] = [];
  const client = {
    storage: {
      from: () => ({
        copy: async (a: string, b: string) => { calls.push([a, b]); return { error: copyError }; },
        getPublicUrl: (p: string) => ({ data: { publicUrl: `https://x${STORAGE_PREFIX}${p}` } }),
      }),
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}
const url = (p: string) => `https://x${STORAGE_PREFIX}${p}`;

describe('copyStoredObject', () => {
  it('copies to a new path under the same owner', async () => {
    const { client, calls } = stub();
    const r = await copyStoredObject(client, 'u1', url('u1/abc.jpg'));
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('u1/abc.jpg');
    expect(calls[0][1]).toMatch(/^u1\/[0-9a-f-]+\.jpg$/);
    expect(calls[0][1]).not.toBe('u1/abc.jpg');
    expect(r).not.toBe('failed');
    expect(r && r !== 'failed' && r.path).toBe(calls[0][1]);
  });
  it("refuses another shop's file without calling copy", async () => {
    const { client, calls } = stub();
    expect(await copyStoredObject(client, 'u1', url('u2/abc.jpg'))).toBe('failed');
    expect(calls).toHaveLength(0);
  });
  it('returns null for no url', async () => {
    expect(await copyStoredObject(stub().client, 'u1', null)).toBe(null);
  });
  it("returns 'failed' when Storage errors", async () => {
    expect(await copyStoredObject(stub({ message: 'x' }).client, 'u1', url('u1/a.jpg'))).toBe('failed');
  });
});
