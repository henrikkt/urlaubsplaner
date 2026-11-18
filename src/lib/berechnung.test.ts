import { describe, expect, it } from 'vitest';
import { testplan } from '../test/testplan';
import {
  berechneTracker,
  besondereTageAm,
  erstelleKontext,
  gemeinsameUrlaubstage,
  istAktiv,
  kennzahlenBlock,
  monatsuebersicht,
  naechsterUrlaub,
  tageswert,
  ueberschneidungen,
  variantenvergleich,
} from './berechnung';
import { formatEffizienz } from './format';
import { aktiveVarianteVon, neuerPlan } from './plan';
import type { Plan, Variante } from './types';

const plan = testplan;

function blockKz(p: Plan, id: string) {
  const b = p.bloecke.find((x) => x.id === id)!;
  return kennzahlenBlock(b, erstelleKontext(p));
}

const v = (p: Plan, id: string): Variante => p.varianten.find((x) => x.id === id)!;

describe('Kennzahlen der Testblöcke', () => {
  const erwartet: Array<[string, number, number]> = [
    ['b1', 16, 9],
    ['b2', 4, 1],
    ['b3', 9, 5],
    ['b4', 23, 15],
    ['b5', 23, 15],
    ['b6', 9, 5],
    ['b7', 10, 4],
    ['b8', 10, 6],
  ];
  it.each(erwartet)('Block %s: %i Tage frei, %i UT je Person', (id, frei, ut) => {
    const k = blockKz(plan(), id);
    expect(k.tageFrei).toBe(frei);
    expect(k.ut.p1).toBe(ut);
    expect(k.ut.p2).toBe(ut);
  });

  it('Blöcke 1–6 sind ferienfrei, 7 und 8 liegen in Ferien', () => {
    const p = plan();
    for (const id of ['b1', 'b2', 'b3', 'b4', 'b5', 'b6']) expect(blockKz(p, id).inFerien, id).toBe(false);
    expect(blockKz(p, 'b7').inFerien).toBe(true);
    expect(blockKz(p, 'b7').ferien.map((f) => f.name)).toEqual(['Osterferien']);
    expect(blockKz(p, 'b8').inFerien).toBe(true);
    expect(blockKz(p, 'b8').ferien.map((f) => f.name)).toEqual(['Weihnachtsferien 2027/28']);
  });

  it('Block 8 mit 24.12. = 0,5 bei Person A: 5,5 UT für A, 6 für B', () => {
    const p = plan();
    p.personen[0].heiligabend = 0.5;
    const k = blockKz(p, 'b8');
    expect(k.ut.p1).toBe(5.5);
    expect(k.ut.p2).toBe(6);
  });

  it('Effizienz Block 1 = 16/9 ≈ 1,8x', () => {
    expect(formatEffizienz(blockKz(plan(), 'b1').effizienz)).toBe('1,8x');
  });

  it('Block nur für Person A: Person B hat 0 UT', () => {
    const p = plan();
    p.bloecke[2].wer = 'p1';
    const k = blockKz(p, 'b3');
    expect(k.ut.p1).toBe(5);
    expect(k.ut.p2).toBe(0);
    expect(k.effizienz).toBeCloseTo(9 / 5);
  });

  it('ungültiger Zeitraum ergibt 0 statt Fehler', () => {
    const p = plan();
    p.bloecke[0].bis = '2027-04-01';
    const k = blockKz(p, 'b1');
    expect(k.tageFrei).toBe(0);
    expect(k.ut.p1).toBe(0);
    expect(k.effizienz).toBeNull();
  });
});

describe('Tageswerte', () => {
  const ctx = erstelleKontext(plan());
  it('Wochenende und Feiertage = 0, Werktag = 1', () => {
    expect(tageswert('2027-05-01', 'p1', ctx)).toBe(0); // Sa + Feiertag
    expect(tageswert('2027-05-06', 'p1', ctx)).toBe(0); // Himmelfahrt
    expect(tageswert('2027-05-07', 'p1', ctx)).toBe(1);
  });
  it('24.12./31.12. nach Einstellung, außerhalb des Planungsjahres 0', () => {
    const p = plan();
    p.personen[1].silvester = 0.5;
    const c = erstelleKontext(p);
    expect(tageswert('2027-12-31', 'p2', c)).toBe(0.5);
    expect(tageswert('2027-12-31', 'p1', c)).toBe(1);
    expect(tageswert('2028-01-03', 'p1', c)).toBe(0);
  });
  it('unbekannte Person = 0', () => {
    const p = plan();
    p.personen = [p.personen[0]];
    expect(tageswert('2027-05-07', 'p2', erstelleKontext(p))).toBe(0);
  });
});

