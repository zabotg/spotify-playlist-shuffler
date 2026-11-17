'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import type {
  SpotifyPlaylist, SpotifyTrack, PlaylistInsights,
  ShuffleMode, EnergyProfile, PopularityMode, MoodQuadrant, AudioFeatures,
} from '@/types';

// ── Constants ────────────────────────────────────────────────────────────────

type Tab = 'shuffle' | 'insights' | 'discover';

const SHUFFLE_MODES: { value: ShuffleMode; label: string; description: string }[] = [
  { value: 'pure_random',      label: 'Aleatório puro',           description: 'Ordem completamente aleatória.' },
  { value: 'balanced',         label: 'Balanceado',               description: 'Distribui artistas uniformemente.' },
  { value: 'artist_aware',     label: 'Espaçamento por artista',  description: 'Evita repetir o mesmo artista.' },
  { value: 'bpm_smooth',       label: 'Transição de BPM',         description: 'Transições suaves de ritmo.' },
  { value: 'energy_curve',     label: 'Curva de energia',         description: 'Controla como a energia sobe e desce.' },
  { value: 'mood_based',       label: 'Por humor',                description: 'Segue uma sequência de humores.' },
  { value: 'popularity_based', label: 'Por popularidade',         description: 'Prioriza faixas mais ou menos populares.' },
  { value: 'discovery',        label: 'Descoberta',               description: 'Intercala faixas conhecidas com novas.' },
];

const ENERGY_PROFILES: { value: EnergyProfile; label: string }[] = [
  { value: 'ascending', label: 'Crescente' },
  { value: 'descending', label: 'Decrescente' },
  { value: 'mountain', label: 'Montanha' },
  { value: 'valley', label: 'Vale' },
  { value: 'wave', label: 'Onda' },
];

const POPULARITY_MODES: { value: PopularityMode; label: string }[] = [
  { value: 'mainstream', label: 'Mainstream' },
  { value: 'underground', label: 'Underground' },
  { value: 'hybrid', label: 'Híbrido' },
];

const MOOD_QUADRANTS: { value: MoodQuadrant; label: string }[] = [
  { value: 'Joyful', label: 'Alegre' },
  { value: 'Intense', label: 'Intenso' },
  { value: 'Melancholic', label: 'Melancólico' },
  { value: 'Calm', label: 'Calmo' },
];

