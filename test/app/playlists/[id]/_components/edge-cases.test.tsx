// @vitest-environment jsdom
import '@/test/dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DiscoverTab } from '@/app/playlists/[id]/_components/discover-tab';
import { ImproveTab } from '@/app/playlists/[id]/_components/improve-tab';
import { InsightsTab } from '@/app/playlists/[id]/_components/insights-tab';
import { PlaylistView } from '@/app/playlists/[id]/_components/playlist-view';
import { ShuffleTab } from '@/app/playlists/[id]/_components/shuffle-tab';
import { DEFAULT_SORT, sortTracks, TrackTable, type TrackSort } from '@/app/playlists/[id]/_components/track-table/track-table';
import { CoverImage } from '@/components/ui/cover-image';
import { Spinner } from '@/components/ui/spinner';
import type { EnrichedTrack } from '@/lib/domain/models/playlist';
import { byArtist, enrich, makeFeatures, makeTrack } from '@/test/factories';

const playlists = vi.hoisted(() => ({
  get: vi.fn(),
  tracks: vi.fn(),
  overwriteTracks: vi.fn(),
  create: vi.fn(),
  recommendations: vi.fn(),
  addTracks: vi.fn(),
  removeTracks: vi.fn(),
  bridge: vi.fn(),
}));
const tracksApi = vi.hoisted(() => ({ preview: vi.fn(), metadata: vi.fn(), lyrics: vi.fn(), details: vi.fn(), analyze: vi.fn(), lyricsSummary: vi.fn() }));
vi.mock('@/lib/api/playlists-api', () => ({ playlistsApi: playlists }));
vi.mock('@/lib/api/tracks-api', () => ({ tracksApi }));
vi.mock('@/lib/api/artists-api', () => ({ artistsApi: { genres: vi.fn().mockResolvedValue({ genres: [] }), origins: vi.fn() } }));

const featured = (energy: number, extra: Partial<EnrichedTrack> = {}) =>
  enrich(byArtist(`artist-${energy}`), { bpm: 100 + energy * 50, features: makeFeatures({ energy, valence: energy }), ...extra });

