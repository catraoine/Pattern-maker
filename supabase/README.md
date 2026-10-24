# Accounts (Supabase)

Sign-in is built but hidden: it shows only after opening the app with `?signin=preview` (remembered on that device;
`?signin=off` hides it again). Setting `VITE_SIGNIN=on` shows it to everyone.

## One-time setup

1. Supabase project in the Canada (Central) region. Run `schema.sql` once in the SQL Editor.
2. Authentication > URL Configuration: Site URL `https://maisontrace.co`; add `https://maisontrace.co/**`,
   `https://*--whimsical-mooncake-2cf9a9.netlify.app/**` and `http://localhost:5173/**` to the redirect URLs.
3. Authentication > Emails > Magic Link template: include the code as well as the link, so someone whose link opens
   in another browser (or outside the home-screen app) can type it in. For example:
   `<p><a href="{{ .ConfirmationURL }}">Sign in to Maison Tracé</a></p><p>Or type this code in the app: <b>{{ .Token }}</b></p>`
4. Authentication > SMTP: send through Resend (hello@maisontrace.co), so emails aren't capped at Supabase's few an hour.
5. Netlify environment variables (Production and Deploy Previews):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`: Project Settings > API (the anon key is public by design; the
     tables are protected by row level security).
   - `SUPABASE_SERVICE_ROLE_KEY`: same page, marked secret. Only the delete-account function uses it.

## How it works

- `src/cloud/api.ts`: the account service, loaded only when sign-in is shown. In development, setting localStorage
  `pattern-maker:cloud-fake` swaps in a stand-in on the device (the click-throughs in `e2e/signin.spec.ts` use it).
- `src/cloud/useCloud.ts`: on sign-in the device's work and the account's are joined (`merge.ts`: nothing dropped),
  then each change is saved to the account a moment later. Signing out keeps everything on the device.
- `netlify/functions/delete-account.mts`: checks the person's token with Supabase, then deletes the account; their
  saved work goes with it, purchase records stay without the person (needed for tax).
