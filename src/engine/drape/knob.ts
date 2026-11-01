// Tuning knobs a test page can set on the window (e.g. __lam = 14) to try a drape setting without a rebuild.
// The app never sets them, so each falls back to its default.
const g = globalThis as unknown as Record<string, unknown>;

export function knob(name: string): number | undefined {
  const v = g[name];
  return typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : undefined;
}

export function setKnob(name: string, v: unknown): void {
  g[name] = v;
}
