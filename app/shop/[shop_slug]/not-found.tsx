import LinkButton from '@/app/components/ui/LinkButton';
import PageShell from '@/app/components/ui/PageShell';
import { t } from '@/lib/i18n/strings';

/**
 * The boundary for a bad shop slug — LINE truncates URLs and customers retype
 * them, so this is a routine path. A bad garment id under a VALID shop hits
 * the deeper [garment_id]/not-found.tsx instead, which is why this one talks
 * about the shop link rather than a missing item.
 */
export default function ShopNotFound() {
  return (
    <PageShell>
      <h1 className="text-3xl font-semibold leading-tight">{t.notFoundShopTitle.th}</h1>
      <p className="mt-1 text-sm text-muted">{t.notFoundShopTitle.en}</p>

      <p className="mt-3 text-muted">{t.notFoundShopBody.th}</p>
      <p className="mt-1 text-sm text-muted">{t.notFoundShopBody.en}</p>

      <div className="mt-8">
        <LinkButton href="/">
          {t.backToHome.th}
        </LinkButton>
      </div>
    </PageShell>
  );
}
