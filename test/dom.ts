/**
 * Setup for component tests. Import it first in any test that renders React, together with
 * the `// @vitest-environment jsdom` comment at the top of the file.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { createElement, type ImgHTMLAttributes } from 'react';
import { afterEach, vi } from 'vitest';

afterEach(cleanup);

// next/image needs the Next.js image loader; a plain <img> is enough to test behavior.
type NextImageProps = ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean };

vi.mock('next/image', () => ({
  default: (props: NextImageProps) => {
    const imgProps = { ...props };
    delete imgProps.fill;
    delete imgProps.priority;
    return createElement('img', imgProps);
  },
}));

// jsdom has no media playback; previews just need play/pause to exist.
Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: vi.fn().mockResolvedValue(undefined) });
Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() });

// jsdom has no layout, so there is nothing to observe.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
