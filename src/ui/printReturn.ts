// Cut it's Choose fabric opens Style on its Fabric step. Coming back used to land at the top of the page, on a phone
// a long scroll from where you were (Cat, Nov 21: "the journey breaks"). So Style offers a way straight back, and Cut
// it opens on the fabric again. Cut it was on Print until Nov 28, and is now the first page of Sew.

let leftPrint = false;
let backToFabric = false;

/** Cut it is opening Style for its fabric: Style then shows Back to Sew. */
export const leavePrintForFabric = () => {
  leftPrint = true;
};

/** Whether this Style was opened from Cut it's fabric, read once by the screen as it opens. */
export const cameFromPrint = () => leftPrint;
/** Read by Style as it opens. It also drops a way back to the fabric that Sew never took (Sew didn't open, say for a
 *  garment still to unlock), so it can't send a later Print my pattern to Sew. */
export const forgetPrint = () => {
  leftPrint = false;
  backToFabric = false;
};

/** Going back from that Style: Cut it opens on its fabric, not at the top. */
export const returnToFabric = () => {
  backToFabric = true;
};

/** Whether the way on from Style is that way back, so it goes to Sew, where Cut it now is (Cat, Nov 28). */
export const fabricReturning = () => backToFabric;

/** Dropped by Sew once it has opened on the fabric (read with `fabricReturning`, for the same reason as Cut it's). */
export const dropFabricReturn = () => {
  backToFabric = false;
};

let backToCut = false;

/** Print's Next: Cut and sew: Sew opens on Cut it, even once sewing has begun (Cat, Nov 28). */
export const openCutNext = () => {
  backToCut = true;
};

/** Read by Sew as it opens, and dropped once it has opened: read and cleared in one go, React's development double
 *  render read it cleared the second time, and Sew opened on Sew it once sewing had begun (EM walk, Nov 28). */
export const cutReturning = () => backToCut;
export const dropCutReturn = () => {
  backToCut = false;
};
