import { PlanFehler, pruefePlanMitInfo } from '../lib/schema';
import type { Plan } from '../lib/types';

/**
 * Alles, was auf einem Gerät gespeichert ist: ein oder mehrere Pläne plus Metadaten.
 * Im Server-Modus enthält er genau einen Plan.
 */
export interface Arbeitsbereich {
  schema: 1;
  plaene: Plan[];
  aktiverPlanId: string | null;
  /** Zeitpunkt des letzten JSON-Exports (ISO), null = noch nie */
  letztesBackup: string | null;
}

export const ARBEITSBEREICH_SCHEMA = 1 as const;

export function leererArbeitsbereich(): Arbeitsbereich {
  return { schema: ARBEITSBEREICH_SCHEMA, plaene: [], aktiverPlanId: null, letztesBackup: null };
}

export interface GeladenerArbeitsbereich {
  ab: Arbeitsbereich;
  /** Pläne, die beschädigt waren und nicht geladen werden konnten (Rohdaten bleiben gesichert) */
  defekt: unknown[];
  /** Mindestens ein Plan wurde aus einer älteren Version umgewandelt */
  migriert: boolean;
}

/** Gespeicherten Arbeitsbereich prüfen. Beschädigte Pläne werden aussortiert statt alles zu verwerfen. */
export function pruefeArbeitsbereich(roh: unknown): GeladenerArbeitsbereich {
  if (typeof roh !== 'object' || roh === null || !Array.isArray((roh as Arbeitsbereich).plaene)) {
    throw new PlanFehler('Gespeicherte Daten sind beschädigt.');
  }
  const r = roh as Partial<Arbeitsbereich>;
  const plaene: Plan[] = [];
  const defekt: unknown[] = [];
  let migriert = false;
  for (const p of r.plaene ?? []) {
    try {
      const e = pruefePlanMitInfo(p);
      if (plaene.some((x) => x.id === e.plan.id)) e.plan.id = `${e.plan.id}-2`;
      plaene.push(e.plan);
      migriert ||= e.migriert;
    } catch {
      defekt.push(p);
    }
  }
  const aktiv = plaene.find((p) => p.id === r.aktiverPlanId)?.id ?? plaene[0]?.id ?? null;
  const backup = typeof r.letztesBackup === 'string' && !Number.isNaN(Date.parse(r.letztesBackup)) ? r.letztesBackup : null;
  return { ab: { schema: ARBEITSBEREICH_SCHEMA, plaene, aktiverPlanId: aktiv, letztesBackup: backup }, defekt, migriert };
}

// ---------------------------------------------------------------------------
// Backup-Datei (Export / Import)
// ---------------------------------------------------------------------------

export const BACKUP_FORMAT = 'urlaubsplaner-backup';

export interface BackupDatei {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportiertAm: string;
  plaene: Plan[];
}

export function erzeugeBackup(plaene: Plan[], jetzt = new Date()): BackupDatei {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportiertAm: jetzt.toISOString(),
    plaene: plaene.map(({ revision: _r, geaendertAm: _g, ...rest }) => rest as Plan),
  };
}

const MAX_DATEI_BYTES = 5 * 1024 * 1024;

/**
 * Liest eine importierte Datei streng: Backup-Datei (ein oder mehrere Pläne) oder ein einzelner Plan
 * (auch im alten Format). Wirft PlanFehler mit verständlicher Meldung.
 */
export function leseImport(text: string): Plan[] {
  if (text.length > MAX_DATEI_BYTES) throw new PlanFehler('Die Datei ist zu groß (mehr als 5 MB).');
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    throw new PlanFehler('Die Datei ist keine gültige JSON-Datei.');
  }
  if (typeof roh === 'object' && roh !== null && (roh as { format?: unknown }).format === BACKUP_FORMAT) {
    const b = roh as Partial<BackupDatei>;
    if (b.version !== 1) throw new PlanFehler('Die Backup-Datei stammt aus einer neueren Version der App.');
    const unbekannt = Object.keys(b).filter((k) => !['format', 'version', 'exportiertAm', 'plaene'].includes(k));
    if (unbekannt.length) throw new PlanFehler(`Die Backup-Datei enthält unbekannte Felder: ${unbekannt.join(', ')}`);
    if (!Array.isArray(b.plaene) || b.plaene.length === 0) throw new PlanFehler('Die Backup-Datei enthält keine Pläne.');
    if (b.plaene.length > 50) throw new PlanFehler('Die Backup-Datei enthält zu viele Pläne (höchstens 50).');
    return b.plaene.map((p, i) => {
      try {
        return pruefePlanMitInfo(p).plan;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new PlanFehler(`Plan ${i + 1} in der Datei: ${msg}`);
      }
    });
  }
  return [pruefePlanMitInfo(roh).plan];
}

export function backupFaellig(letztes: string | null, jetzt = new Date(), tage = 30): boolean {
  if (!letztes) return true;
  const t = Date.parse(letztes);
  return Number.isNaN(t) || jetzt.getTime() - t > tage * 86_400_000;
}
