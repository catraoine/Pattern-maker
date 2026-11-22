import type { ReactNode } from 'react';
import type { Garment } from '../measurements';

// A small line drawing on each tile of "What would you like to make?" (desktop review, Nov 20): the list was eleven
// boxes of words, the plainest screen in the app, straight after the form and the tape. The drawings are decoration:
// each tile keeps its name as its words, so a screen reader and every test still find it by name.

const PICS: Record<Garment | 'other', ReactNode> = {
  skirt: (
    <>
      <path d="M14 9h12l6 31H8z" />
      <path className="pic-faint" d="M14 12h12" />
    </>
  ),
  dress: <path d="M15 4q5 6 10 0l2.5 4q-2 5-1 10l6 26H7.5l6-26q1-5-1-10z" />,
  bodice: <path d="M14 8q6 7 12 0l3 4q-2 5-1 10v14H12V22q1-5-1-10z" />,
  trousers: (
    <>
      <path d="M11 5h18l2.5 39h-8.5L20 20l-3 24H8.5z" />
      <path className="pic-faint" d="M11 8.5h18" />
    </>
  ),
  tee: <path d="M14 8q6 5 12 0l9.5 6-3.5 6.5-4-2.5V40H12V18l-4 2.5L4.5 14z" />,
  knit_dress: <path d="M14 4q6 5 12 0l8 4.5 2 22-4.5.5-2.5-17 3 30H10l3-30-2.5 17-4.5-.5 2-22z" />,
  hoodie: (
    <>
      <path d="M13 13l-7 4-2 23.5 5 .5 2.5-19V42h17V22l2.5 19 5-.5-2-23.5-7-4" />
      <path d="M13 13q-1.5-9.5 7-9.5t7 9.5q-7 5-14 0z" />
      <path className="pic-faint" d="M15 32h10v6H15z" />
    </>
  ),
  jumpsuit: (
    <>
      <path d="M15 3q5 6 10 0l2.5 4q-2 5-1 10l3 28h-7.5L20 26l-2 19h-7.5l3-28q1-5-1-10z" />
      <path className="pic-faint" d="M13.5 17h13" />
    </>
  ),
  jacket: (
    <>
      <path d="M14 7l6 8 6-8 7 4 3 22-5 1-2.5-15V36h-17V19L9 34l-5-1 3-22z" />
      <path className="pic-faint" d="M20 15v21" />
    </>
  ),
  coat: (
    <>
      <path d="M14 4l6 8 6-8 7 4 3 26-5 1-2.5-19 1.5 29h-20l1.5-29L9 35l-5-1 3-26z" />
      <path className="pic-faint" d="M20 12v33" />
    </>
  ),
  lingerie: <path d="M12 6l3 10q5 4 10 0l3-10M15 16l-3 8q8 5 16 0l-3-8M10 32h20l-6 10h-8z" />,
  // Something else: an outline still to be drawn.
  other: (
    <>
      <path className="pic-faint" d="M14 8q6 7 12 0l3 4q-2 5-1 10l4 20H8l4-20q1-5-1-10z" />
      <path d="M20 21v10M15 26h10" />
    </>
  ),
};

export function MakePic({ garment }: { garment: Garment | 'other' }) {
  return (
    <svg className="make-pic" viewBox="0 0 40 48" aria-hidden="true" focusable="false">
      {PICS[garment]}
    </svg>
  );
}