describe('Variable Arbeitstage', () => {
  it('Teilzeit Mo–Do: Freitage kosten keinen Urlaub', () => {
    const p = plan();
    p.personen[1].arbeitstage = [0, 1, 2, 3];
    const c = erstelleKontext(p);
    expect(tageswert('2027-05-07', 'p2', c)).toBe(0); // Freitag
    expect(tageswert('2027-05-07', 'p1', c)).toBe(1);
    // Winter-Kurztrip 08.–12.02.: Person B nur Mo–Do = 4 UT
    const k = blockKz(p, 'b3');
    expect(k.ut.p1).toBe(5);
    expect(k.ut.p2).toBe(4);
    expect(k.effizienz).toBeCloseTo(9 / 5); // Effizienz nach dem höchsten Wert
  });
  it('Samstagsarbeit: Samstage kosten Urlaub, Feiertag am Samstag nicht', () => {
    const p = plan();
    p.personen[0].arbeitstage = [0, 1, 2, 3, 4, 5];
    const c = erstelleKontext(p);
    expect(tageswert('2027-02-06', 'p1', c)).toBe(1); // Samstag
    expect(tageswert('2027-05-01', 'p1', c)).toBe(0); // Samstag, aber 1. Mai
    expect(blockKz(p, 'b3').ut.p1).toBe(7); // 06.–14.02.: 2 Samstage + 5 Werktage
  });
});

describe('Bundesland', () => {
  it('in Bayern ist der 06.01. frei, in NRW nicht', () => {
    const by = neuerPlan({
      name: 'Test',
      bundesland: 'BY',
      planungsjahr: 2027,
      personen: [{ name: 'X', anspruch: 30, resturlaub: 0, heiligabend: 1, silvester: 1 }],
    });
    expect(tageswert('2027-01-06', 'p1', erstelleKontext(by))).toBe(0);
    expect(tageswert('2027-01-06', 'p1', erstelleKontext(plan()))).toBe(1);
    // Mariä Himmelfahrt ist in Bayern standardmäßig dabei
    expect(by.feiertage.map((f) => f.datum)).toContain('2027-08-15');
  });
});

describe('Aktive Blöcke', () => {
  it('Immer + gewählte Variante aktiv, Aus nie', () => {
    const p = plan();
    const aktiv = (id: string) => p.bloecke.filter((b) => istAktiv(b, v(p, id))).map((b) => b.id);
    expect(aktiv('A')).toEqual(['b1', 'b2', 'b3', 'b4']);
    expect(aktiv('B')).toEqual(['b1', 'b2', 'b5', 'b6']);
    expect(aktiv('C')).toEqual(['b1', 'b2', 'c1', 'c2', 'c3', 'c4']);
    expect(aktiv('D')).toEqual([]);
  });
});

describe('Variante C (vier Kurztrips)', () => {
  const p = plan();
  it.each(['c1', 'c2', 'c3', 'c4'])('Block %s: 9 Tage frei, 5 UT, ferienfrei', (id) => {
    const k = blockKz(p, id);
    expect(k.tageFrei).toBe(9);
    expect(k.ut.p1).toBe(5);
    expect(k.ut.p2).toBe(5);
    expect(k.inFerien).toBe(false);
  });
  it('je 30 UT, 0 übrig, 0 in Schulferien, 56 freie Tage, 1,87x', () => {
    for (const person of ['p1', 'p2'] as const) {
      const t = berechneTracker(p, person, 'C');
      expect(t.verplant).toBe(30);
      expect(t.nochVerfuegbar).toBe(0);
      expect(t.inSchulferien).toBe(0);
      expect(t.freieTage).toBe(56);
      expect(formatEffizienz(t.effizienz, 2)).toBe('1,87x');
    }
  });
  it('effizienter als A und B', () => {
    const [a, b, c] = variantenvergleich(p);
    expect(c.variante.id).toBe('C');
    expect(c.tracker.p1!.effizienz!).toBeGreaterThan(a.tracker.p1!.effizienz!);
    expect(c.tracker.p1!.effizienz!).toBeGreaterThan(b.tracker.p1!.effizienz!);
  });
  it('Monate: Feb 5, Mär 5, Apr 5, Mai 5, Jun 5, Sep 5', () => {
    expect(monatsuebersicht(p, 'C').map((z) => z.ut.p2)).toEqual([0, 5, 5, 5, 5, 5, 0, 0, 5, 0, 0, 0]);
  });
  it('keine Überschneidungen, 30 gemeinsame Urlaubstage', () => {
    expect(ueberschneidungen(p, 'C')).toHaveLength(0);
    expect(gemeinsameUrlaubstage(p, 'C')).toBe(30);
  });
});

