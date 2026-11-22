// Print's Choose fabric opens Style on its Fabric step. Coming back used to land at the top of Print, on a phone
// a long scroll from where you were (Cat, Nov 21: "the journey breaks"). So Style offers a way straight back, and
// Print opens on the fabric again.

let leftPrint = false;
let backToFabric = false;

/** Print is opening Style for its fabric: Style then shows Back to Print. */
export const leavePrintForFabric = () => {
  leftPrint = true;
};

/** Whether this Style was opened from Print's fabric, read once by the screen as it opens. */
export const cameFromPrint = () => leftPrint;
export const forgetPrint = () => {
  leftPrint = false;
};

/** Going back to Print from that Style: Print opens on its fabric, not at the top. */
export const returnToFabric = () => {
  backToFabric = true;
};

/** Read once by Print as it opens. */
export const takeFabricReturn = () => {
  const back = backToFabric;
  backToFabric = false;
  return back;
};
