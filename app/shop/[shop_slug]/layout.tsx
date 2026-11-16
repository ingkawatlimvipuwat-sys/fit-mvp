import { LanguageProvider } from '@/lib/hooks/useLanguage';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <div className="min-h-screen bg-page text-ink">{children}</div>
    </LanguageProvider>
  );
}
