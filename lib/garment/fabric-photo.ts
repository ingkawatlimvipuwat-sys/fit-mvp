/**
 * What a save does to the fabric close-up photo. Pure so the four cases can be
 * tested without a database. `newUploadUrl` is the URL of a file uploaded in
 * this request (null if none); `removeRequested` is the retailer's tick.
 *
 * A new file always wins over the tick: ticking "remove" and then picking a
 * replacement means "use the new one". `deleteExisting` is true only when the
 * old photo is being taken OFF the garment; replacing it is cleaned up by the
 * route's separate replacement rules. Removing when there is no photo is a no-op.
 */
export function fabricPhotoPlan({ newUploadUrl, removeRequested, existingUrl }: {
  newUploadUrl: string | null;
  removeRequested: boolean;
  existingUrl: string | null;
}): { nextUrl: string | null; deleteExisting: boolean } {
  if (newUploadUrl) return { nextUrl: newUploadUrl, deleteExisting: false };
  if (removeRequested) return { nextUrl: null, deleteExisting: existingUrl !== null };
  return { nextUrl: existingUrl, deleteExisting: false };
}
