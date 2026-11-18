import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PlanFehler, pruefePlanMitInfo } from '../src/lib/schema.ts';
import { PLAN_SCHEMA, type Plan } from '../src/lib/types.ts';

export interface DateiPfade {
  /** data/urlaubsplan.json */
  datei: string;
  /** backup/ – hier landen automatische Sicherungen vor Migrationen und beim Überschreiben defekter Dateien */
  backupOrdner: string;
  /** data/seed.local.json – optionale persönliche Startdaten (git-ignoriert) */
  seed: string;
}

function zeitstempel(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function sichere(pfade: DateiPfade, grund: string): Promise<string | null> {
  if (!existsSync(pfade.datei)) return null;
  await mkdir(pfade.backupOrdner, { recursive: true });
  const ziel = path.join(pfade.backupOrdner, `urlaubsplan-${grund}-${zeitstempel()}.json`);
  await copyFile(pfade.datei, ziel);
  return ziel;
}

export async function schreibe(pfade: DateiPfade, plan: Plan): Promise<void> {
  await mkdir(path.dirname(pfade.datei), { recursive: true });
  const tmp = `${pfade.datei}.tmp`;
  await writeFile(tmp, JSON.stringify(plan, null, 2), 'utf8');
  await rename(tmp, pfade.datei); // atomar ersetzen
}

export interface LadeErgebnis {
  plan: Plan | null;
  meldung?: string;
}

/**
 * Lädt den Plan. Alte Dateien (Version 1) werden einmalig migriert – vorher wird die
 * Originaldatei nach backup/ kopiert. Fehlt die Datei, werden die Startdaten aus
 * seed.local.json übernommen (falls vorhanden), sonst gibt es noch keinen Plan.
 * Eine beschädigte Datei wird NIE automatisch überschrieben (Fehler wird geworfen).
 */
export async function ladeOderMigriere(pfade: DateiPfade): Promise<LadeErgebnis> {
  if (existsSync(pfade.datei)) {
    const roh = JSON.parse(await readFile(pfade.datei, 'utf8'));
    const { plan, migriert } = pruefePlanMitInfo(roh);
    if (!migriert) return { plan };
    const backup = await sichere(pfade, 'vor-migration');
    const neu: Plan = { ...plan, revision: (plan.revision ?? 0) + 1, geaendertAm: new Date().toISOString() };
    await schreibe(pfade, neu);
    return { plan: neu, meldung: `Datei auf das neue Format umgestellt. Original gesichert: ${backup}` };
  }
  if (existsSync(pfade.seed)) {
    const roh = JSON.parse(await readFile(pfade.seed, 'utf8'));
    const { plan } = pruefePlanMitInfo(roh);
    const neu: Plan = { ...plan, revision: 1, geaendertAm: new Date().toISOString() };
    await schreibe(pfade, neu);
    return { plan: neu, meldung: `Neue Datei aus den Startdaten (${path.basename(pfade.seed)}) angelegt.` };
  }
  return { plan: null };
}

/**
 * Prüft einen vom Browser gesendeten Plan. Nur das aktuelle Schema wird angenommen –
 * so kann ein noch offener Tab mit altem Code die Datei nicht im alten Format überschreiben.
 */
export function pruefeEingang(roh: unknown): Plan {
  if (typeof roh !== 'object' || roh === null || (roh as { schema?: unknown }).schema !== PLAN_SCHEMA) {
    throw new PlanFehler('Die App wurde aktualisiert. Bitte die Seite neu laden.');
  }
  return pruefePlanMitInfo(roh).plan;
}
