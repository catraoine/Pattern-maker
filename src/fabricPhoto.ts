// The maker's own fabric, photographed (Design: Fabric, Nov 7): the photo is made into a repeating tile and kept in
// this device's photo store (photoStore.ts), never sent anywhere. Saved work holds only the tile's id, so on another
// device, or once the browser's storage is cleared, the drawing simply falls back to the fabric type picked.
import { useEffect, useState } from 'react';
import { getPhoto, putPhoto } from './photoStore';
import { evenLight, seamless } from './engine/fabricTile';
import { stripeLean } from './fabricStraight';

/** The tile's side in pixels: sharp on a phone at the drawing's scale, small enough to keep (about 60 KB). */
const N = 512;
/** The small grey copy the lean is read from. */
const LEAN_N = 128;

/** Each tile's address in this page, once loaded, so every drawing of it shares one and draws at once. */
const urls = new Map<string, string>();
const loading = new Map<string, Promise<string | undefined>>();

/** The house's own cloths, photographed (a look made in a real print: the leopard shirt dress, 2026-11-10): their
 * tiles ship with the app in public/prints/house, so they show on any device and never go near the photo store. */
const HOUSE = 'house-';
export const isHousePhoto = (id: string | undefined) => !!id && id.startsWith(HOUSE);
const houseUrl = (id: string) => `${import.meta.env.BASE_URL}prints/house/${id.slice(HOUSE.length)}.jpg`;

export const fabricPhotoUrl = (id: string | undefined) => (id ? (isHousePhoto(id) ? houseUrl(id) : urls.get(id)) : undefined);

function loadFabricPhoto(id: string): Promise<string | undefined> {
  const have = urls.get(id);
  if (have) return Promise.resolve(have);
  let p = loading.get(id);
  if (!p) {
    p = getPhoto(id).then(
      (blob) => {
        if (!blob) return undefined;
        const url = URL.createObjectURL(blob);
        urls.set(id, url);
        return url;
      },
      () => undefined,
    );
    loading.set(id, p);
  }
  return p;
}

/** The tile's address for a drawing, loading it from the photo store the first time; undefined until then. */
export function useFabricPhoto(id: string | undefined): string | undefined {
  const [, setLoaded] = useState(0);
  useEffect(() => {
    if (!id || isHousePhoto(id) || urls.has(id)) return;
    let live = true;
    void loadFabricPhoto(id).then(() => live && setLoaded((n) => n + 1));
    return () => {
      live = false;
    };
  }, [id]);
  return fabricPhotoUrl(id);
}

/** The photo as a repeating tile: the middle square (the edges of a phone photo are the softest and the most
 * shadowed), its broad light lifted out, its edges blended so it repeats with no line. */
async function fabricTile(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const short = Math.min(bmp.width, bmp.height);
  // A photo taken at a slant has its stripes leaning: read how far from a small grey copy of the middle, and draw the
  // tile turned back by it, so stripes down the cloth run straight down the garment (Cat's leopard cotton, Nov 14).
  const q = document.createElement('canvas');
  q.width = q.height = LEAN_N;
  const qg = q.getContext('2d', { willReadFrequently: true })!;
  qg.drawImage(bmp, (bmp.width - short * 0.9) / 2, (bmp.height - short * 0.9) / 2, short * 0.9, short * 0.9, 0, 0, LEAN_N, LEAN_N);
  const qd = qg.getImageData(0, 0, LEAN_N, LEAN_N).data;
  const lean = stripeLean(Array.from({ length: LEAN_N * LEAN_N }, (_, i) => (qd[i * 4] + qd[i * 4 + 1] + qd[i * 4 + 2]) / 3), LEAN_N);
  // (Turned, the square taken is smaller, so its corners stay inside the photo.)
  const side = (short * 0.9) / (Math.abs(Math.cos(lean)) + Math.abs(Math.sin(lean)));
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.translate(N / 2, N / 2);
  g.rotate(-lean);
  g.scale(N / side, N / side);
  g.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  g.setTransform(1, 0, 0, 1, 0, 0);
  // The light alone: the photo shrunk to a few pixels and drawn back up smooth.
  const s = document.createElement('canvas');
  s.width = s.height = 6;
  const sg = s.getContext('2d')!;
  sg.imageSmoothingQuality = 'high';
  sg.drawImage(c, 0, 0, 6, 6);
  const l = document.createElement('canvas');
  l.width = l.height = N;
  const lg = l.getContext('2d', { willReadFrequently: true })!;
  lg.imageSmoothingQuality = 'high';
  lg.drawImage(s, 0, 0, N, N);
  const im = g.getImageData(0, 0, N, N);
  evenLight({ data: im.data, n: N }, lg.getImageData(0, 0, N, N).data);
  seamless({ data: im.data, n: N });
  g.putImageData(im, 0, 0);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('no tile'))), 'image/jpeg', 0.88));
}

/** Makes and keeps a fabric photo; its id for saved work. In a private window the store may refuse it: it still
 * shows for this visit. Undefined when the photo can't be read at all. */
export async function saveFabricPhoto(file: Blob): Promise<string | undefined> {
  try {
    const tile = await fabricTile(file);
    const id = `fabric-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    await putPhoto(id, tile).catch(() => false);
    urls.set(id, URL.createObjectURL(tile));
    return id;
  } catch {
    return undefined;
  }
}
