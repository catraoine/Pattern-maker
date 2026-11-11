import { useEffect, useRef, useState } from 'react';

// The measuring clips on the 3D form (Cat, Nov 11): one per measurement, shown at the top of its "How to do it"
// sheet. Recorded from measure3d.html; the files live in public/measure-clips.
const CLIPS = new Set([
  'waist', 'full_hip', 'waist_to_hip', 'front_waist_to_hip', 'back_waist_to_hip', 'waist_to_knee', 'waist_to_floor', 'crotch_depth', 'crotch_length',
  'full_bust', 'high_bust', 'neck', 'shoulder_width', 'shoulder_length', 'across_back', 'across_front', 'nape_to_waist', 'front_hps_to_waist', 'bust_depth',
  'apex_separation', 'front_shoulder_slope', 'back_shoulder_slope', 'armscye', 'upper_arm', 'wrist', 'arm_length',
]);

/** The clips to play for a measurement, in order: the waist starts with the string being tied round it. */
function clipsFor(id: string): string[] {
  if (!CLIPS.has(id)) return [];
  return id === 'waist' ? ['string', 'waist'] : [id];
}

/** Plays a measurement's clips one after another, round again, muted. With reduced motion it waits for a tap. */
export function HowClip({ id }: { id: string }) {
  const list = clipsFor(id);
  const [at, setAt] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => setAt(0), [id]);
  // The sheet's Got it button takes the focus as it opens, which scrolls a tall sheet to its foot: back to the top,
  // so the clip is seen first.
  useEffect(() => {
    const panel = ref.current?.closest('.how-panel');
    const t = setTimeout(() => panel?.scrollTo({ top: 0 }), 0);
    return () => clearTimeout(t);
  }, [id]);
  useEffect(() => {
    const v = ref.current;
    if (v && !still && at > 0) void v.play().catch(() => undefined);
  }, [at, still]);
  if (!list.length) return null;
  const name = list[Math.min(at, list.length - 1)];
  return (
    <video
      key={name}
      ref={ref}
      className="how-clip"
      src={`/measure-clips/${name}.mp4`}
      muted
      playsInline
      autoPlay={!still || at > 0}
      controls={still}
      preload="auto"
      aria-label="How to take this measurement, shown on a dress form"
      onEnded={() => setAt((a) => (a + 1) % list.length)}
    />
  );
}
