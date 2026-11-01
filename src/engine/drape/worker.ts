// The drape runs here, off the page's thread: settling the cloth takes a second or two, and the page stays live.
import { DrapeJob, rehydrate, runDrape } from './run';

self.onmessage = (e: MessageEvent<{ id: number; job: DrapeJob }>) => {
  const { id, job } = e.data;
  try {
    const out = runDrape(rehydrate(job));
    (self as unknown as Worker).postMessage({ id, out }, [out.pos.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
