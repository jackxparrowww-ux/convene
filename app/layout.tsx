import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Convene — Meet face to face, from anywhere',
  description:
    'Convene is browser-based video conferencing with no downloads and no accounts for guests. Create a meeting, share the link, and talk.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-ink-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
