import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sql = readFileSync(join(process.cwd(), 'supabase/migrations/0007_fit_sessions_created_at_idx.sql'), 'utf8')
  .replace(/--.*$/gm, '').toLowerCase();

describe('0007_fit_sessions_created_at_idx.sql is one index and nothing else', () => {
  it('creates the index idempotently', () => {
    expect(sql).toContain('create index if not exists fit_sessions_created_at_idx');
  });
  it('changes no table, column, row or policy', () => {
    for (const word of ['drop ', 'alter ', 'delete ', 'update ', 'insert ', 'truncate', 'create table', 'policy']) {
      expect(sql).not.toContain(word);
    }
  });
  it('is one transaction', () => {
    expect(sql.trim().startsWith('begin;')).toBe(true);
    expect(sql.trim().endsWith('commit;')).toBe(true);
  });
});
