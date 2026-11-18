import type { ISODatum } from './types';

/*
 * Alle Datumsrechnungen laufen über "Tageszahlen" (Tage seit 1970-01-01, UTC).
 * Es werden nie lokale Uhrzeiten verwendet, dadurch gibt es keine Zeitzonen-
 * oder Sommerzeitfehler.
 */

const MS_PRO_TAG = 86_400_000;
const ISO_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export const WOCHENTAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
export const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;
export const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'] as const;

export function istGueltigesDatum(s: unknown): s is ISODatum {
  if (typeof s !== 'string') return false;
  const m = ISO_REGEX.exec(s);
  if (!m) return false;
  const j = Number(m[1]);
  const mo = Number(m[2]);
  const t = Number(m[3]);
  if (mo < 1 || mo > 12 || t < 1) return false;
  return t <= tageImMonat(j, mo);
}

export function zerlege(d: ISODatum): { jahr: number; monat: number; tag: number } {
  const m = ISO_REGEX.exec(d);
  if (!m) throw new Error(`Ungültiges Datum: ${d}`);
  return { jahr: Number(m[1]), monat: Number(m[2]), tag: Number(m[3]) };
}

export function baue(jahr: number, monat: number, tag: number): ISODatum {
  return `${String(jahr).padStart(4, '0')}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
}

export function zuTageszahl(d: ISODatum): number {
  const { jahr, monat, tag } = zerlege(d);
  return Math.round(Date.UTC(jahr, monat - 1, tag) / MS_PRO_TAG);
}

export function ausTageszahl(n: number): ISODatum {
  const dt = new Date(n * MS_PRO_TAG);
  return baue(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addiereTage(d: ISODatum, tage: number): ISODatum {
  return ausTageszahl(zuTageszahl(d) + tage);
}

/** b − a in Tagen */
export function differenzTage(a: ISODatum, b: ISODatum): number {
  return zuTageszahl(b) - zuTageszahl(a);
}

/** 0 = Montag … 6 = Sonntag */
export function wochentag(d: ISODatum): number {
  // 1970-01-01 war ein Donnerstag (Index 3)
  return (((zuTageszahl(d) + 3) % 7) + 7) % 7;
}

export function istWochenende(d: ISODatum): boolean {
  return wochentag(d) >= 5;
}

export function jahrVon(d: ISODatum): number {
  return zerlege(d).jahr;
}

export function monatVon(d: ISODatum): number {
  return zerlege(d).monat;
}

export function tageImMonat(jahr: number, monat: number): number {
  return new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
}

/** Alle Tage von..bis (inklusive). Leer, wenn bis < von oder ungültig. */
export function jedenTag(von: ISODatum, bis: ISODatum): ISODatum[] {
  if (!istGueltigesDatum(von) || !istGueltigesDatum(bis)) return [];
  const a = zuTageszahl(von);
  const b = zuTageszahl(bis);
  const out: ISODatum[] = [];
  for (let n = a; n <= b; n++) out.push(ausTageszahl(n));
  return out;
}

/** Heutiges Datum als ISO-String – bewusst nach lokalem Kalendertag, aber ohne Uhrzeit-Rechnung. */
export function heuteISO(jetzt: Date = new Date()): ISODatum {
  return baue(jetzt.getFullYear(), jetzt.getMonth() + 1, jetzt.getDate());
}

/** "Sa, 01.05.2027" */
export function formatDatumLang(d: ISODatum): string {
  if (!istGueltigesDatum(d)) return '–';
  const { jahr, monat, tag } = zerlege(d);
  return `${WOCHENTAGE_KURZ[wochentag(d)]}, ${pad(tag)}.${pad(monat)}.${jahr}`;
}

/** "01.05.2027" */
export function formatDatum(d: ISODatum): string {
  if (!istGueltigesDatum(d)) return '–';
  const { jahr, monat, tag } = zerlege(d);
  return `${pad(tag)}.${pad(monat)}.${jahr}`;
}

/** "Sa, 01.05." */
export function formatDatumKurz(d: ISODatum): string {
  if (!istGueltigesDatum(d)) return '–';
  const { monat, tag } = zerlege(d);
  return `${WOCHENTAGE_KURZ[wochentag(d)]}, ${pad(tag)}.${pad(monat)}.`;
}

/** "Sa, 01.05. – Mo, 17.05.2027" */
export function formatZeitraum(von: ISODatum, bis: ISODatum): string {
  if (!istGueltigesDatum(von) || !istGueltigesDatum(bis)) return '–';
  if (jahrVon(von) === jahrVon(bis)) return `${formatDatumKurz(von)} – ${formatDatumLang(bis)}`;
  return `${formatDatumLang(von)} – ${formatDatumLang(bis)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
