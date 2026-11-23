import { worded, type FormKind } from './measurements';
import type { Printable } from './screens/ExportScreen';

// The printed pattern's words on the menswear form. The drafts are the womenswear blocks with the bust shaping left
// out, so their notes, steps and marks spoke of the bust on a man's shirt and jacket ("FINISHED BUST 107 CM", "press
// over a ham at the bust": the menswear fit audit, Nov 22). They are said of the chest here, once, after the pattern
// is made, so every check that reads the pattern still finds the words it knows.

/** A line said of the chest, capitals and all. */
const said = (s: string) => worded(s, 'menswear').replace(/\bBUST\b/g, 'CHEST');

/** The printed pattern as the menswear form words it; the womenswear form's is handed back untouched. */
export function formWords(made: Printable, form: FormKind | undefined): Printable {
  if (form !== 'menswear') return made;
  return {
    ...made,
    notes: made.notes.map(said),
    // The steps' titles and words only: a step's drawing is named by an id, which stays as it is.
    guide: { ...made.guide, ...(made.guide.fabric ? { fabric: made.guide.fabric.map(said) } : {}), notions: made.guide.notions.map(said), steps: made.guide.steps.map((st) => ({ ...st, title: said(st.title), text: said(st.text) })) },
    spec: made.spec.map((r) => ({ ...r, label: said(r.label), ...(typeof r.finished === 'string' ? { finished: said(r.finished) } : {}) })),
    pieces: made.pieces.map((pc) => ({
      ...pc,
      ...(pc.finished ? { finished: pc.finished.map((f) => ({ ...f, title: said(f.title), note: said(f.note) })) } : {}),
      ...(pc.draft ? { draft: { ...pc.draft, points: pc.draft.points.map((pt) => ({ ...pt, note: said(pt.note) })) } } : {}),
    })),
  };
}
