// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import ColourDots from './ColourDots';

// RTL's auto-cleanup only registers when vitest globals are enabled, and they
// are not on this project. Without this, renders leak between tests.
afterEach(cleanup);

const many = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ hex: '#112233', name: `c${i}` }));

const mount = (n: number) =>
  render(<LanguageProvider><ColourDots colours={many(n)} /></LanguageProvider>);

describe('ColourDots', () => {
  it('renders nothing at all when there are no colours', () => {
    const { container } = mount(0);
    expect(container.firstChild).toBeNull();
  });

  it('renders one dot per colour up to six, with no overflow label', () => {
    const { container } = mount(6);
    expect(container.querySelectorAll('li')).toHaveLength(6);
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it('caps at six dots and shows +n for the rest', () => {
    const { container } = mount(9);
    expect(container.querySelectorAll('li')).toHaveLength(6);
    expect(screen.getByText('+3')).toBeTruthy();
  });
});
