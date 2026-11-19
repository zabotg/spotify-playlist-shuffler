'use client';

import { ExternalLink, Loader2, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { CoverImage } from '@/components/ui/cover-image';
import { tracksApi } from '@/lib/api/tracks-api';
import { formatCamelot, toCamelot } from '@/lib/domain/engines/camelot';
import { releaseYear, type EnrichedTrack } from '@/lib/domain/models/playlist';
import { useAsyncAction } from '@/lib/hooks/use-async-action';
import { formatDecibels, formatMusicalKey, formatPercent, formatTrackLength } from '@/lib/utils/format';

const loadMetadata = (isrc: string) => tracksApi.metadata([isrc]);

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-zinc-900 px-3 py-2">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

interface TrackDetailsPanelProps {
  item: EnrichedTrack;
  onClose: () => void;
}

/** Side panel with everything known about one track: audio data, credits, tags and lyrics. */
export function TrackDetailsPanel({ item, onClose }: TrackDetailsPanelProps) {
  const { track, features } = item;
  const closeRef = useRef<HTMLButtonElement>(null);
  const metadata = useAsyncAction(loadMetadata);
  const lyrics = useAsyncAction(tracksApi.lyrics);

  const runMetadata = metadata.run;
  const runLyrics = lyrics.run;
  useEffect(() => {
    closeRef.current?.focus();
    if (track.isrc) void runMetadata(track.isrc);
    void runLyrics({
      title: track.name,
      artist: track.artists[0]?.name ?? '',
      album: track.albumName,
      durationMs: track.durationMs,
    });
  }, [track, runMetadata, runLyrics]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const facts = track.isrc ? metadata.data?.metadata[track.isrc] : undefined;
  const camelot = features ? toCamelot(features.key, features.mode) : null;
  const audioFacts: { label: string; value: ReactNode }[] = [
    { label: 'BPM', value: item.bpm ? Math.round(item.bpm) : '—' },
    {
      label: 'Key',
      value: features && camelot ? `${formatMusicalKey(features.key, features.mode)} · ${formatCamelot(camelot)}` : '—',
    },
    ...(features
      ? [
          { label: 'Energy', value: formatPercent(features.energy) },
          { label: 'Danceability', value: formatPercent(features.danceability) },
          { label: 'Mood (positivity)', value: formatPercent(features.valence) },
          { label: 'Acoustic', value: formatPercent(features.acousticness) },
          { label: 'Instrumental', value: formatPercent(features.instrumentalness) },
          { label: 'Loudness', value: formatDecibels(features.loudness) },
        ]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="track-details-title">
      <button type="button" aria-label="Close details" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col gap-6 overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-6">
        <div className="flex items-start gap-4">
          <CoverImage src={track.imageUrl} alt="" sizes="96px" className="h-24 w-24" />
          <div className="min-w-0 flex-1">
            <h2 id="track-details-title" className="text-lg leading-tight font-bold">
              {track.name}
            </h2>
            <p className="text-sm text-zinc-300">{track.artists.map((artist) => artist.name).join(', ')}</p>
            <p className="text-sm text-zinc-500">
              {track.albumName}
              {releaseYear(track) && ` · ${releaseYear(track)}`} · {formatTrackLength(track.durationMs)}
            </p>
            <a
              href={`https://open.spotify.com/track/${track.id}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-spotify hover:underline"
            >
              Open in Spotify <ExternalLink aria-hidden className="h-3 w-3" />
            </a>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close details"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Sound</h3>
          <dl className="grid grid-cols-2 gap-2">
            {audioFacts.map((fact) => (
              <Fact key={fact.label} {...fact} />
            ))}
          </dl>
          {!features && <p className="text-xs text-zinc-500">No audio data for this track.</p>}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Background</h3>
          {metadata.isLoading && <Loader2 aria-label="Loading" className="h-4 w-4 animate-spin text-zinc-500" />}
          {!metadata.isLoading && !facts && <p className="text-xs text-zinc-500">Not found on MusicBrainz.</p>}
          {facts && (
            <div className="flex flex-col gap-3 text-sm">
              {facts.originalYear && <p className="text-zinc-300">First released in {facts.originalYear}</p>}
              {facts.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {facts.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {facts.credits.length > 0 && (
                <ul className="flex flex-col gap-0.5 text-xs text-zinc-400">
                  {facts.credits.map((credit) => (
                    <li key={`${credit.role}:${credit.name}`}>
                      <span className="text-zinc-200">{credit.name}</span> · {credit.role}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Lyrics</h3>
          {lyrics.isLoading && <Loader2 aria-label="Loading" className="h-4 w-4 animate-spin text-zinc-500" />}
          {!lyrics.isLoading && lyrics.data?.lyrics?.instrumental && <p className="text-sm text-zinc-400">Instrumental</p>}
          {!lyrics.isLoading && lyrics.data?.lyrics?.plainLyrics && (
            <p className="text-sm leading-relaxed whitespace-pre-line text-zinc-300">{lyrics.data.lyrics.plainLyrics}</p>
          )}
          {!lyrics.isLoading && !lyrics.data?.lyrics && <p className="text-xs text-zinc-500">No lyrics found.</p>}
        </section>
      </aside>
    </div>
  );
}
