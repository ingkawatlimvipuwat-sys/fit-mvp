import { t } from '@/lib/i18n/strings';
import LinkButton from '@/app/components/ui/LinkButton';
import PageShell from '@/app/components/ui/PageShell';

const STEPS = [
  { th: t.howStep1.th, en: t.howStep1.en },
  { th: t.howStep2.th, en: t.howStep2.en },
  { th: t.howStep3.th, en: t.howStep3.en },
];

export default function HomePage() {
  return (
    <PageShell>
      <h1 className="text-3xl font-semibold leading-tight">{t.appName.th}</h1>
      <p className="mt-3 text-muted">{t.tagline.th}</p>
      <p className="mt-1 text-sm text-muted">{t.tagline.en}</p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <LinkButton href="/login" className="flex-col">
          {t.login.th}
          <span className="block text-xs font-normal text-white/80">{t.login.en}</span>
        </LinkButton>
        <LinkButton href="/signup" variant="secondary" className="flex-col">
          {t.signup.th}
          <span className="block text-xs font-normal text-muted">{t.signup.en}</span>
        </LinkButton>
      </div>

      {/* A customer who trims the shop URL down to the domain root lands here.
          The landing page speaks only to retailers, so point them back at the
          link their shop sent them rather than leaving them with nothing. */}
      <p className="mt-6 text-sm text-muted">{t.customerHint.th}</p>
      <p className="mt-0.5 text-xs text-muted">{t.customerHint.en}</p>

      <div className="mt-16">
        <h2 className="text-sm font-semibold text-muted">{t.howItWorks.th}</h2>
        <ol className="mt-4 space-y-4">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs text-white">
                {i + 1}
              </span>
              <div>
                <p className="text-ink">{step.th}</p>
                <p className="text-xs text-muted">{step.en}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </PageShell>
  );
}
