// The measuring tape that travels from the welcome across the first measuring page is for the How it works film only
// (Cat, Nov 14: out of the app, kept in the film for its drama). The film's recorder sets this before it starts.
export const filmTape = () => !!(window as Window & { __filmTape?: boolean }).__filmTape;
