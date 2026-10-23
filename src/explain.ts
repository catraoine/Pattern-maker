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
    asymHem: {
      none: ['The hem is the same length all the way round.', 'easy'],
      high_low: ['Shorter at the front and longer at the back, curving between.'],
      diagonal: ['The hem slants from one side to the other.', 'skill'],
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
      elastic: ['Elastic in the waist so it pulls on with no zip. The easiest to sew.', 'easy'],
    },
    pockets: {
      none: ['No pockets.'],
      inseam: ['Pockets hidden in the side seams, out of sight until you use them.'],
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
    },
    length: {
      waist: ['Ends at your waist, the natural place to meet a skirt or trousers.'],
      high_hip: ['Ends a little below the waist, at the top of the hip.'],
      hip: ['Ends at the fullest part of the hip.'],
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
    },
    collar: {
      none: ['No collar, just a neatly finished neckline.', 'easy'],
      peter_pan: ['A flat collar with rounded ends that lies on the shoulders.'],
      mandarin: ['A narrow band that stands up round the neck.'],
      shirt: ['A classic shirt collar on a stand, with points that fold down.', 'skill'],
    },
    structure: {
      none: ['No boning, so the bodice is soft and moves with you.', 'easy'],
      boned: ['Thin, flexible bones sewn into the seams hold it firmly in shape, like a corset.', 'skill'],
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