describe('Tracker Variante A', () => {
  const p = plan();
  for (const person of ['p1', 'p2'] as const) {
    it(`${person}: 30 verplant, 0 frei, 0 in Ferien, 52 Tage, ≈1,73x`, () => {
      const t = berechneTracker(p, person, 'A');
      expect(t.verfuegbar).toBe(30);
      expect(t.verplant).toBe(30);
      expect(t.nochVerfuegbar).toBe(0);
      expect(t.inSchulferien).toBe(0);
      expect(t.freieTage).toBe(52);
      expect(t.effizienz).toBeCloseTo(1.7333, 3);
      expect(formatEffizienz(t.effizienz, 2)).toBe('1,73x');
      expect(t.nichtBeantragt).toBe(30);
      expect(t.genehmigt + t.beantragt + t.abgelehnt).toBe(0);
    });
  }
  it('Monate: Feb 5, Apr 5, Mai 5, Sep 15, Rest 0', () => {
    const m = monatsuebersicht(p, 'A');
    const ut = m.map((z) => z.ut.p1);
    expect(ut).toEqual([0, 5, 0, 5, 5, 0, 0, 0, 15, 0, 0, 0]);
    expect(m.map((z) => z.ut.p2)).toEqual(ut);
  });
  it('gemeinsame Urlaubstage = 30', () => {
    expect(gemeinsameUrlaubstage(p, 'A')).toBe(30);
  });
  it('ohne Angabe wird die aktive Variante verwendet', () => {
    expect(aktiveVarianteVon(p).id).toBe('A');
    expect(berechneTracker(p, 'p1').freieTage).toBe(52);
  });
});

describe('Tracker Variante B', () => {
  const p = plan();
  it('je 30 UT, 0 in Ferien, 52 freie Tage', () => {
    for (const person of ['p1', 'p2'] as const) {
      const t = berechneTracker(p, person, 'B');
      expect(t.verplant).toBe(30);
      expect(t.inSchulferien).toBe(0);
      expect(t.freieTage).toBe(52);
    }
  });
  it('Monate: Apr 5, Mai 5, Jun 13, Jul 2, Sep 5', () => {
    expect(monatsuebersicht(p, 'B').map((z) => z.ut.p1)).toEqual([0, 0, 0, 5, 5, 13, 2, 0, 5, 0, 0, 0]);
  });
});

describe('Status und Resturlaub', () => {
  it('Status der aktiven Blöcke wird pro Tag aufgeteilt', () => {
    const p = plan();
    p.bloecke[0].status.p1 = 'Genehmigt'; // 9
    p.bloecke[2].status.p1 = 'Beantragt'; // 5
    p.bloecke[3].status.p1 = 'Abgelehnt'; // 15
    const t = berechneTracker(p, 'p1', 'A');
    expect(t.genehmigt).toBe(9);
    expect(t.beantragt).toBe(5);
    expect(t.abgelehnt).toBe(15);
    expect(t.nichtBeantragt).toBe(1);
  });
  it('Resturlaub erhöht verfügbare Tage', () => {
    const p = plan();
    p.personen[1].resturlaub = 3;
    const t = berechneTracker(p, 'p2', 'A');
    expect(t.verfuegbar).toBe(33);
    expect(t.nochVerfuegbar).toBe(3);
  });
});

