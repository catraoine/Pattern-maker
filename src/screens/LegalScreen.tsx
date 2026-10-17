import { useEffect } from 'react';
import { Block, LegalDoc, OWNER } from '../legal';

interface Props {
  doc: LegalDoc;
  onOther: () => void;
  otherLabel: string;
}

function Paragraph({ text }: { text: string }) {
  const [lead, rest] = text.includes('|') ? text.split('|') : [undefined, text];
  return (
    <p>
      {lead && <strong>{lead} </strong>}
      {rest}
    </p>
  );
}

function Part({ block }: { block: Block }) {
  if (typeof block === 'string') return <Paragraph text={block} />;
  if (Array.isArray(block))
    return (
      <ul className="legal-list">
        {block.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    );
  const [head, ...rows] = block.table;
  return (
    <div className="legal-table">
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) => (
                <td key={i}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The Privacy Policy or the Terms of Use, opened from the welcome's fine print and from Your account. */
export function LegalScreen({ doc, onOther, otherLabel }: Props) {
  useEffect(() => window.scrollTo(0, 0), [doc]);
  return (
    <article className="card legal" aria-labelledby="ltitle">
      <p className="eyebrow">Maison Tracé</p>
      <h1 id="ltitle">{doc.title}</h1>
      <p className="lead">{doc.intro}</p>
      {doc.sections.map((s, i) => (
        <section key={s.heading}>
          <h2>
            {i + 1}. {s.heading}
          </h2>
          {s.body.map((b, j) => (
            <Part key={j} block={b} />
          ))}
        </section>
      ))}
      <p className="muted small">Effective date: {OWNER.effective}</p>
      <div className="row wrap">
        <button type="button" className="link" onClick={onOther}>
          Read the {otherLabel}
        </button>
      </div>
    </article>
  );
}
