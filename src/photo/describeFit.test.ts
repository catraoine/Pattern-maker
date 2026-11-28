import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { describeFit } from './describeFit';
import { checkFitWords, fitIssuesFor, isFitTarget, keepMatches, tickMatches } from '../fitWords';
import { NO_FITTING } from '../engine/fitting';

/** A stand-in for the API: the answer as a call to the answer tool, every request kept. */
const fakeClient = (result: { stop_reason?: string; answer?: object } | Error) => {
  const create = vi.fn(async (_req: unknown) => {
    if (result instanceof Error) throw result;
    return { stop_reason: result.stop_reason ?? 'tool_use', content: result.answer ? [{ type: 'tool_use', name: 'record_answer', input: result.answer }] : [] };
  });
  return { client: { beta: { messages: { create } } } as unknown as Anthropic, create };
};

describe('describeFit', () => {
  it('says so when no API key is set', async () => {
    expect(await describeFit('folds at the back', 'skirt', true, null)).toEqual({ ok: false, error: 'not_configured' });
  });

  it('turns away empty or very long words, and garments with no list, without calling Claude', async () => {
    const { client, create } = fakeClient({ answer: { matches: [], notCovered: [] } });
    expect(await describeFit('   ', 'skirt', true, client)).toEqual({ ok: false, error: 'bad_image' });
    expect(await describeFit('x'.repeat(601), 'skirt', true, client)).toEqual({ ok: false, error: 'bad_image' });
    expect(await describeFit(7, 'skirt', true, client)).toEqual({ ok: false, error: 'bad_image' });
    // A knit fits by stretch, so the woven list doesn't apply to it.
    expect(await describeFit('tight at the bust', 'tee', true, client)).toEqual({ ok: false, error: 'bad_image' });
    expect(create).not.toHaveBeenCalled();
    expect(checkFitWords('  gapes at the neck ')).toBe('gapes at the neck');
  });

  it('sends their words with only this garment\'s list, and returns the matches', async () => {
    const { client, create } = fakeClient({ answer: { matches: [{ id: 'skirt-sway-back', side: null }], notCovered: [] } });
    expect(await describeFit('Folds under the waistband at the back', 'skirt', true, client)).toEqual({ ok: true, reading: { matches: [{ id: 'skirt-sway-back', side: null }], notCovered: [] } });
    const req = create.mock.calls[0][0] as { system: string; messages: { content: { text: string }[] }[]; tools: unknown };
    const sent = req.messages[0].content[0].text;
    expect(sent).toContain('Folds under the waistband at the back');
    expect(sent).toContain('skirt-sway-back');
    expect(sent).not.toContain('bodice-neck-gape');
    // The answer can only name problems on the list it was sent.
    expect(JSON.stringify(req.tools)).toContain('skirt-sway-back');
    expect(JSON.stringify(req.tools)).not.toContain('bodice-neck-gape');
    expect(req.system).toContain('notCovered');
  });

  it('keeps a side only on a one-sided problem, and tidies what the list can\'t correct', async () => {
    const answer = {
      matches: [
        { id: 'bodice-low-shoulder', side: 'left' },
        { id: 'bodice-neck-gape', side: 'left' },
      ],
      notCovered: ['Tight sleeves.', 'x'.repeat(80), 'a crooked hem', 'a lumpy zip', 'too many'],
    };
    const r = await describeFit('my left shoulder drops and the neck gapes, sleeves are tight', 'bodice', true, fakeClient({ answer }).client);
    expect(r.ok && r.reading).toEqual({
      matches: [
        { id: 'bodice-low-shoulder', side: 'left' },
        { id: 'bodice-neck-gape', side: null },
      ],
      notCovered: ['tight sleeves', 'a crooked hem', 'a lumpy zip'],
    });
  });

  it('turns a refusal or a failure into a friendly error', async () => {
    expect(await describeFit('x', 'skirt', true, fakeClient({ stop_reason: 'refusal' }).client)).toEqual({ ok: false, error: 'declined' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await describeFit('x', 'skirt', true, fakeClient(new Error('boom')).client)).toEqual({ ok: false, error: 'failed' });
  });
});

describe('fit words on the page', () => {
  it('knows the garments a toile can be fitted for', () => {
    expect(isFitTarget('dress')).toBe(true);
    expect(isFitTarget('toString')).toBe(false);
    expect(isFitTarget(undefined)).toBe(false);
  });

  it('offers the bust dart problems only on a pattern with one', () => {
    expect(fitIssuesFor('bodice', true).some((i) => i.needsBustDart)).toBe(true);
    expect(fitIssuesFor('bodice', false).some((i) => i.needsBustDart)).toBe(false);
    expect(fitIssuesFor('dress', true).some((i) => i.garment === 'skirt')).toBe(true);
  });

  it('drops problems off the list, repeats and opposites', () => {
    const issues = fitIssuesFor('skirt', true);
    expect(
      keepMatches(
        [
          { id: 'skirt-hip-tight', side: null },
          { id: 'skirt-hip-loose', side: null },
          { id: 'skirt-hip-tight', side: null },
          { id: 'bodice-neck-gape', side: null },
        ],
        issues,
      ),
    ).toEqual([{ id: 'skirt-hip-tight', side: null }]);
  });

  it('ticks confirmed problems at their starting amount and keeps one already set', () => {
    const f = { ...NO_FITTING, issues: { 'skirt-waist-tight': 3 } };
    const next = tickMatches(f, [
      { id: 'skirt-waist-tight', side: null },
      { id: 'skirt-sway-back', side: null },
      { id: 'skirt-high-hip', side: 'left' },
    ]);
    expect(next.issues).toEqual({ 'skirt-waist-tight': 3, 'skirt-sway-back': 1.5, 'skirt-high-hip': expect.any(Number) });
    expect(next.sides).toEqual({ 'skirt-high-hip': 'left' });
    // One already ticked keeps the side they set too.
    expect(tickMatches({ ...NO_FITTING, issues: { 'skirt-high-hip': 2 }, sides: { 'skirt-high-hip': 'right' } }, [{ id: 'skirt-high-hip', side: 'left' }]).sides).toEqual({ 'skirt-high-hip': 'right' });
    // Ticking a problem clears its opposite, as on the page.
    expect(tickMatches({ ...NO_FITTING, issues: { 'skirt-hip-loose': 2 } }, [{ id: 'skirt-hip-tight', side: null }]).issues).toEqual({ 'skirt-hip-tight': 2 });
  });
});
