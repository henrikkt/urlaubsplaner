import { describe, expect, it } from 'vitest';
import {
  addiereTage,
  differenzTage,
  formatDatumLang,
  formatZeitraum,
  heuteISO,
  istGueltigesDatum,
  jedenTag,
  wochentag,
} from './datum';
import { formatEffizienz, formatZahl } from './format';

describe('Datum', () => {
  it('Wochentag ohne Zeitzoneneinfluss', () => {
    expect(wochentag('2027-05-01')).toBe(5); // Samstag
    expect(wochentag('2027-01-01')).toBe(4); // Freitag
    expect(wochentag('2027-03-28')).toBe(6); // Sonntag
  });
  it('Sommerzeit-Umstellung verschiebt nichts', () => {
    expect(addiereTage('2027-03-27', 1)).toBe('2027-03-28');
    expect(addiereTage('2027-03-28', 1)).toBe('2027-03-29');
    expect(addiereTage('2027-10-30', 2)).toBe('2027-11-01');
    expect(differenzTage('2027-03-01', '2027-04-01')).toBe(31);
  });
  it('Jahreswechsel und Schaltjahr', () => {
    expect(addiereTage('2027-12-31', 1)).toBe('2028-01-01');
    expect(addiereTage('2028-02-28', 1)).toBe('2028-02-29');
    expect(istGueltigesDatum('2027-02-29')).toBe(false);
    expect(istGueltigesDatum('2028-02-29')).toBe(true);
    expect(istGueltigesDatum('2027-13-01')).toBe(false);
    expect(istGueltigesDatum('')).toBe(false);
  });
  it('jedenTag inklusive, leer bei bis < von', () => {
    expect(jedenTag('2027-05-27', '2027-05-30')).toEqual(['2027-05-27', '2027-05-28', '2027-05-29', '2027-05-30']);
    expect(jedenTag('2027-05-30', '2027-05-27')).toEqual([]);
  });
  it('deutsche Formate', () => {
    expect(formatDatumLang('2027-05-01')).toBe('Sa, 01.05.2027');
    expect(formatZeitraum('2027-05-01', '2027-05-17')).toBe('Sa, 01.05. – Mo, 17.05.2027');
    expect(formatZeitraum('2027-12-24', '2028-01-02')).toBe('Fr, 24.12.2027 – So, 02.01.2028');
    expect(heuteISO(new Date(2026, 10, 18, 23, 59))).toBe('2026-11-18');
  });
  it('deutsche Zahlen', () => {
    expect(formatZahl(5.5)).toBe('5,5');
    expect(formatZahl(30)).toBe('30');
    expect(formatEffizienz(17 / 9)).toBe('1,9x');
    expect(formatEffizienz(53 / 30, 2)).toBe('1,77x');
    expect(formatEffizienz(null)).toBe('–');
  });
});

describe('Effizienz in Alltagssprache', () => {
  it('ganze und gerundete Werte', async () => {
    const { effizienzText, effizienzKurz } = await import('./format');
    expect(effizienzText(2)).toBe('1 Urlaubstag = 2 freie Tage');
    expect(effizienzText(4)).toBe('1 Urlaubstag = 4 freie Tage');
    expect(effizienzText(12 / 7)).toBe('1 Urlaubstag ≈ 1,7 freie Tage');
    expect(effizienzText(1)).toBe('1 Urlaubstag = 1 freier Tag');
    expect(effizienzText(null)).toBe('ohne Urlaubstag');
    expect(effizienzKurz(16 / 9)).toBe('1,8 freie Tage je Urlaubstag');
  });
});
