// @vitest-environment jsdom
import '@/test/dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DiscoverTab } from '@/app/playlists/[id]/_components/discover-tab';
import { SaveDestinationForm } from '@/app/playlists/[id]/_components/save-destination';
import { ShuffleTab } from '@/app/playlists/[id]/_components/shuffle-tab';
import { TracksTab } from '@/app/playlists/[id]/_components/tracks-tab';
import { byArtist, enrich, makeFeatures, makeTrack } from '@/test/factories';

const api = vi.hoisted(() => ({ overwriteTracks: vi.fn(), create: vi.fn(), recommendations: vi.fn(), addTracks: vi.fn() }));
vi.mock('@/lib/api/playlists-api', () => ({ playlistsApi: api }));
vi.mock('@/lib/api/tracks-api', () => ({ tracksApi: { preview: vi.fn() } }));

const rowTitles = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelectorAll('td')[2]?.textContent ?? '');

describe('SaveDestinationForm', () => {
  it('saves to the current playlist by default, or to a new one with a name', async () => {
    const onSave = vi.fn();
    render(
      <SaveDestinationForm currentLabel="Overwrite" canSaveToCurrent defaultName="Mix" submitLabel="Save" isSaving={false} onSave={onSave} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenLastCalledWith({ target: 'current', name: 'Mix' });

    await userEvent.click(screen.getByRole('button', { name: 'Create new playlist' }));
    await userEvent.type(screen.getByLabelText('Playlist name'), '  Road trip {Enter}');
    expect(onSave).toHaveBeenLastCalledWith({ target: 'new', name: 'Road trip' });
  });

  it('only offers a new playlist when the current one is not editable', () => {
    render(<SaveDestinationForm currentLabel="Overwrite" canSaveToCurrent={false} defaultName="Mix" submitLabel="Save" isSaving onSave={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Overwrite' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Playlist name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled();
  });
});

describe('ShuffleTab', () => {
  const tracks = Array.from({ length: 8 }, (_, index) =>
    enrich(byArtist(`artist-${index}`), { bpm: 100 + index, features: makeFeatures({ energy: 0.5 + index / 100 }) }),
  );

  const link = { playlistId: 'p1', playlistUrl: 'https://open.spotify.com/playlist/p1' };

  it('previews a new order, changes it on "Shuffle again" and saves it as shown, with live progress', async () => {
    let finishSave: () => void = () => {};
    api.overwriteTracks.mockImplementation(
      (_id: string, _uris: string[], _method: string, onProgress: (progress: { done: number; total: number }) => void) =>
        new Promise((resolve) => {
          onProgress({ done: 3, total: 8 });
          finishSave = () => resolve(link);
        }),
    );
    const onChanged = vi.fn().mockResolvedValue(undefined);
    render(<ShuffleTab playlistId="p1" tracks={tracks} canEdit onChanged={onChanged} />);

    await userEvent.click(screen.getByRole('button', { name: /Preview shuffle/ }));
    const first = rowTitles();
    expect(first).toHaveLength(8);

    await userEvent.click(screen.getByRole('button', { name: /Shuffle again/ }));
    expect(rowTitles()).not.toEqual(first);
    expect(screen.getByText(/"Date added" is kept/)).toBeInTheDocument();

    const shown = rowTitles();
    await userEvent.click(screen.getByRole('button', { name: 'Save order' }));
    await waitFor(() => expect(api.overwriteTracks).toHaveBeenCalled());
    const [, savedUris, method] = api.overwriteTracks.mock.calls[0] as [string, string[], string];
    const asShown = savedUris.map((uri) => {
      const { track } = tracks.find((item) => item.track.uri === uri)!;
      return `${track.name}${track.artists[0].name}`;
    });
    expect(asShown).toEqual(shown);
    expect(method).toBe('move');

    expect(await screen.findByText('Moving tracks… 3 of 8')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Saving to Spotify' })).toHaveAttribute('aria-valuenow', '38');
    expect(onChanged).not.toHaveBeenCalled();

    finishSave();
    expect(await screen.findByText('Saved!')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  it('can replace the whole list at once instead, showing batch progress', async () => {
    api.overwriteTracks.mockImplementation(
      (_id: string, _uris: string[], _method: string, onProgress: (progress: { done: number; total: number }) => void) => {
        onProgress({ done: 0, total: 0 });
        return new Promise(() => {});
      },
    );
    render(<ShuffleTab playlistId="p1" tracks={tracks} canEdit onChanged={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Preview shuffle/ }));

    await userEvent.click(screen.getByRole('button', { name: 'Replace all at once' }));
    expect(screen.getByText(/resets to now/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save order' }));
    expect(api.overwriteTracks.mock.calls[0][2]).toBe('replace');
    expect(await screen.findByText('Saving… batch 0 of 0')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('saves a new playlist without reloading this one', async () => {
    api.create.mockResolvedValue(link);
    const onChanged = vi.fn();
    render(<ShuffleTab playlistId="p1" tracks={tracks} canEdit onChanged={onChanged} />);
    await userEvent.click(screen.getByRole('button', { name: /Preview shuffle/ }));

    await userEvent.click(screen.getByRole('button', { name: 'Create new playlist' }));
    expect(screen.queryByRole('group', { name: 'How to overwrite' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save order' }));

    expect(await screen.findByText('Saved!')).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('explains why audio-based modes are unavailable', async () => {
    render(<ShuffleTab playlistId="p1" tracks={[enrich(makeTrack()), enrich(makeTrack())]} canEdit={false} onChanged={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /DJ mix/ }));
    expect(screen.getAllByText('No audio data found for these tracks').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Preview shuffle/ })).toBeDisabled();
  });
});

describe('TracksTab', () => {
  it('filters by title, artist or album and can clear the search', async () => {
    const tracks = [
      enrich(makeTrack({ name: 'Midnight', albumName: 'Texas Sun' })),
      enrich(makeTrack({ name: 'Alibi', artists: [{ id: 'j', name: 'Jordan Mackampa' }] })),
    ];
    render(<TracksTab tracks={tracks} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search tracks' }), 'mackampa');
    expect(rowTitles()).toEqual(['AlibiJordan Mackampa']);

    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search tracks' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search tracks' }), 'nothing here');
    await userEvent.click(screen.getByRole('button', { name: /Clear search/ }));
    expect(rowTitles()).toHaveLength(2);
  });

  it('says when the playlist is empty', () => {
    render(<TracksTab tracks={[]} />);
    expect(screen.getByText('This playlist has no tracks.')).toBeInTheDocument();
  });
});

describe('DiscoverTab', () => {
  it('loads suggestions with audio data and adds the selected ones', async () => {
    const suggestion = enrich(byArtist('new'), { bpm: 120, features: makeFeatures() });
    api.recommendations.mockResolvedValue({ tracks: [suggestion] });
    api.addTracks.mockResolvedValue({ playlistId: 'p1', playlistUrl: 'https://open.spotify.com/playlist/p1' });
    render(<DiscoverTab playlistId="p1" canEdit />);

    await userEvent.click(screen.getByRole('button', { name: /Discover songs/ }));
    expect(await screen.findByRole('button', { name: /BPM/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: `Select ${suggestion.track.name}` }));
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 song' }));

    await waitFor(() => expect(api.addTracks).toHaveBeenCalledWith('p1', [suggestion.track.uri]));
    expect(await screen.findByText('Added!')).toBeInTheDocument();
  });

  it('says when nothing was found', async () => {
    api.recommendations.mockResolvedValue({ tracks: [] });
    render(<DiscoverTab playlistId="p1" canEdit={false} />);
    await userEvent.click(screen.getByRole('button', { name: /Discover songs/ }));
    expect(await screen.findByText('No recommendations found.')).toBeInTheDocument();
  });
});
