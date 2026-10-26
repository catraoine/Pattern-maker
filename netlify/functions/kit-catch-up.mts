// Every hour: sends Kit the waitlist sign-ups it didn't take at the time (kept by signup.mts in the "kit-retry"
// store), at most 50 a run so the catch-up stays under Kit's rate limit. Nothing to do on a normal day.
import { getStore } from '@netlify/blobs';
import { retryKit, type KitRetry, type RetryStore } from '../../src/server/kit';

// Provided by the Netlify runtime.
declare const Netlify: { env: { get(name: string): string | undefined } };

export default async () => {
  const blobs = getStore({ name: 'kit-retry', consistency: 'strong' });
  const store: RetryStore = {
    list: async () => (await blobs.list()).blobs.map((b) => b.key),
    get: async (key) => ((await blobs.get(key, { type: 'json' })) as KitRetry | null) ?? undefined,
    set: async (key, value) => void (await blobs.setJSON(key, value)),
    delete: (key) => blobs.delete(key),
  };
  const sent = await retryKit(store, { apiKey: Netlify.env.get('KIT_API_KEY'), formId: Netlify.env.get('KIT_FORM_ID') }, Netlify.env.get('URL') ?? 'https://maisontrace.co');
  if (sent) console.log(`kit catch-up sent ${sent}`);
};

export const config = { schedule: '@hourly' };
