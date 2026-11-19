import { ChartColumn, Compass, Lock, Shuffle, type LucideIcon } from 'lucide-react';
import { redirect } from 'next/navigation';
import { SpotifyIcon } from '@/components/spotify-icon';
import { Alert } from '@/components/ui/alert';
import { BrandMark } from '@/components/ui/brand-mark';
import { getLoginErrorMessage } from '@/lib/auth/login-errors';
import { getAuthenticatedSession } from '@/lib/auth/session';

interface HomePageProps {
  searchParams: Promise<{ error?: string }>;
}

const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Shuffle,
    title: 'Shuffle with a plan',
    description: 'Space out artists, smooth the tempo, shape an energy curve or mix by key.',
  },
  {
    icon: ChartColumn,
    title: 'See what is inside',
    description: 'Decades, top artists, genres and the overall mood of a playlist.',
  },
  {
    icon: Compass,
    title: 'Find songs that fit',
    description: 'Suggestions that sound like the playlist, with previews before you add them.',
  },
];

/** Energy per row for the decorative preview: a "Peak" curve that rises and falls. */
const PREVIEW_ENERGY = [0.32, 0.46, 0.6, 0.74, 0.9, 0.82, 0.64, 0.48, 0.36];

/** A stylized track list in "Energy curve" order. Purely decorative. */
function ShufflePreview() {
  return (
    <div aria-hidden className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-2xl shadow-black/40">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <Shuffle className="h-4 w-4 text-spotify" />
          Energy curve
        </div>
        <span className="rounded-full bg-spotify/15 px-2.5 py-1 text-xs font-medium text-spotify">Peak</span>
      </div>
      <ol className="flex flex-col gap-2.5">
        {PREVIEW_ENERGY.map((energy, index) => (
          <li key={index} className="flex items-center gap-3">
            <span className="w-4 text-right text-xs text-zinc-500 tabular-nums">{index + 1}</span>
            <span className="h-8 w-8 shrink-0 rounded bg-linear-to-br from-zinc-700 to-zinc-800" />
            <span className="flex flex-1 flex-col gap-1.5">
              <span className="h-2 rounded-full bg-zinc-700" style={{ width: `${60 + ((index * 17) % 30)}%` }} />
              <span className="h-2 rounded-full bg-zinc-800" style={{ width: `${35 + ((index * 23) % 25)}%` }} />
            </span>
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800">
              <span className="block h-full rounded-full bg-spotify" style={{ width: `${energy * 100}%` }} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function HomePage({ searchParams }: HomePageProps) {
  if (await getAuthenticatedSession()) redirect('/dashboard');

  const errorMessage = getLoginErrorMessage((await searchParams).error);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(60%_80%_at_15%_0%,rgba(29,185,84,0.12),transparent_70%)]"
      />

      <header className="relative mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
        <BrandMark />
      </header>

      <main
        id="main"
        className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16 lg:px-8"
      >
        <div className="flex max-w-xl flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              A smarter shuffle for your Spotify playlists.
            </h1>
            <p className="text-lg leading-relaxed text-zinc-300">
              Reorder a playlist by tempo, energy, mood or artist, see what it is made of, and find new songs that
              belong in it.
            </p>
          </div>

          {errorMessage && <Alert tone="error">{errorMessage}</Alert>}

          <div className="flex flex-col items-start gap-3">
            <a
              href="/api/auth/login"
              className="inline-flex min-h-14 items-center gap-3 rounded-full bg-spotify px-8 text-base font-semibold text-zinc-950 transition-colors duration-150 hover:bg-spotify-bright"
            >
              <SpotifyIcon size={22} />
              Continue with Spotify
            </a>
            <p className="flex items-center gap-2 text-sm text-zinc-400">
              <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" />
              Your tokens stay in an encrypted cookie. Nothing about your account is stored.
            </p>
          </div>

          <ul className="flex flex-col gap-5 border-t border-zinc-800 pt-8">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-spotify">
                  <Icon aria-hidden className="h-5 w-5" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-base font-semibold text-white">{title}</h2>
                  <p className="text-sm leading-relaxed text-zinc-400">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden lg:block">
          <ShufflePreview />
        </div>
      </main>
    </div>
  );
}
