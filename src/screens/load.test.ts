import { afterEach, describe, expect, it, vi } from 'vitest';
import { partFile, reloadForNewRelease } from './load';

// The label sheet on the Print screen crashed for a tester (Nov 23): a release went out while the page was open, the
// reload started, and the label sheet's file came back empty.
describe('a file loaded for part of a screen', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('hands over the file when it arrives', async () => {
    await expect(partFile(Promise.resolve({ a: 1 }))).resolves.toEqual({ a: 1 });
  });

  it('is an error when it comes back empty with no reload under way', async () => {
    await expect(partFile(Promise.resolve(undefined))).rejects.toThrow('came back empty');
  });

  it('waits for the reload, with no error, when a new release is loading', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    vi.stubGlobal('window', { location: { reload: vi.fn() } });
    expect(reloadForNewRelease()).toBe(true);
    const settled = vi.fn();
    partFile(Promise.resolve(undefined)).then(settled, settled);
    await new Promise((r) => setTimeout(r, 20));
    expect(settled).not.toHaveBeenCalled();
  });
});
