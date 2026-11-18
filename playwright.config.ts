import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-End-Tests gegen den GitHub-Pages-Build (npm run build:pages).
 * Lokal wird der installierte Microsoft Edge verwendet (PW_CHANNEL=chrome für Google Chrome,
 * PW_CHANNEL= leer für das mitgelieferte Chromium nach "npx playwright install chromium").
 * Jeder Test läuft in einem frischen Browser-Kontext – wie ein privates Fenster.
 */
const kanal = process.env.PW_CHANNEL ?? 'msedge';
// PW_BASE_URL=https://<benutzer>.github.io/urlaubsplaner/ testet direkt die veröffentlichte Seite
const extern = process.env.PW_BASE_URL;
const basis = extern ?? 'http://localhost:4173/urlaubsplaner/';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: basis,
    channel: kanal || undefined,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    serviceWorkers: 'allow',
  },
  webServer: extern
    ? undefined
    : {
        command: 'npm run preview:pages',
        url: basis,
        reuseExistingServer: true,
        timeout: 60_000,
      },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'handy', use: { ...devices['Pixel 7'], channel: kanal || undefined } },
  ],
});