describe('Überschneidungen', () => {
  it('Testdaten haben keine Überschneidungen in A oder B', () => {
    expect(ueberschneidungen(plan(), 'A')).toHaveLength(0);
    expect(ueberschneidungen(plan(), 'B')).toHaveLength(0);
  });
  it('überlappende Blöcke zählen Tage nicht doppelt', () => {
    const p = plan();
    p.bloecke[5].variante = 'A'; // 18.09.–26.09. liegt komplett in Block 4
    const u = ueberschneidungen(p, 'A');
    expect(u).toHaveLength(1);
    expect(u[0].personen).toEqual(['p1', 'p2']);
    expect(u[0].von).toBe('2027-09-18');
    expect(u[0].bis).toBe('2027-09-26');
    const t = berechneTracker(p, 'p1', 'A');
    expect(t.verplant).toBe(30);
    expect(t.freieTage).toBe(52);
  });
  it('Blöcke verschiedener Personen überschneiden sich nicht', () => {
    const p = plan();
    p.bloecke[5].variante = 'A';
    p.bloecke[5].wer = 'p2';
    p.bloecke[3].wer = 'p1';
    expect(ueberschneidungen(p, 'A')).toHaveLength(0);
  });
});

describe('Variantenvergleich', () => {
  it('liefert alle Varianten unabhängig von der Auswahl', () => {
    const p = plan();
    p.aktiveVariante = 'B';
    const [a, b, , d] = variantenvergleich(p);
    expect(a.variante.id).toBe('A');
    expect(a.tracker.p1!.verplant).toBe(30);
    expect(a.tracker.p1!.freieTage).toBe(52);
    expect(b.tracker.p2!.freieTage).toBe(52);
    expect(b.tracker.p2!.inSchulferien).toBe(0);
    expect(d.tracker.p1!.verplant).toBe(0);
  });
});

describe('Eine Person', () => {
  const einzeln = (): Plan => {
    const p = plan();
    p.personen = [p.personen[0]];
    return p;
  };
  it('Tracker wie gewohnt, keine gemeinsamen Tage', () => {
    const p = einzeln();
    const t = berechneTracker(p, 'p1', 'A');
    expect(t.verplant).toBe(30);
    expect(t.freieTage).toBe(52);
    expect(gemeinsameUrlaubstage(p, 'A')).toBe(0);
  });
  it('Monatsübersicht ohne „gemeinsam frei“ und ohne zweite Person', () => {
    const m = monatsuebersicht(einzeln(), 'A');
    expect(m.every((z) => z.gemeinsamFrei === 0)).toBe(true);
    expect(m.every((z) => z.ut.p2 === undefined)).toBe(true);
    expect(m[8].ut.p1).toBe(15);
  });
  it('Block-Kennzahlen nur für eine Person', () => {
    const k = blockKz(einzeln(), 'b4');
    expect(k.ut).toEqual({ p1: 15 });
    expect(k.effizienz).toBeCloseTo(23 / 15);
  });
});

describe('Countdown', () => {
  it('nächster Urlaub ab 18.11.2026 ist der Winter-Kurztrip (Variante A)', () => {
    const n = naechsterUrlaub(plan(), '2026-11-18')!;
    expect(n.block.id).toBe('b3');
    expect(n.laufend).toBe(false);
    expect(n.tageBis).toBe(80);
  });
  it('laufender Urlaub', () => {
    const n = naechsterUrlaub(plan(), '2027-05-03')!;
    expect(n.block.id).toBe('b1');
    expect(n.laufend).toBe(true);
    expect(n.nochTage).toBe(7);
  });
  it('null, wenn nichts mehr kommt', () => {
    expect(naechsterUrlaub(plan(), '2027-12-01')).toBeNull();
  });
});

describe('Besondere Tage', () => {
  it('jährliche Tage gelten auch in anderen Jahren, einmalige nicht', () => {
    const liste = plan().besondereTage;
    expect(besondereTageAm('2028-02-21', liste).map((t) => t.name)).toEqual(['Geburtstag A']);
    expect(besondereTageAm('2028-04-28', liste)).toHaveLength(0);
    expect(besondereTageAm('2027-04-28', liste).map((t) => t.name)).toEqual(['Familienfeier']);
  });
});
