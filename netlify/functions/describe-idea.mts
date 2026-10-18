// POST { text } describing a garment, get back whether the app can make it and the style to start from.
// Shares the ANTHROPIC_API_KEY the photo reading uses, with its own daily caps. Ideas the app can't make
// yet are counted by name (never with who asked), so the most wanted garments show up.
import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { getStore } from '@netlify/blobs';
import { checkIdea, describeIdea, wishKey } from '../../src/photo/describe';
import { takeAllowance, type Allowance, type CountStore } from '../../src/photo/limit';

// Provided by the Netlify runtime.
declare const Netlify: { env: { get(name: string): string | undefined } };

const counts = (name: string): CountStore => {
  const store = getStore({ name, consistency: 'strong' });
  return {
    get: async (key) => Number((await store.get(key)) ?? 0),
    set: async (key, count) => void (await store.set(key, String(count))),
  };
};

// Visitors are counted by a hash of their IP address, so no address is stored.
const visitorId = (ip: string | undefined) => createHash('sha256').update(ip ?? 'unknown').digest('hex').slice(0, 24);

export default async (req: Request, context: { ip?: string }) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const key = Netlify.env.get('ANTHROPIC_API_KEY');
  let text: unknown;
  try {
    text = ((await req.json()) as { text?: unknown }).text;
  } catch {
    text = undefined;
  }
  if (!checkIdea(text)) return Response.json({ ok: false, error: 'bad_image' }, { status: 400 });

  if (key) {
    let allowance: Allowance = 'ok';
    try {
      allowance = await takeAllowance(counts('describe-limits'), visitorId(context.ip));
    } catch (e) {
      // If the counter can't be reached, still read it; the prepaid credit stays the hard cap.
      console.error('describe limit check failed', e);
    }
    if (allowance !== 'ok') return Response.json({ ok: false, error: allowance }, { status: 429 });
  }

  const result = await describeIdea(text, key ? new Anthropic({ apiKey: key }) : null);
  if (result.ok && result.idea.verdict === 'not_yet') {
    try {
      const wishes = counts('wishes');
      const k = wishKey(result.idea.name);
      await wishes.set(k, (await wishes.get(k)) + 1);
    } catch (e) {
      console.error('wish count failed', e);
    }
  }
  const status = result.ok ? 200 : result.error === 'not_configured' ? 503 : result.error === 'failed' ? 502 : 400;
  return Response.json(result, { status });
};
