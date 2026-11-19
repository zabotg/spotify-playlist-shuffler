import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const bricolage = Bricolage_Grotesque({ variable: '--font-bricolage', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'Spotify Playlist Shuffler', template: '%s · Playlist Shuffler' },
  description: 'Smarter shuffle modes, playlist insights and music discovery for Spotify.',
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-spotify px-4 py-2 text-sm font-semibold text-zinc-950 focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
