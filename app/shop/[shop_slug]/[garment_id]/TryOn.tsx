'use client';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';

/** Stub result until a real VTO model is wired. Served from public/. */
export const TRYON_RESULT_SRC = '/try-on/result.png';
export const TRYON_FAKE_DELAY_MS = 900;

export default function TryOn() {
  const [lang] = useLanguage();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
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
    if (resultUrl) resultRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [resultUrl]);

  function onFile(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) {
      setError(t.tryOnNeedPhoto[lang]);
      return;
    }
    setError(null);
    setResultUrl(null);
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  async function generate() {
    if (!previewUrl) {
      setError(t.tryOnNeedPhoto[lang]);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, TRYON_FAKE_DELAY_MS));
      setResultUrl(TRYON_RESULT_SRC);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResultUrl(null);
    setError(null);
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (galleryRef.current) galleryRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  }

  return (
    <section className="mt-6 space-y-4 rounded border bg-white p-4">
      <div>
        <h2 className="text-lg font-medium">{t.tryOnTitle[lang]}</h2>
        <p className="mt-1 text-sm text-gray-500">{t.tryOnHint[lang]}</p>
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
            <div className="relative overflow-hidden rounded bg-gray-100">
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
                  className="absolute bottom-3 right-3 rounded bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-800 shadow-sm"
                >
                  {t.tryOnChangePhoto[lang]}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center">
              <PersonIcon />
              <div className="mt-4 grid w-full max-w-sm grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
                >
                  {t.tryOnCamera[lang]}
                </button>
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
                >
                  {t.tryOnUpload[lang]}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={!previewUrl || loading}
            onClick={generate}
            className="w-full rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
          >
            {loading ? t.tryOnWorking[lang] : t.tryOnSubmit[lang]}
          </button>
        </>
      )}

      {resultUrl && (
        <div ref={resultRef} className="space-y-3">
          <p className="text-sm font-medium text-gray-800">{t.tryOnResult[lang]}</p>
          <div className="aspect-[3/4] overflow-hidden rounded bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultUrl}
              alt={t.tryOnPhotoAlt[lang]}
              className="h-full w-full object-cover object-top"
            />
          </div>
          {previewUrl && (
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded border bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <span className="text-xs text-gray-500">{t.tryOnYourPhoto[lang]}</span>
            </div>
          )}
          <button
            type="button"
            onClick={reset}
            className="text-sm font-medium text-gray-700 underline"
          >
            {t.tryOnAgain[lang]}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}

function PersonIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="h-12 w-12 text-gray-400"
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
