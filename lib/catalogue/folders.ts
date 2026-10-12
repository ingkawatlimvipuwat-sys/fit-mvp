/** A folder as the dashboard and the folder API see it (spec §4.1). */
export interface FolderRow { id: string; name: string; parent_id: string | null }
export interface FolderLine extends FolderRow { depth: number }

const byName = (a: FolderRow, b: FolderRow) =>
  a.name.localeCompare(b.name, ['th', 'en'], { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id);

/**
 * Every folder exactly once, in display order: depth-first, siblings A–Z.
 * A folder whose parent is missing, or that sits in a cycle (rule 5 prevents
 * one, but two simultaneous moves could still make one), is shown at the top
 * level so it can never vanish from the list.
 */
export function folderLines(folders: FolderRow[]): FolderLine[] {
  const ids = new Set(folders.map(f => f.id));
  const kids = new Map<string | null, FolderRow[]>();
  for (const f of folders) {
    const key = f.parent_id !== null && ids.has(f.parent_id) ? f.parent_id : null;
    const list = kids.get(key);
    if (list) list.push(f); else kids.set(key, [f]);
  }
  for (const list of kids.values()) list.sort(byName);

  const out: FolderLine[] = [];
  const seen = new Set<string>();
  const walk = (f: FolderRow, depth: number) => {
    if (seen.has(f.id)) return;
    seen.add(f.id);
    out.push({ ...f, depth });
    for (const c of kids.get(f.id) ?? []) walk(c, depth + 1);
  };
  for (const f of kids.get(null) ?? []) walk(f, 0);
  for (const f of [...folders].sort(byName)) walk(f, 0); // rescue folders caught in a cycle
  return out;
}

/** Direct children of a folder (null = the top level), A–Z. */
export function childFolders(folders: FolderRow[], parentId: string | null): FolderLine[] {
  const lines = folderLines(folders);
  if (parentId === null) return lines.filter(l => l.depth === 0);
  const parent = lines.find(l => l.id === parentId);
  return parent ? lines.filter(l => l.parent_id === parentId && l.depth === parent.depth + 1) : [];
}

/** The folder and every folder below it. Empty for an unknown id. Cycle-safe. */
export function subtreeIds(folders: FolderRow[], rootId: string): Set<string> {
  const out = new Set<string>();
  if (!folders.some(f => f.id === rootId)) return out;
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (out.has(id)) continue;
    out.add(id);
    for (const f of folders) if (f.parent_id === id) stack.push(f.id);
  }
  return out;
}

/** Rule 5: would putting `folderId` under `newParentId` put it inside itself? Top level (null) never does. */
export function wouldCreateCycle(folders: FolderRow[], folderId: string, newParentId: string | null): boolean {
  if (newParentId === null) return false;
  return subtreeIds(folders, folderId).has(newParentId) || newParentId === folderId;
}

/** The folders above `id`, top level first, `id` itself excluded. Cycle-safe. */
export function ancestors(folders: FolderRow[], id: string): FolderRow[] {
  const byId = new Map(folders.map(f => [f.id, f]));
  const out: FolderRow[] = [];
  const seen = new Set<string>([id]);
  let cur = byId.get(id)?.parent_id ?? null;
  while (cur !== null && !seen.has(cur)) {
    const f = byId.get(cur);
    if (!f) break;
    out.unshift(f);
    seen.add(cur);
    cur = f.parent_id;
  }
  return out;
}

export interface MoveTarget {
  /** null = Top level. */
  id: string | null;
  name: string | null;
  depth: number;
  disabled: boolean;
  /** Where the thing being moved is now. */
  current: boolean;
}

/**
 * Rows for the "Move to…" chooser: Top level first, then every folder in
 * display order. Moving a folder disables it and everything below it
 * (rule 5). The current place is marked and disabled (moving there does nothing).
 */
export function moveTargets(
  folders: FolderRow[],
  moving: { kind: 'folder'; id: string } | { kind: 'product'; folderId: string | null },
): MoveTarget[] {
  const blocked = moving.kind === 'folder' ? subtreeIds(folders, moving.id) : new Set<string>();
  const currentId = moving.kind === 'folder'
    ? folders.find(f => f.id === moving.id)?.parent_id ?? null
    : moving.folderId;
  const rows: MoveTarget[] = [
    { id: null, name: null, depth: 0, disabled: currentId === null, current: currentId === null },
  ];
  for (const f of folderLines(folders)) {
    const current = f.id === currentId;
    rows.push({ id: f.id, name: f.name, depth: f.depth + 1, disabled: current || blocked.has(f.id), current });
  }
  return rows;
}
