import { describe, expect, it } from 'vitest';
import { testplan } from '../test/testplan';
import { berechneTracker } from './berechnung';
import {
  duplizierePlan,
  entfernePerson,
  entferneVariante,
  fuegePersonHinzu,
  fuegeVarianteHinzu,
  neuerPlan,
  setzeOrtUndJahr,
  setzeRegionaleFeiertage,
} from './plan';
import { PlanFehler, pruefePlan, pruefePlanMitInfo } from './schema';

/** Ein Plan im alten Format (Version 1): Personen als feste Schlüssel, Status als statusName-Felder. */
function planV1() {
  return {
    version: 1,
    planungsjahr: 2027,
    aktiveVariante: 'D',
    einstellungen: {
      Alpha: { anspruch: 30, resturlaub: 2, heiligabend: 0.5, silvester: 0.5 },
      Beta: { anspruch: 28, resturlaub: 0, heiligabend: 1, silvester: 1 },
    },
    feiertage: [{ datum: '2027-01-01', name: 'Neujahr' }],
    schulferien: [{ id: 'f1', name: 'Sommerferien', von: '2027-07-19', bis: '2027-08-31' }],
    besondereTage: [{ id: 't1', datum: '2027-03-03', name: 'Jubiläum', jaehrlich: true, symbol: '⭐' }],
    bloecke: [
      {
        id: 'b1',
        name: 'Reise',
        variante: 'Immer',
        wer: 'Beide',
        von: '2027-06-07',
        bis: '2027-06-11',
        statusAlpha: 'Genehmigt',
        statusBeta: 'Beantragt',
        notiz: 'x',
      },
      {
        id: 'b2',
        name: 'Nur Beta',
        variante: 'C',
        wer: 'Beta',
        von: '2027-09-06',
        bis: '2027-09-10',
        statusAlpha: 'Idee',
        statusBeta: 'Abgestimmt',
        notiz: '',
      },
    ],
    revision: 64,
    geaendertAm: '2026-11-18T00:10:44.434Z',
  };
}

