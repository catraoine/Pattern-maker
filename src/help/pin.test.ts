import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkNote } from '../server/notes';
import { HOLD_MS, HoldWatch, MOVE_PX, RING_MS, namesToHide, pinFor, pinLine, region, scrub } from './pin';

// No page in these tests: a spot is a stand-in that matches whatever `closest` is told to (the page itself is walked in
// e2e/pin-notes.spec.ts).
const spot = (own = false) => ({ closest: () => (own ? {} : null) }) as unknown as Element;

const touch = (pointerId: number, clientX: number, clientY: number) => ({ pointerId, pointerType: 'touch', clientX, clientY, button: 0 });

describe('the hold', () => {
  let ring: ReturnType<typeof vi.fn<(x: number, y: number) => void>>;
  let done: ReturnType<typeof vi.fn<(x: number, y: number, el: Element) => void>>;
  let stop: ReturnType<typeof vi.fn<() => void>>;
  let watch: HoldWatch;
  const el = () => spot();
  beforeEach(() => {
    vi.useFakeTimers();
    ring = vi.fn<(x: number, y: number) => void>();
    done = vi.fn<(x: number, y: number, el: Element) => void>();
    stop = vi.fn<() => void>();
    watch = new HoldWatch({ ring, done, stop });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens after a finger is held still, with the ring first, at the spot it went down', () => {
    const at = el();
    watch.start(touch(1, 100, 200), at);
    vi.advanceTimersByTime(RING_MS - 1);
    expect(ring).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(ring).toHaveBeenCalledWith(100, 200);
    watch.move(touch(1, 100 + MOVE_PX - 2, 202));
    vi.advanceTimersByTime(HOLD_MS - RING_MS);
    expect(done).toHaveBeenCalledWith(100, 200, at);
  });

  it('does nothing for a quick tap, a drag, a scroll or a pinch', () => {
    watch.start(touch(1, 100, 200), el());
    vi.advanceTimersByTime(HOLD_MS - 100);
    watch.end(touch(1, 100, 200));
    // Turning the garment always moves the finger further than this.
    watch.start(touch(2, 100, 200), el());
    watch.move(touch(2, 100 + MOVE_PX + 1, 200));
    // A scroll on the phone ends the touch.
    watch.start(touch(3, 50, 50), el());
    watch.cancel();
    // A second finger is a pinch.
    watch.start(touch(4, 50, 50), el());
    watch.start(touch(5, 90, 90), el());
    vi.advanceTimersByTime(HOLD_MS * 2);
    expect(done).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });

  it('leaves a mouse to its right click, and holds the app keeps for itself (typing, sliders, drawing) to it', () => {
    watch.start({ ...touch(1, 10, 10), pointerType: 'mouse' }, el());
    watch.start(touch(2, 10, 10), spot(true));
    vi.advanceTimersByTime(HOLD_MS * 2);
    expect(done).not.toHaveBeenCalled();
  });

  it('takes the phone’s own long press as the hold, only while a finger is held', () => {
    expect(watch.finishNow()).toBe(false);
    const at = el();
    watch.start(touch(1, 30, 40), at);
    expect(watch.finishNow()).toBe(true);
    expect(done).toHaveBeenCalledWith(30, 40, at);
    vi.advanceTimersByTime(HOLD_MS * 2);
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe('the spot', () => {
  it('never carries numbers, so a measurement on screen is never sent', () => {
    expect(scrub('Bust 92.5 cm, waist 74')).toBe('Bust # cm, waist #');
    expect(scrub('  Sleeve\n   length  ')).toBe('Sleeve length');
    expect(scrub('x'.repeat(80))).toHaveLength(50);
  });

  it('says where in a drawing in words', () => {
    expect(region(0.5, 0.5)).toBe('centre');
    expect(region(0.5, 0.9)).toBe('lower middle');
    expect(region(0.1, 0.1)).toBe('upper left');
    expect(region(0.9, 0.5)).toBe('middle right');
  });

  it('makes a pin the server takes, with the garment only on screens about one', () => {
    const at = { spot: 'Knee', section: 'Length', showing: 'All round' };
    const pin = pinFor(at, 195, 422, 'style', 'Blush Shift', true, 390, 844);
    expect(pin).toEqual({ ...at, x: 0.5, y: 0.5, garment: 'Blush Shift', device: 'phone', screen: '390x844' });
    expect(pinFor(at, 10, 10, 'account', 'Blush Shift', false, 1440, 900)).not.toHaveProperty('garment');
    expect(pinLine(pin, 'Style')).toBe('Blush Shift · Knee · Length · All round view · Style screen');
    const note = { note: 'The hem dips at the back here.', view: 'style', version: '0.1.0+abc1234', browser: 'Safari 18 iOS', tester: true, pin };
    expect(checkNote(JSON.stringify(note))).toEqual(note);
  });
});

describe('the server', () => {
  const base = { note: 'Here.', view: 'style', version: '0.1.0', browser: 'Chrome' };
  const pin = { spot: 'Knee', x: 0.2, y: 0.3, device: 'computer', screen: '1440x900' };
  it('turns away a pin with numbers in its words, places off the screen, or anything extra', () => {
    expect(checkNote(JSON.stringify({ ...base, pin }))).not.toBeNull();
    expect(checkNote(JSON.stringify({ ...base, pin: { ...pin, spot: 'Bust 92 cm' } }))).toBeNull();
    expect(checkNote(JSON.stringify({ ...base, pin: { ...pin, x: 1.5 } }))).toBeNull();
    expect(checkNote(JSON.stringify({ ...base, pin: { ...pin, device: 'tablet' } }))).toBeNull();
    expect(checkNote(JSON.stringify({ ...base, pin: { ...pin, name: 'A sewist' } }))).toBeNull();
    expect(checkNote(JSON.stringify({ ...base, pin: { ...pin, screen: 'big' } }))).toBeNull();
  });
});

describe('the pinned line', () => {
  it('says the garment and the view once, when the drawing already names them', () => {
    const pin = pinFor({ spot: 'Knee A-line skirt, front view, centre', showing: 'Front' }, 10, 10, 'style', 'skirt', false, 1280, 800);
    expect(pinLine(pin, 'Style')).toBe('Knee A-line skirt, front view, centre · Style screen');
  });
});

describe('names', () => {
  it('takes out the names this device holds and any email, but not everyday words', () => {
    const hide = namesToHide(['Anna', 'Me', ' ', undefined, 'Studio Rosa', 'Anna']);
    expect(hide).toEqual(['Anna', 'Studio Rosa']);
    expect(scrub('Your account (Anna)', 50, hide)).toBe('Your account (a name)');
    expect(scrub('Drafted for anna, from Studio Rosa', 50, hide)).toBe('Drafted for a name, from a name');
    expect(scrub('Annabel’s skirt', 50, hide)).toBe('Annabel’s skirt');
    expect(scrub('Signed in as someone@example.com', 50, hide)).toBe('Signed in as an email');
    expect(scrub('Measure me', 50, hide)).toBe('Measure me');
  });
});
