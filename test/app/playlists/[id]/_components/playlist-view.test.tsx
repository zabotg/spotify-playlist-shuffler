// @vitest-environment jsdom
import '@/test/dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlaylistView } from '@/app/playlists/[id]/_components/playlist-view';
import { enrich, makeFeatures, makeTrack } from '@/test/factories';

const playlists = vi.hoisted(() => ({ get: vi.fn(), tracks: vi.fn(), overwriteTracks: vi.fn() }));
const tracksApi = vi.hoisted(() => ({ details: vi.fn(), analyze: vi.fn(), preview: vi.fn() }));
vi.mock('@/lib/api/playlists-api', () => ({ playlistsApi: playlists }));
vi.mock('@/lib/api/tracks-api', () => ({ tracksApi }));
vi.mock('@/lib/api/artists-api', () => ({ artistsApi: { genres: vi.fn().mockResolvedValue({ genres: [] }) } }));

const playlist = {
  id: 'p1',
  name: 'Road Trip',
  description: 'Long drives',
  imageUrl: null,
  ownerId: 'me',
  ownerName: 'Me',
  collaborative: true,
  trackCount: 2,
};

describe('PlaylistView', () => {
  it('loads the playlist, fills missing data in the background and switches tabs with the keyboard', async () => {
    const withIsrc = enrich(makeTrack({ name: 'Needs details', isrc: 'ISRC00000001' }));
    const known = enrich(makeTrack({ name: 'Known' }), { features: makeFeatures(), bpm: 120, popularity: 5 });
    playlists.get.mockResolvedValue({ playlist, canEdit: true });
    playlists.tracks.mockResolvedValue({ tracks: [withIsrc, known], skippedItemCount: 0 });
    tracksApi.details.mockResolvedValue({ details: { ISRC00000001: { bpm: 99, popularity: 10 } } });
    tracksApi.analyze.mockResolvedValue({ features: { [withIsrc.track.id]: makeFeatures({ tempo: 99 }) } });

    render(<PlaylistView playlistId="p1" />);

    expect(await screen.findByRole('heading', { name: 'Road Trip' })).toBeInTheDocument();
    expect(await screen.findByText('Needs details')).toBeInTheDocument();
    await waitFor(() => expect(tracksApi.details).toHaveBeenCalledWith(['ISRC00000001']));
    await waitFor(() => expect(tracksApi.analyze).toHaveBeenCalled());

    const tracksTab = screen.getByRole('tab', { name: /Tracks/ });
    expect(tracksTab).toHaveAttribute('aria-selected', 'true');
    tracksTab.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Shuffle/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /Discover/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Home}');
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /Discover/ })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('tab', { name: /Improve/ }));
    expect(screen.getByRole('heading', { name: 'Flow' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Insights/ }));
    expect(await screen.findByText('Unique artists')).toBeInTheDocument();
  });

  it('loads the header cover eagerly', async () => {
    playlists.get.mockResolvedValue({ playlist: { ...playlist, imageUrl: 'https://i.scdn.co/image/cover' }, canEdit: true });
    playlists.tracks.mockResolvedValue({ tracks: [], skippedItemCount: 0 });
    const { container } = render(<PlaylistView playlistId="p1" />);
    await screen.findByRole('heading', { name: 'Road Trip' });
    expect(container.querySelector('header img')).toHaveAttribute('loading', 'eager');
  });

  it('reloads the tracks after overwriting the order from the Shuffle tab', async () => {
    const songs = [enrich(makeTrack({ name: 'One' })), enrich(makeTrack({ name: 'Two' })), enrich(makeTrack({ name: 'Three' }))];
    playlists.get.mockResolvedValue({ playlist, canEdit: true });
    playlists.tracks.mockResolvedValue({ tracks: songs, skippedItemCount: 0 });
    playlists.overwriteTracks.mockResolvedValue({ playlistId: 'p1', playlistUrl: 'https://open.spotify.com/playlist/p1' });
    render(<PlaylistView playlistId="p1" />);

    await userEvent.click(await screen.findByRole('tab', { name: /Shuffle/ }));
    await userEvent.click(screen.getByRole('button', { name: /Preview shuffle/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save order' }));

    expect(await screen.findByText('Saved!')).toBeInTheDocument();
    await waitFor(() => expect(playlists.tracks).toHaveBeenCalledTimes(2));
  });

  it('shows an error when the playlist fails to load', async () => {
    playlists.get.mockRejectedValue(new Error('Resource not found on Spotify.'));
    playlists.tracks.mockResolvedValue({ tracks: [], skippedItemCount: 0 });
    render(<PlaylistView playlistId="missing" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Resource not found on Spotify.');
  });
});
