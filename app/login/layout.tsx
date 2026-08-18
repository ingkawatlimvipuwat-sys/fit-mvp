import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ — Fit MVP',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
