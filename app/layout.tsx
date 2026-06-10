import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fit MVP',
  description: 'หาขนาดที่ใช่สำหรับคุณ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
