// Sentences more than one garment's sewing steps share, kept in one place so every garment says them the same way.

/** How a dart ends, said before the darts are sewn: it read last, after every dart was already stitched (sewing
 *  instructions review, Nov 28). */
export const DART_POINT = 'At the point of every dart, run the stitching off the fold and knot the threads: backstitching there leaves a pucker.';

/** How an invisible zip goes in. The step named the zip and where it ends and no more, the barest step in the booklet
 *  for the part most sewists find hardest (sewing instructions review, Nov 28). */
export const INVISIBLE_ZIP_LAY = ' Open the zip and press its coils flat with a cool iron. Lay each tape face down on the right side of its edge, the coils on the stitching line, and sew close beside them with an invisible zip foot, from the top down to where the opening ends.';

/** The seam under an invisible zip is started with the other foot. A zip that runs to the hem has no seam below it,
 *  and a side zip's seam is sewn before the zip goes in. */
export const SEAM_BELOW_ZIP = ' Change to an ordinary zip foot for the seam below.';

/** A neckline binding on a garment with no opening: the neckline is a closed ring, so the binding goes all the way round
 *  from a shoulder seam and has no ends to fold in. */
export const boundAllRound = (text: string) =>
  text.replace('and 1 cm extra at each end', 'and starting at a shoulder seam, all the way round').replace('Fold the ends in, then turn', 'Where the ends meet, fold the top end under and lap it 1 cm over the other, then turn');
