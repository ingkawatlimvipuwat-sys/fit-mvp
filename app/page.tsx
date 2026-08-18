import Link from 'next/link';
import { t } from '@/lib/i18n/strings';

const STEPS = [
  { th: t.howStep1.th, en: t.howStep1.en },
  { th: t.howStep2.th, en: t.howStep2.en },
  { th: t.howStep3.th, en: t.howStep3.en },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <h1 className="text-3xl font-semibold">{t.appName.th}</h1>
      <p className="mt-3 text-gray-600">{t.tagline.th}</p>
      <p className="mt-1 text-sm text-gray-400">{t.tagline.en}</p>

      <div className="mt-8 flex gap-4">
        <Link href="/login" className="rounded bg-gray-900 px-4 py-2 text-center text-white">
          {t.login.th}
          <span className="block text-xs font-normal text-gray-300">{t.login.en}</span>
        </Link>
        <Link href="/signup" className="rounded border border-gray-300 px-4 py-2 text-center text-gray-900">
          {t.signup.th}
          <span className="block text-xs font-normal text-gray-400">{t.signup.en}</span>
        </Link>
      </div>

      {/* A customer who trims the shop URL down to the domain root lands here.
          The landing page speaks only to retailers, so point them back at the
          link their shop sent them rather than leaving them with nothing. */}
      <p className="mt-6 text-sm text-gray-500">{t.customerHint.th}</p>
      <p className="mt-0.5 text-xs text-gray-400">{t.customerHint.en}</p>

      <div className="mt-16">
        <h2 className="text-sm font-medium text-gray-500">{t.howItWorks.th}</h2>
        <ol className="mt-4 space-y-4">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs text-white">
                {i + 1}
              </span>
              <div>
                <p className="text-gray-800">{step.th}</p>
                <p className="text-xs text-gray-400">{step.en}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
