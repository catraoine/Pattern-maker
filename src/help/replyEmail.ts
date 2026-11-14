// The email a sewist can leave on a Help & feedback note for a reply. One rule, checked in the app before sending and
// again on the server, so an address the app lets through is never turned away later and the note lost with it.

/** Something, an @, and a domain with at least one dot. No spaces. Loose on purpose: we only need to write back. */
export const REPLY_EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
/** Longer than any real address, short enough that a paste of a page is turned away. */
export const REPLY_EMAIL_MAX = 200;
