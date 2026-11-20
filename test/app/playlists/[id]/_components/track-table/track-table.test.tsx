// @vitest-environment jsdom
import '@/test/dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SORT, sortTracks, TrackTable, type TrackSort } from '@/app/playlists/[id]/_components/track-table/track-table';
import type { EnrichedTrack } from '@/lib/domain/models/playlist';
import { enrich, makeFeatures, makeTrack } from '@/test/factories';

const api = vi.hoisted(() => ({ preview: vi.fn(), metadata: vi.fn(), lyrics: vi.fn() }));
vi.mock('@/lib/api/tracks-api', () => ({ tracksApi: api }));

const slow = enrich(makeTrack({ name: 'Slow Song', albumName: 'Quiet', isrc: 'ISRC00000001' }), {
  bpm: 80,
  features: makeFeatures({ energy: 0.2, key: 9, mode: 0 }),
  addedAt: '2025-01-23T10:00:00Z',
  addedBy: 'Me',
});
const fast = enrich(makeTrack({ name: 'Fast Song', albumName: 'Loud' }), { bpm: 160, features: makeFeatures({ energy: 0.9 }) });
const unknown = enrich(makeTrack({ name: 'Unknown Song' }));

function Harness({ tracks = [slow, fast, unknown], ...props }: { tracks?: EnrichedTrack[]; withSelection?: boolean; onToggle?: (uri: string) => void }) {
  const [sort, setSort] = useState<TrackSort>(DEFAULT_SORT);
  const selection = props.withSelection ? { selected: new Set<string>(), onToggle: props.onToggle ?? vi.fn() } : undefined;
  return <TrackTable tracks={sortTracks(tracks, sort)} sort={sort} onSortChange={setSort} selection={selection} />;
}

const titles = () => screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[2]?.textContent);

describe('TrackTable', () => {
  it('ignores a resize notification that arrives after the table is gone', () => {
    // Removing the table resizes it, and the browser can report that after React cleared the ref.
    let notify: () => void = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notify = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const { unmount } = render(<Harness />);
    notify();
    unmount();
    expect(() => notify()).not.toThrow();
    vi.unstubAllGlobals();
  });

  it('starts on the Spotify-like overview and switches to the audio columns', async () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Album' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'BPM' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Audio' }));
    expect(screen.getByRole('radio', { name: 'Audio' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'BPM' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Album' })).not.toBeInTheDocument();
    expect(screen.getByText('A min')).toBeInTheDocument();
    expect(screen.getByText('· 8A')).toBeInTheDocument();
  });

  it('sorts by a column and keeps tracks without data at the bottom in both directions', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('radio', { name: 'Audio' }));
    const bpmHeader = () => screen.getByRole('button', { name: /BPM/ });

    await userEvent.click(bpmHeader());
    expect(titles()).toEqual(['Slow SongArtist A', 'Fast SongArtist A', 'Unknown SongArtist A']);
    expect(bpmHeader().closest('th')).toHaveAttribute('aria-sort', 'ascending');

    await userEvent.click(bpmHeader());
    expect(titles()).toEqual(['Fast SongArtist A', 'Slow SongArtist A', 'Unknown SongArtist A']);
    expect(bpmHeader().closest('th')).toHaveAttribute('aria-sort', 'descending');
  });

  it('hides the added-by columns when no track has them', () => {
    render(<Harness tracks={[fast, unknown]} />);
    expect(screen.queryByRole('button', { name: 'Added by' })).not.toBeInTheDocument();
  });

  it('lets the user tick tracks when selection is enabled', async () => {
    const onToggle = vi.fn();
    render(<Harness withSelection onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Fast Song' }));
    expect(onToggle).toHaveBeenCalledWith(fast.track.uri);
  });

  it('plays a preview on demand and marks tracks without one', async () => {
    api.preview.mockResolvedValueOnce({ url: 'https://cdnt-preview.dzcdn.net/a.mp3' }).mockResolvedValueOnce({ url: null });
    render(<Harness />);
    const [first, second] = screen.getAllByRole('button', { name: 'Play preview' });

    await userEvent.click(first);
    expect(await screen.findByRole('button', { name: 'Stop preview' })).toBeInTheDocument();
    expect(api.preview).toHaveBeenCalledWith({ isrc: 'ISRC00000001', title: 'Slow Song', artist: 'Artist A' });

    await userEvent.click(second);
    expect(await screen.findByRole('button', { name: 'No preview available' })).toBeDisabled();
  });

  it('opens the details panel from the title, with lyrics and background, and closes it with Escape', async () => {
    api.metadata.mockResolvedValue({ metadata: { ISRC00000001: { originalYear: 1999, tags: ['indie'], credits: [{ name: 'Producer X', role: 'producer' }], artistId: null } } });
    api.lyrics.mockResolvedValue({ lyrics: { instrumental: false, plainLyrics: 'Hello darkness' } });
    render(<Harness />);

    await userEvent.click(screen.getAllByRole('button', { name: /Slow Song/ })[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Slow Song' });
    expect(await within(dialog).findByText('Hello darkness')).toBeInTheDocument();
    expect(within(dialog).getByText('First released in 1999')).toBeInTheDocument();
    expect(within(dialog).getByText('indie')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('button', { name: 'Close details' })[1]).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows empty states in the details panel when nothing is known', async () => {
    api.lyrics.mockResolvedValue({ lyrics: null });
    render(<Harness />);
    await userEvent.click(screen.getAllByRole('button', { name: /Unknown Song/ })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('No lyrics found.')).toBeInTheDocument();
    expect(within(dialog).getByText('No audio data for this track.')).toBeInTheDocument();
    expect(within(dialog).getByText('Not found on MusicBrainz.')).toBeInTheDocument();
  });
});
