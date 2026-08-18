import type { Metadata } from 'next';
import { LanguageProvider } from '@/lib/hooks/useLanguage';

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ — Fit MVP',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}
