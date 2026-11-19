'use client';

import { useCallback, useRef, useState } from 'react';
import { tracksApi } from '@/lib/api/tracks-api';
import type { Track } from '@/lib/domain/models/playlist';

export type PreviewState = 'idle' | 'loading' | 'playing' | 'unavailable';

/**
 * Plays 30 second previews. URLs are looked up on demand (the server tries Deezer, then
 * iTunes) and remembered for the session. Only one preview plays at a time.
 */
export function usePreviewPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlsRef = useRef(new Map<string, string | null>());
  const requestedIdRef = useRef<string | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unavailableIds, setUnavailableIds] = useState<ReadonlySet<string>>(() => new Set());

  const stop = useCallback(() => {
    requestedIdRef.current = null;
    audioRef.current?.pause();
    setActiveTrackId(null);
    setIsLoading(false);
  }, []);

  const resolveUrl = useCallback(async (track: Track): Promise<string | null> => {
    const known = urlsRef.current.get(track.id);
    if (known !== undefined) return known;

    let url: string | null = null;
    try {
      ({ url } = await tracksApi.preview({
        isrc: track.isrc,
        title: track.name,
        artist: track.artists[0]?.name ?? '',
      }));
    } catch {
      // Treated as "no preview"; the user can try again after a reload.
    }
    urlsRef.current.set(track.id, url);
    return url;
  }, []);

  const toggle = useCallback(
    async (track: Track) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (requestedIdRef.current === track.id) {
        stop();
        return;
      }

      audio.pause();
      requestedIdRef.current = track.id;
      setActiveTrackId(track.id);
      setIsLoading(true);

      const url = await resolveUrl(track);
      if (requestedIdRef.current !== track.id) return; // another track was clicked meanwhile

      if (!url) {
        setUnavailableIds((current) => new Set(current).add(track.id));
        stop();
        return;
      }

      audio.src = url;
      try {
        await audio.play();
        setIsLoading(false);
      } catch {
        if (requestedIdRef.current !== track.id) return; // interrupted by another click
        urlsRef.current.delete(track.id); // the signed URL may have expired: fetch it again next time
        stop();
      }
    },
    [resolveUrl, stop],
  );

  const stateOf = useCallback(
    (trackId: string): PreviewState => {
      if (unavailableIds.has(trackId)) return 'unavailable';
      if (activeTrackId !== trackId) return 'idle';
      return isLoading ? 'loading' : 'playing';
    },
    [activeTrackId, isLoading, unavailableIds],
  );

  return { audioRef, toggle, stateOf, onEnded: stop };
}
