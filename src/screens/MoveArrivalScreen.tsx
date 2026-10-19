import { useState } from 'react';
import { ME, personName, withPeople, type Account, type Backup } from '../account';
import { Title } from '../ui/Title';

interface Props<S> {
  backup: Backup<S> | 'broken';
  /** What's on this device now, to warn before it's replaced. */
  here: Account;
  hereMeasured: number;
  /** Put the backup on this device. */
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
            {hasHere && <p className="msg small">This replaces the measurements and patterns already on this device.</p>}
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
