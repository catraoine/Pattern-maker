/** A phone or tablet with only a touch screen, read when asked (a keyboard and trackpad can be attached later). Print
 *  offers Send to my computer only here, and the welcome points a tester on anything else (a computer) back to it, so
 *  both ask the same question. */
export const onPhone = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches;
