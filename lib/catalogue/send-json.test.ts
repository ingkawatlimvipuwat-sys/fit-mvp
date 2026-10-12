import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendJson } from './send-json';

afterEach(() => { vi.unstubAllGlobals(); });
// Typed as fetch so toHaveBeenCalledWith checks real arguments (no unused params for lint).
const reply = (status: number, body: string) => vi.fn<typeof fetch>(async () => new Response(body, { status }));

describe('sendJson', () => {
  it('sends JSON and returns the body on success', async () => {
    const fetchMock = reply(200, JSON.stringify({ ok: true, id: 'x' }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendJson('/api/folders', 'POST', { name: 'a' })).toEqual({ ok: true, data: { ok: true, id: 'x' } });
    expect(fetchMock).toHaveBeenCalledWith('/api/folders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"name":"a"}',
    });
  });
  it('passes the server error text through', async () => {
    vi.stubGlobal('fetch', reply(409, JSON.stringify({ error: 'ย้ายไม่ได้' })));
    expect(await sendJson('/x', 'PATCH', {})).toEqual({ ok: false, error: 'ย้ายไม่ได้' });
  });
  it('a non-JSON error has no text', async () => {
    vi.stubGlobal('fetch', reply(500, 'oops'));
    expect(await sendJson('/x', 'DELETE')).toEqual({ ok: false });
  });
  it('a network failure never throws', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => { throw new Error('offline'); }));
    expect(await sendJson('/x', 'DELETE')).toEqual({ ok: false });
  });
});
