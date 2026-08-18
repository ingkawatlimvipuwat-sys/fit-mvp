import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'สมัครสมาชิก — Fit MVP',
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
