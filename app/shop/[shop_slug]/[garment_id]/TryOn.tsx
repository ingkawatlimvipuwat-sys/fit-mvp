'use client';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';

const POLL_MS = 2000;
const POLL_LIMIT = 45;

export default function TryOn({ garmentId }: { garmentId: string }) {
  const [lang] = useLanguage();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const runId = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => { runId.current += 1; };
  }, []);

  useEffect(() => {
    runId.current += 1;
    setResultUrl(null);
    setError(null);
    setLoading(false);
  }, [garmentId]);

  useEffect(() => {
    if (resultUrl) resultRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [resultUrl]);

  function onFile(next: File | undefined) {
    if (!next || (!next.type.startsWith('image/') && next.type !== '')) {
      setError(t.tryOnNeedPhoto[lang]);
      return;
    }
    const url = URL.createObjectURL(next);
    runId.current += 1;
    setError(null);
    setResultUrl(null);
    setLoading(false);
    setFile(next);
    setPreviewUrl(prev => {
      if (prev && prev !== url) URL.revokeObjectURL(prev);
      return url;
    });
  }

  async function generate() {
    if (!file) {
      setError(t.tryOnNeedPhoto[lang]);
      return;
    }
    const run = ++runId.current;
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.set('garment_id', garmentId);
      form.set('photo', file);
      const started = await fetch('/api/try-on', { method: 'POST', body: form });
      const startBody = await started.json().catch(() => null);
      if (run !== runId.current) return;
      if (!started.ok) {
        setError(messageFor(startBody?.code, lang));
        return;
      }
      if (typeof startBody?.imageUrl === 'string') {
        setResultUrl(startBody.imageUrl);
        return;
      }
      if (typeof startBody?.historyId !== 'string') {
        setError(t.tryOnFailed[lang]);
        return;
      }
      for (let i = 0; i < POLL_LIMIT; i++) {
        await new Promise(resolve => setTimeout(resolve, POLL_MS));
        if (run !== runId.current) return;
        const polled = await fetch(`/api/try-on?id=${encodeURIComponent(startBody.historyId)}`);
        const pollBody = await polled.json().catch(() => null);
        if (run !== runId.current) return;
        if (pollBody?.code === 'unavailable' || polled.status === 503) {
          setError(t.tryOnUnavailable[lang]);
          return;
        }
        if (pollBody?.status === 'ready' && typeof pollBody.imageUrl === 'string') {
          setResultUrl(pollBody.imageUrl);
          return;
        }
        if (pollBody?.status === 'failed' || !polled.ok) {
          setError(t.tryOnFailed[lang]);
          return;
        }
      }
      setError(t.tryOnFailed[lang]);
    } catch {
      if (run === runId.current) setError(t.tryOnFailed[lang]);
    } finally {
      if (run === runId.current) setLoading(false);
    }
  }

  function reset() {
    runId.current += 1;
    setLoading(false);
    setResultUrl(null);
    setError(null);
    setFile(null);
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (galleryRef.current) galleryRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  }

  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-dashed border-field bg-surface p-4">
      <div>
        <h2 className="text-lg font-semibold">{t.tryOnTitle[lang]}</h2>
        <p className="mt-1 text-sm text-muted">{t.tryOnHint[lang]}</p>
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={t.tryOnUpload[lang]}
        onChange={e => onFile(e.target.files?.[0])}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label={t.tryOnCamera[lang]}
        onChange={e => onFile(e.target.files?.[0])}
      />

      {!resultUrl && (
        <>
          {previewUrl ? (
            <div className="relative overflow-hidden rounded-2xl bg-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={t.tryOnYourPhoto[lang]}
                className={`mx-auto max-h-80 w-full object-contain ${loading ? 'opacity-60' : ''}`}
              />
              {!loading && (
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  className="absolute bottom-3 right-3 min-h-[44px] rounded-[10px] border border-control bg-surface px-3 text-sm font-medium text-ink"
                >
                  {t.tryOnChangePhoto[lang]}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-page px-4 py-10 text-center">
              <PersonIcon />
              <div className="mt-4 grid w-full max-w-sm grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="min-h-[44px] rounded-[10px] border border-control bg-surface px-3 py-2 text-sm text-ink"
                >
                  {t.tryOnCamera[lang]}
                </button>
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  className="min-h-[44px] rounded-[10px] border border-control bg-surface px-3 py-2 text-sm text-ink"
                >
                  {t.tryOnUpload[lang]}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={!file || loading}
            onClick={generate}
            className="h-[52px] w-full rounded-xl bg-accent px-4 font-semibold text-white hover:bg-accent-dark disabled:opacity-60 sm:h-12"
          >
            {loading ? t.tryOnWorking[lang] : t.tryOnSubmit[lang]}
          </button>
        </>
      )}

      {resultUrl && (
        <div ref={resultRef} className="space-y-3">
          <p className="text-sm font-semibold text-ink">{t.tryOnResult[lang]}</p>
          <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultUrl}
              alt={t.tryOnPhotoAlt[lang]}
              className="h-full w-full object-cover object-top"
            />
          </div>
          {previewUrl && (
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-[10px] border border-line bg-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <span className="text-xs text-muted">{t.tryOnYourPhoto[lang]}</span>
            </div>
          )}
          <button
            type="button"
            onClick={reset}
            className="min-h-[44px] text-sm font-semibold text-accent underline"
          >
            {t.tryOnAgain[lang]}
          </button>
        </div>
      )}

      {error && <p className="text-sm font-medium text-verdict-tight-fg">{error}</p>}
    </section>
  );
}

function messageFor(code: string | undefined, lang: 'th' | 'en'): string {
  if (code === 'unavailable') return t.tryOnUnavailable[lang];
  if (code === 'too_large') return t.tryOnTooLarge[lang];
  return t.tryOnFailed[lang];
}

function PersonIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="h-12 w-12 text-field"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="24" cy="12" r="6" />
      <path d="M10 40c2.5-8 8-12 14-12s11.5 4 14 12" strokeLinecap="round" />
    </svg>
  );
}
