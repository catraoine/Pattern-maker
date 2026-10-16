// Server side only: checks fit notes a sewist chose to send, before they're stored. Imported by the Netlify function.
import { z } from 'zod';
import { NOTES_MAX } from '../fit';

export const MAX_REPORT_BYTES = 8_000;

const area = z.union([z.literal(-1), z.literal(0), z.literal(1)]);

export const FitReportSchema = z
  .object({
    garment: z.enum(['skirt', 'bodice']),
    // Style choices vary by garment and grow over time; keep them as sent, the size cap bounds them.
    choices: z.record(z.string(), z.unknown()),
    verdict: z.enum(['good', 'tweaks', 'off']),
    made: z.enum(['toile', 'garment']),
    areas: z.partialRecord(z.enum(['waist', 'hip', 'length', 'flare', 'bust', 'shoulders', 'armholes', 'neckline', 'back']), area),
    notes: z.string().max(NOTES_MAX),
    measurements: z.record(z.string().max(40), z.number().min(0).max(400)),
  })
  .strict();

export type CheckedReport = z.infer<typeof FitReportSchema>;

/** The report to store, or null when the body isn't a fit report (or is too big to be one). */
export function checkFitReport(text: string): CheckedReport | null {
  if (new TextEncoder().encode(text).length > MAX_REPORT_BYTES) return null;
  try {
    const r = FitReportSchema.safeParse(JSON.parse(text));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