const KEY_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function msToTime(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function pct(v: number) { return `${Math.round(v * 100)}%`; }

function keyLabel(key: number, mode: number) {
  if (key < 0 || key > 11) return '—';
  return `${KEY_NAMES[key]} ${mode === 1 ? 'Maj' : 'min'}`;
}

// ── Track Table (used by Shuffle tab) ────────────────────────────────────────

interface ShuffledTrack {
  track: SpotifyTrack;
  features: AudioFeatures | null;
  deezer?: { bpm: number | null; preview: string | null } | null;
}
type SortKey = 'position' | 'name' | 'artist' | 'bpm' | 'key' | 'energy' | 'danceability' | 'valence' | 'loudness';

function SortTh({ k, label, align = 'right', sortKey, sortDir, onSort }: {
  k: SortKey; label: string; align?: string;
  sortKey: SortKey; sortDir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <th className={`px-3 py-2.5 text-${align}`}>
      <button
        onClick={() => onSort(k)}
        className={`flex items-center gap-1 text-xs font-medium whitespace-nowrap ${active ? 'text-[#1DB954]' : 'text-zinc-500 hover:text-zinc-300'} ${align === 'right' ? 'ml-auto' : ''}`}
      >
        {label}
        {active && <span className="text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  );
}

function TrackTable({
  tracks,
  onOrderChange,
}: {
  tracks: ShuffledTrack[];
  onOrderChange: (sorted: ShuffledTrack[]) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('position');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  function handleSort(key: SortKey) {
    const nextDir = sortKey === key ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
    setSortKey(key);
    setSortDir(nextDir);
  }

  const sorted = useMemo(() => {
    let out: ShuffledTrack[];
    if (sortKey === 'position') {
      out = sortDir === 'asc' ? [...tracks] : [...tracks].reverse();
    } else {
      out = [...tracks].sort((a, b) => {
        const f = (t: ShuffledTrack) => {
          const ft = t.features;
          switch (sortKey) {
            case 'name':         return t.track.name;
            case 'artist':       return t.track.artists[0]?.name ?? '';
            case 'bpm':          return ft?.tempo ?? t.deezer?.bpm ?? 0;
            case 'key':          return ft ? ft.key * 2 + ft.mode : -99;
            case 'energy':       return ft?.energy ?? 0;
            case 'danceability': return ft?.danceability ?? 0;
            case 'valence':      return ft?.valence ?? 0;
            case 'loudness':     return ft?.loudness ?? -99;
            default: return 0;
          }
        };
        const va = f(a), vb = f(b);
        if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
        return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
      });
    }
    return out;
  }, [tracks, sortKey, sortDir]);

  useEffect(() => {
    onOrderChange(sorted);
  }, [sorted, onOrderChange]);

  function togglePlay(track: SpotifyTrack) {
    if (!track.preview_url) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (playingId === track.id) {
      audio.pause();
      setPlayingId(null);
    } else {
      audio.src = track.preview_url;
      audio.play();
      setPlayingId(track.id);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-zinc-900/60">
            <tr className="border-b border-zinc-800">
              <SortTh k="position" label="#" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className="px-2 py-2.5 w-8" />
              <SortTh k="name"   label="Título"   align="left" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh k="artist" label="Artista"  align="left" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh k="bpm"    label="BPM" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh k="key"    label="Tom"       align="center" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh k="energy"       label="Energia" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh k="danceability" label="Dança"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh k="valence"      label="Humor"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh k="loudness"     label="Volume"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const f = row.features;
              const previewUrl = row.track.preview_url ?? row.deezer?.preview ?? null;
              const bpm = f?.tempo ? Math.round(f.tempo) : (row.deezer?.bpm ? Math.round(row.deezer.bpm) : null);
              const isPlaying = playingId === row.track.id;
              return (
                <tr key={`${row.track.id}-${i}`} className="border-b border-zinc-900 hover:bg-zinc-900/50 transition-colors group">
                  <td className="px-3 py-2 text-right text-zinc-500 text-xs w-10">{i + 1}</td>
                  <td className="px-2 py-2 w-9">
                    {previewUrl ? (
                      <button
                        onClick={() => togglePlay({ ...row.track, preview_url: previewUrl })}
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-colors ${
                          isPlaying ? 'bg-[#1DB954] text-black' : 'bg-zinc-700 hover:bg-[#1DB954] hover:text-black text-white'
                        }`}
                      >
                        {isPlaying ? '■' : '▶'}
                      </button>
                    ) : <div className="w-7" />}
                  </td>
                  <td className="px-3 py-2 max-w-[200px]">
                    <div className="flex items-center gap-2">
                      {row.track.album.images[0] && (
                        <img src={row.track.album.images[0].url} alt="" className="w-8 h-8 rounded shrink-0" />
                      )}
                      <span className="truncate font-medium text-sm">{row.track.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-zinc-400 text-sm max-w-[140px] truncate">
                    {row.track.artists.map(a => a.name).join(', ')}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-sm">
                    {bpm ?? <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">
                    {f ? keyLabel(f.key, f.mode) : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-sm">
                    {f ? pct(f.energy) : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-sm">
                    {f ? pct(f.danceability) : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-sm">
                    {f ? pct(f.valence) : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-zinc-400">
                    {f ? `${f.loudness.toFixed(1)}dB` : <span className="text-zinc-600">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
    </div>
  );
}

// ── Shuffle Tab ───────────────────────────────────────────────────────────────

function ShuffleTab({ playlistId, ownPlaylist }: { playlistId: string; ownPlaylist: boolean }) {
  const [mode, setMode] = useState<ShuffleMode>('balanced');
  const [energyProfile, setEnergyProfile] = useState<EnergyProfile>('ascending');
  const [popularityMode, setPopularityMode] = useState<PopularityMode>('hybrid');
  const [artistMinGap, setArtistMinGap] = useState(3);
  const [moodSequence, setMoodSequence] = useState<MoodQuadrant[]>(['Joyful', 'Intense']);

  const [shuffledTracks, setShuffledTracks] = useState<ShuffledTrack[]>([]);
  const [sortedTracks, setSortedTracks] = useState<ShuffledTrack[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingApply, setLoadingApply] = useState(false);
  const [applyTarget, setApplyTarget] = useState<'overwrite' | 'new'>('overwrite');
  const [newName, setNewName] = useState('');
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function buildBody() {
    const body: Record<string, unknown> = { mode, preview: true };
    if (mode === 'energy_curve')     body.energyProfile = energyProfile;
    if (mode === 'popularity_based') body.popularityMode = popularityMode;
    if (mode === 'artist_aware')     body.artistMinGap = artistMinGap;
    if (mode === 'mood_based')       body.moodSequence = moodSequence;
    return body;
  }

  async function handlePreview() {
    setLoadingPreview(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/shuffle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody()),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erro ao gerar prévia');
      const data = await res.json();
      setShuffledTracks(data.tracks);
      setSortedTracks(data.tracks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleApply() {
    if (!sortedTracks.length) return;
    setLoadingApply(true);
    setError(null);
    try {
      const uris = sortedTracks.map(t => t.track.uri);
      const body: Record<string, unknown> = { uris, target: applyTarget };
      if (applyTarget === 'new') body.newName = newName || 'Shuffled Playlist';
      const res = await fetch(`/api/playlists/${playlistId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erro ao aplicar');
      const data = await res.json();
      setResult({ url: data.playlistUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setLoadingApply(false);
    }
  }

  function toggleMood(mood: MoodQuadrant) {
    setMoodSequence(prev =>
      prev.includes(mood) ? prev.filter(m => m !== mood) : prev.length < 4 ? [...prev, mood] : prev
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Mode selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SHUFFLE_MODES.map(m => (
          <button
            key={m.value}
            onClick={() => { setMode(m.value); setShuffledTracks([]); setSortedTracks([]); }}
            className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
              mode === m.value ? 'border-[#1DB954] bg-[#1DB954]/10' : 'border-zinc-700 hover:border-zinc-500'
            }`}
          >
            <div className="text-xs font-semibold">{m.label}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{m.description}</div>
          </button>
        ))}
      </div>

      {/* Sub-options */}
      {mode === 'energy_curve' && (
        <div className="flex flex-wrap gap-2">
          {ENERGY_PROFILES.map(p => (
            <button key={p.value} onClick={() => setEnergyProfile(p.value)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${energyProfile === p.value ? 'border-[#1DB954] text-[#1DB954]' : 'border-zinc-700 text-zinc-400'}`}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {mode === 'popularity_based' && (
        <div className="flex flex-wrap gap-2">
          {POPULARITY_MODES.map(p => (
            <button key={p.value} onClick={() => setPopularityMode(p.value)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${popularityMode === p.value ? 'border-[#1DB954] text-[#1DB954]' : 'border-zinc-700 text-zinc-400'}`}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {mode === 'artist_aware' && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Gap mínimo entre o mesmo artista: <strong className="text-white">{artistMinGap}</strong></span>
          <input type="range" min={1} max={10} value={artistMinGap} onChange={e => setArtistMinGap(Number(e.target.value))} className="accent-[#1DB954] w-48" />
        </div>
      )}

      {mode === 'mood_based' && (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-zinc-400">Sequência de humores (selecione em ordem)</span>
          <div className="flex flex-wrap gap-2">
            {MOOD_QUADRANTS.map(q => (
              <button key={q.value} onClick={() => toggleMood(q.value)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${moodSequence.includes(q.value) ? 'border-[#1DB954] text-[#1DB954]' : 'border-zinc-700 text-zinc-400'}`}>
                {moodSequence.includes(q.value) && <span className="mr-1">{moodSequence.indexOf(q.value) + 1}.</span>}
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button onClick={handlePreview} disabled={loadingPreview}
        className="rounded-full bg-[#1DB954] text-black font-semibold py-2.5 px-6 hover:opacity-90 disabled:opacity-50 transition-opacity self-start text-sm">
        {loadingPreview ? 'Gerando…' : 'Ver prévia da playlist'}
      </button>

      {error && <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">{error}</div>}

      {shuffledTracks.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-300">{shuffledTracks.length} faixas · clique no cabeçalho para ordenar</h3>
          </div>

          <TrackTable tracks={shuffledTracks} onOrderChange={setSortedTracks} />

          {ownPlaylist && (
            <div className="flex flex-col gap-3 pt-3 border-t border-zinc-800">
              <span className="text-sm text-zinc-400 font-medium">Aplicar ordem atual na playlist</span>
              <div className="flex gap-2">
                {(['overwrite', 'new'] as const).map(t => (
                  <button key={t} onClick={() => setApplyTarget(t)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${applyTarget === t ? 'border-[#1DB954] text-[#1DB954]' : 'border-zinc-700 text-zinc-400'}`}>
                    {t === 'overwrite' ? 'Substituir original' : 'Criar nova playlist'}
                  </button>
                ))}
              </div>
              {applyTarget === 'new' && (
                <input type="text" placeholder="Nome da nova playlist" value={newName} onChange={e => setNewName(e.target.value)}
                  className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-zinc-500 max-w-xs" />
              )}
              <button onClick={handleApply} disabled={loadingApply}
                className="rounded-full bg-white text-black font-semibold py-2 px-6 hover:opacity-90 disabled:opacity-50 transition-opacity self-start text-sm">
                {loadingApply ? 'Aplicando…' : 'Aplicar shuffle'}
              </button>
            </div>
          )}

          {result && (
            <div className="rounded-lg bg-green-900/40 border border-green-700 px-4 py-3 text-sm text-green-300">
              Aplicado com sucesso!{' '}
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="underline">Abrir no Spotify</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Insights Tab ──────────────────────────────────────────────────────────────

function BarChart({ data, maxValue, colorFn }: {
  data: { label: string; value: number }[];
  maxValue: number;
  colorFn?: (v: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {data.map(({ label, value }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 w-12 shrink-0 text-right">{label}</span>
          <div className="flex-1 bg-zinc-800 rounded-full h-5 overflow-hidden">
            <div
              className="h-5 rounded-full flex items-center justify-end pr-2 transition-all"
              style={{
                width: `${Math.max((value / maxValue) * 100, 2)}%`,
                background: colorFn ? colorFn(value / maxValue) : '#1DB954',
              }}
            >
              <span className="text-[10px] font-medium text-black">{value}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FeatureBar({ label, value, color = '#1DB954' }: { label: string; value: number; color?: string }) {
  const hasData = value > 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-400 w-28 shrink-0">{label}</span>
      <div className="flex-1 bg-zinc-800 rounded-full h-2.5 overflow-hidden">
        {hasData && (
          <div className="h-2.5 rounded-full transition-all" style={{ width: pct(value), background: color }} />
        )}
      </div>
      <span className={`text-xs w-10 text-right tabular-nums ${hasData ? 'text-zinc-300' : 'text-zinc-600'}`}>
        {hasData ? pct(value) : '—'}
      </span>
    </div>
  );
}

function InsightsTab({ playlistId }: { playlistId: string }) {
  const [insights, setInsights] = useState<PlaylistInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/insights`);
      if (!res.ok) throw new Error('Erro ao carregar insights');
      const data = await res.json();
      setInsights(data.insights);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-zinc-400 text-sm max-w-sm">Analisa faixas, artistas, distribuição temporal e características de áudio da playlist.</p>
        <button onClick={load} disabled={loading}
          className="rounded-full bg-[#1DB954] text-black font-semibold py-3 px-8 hover:opacity-90 disabled:opacity-50 transition-opacity text-sm">
          {loading ? 'Analisando…' : 'Analisar playlist'}
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    );
  }

  if (!insights) return <p className="text-zinc-400 text-sm py-8 text-center">Sem dados disponíveis.</p>;

  const hasAudioFeatures = insights.avgEnergy > 0 || insights.avgDanceability > 0 || insights.avgValence > 0;

  // Release year chart — top 15 years
  const yearEntries = Object.entries(insights.releaseYearDistribution)
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  const maxYearCount = Math.max(...yearEntries.map(([, v]) => v), 1);

  // Decade chart
  const decadeEntries = Object.entries(insights.decadeDistribution)
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  const maxDecadeCount = Math.max(...decadeEntries.map(([, v]) => v), 1);

  // Popularity buckets
  const { underground, mid, mainstream } = insights.popularityDistribution;
  const totalPop = underground + mid + mainstream;

  return (
    <div className="flex flex-col gap-8">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Faixas', value: insights.totalTracks },
          { label: 'Artistas únicos', value: insights.uniqueArtists },
          { label: 'Duração total', value: msToTime(insights.totalDurationMs) },
          { label: 'Humor geral', value: insights.moodLabel },
          { label: 'Popularidade média', value: `${insights.averagePopularity}/100` },
          { label: 'Ano médio', value: Math.round(insights.averageReleaseYear) || '—' },
          { label: 'Faixas locais', value: insights.localTracks },
          { label: 'Conteúdo explícito', value: pct(insights.explicitRatio) },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 flex flex-col gap-1">
            <span className="text-xs text-zinc-500">{s.label}</span>
            <span className="text-lg font-bold leading-tight">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Audio features */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Características de áudio</h3>
          {!hasAudioFeatures && (
            <span className="text-xs text-zinc-500 italic">Requer acesso estendido à API do Spotify</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <FeatureBar label="Energia"        value={insights.avgEnergy}            color="#1DB954" />
          <FeatureBar label="Dançabilidade"  value={insights.avgDanceability}      color="#1ed760" />
          <FeatureBar label="Positividade"   value={insights.avgValence}           color="#ffd700" />
          <FeatureBar label="Acústico"       value={insights.avgAcousticness}      color="#7c9db3" />
          <FeatureBar label="Instrumental"   value={insights.avgInstrumentalness}  color="#9b59b6" />
          <FeatureBar label="Ao vivo"        value={insights.avgLiveness}          color="#e74c3c" />
          <FeatureBar label="Voz falada"     value={insights.avgSpeechiness}       color="#f39c12" />
        </div>
      </div>

      {/* Popularity distribution */}
      {totalPop > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Distribuição de popularidade</h3>
          <div className="flex rounded-lg overflow-hidden h-8 text-xs font-medium">
            {underground > 0 && (
              <div className="flex items-center justify-center bg-zinc-700" style={{ width: `${(underground / totalPop) * 100}%` }}>
                <span className="truncate px-1">{Math.round((underground / totalPop) * 100)}% underground</span>
              </div>
            )}
            {mid > 0 && (
              <div className="flex items-center justify-center bg-zinc-500" style={{ width: `${(mid / totalPop) * 100}%` }}>
                <span className="truncate px-1">{Math.round((mid / totalPop) * 100)}% mid</span>
              </div>
            )}
            {mainstream > 0 && (
              <div className="flex items-center justify-center bg-[#1DB954] text-black" style={{ width: `${(mainstream / totalPop) * 100}%` }}>
                <span className="truncate px-1">{Math.round((mainstream / totalPop) * 100)}% mainstream</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Decade distribution */}
      {decadeEntries.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Por década</h3>
          <BarChart
            data={decadeEntries.map(([label, value]) => ({ label: label + 's', value }))}
            maxValue={maxDecadeCount}
            colorFn={v => `hsl(${140 + v * 40}, 70%, ${40 + v * 20}%)`}
          />
        </div>
      )}

      {/* Release year chart */}
      {yearEntries.length > 1 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Por ano de lançamento</h3>
          <div className="flex items-end gap-0.5 h-24">
            {yearEntries.map(([year, count]) => (
              <div key={year} className="flex-1 flex flex-col items-center gap-1 group">
                <div
                  className="w-full bg-zinc-700 group-hover:bg-[#1DB954] transition-colors rounded-t"
                  style={{ height: `${(count / maxYearCount) * 80}px`, minHeight: '2px' }}
                  title={`${year}: ${count} faixas`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-zinc-600">
            <span>{yearEntries[0]?.[0]}</span>
            <span>{yearEntries[yearEntries.length - 1]?.[0]}</span>
          </div>
        </div>
      )}

      {/* Top artists */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Top artistas</h3>
        <BarChart
          data={insights.topArtists.slice(0, 10).map(a => ({ label: a.name, value: a.trackCount }))}
          maxValue={Math.max(...insights.topArtists.slice(0, 10).map(a => a.trackCount), 1)}
        />
      </div>

      {/* Genres */}
      {insights.genreEstimate.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Gêneros estimados</h3>
          <div className="flex flex-wrap gap-2">
            {insights.genreEstimate.slice(0, 15).map(g => (
              <span key={g} className="px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs text-zinc-300">{g}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Discover Tab ──────────────────────────────────────────────────────────────

function DiscoverTab({ playlistId }: { playlistId: string }) {
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addTarget, setAddTarget] = useState<'existing' | 'new'>('existing');
  const [newName, setNewName] = useState('');
  const [result, setResult] = useState<{ url: string } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(new Set());
    try {
      const res = await fetch(`/api/discover/${playlistId}?count=20`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Erro ao buscar recomendações');
      setTracks(data.tracks ?? []);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  function toggle(uri: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(uri)) { next.delete(uri); } else { next.add(uri); }
      return next;
    });
  }

  async function handleAdd() {
    if (!selected.size) return;
    setLoadingAdd(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { trackUris: Array.from(selected), target: addTarget };
      if (addTarget === 'existing') body.playlistId = playlistId;
      else body.newName = newName || 'Discovered Tracks';
      const res = await fetch('/api/discover/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erro ao adicionar');
      const data = await res.json();
      setResult({ url: data.playlistUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setLoadingAdd(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-zinc-400 text-sm max-w-sm">Encontra novas músicas baseadas nos artistas e estilo desta playlist.</p>
        <button onClick={load} disabled={loading}
          className="rounded-full bg-[#1DB954] text-black font-semibold py-3 px-8 hover:opacity-90 disabled:opacity-50 transition-opacity text-sm">
          {loading ? 'Buscando…' : 'Descobrir músicas'}
        </button>
        {error && <p className="text-red-400 text-sm max-w-sm">{error}</p>}
      </div>
    );
  }

  if (!tracks.length) return <p className="text-zinc-400 text-sm py-8 text-center">Nenhuma recomendação encontrada.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">{selected.size} selecionadas de {tracks.length}</span>
        <button onClick={load} disabled={loading} className="text-xs text-zinc-500 hover:text-white transition-colors">
          {loading ? 'Buscando…' : '↻ Atualizar'}
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {tracks.map(track => (
          <button key={track.id} onClick={() => toggle(track.uri)}
            className={`flex items-center gap-3 rounded-lg p-2.5 text-left transition-colors ${
              selected.has(track.uri) ? 'bg-[#1DB954]/10 border border-[#1DB954]/30' : 'hover:bg-zinc-800 border border-transparent'
            }`}
          >
            {track.album.images[0] && <img src={track.album.images[0].url} alt="" className="w-10 h-10 rounded shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{track.name}</div>
              <div className="truncate text-xs text-zinc-400">{track.artists.map(a => a.name).join(', ')} · {track.album.name}</div>
            </div>
            {selected.has(track.uri) && <span className="text-[#1DB954] text-sm shrink-0">✓</span>}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="flex flex-col gap-3 pt-3 border-t border-zinc-800">
          <div className="flex gap-2">
            {(['existing', 'new'] as const).map(t => (
              <button key={t} onClick={() => setAddTarget(t)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${addTarget === t ? 'border-[#1DB954] text-[#1DB954]' : 'border-zinc-700 text-zinc-400'}`}>
                {t === 'existing' ? 'Adicionar nesta playlist' : 'Criar nova playlist'}
              </button>
            ))}
          </div>
          {addTarget === 'new' && (
            <input type="text" placeholder="Nome da nova playlist" value={newName} onChange={e => setNewName(e.target.value)}
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-zinc-500 max-w-xs" />
          )}
          <button onClick={handleAdd} disabled={loadingAdd}
            className="rounded-full bg-white text-black font-semibold py-2 px-6 hover:opacity-90 disabled:opacity-50 transition-opacity self-start text-sm">
            {loadingAdd ? 'Adicionando…' : `Adicionar ${selected.size} música${selected.size > 1 ? 's' : ''}`}
          </button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {result && (
            <div className="rounded-lg bg-green-900/40 border border-green-700 px-4 py-3 text-sm text-green-300">
              Adicionado!{' '}
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="underline">Abrir no Spotify</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PlaylistView({ playlist, userId }: { playlist: SpotifyPlaylist; userId: string }) {
  const [tab, setTab] = useState<Tab>('shuffle');

  const tabs: { value: Tab; label: string }[] = [
    { value: 'shuffle',  label: 'Shuffle' },
    { value: 'insights', label: 'Insights' },
    { value: 'discover', label: 'Descobrir' },
  ];

  return (
    <main className="min-h-screen bg-black text-white px-6 py-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        <a href="/dashboard" className="text-sm text-zinc-400 hover:text-white transition-colors self-start">← Voltar</a>

        <div className="flex gap-4 items-start">
          {playlist.images[0] ? (
            <img src={playlist.images[0].url} alt={playlist.name} className="w-24 h-24 rounded object-cover shrink-0" />
          ) : (
            <div className="w-24 h-24 rounded bg-zinc-800 flex items-center justify-center shrink-0">
              <span className="text-4xl">♪</span>
            </div>
          )}
          <div className="flex flex-col gap-1 min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{playlist.name}</h1>
            {playlist.description && (
              <p className="text-sm text-zinc-400 line-clamp-2">{playlist.description.replace(/<[^>]+>/g, '')}</p>
            )}
            <p className="text-sm text-zinc-500">{playlist.tracks.total} músicas · {playlist.owner.display_name}</p>
          </div>
        </div>

        <div className="flex border-b border-zinc-800">
          {tabs.map(t => (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.value ? 'border-[#1DB954] text-white' : 'border-transparent text-zinc-400 hover:text-white'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'shuffle'  && <ShuffleTab playlistId={playlist.id} ownPlaylist={playlist.owner.id === userId} />}
        {tab === 'insights' && <InsightsTab playlistId={playlist.id} />}
        {tab === 'discover' && <DiscoverTab playlistId={playlist.id} />}
      </div>
    </main>
  );
}
