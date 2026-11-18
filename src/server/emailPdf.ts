// Server side only: "Email me the PDF" on the Print screen (journey review, Nov 10: a tester on a computer couldn't
// get her pattern into her email, because "Send to email or a printer" shows only where the browser has a share
// menu). The app sends the PDF it made; the function checks it and hands it to the email service (Resend), from
// hello@maisontrace.co. The address is used only to send this one email: it isn't stored or logged.
import { z } from 'zod';

/** The biggest PDF taken (a long coat on A4 is well under 1 MB), as base64, which is a third bigger. */
const PDF_MAX_BYTES = 4_000_000;
const PDF_MAX_B64 = Math.ceil(PDF_MAX_BYTES / 3) * 4;
/** The whole request: the pattern and its instructions booklet, with a little room for the address and the names. */
export const MAX_EMAIL_REQUEST = 2 * PDF_MAX_B64 + 4_000;
const PDF_B64 = z.string().max(PDF_MAX_B64).regex(/^JVBER[A-Za-z0-9+/]+={0,2}$/);
const PDF_NAME = z.string().trim().max(120).regex(/^[a-z0-9-]+\.pdf$/);
/** Daily caps, per sender and for the whole site, inside the email service's free 100 a day. */
export const EMAIL_CAPS = { visitor: 5, all: 90 };

const EmailSchema = z
  .object({
    to: z.string().trim().max(254).email(),
    // The pattern's name, as on the Print screen, such as "knee A-line skirt" (cut to 80 letters in the email).
    title: z.string().trim().min(1).max(200),
    fileName: PDF_NAME,
    // The PDF itself, base64. "JVBER" is how "%PDF-" starts in base64, so only a PDF is ever attached.
    pdf: PDF_B64,
    // The instructions booklet, its own file since Nov 15 (Cat: the pattern is what you print). Checked the same way.
    bookletName: PDF_NAME.optional(),
    booklet: PDF_B64.optional(),
  })
  .strict()
  // The booklet comes with its name or not at all, so the email never says "second file" without one.
  .refine((r) => !r.booklet === !r.bookletName);

type EmailRequest = z.infer<typeof EmailSchema>;

/** The request, if it is a well-formed one. */
export function checkEmailRequest(text: string): EmailRequest | null {
  try {
    const r = EmailSchema.safeParse(JSON.parse(text));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** Words only from the app, never from the request (the pattern's name aside), so the function can't be used to send anyone else's message. */
// No full stops, so a web address can't be written into the subject or the email (security pass, Nov 15).
const clean = (s: string) => s.replace(/[^\p{L}\p{N} '’&,()-]/gu, '').slice(0, 80);

/** What goes to the email service. */
export function emailFor(r: EmailRequest) {
  const name = clean(r.title);
  return {
    from: 'Maison Tracé <hello@maisontrace.co>',
    to: [r.to],
    subject: `Your pattern: ${name}`,
    text: [
      `Here is your ${name} pattern, drafted to you.`,
      '',
      r.booklet && r.bookletName
        ? 'Print the pattern at 100% (actual size) and measure the 10 cm test square (page A2 on home paper) before you cut. The instructions, with the cutting layout and sewing steps, are in the second file.'
        : 'Print it at 100% (actual size) and measure the 10 cm test square (page A2 on home paper) before you cut.',
      '',
      'Maison Tracé',
      'You asked for this email on the Print screen. We used your address only to send it.',
    ].join('\n'),
    attachments: [{ filename: r.fileName, content: r.pdf }, ...(r.booklet && r.bookletName ? [{ filename: r.bookletName, content: r.booklet }] : [])],
  };
}
