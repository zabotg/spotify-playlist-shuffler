// @vitest-environment jsdom
import '@/test/dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlaylistGrid } from '@/app/dashboard/playlist-grid';

const playlists = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/lib/api/playlists-api', () => ({ playlistsApi: playlists }));

const summary = { id: 'p1', name: 'Focus', description: null, imageUrl: null, ownerId: 'me', ownerName: 'Me', collaborative: false, trackCount: 1 };

describe('PlaylistGrid', () => {
  it('shows playlists as links to their page', async () => {
    playlists.list.mockResolvedValue({ playlists: [summary] });
    render(<PlaylistGrid />);
    expect(await screen.findByRole('link', { name: /Focus/ })).toHaveAttribute('href', '/playlists/p1');
    expect(screen.getByText(/1 track/)).toBeInTheDocument();
  });

  it('loads the first row of covers eagerly and the rest lazily', async () => {
    const withCovers = Array.from({ length: 6 }, (_, index) => ({
      ...summary,
      id: `p${index}`,
      name: `Playlist ${index}`,
      imageUrl: `https://i.scdn.co/image/${index}`,
    }));
    playlists.list.mockResolvedValue({ playlists: withCovers });
    const { container } = render(<PlaylistGrid />);
    await screen.findByRole('link', { name: /Playlist 0/ });
    const loading = [...container.querySelectorAll('img')].map((img) => img.getAttribute('loading'));
    expect(loading).toEqual(['eager', 'eager', 'eager', 'eager', 'eager', 'lazy']);
  });

  it('shows an empty state', async () => {
    playlists.list.mockResolvedValue({ playlists: [] });
    render(<PlaylistGrid />);
    expect(await screen.findByText('No editable playlists found.')).toBeInTheDocument();
  });

  it('shows the error and retries', async () => {
    playlists.list.mockRejectedValueOnce(new Error('Spotify request failed.')).mockResolvedValueOnce({ playlists: [summary] });
    render(<PlaylistGrid />);
    expect(await screen.findByText('Spotify request failed.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findByRole('link', { name: /Focus/ })).toBeInTheDocument();
  });
});
