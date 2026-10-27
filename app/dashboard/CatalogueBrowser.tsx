'use client';
import { useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { dropVerdict, moveTargets, type DragItem, type DropVerdict, type FolderRow } from '@/lib/catalogue/folders';
import { useFinePointer } from '@/lib/hooks/useFinePointer';
import { parseView, viewToQuery, productsInView, isFiltered, type DashboardView } from '@/lib/catalogue/browse';
import type { TagRow, TagUsage } from '@/lib/catalogue/tags';
import { sendJson } from '@/lib/catalogue/send-json';
import type { ProductSummary } from '@/lib/catalogue/summary';
import ActionsMenu from './ActionsMenu';
import CatalogueToolbar from './CatalogueToolbar';
import FolderSidebar from './FolderSidebar';
import FolderMobileNav from './FolderMobileNav';
import ManageTagsDialog from './ManageTagsDialog';
import MoveToDialog from './MoveToDialog';
import NameDialog from './NameDialog';
import ProductGrid from './ProductGrid';

type Moving = { kind: 'folder'; folder: FolderRow } | { kind: 'product'; product: ProductSummary };

export default function CatalogueBrowser({ products, folders, tags, allTags, shopSlug }: {
  products: ProductSummary[]; folders: FolderRow[];
  /** Tags on at least one product (the filter). */
  tags: TagRow[];
  /** Every tag of the shop with its product count (Manage tags). */
  allTags: TagUsage[];
  shopSlug: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [lang] = useLanguage();
  const view = parseView(params, folders, tags.map(x => x.id));
  const [moving, setMoving] = useState<Moving | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [managingTags, setManagingTags] = useState(false);
  const [naming, setNaming] = useState<{ kind: 'new' } | { kind: 'rename'; folder: FolderRow } | null>(null);
  const finePointer = useFinePointer();
  const [dragging, setDragging] = useState<DragItem | null>(null);
  const [hoverId, setHoverId] = useState<string | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const dropped = useRef(false);
  const hoverVerdict: DropVerdict | null =
    dragging && hoverId !== undefined ? dropVerdict(folders, dragging, hoverId) : null;
  const lastVerdict = useRef<DropVerdict | null>(null);
  lastVerdict.current = hoverVerdict;
  const canDrag = finePointer && !busy;

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
    setNotice(null);
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
  /** One move, for drag-and-drop and Move to…; the server re-checks every rule (rule 5, shop ownership). */
  async function relocate(item: DragItem, targetId: string | null) {
    const ok = item.kind === 'folder'
      ? await run(`/api/folders/${item.id}`, 'PATCH', { parent_id: targetId })
      : await run(`/api/products/${item.id}`, 'PATCH', { folder_id: targetId });
    if (!ok) return;
    const target = targetId === null ? t.topLevel[lang] : folders.find(f => f.id === targetId)?.name ?? t.topLevel[lang];
    setNotice(t.movedTo[lang].replace('{name}', item.name).replace('{target}', target));
  }
  async function moveTo(targetId: string | null) {
    const m = moving;
    if (!m) return;
    setMoving(null);
    await relocate(
      m.kind === 'folder'
        ? { kind: 'folder', id: m.folder.id, name: m.folder.name }
        : { kind: 'product', id: m.product.id, name: m.product.name, folderId: m.product.folder_id },
      targetId,
    );
  }

  function startDrag(item: DragItem) {
    dropped.current = false;
    setMessage(null);
    setNotice(null);
    setDragging(item);
  }
  function endDrag() {
    // Released over a refused row: keep the reason on screen (spec §7: refuse with a plain message).
    if (!dropped.current && lastVerdict.current === 'cycle') setMessage(t.folderCycle[lang]);
    setDragging(null);
    setHoverId(undefined);
  }
  async function dropOn(targetId: string | null) {
    const item = dragging;
    dropped.current = true;
    setDragging(null);
    setHoverId(undefined);
    if (item && dropVerdict(folders, item, targetId) === 'ok') await relocate(item, targetId);
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
    <div className="space-y-4" onDragOver={dragging ? () => setHoverId(undefined) : undefined}>
      <div className="flex items-start gap-2">
        <div className="grow">
          {/* Filter changes replace the history entry, so Back does not step through every keystroke. */}
          <CatalogueToolbar
            view={view}
            tags={tags}
            onChange={v => go(v, 'replace')}
            onManageTags={allTags.length > 0 ? () => setManagingTags(true) : undefined}
          />
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
      {notice && <p role="status" className="text-sm text-gray-700">{notice}</p>}
      <FolderMobileNav {...folderProps} />
      <div className="flex gap-6">
        <FolderSidebar
          {...folderProps}
          dragging={dragging}
          hoverId={hoverId}
          onHoverTarget={setHoverId}
          onDropOn={dropOn}
          onDragStartFolder={canDrag ? startDrag : undefined}
          onDragEnd={endDrag}
        />
        <div className="min-w-0 grow">
          <ProductGrid
            products={shown}
            shopSlug={shopSlug}
            emptyText={products.length === 0 ? t.noGarments[lang] : isFiltered(view) ? t.noMatches[lang] : t.emptyFolder[lang]}
            onMove={p => setMoving({ kind: 'product', product: p })}
            draggable={canDrag}
            draggingId={dragging?.kind === 'product' ? dragging.id : null}
            onDragStart={startDrag}
            onDragEnd={endDrag}
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
      {managingTags && (
        <ManageTagsDialog
          tags={allTags}
          onClose={() => setManagingTags(false)}
          onRename={(tag, name) => request(`/api/tags/${tag.id}`, 'PATCH', { name })}
          onDelete={async tag => {
            const err = await request(`/api/tags/${tag.id}`, 'DELETE');
            if (err === null && view.tagIds.includes(tag.id)) {
              go({ ...view, tagIds: view.tagIds.filter(id => id !== tag.id) }, 'replace');
            }
            return err;
          }}
        />
      )}
      {dragging && (
        <div
          role="status"
          className={`pointer-events-none fixed inset-x-0 bottom-4 z-30 mx-auto w-fit max-w-[90vw] rounded px-3 py-2 text-sm text-white shadow-lg ${
            hoverVerdict === 'cycle' ? 'bg-red-600' : 'bg-gray-900/90'}`}
        >
          {hoverVerdict === 'cycle' ? t.folderCycle[lang] : hoverVerdict === 'here' ? t.dropAlreadyHere[lang] : t.dragHint[lang]}
        </div>
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
