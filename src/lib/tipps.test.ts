import { describe, expect, it } from 'vitest';
import { testplan } from '../test/testplan';
import { berechneTracker, istAktiv, monatsuebersicht } from './berechnung';
import { neuerBlock } from './plan';
import { tippsProTag, urlaubstipps } from './tipps';
import type { Plan } from './types';

function planD(): Plan {
  return { ...testplan(), aktiveVariante: 'D' };
}

describe('Variante D (eigene Planung, startet leer)', () => {
  it('startet leer: auch "Immer"-Blöcke sind nicht aktiv', () => {
    const p = planD();
    const d = p.varianten.find((v) => v.id === 'D')!;
    expect(p.bloecke.filter((b) => istAktiv(b, d))).toHaveLength(0);
    const t = berechneTracker(p, 'p1');
    expect(t.verplant).toBe(0);
    expect(t.nochVerfuegbar).toBe(30);
    expect(t.freieTage).toBe(0);
    expect(t.effizienz).toBeNull();
    expect(monatsuebersicht(p).every((z) => z.ut.p1 === 0 && z.ut.p2 === 0)).toBe(true);
  });

  it('nur Blöcke mit Variante D zählen', () => {
    const p = planD();
    p.bloecke.push(neuerBlock(p, { name: 'Fronleichnam', von: '2027-05-27', bis: '2027-05-30', variante: 'D' }));
    expect(berechneTracker(p, 'p2', 'D').verplant).toBe(1);
    // D-Blöcke sind in A/B/C nicht aktiv
    expect(berechneTracker(p, 'p2', 'A').verplant).toBe(30);
  });
});

describe('Urlaubstipps', () => {
  const tipps = urlaubstipps(planD());
  const finde = (von: string, bis: string) => tipps.find((c) => c.von === von && c.bis === bis);

  it('enthalten die Brückentage (z. B. Fronleichnam 1 UT → 4 Tage)', () => {
    const c = finde('2027-05-27', '2027-05-30')!;
    expect(c.utMax).toBe(1);
    expect(c.inFerien).toBe(false);
    expect(c.bereitsVerplant).toBe(false); // in D ist noch nichts verplant
  });

  it('Kurztrip zu „Geburtstag A“ (So 21.02.): Woche davor, 5 UT → 9 Tage, ferienfrei', () => {
    const c = finde('2027-02-13', '2027-02-21')!;
    expect(c.art).toBe('Anlass');
    expect(c.anlass).toContain('Geburtstag A');
    expect(c.utMax).toBe(5);
    expect(c.tageFrei).toBe(9);
    expect(c.inFerien).toBe(false);
  });

  it('Woche der Familienfeier (Mi 28.04.) reicht bis zum 1. Mai: 5 UT → 9 Tage', () => {
    const c = finde('2027-04-24', '2027-05-02')!;
    expect(c.art).toBe('Anlass');
    expect(c.anlass).toContain('Familienfeier');
    expect(c.anlass).toContain('Tag der Arbeit');
    expect(c.utMax).toBe(5);
    expect(c.tageFrei).toBe(9);
    expect(c.urlaubstage).toEqual(['2027-04-26', '2027-04-27', '2027-04-28', '2027-04-29', '2027-04-30']);
    expect(c.inFerien).toBe(false);
  });

  it('Kurztrip zu „Geburtstag B“ (Sa 20.11.)', () => {
    const c = finde('2027-11-13', '2027-11-21')!;
    expect(c.anlass).toContain('Geburtstag B');
    expect(c.utMax).toBe(5);
  });

  it('jeder Zeitraum nur einmal, nach Effizienz sortiert', () => {
    expect(new Set(tipps.map((c) => c.id)).size).toBe(tipps.length);
    for (let i = 1; i < tipps.length; i++) expect(tipps[i - 1].effizienz).toBeGreaterThanOrEqual(tipps[i].effizienz);
  });

  it('ferienfreie Tipps für 2027', () => {
    const frei = tipps.filter((c) => !c.inFerien).map((c) => c.id);
    expect(frei).toEqual(
      expect.arrayContaining([
        '2027-05-06_2027-05-09',
        '2027-05-27_2027-05-30',
        '2027-04-24_2027-05-02',
        '2027-02-13_2027-02-21',
        '2027-11-13_2027-11-21',
      ]),
    );
  });

  it('tippsProTag ordnet Tage den Tipps zu', () => {
    const map = tippsProTag(tipps);
    expect(map.get('2027-05-28')!.some((c) => c.id === '2027-05-27_2027-05-30')).toBe(true);
    expect(map.get('2027-08-10')).toBeUndefined();
  });
});
