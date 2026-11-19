// @vitest-environment jsdom
import '@/test/dom';
import { render, screen } from '@testing-library/react';
import { isValidElement, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fakeSession } from '@/test/fakes';

const mocks = vi.hoisted(() => ({
  getAuthenticatedSession: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock('@/lib/auth/session', () => ({ getAuthenticatedSession: mocks.getAuthenticatedSession }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/font/google', () => {
  const font = () => ({ variable: 'font-variable', className: 'font-class' });
  return { Geist: font, Geist_Mono: font, Bricolage_Grotesque: font };
});
vi.mock('@/lib/api/playlists-api', () => ({ playlistsApi: { list: vi.fn().mockResolvedValue({ playlists: [] }), get: vi.fn(() => new Promise(() => {})), tracks: vi.fn(() => new Promise(() => {})) } }));

describe('server pages', () => {
  it('home page sends signed-in users to the dashboard', async () => {
    mocks.getAuthenticatedSession.mockResolvedValue(fakeSession());
    const { default: HomePage } = await import('@/app/page');
    await expect(HomePage({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect:/dashboard');
  });

  it('dashboard greets the user, or sends signed-out users home', async () => {
    const { default: DashboardPage } = await import('@/app/dashboard/page');
    mocks.getAuthenticatedSession.mockResolvedValue(fakeSession({ displayName: 'Gui' }));
    render(await DashboardPage());
    expect(screen.getByRole('heading', { name: 'Hi, Gui' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign out/ })).toBeInTheDocument();

    mocks.getAuthenticatedSession.mockResolvedValue(fakeSession({ displayName: undefined }));
    render(await DashboardPage());
    expect(screen.getByRole('heading', { name: /Hi, there/ })).toBeInTheDocument();

    mocks.getAuthenticatedSession.mockResolvedValue(null);
    await expect(DashboardPage()).rejects.toThrow('redirect:/');
  });

  it('playlist page renders the playlist view for the ID in the URL', async () => {
    const { default: PlaylistPage } = await import('@/app/playlists/[id]/page');
    const element = (await PlaylistPage({ params: Promise.resolve({ id: 'p1' }) })) as ReactElement<{ playlistId: string }>;
    expect(isValidElement(element)).toBe(true);
    expect(element.props.playlistId).toBe('p1');
  });

  it('root layout sets the language, fonts and skip link', async () => {
    const { default: RootLayout, metadata } = await import('@/app/layout');
    const html = RootLayout({ children: <main id="main">content</main> }) as ReactElement<{ lang: string; className: string }>;
    expect(html.props.lang).toBe('en');
    expect(html.props.className).toContain('font-variable');
    expect(metadata.title).toBeTruthy();
  });
});
