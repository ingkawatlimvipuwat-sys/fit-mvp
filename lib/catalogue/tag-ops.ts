import type { SupabaseClient } from '@supabase/supabase-js';
import { t } from '@/lib/i18n/strings';
import { checkTagOwnership, loadShopTags, type Failure } from './ownership';
import { findTagByName, tagNameClash, type TagRow } from './tags';

const fail500: Failure = { ok: false, status: 500, error: t.saveFailed.th };
const UNIQUE_VIOLATION = '23505';

/**
 * Attach a tag to a product by name (spec §5.2: typing an existing tag reuses
 * it; a new word creates it). The product must already be verified as the
 * caller's (loadProductContext). The tag is only ever looked up among the
 * caller's own tags, so another shop's tag can never be linked (product_tags
 * RLS checks only the product side).
 */
export async function attachTagByName(
  supabase: SupabaseClient, userId: string, productId: string, name: string,
): Promise<{ ok: true; tag: TagRow } | Failure> {
  const loaded = await loadShopTags(supabase, userId);
  if (!loaded.ok) return loaded;
  let tag = findTagByName(loaded.tags, name);

  if (!tag) {
    const { data, error } = await supabase
      .from('tags').insert({ retailer_id: userId, name }).select('id, name').single();
    if (error?.code === UNIQUE_VIOLATION) {
      // Created a moment ago (another tab): read again and reuse it.
      const again = await loadShopTags(supabase, userId);
      if (!again.ok) return again;
      tag = findTagByName(again.tags, name);
      if (!tag) { console.error('tag name clash but no matching tag found:', name); return fail500; }
    } else if (error || !data) {
      console.error('tag insert failed:', error);
      return fail500;
    } else {
      tag = data as TagRow;
    }
  }

  const { error: linkErr } = await supabase.from('product_tags').insert({ product_id: productId, tag_id: tag.id });
  if (linkErr && linkErr.code !== UNIQUE_VIOLATION) { // already attached is fine
    console.error('product tag insert failed:', linkErr);
    return fail500;
  }
  return { ok: true, tag };
}

/** Remove one tag from one (already verified) product. Another shop's tag id is a 404. The tag row stays. */
export async function detachTag(
  supabase: SupabaseClient, userId: string, productId: string, tagId: string,
): Promise<{ ok: true } | Failure> {
  const owns = await checkTagOwnership(supabase, userId, tagId);
  if (!owns.ok) return owns;
  const { error } = await supabase.from('product_tags').delete().eq('product_id', productId).eq('tag_id', tagId);
  if (error) { console.error('product tag delete failed:', error); return fail500; }
  return { ok: true };
}

export type TagOpFailure = { ok: false; status: 404 | 409 | 500; error: string };

/**
 * Rename one of the caller's tags shop-wide. Another shop's id is a 404. A name
 * another of the caller's tags already has is refused (409, naming it) — never
 * merged (Stage 3 open question 1). The unique index on (retailer_id, lower(name))
 * catches a clash created meanwhile in another tab (23505 → 409).
 */
export async function renameTag(
  supabase: SupabaseClient, userId: string, tagId: string, name: string,
): Promise<{ ok: true; tag: TagRow } | TagOpFailure> {
  const loaded = await loadShopTags(supabase, userId);
  if (!loaded.ok) return loaded;
  const tag = loaded.tags.find(x => x.id === tagId);
  if (!tag) return { ok: false, status: 404, error: t.itemNotFound.th };
  const clash = tagNameClash(loaded.tags, tagId, name);
  if (clash) return { ok: false, status: 409, error: t.tagNameTaken.th.replace('{name}', clash.name) };
  if (tag.name === name) return { ok: true, tag };

  const { error } = await supabase.from('tags').update({ name }).eq('id', tagId).eq('retailer_id', userId);
  if (error?.code === UNIQUE_VIOLATION) return { ok: false, status: 409, error: t.tagNameTaken.th.replace('{name}', name) };
  if (error) { console.error('tag rename failed:', error); return fail500; }
  return { ok: true, tag: { id: tagId, name } };
}

/**
 * Delete one of the caller's tags. product_tags.tag_id is ON DELETE CASCADE
 * (0005), so this one statement also removes it from every product. Another
 * shop's id is a 404, checked before the delete.
 */
export async function deleteTag(
  supabase: SupabaseClient, userId: string, tagId: string,
): Promise<{ ok: true } | Failure> {
  const owns = await checkTagOwnership(supabase, userId, tagId);
  if (!owns.ok) return owns;
  const { error } = await supabase.from('tags').delete().eq('id', tagId).eq('retailer_id', userId);
  if (error) { console.error('tag delete failed:', error); return fail500; }
  return { ok: true };
}
