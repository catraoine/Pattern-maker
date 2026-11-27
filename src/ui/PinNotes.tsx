import { useEffect, useRef, useState } from 'react';
import { sendNote } from '../help/note';
import { HoldWatch, holdsItsOwn, pinFor, pinLine, spotAt, type Pin } from '../help/pin';
import { REPLY_EMAIL, REPLY_EMAIL_MAX } from '../help/replyEmail';
import { OWNER } from '../legal';
import { onPhone } from './device';
import { TestingTag } from './TestingTag';

/** The screen's name as the tester knows it, for the pinned line. */
const SCREEN_NAME: Record<string, string> = { welcome: 'Welcome', measure: 'Measure', steps: 'Measuring', style: 'Style', photo: 'Photo', export: 'Print', sew: 'Sew', fitting: 'Fitting', scale: 'True scale', account: 'Your account', collection: 'Collection', help: 'Help', client: 'Client book', form: 'Your form' };
const screenName = (view: string) => SCREEN_NAME[view] ?? `${view[0]?.toUpperCase() ?? ''}${view.slice(1)}`;

interface Props {
  /** The screen showing now, sent as the note's screen. */
  view: string;
  /** The garment open now, by its name in the app (or its look's name). Only said on screens about a garment. */
  garment?: string;
  /** Names this device holds, taken out of what the pin says (namesToHide). */
  hide: readonly string[];
}

type Sending = 'idle' | 'sending' | 'sent' | 'limit' | 'busy' | 'failed' | 'bademail';

/**
 * Hold to leave a note, on a tester's device only (Cat, Nov 26: "Hold to drop a pin"). Hold a finger still on any spot
 * and a ring fills; at half a second Help & feedback opens pinned there. On a computer, a right click does the same,
 * and Shift with the right click still gives the browser's own menu. Holds on typing, sliders, dragging and drawing
 * keep doing what they always did (holdsItsOwn).
 */
export function PinNotes({ view, garment, hide }: Props) {
  const [ring, setRing] = useState<{ x: number; y: number }>();
  const [pin, setPin] = useState<{ x: number; y: number; pin: Pin; view: string }>();
  // Read inside the page's listeners, which are added once.
  const now = useRef({ view, garment, hide, open: false });
  now.current = { view, garment, hide, open: !!pin };
  // The tap a finger makes as it lifts after a hold, swallowed so it doesn't also press what was under it.
  const swallowUntil = useRef(0);

  useEffect(() => {
    const open = (x: number, y: number, el: Element) => {
      setRing(undefined);
      if (now.current.open) return;
      const { view: v, garment: g, hide: names } = now.current;
      // Text a long press started to pick on a phone, let go, so the box opens clean.
      window.getSelection?.()?.removeAllRanges();
      swallowUntil.current = Date.now() + 800;
      setPin({ x, y, view: v, pin: pinFor(spotAt(el, x, y, v, names), x, y, v, g, onPhone(), window.innerWidth, window.innerHeight) });
    };
    const watch = new HoldWatch({ ring: (x, y) => setRing({ x, y }), done: open, stop: () => setRing(undefined) });
    const down = (e: PointerEvent) => (now.current.open ? undefined : watch.start(e, e.target instanceof Element ? e.target : null));
    const move = (e: PointerEvent) => watch.move(e);
    const end = (e: PointerEvent) => watch.end(e);
    const scrolled = () => watch.cancel();
    const menu = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      // Android's own menu, arriving just after our hold already opened the box: kept off it.
      if (now.current.open && Date.now() < swallowUntil.current) return e.preventDefault();
      // Android's own long press: ours, if the finger was still on a spot we take (the watch was holding it).
      if (watch.finishNow()) return e.preventDefault();
      if (now.current.open || e.shiftKey || holdsItsOwn(el) || !el) return;
      // A right click with a mouse or trackpad. A touch that reaches here moved or landed somewhere we leave alone.
      if ((e as PointerEvent).pointerType === 'touch' || onPhone()) return;
      e.preventDefault();
      open(e.clientX, e.clientY, el);
    };
    const click = (e: MouseEvent) => {
      if (Date.now() > swallowUntil.current) return;
      if (e.target instanceof Element && e.target.closest('.pin-layer')) return;
      e.preventDefault();
      e.stopPropagation();
      swallowUntil.current = 0;
    };
    // Capture, so a garment view that keeps its own pointer events (All round turning) is still watched.
    const opts = { capture: true, passive: true } as const;
    window.addEventListener('pointerdown', down, opts);
    window.addEventListener('pointermove', move, opts);
    window.addEventListener('pointerup', end, opts);
    window.addEventListener('pointercancel', end, opts);
    window.addEventListener('scroll', scrolled, opts);
    window.addEventListener('contextmenu', menu, true);
    window.addEventListener('click', click, true);
    // The phone's copy and save-picture menu stays off drawings and buttons, so the hold is ours there (48-pin-notes.css).
    document.documentElement.classList.add('pin-notes');
    return () => {
      watch.cancel();
      window.removeEventListener('pointerdown', down, opts);
      window.removeEventListener('pointermove', move, opts);
      window.removeEventListener('pointerup', end, opts);
      window.removeEventListener('pointercancel', end, opts);
      window.removeEventListener('scroll', scrolled, opts);
      window.removeEventListener('contextmenu', menu, true);
      window.removeEventListener('click', click, true);
      document.documentElement.classList.remove('pin-notes');
    };
  }, []);

  return (
    <>
      {ring && !pin && <span className="pin-ring" style={{ left: ring.x, top: ring.y }} aria-hidden="true" />}
      {pin && <PinBox at={pin} onClose={() => setPin(undefined)} />}
    </>
  );
}

