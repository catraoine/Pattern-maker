/** A phone or tablet, read when asked (a keyboard and trackpad can be attached later): a touch screen first, or a screen
 *  a phone's width. Print offers Send to my computer only here, and the welcome points a tester on anything else (a
 *  computer) back to it, so both ask the same question. A phone with a stylus also reports a fine pointer, and was taken
 *  for a computer: Print had no Send to my computer, though the help pointed there (pretend tester, Nov 18). */
export const onPhone = () => typeof window !== 'undefined' && !!window.matchMedia && (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 600px)').matches);
