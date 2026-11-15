import { useEffect, useRef } from 'react';
import type { FormKind } from '../measurements';
import { FormPicture } from './ContourForm';
import { firstLightUp } from './lightsUp';

/** The first measuring page's picture (Cat's F1 Sculpted Form, Nov 14): the 3D form from the How to do it clips,
 *  shoulders to hip with no neck, the string tied at its waist and the knot showing, on a chalk panel. It is the first
 *  chalk of a visit, so the panel lights up from black, as Style's window did before. Rendered once from
 *  measure3d.html (the string clip, turned 0.6, distance 7) to public/measure-first/womenswear.webp. Menswear has no 3D
 *  render yet, so it keeps its line form, drawn dark on the same chalk. */
export function FirstForm({ kind }: { kind: FormKind }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (firstLightUp()) ref.current?.classList.add('lights-up');
  }, []);
  return (
    <div ref={ref} className={`first-form ${kind}`} aria-hidden="true">
      {kind === 'womenswear' ? <img src={`${import.meta.env.BASE_URL}measure-first/womenswear.webp`} alt="" draggable={false} /> : <FormPicture kind={kind} tapes />}
    </div>
  );
}
