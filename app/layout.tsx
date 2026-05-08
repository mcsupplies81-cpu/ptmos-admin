import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PT-OS Admin',
  description: 'PT-OS administrative dashboard',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-text antialiased">{children}</body>
    </html>
  );
}
