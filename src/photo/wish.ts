// Turning what people ask for, or what a photo showed that the app can't make, into a key to count it under.

/** A key for counting what people ask for that the app can't make yet: "Wide-leg  Jumpsuit!" is "wide-leg-jumpsuit". */
export const wishKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'unnamed';
