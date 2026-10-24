/**
 * A screen title set as Cat's N1 Narrow Stack: the key words in big narrow capitals, the rest as a small
 * spaced label under them. The space between the parts keeps the heading's name reading as one line.
 */
export function Title({ id, big, label, hideLabel }: { id?: string; big: string; label?: string; hideLabel?: boolean }) {
  return (
    <h1 id={id}>
      <span className="t-big">{big}</span>
      {label && (
        <>
          {' '}
          <span className={hideLabel ? 'visually-hidden' : 't-label'}>{label}</span>
        </>
      )}
    </h1>
  );
}
