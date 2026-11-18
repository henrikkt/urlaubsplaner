import { loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const PORT = Number(process.env.PORT ?? 3027);

/** Strikte Content-Security-Policy: nur eigene Dateien, keine externen Quellen, keine Inline-Skripte/-Styles. */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

/** Fügt die CSP nur im Produktions-Build ein (im Dev-Modus braucht Vite Inline-Styles und -Skripte). */
function cspPlugin(): Plugin {
  return {
    name: 'urlaubsplaner-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
    },
  };
}

/**
 * Modi:
 *  - "server": lokaler Betrieb mit Express-Server (npm run start / npm run dev)
 *  - "pages":  GitHub-Pages-Build (Browser-Speicher, base /urlaubsplaner/)
 *  - sonst:    Browser-Speicher, base /
 * Umgebungsvariablen VITE_STORAGE_MODE und BASE_PATH haben Vorrang.
 */
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const speicher = env.VITE_STORAGE_MODE ?? (mode === 'server' ? 'server' : 'browser');
  if (speicher !== 'server' && speicher !== 'browser') {
    throw new Error(`VITE_STORAGE_MODE muss "server" oder "browser" sein, nicht "${speicher}".`);
  }
  const base = env.BASE_PATH ?? (mode === 'pages' ? '/urlaubsplaner/' : '/');

  return {
    base,
    plugins: [
      react(),
      cspPlugin(),
      VitePWA({
        // Im Server-Modus (lokal im WLAN) kein Service Worker – dort gleicht die App ständig mit dem Server ab
        disable: speicher === 'server',
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
        manifest: {
          id: base,
          name: 'Urlaubsplaner',
          short_name: 'Urlaubsplaner',
          description:
            'Urlaub planen mit Brückentag-Finder, Feiertagen und Schulferien für alle Bundesländer. Alle Daten bleiben auf deinem Gerät.',
          lang: 'de',
          dir: 'ltr',
          theme_color: '#1F3A5F',
          background_color: '#F5F7FA',
          display: 'standalone',
          orientation: 'any',
          start_url: base,
          scope: base,
          categories: ['productivity', 'utilities'],
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    define: {
      'import.meta.env.VITE_STORAGE_MODE': JSON.stringify(speicher),
    },
    server: {
      host: true,
      port: 5173,
      proxy: speicher === 'server' ? { '/api': `http://localhost:${PORT}` } : undefined,
    },
    preview: {
      port: 4173,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      // keine Inline-Skripte/Assets als data:-URL → strikte Content-Security-Policy möglich
      assetsInlineLimit: 0,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'scripts/**/*.test.ts'],
    },
  };
});
