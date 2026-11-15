// The measuring tape that travels from the welcome across the first measuring page is for the How it works film only
// (Cat, Nov 14: out of the app, kept in the film for its drama). The film's recorder sets this before it starts.
export const filmTape = () => !!(window as Window & { __filmTape?: boolean }).__filmTape;
// The film draws All round on black (Cat, Nov 15: keep All round on a black background); the recorder sets this too.
export const filmDark = () => !!(window as Window & { __tourFilmDark?: boolean }).__tourFilmDark;
