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
  it('gives anon no read policy', () => {
    expect(sql).not.toMatch(/to anon/);
  });
  it('backfills one product per unlinked garment, reusing the garment id', () => {
    expect(sql).toMatch(/insert into public\.products[\s\S]*from public\.garments g[\s\S]*where g\.product_id is null/);
    expect(sql).toMatch(/update public\.garments set product_id = id where product_id is null/);
  });
});
