'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { moveTargets, type FolderRow } from '@/lib/catalogue/folders';
import { parseView, viewToQuery, productsInView, isFiltered, type DashboardView } from '@/lib/catalogue/browse';
import type { TagRow } from '@/lib/catalogue/tags';
import { sendJson } from '@/lib/catalogue/send-json';
import type { ProductSummary } from '@/lib/catalogue/summary';
import ActionsMenu from './ActionsMenu';
import CatalogueToolbar from './CatalogueToolbar';
import FolderSidebar from './FolderSidebar';
import FolderMobileNav from './FolderMobileNav';
import MoveToDialog from './MoveToDialog';
import NameDialog from './NameDialog';
import ProductGrid from './ProductGrid';

type Moving = { kind: 'folder'; folder: FolderRow } | { kind: 'product'; product: ProductSummary };

export default function CatalogueBrowser({ products, folders, tags, shopSlug }: {
  products: ProductSummary[]; folders: FolderRow[]; tags: TagRow[]; shopSlug: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [lang] = useLanguage();
  const view = parseView(params, folders, tags.map(x => x.id));
  const [moving, setMoving] = useState<Moving | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [naming, setNaming] = useState<{ kind: 'new' } | { kind: 'rename'; folder: FolderRow } | null>(null);

  /**
   * The address bar holds the view, so Back and refresh keep the owner's place.
   * Next 15 keeps useSearchParams in step with window.history, so this does
   * not reload the page or re-query the database.
   */
  function go(next: DashboardView, mode: 'push' | 'replace' = 'push') {
    const qs = viewToQuery(next);
    const url = qs ? `?${qs}` : window.location.pathname;
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
  }

  /** One write; resolves null on success or the error text. Always refreshes (a 404 usually means the list is stale). */
  async function request(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<string | null> {
    setBusy(true);
    const r = await sendJson(url, method, body);
    setBusy(false);
    router.refresh();
    return r.ok ? null : r.error ?? t.saveFailed[lang];
  }
  async function run(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<boolean> {
    setMessage(null);
    const err = await request(url, method, body);
    setMessage(err);
    return err === null;
  }

  function newFolder() { setNaming({ kind: 'new' }); }
  function renameFolder(f: FolderRow) { setNaming({ kind: 'rename', folder: f }); }
  async function deleteFolder(f: FolderRow) {
    const target = folders.find(x => x.id === f.parent_id)?.name ?? t.topLevel[lang];
    const text = t.confirmDeleteFolder[lang].replace('{name}', f.name).replace('{target}', target);
    if (!window.confirm(text)) return;
    const ok = await run(`/api/folders/${f.id}`, 'DELETE');
    if (ok && view.folderId === f.id) go({ ...view, folderId: f.parent_id }, 'replace');
  }
  async function moveTo(targetId: string | null) {
    const m = moving;
    if (!m) return;
    setMoving(null);
    if (m.kind === 'folder') await run(`/api/folders/${m.folder.id}`, 'PATCH', { parent_id: targetId });
    else await run(`/api/products/${m.product.id}`, 'PATCH', { folder_id: targetId });
  }

  const shown = productsInView(products, folders, view);
  const folderProps = {
    folders,
    currentId: view.folderId,
    onOpen: (id: string | null) => go({ ...view, folderId: id }),
    onRename: renameFolder,
    onMove: (f: FolderRow) => setMoving({ kind: 'folder', folder: f }),
    onDelete: deleteFolder,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <div className="grow">
          {/* Filter changes replace the history entry, so Back does not step through every keystroke. */}
          <CatalogueToolbar view={view} tags={tags} onChange={v => go(v, 'replace')} />
        </div>
        <ActionsMenu
          trigger={t.newMenu[lang]}
          ariaLabel={t.newMenu[lang]}
          triggerClassName="rounded bg-gray-900 px-4 py-2 text-sm text-white"
          disabled={busy}
          items={[
            { text: t.newFolder[lang], onSelect: newFolder },
            { text: t.newProduct[lang], href: `/dashboard/product/new${view.folderId ? `?folder=${view.folderId}` : ''}` },
          ]}
        />
      </div>
      {message && <p role="alert" className="text-sm text-red-600">{message}</p>}
      <FolderMobileNav {...folderProps} />
      <div className="flex gap-6">
        <FolderSidebar {...folderProps} />
        <div className="min-w-0 grow">
          <ProductGrid
            products={shown}
            shopSlug={shopSlug}
            emptyText={products.length === 0 ? t.noGarments[lang] : isFiltered(view) ? t.noMatches[lang] : t.emptyFolder[lang]}
            onMove={p => setMoving({ kind: 'product', product: p })}
          />
        </div>
      </div>
      {moving && (
        <MoveToDialog
          title={moving.kind === 'folder' ? moving.folder.name : moving.product.name}
          targets={moveTargets(folders, moving.kind === 'folder'
            ? { kind: 'folder', id: moving.folder.id }
            : { kind: 'product', folderId: moving.product.folder_id })}
          busy={busy}
          onChoose={moveTo}
          onClose={() => setMoving(null)}
        />
      )}
      {naming && (
        <NameDialog
          title={naming.kind === 'new' ? t.newFolder[lang] : t.renameFolderTitle[lang]}
          label={t.folderNamePrompt[lang]}
          initial={naming.kind === 'rename' ? naming.folder.name : ''}
          maxLength={60}
          submitText={naming.kind === 'new' ? t.create[lang] : t.save[lang]}
          onCancel={() => setNaming(null)}
          onSubmit={async name => {
            const err = naming.kind === 'new'
              ? await request('/api/folders', 'POST', { name, parent_id: view.folderId })
              : await request(`/api/folders/${naming.folder.id}`, 'PATCH', { name });
            if (err === null) setNaming(null);
            return err;
          }}
        />
      )}
    </div>
  );
}
