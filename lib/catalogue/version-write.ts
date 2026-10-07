import { t } from '@/lib/i18n/strings';
import { findDuplicate, isComplete, versionLabel, type PickerDef, type Picks, type VersionPicks } from './picks';

/**
 * Rules 4 and "complete picks" for a version about to be written. Pure; the
 * routes call it after loadProductContext(). `ignoreId` is the version being
 * edited so it does not clash with itself.
 */
export function checkPicksForWrite(
  ctx: { pickers: PickerDef[]; versions: VersionPicks[] },
  picks: Picks,
  ignoreId?: string,
): { ok: true } | { ok: false; error: string } {
  const ids = ctx.pickers.map(p => p.id);
  if (!isComplete(picks, ids)) return { ok: false, error: t.pickRequired.th };
  const clash = findDuplicate(ctx.versions, picks, ids, ignoreId);
  if (!clash) return { ok: true };
  if (ids.length === 0) return { ok: false, error: t.addPickersFirst.th };
  return { ok: false, error: t.duplicatePicks.th.replace('{label}', versionLabel(clash.picks, ctx.pickers)) };
}
