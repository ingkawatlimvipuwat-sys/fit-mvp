/**
 * Opaque per-browser ID. Stored in localStorage (NOT a cookie — keeps it
 * fully client-side and out of server logs). Send it explicitly with any
 * request that should record / pre-fill measurements.
 */
const KEY = 'fitmvp.customer_token';

export function getOrCreateCustomerToken(): string {
  if (typeof window === 'undefined') return '';
  let t = window.localStorage.getItem(KEY);
  if (!t) {
    t = crypto.randomUUID();
    window.localStorage.setItem(KEY, t);
  }
  return t;
}
