// One plain line for every Style choice, shown under its section for whatever is picked (Cat's E2 Line
// Under Pick, 2026-10-18), so a beginner learns what a choice does just by tapping it. A tag says when a
// choice is a good first make or takes more skill; most choices have neither.

export type Skill = 'easy' | 'skill';
export type ExplainSet = 'skirt' | 'bodice' | 'tee' | 'trousers' | 'outer';
type Line = readonly [text: string, skill?: Skill];

export const SKILL_WORDS: Record<Skill, string> = { easy: 'Easy', skill: 'More skill' };

const FIT: Record<string, Line> = {
  fitted: ['Close to the body, with just enough room to move. Fit matters more, so make a test version first.', 'skill'],
  regular: ['The everyday fit: room to sit, reach and breathe without looking loose.', 'easy'],
  relaxed: ['Loose and easy to wear, and the most forgiving to fit.', 'easy'],
};

const EXPLAIN: Record<ExplainSet, Record<string, Record<string, Line>>> = {
  skirt: {
    fit: FIT,
    silhouette: {
      pencil: ['Narrows from the hip to the hem for a close, sleek line. A slit at the back hem lets you walk.'],
      straight: ['Falls straight down from the hip like a column. Simple and easy to wear.', 'easy'],
      a_line: ['Fitted at the waist and widening evenly to the hem, like the letter A. The classic first skirt.', 'easy'],
      gathered: ['Straight panels gathered into the waistband, so it puffs softly out from the waist and swings. The easiest skirt to sew.', 'easy'],
      trumpet: ['Close over the hips and thighs, then flares out low down, like the bell of a trumpet.', 'skill'],
      half_circle: ['Cut as half a circle, so it falls in soft folds and swings as you move.'],
      circle: ['Cut as a full circle for the most swing and twirl. Uses the most fabric.'],
      slip: ['Cut on the diagonal of the fabric, so it skims the body and moves like liquid. Best in silky fabrics.', 'skill'],
    },
    length: {
      mini: ['Ends well above the knee, around mid-thigh.'],
      above_knee: ['Ends just above the knee: short but easy to wear every day.'],
      knee: ['Ends at the knee. The easiest length to sit and walk in.'],
      midi: ['Ends halfway down the calf.'],
      maxi: ['Ends near the ankle. Uses the most fabric.'],
    },
    noSeam: {
      seam: ['A bodice and a skirt joined at the waist, so you pick the skirt’s shape.', 'easy'],
      sheath: ['Cut in one from shoulder to hem, darted in at the waist and close over the hips.', 'skill'],
      shift: ['Cut in one from shoulder to hem, hanging straight from the bust with no waist shaping.', 'easy'],
    },
    asymHem: {
      none: ['The hem is the same length all the way round.', 'easy'],
      high_low: ['Shorter at the front and longer at the back, curving between.'],
      diagonal: ['The hem slants from one side to the other.', 'skill'],
    },
    slit: {
      none: ['No slit: the seams run closed to the hem.', 'easy'],
      back: ['A slit up the centre back seam. A short one is the walking slit a narrow skirt needs.', 'easy'],
      side: ['A slit up the left side seam, from a short split to a high leg slit.', 'easy'],
      front: ['A slit up the centre front, so the front is cut in two with a seam.', 'easy'],
    },
    volume: {
      none: ['A plain skirt with nothing added.', 'easy'],
      knife: ['Folds that all face one way, pressed flat at the waist and opening as you walk.'],
      box: ['Folds that face away from each other, making flat panels with a neat, tailored look.'],
      inverted: ['Two folds that meet in the middle, so the pleat opens out from inside.'],
      godets: ['Triangles of fabric set into the seams near the hem to add flare where you want it.', 'skill'],
      hem_flounce: ['A curved band of fabric sewn to the hem, so it ripples out at the bottom.', 'skill'],
      tiers: ['Bands of fabric, each wider than the one above, gathered on top of each other.'],
    },
    waist: {
      band: ['A firm band at the waist that closes with a zip. Neat and sits in place.'],
      faced: ['No band: the top is finished inside with a facing cut to its curve, so the skirt ends cleanly at your waist.'],
      high: ['Carried up past your waist toward the ribs, its darts running to the top, and faced inside. Lengthens the leg.', 'skill'],
      elastic: ['Elastic in the waist so it pulls on with no zip. The easiest to sew.', 'easy'],
      wrap: ['The front crosses over and the waistband runs on into ties, knotted at the side. No zip, and it adjusts as you wear it.'],
    },
    front: {
      plain: ['A plain front, shaped at the waist by its darts.', 'easy'],
      yoke: ['A curved band at the top that takes the darts, so the skirt below hangs smooth. Denim and A-line classics.'],
      buttons: ['Buttons all the way down the front and no zip. The back is cut in one piece.'],
    },
    pockets: {
      none: ['No pockets.'],
      inseam: ['Pockets hidden in the side seams, out of sight until you use them.'],
    },
    belt: {
      none: ['No belt: the waist as it is.', 'easy'],
      sash: ['A long sash in the same fabric that wraps your waist and ties in a bow or a knot.', 'easy'],
      sash_loops: ['The sash, held in place by a narrow loop at each side seam so it never slips.', 'easy'],
      loops: ['Four narrow loops at the waist to carry a belt of your own, up to 3 cm wide.'],
    },
  },
  bodice: {
    fit: FIT,
    neckline: {
      crew: ['A round neckline that sits close at the base of the neck.', 'easy'],
      scoop: ['A wider, lower round neckline.', 'easy'],
      v: ['Comes down to a point at the front.'],
      square: ['Straight across the front with square corners.'],
      boat: ['A wide, shallow neckline that runs almost from shoulder to shoulder.'],
      one_shoulder: ['Goes over one shoulder and leaves the other bare.', 'skill'],
      cowl: ['Extra fabric at the front falls in soft folds below the neck. Best in fabric that drapes.', 'skill'],
      strapless: ['No straps: it is boned and shaped to stay up on its own.', 'skill'],
      sweetheart: ['Curves over the bust in two arches, dipping in the middle like the top of a heart.', 'skill'],
      cami: ['Thin straps over the shoulders, like a camisole.'],
      halter: ['Rises to the neck and ties behind it, leaving the shoulders and upper back bare.'],
    },
    length: {
      waist: ['Ends at your waist, the natural place to meet a skirt or trousers.'],
      high_hip: ['Ends a little below the waist, at the top of the hip.'],
      hip: ['Ends at the fullest part of the hip.'],
    },
    waistSeam: {
      empire: ['Just under the bust, the skirt falling free from there. Make it short and full for a babydoll.'],
      raised: ['A little above your waist, for a longer-looking leg.'],
      natural: ['The bodice meets the skirt at your natural waist.', 'easy'],
      dropped: ['At the top of the hip: the bodice skims past your waist and the skirt falls from lower down. Lovely relaxed.', 'easy'],
      low: ['Low on the hip, for a long, lean bodice and a short flip of skirt.'],
    },
    darts: {
      bust_waist: ['Small folds sewn shut at the bust and waist that shape flat fabric round you. The closest fit.'],
      bust: ['A dart at the bust only, so it is shaped over the bust but looser at the waist.'],
      none: ['No darts, so it hangs straight and loose. The quickest to sew.', 'easy'],
    },
    sleeve: {
      none: ['No sleeves, finished neatly at the armhole.', 'easy'],
      short: ['A sleeve that ends on the upper arm.'],
      elbow: ['A sleeve that ends at the elbow.'],
      three_quarter: ['A sleeve that ends between the elbow and the wrist.'],
      long: ['A sleeve down to the wrist.'],
    },
    sleeveShape: {
      fitted: ['Shaped to follow your arm, narrowing towards the end.'],
      straight: ['The same width all the way down. The simplest sleeve.', 'easy'],
      puff: ['Gathered at the top so it puffs out at the shoulder.'],
      bishop: ['Full lower down and gathered into a band at the end.', 'skill'],
      cap: ['A tiny sleeve that just covers the top of the shoulder.', 'easy'],
      flutter: ['A short sleeve that flares out and ripples at the hem. Best in a light, drapey fabric.'],
    },
    sleeveCut: {
      set_in: ['The sleeve is sewn into a round armhole at your shoulder point. The usual way.', 'easy'],
      drop: ['The shoulder runs on past your shoulder point and the sleeve starts lower down the arm, for an easy, relaxed look.', 'easy'],
      raglan: ['A diagonal seam from the neck to the underarm, the shoulder cut as part of the sleeve. Easy to fit and to move in.'],
      kimono: ['The sleeve is cut in one with the bodice, so there is no armhole seam at all. Short to three-quarter length.', 'easy'],
    },
    sleeveCuff: {
      none: ['The sleeve ends in a plain hem, or the bishop sleeve in its band.', 'easy'],
      shirt: ['A buttoned cuff over a bound slit, the sleeve gathered into it, as on a shirt.', 'skill'],
      elastic: ['Elastic in a casing at the end, so the sleeve pulls on and gathers softly round the wrist.', 'easy'],
      tie: ['A narrow band that runs on into ties, knotted at the wrist over a short slit.'],
    },
    princess: {
      none: ['No extra seams. The bust is shaped with darts instead.', 'easy'],
      shoulder: ['Long curved seams from the shoulder over the bust, for a close, smooth fit with no darts.', 'skill'],
      armhole: ['Curved seams from the armhole over the bust. Shapes like darts, with a softer line.', 'skill'],
    },
    bustDart: {
      side: ['The bust dart comes from the side seam. The usual place.', 'easy'],
      french: ['A long dart that starts low on the side seam and angles up to the bust.'],
      shoulder: ['The dart comes down from the shoulder to the bust.'],
      neck: ['The dart starts at the neckline, where it can be hidden in gathers or a detail.'],
      armhole: ['The dart starts at the armhole and points to the bust.'],
      waist: ['All the bust shaping comes up from the waist in one larger dart.'],
    },
    closure: {
      back_zip: ['A zip down the centre back, out of sight from the front.'],
      front_buttons: ['Buttons down the front, like a blouse. You will sew buttonholes.', 'skill'],
      wrap: ['The fronts cross over in a V and tie at the waist, so there is no zip or button to sew.'],
    },
    collar: {
      none: ['No collar, just a neatly finished neckline.', 'easy'],
      peter_pan: ['A flat collar with rounded ends that lies on the shoulders.'],
      mandarin: ['A narrow band that stands up round the neck.'],
      mock: ['A taller band that hugs the neck, like a turtleneck that stops halfway. The back zip runs up through it.'],
      funnel: ['A tall band that stands a little away from the neck, widening toward its top edge like a funnel.'],
      shirt: ['A classic shirt collar on a stand, with points that fold down.', 'skill'],
      bow: ['A soft bias strip round the neck that runs on into long ties, knotted in a bow at the front. On a crew or V neck.'],
      ruffle: ['A soft folded frill gathered into the neckline seam, falling over the neck edge all round.'],
    },
    back: {
      plain: ['The back neck sits high, close to the base of the neck.', 'easy'],
      scoop: ['The back is cut away in a low curve, about a third of the way to the waist, and taped so it hugs you.'],
      v: ['The back drops to a deep V, nearly halfway to the waist. Plan what goes underneath.', 'skill'],
      keyhole: ['A small teardrop opening at the top of the back, closed at the neck with a button and a fine loop.'],
    },
    structure: {
      none: ['No boning, so the bodice is soft and moves with you.', 'easy'],
      boned: ['Thin, flexible bones sewn into the seams hold it firmly in shape, like a corset.', 'skill'],
      shirred: ['Rows of elastic thread gather the back so the top pulls on and hugs you. No zip, no boning.'],
    },
    peplum: {
      none: ['No peplum.'],
      flared: ['A short skirt of fabric sewn on at the waist that flares out over the hips.'],
      gathered: ['A short ruffle gathered on at the waist.'],
    },
  },
  tee: {
    stretch: {
      low: ['Your knit stretches a little. The tee is cut with more room so it still fits.'],
      medium: ['Your knit stretches a fair amount, like most tee jersey.', 'easy'],
      high: ['Your knit stretches a lot, so the tee is cut smaller to hug you.'],
    },
    fit: FIT,
    neckline: {
      crew: ['A round neck that sits close at the base of the neck.', 'easy'],
      scoop: ['A wider, lower round neck.'],
      v: ['Comes down to a point at the front.', 'skill'],
      mock: ['A tall knit band that stands up and hugs the neck, like a turtleneck that stops halfway.'],
    },
    sleeve: {
      short: ['A sleeve that ends on the upper arm.', 'easy'],
      elbow: ['A sleeve that ends at the elbow.'],
      long: ['A sleeve down to the wrist.'],
    },
    length: {
      cropped: ['Ends above the waist.'],
      hip: ['Ends at the hip. The classic tee length.', 'easy'],
      tunic: ['Long enough to cover the hips, ending on the thigh.'],
    },
  },
  trousers: {
    fit: FIT,
    leg: {
      straight: ['The leg falls straight from the hip to the hem.', 'easy'],
      wide: ['Wide all the way down, with plenty of swing.'],
      tapered: ['Narrows from the knee to the ankle.'],
      culotte: ['Wide, short legs that end at mid-calf, almost like a skirt.'],
    },
    length: {
      full: ['Long enough to reach the top of your shoe.'],
      ankle: ['Ends just above the ankle bone.'],
    },
    waist: {
      band: ['A firm band at the waist with a zip. Neat and sits in place.'],
      elastic: ['Elastic in the waist so they pull on with no zip. The easiest to sew.', 'easy'],
    },
    closure: {
      fly: ['A zip down the centre front, hidden behind a flap of fabric.', 'skill'],
      side_zip: ['A zip in the side seam. Simpler, with a smooth front.'],
    },
    pockets: {
      none: ['No pockets.', 'easy'],
      inseam: ['Pockets hidden in the side seams.'],
      slant: ['Pockets that open on a slant at the front hip, like chinos.', 'skill'],
    },
  },
  outer: {
    fit: FIT,
    length: {
      cropped: ['Ends above the hip, near the waist.'],
      hip: ['Ends at the hip, the classic jacket length.'],
      long: ['Ends below the hip, over the top of the thigh.'],
      thigh: ['Ends at mid-thigh.'],
      knee: ['Ends at the knee.'],
      midi: ['Ends halfway down the calf.'],
    },
    shaping: {
      darts: ['Darts at the front and back shape it in at the waist.'],
      princess: ['Long curved seams over the bust shape it smoothly to you.', 'skill'],
      boxy: ['No waist shaping, so it hangs straight and square.', 'easy'],
    },
    front: {
      single: ['One row of buttons down the front, overlapping a little.'],
      double: ['Two rows of buttons with a wide overlap.', 'skill'],
    },
    collar: {
      notched: ['The classic collar with lapels and a notch where they meet.', 'skill'],
      stand: ['A band that stands up round the neck.'],
      collarless: ['No collar, with a clean round neckline.', 'easy'],
    },
    sleeve: {
      tailored: ['Two pieces shaped to bend with your arm, as in a tailored jacket.', 'skill'],
      fitted: ['One piece with a small dart at the elbow so it bends with your arm.'],
      straight: ['One straight piece. The simplest sleeve.', 'easy'],
    },
    pads: {
      soft: ['Thin pads that smooth the shoulder without changing its shape.'],
      structured: ['Firmer pads that give a sharp, squared shoulder.'],
      none: ['No pads, so the shoulder follows your own.'],
    },
    pockets: {
      patch: ['Pockets sewn on top of the front, the simplest kind.', 'easy'],
      welt: ['Pockets set into a slit with a neat strip of fabric along the opening.', 'skill'],
      none: ['No pockets.'],
    },
    vent: {
      centre: ['An opening at the back hem so it sits smoothly when you move or sit.'],
      none: ['No opening at the back.'],
    },
    flare: {
      straight: ['Falls straight down below the hip.'],
      a_line: ['Widens gently from the hip to the hem.'],
    },
  },
};

/** The line for a choice, if there is one. */
export const explainLine = (set: ExplainSet, group: string, id: string | undefined) => (id === undefined ? undefined : EXPLAIN[set][group]?.[id]);

/** Every group and choice with a line, for the test that checks none is missing. */
export const explainGroups = (set: ExplainSet) => EXPLAIN[set];
