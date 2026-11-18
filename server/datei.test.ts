import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { testplan } from '../src/test/testplan';
import { ladeOderMigriere, pruefeEingang, type DateiPfade } from './datei';

async function pfade(): Promise<DateiPfade> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'urlaubsplaner-test-'));
  return { datei: path.join(dir, 'data', 'urlaubsplan.json'), backupOrdner: path.join(dir, 'backup'), seed: path.join(dir, 'seed.local.json') };
}

const v1 = {
  version: 1,
  planungsjahr: 2027,
  aktiveVariante: 'B',
  einstellungen: { Eins: { anspruch: 30, resturlaub: 0, heiligabend: 1, silvester: 1 } },
  feiertage: [],
  schulferien: [],
  besondereTage: [],
  bloecke: [{ id: 'b1', name: 'X', variante: 'B', wer: 'Beide', von: '2027-06-07', bis: '2027-06-11', statusEins: 'Genehmigt', notiz: '' }],
  revision: 10,
};

describe('Server-Datei', () => {
  it('ohne Datei und ohne Startdaten: kein Plan, nichts angelegt', async () => {
    const p = await pfade();
    expect((await ladeOderMigriere(p)).plan).toBeNull();
    expect(existsSync(p.datei)).toBe(false);
  });

  it('legt die Datei aus seed.local.json an (auch im alten Format)', async () => {
    const p = await pfade();
    await writeFile(p.seed, JSON.stringify(v1));
    const { plan } = await ladeOderMigriere(p);
    expect(plan?.personen[0].name).toBe('Eins');
    expect(plan?.revision).toBe(1);
    expect(JSON.parse(await readFile(p.datei, 'utf8')).schema).toBe(3);
  });

  it('migriert eine alte Datei einmalig und sichert vorher das Original', async () => {
    const p = await pfade();
    await ladeOderMigriere(p); // legt nichts an
    const { mkdir } = await import('node:fs/promises');
    await mkdir(path.dirname(p.datei), { recursive: true });
    await writeFile(p.datei, JSON.stringify(v1));
    const erst = await ladeOderMigriere(p);
    expect(erst.plan?.revision).toBe(11);
    expect(erst.plan?.bloecke[0].status.p1).toBe('Genehmigt');
    expect(erst.meldung).toMatch(/Original gesichert/);
    const backups = await readdir(p.backupOrdner);
    expect(backups).toHaveLength(1);
    expect(JSON.parse(await readFile(path.join(p.backupOrdner, backups[0]), 'utf8'))).toEqual(v1);
    // zweites Laden: keine erneute Migration, kein weiteres Backup
    const zweit = await ladeOderMigriere(p);
    expect(zweit.plan?.revision).toBe(11);
    expect(zweit.plan?.id).toBe(erst.plan?.id);
    expect(await readdir(p.backupOrdner)).toHaveLength(1);
  });

  it('migriert eine Datei im Format 2 auf 3 (Varianten AN) und sichert vorher das Original', async () => {
    const p = await pfade();
    const { mkdir } = await import('node:fs/promises');
    await mkdir(path.dirname(p.datei), { recursive: true });
    const { variantenAktiv: _v, ...rest } = testplan();
    const v2 = { ...rest, schema: 2, revision: 65 };
    await writeFile(p.datei, JSON.stringify(v2));
    const { plan, meldung } = await ladeOderMigriere(p);
    expect(plan?.schema).toBe(3);
    expect(plan?.variantenAktiv).toBe(true);
    expect(plan?.revision).toBe(66);
    expect(plan?.bloecke).toEqual(testplan().bloecke);
    expect(meldung).toMatch(/Original gesichert/);
    const backups = await readdir(p.backupOrdner);
    expect(JSON.parse(await readFile(path.join(p.backupOrdner, backups[0]), 'utf8'))).toEqual(v2);
  });

  it('nimmt beim Speichern kein Schema 2 mehr an (veralteter Tab)', () => {
    const { variantenAktiv: _v, ...rest } = testplan();
    expect(() => pruefeEingang({ ...rest, schema: 2 })).toThrow(/neu laden/);
  });

  it('eine beschädigte Datei wird nicht überschrieben', async () => {
    const p = await pfade();
    const { mkdir } = await import('node:fs/promises');
    await mkdir(path.dirname(p.datei), { recursive: true });
    await writeFile(p.datei, '{ kaputt');
    await expect(ladeOderMigriere(p)).rejects.toThrow();
    expect(await readFile(p.datei, 'utf8')).toBe('{ kaputt');
  });

  it('nimmt beim Speichern nur das aktuelle Schema an', () => {
    expect(() => pruefeEingang(v1)).toThrow(/neu laden/);
    expect(() => pruefeEingang({ ...testplan(), bloecke: 'x' })).toThrow();
    expect(pruefeEingang(testplan()).id).toBe('plan-test');
  });
});
