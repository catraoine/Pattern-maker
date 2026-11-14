// The signed-in person's Founding Atelier place, asked of the server whenever someone signs in. Signed out, or when the
// check fails, there is no place: a founding member who can't be checked just isn't let in early yet (fails closed).
import { useEffect, useState } from 'react';
import type { FoundingPlace } from '../founding';
import { cloud, type CloudUser } from './api';

export type Founding = { state: 'none' } | { state: 'checking' } | { state: 'failed' } | { state: 'member'; place: FoundingPlace } | { state: 'not-listed' };

/** The place, and a way to ask again after a check that failed. */
export function useFounding(user: CloudUser | null | undefined): [Founding, () => void] {
  const [founding, setFounding] = useState<Founding>({ state: 'none' });
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (!user) return setFounding({ state: 'none' });
    let live = true;
    setFounding({ state: 'checking' });
    cloud()
      .then((api) => api.founding())
      .then((place) => live && setFounding(place ? { state: 'member', place } : { state: 'not-listed' }))
      .catch(() => live && setFounding({ state: 'failed' }));
    return () => {
      live = false;
    };
  }, [user?.email, tries]); // eslint-disable-line react-hooks/exhaustive-deps -- asked again only when a different person signs in, or on Try again
  return [founding, () => setTries((n) => n + 1)];
}
