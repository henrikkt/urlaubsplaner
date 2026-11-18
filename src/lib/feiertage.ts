import { addiereTage, baue, wochentag } from './datum';
import type { Feiertag, ISODatum } from './types';

// ---------------------------------------------------------------------------
// Bundesländer
// ---------------------------------------------------------------------------

export const BUNDESLAENDER = [
  { code: 'BW', name: 'Baden-Württemberg' },
  { code: 'BY', name: 'Bayern' },
  { code: 'BE', name: 'Berlin' },
  { code: 'BB', name: 'Brandenburg' },
  { code: 'HB', name: 'Bremen' },
  { code: 'HH', name: 'Hamburg' },
  { code: 'HE', name: 'Hessen' },
  { code: 'MV', name: 'Mecklenburg-Vorpommern' },
  { code: 'NI', name: 'Niedersachsen' },
  { code: 'NW', name: 'Nordrhein-Westfalen' },
  { code: 'RP', name: 'Rheinland-Pfalz' },
  { code: 'SL', name: 'Saarland' },
  { code: 'SN', name: 'Sachsen' },
  { code: 'ST', name: 'Sachsen-Anhalt' },
  { code: 'SH', name: 'Schleswig-Holstein' },
  { code: 'TH', name: 'Thüringen' },
] as const;

export type Bundesland = (typeof BUNDESLAENDER)[number]['code'];
export const BUNDESLAND_CODES: readonly Bundesland[] = BUNDESLAENDER.map((b) => b.code);

export function bundeslandName(code: Bundesland): string {
  return BUNDESLAENDER.find((b) => b.code === code)?.name ?? code;
}

export function istBundesland(x: unknown): x is Bundesland {
  return typeof x === 'string' && (BUNDESLAND_CODES as readonly string[]).includes(x);
}

// ---------------------------------------------------------------------------
// Osterformel
// ---------------------------------------------------------------------------

/** Ostersonntag nach dem "Anonymous Gregorian algorithm" (Meeus/Jones/Butcher). */
export function ostersonntag(jahr: number): ISODatum {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return baue(jahr, monat, tag);
}

/** Buß- und Bettag: Mittwoch vor dem 23. November (also zwischen 16. und 22.11.). */
export function bussUndBettag(jahr: number): ISODatum {
  const d23 = baue(jahr, 11, 23);
  // wochentag: 0 = Mo … 2 = Mi … 6 = So
  const zurueck = ((wochentag(d23) - 2 + 7) % 7) || 7;
  return addiereTage(d23, -zurueck);
}

// ---------------------------------------------------------------------------
// Gesetzliche Feiertage je Bundesland
// ---------------------------------------------------------------------------

type Regel = {
  name: string;
  datum: (jahr: number, ostern: ISODatum) => ISODatum;
  /** Bundesländer, in denen der Tag gilt; undefined = bundesweit */
  laender?: readonly Bundesland[];
  /** Gilt erst ab diesem Jahr (bzw. bis zu diesem Jahr) */
  ab?: number;
  bis?: number;
  /** Nur in einzelnen Jahren bundesweit (z. B. 500 Jahre Reformation 2017) */
  nurJahre?: readonly number[];
};

const fest = (monat: number, tag: number) => (jahr: number) => baue(jahr, monat, tag);
const ostern = (versatz: number) => (_jahr: number, o: ISODatum) => addiereTage(o, versatz);

const REFORMATIONSTAG_ALT: readonly Bundesland[] = ['BB', 'MV', 'SN', 'ST', 'TH'];
const REFORMATIONSTAG_NEU: readonly Bundesland[] = ['HB', 'HH', 'NI', 'SH'];

