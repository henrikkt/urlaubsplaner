/**
 * Neutrale Testdaten (nur für Tests): zwei Personen, NRW 2027, Mo–Fr, je 30 Tage Anspruch.
 *
 * Varianten:
 *  - Immer: b1 Frühjahrsreise (Sa 24.04.–So 09.05., 16 Tage, 9 UT, mit Himmelfahrt)
 *           b2 Fronleichnam-Brücke (Do 27.05.–So 30.05., 4 Tage, 1 UT)
 *  - A:     b3 Winter-Kurztrip (Sa 06.02.–So 14.02., 9 Tage, 5 UT)
 *           b4 Spätsommerreise (Sa 04.09.–So 26.09., 23 Tage, 15 UT)
 *  - B:     b5 Frühsommerreise (Sa 12.06.–So 04.07., 23 Tage, 15 UT)
 *           b6 Herbst-Kurztrip (Sa 18.09.–So 26.09., 9 Tage, 5 UT – liegt komplett in b4)
 *  - Aus:   b7 Ostern verlängern (in den Osterferien), b8 Zwischen den Jahren (in den Weihnachtsferien)
 *  - C:     vier Kurztrips Sa–So mit je 5 UT
 *  - D:     eigene Planung (startet leer)
 */
import { feiertageFuer } from '../lib/feiertage';
import { schulferienFuer } from '../lib/schulferien';
import { PLAN_SCHEMA, STANDARD_FARBEN, type Plan, type Urlaubsblock } from '../lib/types';

function block(id: string, name: string, variante: string, von: string, bis: string, notiz = ''): Urlaubsblock {
  return { id, name, variante, wer: 'alle', von, bis, status: { p1: 'Idee', p2: 'Idee' }, notiz };
}

export function testplan(): Plan {
  return {
    schema: PLAN_SCHEMA,
    id: 'plan-test',
    name: 'Testplan 2027',
    bundesland: 'NW',
    regionaleFeiertage: [],
    planungsjahr: 2027,
    personen: [
      {
        id: 'p1',
        name: 'Person A',
        farbe: STANDARD_FARBEN.p1,
        anspruch: 30,
        resturlaub: 0,
        arbeitstage: [0, 1, 2, 3, 4],
        heiligabend: 1,
        silvester: 1,
      },
      {
        id: 'p2',
        name: 'Person B',
        farbe: STANDARD_FARBEN.p2,
        anspruch: 30,
        resturlaub: 0,
        arbeitstage: [0, 1, 2, 3, 4],
        heiligabend: 1,
        silvester: 1,
      },
    ],
    farbeGemeinsam: STANDARD_FARBEN.gemeinsam,
    varianten: [
      { id: 'A', name: 'A', beschreibung: 'Winter + Spätsommer', startetLeer: false },
      { id: 'B', name: 'B', beschreibung: 'Frühsommer + Herbst', startetLeer: false },
      { id: 'C', name: 'C', beschreibung: 'Vier Kurztrips', startetLeer: false },
      { id: 'D', name: 'D', beschreibung: 'Eigene Planung', startetLeer: true },
    ],
    aktiveVariante: 'A',
    feiertage: feiertageFuer('NW', 2027),
    schulferien: schulferienFuer('NW', 2027),
    besondereTage: [
      { id: 't1', datum: '2027-02-21', name: 'Geburtstag A', jaehrlich: true, symbol: '🎂' },
      { id: 't2', datum: '2027-04-28', name: 'Familienfeier', jaehrlich: false, symbol: '⭐' },
      { id: 't3', datum: '2027-11-20', name: 'Geburtstag B', jaehrlich: true, symbol: '🎂' },
    ],
    bloecke: [
      block('b1', 'Frühjahrsreise', 'Immer', '2027-04-24', '2027-05-09', 'mit Christi Himmelfahrt'),
      block('b2', 'Fronleichnam', 'Immer', '2027-05-27', '2027-05-30', 'Brückentag Fr 28.05.'),
      block('b3', 'Winter-Kurztrip', 'A', '2027-02-06', '2027-02-14'),
      block('b4', 'Spätsommerreise', 'A', '2027-09-04', '2027-09-26', 'nach den Sommerferien'),
      block('b5', 'Frühsommerreise', 'B', '2027-06-12', '2027-07-04', 'vor den Sommerferien'),
      block('b6', 'Herbst-Kurztrip', 'B', '2027-09-18', '2027-09-26'),
      block('b7', 'Idee: Ostern verlängern', 'Aus', '2027-03-26', '2027-04-04', 'liegt in den Osterferien'),
      block('b8', 'Idee: Zwischen den Jahren', 'Aus', '2027-12-24', '2028-01-02', 'liegt in den Weihnachtsferien'),
      block('c1', 'Kurztrip Februar', 'C', '2027-02-06', '2027-02-14'),
      block('c2', 'Kurztrip März', 'C', '2027-02-27', '2027-03-07'),
      block('c3', 'Kurztrip Juni', 'C', '2027-06-19', '2027-06-27'),
      block('c4', 'Kurztrip September', 'C', '2027-09-18', '2027-09-26'),
    ],
  };
}
