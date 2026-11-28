import { useState } from 'react';
import { ME, personName, withPeople, type Account, type Backup } from '../account';
import { Title } from '../ui/Title';
import { isEmpty } from '../cloud/merge';

interface Props<S> {
  backup: Backup<S> | 'broken';
  /** What's on this device now, to say it's kept. */
  here: Account;
  hereMeasured: number;
  /** The piece open on the other device and its unit, in words: it comes along with the link. */
  opened: (backup: Backup<S>) => string;
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

/** A "Print from my computer" link opened on the other device: what it holds, then bring it here. */
export function MoveArrivalScreen<S>({ backup, here, hereMeasured, opened, onBring, onCarryOn, onNotNow }: Props<S>) {
  const [done, setDone] = useState(false);
  // Whether this device held anything before the work was brought: after, `here` is already the joined account.
  const [hadHere] = useState(() => here.patterns.length > 0 || hereMeasured > 0);
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
        {/* "Your work", both before and after: "HERE" alone read as a fault (pretend tester, Nov 18). */}
        <Title id="mvtitle" big="Your work" label={done ? 'is on this device' : 'arrived'} />
        {done ? (
          <>
            <p>
              Your measurements and patterns are on this device now
              {/* Joined without a word, a tester found ten measurements where the phone had seven (pretend tester, Nov 18). */}
              {hadHere ? ', together with what was already here. Where this device\u2019s measurements differ from the ones you brought, or add to them, the ones you brought are used as they came and the ones this device already had are kept apart, under \u201cMeasured here before\u201d.' : '.'} Anything you change here stays here, so send it back the same way if you need to.
            </p>
            <button type="button" className="primary" onClick={onCarryOn}>
              Carry on
            </button>
          </>
        ) : (
          <>
            <ul className="arrival-list">
              <li>{people.length === 1 && people[0] === 'you' ? 'Your measurements' : people.length ? `Measurements for ${people.join(', ')}` : 'No measurements yet'}</li>
              {/* None saved, the line is left off: "0 saved patterns" beside the skirt being brought read as if it were
                  lost (pretend tester DK walk, Nov 19). */}
              {patterns > 0 && (
                <li>
                  {patterns} saved {patterns === 1 ? 'pattern' : 'patterns'}
                </li>
              )}
              {/* The open piece and its unit come too, so they're listed: the list said "0 saved patterns" and the screen
                  then opened a piece and switched to inches (pretend tester, Nov 18). Only a link that carries work brings
                  them when this device has its own (see mergeBackups' workFromRemote). */}
              {(!isEmpty(acc) || isEmpty(here)) && <li>{opened(backup)}</li>}
              {/* The phone's tester code comes too, and lets this device in: the tester email warns a computer without it
                  shows the waitlist (pretend tester, Nov 18). */}
              {acc.testerCode && <li>Your tester code, which lets this device into the app</li>}
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
