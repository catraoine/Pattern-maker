# Accounts (Supabase)

Sign-in is built but hidden: it shows only after opening the app with `?signin=preview` (remembered on that device;
`?signin=off` hides it again). Setting `VITE_SIGNIN=on` shows it to everyone.

## One-time setup

1. Supabase project in the Canada (Central) region. Run `schema.sql` once in the SQL Editor.
2. Authentication > URL Configuration: Site URL `https://maisontrace.co`; add `https://maisontrace.co/**`,
   `https://*--whimsical-mooncake-2cf9a9.netlify.app/**` and `http://localhost:5173/**` to the redirect URLs.
3. Authentication > Emails > Magic Link template, AND the Confirm sign up template (Supabase sends that one the first
   time an address signs in, Magic Link after that): include the code as well as the link, so someone whose link opens
   in another browser (or outside the home-screen app) can type it in. For example:
   `<p><a href="{{ .ConfirmationURL }}">Sign in to Maison Tracé</a></p><p>Or type this code in the app: <b>{{ .Token }}</b></p>`
4. Authentication > SMTP: send through Resend (hello@maisontrace.co), so emails aren't capped at Supabase's few an hour.
5. Netlify environment variables (Production and Deploy Previews):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`: Project Settings > API Keys (the anon or "publishable" key is
     public by design; the tables are protected by row level security).
   - `SUPABASE_SERVICE_ROLE_KEY`: same page (the service_role or "secret" key), marked secret, Functions scope. Only
     the delete-account function uses it.

Cat's step-by-step version with copy boxes is in the sign-in plan doc (https://claude.ai/artifact/Umkh95rUig67QkUpwXxAUz).

## How it works

- `src/cloud/api.ts`: the account service, loaded only when sign-in is shown. In development, setting localStorage
  `pattern-maker:cloud-fake` swaps in a stand-in on the device (the click-throughs in `e2e/signin.spec.ts` use it).
- `src/cloud/useCloud.ts` and `sync.ts`: on sign-in the device's work and the account's are joined (`merge.ts`:
  nothing dropped on a first sign-in), then each change starts another round a moment later: read the account's copy,
  join it with this device's against what the two last agreed on (kept on the device as `pattern-maker:cloud-base`),
  so a pattern or person removed on one device stays removed, and write it back only if nobody saved meanwhile
  (`updated_at` must still match; otherwise the round starts again from the newer copy). The account is also read
  again whenever the app comes back to the front or back online, so a phone and a computer can both stay signed in.
  Signing out keeps everything on the device.
- `src/legal.ts`: the privacy policy and terms carry the account wording wherever sign-in is shown, so switching on
  for everyone (`VITE_SIGNIN=on`) brings the right text with it. Bump `OWNER.effective` in that release.
- `netlify/functions/delete-account.mts`: checks the person's token with Supabase, then deletes the account; their
  saved work goes with it, purchase records stay without the person (needed for tax).
