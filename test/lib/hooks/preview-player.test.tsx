// @vitest-environment jsdom
import '@/test/dom';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAudioAnalysis } from '@/lib/hooks/use-audio-analysis';
import { usePreviewPlayer } from '@/lib/hooks/use-preview-player';
import { enrich, makeTrack } from '@/test/factories';

const api = vi.hoisted(() => ({ preview: vi.fn(), analyze: vi.fn() }));
vi.mock('@/lib/api/tracks-api', () => ({ tracksApi: api }));

const URL_A = 'https://cdnt-preview.dzcdn.net/a.mp3';

function setup() {
  const audio = document.createElement('audio');
  const hook = renderHook(() => usePreviewPlayer());
  hook.result.current.audioRef.current = audio;
  return { audio, hook };
}

describe('usePreviewPlayer', () => {
  it('does nothing until the audio element is mounted', async () => {
    const { result } = renderHook(() => usePreviewPlayer());
    await act(() => result.current.toggle(makeTrack()));
    expect(api.preview).not.toHaveBeenCalled();
  });

  it('plays, stops on a second click and reuses the URL it already found', async () => {
    api.preview.mockResolvedValue({ url: URL_A });
    const { audio, hook } = setup();
    const track = makeTrack();

    await act(() => hook.result.current.toggle(track));
    expect(audio.src).toBe(URL_A);
    expect(hook.result.current.stateOf(track.id)).toBe('playing');

    await act(() => hook.result.current.toggle(track));
    expect(hook.result.current.stateOf(track.id)).toBe('idle');

    await act(() => hook.result.current.toggle(track));
    expect(api.preview).toHaveBeenCalledTimes(1);
    act(() => hook.result.current.onEnded());
    expect(hook.result.current.stateOf(track.id)).toBe('idle');
  });

  it('marks a track without a preview when the lookup fails', async () => {
    api.preview.mockRejectedValue(new Error('offline'));
    const { hook } = setup();
    const track = makeTrack({ artists: [] });
    await act(() => hook.result.current.toggle(track));
    expect(hook.result.current.stateOf(track.id)).toBe('unavailable');
    expect(api.preview).toHaveBeenCalledWith(expect.objectContaining({ artist: '' }));
  });

  it('forgets a URL that fails to play, so the next click looks it up again', async () => {
    api.preview.mockResolvedValue({ url: URL_A });
    const { audio, hook } = setup();
    vi.spyOn(audio, 'play').mockRejectedValueOnce(new Error('expired'));
    const track = makeTrack();

    await act(() => hook.result.current.toggle(track));
    expect(hook.result.current.stateOf(track.id)).toBe('idle');
    await act(() => hook.result.current.toggle(track));
    expect(api.preview).toHaveBeenCalledTimes(2);
  });

  it('ignores a slow lookup or play when another track was clicked meanwhile', async () => {
    let resolveFirst!: (value: { url: string }) => void;
    api.preview.mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve))).mockResolvedValue({ url: URL_A });
    const { audio, hook } = setup();
    const first = makeTrack();
    const second = makeTrack();

    let firstClick!: Promise<void>;
    act(() => {
      firstClick = hook.result.current.toggle(first);
    });
    await act(() => hook.result.current.toggle(second));
    await act(async () => {
      resolveFirst({ url: 'https://cdnt-preview.dzcdn.net/old.mp3' });
      await firstClick;
    });
    expect(audio.src).toBe(URL_A);
    expect(hook.result.current.stateOf(second.id)).toBe('playing');

    let rejectPlay!: (error: Error) => void;
    vi.spyOn(audio, 'play').mockReturnValueOnce(new Promise((_, reject) => (rejectPlay = reject)));
    const third = makeTrack();
    let thirdClick!: Promise<void>;
    await act(async () => {
      thirdClick = hook.result.current.toggle(third);
      await Promise.resolve();
    });
    await act(() => hook.result.current.toggle(second));
    await act(async () => {
      rejectPlay(new Error('interrupted'));
      await thirdClick;
    });
    expect(hook.result.current.stateOf(second.id)).toBe('playing');
  });
});

describe('useAudioAnalysis', () => {
  it('asks to analyze tracks without audio data, once per track', async () => {
    api.analyze.mockResolvedValue({ features: {} });
    const nameless = makeTrack({ artists: [] });
    const tracks = [enrich(nameless), enrich(nameless)];
    renderHook(() => useAudioAnalysis(tracks));
    await waitFor(() =>
      expect(api.analyze).toHaveBeenCalledWith([{ trackId: nameless.id, isrc: null, title: nameless.name, artist: '' }]),
    );
  });
});
