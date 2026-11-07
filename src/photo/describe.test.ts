import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { toReading } from './analyze';
import { checkIdea, describeIdea, wishKey } from './describe';

/** A stand-in for the API: a structured answer through parse, or the same answer as a call to the answer tool through create. Both are counted in parse's calls. */
const fakeClient = (result: object | Error) => {
  const parse = vi.fn(async (_req: unknown) => {
    if (result instanceof Error) throw result;
    return result;
  });
  const create = async (req: unknown) => {
    const r = (await parse(req)) as { stop_reason?: string; parsed_output?: unknown };
    return { stop_reason: r.stop_reason === 'refusal' ? 'refusal' : 'tool_use', content: r.parsed_output ? [{ type: 'tool_use', name: 'record_answer', input: r.parsed_output }] : [] };
  };
  return { client: { beta: { messages: { parse, create } } } as unknown as Anthropic, parse };
};

const reading = {
  garment: 'dress',
  pieces: [{ garment: 'dress', x: 0.5, y: 0.5 }],
  silhouette: { value: 'a_line', confidence: 'medium' },
  length: { value: 'midi', confidence: 'high' },
  fit: { value: 'regular', confidence: 'medium' },
  shape: { hemAt: 0.74, hemFullness: 1.4, flareAt: null, confidence: 'medium' },
  extras: { volume: 'none', asymHem: 'none', pockets: false, elasticWaist: false, slit: 'none' },
  top: null,
  trousers: null,
  outer: null,
  fabric: null,
  worn: true,
  measures: [] as { name: string; value: number }[],
  unsure: null,
  missing: [],
  details: '',
};
const idea = { verdict: 'make', name: 'slip dress', note: '', start: 'dress', bias: true, reading };
/** The idea as the app gets it, its reading's sizes all named. */
const kept = (i: typeof idea) => ({ ...i, reading: toReading(i.reading as never) });

describe('describeIdea', () => {
  it('says so when no API key is set', async () => {
    expect(await describeIdea('a slip dress', null)).toEqual({ ok: false, error: 'not_configured' });
  });

  it('turns away empty or very long ideas without calling Claude', async () => {
    const { client, parse } = fakeClient({});
    expect(await describeIdea('   ', client)).toEqual({ ok: false, error: 'bad_image' });
    expect(await describeIdea('x'.repeat(401), client)).toEqual({ ok: false, error: 'bad_image' });
    expect(await describeIdea(42, client)).toEqual({ ok: false, error: 'bad_image' });
    expect(parse).not.toHaveBeenCalled();
    expect(checkIdea('  a cape ')).toBe('a cape');
  });

  it('sends their words with the photo reading guide and returns the idea', async () => {
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: idea });
    expect(await describeIdea('a slip dress', client)).toEqual({ ok: true, idea: kept(idea) });
    const req = (parse.mock.calls[0] as unknown[])[0] as { model: string; system: string; tools: unknown; messages: { content: { text: string }[] }[] };
    expect(req.model).toBe('claude-opus-5-5');
    expect(req.messages[0].content[0].text).toContain('a slip dress');
    expect(req.system).toContain('"not_yet"');
    expect(req.system).toContain('hemFullness');
    for (const key of ['verdict', 'start', 'bias', 'reading']) expect(JSON.stringify(req.tools)).toContain(`"${key}"`);
  });

  it('only starts a garment when there is one to make', async () => {
    const notYet = await describeIdea('a swimsuit', fakeClient({ stop_reason: 'end_turn', parsed_output: { ...idea, verdict: 'not_yet', start: 'top' } }).client);
    expect(notYet.ok && notYet.idea.start).toBe(null);
    const noStart = await describeIdea('a hat', fakeClient({ stop_reason: 'end_turn', parsed_output: { ...idea, start: null } }).client);
    expect(noStart.ok && noStart.idea.verdict).toBe('not_yet');
  });

  it('turns a refusal or a failure into a friendly error', async () => {
    expect(await describeIdea('x', fakeClient({ stop_reason: 'refusal', parsed_output: null }).client)).toEqual({ ok: false, error: 'declined' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await describeIdea('x', fakeClient(new Error('boom')).client)).toEqual({ ok: false, error: 'failed' });
  });
});

describe('wishKey', () => {
  it('counts the same wish under one key', () => {
    expect(wishKey('Wide-leg  Jumpsuit!')).toBe('wide-leg-jumpsuit');
    expect(wishKey('***')).toBe('unnamed');
  });
});
