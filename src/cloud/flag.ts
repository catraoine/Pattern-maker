// Accounts (Cat's sign-in plan, 2026-10-23) are built but held back until the fix week of 7 to 13 December. Until then
// they show only once the address has had ?signin=preview, remembered on this device; ?signin=off hides them again.
// Turn them on for everyone with VITE_SIGNIN=on. They also need VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set.
const KEY = 'pattern-maker:signin-preview';

const SIGNIN_ON = import.meta.env.VITE_SIGNIN === 'on';
export const SUPABASE_URL: string | undefined = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY;

function signinPreview(search = typeof location === 'undefined' ? '' : location.search): boolean {
  const asked = new URLSearchParams(search).get('signin');
  try {
    if (asked === 'preview') localStorage.setItem(KEY, '1');
    if (asked === 'off') localStorage.removeItem(KEY);
    return asked === 'preview' || (asked !== 'off' && localStorage.getItem(KEY) === '1');
  } catch {
    return asked === 'preview';
  }
}

/** A sign-in link from the email, which may open in a browser that never had ?signin=preview. */
export const signinArriving = (hash = typeof location === 'undefined' ? '' : location.hash) => /(^#|&)(access_token|error_description)=/.test(hash);

/** Whether Your account offers signing in. Read once, when the app loads, before it tidies the address. */
export const signinShown = SIGNIN_ON || signinPreview() || signinArriving();
