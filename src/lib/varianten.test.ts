import { describe, expect, it } from 'vitest';
import { testplan } from '../test/testplan';
import { berechneTracker, gemeinsameUrlaubstage, istAktiv, monatsuebersicht, naechsterUrlaub, ueberschneidungen } from './berechnung';
import { findeBrueckentage } from './brueckentage';
import { erzeugeCsv, erzeugeIcs } from './export';
import {
  aktiveVarianteVon,
  blockVariantenOptionen,
  bloeckeInVarianten,
  neuerBlock,
  neuerPlan,
  setzeVariantenAktiv,
  zeigeVarianten,
} from './plan';
import { pruefePlan, pruefePlanMitInfo, variantenGenutzt } from './schema';
import { AUS, IMMER, type Plan } from './types';

/** Testplan ohne Variantenvergleich: nur Immer- und Aus-Blöcke (b1, b2, b7, b8) */
function ohneVarianten(): Plan {
  const p = testplan();
  return { ...p, variantenAktiv: false, bloecke: p.bloecke.filter((b) => b.variante === IMMER || b.variante === AUS) };
}

/** Plan im Format von Version 2 (ohne variantenAktiv) */
function alsV2(p: Plan): Record<string, unknown> {
  const { variantenAktiv: _v, ...rest } = structuredClone(p);
  return { ...rest, schema: 2 };
}

describe('Neue Pläne', () => {
  it('starten ohne Variantenvergleich, Varianten A und B liegen bereit', () => {
    const p = neuerPlan({
      name: 'x',
      bundesland: 'NW',
      planungsjahr: 2027,
      personen: [{ name: 'X', anspruch: 30, resturlaub: 0, heiligabend: 1, silvester: 1 }],
    });
    expect(p.variantenAktiv).toBe(false);
    expect(zeigeVarianten(p)).toBe(false);
    expect(p.varianten.map((v) => v.id)).toEqual(['A', 'B']);
    expect(blockVariantenOptionen(p)).toEqual([IMMER, AUS]);
  });
});

describe('Rechnen ohne Variantenvergleich', () => {
  it('alle Blöcke zählen, nur geparkte („Aus“) nicht', () => {
    const p = ohneVarianten();
    const v = aktiveVarianteVon(p);
    expect(p.bloecke.filter((b) => istAktiv(b, v)).map((b) => b.id)).toEqual(['b1', 'b2']);
  });

  it('Tracker, Monate und gemeinsame Tage ohne Variantenbezug', () => {
    const p = ohneVarianten();
    const t = berechneTracker(p, 'p1');
    expect(t.verplant).toBe(10); // b1: 9 + b2: 1
    expect(t.freieTage).toBe(20); // 16 + 4
    expect(monatsuebersicht(p).map((z) => z.ut.p1)).toEqual([0, 0, 0, 5, 5, 0, 0, 0, 0, 0, 0, 0]);
    expect(gemeinsameUrlaubstage(p)).toBe(10);
  });

  it('die gespeicherte aktive Variante spielt keine Rolle', () => {
    const p = { ...ohneVarianten(), aktiveVariante: 'D' }; // D „startet leer“ – darf nicht greifen
    expect(berechneTracker(p, 'p1').verplant).toBe(10);
  });

  it('auch Blöcke, die noch eine Variante tragen, zählen (robust)', () => {
    const p = { ...testplan(), variantenAktiv: false };
    // alle außer b7/b8 (geparkt): Tage überschneiden sich, werden aber nur einmal gezählt
    const v = aktiveVarianteVon(p);
    expect(p.bloecke.filter((b) => istAktiv(b, v))).toHaveLength(10);
    expect(ueberschneidungen(p).length).toBeGreaterThan(0);
  });

  it('Countdown und Brückentag-Finder funktionieren', () => {
    const p = ohneVarianten();
    expect(naechsterUrlaub(p, '2026-11-18')!.block.id).toBe('b1');
    const fronleichnam = findeBrueckentage(p).find((c) => c.von === '2027-05-27' && c.bis === '2027-05-30')!;
    expect(fronleichnam.bereitsVerplant).toBe(true);
  });

  it('neue Blöcke im Dialog-Standard zählen mit', () => {
    const p = ohneVarianten();
    const b = neuerBlock(p, { von: '2027-08-02', bis: '2027-08-06', variante: IMMER });
    expect(istAktiv(b, aktiveVarianteVon(p))).toBe(true);
  });
});

