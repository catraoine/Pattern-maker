import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { analyzePhoto } from './analyze';

const reading = {
  garment: 'skirt',
  silhouette: { value: 'a_line', confidence: 'high' },
  length: { value: 'midi', confidence: 'medium' },
  fit: { value: 'regular', confidence: 'low' },
  shape: { hemAt: 0.74, hemFullness: 1.6, flareAt: null, confidence: 'medium' },
  details: 'It has box pleats at the front.',
};

const fakeClient = (result: object | Error) => {
  const parse = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { client: { beta: { messages: { parse } } } as unknown as Anthropic, parse };
};

const photo = { image: 'aGVsbG8=', mediaType: 'image/jpeg' };

describe('analyzePhoto', () => {
  it('says so when no API key is set', async () => {
    expect(await analyzePhoto(photo, null)).toEqual({ ok: false, error: 'not_configured' });
  });

  it('rejects unsupported or oversized uploads without calling Claude', async () => {
    const { client, parse } = fakeClient({});
    expect(await analyzePhoto({ image: 'x', mediaType: 'image/gif' }, client)).toEqual({ ok: false, error: 'bad_image' });
    expect(await analyzePhoto({ image: 'x'.repeat(4_000_001), mediaType: 'image/png' }, client)).toEqual({ ok: false, error: 'too_large' });
    expect(parse).not.toHaveBeenCalled();
  });

  it('returns the reading and sends the photo as an image block with fallbacks on', async () => {
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: reading });
    expect(await analyzePhoto(photo, client)).toEqual({ ok: true, reading });
    const req = (parse.mock.calls[0] as unknown[])[0] as { model: string; fallbacks: string; messages: { content: { type: string }[] }[] };
    expect(req.model).toBe('claude-opus-5-5');
    expect(req.fallbacks).toBe('default');
    expect(req.messages[0].content[0].type).toBe('image');
  });

  it('asks for every silhouette the drafter knows and the exact shape', async () => {
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: reading });
    await analyzePhoto(photo, client);
    const req = (parse.mock.calls[0] as unknown[])[0] as { output_config: unknown; system: string };
    const schema = JSON.stringify(req.output_config);
    for (const shape of ['pencil', 'straight', 'a_line', 'trumpet', 'half_circle', 'circle']) {
      expect(schema).toContain(`\\"${shape}\\"`); // the enum is listed inside the schema's description
      expect(req.system).toContain(`"${shape}"`);
    }
    for (const key of ['hemAt', 'hemFullness', 'flareAt']) expect(schema).toContain(`"${key}"`);
  });

  it('reads every garment the app drafts, and each piece in an outfit', async () => {
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: reading });
    await analyzePhoto(photo, client);
    const req = (parse.mock.calls[0] as unknown[])[0] as { output_config: unknown; system: string };
    const schema = JSON.stringify(req.output_config);
    for (const g of ['skirt', 'dress', 'top', 'tee', 'trousers', 'jacket', 'coat']) expect(req.system).toContain(`"${g}"`);
    for (const key of ['pieces', 'extras', 'top', 'trousers', 'outer', 'waistSeam', 'knit']) expect(schema).toContain(`"${key}"`);
  });

  it('turns a refusal or a failure into a friendly error', async () => {
    expect(await analyzePhoto(photo, fakeClient({ stop_reason: 'refusal', parsed_output: null }).client)).toEqual({ ok: false, error: 'declined' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await analyzePhoto(photo, fakeClient(new Error('boom')).client)).toEqual({ ok: false, error: 'failed' });
  });

  it('says photo reading is resting, not that the photo is bad, once the monthly spend limit is reached', async () => {
    const limit = new Anthropic.BadRequestError(400, { type: 'error', error: { type: 'invalid_request_error', message: 'You have reached your specified API usage limits.' } }, undefined, new Headers());
    expect(await analyzePhoto(photo, fakeClient(limit).client)).toEqual({ ok: false, error: 'busy' });
    const bad = new Anthropic.BadRequestError(400, { type: 'error', error: { type: 'invalid_request_error', message: 'Could not process image' } }, undefined, new Headers());
    expect(await analyzePhoto(photo, fakeClient(bad).client)).toEqual({ ok: false, error: 'bad_image' });
  });
});
