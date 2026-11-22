/** Print in three parts (declutter, Cat's E, Nov 21): the page was one long list, so its cards sit under Print it,
 *  Cut it and Sew it, in the order they're done. Nothing moved; the parts only name what was already there. */
export function PartHead({ n, title, id }: { n: number; title: string; id?: string }) {
  return (
    <div className="print-part">
      <p className="eyebrow">Part {n}</p>
      <h2 id={id}>{title}</h2>
    </div>
  );
}
