// POST a photo (base64 JSON), get back the closest skirt style options. Needs ANTHROPIC_API_KEY set in
// Netlify: Site configuration > Environment variables.
import Anthropic from '@anthropic-ai/sdk';
import { analyzePhoto } from '../../src/photo/analyze';

// Provided by the Netlify runtime.
declare const Netlify: { env: { get(name: string): string | undefined } };

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const key = Netlify.env.get('ANTHROPIC_API_KEY');
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'bad_image' }, { status: 400 });
  }
  const result = await analyzePhoto(body as { image: string; mediaType: string }, key ? new Anthropic({ apiKey: key }) : null);
  const status = result.ok ? 200 : result.error === 'not_configured' ? 503 : result.error === 'failed' ? 502 : 400;
  return Response.json(result, { status });
};
