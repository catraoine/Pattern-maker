// The drape runs here, off the page's thread: settling the cloth takes a second or two, and the page stays live.
import { DrapeJob, rehydrate, runDrape } from './run';
import { setKnob } from './knob';

self.onmessage = (e: MessageEvent<{ id: number; job: DrapeJob; knobs?: Record<string, number> }>) => {
  const { id, job, knobs } = e.data;
  try {
    // A test page's tuning knobs (window.__drapeKnobs), carried over from the page.
    for (const [k, v] of Object.entries(knobs ?? {})) setKnob(k, v);
    const out = runDrape(rehydrate(job));
    (self as unknown as Worker).postMessage({ id, out }, [out.pos.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
