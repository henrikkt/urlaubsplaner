import { describe, expect, it } from 'vitest';
import { formatDatumKurz } from './datum';
import {
  BUNDESLAND_CODES,
  bussUndBettag,
  feiertageFuer,
  ostersonntag,
  regionaleFeiertageFuer,
  type Bundesland,
} from './feiertage';

const daten = (land: Bundesland, jahr: number, regional: string[] = []) =>
  feiertageFuer(land, jahr, regional).map((f) => f.datum);

describe('Osterformel', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2038, '2038-04-25'],
  ])('Ostersonntag %i = %s', (jahr, datum) => {
    expect(ostersonntag(jahr)).toBe(datum);
  });
});

describe('Buß- und Bettag', () => {
  it.each([
    [2024, '2024-11-20'],
    [2025, '2025-11-19'],
    [2026, '2026-11-18'],
    [2027, '2027-11-17'],
    [2028, '2028-11-22'], // 23.11.2028 ist ein Donnerstag
    [2033, '2033-11-16'], // 23.11.2033 ist ein Mittwoch → eine Woche davor
  ])('%i = %s', (jahr, datum) => {
    expect(bussUndBettag(jahr)).toBe(datum);
  });
});

describe('NRW 2027 (Pflicht-Test)', () => {
  it('ergibt genau die 11 erwarteten Feiertage', () => {
    expect(daten('NW', 2027)).toEqual([
      '2027-01-01',
      '2027-03-26',
      '2027-03-29',
      '2027-05-01',
      '2027-05-06',
      '2027-05-17',
      '2027-05-27',
      '2027-10-03',
      '2027-11-01',
      '2027-12-25',
      '2027-12-26',
    ]);
  });
  it('mit den gewohnten Namen', () => {
    expect(feiertageFuer('NW', 2027).map((f) => `${formatDatumKurz(f.datum)} ${f.name}`)).toEqual([
      'Fr, 01.01. Neujahr',
      'Fr, 26.03. Karfreitag',
      'Mo, 29.03. Ostermontag',
      'Sa, 01.05. Tag der Arbeit',
      'Do, 06.05. Christi Himmelfahrt',
      'Mo, 17.05. Pfingstmontag',
      'Do, 27.05. Fronleichnam',
      'So, 03.10. Tag der Deutschen Einheit',
      'Mo, 01.11. Allerheiligen',
      'Sa, 25.12. 1. Weihnachtstag',
      'So, 26.12. 2. Weihnachtstag',
    ]);
  });
});

describe('Bundesweite Feiertage', () => {
  const bundesweit = ['2027-01-01', '2027-03-26', '2027-03-29', '2027-05-01', '2027-05-06', '2027-05-17', '2027-10-03', '2027-12-25', '2027-12-26'];
  it.each(BUNDESLAND_CODES)('%s 2027 enthält alle 9 bundesweiten Feiertage', (land) => {
    expect(daten(land, 2027)).toEqual(expect.arrayContaining(bundesweit));
  });
  it('Listen sind sortiert und ohne doppelte Tage', () => {
    for (const land of BUNDESLAND_CODES) {
      const d = daten(land, 2027);
      expect([...d].sort(), land).toEqual(d);
      expect(new Set(d).size, land).toBe(d.length);
    }
  });
});

