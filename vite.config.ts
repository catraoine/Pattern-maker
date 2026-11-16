/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { version } from './package.json';

export default defineConfig({
  // Crash reports carry the app version and build, so a fix can be matched to the build it went out in.
  define: {
    __APP_VERSION__: JSON.stringify(`${version}+${(process.env.COMMIT_REF ?? 'dev').slice(0, 7)}`),
  },
  // Unit tests only: the Playwright click-throughs in e2e/ run with `npm run test:e2e`.
  test: {
    // The random-body sweeps run for 10 to 40 seconds each. The old test runner (Vitest 2) never stopped a test that
    // didn't pause, so its 5 second default was never applied to them; Vitest 4 applies it. Two minutes keeps them as they were.
    testTimeout: 120_000,
    exclude: [...configDefaults.exclude, '.claude/**', 'e2e/**', 'playwright-report/**', 'test-results/**'],
  },
  // Sign-in's library, and the 3D drawing's, get names of their own, so the phone's offline copy can leave them out
  // (see globIgnores).
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => (/node_modules\/@supabase\//.test(id) ? 'account-service' : /node_modules\/three\//.test(id) ? 'round-3d' : undefined),
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered by the app itself (keepOffline in src/swUpdate.ts), and only once someone is past the waitlist.
      injectRegister: false,
      includeAssets: ['icon.svg', 'favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Maison Tracé',
        short_name: 'Maison Tracé',
        description: 'Sewing patterns drafted to your own measurements.',
        theme_color: '#120805',
        background_color: '#120805',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2}'],
        // The printing code (about 1.4 MB) isn't saved to the phone on the first visit: it downloads the first time
        // someone prints, then stays for offline use. Keeps a first visit light for Netlify bandwidth (Cat, 2026-10-23).
        // The account service's code (sign-in, about 230 kB) needs the internet anyway, so it isn't kept either.
        // Fabric and print photos (about 1.5 MB) are saved the first time the Fabric tab shows them, not on the first visit.
        // The 3D drawing's library (All round, about 140 kB) downloads the first time All round opens, then stays.
        // The house prints' tiles (src/prints) are left out the same way.
        globIgnores: ['**/assets/pdf-*.js', '**/assets/PDFButton-*.js', '**/assets/account-service-*.js', '**/assets/round-3d-*.js', '**/assets/*.jpg', 'fabrics/**', 'prints/**'],
        // A film or download opened by its own address (e.g. /tour/walkthrough.mp4 to save it) goes to the file, not
        // the app: the saved app otherwise answers every address typed into the browser.
        // A new release takes over as soon as it has downloaded, and takes the open page with it (keepUpToDate in
        // src/swUpdate.ts then reloads once). Without these it waited behind the old one until every copy of the app
        // was closed, which a home-screen app on a phone rarely is: Cat's showed a two-release-old welcome page (Nov 15).
        skipWaiting: true,
        clientsClaim: true,
        navigateFallbackDenylist: [/^\/tour\//, /^\/demos\//, /\.(mp4|webm|pdf|dxf|svg|png|jpg)$/],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/assets\/(pdf|PDFButton|round-3d)-.+\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'printing-code', expiration: { maxEntries: 8 } },
          },
          // A photo at a fixed address is shown from the phone's copy at once and fetched again behind it, so a
          // photo changed in a release reaches the phone on its next visit: kept for good (CacheFirst), the house
          // leopard tile stayed slanted on Cat's phone two days after it was straightened (Nov 14).
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/(fabrics|prints)\/.+\.jpg$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fabric-photos', expiration: { maxEntries: 120 } },
          },
          // A house print's tile, its address fingerprinted (src/prints): a changed tile has a new address, so the copy
          // kept can stay for good.
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/assets\/.+\.jpg$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'house-prints', expiration: { maxEntries: 8 } },
          },
        ],
      },
    }),
  ],
});
