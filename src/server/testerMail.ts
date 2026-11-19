// Server side only: tester emails sent from the team's own threads through Resend, from hello@maisontrace.co (Nov 19).
// Why: the Gmail connector rewrites every link it is given into a google.com/url redirect, and testers saw those links
// as blank (two invites, Nov 19). Resend sends the links exactly as written. Locked down because it sends as us:
// a key in a header, one named address per email, links only to our own app and our forms, and a copy to Cat's inbox.
import { z } from 'zod';

/** The whole request: a tester email is a few short paragraphs, so anything near this size isn't one. */
export const MAX_TESTER_MAIL_REQUEST = 40_000;

/**
 * Daily cap. Tester emails share the Resend day with "Email me the PDF" (the same 90 inside the free 100 a day), and
 * each one counts twice there, because the copy to Cat may count as a second email. 25 tester emails (a full round of
 * check-ins plus replies) use 50 of the 90, so even a leaked key leaves 40 PDF emails for everyone else.
 */
export const TESTER_MAIL_CAP = 25;

/**
 * Where links may point. Anything else is turned away, so a leaked key can't send people to a stranger's site from
 * our address. Add a place here when an email genuinely needs it.
 */
const LINK_PLACES: { host: string; path?: RegExp }[] = [
  { host: 'maisontrace.co' },
  { host: 'www.maisontrace.co' },
  { host: 'forms.gle' },
  { host: 'docs.google.com', path: /^\/forms\// },
];

/** An email's Message-ID as Gmail shows it under "Show original", such as <abc123@mail.gmail.com>. */
const MESSAGE_ID = z.string().trim().max(250).regex(/^<[^<>\s@]+@[^<>\s@]+>$/);

const TesterMailSchema = z
  .object({
    // One address only: each tester gets her own email, so no tester ever sees another's address.
    to: z.string().trim().max(254).email(),
    subject: z.string().trim().min(1).max(200).regex(/^[^\r\n]+$/),
    // Plain text as Cat writes it. Links are written in full (https://...) or as maisontrace.co/..., and become real links.
    text: z.string().min(1).max(20_000),
    // To reply in the tester's own thread: the Message-ID of her latest email, and the thread's earlier ones.
    inReplyTo: MESSAGE_ID.optional(),
    references: z.array(MESSAGE_ID).max(30).optional(),
    // A name for this one send (letters, digits, dashes). Sending again with the same name within a day doesn't send twice.
    sendId: z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9-]+$/).optional(),
  })
  .strict()
  // The earlier emails only matter with the one being answered, so they never arrive alone and get dropped.
  .refine((r) => !r.references || !!r.inReplyTo);

type TesterMail = z.infer<typeof TesterMailSchema>;

/** The request, if it is a well-formed one. */
export function checkTesterMail(text: string): TesterMail | null {
  try {
    const r = TesterMailSchema.safeParse(JSON.parse(text));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

// A full web address, or a bare one such as maisontrace.co/?src=x or forms.gle/abc (mail apps make those into links too,
// so they are checked the same way). The domain inside an email address (hello@maisontrace.co) stays plain words.
const LINK = /\bhttps?:\/\/[^\s<>"'\]]+|(?<![@\w.-])(?:[a-z0-9-]+\.)+[a-z]{2,}\b(?:\/[^\s<>"'\]]*)?/gi;
/** A full stop, comma or similar at the very end belongs to the sentence, and so does a closing bracket the link didn't open. */
function trimEnd(s: string): string {
  let out = s.replace(/[.,;:!?'"’”]+$/, '');
  while (out.endsWith(')') && out.split('(').length < out.split(')').length) out = out.slice(0, -1).replace(/[.,;:!?'"’”]+$/, '');
  return out;
}

/** Every link in the text, as it will be sent. */
export function linksIn(text: string): string[] {
  return [...text.matchAll(LINK)].map((m) => trimEnd(m[0]));
}

const fullUrl = (link: string) => (/^https?:\/\//i.test(link) ? link : `https://${link}`);

/** Whether a link may go out from our address (see LINK_PLACES). */
export function linkAllowed(link: string): boolean {
  try {
    const u = new URL(fullUrl(link));
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
    return LINK_PLACES.some((p) => p.host === u.hostname.toLowerCase() && (!p.path || p.path.test(u.pathname)));
  } catch {
    return false;
  }
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The text as simple HTML: the same words, line breaks kept, each link a real link showing exactly what was written. */
export function htmlFor(text: string): string {
  let out = '';
  let at = 0;
  for (const m of text.matchAll(LINK)) {
    const link = trimEnd(m[0]);
    out += escapeHtml(text.slice(at, m.index)) + `<a href="${escapeHtml(fullUrl(link))}">${escapeHtml(link)}</a>`;
    at = m.index + link.length;
  }
  out += escapeHtml(text.slice(at));
  const body = out.replace(/\r\n/g, '\n').replace(/\n/g, '<br>\n');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${body}</div>`;
}

/** What goes to the email service. `copyTo` is Cat's own inbox, from Netlify's settings, never from the request. */
export function testerMailFor(r: TesterMail, copyTo: string, fromName: string) {
  // The email being answered goes last, as mail apps expect.
  const refs = r.inReplyTo ? [...(r.references ?? []).filter((id) => id !== r.inReplyTo), r.inReplyTo] : [];
  // In quotes, so a name with a full stop is still a well-formed address; quote marks themselves are taken out.
  const name = fromName.replace(/[^\p{L}\p{N} '’&.-]/gu, '').trim().slice(0, 60) || 'Maison Tracé';
  return {
    from: `"${name}" <hello@maisontrace.co>`,
    to: [r.to],
    bcc: [copyTo],
    reply_to: [copyTo],
    subject: r.subject,
    text: r.text,
    html: htmlFor(r.text),
    // So the email sits in the tester's existing conversation, as a reply from Gmail would.
    ...(r.inReplyTo ? { headers: { 'In-Reply-To': r.inReplyTo, References: refs.join(' ') } } : {}),
  };
}
