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
    exclude: [...configDefaults.exclude, '.claude/**', 'e2e/**', 'playwright-report/**', 'test-results/**'],
  },
  // Sign-in's library gets a name of its own, so the phone's offline copy can leave it out (see globIgnores).
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => (/node_modules\/@supabase\//.test(id) ? 'account-service' : undefined),
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Maison Tracé',
        short_name: 'Maison Tracé',
        description: 'Sewing patterns drafted to your own measurements.',
        theme_color: '#000000',
        background_color: '#000000',
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
        globIgnores: ['**/assets/pdf-*.js', '**/assets/PDFButton-*.js', '**/assets/account-service-*.js'],
        // A film or download opened by its own address (e.g. /tour/walkthrough.mp4 to save it) goes to the file, not
        // the app: the saved app otherwise answers every address typed into the browser.
        navigateFallbackDenylist: [/^\/tour\//, /^\/demos\//, /\.(mp4|webm|pdf|dxf|svg|png|jpg)$/],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/assets\/(pdf|PDFButton)-.+\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'printing-code', expiration: { maxEntries: 8 } },
          },
        ],
      },
    }),
  ],
});
