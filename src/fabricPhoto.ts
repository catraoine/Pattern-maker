// The maker's own fabric, photographed (Design: Fabric, Nov 7): the photo is made into a repeating tile and kept in
// this device's photo store (photoStore.ts), never sent anywhere. Saved work holds only the tile's id, so on another
// device, or once the browser's storage is cleared, the drawing simply falls back to the fabric type picked.
import { useEffect, useState } from 'react';
import { getPhoto, putPhoto } from './photoStore';
import { evenLight, seamless } from './engine/fabricTile';

/** The tile's side in pixels: sharp on a phone at the drawing's scale, small enough to keep (about 60 KB). */
const N = 512;

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
  const side = Math.min(bmp.width, bmp.height) * 0.9;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, N, N);
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
