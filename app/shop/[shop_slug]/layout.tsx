import { LanguageProvider } from '@/lib/hooks/useLanguage';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}
