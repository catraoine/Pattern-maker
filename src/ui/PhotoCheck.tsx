import { useEffect, useRef, useState } from 'react';
import type { PatternChoices } from '../garments';
import { checkedChoices, requestCheck, svgToPng, type PhotoSource } from '../photo/check';
import type { PhotoBody } from '../photo/garments';

type State = { kind: 'checking' } | { kind: 'changed'; changes: string[]; before: PatternChoices } | { kind: 'same' } | { kind: 'quiet' };

/** How long to wait for the drawing to appear before letting the check go. */
const WAIT_MS = 6000;

/** The garment's drawing on the form, once the style screen has drawn it. */
async function drawing(): Promise<SVGSVGElement | null> {
  const end = Date.now() + WAIT_MS;
  while (Date.now() < end) {
    const svg = document.querySelector<SVGSVGElement>('main svg.form-still');
    if (svg && svg.querySelector('path')) return svg;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

/**
 * The self-check, just after a photo is drafted: the drawing of the garment is compared with the photo and
 * the pattern corrected once where they differ, with a way to undo it. If anything goes wrong it says
 * nothing and the pattern stays as drafted.
 */
export function PhotoCheck({ source, current, body, headers, onChoices }: { source: PhotoSource; current: PatternChoices; body?: PhotoBody; headers: Record<string, string>; onChoices: (c: PatternChoices) => void }) {
  const [state, setState] = useState<State>({ kind: 'checking' });
  // The latest pattern, read when the answer comes back, without starting the check again.
  const now = useRef(current);
  now.current = current;
  const apply = useRef(onChoices);
  apply.current = onChoices;

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const svg = await drawing();
      if (!svg || ctrl.signal.aborted) return setState({ kind: 'quiet' });
      let png: string;
      try {
        png = await svgToPng(svg);
      } catch {
        return setState({ kind: 'quiet' });
      }
      const res = await requestCheck(source, png, headers, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (!res.ok || res.reading.garment === 'none') return setState({ kind: 'quiet' });
      const changes = res.changes.map((c) => c.trim()).filter(Boolean);
      if (!changes.length) return setState({ kind: 'same' });
      const before = now.current;
      apply.current(checkedChoices(res.reading, source, before, body));
      setState({ kind: 'changed', changes, before });
    })();
    return () => ctrl.abort();
    // Once per photo: the source is new each time a photo is drafted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  if (state.kind === 'quiet') return null;
  return (
    <div className="photo-check" role="status">
      {state.kind === 'checking' && <p className="muted small">Checking the drawing against your photo…</p>}
      {state.kind === 'same' && <p className="small">Checked against your photo: it matches.</p>}
      {state.kind === 'changed' && (
        <>
          <div>
            <p className="eyebrow">Checked against your photo</p>
            <p className="small">{`Changed: ${state.changes.join(', ')}.`}</p>
          </div>
          <button
            type="button"
            className="link small"
            onClick={() => {
              apply.current(state.before);
              setState({ kind: 'quiet' });
            }}
          >
            Undo
          </button>
        </>
      )}
    </div>
  );
}
