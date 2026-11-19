// @vitest-environment jsdom
import '@/test/dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InsightsTab } from '@/app/playlists/[id]/_components/insights-tab';
import { byArtist, enrich, makeFeatures, makeTrack } from '@/test/factories';

const artists = vi.hoisted(() => ({ genres: vi.fn(), origins: vi.fn() }));
const tracksApi = vi.hoisted(() => ({ metadata: vi.fn(), lyricsSummary: vi.fn() }));
vi.mock('@/lib/api/artists-api', () => ({ artistsApi: artists }));
vi.mock('@/lib/api/tracks-api', () => ({ tracksApi }));

const english = 'en';
const tracks = Array.from({ length: 10 }, (_, index) =>
  enrich(makeTrack({ ...byArtist(index < 6 ? 'main' : `other-${index}`), name: `Song ${index}`, isrc: `ISRC0000000${index}` }), {
    popularity: (index + 1) * 1000,
    bpm: 120,
    features: makeFeatures(),
  }),
);

describe('InsightsTab', () => {
  it('shows the summary, hidden gems and on-demand MusicBrainz and lyrics insights', async () => {
    artists.genres.mockResolvedValue({ genres: [['indie']] });
    tracksApi.metadata.mockImplementation(async (isrcs: string[]) => ({
      metadata: Object.fromEntries(
        isrcs.map((isrc) => [isrc, { originalYear: 1995, tags: ['shoegaze'], credits: [{ name: 'Kevin', role: 'producer' }], artistId: 'mb-1' }]),
      ),
    }));
    artists.origins.mockResolvedValue({ origins: { 'mb-1': { country: 'Ireland' } } });
    tracksApi.lyricsSummary.mockImplementation(async (batch: { trackId: string }[]) => ({
      summaries: Object.fromEntries(batch.map(({ trackId }, index) => [trackId, { instrumental: index === 0, language: english }])),
    }));

    render(<InsightsTab tracks={tracks} skippedItemCount={0} />);

    expect(screen.getByText('Hidden gems')).toBeInTheDocument();
    expect(screen.getByText('Song 0')).toBeInTheDocument();
    expect(await screen.findByText('indie')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Load details/ }));
    expect(await screen.findByText(/shoegaze/)).toBeInTheDocument();
    expect(await screen.findByText('Ireland')).toBeInTheDocument();
    expect(screen.getByText(/Kevin \(producer\)/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Analyze lyrics' }));
    expect(await screen.findByText('English')).toBeInTheDocument();
    expect(screen.getByText('10 / 10')).toBeInTheDocument();
  });

  it('handles playlists without tracks or data', async () => {
    artists.genres.mockResolvedValue({ genres: [] });
    tracksApi.metadata.mockResolvedValue({ metadata: {} });
    tracksApi.lyricsSummary.mockResolvedValue({ summaries: {} });
    const { unmount } = render(<InsightsTab tracks={[]} skippedItemCount={0} />);
    expect(screen.getByText('This playlist has no tracks to analyze.')).toBeInTheDocument();
    unmount();

    render(<InsightsTab tracks={[enrich(makeTrack({ isrc: 'ISRC00000099' }))]} skippedItemCount={2} />);
    expect(screen.getByText(/2 local files/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Load details/ }));
    expect(await screen.findByText(/doesn.t have these tracks/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Analyze lyrics' }));
    expect(await screen.findByText('No lyrics found for these tracks.')).toBeInTheDocument();
  });
});
