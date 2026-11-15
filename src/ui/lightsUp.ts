// The first chalk a visit shows lights up from black (Cat, Nov 11 on Style; Nov 14: the first measuring page is now
// the first chalk, so it eases in there and Style only lights up when measuring was skipped). Once a visit, wherever
// it comes first.
let lit = false;

/** True the first time it's asked in a visit, so only the first chalk picture lights up. */
export function firstLightUp() {
  if (lit) return false;
  lit = true;
  return true;
}
