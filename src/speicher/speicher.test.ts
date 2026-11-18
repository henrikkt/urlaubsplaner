import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { testplan } from '../test/testplan';
import { PlanFehler } from '../lib/schema';
import { backupFaellig, erzeugeBackup, leererArbeitsbereich, leseImport, pruefeArbeitsbereich } from './arbeitsbereich';
import { BrowserSpeicher } from './browser';

let zaehler = 0;
const neuerSpeicher = () => new BrowserSpeicher(`test-db-${++zaehler}`);

describe('BrowserSpeicher (IndexedDB)', () => {
  it('liefert null beim ersten Start', async () => {
    expect(await neuerSpeicher().load()).toBeNull();
  });

  it('speichert und lädt mehrere Pläne verlustfrei', async () => {
    const s = neuerSpeicher();
    const a = testplan();
    const b = { ...testplan(), id: 'plan-2', name: 'Zweiter Plan' };
    await s.save({ ...leererArbeitsbereich(), plaene: [a, b], aktiverPlanId: 'plan-2', letztesBackup: '2026-11-01T10:00:00.000Z' });
    const g = (await s.load())!;
    expect(g.ab.plaene).toEqual([a, b]);
    expect(g.ab.aktiverPlanId).toBe('plan-2');
    expect(g.ab.letztesBackup).toBe('2026-11-01T10:00:00.000Z');
    expect(g.defekt).toHaveLength(0);
  });

  it('sortiert beschädigte Pläne aus, statt alles zu verlieren', async () => {
    const s = neuerSpeicher();
    await s.save({ ...leererArbeitsbereich(), plaene: [testplan(), { kaputt: true } as never], aktiverPlanId: 'plan-test' });
    const g = (await s.load())!;
    expect(g.ab.plaene).toHaveLength(1);
    expect(g.defekt).toHaveLength(1);
  });

  it('alles löschen', async () => {
    const s = neuerSpeicher();
    await s.save({ ...leererArbeitsbereich(), plaene: [testplan()], aktiverPlanId: 'plan-test' });
    await s.loescheAlles();
    expect(await s.load()).toBeNull();
  });
});

describe('Arbeitsbereich prüfen', () => {
  it('aktiver Plan fällt auf den ersten zurück, ungültiges Backup-Datum wird verworfen', () => {
    const g = pruefeArbeitsbereich({ schema: 1, plaene: [testplan()], aktiverPlanId: 'weg', letztesBackup: 'quatsch' });
    expect(g.ab.aktiverPlanId).toBe('plan-test');
    expect(g.ab.letztesBackup).toBeNull();
  });
  it('doppelte Plan-IDs werden eindeutig gemacht', () => {
    const g = pruefeArbeitsbereich({ plaene: [testplan(), testplan()] });
    expect(new Set(g.ab.plaene.map((p) => p.id)).size).toBe(2);
  });
  it('wirft bei völlig falschen Daten', () => {
    expect(() => pruefeArbeitsbereich('x')).toThrow(PlanFehler);
  });
});

describe('Export und Import', () => {
  it('Backup-Datei: Roundtrip ohne Server-Felder', () => {
    const p = { ...testplan(), revision: 7, geaendertAm: '2026-11-18T00:00:00Z' };
    const datei = erzeugeBackup([p], new Date('2026-11-18T12:00:00Z'));
    expect(datei.format).toBe('urlaubsplaner-backup');
    expect(datei.exportiertAm).toBe('2026-11-18T12:00:00.000Z');
    const zurueck = leseImport(JSON.stringify(datei));
    expect(zurueck).toEqual([testplan()]);
  });

  it('einzelner Plan (auch ohne Backup-Hülle) wird akzeptiert', () => {
    expect(leseImport(JSON.stringify(testplan()))[0].name).toBe('Testplan 2027');
  });

  it.each([
    ['kein JSON', '{kaputt', /keine gültige JSON/],
    ['leeres Backup', JSON.stringify({ format: 'urlaubsplaner-backup', version: 1, exportiertAm: 'x', plaene: [] }), /keine Pläne/],
    ['neuere Version', JSON.stringify({ format: 'urlaubsplaner-backup', version: 9, plaene: [] }), /neueren Version/],
    ['fremde Datei', JSON.stringify({ name: 'Rezept', zutaten: [] }), /keine Datei des Urlaubsplaners/],
    [
      'unbekannte Felder',
      JSON.stringify({ format: 'urlaubsplaner-backup', version: 1, exportiertAm: 'x', plaene: [testplan()], extra: 1 }),
      /unbekannte Felder: extra/,
    ],
  ])('lehnt %s verständlich ab', (_n, text, meldung) => {
    expect(() => leseImport(text)).toThrow(meldung);
  });

  it('meldet, welcher Plan in der Datei kaputt ist', () => {
    const kaputt = { ...testplan(), planungsjahr: 1800 };
    const text = JSON.stringify({ format: 'urlaubsplaner-backup', version: 1, exportiertAm: 'x', plaene: [testplan(), kaputt] });
    expect(() => leseImport(text)).toThrow(/Plan 2 in der Datei:[\s\S]*planungsjahr/);
  });

  it('lehnt zu große Dateien ab', () => {
    expect(() => leseImport(' '.repeat(6 * 1024 * 1024))).toThrow(/zu groß/);
  });
});

describe('Backup-Erinnerung', () => {
  const jetzt = new Date('2026-11-18T12:00:00Z');
  it('fällig ohne Backup oder nach mehr als 30 Tagen', () => {
    expect(backupFaellig(null, jetzt)).toBe(true);
    expect(backupFaellig('2026-10-18T11:00:00Z', jetzt)).toBe(true);
    expect(backupFaellig('2026-10-20T12:00:00Z', jetzt)).toBe(false);
  });
});
