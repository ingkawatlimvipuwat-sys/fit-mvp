import type { Metadata } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import './globals.css';

const plex = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-plex',
});

export const metadata: Metadata = {
  title: 'Fit MVP — หาขนาดที่ใช่',
  description: 'หาขนาดที่ใช่สำหรับคุณ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={plex.variable}>
      <body className="min-h-screen bg-page text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
