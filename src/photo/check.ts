// The self-check after a photo is drafted: the drawing of the garment on the form is turned into a picture,
// sent with the photo and the reading, and the reading comes back corrected once where the two differ.
import type { Choices } from '../savedWork';
import { isDress, type PatternChoices } from '../garments';
import { choicesFor, withBack, type PhotoBody } from './garments';
import type { BackReading, CheckResponse, PhotoReading, PieceKind } from './types';

/** What the self-check needs from the photo screen, kept in memory only while the app is open. */
export interface PhotoSource {
  image: string;
  mediaType: string;
  reading: PhotoReading;
  back?: BackReading;
  garment: PieceKind;
}

// The properties that give the drawing its look; the rest of the page's styles don't matter to a picture of it.
const DRAWN = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'display', 'visibility'];

/** The drawing as a PNG (base64, no data: prefix), its styles written onto it so it looks as it does on screen. */
export async function svgToPng(svg: SVGSVGElement, width = 640): Promise<string> {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const from = [svg, ...Array.from(svg.querySelectorAll('*'))];
  const to = [copy, ...Array.from(copy.querySelectorAll('*'))];
  from.forEach((el, i) => {
    const cs = getComputedStyle(el);
    (to[i] as SVGElement).setAttribute('style', DRAWN.map((k) => `${k}:${cs.getPropertyValue(k)}`).join(';'));
  });
  // The garment only: the hem's handle and length names are controls, not part of it.
  copy.querySelectorAll('.hem-marks').forEach((g) => g.remove());
  const box = svg.viewBox.baseVal;
  const height = Math.round((width * box.height) / box.width);
  copy.setAttribute('width', String(width));
  copy.setAttribute('height', String(height));
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((ok, fail) => {
      img.onload = () => ok();
      img.onerror = () => fail(new Error('drawing did not load'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png').split(',')[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Ask for the check. Any failure is quiet: the pattern stays as drafted. */
export async function requestCheck(src: PhotoSource, drawing: string, headers: Record<string, string>, signal?: AbortSignal): Promise<CheckResponse> {
  try {
    const res = await fetch('/.netlify/functions/analyze-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ view: 'check', image: src.image, mediaType: src.mediaType, drawing, reading: src.reading }),
      signal,
    });
    return (await res.json().catch(() => ({ ok: false, error: 'failed' }))) as CheckResponse;
  } catch {
    return { ok: false, error: 'failed' };
  }
}

/**
 * The garment from the corrected reading, with the back photo's details. A skirt laid flat keeps the length
 * the sewist chose for it, since the photo couldn't show where it ends on them.
 */
export function checkedChoices(r: PhotoReading, src: PhotoSource, now: PatternChoices, body?: PhotoBody): PatternChoices {
  const next = withBack(choicesFor(r, src.garment, body), src.back);
  if (r.worn !== false) return next;
  const keep = (from: Choices, to: Choices): Choices => ({
    ...to,
    length: from.length,
    ...(from.lengthCm !== undefined ? { lengthCm: from.lengthCm } : {}),
    ...(to.shape && from.shape ? { shape: { ...to.shape, hemAt: from.shape.hemAt } } : {}),
  });
  if (isDress(next) && isDress(now)) return { ...next, skirt: keep(now.skirt, next.skirt) };
  if (src.garment === 'skirt') return keep(now as Choices, next as Choices);
  return next;
}
