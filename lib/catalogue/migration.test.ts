import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sql = readFileSync(join(process.cwd(), 'supabase/migrations/0005_catalogue.sql'), 'utf8')
  .replace(/--.*$/gm, '').toLowerCase();

describe('0005_catalogue.sql stays additive (spec §4)', () => {
  it('creates the five tables with row level security', () => {
    for (const t of ['folders', 'products', 'product_pickers', 'tags', 'product_tags']) {
      expect(sql).toContain(`create table public.${t} `);
      expect(sql).toContain(`alter table public.${t} enable row level security`);
    }
  });
  it('never drops, renames or tightens existing columns', () => {
    expect(sql).not.toMatch(/\bdrop\b/);
    expect(sql).not.toMatch(/rename/);
    expect(sql).not.toMatch(/set not null/);
  });
  it('adds product_id nullable and picks with a default', () => {
    expect(sql).toMatch(/add column product_id uuid references public\.products\(id\) on delete cascade,/);
    expect(sql).toMatch(/add column picks jsonb not null default '\{\}'/);
  });
  it('is one transaction, so a failure leaves nothing half-made', () => {
    expect(sql.trim().startsWith('begin;')).toBe(true);
    expect(sql.trim().endsWith('commit;')).toBe(true);
    expect(sql.split("begin;")).toHaveLength(2);
    expect(sql.split("commit;")).toHaveLength(2);
  });
  it('backfill survives blank and over-long garment names', () => {
    expect(sql).toContain("coalesce(nullif(left(btrim(g.name), 120), ''), 'untitled')");
  });
  it('does not claim to be safe to run twice', () => {
    const raw = readFileSync(join(process.cwd(), 'supabase/migrations/0005_catalogue.sql'), 'utf8').toLowerCase();
    expect(raw).not.toContain('safe to run twice');
  });
  it('gives anon no read policy', () => {
    expect(sql).not.toMatch(/to anon/);
  });
  it('backfills one product per unlinked garment, reusing the garment id', () => {
    expect(sql).toMatch(/insert into public\.products[\s\S]*from public\.garments g[\s\S]*where g\.product_id is null/);
    expect(sql).toMatch(/update public\.garments set product_id = id where product_id is null/);
  });
});

const raw6 = readFileSync(join(process.cwd(), 'supabase/migrations/0006_product_id_not_null.sql'), 'utf8');
const sql6 = raw6.replace(/--.*$/gm, '').toLowerCase();

describe('0006_product_id_not_null.sql (spec §4.2)', () => {
  it('is one transaction', () => {
    expect(sql6.trim().startsWith('begin;')).toBe(true);
    expect(sql6.trim().endsWith('commit;')).toBe(true);
    expect(sql6.split('begin;')).toHaveLength(2);
    expect(sql6.split('commit;')).toHaveLength(2);
  });
  it('repeats the 0005 backfill, name guard included', () => {
    expect(sql6).toMatch(/insert into public\.products[\s\S]*from public\.garments g[\s\S]*where g\.product_id is null/);
    expect(sql6).toContain("coalesce(nullif(left(btrim(g.name), 120), ''), 'untitled')");
    expect(sql6).toContain('on conflict (id) do nothing');
    expect(sql6).toMatch(/update public\.garments set product_id = id where product_id is null/);
  });
  it('backfills BEFORE it sets not null', () => {
    const backfill = sql6.indexOf('update public.garments set product_id = id');
    const tighten = sql6.indexOf('alter table public.garments alter column product_id set not null');
    expect(backfill).toBeGreaterThan(-1);
    expect(tighten).toBeGreaterThan(backfill);
  });
  it('only tightens product_id and drops nothing', () => {
    expect(sql6.match(/set not null/g)).toHaveLength(1);
    expect(sql6).not.toMatch(/\bdrop\b/);
    expect(sql6).not.toMatch(/rename/);
  });
  it('says run once', () => {
    expect(raw6.toLowerCase()).toContain('run once');
  });
});
