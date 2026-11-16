import LinkButton from '@/app/components/ui/LinkButton';
import PageShell from '@/app/components/ui/PageShell';
import { t } from '@/lib/i18n/strings';

/**
 * Nearest boundary for a garment id that does not resolve under a shop that
 * does — a deleted item's old link. The shop itself is fine here, so the
 * wording points at the item, not the link.
 */
export default function GarmentNotFound() {
  return (
    <PageShell>
      <h1 className="text-3xl font-semibold leading-tight">{t.notFoundGarmentTitle.th}</h1>
      <p className="mt-1 text-sm text-muted">{t.notFoundGarmentTitle.en}</p>

      <p className="mt-3 text-muted">{t.notFoundGarmentBody.th}</p>
      <p className="mt-1 text-sm text-muted">{t.notFoundGarmentBody.en}</p>

      <div className="mt-8">
        <LinkButton href="/">
          {t.backToHome.th}
        </LinkButton>
      </div>
    </PageShell>
  );
}
