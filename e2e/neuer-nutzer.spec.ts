import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const BILDER = 'e2e/screenshots';
const jahr = new Date().getFullYear() + 1;

async function bild(page: Page, name: string, projekt: string) {
  await page.screenshot({ path: `${BILDER}/${projekt}-${name}.png`, fullPage: false });
}

/** Startassistent komplett durchlaufen: zwei Personen, NRW, nächstes Jahr */
async function assistent(page: Page, projekt: string) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Willkommen beim Urlaubsplaner' })).toBeVisible();
  await bild(page, '01-assistent-start', projekt);

  await page.getByLabel('Planungsjahr').selectOption(String(jahr));
  await page.getByLabel('Bundesland').selectOption('NW');
  await page.getByRole('button', { name: 'Weiter →' }).click();

  await page.getByRole('radio', { name: /Wir zu zweit/ }).click();
  await page.getByLabel('Name Person 1').fill('Anna');
  await page.getByLabel('Name Person 2').fill('Ben');
  await bild(page, '02-assistent-personen', projekt);
  await page.getByRole('button', { name: 'Weiter →' }).click();

  // Teilzeit für Ben: Freitag abwählen
  await expect(page.getByRole('heading', { name: 'Urlaub von Ben' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Fr' }).nth(1).uncheck({ force: true });
  await page.getByRole('button', { name: 'Weiter →' }).click();

  await page.getByRole('button', { name: 'Überspringen →' }).click();
  await expect(page.getByRole('heading', { name: `Vorschläge für ${jahr}` })).toBeVisible();
  await bild(page, '03-assistent-vorschlaege', projekt);
  await page.getByRole('button', { name: /Plan (mit \d+ (Block|Blöcken) )?anlegen/ }).click();
  await expect(page.getByRole('heading', { name: `Urlaub ${jahr}` })).toBeVisible();
}

test('neuer Nutzer: Assistent, planen, neu laden, Export, Import, löschen', async ({ page }, info) => {
  const projekt = info.project.name;
  const fehler: string[] = [];
  page.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
  page.on('pageerror', (e) => fehler.push(e.message));

  await assistent(page, projekt);
  await expect(page.getByRole('heading', { name: 'Anna' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ben' })).toBeVisible();
  await expect(page.getByText('Zeit für ein Backup')).toBeVisible();
  await bild(page, '04-uebersicht', projekt);

  // Im Kalender einen Block anlegen: Start- und Endtag antippen
  await page.goto('./#/kalender');
  await expect(page.getByRole('heading', { name: new RegExp(`Kalender ${jahr}`) })).toBeVisible();
  await page.locator(`[data-datum="${jahr}-08-16"]`).click();
  await page.locator(`[data-datum="${jahr}-08-20"]`).click();
  const dialog = page.getByRole('dialog', { name: 'Neuer Urlaubsblock' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Anlass').fill('Sommerreise');
  await bild(page, '05-neuer-block', projekt);
  await dialog.getByRole('button', { name: 'Block anlegen' }).click();
  await expect(dialog).toBeHidden();
  await bild(page, '06-kalender', projekt);

  // Neu laden: Daten sind noch da
  await page.waitForTimeout(800);
  await page.reload();
  await page.goto('./#/bloecke');
  await expect(page.locator('input[value="Sommerreise"]')).toBeVisible();

  // Export
  await page.goto('./#/export');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Backup speichern' }).click()]);
  const pfad = await download.path();
  const backup = JSON.parse(await readFile(pfad!, 'utf8'));
  expect(backup.format).toBe('urlaubsplaner-backup');
  expect(backup.plaene[0].bloecke.some((b: { name: string }) => b.name === 'Sommerreise')).toBe(true);
  expect(backup.plaene[0].personen.map((p: { name: string }) => p.name)).toEqual(['Anna', 'Ben']);
  await expect(page.getByText('Zeit für ein Backup')).toBeHidden();
  await bild(page, '07-export', projekt);

  // Kaputten Import ablehnen
  await page.locator('input[type="file"]').setInputFiles({ name: 'kaputt.json', mimeType: 'application/json', buffer: Buffer.from('{"foo": 1}') });
  await expect(page.getByRole('alert')).toContainText('keine Datei des Urlaubsplaners');

  // Datenschutz: alles löschen
  await page.goto('./#/datenschutz');
  await expect(page.getByRole('heading', { name: 'Datenschutz & Daten' })).toBeVisible();
  await bild(page, '08-datenschutz', projekt);
  await page.getByRole('button', { name: 'Alle Daten auf diesem Gerät löschen' }).click();
  await page.getByRole('button', { name: 'Ja, alles löschen' }).click();
  await expect(page.getByRole('heading', { name: 'Willkommen beim Urlaubsplaner' })).toBeVisible();

  // Backup im Startassistenten wieder einspielen
  await page.locator('input[type="file"]').setInputFiles(pfad!);
  await expect(page.getByRole('heading', { name: `Urlaub ${jahr}` })).toBeVisible();
  await page.goto('./#/bloecke');
  await expect(page.locator('input[value="Sommerreise"]')).toBeVisible();

  expect(fehler, fehler.join('\n')).toEqual([]);
});

test('Varianten: standardmäßig aus, einschalten mit Erklärung, ausschalten mit Rückfrage', async ({ page }, info) => {
  const projekt = info.project.name;
  await assistent(page, `${projekt}-varianten`);

  // AUS: kein Umschalter, kein Vergleich, „schon eingeplant“ ohne Variante
  await expect(page.getByRole('radiogroup', { name: 'Aktive Variante' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Variantenvergleich' })).toHaveCount(0);
  await expect(page.getByText('schon eingeplant', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/eingeplant \(Variante/)).toHaveCount(0);
  await page.goto('./#/bloecke');
  await expect(page.getByLabel('Zählt mit?').first()).toBeVisible();
  await expect(page.getByLabel('Variante', { exact: true })).toHaveCount(0);

  // Einschalten → Erklärung, Umschalter erscheint
  await page.goto('./#/einstellungen');
  const schalter = page.getByRole('switch', { name: 'Varianten vergleichen' });
  await expect(schalter).toHaveAttribute('aria-checked', 'false');
  await schalter.click();
  await expect(schalter).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Mit Varianten kannst du zwei Planungen vergleichen')).toBeVisible();
  await bild(page, '09-varianten-an', projekt);
  await expect(page.getByRole('radiogroup', { name: 'Aktive Variante' }).first()).toBeVisible();

  // Einen Block der Variante A zuordnen
  await page.goto('./#/bloecke');
  await page.getByLabel('Variante', { exact: true }).first().selectOption({ label: 'Nur Variante A' });

  // Ausschalten → Rückfrage → parken
  await page.goto('./#/einstellungen');
  await page.getByRole('switch', { name: 'Varianten vergleichen' }).click();
  const frage = page.getByRole('dialog', { name: 'Varianten ausschalten' });
  await expect(frage).toContainText('Ein Block gehört zu einer Variante');
  await bild(page, '10-varianten-aus-frage', projekt);
  await frage.getByRole('button', { name: 'Parken' }).click();
  await expect(page.getByRole('switch', { name: 'Varianten vergleichen' })).toHaveAttribute('aria-checked', 'false');
  await page.goto('./#/bloecke');
  await expect(page.getByText('○ geparkt').first()).toBeVisible();
});

test('Reload auf einer Unterseite funktioniert (Hash-Routing)', async ({ page }) => {
  await page.goto('./#/hilfe');
  await page.reload();
  // ohne Plan erscheint der Assistent – ohne 404
  await expect(page.getByRole('heading', { name: 'Willkommen beim Urlaubsplaner' })).toBeVisible();
});

test('offline nach dem ersten Laden, Manifest und Service Worker', async ({ page, context }, info) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Willkommen beim Urlaubsplaner' })).toBeVisible();
  // Service Worker aktiv?
  await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.ready).active), null, { timeout: 15_000 });
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    return (await fetch(link.href)).json();
  });
  expect(manifest.name).toBe('Urlaubsplaner');
  expect(manifest.theme_color).toBe('#FFB088');
  expect(manifest.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Willkommen beim Urlaubsplaner' })).toBeVisible();
  await assistent(page, `${info.project.name}-offline`);
  await context.setOffline(false);
});
