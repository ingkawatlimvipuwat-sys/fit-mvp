'use client';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';

/**
 * A name box with a submit and a Cancel button, used instead of window.prompt
 * (New folder, Rename folder — inside NameDialog) and inline (tag rename).
 * text-base on the input: iPhones zoom the page into any input under 16px.
 */
export default function NameForm({ label, initial = '', maxLength, submitText, onSubmit, onCancel }: {
  label: string;
  initial?: string;
  maxLength: number;
  submitText: string;
  /** Resolve null on success (the parent closes the form) or the error text to show. */
  onSubmit: (name: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [lang] = useLanguage();
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  const trimmed = draft.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !trimmed) return;
    if (trimmed === initial.trim()) { onCancel(); return; }
    setBusy(true);
    setError(null);
    const err = await onSubmit(trimmed);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="block text-sm">
        <span className="text-gray-700">{label}</span>
        <input
          ref={input}
          value={draft}
          maxLength={maxLength}
          readOnly={busy}
          onChange={e => setDraft(e.target.value)}
          // stopPropagation: inside a dialog, Escape cancels this box only, not the whole dialog.
          onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); } }}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-base"
        />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || !trimmed}
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-60">
          {submitText}
        </button>
        <button type="button" onClick={onCancel} className="px-1 py-2 text-sm text-gray-600 underline">
          {t.cancel[lang]}
        </button>
      </div>
    </form>
  );
}
