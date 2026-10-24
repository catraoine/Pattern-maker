/** The languages the waitlist asks about ("I sew in", Cat's L5 Ask First, 2026-10-24), so the first translation
 *  follows the sign-ups. Each is named in its own words; English first, as the app is in English at launch. */
export const SEW_LANGS = ['en', 'de', 'fr', 'es', 'it', 'nl', 'other'] as const;
export type SewLang = (typeof SEW_LANGS)[number];

export const SEW_LANG_NAME: Record<SewLang, string> = { en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano', nl: 'Nederlands', other: 'Another' };
