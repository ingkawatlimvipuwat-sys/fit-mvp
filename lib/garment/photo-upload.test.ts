import { describe, it, expect } from 'vitest';
import { storageKeyFor, pathFromPublicUrl, STORAGE_PREFIX } from './photo-upload';

const USER = '11111111-2222-4333-8444-555555555555';

describe('storageKeyFor', () => {
  it('keeps the extension and prefixes with the owner id', () => {
    const key = storageKeyFor(USER, 'sweater.JPG');
    expect(key.startsWith(`${USER}/`)).toBe(true);
    expect(key.endsWith('.jpg')).toBe(true);
  });

  it('strips anything that could alter the object key', () => {
    for (const name of ['a.jp/g', 'a.jpg?x=1', 'a.jp g', 'a.../..']) {
      const key = storageKeyFor(USER, name);
      expect(key.slice(USER.length + 1)).not.toMatch(/[/?\s]/);
    }
  });

  it('falls back to jpg when there is no usable extension', () => {
    expect(storageKeyFor(USER, 'noextension').endsWith('.jpg')).toBe(true);
    expect(storageKeyFor(USER, 'weird.!!!').endsWith('.jpg')).toBe(true);
  });

  it('truncates a long extension to 10 characters', () => {
    const ext = storageKeyFor(USER, `a.${'x'.repeat(40)}`).split('.').pop()!;
    expect(ext).toHaveLength(10);
  });

  it('never collides for the same filename', () => {
    expect(storageKeyFor(USER, 'a.jpg')).not.toBe(storageKeyFor(USER, 'a.jpg'));
  });
});

describe('pathFromPublicUrl', () => {
  it('recovers the object path from a stored public URL', () => {
    const url = `https://x.supabase.co/storage/v1${STORAGE_PREFIX}${USER}/abc.jpg`;
    expect(pathFromPublicUrl(url)).toBe(`${USER}/abc.jpg`);
  });

  it('decodes percent-escapes', () => {
    const url = `https://x.supabase.co/storage/v1${STORAGE_PREFIX}${USER}/a%20b.jpg`;
    expect(pathFromPublicUrl(url)).toBe(`${USER}/a b.jpg`);
  });

  it('returns null for null, a foreign URL, and a malformed escape', () => {
    expect(pathFromPublicUrl(null)).toBeNull();
    expect(pathFromPublicUrl('https://example.test/other/a.jpg')).toBeNull();
    expect(pathFromPublicUrl(`https://x/storage/v1${STORAGE_PREFIX}%E0%A4%A`)).toBeNull();
  });
});
