// @vitest-environment jsdom
import '@/test/dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImproveTab } from '@/app/playlists/[id]/_components/improve-tab';
import { byArtist, enrich, makeFeatures, makeTrack } from '@/test/factories';

const api = vi.hoisted(() => ({ removeTracks: vi.fn(), addTracks: vi.fn(), bridge: vi.fn(), create: vi.fn() }));
vi.mock('@/lib/api/playlists-api', () => ({ playlistsApi: api }));

const song = makeTrack({ name: 'Same Song', isrc: 'ISRC00000009', artists: [{ id: 'a', name: 'A' }] });
const tracks = [
  enrich(song, { bpm: 120, features: makeFeatures({ energy: 0.5, valence: 0.8, key: 0, mode: 1 }) }),
  enrich(makeTrack({ name: 'Rough Jump', artists: [{ id: 'b', name: 'B' }] }), {
    bpm: 175,
    features: makeFeatures({ energy: 0.95, valence: 0.2, key: 6, mode: 1 }),
  }),
  enrich({ ...song, id: 'copy', uri: 'spotify:track:copy' }, { bpm: 120, features: makeFeatures({ energy: 0.5, valence: 0.8 }) }),
];

function renderTab(canEdit = true) {
  const onChanged = vi.fn();
  render(<ImproveTab playlistId="p1" playlistName="Mix" tracks={tracks} canEdit={canEdit} onChanged={onChanged} />);
  return { onChanged };
}

describe('ImproveTab', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rates the flow and lists rough transitions with what is wrong', () => {
    renderTab();
    const flow = screen.getByRole('heading', { name: 'Flow' }).closest('section') as HTMLElement;
    expect(within(flow).getByText(/\/ 100/)).toBeInTheDocument();
    expect(within(flow).getAllByText(/Tempo 120 → 175 BPM/).length).toBeGreaterThan(0);
    expect(within(flow).getAllByText(/Key clash/).length).toBeGreaterThan(0);
  });

  it('asks before removing duplicates and does nothing when cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderTab();
    await userEvent.click(screen.getByRole('button', { name: 'Keep the first, remove the rest' }));
    expect(window.confirm).toHaveBeenCalledWith('Remove 1 extra copy from the playlist in Spotify?');
    expect(api.removeTracks).not.toHaveBeenCalled();
  });

  it('removes extra copies after confirming and reloads the playlist', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.removeTracks.mockResolvedValue({ playlistId: 'p1', playlistUrl: 'x' });
    const { onChanged } = renderTab();
    await userEvent.click(screen.getByRole('button', { name: 'Keep the first, remove the rest' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(api.removeTracks).toHaveBeenCalledWith('p1', [2]);
  });

  it('finds bridge songs and inserts the chosen one between the two tracks', async () => {
    const bridge = enrich(byArtist('bridge'), { bpm: 140, features: makeFeatures() });
    api.bridge.mockResolvedValue({ tracks: [bridge] });
    api.addTracks.mockResolvedValue({ playlistId: 'p1', playlistUrl: 'x' });
    const { onChanged } = renderTab();

    await userEvent.click(screen.getAllByRole('button', { name: 'Find bridge songs' })[0]);
    await userEvent.click(await screen.findByRole('checkbox', { name: `Select ${bridge.track.name}` }));
    await userEvent.click(screen.getByRole('button', { name: 'Insert 1 song between them' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(api.addTracks).toHaveBeenCalledWith('p1', [bridge.track.uri], expect.any(Number));
  });

  it('saves a mood group as a new playlist', async () => {
    api.create.mockResolvedValue({ playlistId: 'new', playlistUrl: 'https://open.spotify.com/playlist/new' });
    renderTab();
    await userEvent.click(screen.getAllByRole('button', { name: 'Save as playlist' })[0]);
    expect(api.create).toHaveBeenCalledWith(expect.stringMatching(/^Mix · /), expect.any(Array));
    expect(await screen.findByText('Playlist created!')).toBeInTheDocument();
  });

  it('hides editing actions on playlists the user cannot edit', () => {
    renderTab(false);
    expect(screen.queryByRole('button', { name: 'Keep the first, remove the rest' })).not.toBeInTheDocument();
    expect(screen.getByText(/You can.t edit this playlist/)).toBeInTheDocument();
  });
});