describe('Sonderregeln je Bundesland (2027)', () => {
  const hat = (land: Bundesland, datum: string) => daten(land, 2027).includes(datum);

  it.each(['BW', 'BY', 'ST'] as const)('Heilige Drei Könige (06.01.) in %s', (l) => expect(hat(l, '2027-01-06')).toBe(true));
  it('Heilige Drei Könige nicht in NW', () => expect(hat('NW', '2027-01-06')).toBe(false));

  it.each(['BE', 'MV'] as const)('Frauentag (08.03.) in %s', (l) => expect(hat(l, '2027-03-08')).toBe(true));
  it('Frauentag nicht in BB', () => expect(hat('BB', '2027-03-08')).toBe(false));
  it('Frauentag in MV erst ab 2023, in BE ab 2019', () => {
    expect(daten('MV', 2022)).not.toContain('2022-03-08');
    expect(daten('BE', 2019)).toContain('2019-03-08');
    expect(daten('BE', 2018)).not.toContain('2018-03-08');
  });

  it('Ostersonntag und Pfingstsonntag nur in BB', () => {
    expect(hat('BB', '2027-03-28')).toBe(true);
    expect(hat('BB', '2027-05-16')).toBe(true);
    expect(hat('BE', '2027-03-28')).toBe(false);
    expect(hat('BE', '2027-05-16')).toBe(false);
  });

  it.each(['BW', 'BY', 'HE', 'NW', 'RP', 'SL'] as const)('Fronleichnam (27.05.) in %s', (l) =>
    expect(hat(l, '2027-05-27')).toBe(true),
  );
  it.each(['SN', 'TH', 'BE', 'NI'] as const)('Fronleichnam nicht landesweit in %s', (l) => expect(hat(l, '2027-05-27')).toBe(false));

  it('Mariä Himmelfahrt (15.08.) landesweit nur im Saarland', () => {
    expect(hat('SL', '2027-08-15')).toBe(true);
    expect(hat('BY', '2027-08-15')).toBe(false);
  });

  it('Weltkindertag (20.09.) in TH', () => {
    expect(hat('TH', '2027-09-20')).toBe(true);
    expect(hat('SN', '2027-09-20')).toBe(false);
  });

  it.each(['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH'] as const)('Reformationstag (31.10.) in %s', (l) =>
    expect(hat(l, '2027-10-31')).toBe(true),
  );
  it.each(['BW', 'BY', 'BE', 'HE', 'NW', 'RP', 'SL'] as const)('kein Reformationstag in %s', (l) =>
    expect(hat(l, '2027-10-31')).toBe(false),
  );
  it('Reformationstag 2017 bundesweit, im Norden erst ab 2018 dauerhaft', () => {
    expect(daten('NW', 2017)).toContain('2017-10-31');
    expect(daten('NW', 2018)).not.toContain('2018-10-31');
    expect(daten('NI', 2018)).toContain('2018-10-31');
  });

  it.each(['BW', 'BY', 'NW', 'RP', 'SL'] as const)('Allerheiligen (01.11.) in %s', (l) => expect(hat(l, '2027-11-01')).toBe(true));
  it('kein Allerheiligen in HE', () => expect(hat('HE', '2027-11-01')).toBe(false));

  it('Berlin: einmalige Feiertage 08.05.2025 und 17.06.2028', () => {
    expect(daten('BE', 2025)).toContain('2025-05-08');
    expect(daten('BE', 2026)).not.toContain('2026-05-08');
    expect(daten('BE', 2028)).toContain('2028-06-17');
    expect(daten('BB', 2028)).not.toContain('2028-06-17');
  });

  it('Buß- und Bettag am 17.11.2027 nur in SN', () => {
    expect(hat('SN', '2027-11-17')).toBe(true);
    expect(hat('ST', '2027-11-17')).toBe(false);
  });

  it('Anzahl je Land 2027', () => {
    const anzahl = Object.fromEntries(BUNDESLAND_CODES.map((l) => [l, daten(l, 2027).length]));
    expect(anzahl).toEqual({
      BW: 12, BY: 12, BE: 10, BB: 12, HB: 10, HH: 10, HE: 10, MV: 11,
      NI: 10, NW: 11, RP: 11, SL: 12, SN: 11, ST: 11, SH: 10, TH: 11,
    });
  });
});

describe('Regionale Feiertage', () => {
  it('Bayern bietet Mariä Himmelfahrt und das Augsburger Friedensfest an', () => {
    expect(regionaleFeiertageFuer('BY').map((r) => r.id)).toEqual(['BY-MARIAE-HIMMELFAHRT', 'BY-AUGSBURGER-FRIEDENSFEST']);
    expect(daten('BY', 2027, ['BY-MARIAE-HIMMELFAHRT'])).toContain('2027-08-15');
    expect(daten('BY', 2027, ['BY-AUGSBURGER-FRIEDENSFEST'])).toContain('2027-08-08');
  });
  it('Fronleichnam in Teilen von Sachsen und Thüringen', () => {
    expect(daten('SN', 2027, ['SN-FRONLEICHNAM'])).toContain('2027-05-27');
    expect(daten('TH', 2027, ['TH-FRONLEICHNAM'])).toContain('2027-05-27');
  });
  it('IDs anderer Länder werden ignoriert', () => {
    expect(daten('NW', 2027, ['BY-AUGSBURGER-FRIEDENSFEST'])).not.toContain('2027-08-08');
  });
});
