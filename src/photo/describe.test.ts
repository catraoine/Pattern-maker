import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { checkIdea, describeIdea, wishKey } from './describe';

const fakeClient = (result: object | Error) => {
  const parse = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { client: { beta: { messages: { parse } } } as unknown as Anthropic, parse };
};

const idea = { verdict: 'make', name: 'slip dress', note: '', start: 'dress', bias: true, reading: { garment: 'dress' } };

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
    expect(await describeIdea('a slip dress', client)).toEqual({ ok: true, idea });
    const req = (parse.mock.calls[0] as unknown[])[0] as { model: string; system: string; output_config: unknown; messages: { content: { text: string }[] }[] };
    expect(req.model).toBe('claude-opus-5-5');
    expect(req.messages[0].content[0].text).toContain('a slip dress');
    expect(req.system).toContain('"not_yet"');
    expect(req.system).toContain('hemFullness');
    for (const key of ['verdict', 'start', 'bias', 'reading']) expect(JSON.stringify(req.output_config)).toContain(`"${key}"`);
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
