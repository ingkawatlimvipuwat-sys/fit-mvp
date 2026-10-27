'use client';
import { useState } from 'react';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import type { TagUsage } from '@/lib/catalogue/tags';
import ModalSheet from './ModalSheet';
import NameForm from './NameForm';

/**
 * Manage tags: every tag of the shop (including ones on no product) with its
 * product count, and Rename / Delete for each. Side effects come in as props
 * (resolve null on success or the error text), so the panel is easy to test.
 */
export default function ManageTagsDialog({ tags, onRename, onDelete, onClose }: {
  tags: TagUsage[];
  onRename: (tag: TagUsage, name: string) => Promise<string | null>;
  onDelete: (tag: TagUsage) => Promise<string | null>;
  onClose: () => void;
}) {
  const [lang] = useLanguage();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove(tag: TagUsage) {
    if (!window.confirm(t.confirmDeleteTag[lang].replace('{name}', tag.name).replace('{n}', String(tag.count)))) return;
    setBusy(true);
    setError(null);
    const err = await onDelete(tag);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <ModalSheet title={t.manageTags[lang]} onClose={onClose} align="top">
      {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
      {tags.length === 0 ? (
        <p className="text-sm text-gray-600">{t.noTagsYet[lang]}</p>
      ) : (
        <ul className="divide-y">
          {tags.map(tag => (
            <li key={tag.id} className="py-2">
              {renaming === tag.id ? (
                <NameForm
                  label={t.tagNameLabel[lang]}
                  initial={tag.name}
                  maxLength={30}
                  submitText={t.save[lang]}
                  onSubmit={async name => {
                    const err = await onRename(tag, name);
                    if (err === null) setRenaming(null);
                    return err;
                  }}
                  onCancel={() => setRenaming(null)}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 grow">
                    <div className="break-all text-sm">{tag.name}</div>
                    <div className="text-xs text-gray-500">
                      {tag.count > 0 ? t.tagUsedOn[lang].replace('{n}', String(tag.count)) : t.tagUnused[lang]}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={t.renameTagNamed[lang].replace('{name}', tag.name)}
                    className="px-2 py-2 text-sm text-blue-700 underline"
                    disabled={busy}
                    onClick={() => { setError(null); setRenaming(tag.id); }}
                  >
                    {t.renameTag[lang]}
                  </button>
                  <button
                    type="button"
                    aria-label={t.deleteTagNamed[lang].replace('{name}', tag.name)}
                    className="px-2 py-2 text-sm text-red-600"
                    disabled={busy}
                    onClick={() => remove(tag)}
                  >
                    {t.delete[lang]}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onClose} className="mt-3 text-sm text-gray-600 underline">
        {t.close[lang]}
      </button>
    </ModalSheet>
  );
}
