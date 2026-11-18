import { describe, expect, it } from 'vitest';
import { testplan } from '../test/testplan';
import { findeBrueckentage } from './brueckentage';
import { neuerPlan } from './plan';

describe('Brückentag-Finder 2027 (NRW)', () => {
  const chancen = findeBrueckentage(testplan());
  const finde = (von: string, bis: string) => chancen.find((c) => c.von === von && c.bis === bis);

  it('Fronleichnam: 1 UT → 4 Tage frei, ferienfrei, bereits verplant', () => {
    const c = finde('2027-05-27', '2027-05-30')!;
    expect(c).toBeDefined();
    expect(c.art).toBe('Brückentag');
    expect(c.utMax).toBe(1);
    expect(c.tageFrei).toBe(4);
    expect(c.urlaubstage).toEqual(['2027-05-28']);
    expect(c.inFerien).toBe(false);
    expect(c.bereitsVerplant).toBe(true);
    expect(c.anlass).toBe('Fronleichnam');
  });

  it('Christi Himmelfahrt: 1 UT → 4 Tage', () => {
    const c = finde('2027-05-06', '2027-05-09')!;
    expect(c.utMax).toBe(1);
    expect(c.effizienz).toBe(4);
  });

  it('Ostern: ganze Woche nach Ostermontag = 4 UT → 10 Tage, in Schulferien', () => {
    const c = finde('2027-03-26', '2027-04-04')!;
    expect(c.utMax).toBe(4);
    expect(c.tageFrei).toBe(10);
    expect(c.inFerien).toBe(true);
  });

  it('Pfingstmontag + Dienstag liegt in den Pfingstferien', () => {
    const c = finde('2027-05-15', '2027-05-18')!;
    expect(c.utMax).toBe(1);
    expect(c.inFerien).toBe(true);
  });

  it('Allerheiligen-Woche liegt in den Herbstferien', () => {
    const c = finde('2027-10-30', '2027-11-07')!;
    expect(c.art).toBe('Ganze Woche');
    expect(c.utMax).toBe(4);
    expect(c.inFerien).toBe(true);
  });

  it('keine Chance mit Arbeitstagen aus 2026', () => {
    expect(chancen.every((c) => c.von >= '2027-01-01' || c.urlaubstage.every((d) => d >= '2027-01-01'))).toBe(true);
    expect(chancen.some((c) => c.von < '2026-12-31' && c.utMax > 0 && c.urlaubstage.some((d) => d < '2027-01-01'))).toBe(false);
  });

  it('ist nach Effizienz absteigend sortiert und ohne Duplikate', () => {
    for (let i = 1; i < chancen.length; i++) expect(chancen[i - 1].effizienz).toBeGreaterThanOrEqual(chancen[i].effizienz);
    expect(new Set(chancen.map((c) => c.id)).size).toBe(chancen.length);
  });

  it('Zwischen den Jahren: Woche 27.–31.12. mit 5 UT → 9 Tage', () => {
    const c = finde('2027-12-25', '2028-01-02')!;
    expect(c.utMax).toBe(5);
    expect(c.tageFrei).toBe(9);
    expect(c.inFerien).toBe(true);
  });
});

describe('Brückentag-Finder in anderen Ländern und mit einer Person', () => {
  const plan = (land: 'BY' | 'SN' | 'NW', arbeitstage?: (0 | 1 | 2 | 3 | 4 | 5 | 6)[]) =>
    neuerPlan({
      name: 'Test',
      bundesland: land,
      planungsjahr: 2027,
      personen: [{ name: 'X', anspruch: 30, resturlaub: 0, heiligabend: 1, silvester: 1, arbeitstage }],
    });

  it('Sachsen: Buß- und Bettag (Mi 17.11.) wird zur Brücke', () => {
    const c = findeBrueckentage(plan('SN')).filter((x) => x.von <= '2027-11-17' && x.bis >= '2027-11-17');
    expect(c.length).toBeGreaterThan(0);
    expect(c.some((x) => x.anlass.includes('Buß- und Bettag'))).toBe(true);
  });

  it('Bayern: Heilige Drei Könige (Mi 06.01.) als Chance, ut nur für eine Person', () => {
    const c = findeBrueckentage(plan('BY')).find((x) => x.anlass.includes('Heilige Drei Könige'))!;
    expect(c).toBeDefined();
    expect(Object.keys(c.ut)).toEqual(['p1']);
  });

  it('Teilzeit Mo–Do: Fronleichnam (Do) braucht keinen Brückentag am Freitag', () => {
    const c = findeBrueckentage(plan('NW', [0, 1, 2, 3])).find((x) => x.anlass === 'Fronleichnam' && x.art === 'Brückentag')!;
    // Do (Feiertag) + Fr (frei) + Wochenende sind ohnehin frei → die beste Brücke nimmt Mo–Mi davor
    expect(c.urlaubstage.every((d) => d !== '2027-05-28')).toBe(true);
  });
});
