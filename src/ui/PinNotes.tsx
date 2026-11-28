import { useCallback, useEffect, useRef, useState } from 'react';
import { sendNote } from '../help/note';
import { CONTROL, HoldWatch, holdsItsOwn, pinFor, spotAt, type Pin } from '../help/pin';
import { REPLY_EMAIL, REPLY_EMAIL_MAX } from '../help/replyEmail';
import { OWNER } from '../legal';
import { onPhone } from './device';

/** The box's width on a computer (48-pin-notes.css). */
const BOX_W = 360;

const EMAIL_KEY = 'maison-trace-note-email';
const keptEmail = () => {
  try {
    return localStorage.getItem(EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
};
const keepEmail = (email: string) => {
  try {
    // Cleared before sending: forgotten too, so the next note doesn't ask for a reply they no longer want.
    if (email) localStorage.setItem(EMAIL_KEY, email);
    else localStorage.removeItem(EMAIL_KEY);
  } catch {
    // Storage blocked: they type it again next time.
  }
};

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
  const [pin, setPin] = useState<Placed>();
  // Kept the same across renders, so the thank-you's timer isn't started again by every render above it.
  const close = useCallback(() => setPin(undefined), []);
  // Read inside the page's listeners, which are added once.
  const now = useRef({ view, garment, hide, open: false });
  now.current = { view, garment, hide, open: !!pin };
  // The tap a finger makes as it lifts after a hold, swallowed so it doesn't also press what was under it.
  const swallowUntil = useRef(0);

  useEffect(() => {
    // `touch`: a finger held, whose lift may send a tap; a right click sends none, so nothing is swallowed after it.
    const open = (x: number, y: number, el: Element, touch = true) => {
      setRing(undefined);
      if (now.current.open) return;
      const { view: v, garment: g, hide: names } = now.current;
      // Text a long press started to pick on a phone, let go, so the box opens clean.
      window.getSelection?.()?.removeAllRanges();
      swallowUntil.current = touch ? Date.now() + 800 : 0;
      setPin({ x, y, view: v, clear: clearOf(el) ?? { left: x, right: x }, pin: pinFor(spotAt(el, x, y, v, names), x, y, v, g, onPhone(), window.innerWidth, window.innerHeight) });
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
      open(e.clientX, e.clientY, el, false);
    };
    const click = (e: MouseEvent) => {
      if (Date.now() > swallowUntil.current) return;
      // Only the box itself takes taps: the dimmed background would close the box on the lift that ends the hold.
      if (e.target instanceof Element && e.target.closest('.pin-box')) return;
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
      {pin && <PinBox at={pin} onClose={close} />}
    </>
  );
}

/** A held spot, and the box it shouldn't cover. */
interface Placed {
  x: number;
  y: number;
  pin: Pin;
  view: string;
  clear: { left: number; right: number };
}

/** What the box should leave in sight: the control held (a chip, a button), or failing that the list the spot is in (the
 *  pieces on Print, where the box covered every line at 1366, the Nov 27 cold read). Only one the box fits beside counts;
 *  a drawing or anything wide keeps just the pin itself clear. */
function clearOf(el: Element) {
  const w = window.innerWidth;
  for (const c of [el.closest(CONTROL), el.closest('ul, ol, dl, table')]) {
    const r = c?.getBoundingClientRect();
    if (r && r.width < w / 2 && (r.right + 16 + BOX_W <= w - 16 || r.left - 16 - BOX_W >= 16)) return { left: r.left, right: r.right };
  }
  return undefined;
}

function PinBox({ at, onClose }: { at: Placed; onClose: () => void }) {
  const [note, setNote] = useState('');
  // The email given once is kept on this device, so a tester who wants replies isn't asked every time.
  const [email, setEmail] = useState(keptEmail);
  const [state, setState] = useState<Sending>('idle');
  // How much of the window a phone's keyboard covers, so the sheet along the bottom rides above it with Send in sight
  // (360 wide, the Nov 27 cold read: Send sat on the bottom edge, where the keyboard opens).
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const fit = () => setKeyboard(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    fit();
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    return () => {
      vv.removeEventListener('resize', fit);
      vv.removeEventListener('scroll', fit);
    };
  }, []);

  // Sent: the thank-you shows a moment, then the box goes by itself.
  useEffect(() => {
    if (state !== 'sent') return;
    keepEmail(email.trim());
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [state, email, onClose]);

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
  const side = at.clear.right + 16 + BOX_W <= w - 16 ? at.clear.right + 16 : at.clear.left - 16 - BOX_W >= 16 ? at.clear.left - 16 - BOX_W : Math.max(16, at.x - 16 - BOX_W);
  const top = Math.min(Math.max(16, at.y - 40), Math.max(16, h - 520));

  return (
    <div className="pin-layer" role="presentation">
      {/* Pressing it never takes the typing away from the note: the tap a phone sends as the hold lifts lands here. */}
      <button type="button" className="pin-shade" aria-label="Close the note" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={onClose} />
      <span className="pin-dot" style={{ left: at.x, top: at.y }} aria-hidden="true" />
      <form
        // On a phone the sheet sits on the half of the screen away from the pin, so the spot stays in sight.
        className={`pin-box card${at.y > h * 0.5 ? ' pin-up' : ''}`}
        // A phone's sheet is only as tall as the room on its side of the pin (it scrolls inside), never over the spot.
        style={{ '--pin-left': `${side}px`, '--pin-top': `${top}px`, '--pin-room': `${Math.max(h * 0.4, at.y > h * 0.5 ? at.y - 28 : h - at.y - 28)}px`, '--pin-kb': `${keyboard}px` } as React.CSSProperties}
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
            Help &amp; feedback
          </p>
          <button type="button" className="link pin-x" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        {state === 'sent' ? (
          <p role="status">{email.trim() ? 'Thank you. We’ll reply by email.' : 'Thank you. We read every note.'}</p>
        ) : (
          <>
            {/* One question and an optional email, nothing else to read first (Cat, Nov 27: "way too cluttered", then A1). The spot, garment and device
                still go with the note, out of sight. */}
            <div className="field plain">
              <textarea id="pinnote" rows={4} maxLength={2000} autoFocus aria-label="What’s happening here?" placeholder="What’s happening here?" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {/* Always in sight and plainly optional (Cat's pick A1, Nov 27); kept on this device once given. */}
            <div className="field plain">
              <input type="email" autoComplete="email" inputMode="email" maxLength={REPLY_EMAIL_MAX} aria-label="Email for a reply (optional)" placeholder="Email for a reply (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
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
                That email doesn’t look right. Check it, or clear it to send the note without a reply.
              </p>
            )}
          </>
        )}
      </form>
    </div>
  );
}
