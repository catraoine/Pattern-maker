import { createContext, useContext, type ReactNode } from 'react';
import { inTesting, IN_TESTING } from '../launch';
import { GARMENT_NAME, GARMENTS } from '../measureFlow';
import type { Garment } from '../measurements';
import { DropMenu } from './DropMenu';

/** Opens the Maison collection; given on the style screens, so their Looks tab can offer it. */
export const CollectionLink = createContext<(() => void) | undefined>(undefined);

/** The garment being styled and a way to switch straight to another (measuring first when it needs more); given by
 *  the app on the style screens, so the title's drop-down can offer the list. */
export const GarmentPick = createContext<{ garment: Garment; onSwitch: (g: Garment) => void } | undefined>(undefined);

/** "Drafted to an example body · Measure me", given by the app on Style so the layout can set it under the name. */
export const ExampleTag = createContext<ReactNode>(undefined);

/** You stay in what you picked to make; this quiet link opens the list to pick something else. */
export function GarmentSwitch({ onChoose, label = 'Choose another garment' }: { onChoose: () => void; label?: string }) {
  return (
    <button type="button" className="later go garment-change" onClick={onChoose}>
      {label}
    </button>
  );
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** The Style title's drop-down (Cat applied, 2026-10-24): "Your skirt" with the garments under it, launched ones
 *  first, and the full list with pictures at the end. Without the app's switch it opens that list for any pick.
 *  Start from a look (a photo, the collection) is its first line since Cat's K3 (2026-10-28). */
export function GarmentDrop({ label, onChoose, onLooks }: { label?: string; onChoose: () => void; onLooks?: () => void }) {
  const pick = useContext(GarmentPick);
  const order = [...GARMENTS.filter((g) => !inTesting(g)), ...GARMENTS.filter(inTesting)];
  return (
    <DropMenu
      name="Garment"
      className="garment-drop"
      value={label}
      items={[
        ...(onLooks ? [{ id: 'looks', text: 'Start from a look ›' }] : []),
        ...order.map((g) => ({ id: g, text: cap(GARMENT_NAME[g]), on: pick?.garment === g, note: inTesting(g) ? IN_TESTING : undefined })),
        { id: 'all', text: 'See them all ›' },
      ]}
      onPick={(id) => (id === 'looks' ? onLooks?.() : pick && id !== 'all' ? id !== pick.garment && pick.onSwitch(id as Garment) : onChoose())}
    />
  );
}

/**
 * The Looks tab's way into the Maison collection, where it is offered: the quiet link alone. The row of four
 * photographs that sat above it (the parked AI-model looks) came out on 2026-10-31 (design quality review, gap 2):
 * no AI people anywhere in the app; real photographs return here after the first shoot.
 */
export function CollectionEntry() {
  const openCollection = useContext(CollectionLink);
  if (!openCollection) return null;
  return (
    <div className="collection-entry">
      <button type="button" className="secondary" onClick={openCollection}>
        Start from the Maison collection
      </button>
    </div>
  );
}