describe('ShuffleTab settings', () => {
  const tracks = Array.from({ length: 6 }, (_, index) => featured(index / 6));

  it('applies the energy shape, artist gap and mood order of each mode', async () => {
    playlists.create.mockResolvedValue({ playlistId: 'n', playlistUrl: 'https://open.spotify.com/playlist/n' });
    render(<ShuffleTab playlistId="p1" tracks={tracks} canEdit={false} onChanged={vi.fn()} />);
    const preview = () => screen.getByRole('button', { name: /Preview shuffle|Shuffle again/ });

    await userEvent.click(screen.getByRole('button', { name: /Energy curve/ }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Energy shape' })).getByRole('button', { name: 'Rising' }));
    await userEvent.click(preview());
    expect(screen.getAllByRole('row')).toHaveLength(7);

    await userEvent.click(screen.getByRole('button', { name: /Artist spacing/ }));
    fireEvent.change(screen.getByRole('slider'), { target: { value: '5' } });
    expect(screen.getByText('5')).toBeInTheDocument();
    await userEvent.click(preview());

    await userEvent.click(screen.getByRole('button', { name: /Mood sequence/ }));
    const moods = screen.getByRole('group', { name: 'Mood order' });
    await userEvent.click(within(moods).getByRole('button', { name: /Joyful/ }));
    await userEvent.click(within(moods).getByRole('button', { name: /Intense/ }));
    expect(preview()).toBeDisabled();
    expect(screen.getByText('Pick at least one mood')).toBeInTheDocument();
    await userEvent.click(within(moods).getByRole('button', { name: /Calm/ }));
    await userEvent.click(preview());

    await userEvent.click(screen.getByRole('button', { name: /Pure random/ }));
    expect(screen.getByText('No extra settings for this mode.')).toBeInTheDocument();
    await userEvent.click(preview());
    await userEvent.click(screen.getByRole('button', { name: 'Save order' }));
    await waitFor(() => expect(playlists.create).toHaveBeenCalledWith('Shuffled Playlist', expect.any(Array)));
  });

  it('explains missing BPM data and empty playlists', async () => {
    const { unmount } = render(<ShuffleTab playlistId="p1" tracks={[enrich(makeTrack())]} canEdit onChanged={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Smooth BPM/ }));
    expect(screen.getAllByText('No BPM data found for these tracks').length).toBeGreaterThan(0);
    unmount();
    render(<ShuffleTab playlistId="p1" tracks={[]} canEdit onChanged={vi.fn()} />);
    expect(screen.getByText('This playlist has no tracks')).toBeInTheDocument();
  });
});

describe('ImproveTab edge cases', () => {
  it('handles playlists without audio data', () => {
    render(<ImproveTab playlistId="p1" playlistName="Mix" tracks={[enrich(makeTrack()), enrich(makeTrack())]} canEdit onChanged={vi.fn()} />);
    expect(screen.getByText('Not enough audio data to rate the flow yet.')).toBeInTheDocument();
    expect(screen.getByText('No duplicates found.')).toBeInTheDocument();
    expect(screen.getByText(/Every song fits/)).toBeInTheDocument();
    expect(screen.getByText('Not enough audio data to split by mood yet.')).toBeInTheDocument();
  });

  it('says when the flow is already smooth', () => {
    render(<ImproveTab playlistId="p1" playlistName="Mix" tracks={[featured(0.5), featured(0.5)]} canEdit onChanged={vi.fn()} />);
    expect(screen.getByText('No rough transitions. Nice.')).toBeInTheDocument();
    expect(screen.getByText(/Seamless/)).toBeInTheDocument();
  });

  it('describes energy jumps and drops, and reports bridge and insert problems', async () => {
    const calm = enrich(byArtist('calm'), { features: makeFeatures({ energy: 0.1, key: -1 }) });
    const loud = enrich(byArtist('loud'), { features: makeFeatures({ energy: 0.95, key: -1 }) });
    playlists.bridge.mockResolvedValueOnce({ tracks: [] });
    render(<ImproveTab playlistId="p1" playlistName="Mix" tracks={[calm, loud, calm]} canEdit={false} onChanged={vi.fn()} />);
    expect(screen.getByText('Energy jumps up')).toBeInTheDocument();
    expect(screen.getByText('Energy drops')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Find bridge songs' })[0]);
    expect(await screen.findByText('No new songs found to put between these two.')).toBeInTheDocument();
  });

  it('removes the selected songs that do not fit, after confirming', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    playlists.removeTracks.mockResolvedValue({ playlistId: 'p1', playlistUrl: 'x' });
    const onChanged = vi.fn();
    const steady = Array.from({ length: 9 }, (_, index) => featured(0.5 + index / 100));
    render(<ImproveTab playlistId="p1" playlistName="Mix" tracks={[...steady, featured(0.99)]} canEdit onChanged={onChanged} />);

    const card = screen.getByRole('heading', { name: "Doesn't fit" }).closest('section') as HTMLElement;
    const [checkbox] = within(card).getAllByRole('checkbox');
    await userEvent.click(checkbox);
    await userEvent.click(checkbox);
    await userEvent.click(checkbox);
    await userEvent.click(within(card).getByRole('button', { name: 'Remove selected' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(playlists.removeTracks).toHaveBeenCalledWith('p1', [9]);
  });

  it('shows bridge suggestions without checkboxes when the playlist is read-only', async () => {
    const bridge = enrich(byArtist('bridge'), { features: makeFeatures() });
    playlists.bridge.mockResolvedValue({ tracks: [bridge] });
    render(<ImproveTab playlistId="p1" playlistName="Mix" tracks={[featured(0.1), featured(0.95, { bpm: 200 })]} canEdit={false} onChanged={vi.fn()} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Find bridge songs' })[0]);
    expect(await screen.findAllByRole('button', { name: new RegExp(bridge.track.name) })).not.toHaveLength(0);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('lets the user untick a bridge suggestion before inserting', async () => {
    const bridge = enrich(byArtist('bridge'), { features: makeFeatures() });
    playlists.bridge.mockResolvedValue({ tracks: [bridge] });
    playlists.addTracks.mockRejectedValue(new Error('Spotify denied access to this resource.'));
    render(<ImproveTab playlistId="p1" playlistName="Mix" tracks={[featured(0.1), featured(0.95, { bpm: 200 })]} canEdit onChanged={vi.fn()} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Find bridge songs' })[0]);
    const checkbox = await screen.findByRole('checkbox', { name: `Select ${bridge.track.name}` });
    await userEvent.click(checkbox);
    await userEvent.click(checkbox);
    expect(screen.getByRole('button', { name: /Insert 0 songs/ })).toBeDisabled();
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole('button', { name: /Insert 1 song/ }));
    expect(await screen.findByText('Spotify denied access to this resource.')).toBeInTheDocument();
  });
});

function TableHarness({ tracks }: { tracks: EnrichedTrack[] }) {
  const [sort, setSort] = useState<TrackSort>(DEFAULT_SORT);
  return <TrackTable tracks={sortTracks(tracks, sort)} sort={sort} onSortChange={setSort} />;
}

describe('TrackTable columns', () => {
  it('sorts by every column and shows the explicit badge', async () => {
    const tracks = [
      enrich(makeTrack({ name: 'B', explicit: true, releaseDate: '2001' }), { features: makeFeatures(), popularity: 2, addedAt: '2024-01-01', addedBy: 'Me' }),
      enrich(makeTrack({ name: 'A', releaseDate: null }), { features: makeFeatures({ key: -1 }), addedAt: null, addedBy: null }),
      enrich(makeTrack({ name: 'C' })),
    ];
    render(<TableHarness tracks={tracks} />);
    expect(screen.getByTitle('Explicit')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'All columns' }));
    const headers = screen.getAllByRole('columnheader').flatMap((header) => within(header).queryAllByRole('button'));
    for (const header of headers) await userEvent.click(header);
    expect(headers.length).toBeGreaterThan(14);
  });

  it('shows a fade when there are more columns to the right', async () => {
    const sizes = { clientWidth: 300, scrollWidth: 900, scrollLeft: 0 };
    for (const [name, value] of Object.entries(sizes)) {
      vi.spyOn(HTMLElement.prototype, name as 'clientWidth', 'get').mockReturnValue(value);
    }
    const { container } = render(<TableHarness tracks={[featured(0.5)]} />);
    fireEvent.scroll(container.querySelector('.overflow-auto') as Element);
    expect(container.querySelector('.bg-gradient-to-l')).toBeInTheDocument();
  });

  it('shows details for a track without ISRC or artists, including instrumental tracks', async () => {
    tracksApi.lyrics.mockResolvedValue({ lyrics: { instrumental: true, plainLyrics: null } });
    render(<TableHarness tracks={[enrich(makeTrack({ name: 'Nameless', artists: [], isrc: null }))]} />);
    await userEvent.click(screen.getAllByRole('button', { name: /Nameless/ })[0]);
    expect(await screen.findByText('Instrumental')).toBeInTheDocument();
    expect(tracksApi.metadata).not.toHaveBeenCalled();
    expect(tracksApi.lyrics).toHaveBeenCalledWith(expect.objectContaining({ artist: '' }));
  });
});

describe('PlaylistView loading and reloading', () => {
  it('shows skeletons while tracks load, ignores other keys, and reloads after a change', async () => {
    let resolveTracks!: (value: unknown) => void;
    playlists.get.mockResolvedValue({
      playlist: { id: 'p1', name: 'Mix', description: null, imageUrl: 'https://i.scdn.co/image/1', ownerId: 'me', ownerName: null, collaborative: false, trackCount: 3 },
      canEdit: true,
    });
    playlists.tracks.mockReturnValueOnce(new Promise((resolve) => (resolveTracks = resolve)));
    tracksApi.details.mockResolvedValue({ details: {} });
    tracksApi.analyze.mockResolvedValue({ features: {} });

    const { container } = render(<PlaylistView playlistId="p1" />);
    expect(await screen.findByText('3 tracks')).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();

    const copy = enrich(makeTrack({ name: 'Copy', isrc: 'ISRC00000005' }), { features: makeFeatures() });
    resolveTracks({ tracks: [copy, { ...copy }], skippedItemCount: 0 });
    expect((await screen.findAllByText('Copy')).length).toBe(2);

    const tab = screen.getByRole('tab', { name: /Tracks/ });
    tab.focus();
    await userEvent.keyboard('a');
    expect(tab).toHaveAttribute('aria-selected', 'true');

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    playlists.removeTracks.mockResolvedValue({ playlistId: 'p1', playlistUrl: 'x' });
    playlists.tracks.mockResolvedValue({ tracks: [copy], skippedItemCount: 0 });
    await userEvent.click(screen.getByRole('tab', { name: /Improve/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep the first, remove the rest' }));
    await waitFor(() => expect(playlists.tracks).toHaveBeenCalledTimes(2));
  });
});

describe('DiscoverTab extras', () => {
  it('unticks songs, refreshes and saves to a new playlist', async () => {
    const suggestion = enrich(byArtist('new'), { features: makeFeatures() });
    playlists.recommendations.mockResolvedValue({ tracks: [suggestion] });
    playlists.create.mockResolvedValue({ playlistId: 'n', playlistUrl: 'https://open.spotify.com/playlist/n' });
    render(<DiscoverTab playlistId="p1" canEdit={false} />);

    await userEvent.click(screen.getByRole('button', { name: /Discover songs/ }));
    const checkbox = await screen.findByRole('checkbox', { name: `Select ${suggestion.track.name}` });
    await userEvent.click(checkbox);
    await userEvent.click(checkbox);
    expect(screen.queryByRole('button', { name: /Add 1 song/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    await userEvent.click(await screen.findByRole('checkbox', { name: `Select ${suggestion.track.name}` }));
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 song' }));
    await waitFor(() => expect(playlists.create).toHaveBeenCalledWith('Discovered Tracks', [suggestion.track.uri]));
  });
});

describe('small UI pieces', () => {
  it('renders covers, labelled spinners and insights without a known release year or artist', async () => {
    const { container } = render(
      <>
        <CoverImage src="https://i.scdn.co/image/abc" alt="Cover" sizes="40px" />
        <Spinner label="Loading tracks" />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Cover' })).toBeInTheDocument();
    expect(screen.getByText('Loading tracks')).toBeInTheDocument();
    container.remove();

    tracksApi.lyricsSummary.mockResolvedValue({ summaries: {} });
    render(<InsightsTab tracks={[enrich(makeTrack({ releaseDate: null, artists: [] }))]} skippedItemCount={0} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Analyze lyrics' }));
    await waitFor(() => expect(tracksApi.lyricsSummary).toHaveBeenCalledWith([expect.objectContaining({ artist: '' })]));
  });
});
