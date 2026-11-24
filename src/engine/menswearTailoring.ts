// What a tailor cuts differently for a man, on the menswear form (the menswear fit audit, Nov 22; Cat: "Build both").
// The menswear trousers and jacket were the womenswear cuts with the bust shaping left out: a dart in each trouser
// front and none at the back, and a jacket buttoned five or six times from the chest down. They fitted, and read as
// a women's cut to anyone who sews menswear. In testing behind the menswear link until toiles confirm them.

/**
 * Trousers: the front is cut flat, with no dart. Up to `toBack` cm of what its dart took in moves to the back's
 * waist, where a dart over each back pocket takes it (the side seam at the waist then sits that much toward the back,
 * as on a man's trouser); anything more comes off the front's side seam. One back dart, `dart` cm long (`weltDart`
 * with a welt pocket under it), unless it would be wider than a dart can press flat, when the back keeps its two.
 */
export const MENS_TROUSER = { toBack: 1.5, dart: 11, weltDart: 9.5 };

/**
 * A single-breasted jacket with lapels: the lapel breaks `aboveWaist` cm above the waist and the front fastens with
 * `buttons` buttons `gap` cm apart, the classic two-button stance, where it broke at the chest and buttoned to the hem.
 */
export const MENS_STANCE = { aboveWaist: 2, buttons: 2, gap: 11 };

/**
 * The smaller points of the menswear fit audit (Nov 22), each a tailor's habit the womenswear cut does not share.
 * A jacket sleeve stops `sleeveShorter` cm sooner, at the wrist bone, so a little shirt cuff shows below it. A shirt's
 * neck seam is drafted `neckCloser` cm smaller, so a buttoned collar sits 2 cm bigger than the neck and not 3. A shirt
 * has `shirtEase` cm more room round the chest, waist and hem than a blouse of the same fit (Regular is then 10 cm, where a
 * blouse's 7 read as a slim fit on a man). And the sleeve is pleated into its cuff, not gathered.
 */
export const MENS_POINTS = { sleeveShorter: 1.5, neckCloser: 0.9, shirtEase: 3 };
