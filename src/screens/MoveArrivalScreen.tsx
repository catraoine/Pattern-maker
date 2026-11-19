import { useState } from 'react';
import { ME, personName, withPeople, type Account, type Backup } from '../account';
import { Title } from '../ui/Title';
import { isEmpty } from '../cloud/merge';

interface Props<S> {
  backup: Backup<S> | 'broken';
  /** What's on this device now, to say it's kept. */
  here: Account;
  hereMeasured: number;
  /** Put the backup on this device, joined with what's here. */
  onBring: (backup: Backup<S>) => void;
  /** Carry on: the print screen when the measurements are there, else measuring. */
  onCarryOn: () => void;
  onNotNow: () => void;
}

const when = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

/** A "Send to my computer" link opened on the other device: what it holds, then bring it here. */
export function MoveArrivalScreen<S>({ backup, here, hereMeasured, onBring, onCarryOn, onNotNow }: Props<S>) {
  const [done, setDone] = useState(false);
  if (backup === 'broken')
    return (
      <div className="stack wide arrival">
        <section className="card" aria-labelledby="mvtitle">
          <Title id="mvtitle" big="Link" label="incomplete" />
          <p>Part of this link went missing on the way. Send it again from your phone, and copy the whole link if you paste it.</p>
          <button type="button" className="secondary" onClick={onNotNow}>
            Open the app
          </button>
        </section>
      </div>
    );
  const acc = withPeople(backup.account);
  const measured = acc.people.filter((p) => Object.keys(p.values).length);
  const people = measured.map((p) => (p.id === ME ? 'you' : personName(acc, p)));
  const patterns = acc.patterns.length;
  const hasHere = here.patterns.length > 0 || hereMeasured > 0;
  const sent = when(backup.savedAt);
  return (
    <div className="stack wide arrival">
      <section className="card" aria-labelledby="mvtitle">
        <p className="eyebrow">From your other device</p>
        <Title id="mvtitle" big={done ? 'Here' : 'Your work'} label={done ? 'on this device' : 'arrived'} />
        {done ? (
          <>
            <p>Your measurements and patterns are on this device now. Anything you change here stays here, so send it back the same way if you need to.</p>
            <button type="button" className="primary" onClick={onCarryOn}>
              Carry on
            </button>
          </>
        ) : (
          <>
            <ul className="arrival-list">
              <li>{people.length === 1 && people[0] === 'you' ? 'Your measurements' : people.length ? `Measurements for ${people.join(', ')}` : 'No measurements yet'}</li>
              <li>
                {patterns} saved {patterns === 1 ? 'pattern' : 'patterns'}
              </li>
              {sent && <li>Sent {sent}</li>}
            </ul>
            {/* Said as it is: saved work and measurements are kept, but the piece open here gives way to the one brought
                (pretend tester, Nov 18: "nothing is lost", and an unsaved Blush Shift was). */}
            {hasHere && (
              <p className="msg small">
                Everything saved on this device is kept too, measurements included.
                {/* Only a link that carries work takes over the open piece (see mergeBackups' workFromRemote). */}
                {!isEmpty(acc) && <> The piece open here is swapped for the one you&rsquo;re bringing, so save it first if you want to keep it.</>}
              </p>
            )}
            <button
              type="button"
              className="primary"
              onClick={() => {
                onBring(backup);
                setDone(true);
              }}
            >
              Bring it here
            </button>
            <button type="button" className="link quiet" onClick={onNotNow}>
              Not now
            </button>
          </>
        )}
      </section>
    </div>
  );
}
