/**
 * JSON request from the owner's screens. Never throws: a network failure or a
 * non-JSON error is { ok: false } with no text (the caller shows saveFailed).
 */
export async function sendJson(
  url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data };
    return typeof data?.error === 'string' ? { ok: false, error: data.error } : { ok: false };
  } catch {
    return { ok: false };
  }
}
