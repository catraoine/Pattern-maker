// Asks the drape worker for a garment draped from its pattern, latest ask first; the answers are kept for the
// session, so turning back to a garment already seen is instant.
import type { DrapeJob, DrapedLite } from '../engine/drape/run';

let worker: Worker | undefined;
let next = 1;
const waiting = new Map<number, { resolve: (d: DrapedLite) => void; reject: (e: Error) => void }>();
const done = new Map<string, DrapedLite>();
const KEEP = 12;

function get(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('../engine/drape/worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<{ id: number; out?: DrapedLite; error?: string }>) => {
    const w = waiting.get(e.data.id);
    if (!w) return;
    waiting.delete(e.data.id);
    if (e.data.out) w.resolve(e.data.out);
    else w.reject(new Error(e.data.error ?? 'drape failed'));
  };
  return worker;
}

/** The key a job is kept under: its draft and choices, as data. */
export const drapeKey = (job: DrapeJob) => JSON.stringify(job);

export function cachedDrape(key: string): DrapedLite | undefined {
  return done.get(key);
}

export function requestDrape(job: DrapeJob, key = drapeKey(job)): Promise<DrapedLite> {
  const hit = done.get(key);
  if (hit) return Promise.resolve(hit);
  const id = next++;
  return new Promise<DrapedLite>((resolve, reject) => {
    waiting.set(id, {
      resolve: (d) => {
        done.set(key, d);
        if (done.size > KEEP) done.delete(done.keys().next().value as string);
        resolve(d);
      },
      reject,
    });
    try {
      get().postMessage({ id, job });
    } catch (e) {
      waiting.delete(id);
      reject(e as Error);
    }
  });
}

/** Jackets and coats are drawn sewn only with ?sewn=outer in the address (their lapels and collars are not yet at the
 *  bar, Cat 2026-11-01): until then they keep the earlier All round. */
export const sewnOuter = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).get('sewn') === 'outer';
  } catch {
    return false;
  }
};
