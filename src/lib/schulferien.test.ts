import { describe, expect, it } from 'vitest';
import api from '../data/feiertage-openholidays.json';
import { BUNDESLAND_CODES, feiertageFuer, REGIONALE_FEIERTAGE, type Bundesland } from './feiertage';
import { FERIEN_JAHRE, hatFerienDaten, schulferienFuer } from './schulferien';

describe('Schulferien NRW 2027 (Pflicht-Test)', () => {
  const ferien = schulferienFuer('NW', 2027);
  const finde = (name: RegExp, von: string) => ferien.find((f) => name.test(f.name) && f.von === von);

  it('Osterferien 22.03.–03.04.', () => expect(finde(/Oster/, '2027-03-22')?.bis).toBe('2027-04-03'));
  it('Pfingstferien 18.05.', () => expect(finde(/Pfingst/, '2027-05-18')?.bis).toBe('2027-05-18'));
  it('Sommerferien 19.07.–31.08.', () => expect(finde(/Sommer/, '2027-07-19')?.bis).toBe('2027-08-31'));
  it('Herbstferien 23.10.–06.11.', () => expect(finde(/Herbst/, '2027-10-23')?.bis).toBe('2027-11-06'));
  it('Weihnachtsferien ab 24.12.', () => expect(finde(/Weihnacht/, '2027-12-24')).toBeDefined());
  it('enthält auch die Weihnachtsferien vom Jahreswechsel 2026/27', () => {
    expect(ferien.some((f) => f.von < '2027-01-01' && f.bis >= '2027-01-01')).toBe(true);
  });
  it('IDs sind eindeutig und stabil', () => {
    expect(new Set(ferien.map((f) => f.id)).size).toBe(ferien.length);
    expect(schulferienFuer('NW', 2027).map((f) => f.id)).toEqual(ferien.map((f) => f.id));
  });
});

describe('Ferien-Daten für alle Länder', () => {
  it('umfassen mindestens 4 Jahre', () => expect(FERIEN_JAHRE.length).toBeGreaterThanOrEqual(4));
  it.each(BUNDESLAND_CODES)('%s hat Sommerferien in allen mitgelieferten Jahren außer evtl. dem letzten', (land) => {
    for (const jahr of FERIEN_JAHRE.slice(0, -1)) expect(hatFerienDaten(land, jahr), `${land} ${jahr}`).toBe(true);
  });
  it('alle Zeiträume sind gültig (von ≤ bis)', () => {
    for (const land of BUNDESLAND_CODES) for (const f of schulferienFuer(land, FERIEN_JAHRE[1])) expect(f.von <= f.bis).toBe(true);
  });
});

/**
 * Abgleich der eigenen Feiertagsregeln mit den Daten der OpenHolidays API.
 * Bekannte, gewollte Abweichung: Die API führt Mariä Himmelfahrt für ganz Bayern.
 * Gesetzlich gilt sie dort nur in Gemeinden mit überwiegend katholischer Bevölkerung –
 * deshalb ist sie bei uns ein regionaler Feiertag, der für Bayern standardmäßig angehakt ist.
 */
describe('Abgleich mit der OpenHolidays API', () => {
  const laender = api.laender as Record<Bundesland, { datum: string; name: string }[]>;
  const standardRegional = REGIONALE_FEIERTAGE.filter((r) => r.standard).map((r) => r.id);

  for (const jahr of api.jahre) {
    it.each(BUNDESLAND_CODES)(`%s ${jahr}: gleiche Feiertage wie die API`, (land) => {
      const erwartet = laender[land].filter((f) => f.datum.startsWith(String(jahr))).map((f) => f.datum);
      const eigene = feiertageFuer(land, jahr, standardRegional).map((f) => f.datum);
      expect(eigene).toEqual(erwartet);
    });
  }

  it('lokale Feiertage der API sind als regionale Option vorhanden (Augsburger Friedensfest)', () => {
    const lokal = api.lokal as { datum: string; gebiet: string }[];
    expect(lokal.some((f) => f.gebiet === 'DE-BY-AU' && f.datum.endsWith('-08-08'))).toBe(true);
    expect(REGIONALE_FEIERTAGE.some((r) => r.id === 'BY-AUGSBURGER-FRIEDENSFEST')).toBe(true);
  });
});
