/** A phone or tablet, read when asked (a keyboard and trackpad can be attached later): a touch screen as its main
 *  pointer. Print offers Print from my computer (once Send to my computer) only here, and the welcome points a tester on anything else (a computer)
 *  back to it, so both ask the same question. A phone with a stylus also reports a fine pointer, and was taken for a
 *  computer while that counted: Print had no way to send it to a computer, though the help pointed there (pretend tester, Nov 18). */
export const onPhone = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
