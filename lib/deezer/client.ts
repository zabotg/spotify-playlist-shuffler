/**
 * Deezer public API — no auth required.
 * Used to supplement Spotify data when audio-features is restricted:
 *   - BPM (tempo)
 *   - 30s preview URL
 */

const BASE = 'https://api.deezer.com';

export interface DeezerTrackData {
  bpm: number | null;
  preview: string | null;
}

async function getByIsrc(isrc: string): Promise<DeezerTrackData | null> {
  try {
    const res = await fetch(`${BASE}/track/isrc:${isrc}`, {
      next: { revalidate: 86400 }, // cache 24h — BPM/preview never change
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return {
      bpm: data.bpm > 0 ? data.bpm : null,
      preview: data.preview || null,
    };
  } catch {
    return null;
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Lookup BPM + preview for a list of ISRCs. Returns a map keyed by ISRC. */
export async function getDeezerDataBatch(
  isrcs: string[]
): Promise<Map<string, DeezerTrackData>> {
  const map = new Map<string, DeezerTrackData>();
  if (isrcs.length === 0) return map;

  // 10 concurrent requests per batch to avoid hammering Deezer
  for (const batch of chunk(isrcs, 10)) {
    const results = await Promise.all(
      batch.map(isrc => getByIsrc(isrc).then(d => ({ isrc, d })))
    );
    for (const { isrc, d } of results) {
      if (d) map.set(isrc, d);
    }
  }
  return map;
}
