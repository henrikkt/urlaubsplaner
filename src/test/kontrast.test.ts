import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { kontrastVerhaeltnis, textFarbeAuf } from '../components/ui';
import { STANDARD_FARBEN } from '../lib/types';

/**
 * WCAG-AA-Kontraste der Design-Tokens – direkt aus src/styles.css gelesen (hell und dunkel).
 * Text: ≥ 4,5:1 · große Schrift, Rahmen, Flächen und Bedienelemente: ≥ 3:1.
 */
const css = readFileSync(path.resolve(__dirname, '../styles.css'), 'utf8');

function tokensAus(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

function blockNach(start: string): string {
  const i = css.indexOf(start);
  if (i < 0) throw new Error(`Block nicht gefunden: ${start}`);
  return css.slice(i, css.indexOf('\n}', i));
}

const hell = tokensAus(blockNach(':root {'));
const dunkel = { ...hell, ...tokensAus(blockNach('@media (prefers-color-scheme: dark) {\n  :root {')) };

type Paar = [string, string, string, number];
const paare = (t: Record<string, string>): Paar[] => [
  ['Text auf Hintergrund', t.text, t.bg, 4.5],
  ['Text auf Karte', t.text, t.flaeche, 4.5],
  ['Text auf Fläche 2', t.text, t['flaeche-2'], 4.5],
  ['Nebentext auf Hintergrund', t['text-2'], t.bg, 4.5],
  ['Nebentext auf Karte', t['text-2'], t.flaeche, 4.5],
  ['Nebentext auf Fläche 2', t['text-2'], t['flaeche-2'], 4.5],
  ['Akzenttext auf Karte', t['akzent-text'], t.flaeche, 4.5],
  ['Akzenttext auf Hintergrund', t['akzent-text'], t.bg, 4.5],
  ['Akzenttext auf Akzent-hell', t['akzent-text'], t['akzent-hell'], 4.5],
  ['Text auf Akzent-hell', t.text, t['akzent-hell'], 4.5],
  ['Knopftext auf Akzent', t['akzent-auf'], t.akzent, 4.5],
  ['Knopftext auf Akzent (Hover)', t['akzent-auf'], t['akzent-hover'], 4.5],
  ['Fokusrahmen auf Hintergrund', t.fokus, t.bg, 3],
  ['Fokusrahmen auf Karte', t.fokus, t.flaeche, 3],
  ['Eingabefeld-Rand auf Karte', t['rand-feld'], t.flaeche, 3],
  ['Navigation Text', t['sb-text'], t['sb-bg-flach'], 4.5],
  ['Navigation Text (Verlaufsende)', t['sb-text'], t['sb-bg-flach-2'], 4.5],
  ['Navigation Nebentext', t['sb-text-2'], t['sb-bg-flach'], 4.5],
  ['Navigation Nebentext (Verlaufsende)', t['sb-text-2'], t['sb-bg-flach-2'], 4.5],
  ['Navigation aktiv', t['sb-aktiv-text'], t['sb-aktiv-bg'], 4.5],
  ['Countdown Text (Verlaufsanfang)', t['verlauf-text'], t['verlauf-1'], 4.5],
  ['Countdown Text (Verlaufsende)', t['verlauf-text'], t['verlauf-2'], 4.5],
  ['Countdown Nebentext (Anfang)', t['verlauf-text-2'], t['verlauf-1'], 4.5],
  ['Countdown Nebentext (Ende)', t['verlauf-text-2'], t['verlauf-2'], 4.5],
  ['Feiertag: weiße Zahl auf Rot', '#ffffff', t.feiertag, 4.5],
  ['Tageszahl auf Schulferien', t['tag-text'], t.ferien, 4.5],
  ['Tageszahl auf Wochenende', t['tag-text'], t.wochenende, 4.5],
  ['Tageszahl auf normalem Tag', t['tag-text'], t['tag-bg'], 4.5],
  ['Ferien-Warnrahmen auf Ferienfläche', t['ferien-rand'], t.ferien, 3],
  ['Tipp-Text auf Tipp-Fläche', t['tipp-text'], t['tipp-hell'], 4.5],
  ['Tipp-Rahmen auf Karte', t.tipp, t.flaeche, 3],
  ['Fehlertext auf Fehlerfläche', t.rot, t['rot-hell'], 4.5],
  ['Fehlertext auf Karte', t.rot, t.flaeche, 4.5],
  ['„noch offen“ (gelb) auf Karte', t.gelb, t.flaeche, 4.5],
  ['Gelb auf Gelb-hell', t.gelb, t['gelb-hell'], 4.5],
  ['Erfolg (grün) auf Karte', t.gruen, t.flaeche, 4.5],
  ['Erfolg (grün) auf Grün-hell', t.gruen, t['gruen-hell'], 4.5],
  ['Warnung (orange) auf Orange-hell', t.orange, t['orange-hell'], 4.5],
  ['Monat Winter (Überschrift)', t['saison-winter-text'], t.flaeche, 4.5],
  ['Monat Frühling (Überschrift)', t['saison-fruehling-text'], t.flaeche, 4.5],
  ['Monat Sommer (Überschrift)', t['saison-sommer-text'], t.flaeche, 4.5],
  ['Monat Herbst (Überschrift)', t['saison-herbst-text'], t.flaeche, 4.5],
];

/** Für den Abschlussbericht: Tabelle aller Paare */
export function kontrastTabelle() {
  return { hell: paare(hell), dunkel: paare(dunkel) };
}

describe.each([
  ['hell', hell],
  ['dunkel', dunkel],
] as const)('Kontraste %s (WCAG AA)', (_modus, t) => {
  it.each(paare(t))('%s', (_name, vorne, hinten, min) => {
    expect(vorne, 'Token fehlt').toMatch(/^#/);
    expect(hinten, 'Token fehlt').toMatch(/^#/);
    expect(kontrastVerhaeltnis(vorne, hinten)).toBeGreaterThanOrEqual(min);
  });
});

describe('Standard-Personenfarben', () => {
  const farben = Object.entries(STANDARD_FARBEN);
  it.each(farben)('%s: Tageszahl auf der Farbe ≥ 4,5:1', (_n, farbe) => {
    expect(kontrastVerhaeltnis(textFarbeAuf(farbe), farbe)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(farben)('%s: als Fläche auf heller und dunkler Karte ≥ 3:1', (_n, farbe) => {
    expect(kontrastVerhaeltnis(farbe, hell.flaeche)).toBeGreaterThanOrEqual(3);
    expect(kontrastVerhaeltnis(farbe, dunkel.flaeche)).toBeGreaterThanOrEqual(3);
  });
  it('sind untereinander und von Feiertag/Ferien gut unterscheidbar (verschiedene Farbtöne)', () => {
    const werte = new Set([...farben.map(([, f]) => f.toLowerCase()), hell.feiertag, hell.ferien]);
    expect(werte.size).toBe(5);
  });
});
