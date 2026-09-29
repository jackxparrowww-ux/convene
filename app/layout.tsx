import type { Metadata, Viewport } from 'next';
import './globals.css';
import PwaRegister from '@/components/PwaRegister';

export const viewport: Viewport = {
  themeColor: '#E5484D',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Convene — Ultra-Fast Video Meetings',
  description:
    'Ultra-fast instant video conferencing. Faster than Google Meet with zero downloads, 1-click meeting start, in-call recording, live captions, and device switching.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Convene',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="bg-ink-950 text-zinc-100 antialiased selection:bg-brand selection:text-white">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
