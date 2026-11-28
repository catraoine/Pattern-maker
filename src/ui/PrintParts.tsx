/** Print in three parts (declutter, Cat's E, Nov 21): the page was one long list, so its cards sit under Print it,
 *  Cut it and Sew it, in the order they're done. Nothing moved; the parts only name what was already there. No "Part 2"
 *  over the name (Cat, Nov 28: "What's the point of part 1"): the three verbs already say the order. */
export function PartHead({ title, id }: { title: string; id?: string }) {
  return (
    <div className="print-part">
      <h2 id={id}>{title}</h2>
    </div>
  );
}
