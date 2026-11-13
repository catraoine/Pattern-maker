import { createContext, useContext, type ReactNode } from 'react';
import type { Garment } from '../measurements';
import { DropMenu } from './DropMenu';

/** Opens the Maison collection; given on the style screens, so their Looks tab can offer it. */
export const CollectionLink = createContext<(() => void) | undefined>(undefined);

/** The garment being styled, and the ways on from it the title's drop-down offers: start a new garment (keeping
 *  this one in Saved patterns first) and open Saved patterns. Given by the app on the style screens. */
export const GarmentPick = createContext<{ garment: Garment; onNew: () => void; onSaved: () => void } | undefined>(undefined);

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

/** The Style title's drop-down. It was the list of garments (Cat applied, 2026-10-24); since Cat's pick on Nov 12 it
 *  is the four ways to start or find a piece: "Start a new garment", the Maison Tracé collection, a photo, and Saved
 *  patterns. Without the app's context, a new garment opens the full list with pictures. */
export function GarmentDrop({ label, onChoose, onPhoto }: { label?: string; onChoose: () => void; onPhoto?: () => void }) {
  const pick = useContext(GarmentPick);
  const openCollection = useContext(CollectionLink);
  return (
    <DropMenu
      name="Garment"
      className="garment-drop"
      value={label}
      items={[
        { id: 'new', text: 'Start a new garment ›' },
        ...(openCollection ? [{ id: 'collection', text: 'Maison Tracé collection ›' }] : []),
        ...(onPhoto ? [{ id: 'photo', text: 'Start from a photo ›' }] : []),
        ...(pick ? [{ id: 'saved', text: 'My saved patterns ›' }] : []),
      ]}
      onPick={(id) => (id === 'collection' ? openCollection?.() : id === 'photo' ? onPhoto?.() : id === 'saved' ? pick?.onSaved() : pick ? pick.onNew() : onChoose())}
    />
  );
}
