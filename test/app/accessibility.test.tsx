// @vitest-environment jsdom
import '@/test/dom';
import { render } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PlaylistGrid } from '@/app/dashboard/playlist-grid';
import { ImproveTab } from '@/app/playlists/[id]/_components/improve-tab';
import { SaveDestinationForm } from '@/app/playlists/[id]/_components/save-destination';
import { ShuffleTab } from '@/app/playlists/[id]/_components/shuffle-tab';
import { TracksTab } from '@/app/playlists/[id]/_components/tracks-tab';
import { byArtist, enrich, makeFeatures } from '@/test/factories';

vi.mock('@/lib/api/playlists-api', () => ({ playlistsApi: { list: vi.fn().mockResolvedValue({ playlists: [] }) } }));
vi.mock('@/lib/api/tracks-api', () => ({ tracksApi: {} }));
vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: async () => new Headers({ host: '127.0.0.1:3000' }) }));
vi.mock('@/lib/auth/session', () => ({ getAuthenticatedSession: vi.fn().mockResolvedValue(null) }));

const tracks = Array.from({ length: 6 }, (_, index) =>
  enrich(byArtist(`artist-${index}`), {
    bpm: 100 + index * 10,
    features: makeFeatures({ energy: index / 6 }),
    addedAt: '2025-01-01T00:00:00Z',
    addedBy: 'Me',
  }),
);

/** Fails with the list of WCAG problems axe finds. Color contrast needs real layout, so it's checked in the browser. */
async function expectAccessible(ui: ReactElement) {
  const { container } = render(ui);
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  const problems = results.violations.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`);
  expect(problems).toEqual([]);
}

describe('accessibility', () => {
  it('landing page', async () => {
    const { default: HomePage } = await import('@/app/page');
    await expectAccessible(await HomePage({ searchParams: Promise.resolve({ error: 'state_mismatch' }) }));
  });

  it('track list with search', async () => {
    await expectAccessible(<TracksTab tracks={tracks} />);
  });

  it('shuffle tab', async () => {
    await expectAccessible(<ShuffleTab playlistId="p1" tracks={tracks} canEdit onChanged={vi.fn()} />);
  });

  it('improve tab', async () => {
    await expectAccessible(<ImproveTab playlistId="p1" playlistName="Mix" tracks={tracks} canEdit onChanged={vi.fn()} />);
  });

  it('save form', async () => {
    await expectAccessible(
      <SaveDestinationForm currentLabel="Overwrite" canSaveToCurrent defaultName="Mix" submitLabel="Save" isSaving={false} onSave={vi.fn()} />,
    );
  });

  it('dashboard grid', async () => {
    await expectAccessible(<PlaylistGrid />);
  });
});
