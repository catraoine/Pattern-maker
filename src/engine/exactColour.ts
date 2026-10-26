// Fabric in the exact colour picked (Cat's X1, 2026-10-26). Spoonflower prints any uploaded image, so a square of
// one colour becomes solid fabric in that colour. Its print files are 150 dpi.

export const SPOONFLOWER_URL = 'https://www.spoonflower.com/';

const DPI = 150;
const INCHES = 8;

/** The colour file we hand the sewist: its name and size. */
export function exactColourFile(hex: string): { name: string; px: number; inches: number } {
  return { name: `maison-trace-${hex.replace('#', '').toUpperCase()}.png`, px: DPI * INCHES, inches: INCHES };
}