describe('Ein- und Ausschalten', () => {
  it('Einschalten ändert keine Blöcke', () => {
    const p = ohneVarianten();
    const an = setzeVariantenAktiv(p, true);
    expect(an.variantenAktiv).toBe(true);
    expect(an.bloecke).toEqual(p.bloecke);
    expect(zeigeVarianten(an)).toBe(true);
    expect(aktiveVarianteVon(an).id).toBe('A');
  });

  it('Ausschalten mit „Immer“: Varianten-Blöcke zählen ab jetzt mit', () => {
    const p = testplan();
    expect(bloeckeInVarianten(p)).toBe(8); // b3–b6, c1–c4
    const aus = setzeVariantenAktiv(p, false, IMMER);
    expect(aus.variantenAktiv).toBe(false);
    expect(bloeckeInVarianten(aus)).toBe(0);
    expect(aus.bloecke.filter((b) => b.variante === IMMER)).toHaveLength(10);
    expect(aus.bloecke.filter((b) => b.variante === AUS).map((b) => b.id)).toEqual(['b7', 'b8']);
    expect(() => pruefePlan(aus)).not.toThrow();
  });

  it('Ausschalten mit „geparkt“: Varianten-Blöcke zählen nicht mehr, bleiben aber erhalten', () => {
    const p = testplan();
    const aus = setzeVariantenAktiv(p, false, AUS);
    expect(aus.bloecke).toHaveLength(p.bloecke.length);
    expect(aus.bloecke.filter((b) => b.variante === IMMER).map((b) => b.id)).toEqual(['b1', 'b2']);
    expect(berechneTracker(aus, 'p1').verplant).toBe(10);
  });

  it('Ausschalten ohne zugeordnete Blöcke ändert nichts an den Blöcken', () => {
    const p = { ...ohneVarianten(), variantenAktiv: true };
    expect(setzeVariantenAktiv(p, false).bloecke).toEqual(p.bloecke);
  });

  it('Varianten bleiben beim Aus-/Einschalten gespeichert', () => {
    const p = testplan();
    const zurueck = setzeVariantenAktiv(setzeVariantenAktiv(p, false, AUS), true);
    expect(zurueck.varianten).toEqual(p.varianten);
  });
});

describe('Export ohne Variantenvergleich', () => {
  it('CSV ohne Spalte „Variante“, mit „Zählt mit“', () => {
    const zeilen = erzeugeCsv(ohneVarianten()).replace('﻿', '').trim().split('\r\n');
    expect(zeilen[0].startsWith('Anlass;Zählt mit;Wer;Von;Bis')).toBe(true);
    expect(zeilen[1].startsWith('Frühjahrsreise;ja;')).toBe(true);
    expect(zeilen.find((z) => z.startsWith('Idee: Ostern'))).toContain(';geparkt;');
  });
  it('ICS ohne „Variante:“ in der Beschreibung', () => {
    const ics = erzeugeIcs(ohneVarianten()).replace(/\r\n /g, '');
    expect(ics).not.toContain('Variante:');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
  it('mit Variantenvergleich wie bisher', () => {
    const ics = erzeugeIcs(testplan()).replace(/\r\n /g, '');
    expect(ics).toContain('Variante: Immer');
  });
});

describe('Migration Version 2 → 3', () => {
  it('Blöcke in Varianten → Variantenvergleich AN', () => {
    const { plan, migriert } = pruefePlanMitInfo(alsV2(testplan()));
    expect(migriert).toBe(true);
    expect(plan.schema).toBe(3);
    expect(plan.variantenAktiv).toBe(true);
    expect(plan.bloecke).toEqual(testplan().bloecke);
  });

  it('nur „Immer“- und geparkte Blöcke → AUS', () => {
    const { plan } = pruefePlanMitInfo(alsV2(ohneVarianten()));
    expect(plan.variantenAktiv).toBe(false);
    expect(plan.bloecke).toEqual(ohneVarianten().bloecke);
  });

  it('keine Blöcke → AUS', () => {
    expect(pruefePlan(alsV2({ ...testplan(), bloecke: [] })).variantenAktiv).toBe(false);
  });

  it('verliert keine Daten (alles außer dem neuen Feld identisch)', () => {
    const alt = testplan();
    const neu = pruefePlan(alsV2(alt));
    expect({ ...neu, variantenAktiv: alt.variantenAktiv }).toEqual(alt);
  });

  it('kaputte Version-2-Daten werden abgelehnt', () => {
    expect(() => pruefePlan({ ...alsV2(testplan()), bloecke: 'x' })).toThrow(/beschädigt/);
  });

  it('Version 3 verlangt das neue Feld', () => {
    const { variantenAktiv: _v, ...ohne } = testplan();
    expect(() => pruefePlan(ohne)).toThrow(/variantenAktiv: fehlt/);
  });

  it('variantenGenutzt zählt geparkte Blöcke nicht als Variante', () => {
    expect(variantenGenutzt({ bloecke: [{ ...testplan().bloecke[6] }] })).toBe(false); // „Aus“
    expect(variantenGenutzt({ bloecke: [{ ...testplan().bloecke[2] }] })).toBe(true); // „A“
  });
});
