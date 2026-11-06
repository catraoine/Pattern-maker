import { describe, expect, it } from 'vitest';
import { MAX_NOTE_BYTES, NOTE_MAX, checkNote, shotBytes } from './notes';

const note = { note: 'The length marks overlap the skirt on Maxi.', view: 'style', version: '0.1.0+abc1234', browser: 'Safari 18 iOS' };
const shot = `data:image/jpeg;base64,${Buffer.from('fake jpeg bytes').toString('base64')}`;

describe('checkNote', () => {
  it('takes a note, with or without a screenshot', () => {
    expect(checkNote(JSON.stringify(note))).toEqual(note);
    expect(checkNote(JSON.stringify({ ...note, shot }))?.shot).toBe(shot);
  });

  it('turns away empty notes, extra fields, long notes and anything that is not a JPEG', () => {
    expect(checkNote(JSON.stringify({ ...note, note: '   ' }))).toBeNull();
    expect(checkNote(JSON.stringify({ ...note, email: 'someone' }))).toBeNull();
    expect(checkNote(JSON.stringify({ ...note, note: 'x'.repeat(NOTE_MAX + 1) }))).toBeNull();
    expect(checkNote(JSON.stringify({ ...note, shot: 'data:image/svg+xml;base64,PHN2Zz4=' }))).toBeNull();
    expect(checkNote(JSON.stringify({ ...note, shot: 'https://example.com/a.jpg' }))).toBeNull();
    expect(checkNote('not json')).toBeNull();
  });

  it('turns away a body too big to be a note before parsing it', () => {
    expect(checkNote(JSON.stringify({ ...note, pad: 'x'.repeat(MAX_NOTE_BYTES) }))).toBeNull();
  });

  it('gives back the screenshot as bytes', () => {
    expect(shotBytes(shot).toString()).toBe('fake jpeg bytes');
  });
});
