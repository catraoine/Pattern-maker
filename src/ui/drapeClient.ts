// Asks the drape worker for a garment draped from its pattern, latest ask first; the answers are kept for the
// session, so turning back to a garment already seen is instant.
import type { DrapeJob, DrapedLite } from '../engine/drape/run';
import type { Piece } from '../engine/piece';
import { hasNewPieces, sewnForAllRound } from '../engine/pieceEdit';

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
  // A worker that dies (out of memory, a failed load) answers nobody: every waiting ask is turned back, so its All round
  // shows the Front drawing, and the next ask starts a fresh worker.
  worker.onerror = worker.onmessageerror = () => {
    const ws = [...waiting.values()];
    waiting.clear();
    worker?.terminate();
    worker = undefined;
    for (const w of ws) w.reject(new Error('drape worker failed'));
  };
  return worker;
}

/** The key a job is kept under: its draft and choices, as data. */
export const drapeKey = (job: DrapeJob) => JSON.stringify(job);

export function cachedDrape(key: string): DrapedLite | undefined {
  return done.get(key);
}

/** The job with new pieces sewn back into the pieces they came off, for the cloth. */
function sewnJob(job: DrapeJob): DrapeJob {
  const draft = job.draft as { pieces?: Piece[]; skirt?: { pieces?: Piece[] } };
  const all = [...(draft.pieces ?? []), ...(draft.skirt?.pieces ?? [])];
  if (!hasNewPieces(all)) return job;
  const next = { ...draft } as typeof draft;
  if (draft.pieces) next.pieces = sewnForAllRound(draft.pieces);
  if (draft.skirt?.pieces) next.skirt = { ...draft.skirt, pieces: sewnForAllRound(draft.skirt.pieces) };
  return { ...job, draft: next } as DrapeJob;
}

/** Jobs still sewing, by key: the same design asked for again while it sews waits for that sewing, rather than queueing
 *  a second one behind it (the view asked up to three times as a style screen settled; the phone weight check,
 *  2026-11-10). */
const sewing = new Map<string, Promise<DrapedLite>>();

export function requestDrape(job: DrapeJob, key = drapeKey(job)): Promise<DrapedLite> {
  const hit = done.get(key);
  if (hit) return Promise.resolve(hit);
  const already = sewing.get(key);
  if (already) return already;
  const p = sewOnce(job, key);
  sewing.set(key, p);
  const clear = () => sewing.delete(key);
  p.then(clear, clear);
  return p;
}

function sewOnce(job: DrapeJob, key: string): Promise<DrapedLite> {
  // A piece the maker cut off with Draw a line is sewn back to the piece it came off, its seam drawn on the cloth
  // (Design: Pattern tools round 3, Cat 2026-11-07): sewn, a yoke with its darts closed hangs as the piece with its
  // darts sewn. Anything still unsewn falls back to the Front drawing, as any design that can't be sewn does.
  job = sewnJob(job);
  const draft = job.draft as { pieces?: Piece[]; skirt?: { pieces?: Piece[] } };
  if (hasNewPieces([...(draft.pieces ?? []), ...(draft.skirt?.pieces ?? [])])) return Promise.reject(new Error('a new piece is not sewn in All round yet'));
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
      get().postMessage({ id, job, knobs: (globalThis as unknown as { __drapeKnobs?: Record<string, number> }).__drapeKnobs });
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
    const s = new URLSearchParams(window.location.search).get('sewn');
    return s === 'outer' || s === 'all' || !!(window as unknown as { __sewnOuter?: boolean }).__sewnOuter;
  } catch {
    return false;
  }
};

/** ?sewn=all shows the cloth view even when its score failed (a check by eye of what the score turns back, never for
 *  makers): the All round eye check, Sewist Fit Testing 2026-11-02. */
export const sewnAnyway = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).get('sewn') === 'all';
  } catch {
    return false;
  }
};
