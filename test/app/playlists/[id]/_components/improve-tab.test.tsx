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

function renderTab(canEdit = true, onChanged = vi.fn().mockResolvedValue(undefined)) {
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

  it('finds bridge songs, inserts the chosen one and waits for the reload', async () => {
    const bridge = enrich(byArtist('bridge'), { bpm: 140, features: makeFeatures() });
    api.bridge.mockResolvedValue({ tracks: [bridge] });
    api.addTracks.mockResolvedValue({ playlistId: 'p1', playlistUrl: 'x' });
    let finishReload: () => void = () => {};
    const onChanged = vi.fn(() => new Promise<void>((resolve) => (finishReload = resolve)));
    renderTab(true, onChanged);

    await userEvent.click(screen.getAllByRole('button', { name: 'Find bridge songs' })[0]);
    await userEvent.click(await screen.findByRole('checkbox', { name: `Select ${bridge.track.name}` }));
    await userEvent.click(screen.getByRole('button', { name: 'Insert 1 song between them' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(api.addTracks).toHaveBeenCalledWith('p1', [bridge.track.uri], expect.any(Number));
    expect(screen.getByRole('status')).toHaveTextContent('Added 1 song between them. Updating the flow…');
    expect(screen.queryByRole('button', { name: /Insert .* between them/ })).not.toBeInTheDocument();

    // The reload failed, so the pair is still there: the card comes back with nothing selected.
    finishReload();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Insert 0 songs between them' })).toBeDisabled();
  });

  it('does not show old suggestions on a new pair after the playlist reloads', async () => {
    const bridge = enrich(byArtist('bridge'), { bpm: 140, features: makeFeatures({ tempo: 140, energy: 0.7, key: 3, mode: 1 }) });
    api.bridge.mockResolvedValue({ tracks: [bridge] });
    api.addTracks.mockResolvedValue({ playlistId: 'p1', playlistUrl: 'x' });
    // Still reloading when the new tracks arrive.
    const onChanged = vi.fn(() => new Promise<void>(() => {}));
    const props = { playlistId: 'p1', playlistName: 'Mix', canEdit: true, onChanged };
    const { rerender } = render(<ImproveTab {...props} tracks={tracks} />);

    await userEvent.click(screen.getAllByRole('button', { name: 'Find bridge songs' })[0]);
    await userEvent.click(await screen.findByRole('checkbox', { name: `Select ${bridge.track.name}` }));
    await userEvent.click(screen.getByRole('button', { name: 'Insert 1 song between them' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());

    rerender(<ImproveTab {...props} tracks={[tracks[0], bridge, ...tracks.slice(1)]} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: `Select ${bridge.track.name}` })).not.toBeInTheDocument();
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
