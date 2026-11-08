import { knob } from './knob';

/**
 * How far apart a skirt's cloth is kept from itself (sim.ts `self`), in cm, from the most flared of its panels (hem
 * length over waist length). A long full circle's hem is eight or more times its waist (about 11 at maxi), and its
 * folds come round on each other from every side: kept only 2 cm apart they still slipped through one another (crossed
 * 15-70); 4 cm held them. A half circle maxi (about 6) or a short circle (about 5) held 4 cm apart stretched instead,
 * so they keep 2 (2026-11-08).
 */
export function selfGap(flare: number): number {
  return knob('__selfD') ?? (flare >= (knob('__selfWideAt') ?? 8) ? 4 : 2);
}

/**
 * The least flare (hem over waist) at which a skirt under a waist seam dropped onto the hip is held apart. Held apart,
 * a flared cotton skirt there stood out in a ledge, so only a circle's is. Silk and viscose (bend under 0.04) fold far
 * more freely, and an A-line mini under a dropped seam folded through itself (the How it works film's snakeskin dress,
 * crossed 14), so theirs are held apart from a quarter as long again, like any flared skirt (2026-11-08).
 */
export function droppedFlareCut(bendK: number): number {
  return bendK < 0.04 && !knob('__noSoftDrop') ? 1.25 : 1.5;
}