describe('Schema v2', () => {
  it('Testplan ist gültig und bleibt beim Roundtrip gleich', () => {
    const p = testplan();
    expect(pruefePlan(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('neuer Plan aus dem Startassistenten ist gültig', () => {
    const p = neuerPlan({
      name: 'Urlaub 2027',
      bundesland: 'BW',
      planungsjahr: 2027,
      personen: [{ name: 'Anna', anspruch: 28, resturlaub: 1, heiligabend: 0.5, silvester: 0, arbeitstage: [0, 1, 2] }],
      besondereTage: [{ datum: '2027-07-01', name: 'Jubiläum', jaehrlich: false, symbol: '⭐' }],
    });
    expect(() => pruefePlan(p)).not.toThrow();
    expect(p.varianten.map((v) => v.name)).toEqual(['A', 'B']);
    expect(p.variantenAktiv).toBe(false);
    expect(p.feiertage.length).toBe(12);
    expect(p.schulferien.some((f) => /Sommer/.test(f.name))).toBe(true);
  });

  it.each([
    ['kein Objekt', 'text'],
    ['Array', []],
    ['fremdes Format', { foo: 1 }],
    ['null', null],
  ])('lehnt %s ab', (_name, roh) => {
    expect(() => pruefePlan(roh)).toThrow(PlanFehler);
  });

  it('lehnt neuere Schema-Versionen mit Hinweis ab', () => {
    expect(() => pruefePlan({ ...testplan(), schema: 99 })).toThrow(/neueren Version/);
  });

  it('lehnt kaputte Daten mit verständlicher Meldung ab', () => {
    const p = testplan() as unknown as Record<string, unknown>;
    const kaputt = { ...p, bloecke: [{ ...(p.bloecke as object[])[0], von: '2027-13-40' }] };
    expect(() => pruefePlan(kaputt)).toThrow(/bloecke\[1\]\.von: ungültiges Datum/);
  });

  it('lehnt unbekannte Felder ab', () => {
    expect(() => pruefePlan({ ...testplan(), hack: '<script>' })).toThrow(/unbekannte Felder: hack/);
  });

  it('prüft Querverweise (Variante, Person, aktive Variante)', () => {
    const p = testplan();
    p.bloecke[0].variante = 'Z';
    expect(() => pruefePlan(p)).toThrow(/unbekannte Variante/);
    const q = testplan();
    q.personen = [q.personen[0]];
    q.bloecke[0].wer = 'p2';
    expect(() => pruefePlan(q)).toThrow(/Person existiert nicht/);
    const r = testplan();
    r.aktiveVariante = 'X';
    expect(() => pruefePlan(r)).toThrow(/Variante existiert nicht/);
  });

  it('lehnt zu lange Texte und ungültige Farben ab', () => {
    const p = testplan();
    p.bloecke[0].notiz = 'x'.repeat(5000);
    expect(() => pruefePlan(p)).toThrow(/zu lang/);
    const q = testplan();
    q.personen[0].farbe = 'red';
    expect(() => pruefePlan(q)).toThrow(/Farbe/);
  });
});

describe('Migration Version 1 → 2', () => {
  const { plan, migriert } = pruefePlanMitInfo(planV1(), () => 'plan-fest');

  it('wird als migriert erkannt', () => expect(migriert).toBe(true));

  it('übernimmt Personen mit Namen, Einstellungen und Standardwerten', () => {
    expect(plan.personen.map((p) => [p.id, p.name, p.anspruch, p.resturlaub, p.heiligabend])).toEqual([
      ['p1', 'Alpha', 30, 2, 0.5],
      ['p2', 'Beta', 28, 0, 1],
    ]);
    expect(plan.personen[0].arbeitstage).toEqual([0, 1, 2, 3, 4]);
    expect(plan.bundesland).toBe('NW');
    expect(plan.id).toBe('plan-fest');
    expect(plan.name).toBe('Urlaub 2027');
  });

  it('übernimmt Blöcke mit Wer und Status je Person', () => {
    expect(plan.bloecke[0]).toMatchObject({ wer: 'alle', status: { p1: 'Genehmigt', p2: 'Beantragt' } });
    expect(plan.bloecke[1]).toMatchObject({ wer: 'p2', variante: 'C', status: { p1: 'Idee', p2: 'Abgestimmt' } });
  });

  it('übernimmt Varianten A–D, D als eigene Planung, und die aktive Variante', () => {
    expect(plan.varianten.map((v) => `${v.id}:${v.startetLeer}`)).toEqual(['A:false', 'B:false', 'C:false', 'D:true']);
    expect(plan.aktiveVariante).toBe('D');
  });

  it('direkt auf Version 3: Variantenvergleich AN, weil ein Block in Variante C liegt', () => {
    expect(plan.schema).toBe(3);
    expect(plan.variantenAktiv).toBe(true);
  });

  it('alter Plan nur mit „Immer“-Blöcken: Variantenvergleich AUS', () => {
    const alt = planV1();
    alt.bloecke = [alt.bloecke[0]];
    expect(pruefePlan(alt).variantenAktiv).toBe(false);
  });

  it('übernimmt Feiertage, Ferien, besondere Tage und Revision unverändert', () => {
    const alt = planV1();
    expect(plan.feiertage).toEqual(alt.feiertage);
    expect(plan.schulferien).toEqual(alt.schulferien);
    expect(plan.besondereTage).toEqual(alt.besondereTage);
    expect(plan.revision).toBe(64);
  });

  it('Ergebnis ist ein gültiger v2-Plan und rechnet', () => {
    expect(pruefePlanMitInfo(JSON.parse(JSON.stringify(plan))).migriert).toBe(false);
    // Variante C: „Immer“-Block (5 UT) + Block nur für Beta (5 UT)
    expect(berechneTracker(plan, 'p2', 'C').verplant).toBe(10);
    expect(berechneTracker(plan, 'p1', 'C').verplant).toBe(5);
  });

  it('lehnt beschädigte v1-Daten ab', () => {
    expect(() => pruefePlan({ ...planV1(), bloecke: 'x' })).toThrow(PlanFehler);
    expect(() => pruefePlan({ ...planV1(), aktiveVariante: 'Q' })).toThrow(PlanFehler);
  });
});

describe('Personen und Varianten verwalten', () => {
  it('zweite Person hinzufügen: bisherige Blöcke gehören Person 1', () => {
    const p = testplan();
    p.personen = [p.personen[0]];
    p.bloecke.forEach((b) => (b.status = { p1: b.status.p1 }));
    const neu = fuegePersonHinzu(p, 'Neu');
    expect(neu.personen.map((x) => x.name)).toEqual(['Person A', 'Neu']);
    expect(neu.bloecke.every((b) => b.wer === 'p1' && b.status.p2 === 'Idee')).toBe(true);
    expect(() => pruefePlan(neu)).not.toThrow();
  });

  it('Person 1 entfernen: Person 2 rückt nach, ihre Status bleiben', () => {
    const p = testplan();
    p.bloecke[0].status.p2 = 'Genehmigt';
    p.bloecke[1].wer = 'p1';
    const neu = entfernePerson(p, 'p1');
    expect(neu.personen).toHaveLength(1);
    expect(neu.personen[0]).toMatchObject({ id: 'p1', name: 'Person B' });
    expect(neu.bloecke).toHaveLength(11); // Block nur für Person A gelöscht
    expect(neu.bloecke[0].status).toEqual({ p1: 'Genehmigt' });
    expect(() => pruefePlan(neu)).not.toThrow();
  });

  it('Variante löschen: Blöcke werden zu „Aus“, aktive Variante wechselt', () => {
    const p = { ...testplan(), aktiveVariante: 'C' };
    const neu = entferneVariante(p, 'C');
    expect(neu.varianten.map((v) => v.id)).toEqual(['A', 'B', 'D']);
    expect(neu.aktiveVariante).toBe('A');
    expect(neu.bloecke.filter((b) => b.id.startsWith('c')).every((b) => b.variante === 'Aus')).toBe(true);
    expect(() => pruefePlan(neu)).not.toThrow();
  });

  it('Variante hinzufügen mit eigenem Namen', () => {
    const neu = fuegeVarianteHinzu(testplan(), 'Sommer lang');
    expect(neu.varianten.at(-1)!.name).toBe('Sommer lang');
    expect(() => pruefePlan(neu)).not.toThrow();
  });

  it('letzte Variante kann nicht gelöscht werden', () => {
    const p = neuerPlan({ name: 'x', bundesland: 'NW', planungsjahr: 2027, personen: [{ name: 'X', anspruch: 1, resturlaub: 0, heiligabend: 1, silvester: 1 }] });
    const eins = entferneVariante(p, 'B');
    expect(entferneVariante(eins, 'A')).toBe(eins);
  });
});

describe('Ort, Jahr, Duplikat', () => {
  it('Bundesland wechseln berechnet Feiertage und Ferien neu', () => {
    const by = setzeOrtUndJahr(testplan(), 'BY', 2028);
    expect(by.feiertage.map((f) => f.datum)).toContain('2028-01-06');
    expect(by.feiertage.map((f) => f.datum)).toContain('2028-08-15'); // regional, Standard in BY
    expect(by.schulferien.every((f) => f.id.startsWith('ferien-BY'))).toBe(true);
  });
  it('regionale Feiertage an- und abwählen', () => {
    const by = setzeOrtUndJahr(testplan(), 'BY', 2027);
    const ohne = setzeRegionaleFeiertage(by, []);
    expect(ohne.feiertage.map((f) => f.datum)).not.toContain('2027-08-15');
    const augsburg = setzeRegionaleFeiertage(by, ['BY-AUGSBURGER-FRIEDENSFEST']);
    expect(augsburg.feiertage.map((f) => f.datum)).toContain('2027-08-08');
  });
  it('Duplikat hat neue ID und eigenen Namen, aber gleiche Blöcke', () => {
    const p = { ...testplan(), revision: 5 };
    const k = duplizierePlan(p);
    expect(k.id).not.toBe(p.id);
    expect(k.name).toBe('Testplan 2027 (Kopie)');
    expect(k.revision).toBeUndefined();
    expect(k.bloecke).toEqual(p.bloecke);
    k.bloecke[0].name = 'geändert';
    expect(p.bloecke[0].name).toBe('Frühjahrsreise');
  });
});
