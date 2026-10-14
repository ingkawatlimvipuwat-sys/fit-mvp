/**
 * TEST HELPER ONLY — imported by *.test.ts files, never by app code.
 * An in-memory stand-in for the parts of the Supabase query builder the
 * catalogue lib uses: select / insert / update / delete, .eq / .in filters,
 * .order (ignored), .maybeSingle / .single, and awaiting the builder.
 * Every executed statement is recorded in `calls`, so tests can check order
 * and that every statement was scoped to the caller's shop.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type Row = Record<string, unknown>;
export type Op = 'select' | 'insert' | 'update' | 'delete';
export interface Call { table: string; op: Op; eq: Record<string, unknown>; values?: Row }
export interface FakeOptions {
  /** Make one table + operation return { error: { message: 'boom', code } }. */
  fail?: { table: string; op: Op; code?: string };
  /** Unique keys per table: an insert whose key matches an existing row fails with code 23505. */
  unique?: Record<string, (r: Row) => string>;
}

export function fakeSupabase(tables: Record<string, Row[]>, opts: FakeOptions = {}) {
  const calls: Call[] = [];
  let seq = 0;
  const client = {
    from(table: string) {
      let op: Op = 'select';
      let values: Row | undefined;
      const eq: Record<string, unknown> = {};
      const ins: [string, unknown[]][] = [];
      const matches = (r: Row) =>
        Object.entries(eq).every(([c, v]) => r[c] === v) && ins.every(([c, vs]) => vs.includes(r[c]));
      function run(single: boolean) {
        calls.push({ table, op, eq: { ...eq }, values });
        if (opts.fail && opts.fail.table === table && opts.fail.op === op) {
          return { data: null, error: { message: 'boom', code: opts.fail.code } };
        }
        const rows = tables[table] ?? (tables[table] = []);
        if (op === 'insert') {
          const row: Row = { id: `${table}-${++seq}`, ...values };
          const key = opts.unique?.[table];
          if (key && rows.some(r => key(r) === key(row))) {
            return { data: null, error: { message: 'duplicate key', code: '23505' } };
          }
          rows.push(row);
          return { data: single ? row : [row], error: null };
        }
        if (op === 'update') {
          for (const r of rows) if (matches(r)) Object.assign(r, values);
          return { data: null, error: null };
        }
        if (op === 'delete') {
          tables[table] = rows.filter(r => !matches(r));
          return { data: null, error: null };
        }
        const found = rows.filter(matches);
        return { data: single ? found[0] ?? null : found, error: null };
      }
      const b: Record<string, unknown> = {
        select: () => b,
        insert: (v: Row) => { op = 'insert'; values = v; return b; },
        update: (v: Row) => { op = 'update'; values = v; return b; },
        delete: () => { op = 'delete'; return b; },
        eq: (c: string, v: unknown) => { eq[c] = v; return b; },
        in: (c: string, vs: unknown[]) => { ins.push([c, vs]); return b; },
        order: () => b,
        maybeSingle: async () => run(true),
        single: async () => run(true),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve(run(false)).then(res, rej),
      };
      return b;
    },
  } as unknown as SupabaseClient;
  return { client, calls, tables };
}
