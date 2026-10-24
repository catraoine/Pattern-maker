/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** The app version and build (Netlify's commit), set in vite.config.ts: "0.1.0+abc1234". */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** "on" turns paid plans on (see src/plans.ts). Off until payments and sign-in exist. */
  readonly VITE_BILLING?: string;
  /** "on" shows sign-in to everyone (see src/cloud/flag.ts); otherwise only after ?signin=preview. */
  readonly VITE_SIGNIN?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