const REGELN: readonly Regel[] = [
  { name: 'Neujahr', datum: fest(1, 1) },
  { name: 'Heilige Drei Könige', datum: fest(1, 6), laender: ['BW', 'BY', 'ST'] },
  { name: 'Internationaler Frauentag', datum: fest(3, 8), laender: ['BE'], ab: 2019 },
  { name: 'Internationaler Frauentag', datum: fest(3, 8), laender: ['MV'], ab: 2023 },
  { name: 'Karfreitag', datum: ostern(-2) },
  { name: 'Ostersonntag', datum: ostern(0), laender: ['BB'] },
  { name: 'Ostermontag', datum: ostern(1) },
  { name: 'Tag der Arbeit', datum: fest(5, 1) },
  { name: 'Christi Himmelfahrt', datum: ostern(39) },
  { name: 'Pfingstsonntag', datum: ostern(49), laender: ['BB'] },
  { name: 'Pfingstmontag', datum: ostern(50) },
  { name: 'Fronleichnam', datum: ostern(60), laender: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL'] },
  // Einmalige Feiertage in Berlin
  { name: 'Tag der Befreiung', datum: fest(5, 8), laender: ['BE'], nurJahre: [2020, 2025] },
  { name: '75. Jahrestag des Volksaufstands vom 17. Juni 1953', datum: fest(6, 17), laender: ['BE'], nurJahre: [2028] },
  { name: 'Mariä Himmelfahrt', datum: fest(8, 15), laender: ['SL'] },
  { name: 'Weltkindertag', datum: fest(9, 20), laender: ['TH'], ab: 2019 },
  { name: 'Tag der Deutschen Einheit', datum: fest(10, 3) },
  { name: 'Reformationstag', datum: fest(10, 31), laender: REFORMATIONSTAG_ALT },
  { name: 'Reformationstag', datum: fest(10, 31), laender: REFORMATIONSTAG_NEU, ab: 2018 },
  {
    name: 'Reformationstag',
    datum: fest(10, 31),
    nurJahre: [2017],
    laender: ['BW', 'BY', 'BE', 'HB', 'HH', 'HE', 'NI', 'NW', 'RP', 'SL', 'SH'],
  },
  { name: 'Allerheiligen', datum: fest(11, 1), laender: ['BW', 'BY', 'NW', 'RP', 'SL'] },
  { name: 'Buß- und Bettag', datum: (j) => bussUndBettag(j), laender: ['SN'] },
  { name: '1. Weihnachtstag', datum: fest(12, 25) },
  { name: '2. Weihnachtstag', datum: fest(12, 26) },
];

function regelGilt(r: Regel, land: Bundesland, jahr: number): boolean {
  if (r.nurJahre && !r.nurJahre.includes(jahr)) return false;
  if (r.ab !== undefined && jahr < r.ab) return false;
  if (r.bis !== undefined && jahr > r.bis) return false;
  return !r.laender || r.laender.includes(land);
}

// ---------------------------------------------------------------------------
// Regionale Feiertage (nur in Teilen eines Landes, in den Einstellungen wählbar)
// ---------------------------------------------------------------------------

export interface RegionalerFeiertag {
  id: string;
  land: Bundesland;
  name: string;
  /** Wo der Tag gilt – kurz und verständlich */
  gebiet: string;
  datum: (jahr: number) => ISODatum;
  /** Im Startassistenten vorausgewählt (gilt für die Mehrheit im Land) */
  standard: boolean;
}

export const REGIONALE_FEIERTAGE: readonly RegionalerFeiertag[] = [
  {
    id: 'BY-MARIAE-HIMMELFAHRT',
    land: 'BY',
    name: 'Mariä Himmelfahrt',
    gebiet: 'Gemeinden mit überwiegend katholischer Bevölkerung (die meisten in Bayern)',
    datum: fest(8, 15),
    standard: true,
  },
  {
    id: 'BY-AUGSBURGER-FRIEDENSFEST',
    land: 'BY',
    name: 'Augsburger Hohes Friedensfest',
    gebiet: 'nur im Stadtgebiet Augsburg',
    datum: fest(8, 8),
    standard: false,
  },
  {
    id: 'SN-FRONLEICHNAM',
    land: 'SN',
    name: 'Fronleichnam',
    gebiet: 'einige Gemeinden im sorbischen Siedlungsgebiet (Landkreis Bautzen)',
    datum: (j) => addiereTage(ostersonntag(j), 60),
    standard: false,
  },
  {
    id: 'TH-FRONLEICHNAM',
    land: 'TH',
    name: 'Fronleichnam',
    gebiet: 'Landkreis Eichsfeld sowie einige Gemeinden im Unstrut-Hainich- und Wartburgkreis',
    datum: (j) => addiereTage(ostersonntag(j), 60),
    standard: false,
  },
];

export function regionaleFeiertageFuer(land: Bundesland): RegionalerFeiertag[] {
  return REGIONALE_FEIERTAGE.filter((r) => r.land === land);
}

/**
 * Gesetzliche Feiertage eines Bundeslands, chronologisch sortiert.
 * `regional` enthält IDs aus REGIONALE_FEIERTAGE, die zusätzlich gelten sollen
 * (IDs anderer Länder werden ignoriert).
 */
export function feiertageFuer(land: Bundesland, jahr: number, regional: readonly string[] = []): Feiertag[] {
  const o = ostersonntag(jahr);
  const liste: Feiertag[] = REGELN.filter((r) => regelGilt(r, land, jahr)).map((r) => ({
    datum: r.datum(jahr, o),
    name: r.name,
  }));
  for (const r of REGIONALE_FEIERTAGE) {
    if (r.land !== land || !regional.includes(r.id)) continue;
    const datum = r.datum(jahr);
    if (!liste.some((f) => f.datum === datum)) liste.push({ datum, name: r.name });
  }
  return liste.sort((x, y) => x.datum.localeCompare(y.datum));
}

/** @deprecated Übergang – wird durch feiertageFuer(land, jahr) ersetzt. */
export function feiertageNRW(jahr: number): Feiertag[] {
  return feiertageFuer('NW', jahr);
}
