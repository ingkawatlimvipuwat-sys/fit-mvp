import type { Metadata } from 'next';
import { LanguageProvider } from '@/lib/hooks/useLanguage';

export const metadata: Metadata = {
  title: 'สมัครสมาชิก — Fit MVP',
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}
