#!/usr/bin/env node
/**
 * Lädt Schulferien (und zum Abgleich die Feiertage) aller 16 Bundesländer von der
 * OpenHolidays API (https://openholidaysapi.org, Daten unter ODbL-1.0) und speichert sie in src/data/.
 *
 * Aufruf:  npm run fetch-holidays            (Jahre: aktuelles Jahr −1 bis +2)
 *          npm run fetch-holidays -- 2026 2029   (eigener Bereich, inklusive)
 *
 * Die App selbst macht zur Laufzeit keine Anfragen – die JSON-Dateien werden committed.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://openholidaysapi.org';
const LAENDER = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'];
const ZIEL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function jahresbereich(argv) {
  const jetzt = new Date().getFullYear();
  const [a, b] = argv.map(Number);
  const von = Number.isInteger(a) ? a : jetzt - 1;
  const bis = Number.isInteger(b) ? b : jetzt + 2;
  if (bis < von || bis - von > 10) throw new Error(`Ungültiger Jahresbereich: ${von}–${bis}`);
  return Array.from({ length: bis - von + 1 }, (_, i) => von + i);
}

async function hole(endpunkt, params, versuch = 1) {
  const url = `${API}/${endpunkt}?${new URLSearchParams(params)}`;
  try {
    const res = await fetch(url, {
      headers: { accept: 'text/json', 'user-agent': 'urlaubsplaner-build-script' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
    const daten = await res.json();
    if (!Array.isArray(daten)) throw new Error(`Unerwartete Antwort für ${url}`);
    return daten;
  } catch (err) {
    if (versuch >= 3) throw err;
    await new Promise((r) => setTimeout(r, 1000 * versuch));
    return hole(endpunkt, params, versuch + 1);
  }
}

function name(eintrag) {
  const de = eintrag.name?.find((n) => n.language === 'DE') ?? eintrag.name?.[0];
  return String(de?.text ?? '').trim();
}

function pruefeEintrag(e) {
  if (!ISO.test(e.startDate) || !ISO.test(e.endDate) || e.endDate < e.startDate) {
    throw new Error(`Ungültiger Zeitraum in Eintrag ${e.id}: ${e.startDate}–${e.endDate}`);
  }
}

/** Erste Ferienbezeichnung groß, Jahr bei Weihnachtsferien ergänzen ("Weihnachtsferien 2027/28") */
function ferienName(text, von, bis) {
  const jVon = von.slice(0, 4);
  const jBis = bis.slice(0, 4);
  return jVon !== jBis ? `${text} ${jVon}/${jBis.slice(2)}` : text;
}

async function main() {
  const jahre = jahresbereich(process.argv.slice(2));
  console.log(`Lade Ferien und Feiertage für ${jahre[0]}–${jahre.at(-1)} …`);

  const ferien = Object.fromEntries(LAENDER.map((l) => [l, new Map()]));
  const feiertage = Object.fromEntries(LAENDER.map((l) => [l, new Map()]));
  const lokal = new Map();

  for (const jahr of jahre) {
    const zeitraum = { countryIsoCode: 'DE', languageIsoCode: 'DE', validFrom: `${jahr}-01-01`, validTo: `${jahr}-12-31` };

    for (const land of LAENDER) {
      const liste = await hole('SchoolHolidays', { ...zeitraum, subdivisionCode: `DE-${land}` });
      for (const e of liste) {
        pruefeEintrag(e);
        const n = ferienName(name(e), e.startDate, e.endDate);
        ferien[land].set(`${e.startDate}_${e.endDate}_${n}`, { name: n, von: e.startDate, bis: e.endDate });
      }
    }

    const ft = await hole('PublicHolidays', zeitraum);
    for (const e of ft) {
      pruefeEintrag(e);
      const eintrag = { datum: e.startDate, name: name(e) };
      const codes = (e.subdivisions ?? []).map((s) => s.code);
      if (e.nationwide) {
        for (const l of LAENDER) feiertage[l].set(eintrag.datum, eintrag);
        continue;
      }
      for (const code of codes) {
        const land = code.slice(3);
        if (/^DE-[A-Z]{2}$/.test(code) && LAENDER.includes(land)) feiertage[land].set(eintrag.datum, eintrag);
        else lokal.set(`${eintrag.datum}_${code}`, { ...eintrag, gebiet: code });
      }
    }
    console.log(`  ${jahr} ✓`);
  }

  // Vollständigkeit prüfen: jedes Land braucht Sommerferien in jedem Jahr
  const fehlend = [];
  for (const land of LAENDER) {
    for (const jahr of jahre) {
      const hatSommer = [...ferien[land].values()].some((f) => f.von.startsWith(String(jahr)) && /sommer/i.test(f.name));
      if (!hatSommer) fehlend.push(`${land} ${jahr}`);
    }
  }
  if (fehlend.length) console.warn(`  Hinweis: keine Sommerferien gefunden für ${fehlend.join(', ')} (evtl. noch nicht veröffentlicht)`);

  const sortiert = (m, key) => [...m.values()].sort((a, b) => a[key].localeCompare(b[key]));
  const kopf = {
    quelle: 'OpenHolidays API (https://openholidaysapi.org)',
    lizenz: 'ODbL-1.0 (https://opendatacommons.org/licenses/odbl/1-0/)',
    abgerufenAm: new Date().toISOString().slice(0, 10),
    jahre,
  };

  await mkdir(ZIEL, { recursive: true });
  await writeFile(
    path.join(ZIEL, 'schulferien.json'),
    JSON.stringify({ ...kopf, laender: Object.fromEntries(LAENDER.map((l) => [l, sortiert(ferien[l], 'von')])) }, null, 1) + '\n',
  );
  await writeFile(
    path.join(ZIEL, 'feiertage-openholidays.json'),
    JSON.stringify(
      {
        ...kopf,
        hinweis: 'Nur für den Abgleich-Test der eigenen Feiertagsregeln. Die App berechnet Feiertage selbst.',
        laender: Object.fromEntries(LAENDER.map((l) => [l, sortiert(feiertage[l], 'datum')])),
        lokal: sortiert(lokal, 'datum'),
      },
      null,
      1,
    ) + '\n',
  );
  const anzahl = LAENDER.reduce((s, l) => s + ferien[l].size, 0);
  console.log(`Fertig: ${anzahl} Ferienzeiträume, gespeichert in src/data/.`);
}

main().catch((err) => {
  console.error(`\nFehler: ${err.message}\n`);
  process.exit(1);
});
