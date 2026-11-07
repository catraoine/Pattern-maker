// The Garment range's designs for the automated checks (2026-11-07): each option of the knit dress, hoodie and
// jumpsuit on its own from the starting Look, and the fifteen Looks Cat kept from the option sheet.
import type { Garment } from './measurements';
import type { Saved } from './savedWork';
import {
  DEFAULT_HOODIE_CHOICES,
  DEFAULT_JUMPSUIT_CHOICES,
  DEFAULT_KNIT_DRESS_CHOICES,
  HOODIE_GROUPS,
  HOODIE_LOOKS,
  JUMPSUIT_GROUPS,
  JUMPSUIT_LOOKS,
  KNIT_DRESS_GROUPS,
  KNIT_DRESS_LOOKS,
  type JumpsuitChoices,
  validJumpsuit,
} from './garmentRange';

interface RangeDesign {
  key: string;
  garment: Garment;
  saved: Partial<Saved>;
}

const value = (v: string) => (v === 'true' ? true : v === 'false' ? false : v);

export function rangeDesigns(): RangeDesign[] {
  const out: RangeDesign[] = [];
  for (const g of KNIT_DRESS_GROUPS)
    for (const [o] of g.options) out.push({ key: `knit dress ${g.id}=${o}`, garment: 'knit_dress', saved: { knitDress: { ...DEFAULT_KNIT_DRESS_CHOICES, [g.id]: value(o) } as Saved['knitDress'] } });
  for (const g of HOODIE_GROUPS)
    for (const [o] of g.options) out.push({ key: `hoodie ${g.id}=${o}`, garment: 'hoodie', saved: { hoodie: { ...DEFAULT_HOODIE_CHOICES, [g.id]: value(o) } as Saved['hoodie'] } });
  for (const g of JUMPSUIT_GROUPS)
    for (const [o] of g.options) {
      const c = validJumpsuit({ ...DEFAULT_JUMPSUIT_CHOICES, [g.id]: o } as JumpsuitChoices);
      // An option the default can't take (a collar on a cami) is tried on the boiler suit instead.
      const on = (c as unknown as Record<string, unknown>)[g.id] === o ? c : validJumpsuit({ ...JUMPSUIT_LOOKS[0].choices, [g.id]: o } as JumpsuitChoices);
      if ((on as unknown as Record<string, unknown>)[g.id] !== o) continue;
      out.push({ key: `jumpsuit ${g.id}=${o}`, garment: 'jumpsuit', saved: { jumpsuit: on } });
    }
  for (const l of KNIT_DRESS_LOOKS) out.push({ key: `knit dress look ${l.code}`, garment: 'knit_dress', saved: { knitDress: l.choices } });
  for (const l of HOODIE_LOOKS) out.push({ key: `hoodie look ${l.code}`, garment: 'hoodie', saved: { hoodie: l.choices } });
  for (const l of JUMPSUIT_LOOKS) out.push({ key: `jumpsuit look ${l.code}`, garment: 'jumpsuit', saved: { jumpsuit: l.choices } });
  return out;
}
