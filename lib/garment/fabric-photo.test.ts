import { describe, it, expect } from 'vitest';
import { fabricPhotoPlan } from './fabric-photo';

const OLD = 'https://x/object/public/garment-photos/u/old.jpg';
const NEW = 'https://x/object/public/garment-photos/u/new.jpg';

describe('fabricPhotoPlan', () => {
  it('keeps the existing photo when nothing was asked', () => {
    expect(fabricPhotoPlan({ newUploadUrl: null, removeRequested: false, existingUrl: OLD }))
      .toEqual({ nextUrl: OLD, deleteExisting: false });
  });
  it('replaces with a new upload (the old one is cleaned up by the replacement rules, not here)', () => {
    expect(fabricPhotoPlan({ newUploadUrl: NEW, removeRequested: false, existingUrl: OLD }))
      .toEqual({ nextUrl: NEW, deleteExisting: false });
  });
  it('removes the existing photo when asked', () => {
    expect(fabricPhotoPlan({ newUploadUrl: null, removeRequested: true, existingUrl: OLD }))
      .toEqual({ nextUrl: null, deleteExisting: true });
  });
  it('a new file wins over the remove tick', () => {
    expect(fabricPhotoPlan({ newUploadUrl: NEW, removeRequested: true, existingUrl: OLD }))
      .toEqual({ nextUrl: NEW, deleteExisting: false });
  });
  it('removing when there is no photo is a no-op', () => {
    expect(fabricPhotoPlan({ newUploadUrl: null, removeRequested: true, existingUrl: null }))
      .toEqual({ nextUrl: null, deleteExisting: false });
  });
});
