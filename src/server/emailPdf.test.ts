import { describe, expect, it } from 'vitest';
import { checkEmailRequest, emailFor } from './emailPdf';

const pdf = Buffer.from('%PDF-1.7 test').toString('base64');
const ok = { to: 'sewist@example.com', title: 'knee A-line skirt', fileName: 'knee-a-line-skirt-letter.pdf', pdf };

describe('Email me the PDF', () => {
  it('takes a well-formed request', () => {
    expect(checkEmailRequest(JSON.stringify(ok))).toEqual(ok);
  });
  it('turns away anything that is not a PDF, a bad address, extra fields or odd file names', () => {
    expect(checkEmailRequest(JSON.stringify({ ...ok, pdf: Buffer.from('<html>').toString('base64') }))).toBeNull();
    expect(checkEmailRequest(JSON.stringify({ ...ok, to: 'not an address' }))).toBeNull();
    expect(checkEmailRequest(JSON.stringify({ ...ok, text: 'Buy now' }))).toBeNull();
    expect(checkEmailRequest(JSON.stringify({ ...ok, fileName: '../evil.exe' }))).toBeNull();
    expect(checkEmailRequest('not json')).toBeNull();
  });
  it('writes the email from the app, with the PDF attached', () => {
    const e = emailFor({ ...ok, title: 'skirt <a href="x">click</a>' });
    expect(e.from).toBe('Maison Tracé <hello@maisontrace.co>');
    expect(e.to).toEqual(['sewist@example.com']);
    expect(e.subject).not.toMatch(/[<>"]/);
    expect(e.attachments[0]).toEqual({ filename: ok.fileName, content: pdf });
  });
});