function PinBox({ at, onClose }: { at: { x: number; y: number; pin: Pin; view: string }; onClose: () => void }) {
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<Sending>('idle');

  useEffect(() => {
    // Closes the box only: caught first, so an enlarged sketch or sewing mode under it stays open.
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [onClose]);

  // Beside the pin on a computer, kept on screen; a phone gets a sheet along the bottom instead (48-pin-notes.css).
  const w = window.innerWidth;
  const h = window.innerHeight;
  const side = at.x + 16 + 360 < w ? at.x + 16 : Math.max(16, at.x - 16 - 360);
  const top = Math.min(Math.max(16, at.y - 40), Math.max(16, h - 520));

  return (
    <div className="pin-layer" role="presentation">
      <button type="button" className="pin-shade" aria-label="Close the note" onClick={onClose} />
      <span className="pin-dot" style={{ left: at.x, top: at.y }} aria-hidden="true" />
      <form
        // On a phone the sheet sits on the half of the screen away from the pin, so the spot stays in sight.
        className={`pin-box card${at.y > h * 0.5 ? ' pin-up' : ''}`}
        // A phone's sheet is only as tall as the room on its side of the pin (it scrolls inside), never over the spot.
        style={{ '--pin-left': `${side}px`, '--pin-top': `${top}px`, '--pin-room': `${Math.max(h * 0.4, at.y > h * 0.5 ? at.y - 28 : h - at.y - 28)}px` } as React.CSSProperties}
        aria-labelledby="pintitle"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (!note.trim() || state === 'sending') return;
          if (email.trim() && !REPLY_EMAIL.test(email.trim())) return setState('bademail');
          setState('sending');
          setState(await sendNote(note, at.view, { email, tester: true, pin: at.pin }));
        }}
      >
        <div className="help-top">
          <p className="eyebrow" id="pintitle">
            Help &amp; feedback <TestingTag tool="pin_notes" />
          </p>
          <button type="button" className="link" onClick={onClose}>
            Close
          </button>
        </div>
        {state === 'sent' ? (
          <>
            <p>{email.trim() ? 'Your note is in. We’ll reply by email.' : 'Your note is in. Thank you.'}</p>
            <button type="button" className="secondary sm" onClick={onClose}>
              Done
            </button>
          </>
        ) : (
          <>
            <p className="pin-where small">
              <span className="muted">Pinned: </span>
              {pinLine(at.pin, screenName(at.view))}
            </p>
            <div className="field plain">
              <label htmlFor="pinnote">What’s happening here, or what would make it better?</label>
              {/* Focused at once: the hold already said they mean to write. */}
              <textarea id="pinnote" rows={4} maxLength={2000} autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="field plain">
              <label htmlFor="pinemail">Your email, if you’d like a reply</label>
              <input id="pinemail" type="email" autoComplete="email" inputMode="email" maxLength={REPLY_EMAIL_MAX} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <p className="help-added">Added for you: this spot, that you’re a fit tester, your phone or computer and the app version.</p>
            {at.pin.device === 'computer' && <p className="help-added">Need your browser’s own menu? Hold Shift as you right click.</p>}
            <button type="submit" className="primary" disabled={!note.trim() || state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Send'}
            </button>
            {state === 'failed' && (
              <p className="msg small" role="status">
                That didn’t go through. Check you’re online and try again.
              </p>
            )}
            {state === 'limit' && (
              <p className="msg small" role="status">
                That’s the most notes we can take from you today. Please send more tomorrow, or email {OWNER.email}.
              </p>
            )}
            {state === 'busy' && (
              <p className="msg small" role="status">
                We’ve had a lot of notes today. Please try again tomorrow, or email {OWNER.email}.
              </p>
            )}
            {state === 'bademail' && (
              <p className="msg small" role="status">
                That email doesn’t look right. Check it, or leave it empty to send the note without a reply.
              </p>
            )}
          </>
        )}
      </form>
    </div>
  );
}
