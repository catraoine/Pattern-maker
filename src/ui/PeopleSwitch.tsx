import { useState } from 'react';
import { Account, Person, personName } from '../account';

/** Whose measurements are in use: one button per person, plus a way to add someone new. */
export function PeopleSwitch({
  account,
  onSwitch,
  onAdd,
  startAdding = false,
}: {
  account: Account & { people: Person[]; active: string };
  onSwitch: (id: string) => void;
  onAdd: (name: string) => void;
  startAdding?: boolean;
}) {
  const [adding, setAdding] = useState(startAdding);
  const [name, setName] = useState('');
  const add = () => {
    if (!name.trim()) return;
    onAdd(name);
    setName('');
    setAdding(false);
  };

  return (
    <div className="people">
      <div className="seg people-seg" role="group" aria-label="Whose measurements">
        {account.people.map((p) => (
          <button key={p.id} type="button" aria-pressed={account.active === p.id} className={account.active === p.id ? 'on' : ''} onClick={() => onSwitch(p.id)}>
            {personName(account, p)}
          </button>
        ))}
      </div>
      {adding ? (
        <form
          className="row people-add"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label htmlFor="person-name" className="small">Name</label>
          <input id="person-name" className="inline" autoComplete="off" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="secondary sm" disabled={!name.trim()}>
            Add
          </button>
          <button type="button" className="link" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" className="link" onClick={() => setAdding(true)}>
          Add someone
        </button>
      )}
    </div>
  );
}
