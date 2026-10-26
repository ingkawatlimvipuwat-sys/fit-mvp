/** Sent as `warning` in a 200 garment-save response when the garment saved but colours/fabric did not. */
export const COLOUR_FABRIC_NOT_SAVED = 'colour_fabric_not_saved';

export type SaveOutcome = 'done' | 'warn_and_leave' | 'warn_and_stay';

/**
 * What the form does after a 2xx save. Create (incl. duplicate) must leave the
 * form even on a warning — a second Save would create a second garment. Edit
 * stays, keeping the typed colours/fabric in the form, so pressing Save again
 * (a full, idempotent PATCH) retries them.
 */
export function saveOutcome(isEdit: boolean, body: unknown): SaveOutcome {
  const warned = typeof body === 'object' && body !== null
    && (body as { warning?: unknown }).warning === COLOUR_FABRIC_NOT_SAVED;
  if (!warned) return 'done';
  return isEdit ? 'warn_and_stay' : 'warn_and_leave';
}
