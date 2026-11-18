import { expect, test, type Page } from '@playwright/test';

/**
 * Layout-Prüfung der Formulare auf schmalen Bildschirmen:
 *  - nebeneinanderliegende Felder: Eingaben haben dieselbe Oberkante (einspaltig: sauber untereinander)
 *  - Wochentag-Auswahl: alle 7 Tage in einer Zeile, mindestens 44 px hoch
 *  - kein Auswahlfeld schneidet seinen Text ab (scrollWidth ≤ clientWidth und gemessene Textbreite)
 *  - Eingabefelder mit mindestens 16 px Schrift (sonst zoomt iOS beim Antippen)
 *  - keine waagerechte Scrollleiste
 */
const jahr = new Date().getFullYear() + 1;

async function layoutProbleme(page: Page, wo: string): Promise<string[]> {
  const probleme = await page.evaluate(() => {
    const out: string[] = [];
    const sichtbar = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const name = (el: Element) =>
      (el.querySelector('label, legend')?.textContent ?? el.getAttribute('aria-label') ?? el.tagName).trim().slice(0, 40);

    // 1) Feld-Reihen: Eingaben bündig bzw. untereinander
    for (const reihe of document.querySelectorAll('.feld-reihe, .editor-oben')) {
      if (!sichtbar(reihe)) continue;
      const felder = [...reihe.children].filter((c) => c.classList.contains('feld') && sichtbar(c));
      const daten = felder
        .map((f) => {
          const eingabe = f.querySelector('input:not([type="checkbox"]):not([type="file"]), select, textarea, .farbe-feld');
          if (!eingabe) return null;
          const fr = f.getBoundingClientRect();
          const er = eingabe.getBoundingClientRect();
          return { name: name(f), links: fr.left, rechts: fr.right, oben: fr.top, unten: fr.bottom, eingabeOben: er.top };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null);
      for (let i = 0; i < daten.length; i++) {
        for (let j = i + 1; j < daten.length; j++) {
          const a = daten[i];
          const b = daten[j];
          const nebeneinander = a.oben < b.unten && b.oben < a.unten && (a.rechts <= b.links + 1 || b.rechts <= a.links + 1);
          if (nebeneinander && Math.abs(a.eingabeOben - b.eingabeOben) > 1) {
            out.push(`nicht bündig: „${a.name}“ (${a.eingabeOben.toFixed(0)}) vs. „${b.name}“ (${b.eingabeOben.toFixed(0)})`);
          }
          const ueberlappen = a.oben < b.unten - 1 && b.oben < a.unten - 1 && a.links < b.rechts - 1 && b.links < a.rechts - 1;
          if (ueberlappen) out.push(`Felder überlappen: „${a.name}“ und „${b.name}“`);
        }
      }
    }

    // 2) Wochentage: eine Zeile, ≥ 44 px hoch, nicht schmaler als ihr Text
    for (const gruppe of document.querySelectorAll('.wochentage-wahl')) {
      if (!sichtbar(gruppe)) continue;
      const tage = [...gruppe.querySelectorAll('span')].map((s) => s.getBoundingClientRect());
      if (tage.length !== 7) out.push(`Wochentage: ${tage.length} statt 7`);
      if (new Set(tage.map((r) => Math.round(r.top))).size !== 1) out.push('Wochentage nicht in einer Zeile');
      if (tage.some((r) => r.height < 44)) out.push(`Wochentag niedriger als 44 px (${Math.min(...tage.map((r) => r.height))})`);
      for (const s of gruppe.querySelectorAll('span')) if (s.scrollWidth > s.clientWidth) out.push(`Wochentag „${s.textContent}“ abgeschnitten`);
    }

    // 3) Auswahlfelder schneiden nichts ab
    const leinwand = document.createElement('canvas').getContext('2d')!;
    for (const sel of document.querySelectorAll('select')) {
      if (!sichtbar(sel)) continue;
      if (sel.scrollWidth > sel.clientWidth) out.push(`Select scrollWidth > clientWidth: ${sel.getAttribute('aria-label') ?? sel.id}`);
      const st = getComputedStyle(sel);
      leinwand.font = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      const platz = sel.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
      for (const opt of sel.options) {
        const breite = leinwand.measureText(opt.text).width;
        if (breite > platz + 0.5) out.push(`Option abgeschnitten: „${opt.text}“ (${breite.toFixed(0)} > ${platz.toFixed(0)} px)`);
      }
    }

    // 4) Schriftgröße ≥ 16 px in Eingabefeldern
    for (const el of document.querySelectorAll('input:not([type="checkbox"]):not([type="file"]):not([type="color"]), select, textarea')) {
      if (!sichtbar(el)) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px < 16) out.push(`Schrift < 16 px (${px}) in ${el.getAttribute('aria-label') ?? el.id ?? el.tagName}`);
    }

    // 5) keine waagerechte Scrollleiste
    if (document.documentElement.scrollWidth > window.innerWidth + 1) {
      out.push(`Seite breiter als Bildschirm: ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
    }
    return out;
  });
  return probleme.map((p) => `${wo}: ${p}`);
}

async function allesPruefen(page: Page): Promise<string[]> {
  const probleme: string[] = [];
  const pruefe = async (wo: string) => probleme.push(...(await layoutProbleme(page, wo)));

  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Willkommen beim Urlaubsplaner' })).toBeVisible();
  await page.getByLabel('Planungsjahr').selectOption(String(jahr));
  await page.getByLabel('Bundesland').selectOption('MV'); // längster Name: Mecklenburg-Vorpommern
  await pruefe('Assistent Plan');
  await page.getByRole('button', { name: 'Weiter →' }).click();
  await page.getByRole('radio', { name: /Wir zu zweit/ }).click();
  await page.getByLabel('Name Person 1').fill('Leon');
  await page.getByLabel('Name Person 2').fill('Tate');
  await pruefe('Assistent Personen');
  await page.getByRole('button', { name: 'Weiter →' }).click();
  await expect(page.getByRole('heading', { name: 'Urlaub von Leon' })).toBeVisible();
  await pruefe('Assistent Urlaub');
  await page.getByRole('button', { name: 'Weiter →' }).click();
  await page.getByRole('button', { name: /\+ Besonderen Tag/ }).click();
  await pruefe('Assistent Besondere Tage');
  await page.getByRole('button', { name: 'Weiter →' }).click();
  await pruefe('Assistent Vorschläge');
  await page.getByRole('button', { name: /Plan (mit \d+ (Block|Blöcken) )?anlegen/ }).click();
  await expect(page.getByRole('heading', { name: `Urlaub ${jahr}` })).toBeVisible();

  await page.goto('./#/einstellungen');
  await page.getByRole('switch', { name: 'Varianten vergleichen' }).click();
  await page.getByRole('button', { name: '+ Besonderer Tag' }).click();
  await pruefe('Einstellungen');

  await page.goto('./#/bloecke');
  await pruefe('Blöcke');
  await page.getByRole('button', { name: '+ Neuer Block' }).click();
  await expect(page.getByRole('dialog', { name: 'Neuer Urlaubsblock' })).toBeVisible();
  await pruefe('Dialog neuer Block');
  await page.getByRole('button', { name: 'Abbrechen' }).click();

  await page.goto('./#/export');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Backup speichern' }).click()]);
  await page.locator('input[type="file"]').first().setInputFiles((await download.path())!);
  await expect(page.getByRole('dialog', { name: 'Backup einspielen' })).toBeVisible();
  await pruefe('Import');
  return probleme;
}

test.describe('Formular-Layout bei 375 px (iPhone)', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('Felder bündig, Wochentage in einer Zeile, nichts abgeschnitten', async ({ page }) => {
    expect(await allesPruefen(page)).toEqual([]);
  });
});

for (const breite of [320, 430, 600, 1024]) {
  test.describe(`Formular-Layout bei ${breite} px`, () => {
    test.use({ viewport: { width: breite, height: 900 } });
    test('ohne Layout-Fehler', async ({ page }) => {
      expect(await allesPruefen(page)).toEqual([]);
    });
  });
}
