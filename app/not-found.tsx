import LinkButton from '@/app/components/ui/LinkButton';
import PageShell from '@/app/components/ui/PageShell';
import { t } from '@/lib/i18n/strings';

export default function NotFound() {
  return (
    <PageShell>
      <h1 className="text-3xl font-semibold leading-tight">{t.notFoundTitle.th}</h1>
      <p className="mt-1 text-sm text-muted">{t.notFoundTitle.en}</p>

      <p className="mt-3 text-muted">{t.notFoundBody.th}</p>
      <p className="mt-1 text-sm text-muted">{t.notFoundBody.en}</p>

      <div className="mt-8">
        <LinkButton href="/">
          {t.backToHome.th}
        </LinkButton>
      </div>
    </PageShell>
  );
}
