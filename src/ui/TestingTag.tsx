import { IN_TESTING } from '../launch';

/** The quiet "In testing" chip beside a feature that is usable but frozen until the fit gate (docs/SHIP-LIST.md). */
export function TestingTag() {
  return <span className="testing-tag chip">{IN_TESTING}</span>;
}
