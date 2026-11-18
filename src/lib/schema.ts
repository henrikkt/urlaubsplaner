import { z } from 'zod';
import { istGueltigesDatum } from './datum';
import { BUNDESLAND_CODES, REGIONALE_FEIERTAGE } from './feiertage';
import {
  AUS,
  IMMER,
  PERSON_IDS,
  PLAN_SCHEMA,
  STANDARD_ARBEITSTAGE,
  STANDARD_FARBEN,
  STATUS_REIHENFOLGE,
  type Person,
  type PersonId,
  type Plan,
  type Status,
  type Urlaubsblock,
  type Variante,
} from './types';

// Keine Code-Erzeugung per new Function(): verträgt sich mit der strikten Content-Security-Policy
z.config({ jitless: true });

/** Verständlicher Fehler beim Prüfen von Planungsdaten (Import, Laden). */
export class PlanFehler extends Error {}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

const MAX_TEXT = 200;
const MAX_NOTIZ = 2000;

const text = (max = MAX_TEXT) => z.string().max(max, `Text ist zu lang (höchstens ${max} Zeichen)`);
const datum = z.string().refine(istGueltigesDatum, 'ungültiges Datum (erwartet JJJJ-MM-TT)');
const farbe = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'ungültige Farbe (erwartet #RRGGBB)');
const tage = z.number().min(0, 'darf nicht negativ sein').max(366, 'ist zu groß');
const anteil = z.union([z.literal(0), z.literal(0.5), z.literal(1)], { error: 'erlaubt sind 0, 0,5 oder 1' });
const status = z.enum(STATUS_REIHENFOLGE as [Status, ...Status[]], { error: 'unbekannter Status' });
const id = z.string().min(1, 'ID fehlt').max(100);
const jahr = z.number().int().min(2000, 'Jahr muss ab 2000 sein').max(2100, 'Jahr muss bis 2100 sein');

const feiertagSchema = z.strictObject({ datum, name: text() });
const ferienSchema = z.strictObject({ id, name: text(), von: datum, bis: datum });
const besondererTagSchema = z.strictObject({
  id,
  datum,
  name: text(),
  jaehrlich: z.boolean(),
  symbol: text(16),
});

// ---------------------------------------------------------------------------
// Schema Version 2 (aktuell)
// ---------------------------------------------------------------------------

const personSchema = z.strictObject({
  id: z.enum(PERSON_IDS as [PersonId, ...PersonId[]]),
  name: text(60).trim().min(1, 'Name fehlt'),
  farbe,
  anspruch: tage,
  resturlaub: tage,
  arbeitstage: z
    .array(z.number().int().min(0).max(6, 'Wochentag 0 (Mo) bis 6 (So)'))
    .min(1, 'mindestens ein Arbeitstag')
    .max(7)
    .refine((a) => new Set(a).size === a.length, 'Wochentage doppelt'),
  heiligabend: anteil,
  silvester: anteil,
});

const varianteSchema = z.strictObject({
  id: id.refine((v) => v !== IMMER && v !== AUS, '„Immer“ und „Aus“ sind als Varianten-ID reserviert'),
  name: text(40).trim().min(1, 'Name der Variante fehlt'),
  beschreibung: text(),
  startetLeer: z.boolean(),
});

const blockSchema = z.strictObject({
  id,
  name: text(),
  variante: id,
  wer: z.enum(['alle', ...PERSON_IDS] as ['alle', ...PersonId[]], { error: 'unbekannte Person bei „Wer“' }),
  von: datum,
  bis: datum,
  status: z.partialRecord(z.enum(PERSON_IDS as [PersonId, ...PersonId[]]), status),
  notiz: text(MAX_NOTIZ),
});

/** Felder, die Version 2 und 3 gemeinsam haben */
const planFelder = {
  id,
  name: text(80).trim().min(1, 'Name des Plans fehlt'),
  bundesland: z.enum(BUNDESLAND_CODES as [string, ...string[]], { error: 'unbekanntes Bundesland' }),
  regionaleFeiertage: z.array(z.enum(REGIONALE_FEIERTAGE.map((r) => r.id) as [string, ...string[]])).max(20),
  planungsjahr: jahr,
  personen: z.array(personSchema).min(1, 'mindestens eine Person').max(2, 'höchstens zwei Personen'),
  farbeGemeinsam: farbe,
  varianten: z.array(varianteSchema).min(1, 'mindestens eine Variante').max(12, 'höchstens 12 Varianten'),
  aktiveVariante: id,
  feiertage: z.array(feiertagSchema).max(200),
  schulferien: z.array(ferienSchema).max(200),
  besondereTage: z.array(besondererTagSchema).max(500),
  bloecke: z.array(blockSchema).max(2000),
  revision: z.number().int().nonnegative().optional(),
  geaendertAm: z.string().max(40).optional(),
};

type PlanBasis = z.infer<z.ZodObject<typeof planFelder>>;

/** Querverweise prüfen (Personen-IDs, Varianten, Blöcke) */
function pruefeVerweise(p: PlanBasis, ctx: z.RefinementCtx) {
  p.personen.forEach((person, i) => {
      if (person.id !== PERSON_IDS[i]) {
        ctx.addIssue({ code: 'custom', path: ['personen', i, 'id'], message: `erwartet „${PERSON_IDS[i]}“` });
      }
    });
    const personIds = new Set(p.personen.map((x) => x.id));
    const variantenIds = new Set<string>();
    p.varianten.forEach((v, i) => {
      if (variantenIds.has(v.id)) ctx.addIssue({ code: 'custom', path: ['varianten', i, 'id'], message: 'doppelte Varianten-ID' });
      variantenIds.add(v.id);
    });
    if (!variantenIds.has(p.aktiveVariante)) {
      ctx.addIssue({ code: 'custom', path: ['aktiveVariante'], message: 'Variante existiert nicht' });
    }
    const blockIds = new Set<string>();
    p.bloecke.forEach((b, i) => {
      if (blockIds.has(b.id)) ctx.addIssue({ code: 'custom', path: ['bloecke', i, 'id'], message: 'doppelte Block-ID' });
      blockIds.add(b.id);
      if (b.variante !== IMMER && b.variante !== AUS && !variantenIds.has(b.variante)) {
        ctx.addIssue({ code: 'custom', path: ['bloecke', i, 'variante'], message: `unbekannte Variante „${b.variante}“` });
      }
      if (b.wer !== 'alle' && !personIds.has(b.wer)) {
        ctx.addIssue({ code: 'custom', path: ['bloecke', i, 'wer'], message: 'Person existiert nicht' });
      }
      if (b.bis < b.von) ctx.addIssue({ code: 'custom', path: ['bloecke', i, 'bis'], message: '„Bis“ liegt vor „Von“' });
    });
}

/** Version 3 (aktuell): zusätzlich "Varianten vergleichen" an/aus */
export const planSchema = z
  .strictObject({ schema: z.literal(PLAN_SCHEMA), variantenAktiv: z.boolean(), ...planFelder })
  .superRefine(pruefeVerweise);

/** Version 2: wie Version 3, aber ohne variantenAktiv */
const planV2Schema = z.strictObject({ schema: z.literal(2), ...planFelder }).superRefine(pruefeVerweise);

/** Sind Blöcke einer Variante zugeordnet (also weder "Immer" noch "Aus" = geparkt)? */
export function variantenGenutzt(p: Pick<PlanBasis, 'bloecke'>): boolean {
  return p.bloecke.some((b) => b.variante !== IMMER && b.variante !== AUS);
}

/** Migration 2 → 3: Variantenvergleich nur einschalten, wenn er tatsächlich genutzt wird */
function migriereV2(alt: z.infer<typeof planV2Schema>): Plan {
  return { ...(alt as unknown as Plan), schema: PLAN_SCHEMA, variantenAktiv: variantenGenutzt(alt) };
}

// ---------------------------------------------------------------------------
// Schema Version 1 (alte Einzel-Datei mit genau zwei festen Personen) → Migration
// ---------------------------------------------------------------------------

const V1_VARIANTEN = ['A', 'B', 'C', 'D'] as const;

const personV1Schema = z.object({ anspruch: tage, resturlaub: tage, heiligabend: anteil, silvester: anteil });

const planV1Schema = z.object({
  version: z.literal(1),
  planungsjahr: jahr,
  aktiveVariante: z.enum(V1_VARIANTEN),
  einstellungen: z
    .record(text(60).min(1), personV1Schema)
    .refine((e) => Object.keys(e).length >= 1 && Object.keys(e).length <= 2, 'erwartet ein oder zwei Personen'),
  feiertage: z.array(feiertagSchema).max(200),
  schulferien: z.array(ferienSchema).max(200),
  besondereTage: z.array(besondererTagSchema).max(500),
  bloecke: z
    .array(
      z
        .object({
          id,
          name: text(),
          variante: z.enum([IMMER, ...V1_VARIANTEN, AUS]),
          wer: text(60),
          von: datum,
          bis: datum,
          notiz: text(MAX_NOTIZ),
        })
        .catchall(z.unknown()),
    )
    .max(2000),
  revision: z.number().int().nonnegative().optional(),
  geaendertAm: z.string().max(40).optional(),
});

type PlanV1 = z.infer<typeof planV1Schema>;

function migriereV1(alt: PlanV1, neueId: () => string): Plan {
  const namen = Object.keys(alt.einstellungen);
  const personen: Person[] = namen.map((name, i) => {
    const e = alt.einstellungen[name];
    const pid = PERSON_IDS[i];
    return {
      id: pid,
      name,
      farbe: STANDARD_FARBEN[pid],
      anspruch: e.anspruch,
      resturlaub: e.resturlaub,
      arbeitstage: [...STANDARD_ARBEITSTAGE],
      heiligabend: e.heiligabend,
      silvester: e.silvester,
    };
  });
  const varianten: Variante[] = V1_VARIANTEN.map((v) => ({
    id: v,
    name: v,
    beschreibung: v === 'D' ? 'Eigene Planung: startet leer, mit Urlaubstipps im Kalender' : '',
    startetLeer: v === 'D',
  }));
  const bloecke: Urlaubsblock[] = alt.bloecke.map((b) => {
    const idx = namen.indexOf(b.wer);
    const status: Partial<Record<PersonId, Status>> = {};
    personen.forEach((p) => {
      const s = b[`status${p.name}`];
      status[p.id] = STATUS_REIHENFOLGE.includes(s as Status) ? (s as Status) : 'Idee';
    });
    return {
      id: b.id,
      name: b.name,
      variante: b.variante,
      wer: idx >= 0 ? PERSON_IDS[idx] : 'alle',
      von: b.von,
      bis: b.bis,
      status,
      notiz: b.notiz,
    };
  });
  return {
    schema: PLAN_SCHEMA,
    id: neueId(),
    name: `Urlaub ${alt.planungsjahr}`,
    // Version 1 kannte nur Nordrhein-Westfalen
    bundesland: 'NW',
    regionaleFeiertage: [],
    planungsjahr: alt.planungsjahr,
    personen,
    farbeGemeinsam: STANDARD_FARBEN.gemeinsam,
    variantenAktiv: variantenGenutzt({ bloecke }),
    varianten,
    aktiveVariante: alt.aktiveVariante,
    feiertage: alt.feiertage,
    schulferien: alt.schulferien,
    besondereTage: alt.besondereTage,
    bloecke,
    revision: alt.revision,
    geaendertAm: alt.geaendertAm,
  };
}

// ---------------------------------------------------------------------------
// Öffentliche Funktionen
// ---------------------------------------------------------------------------

function pfadText(pfad: readonly PropertyKey[]): string {
  return pfad.map((t) => (typeof t === 'number' ? `[${t + 1}]` : `.${String(t)}`)).join('').replace(/^\./, '');
}

export function fehlerText(err: z.ZodError, max = 3): string {
  const zeilen = err.issues.slice(0, max).map((i) => {
    const wo = pfadText(i.path);
    let was = i.message;
    if (i.code === 'unrecognized_keys') was = `unbekannte Felder: ${i.keys.join(', ')}`;
    else if (i.code === 'invalid_type') was = i.input === undefined ? 'fehlt' : 'hat den falschen Typ';
    return wo ? `${wo}: ${was}` : was;
  });
  const rest = err.issues.length - zeilen.length;
  return zeilen.join('\n') + (rest > 0 ? `\n… und ${rest} weitere Probleme` : '');
}

function standardId(): string {
  const zufall =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `plan-${Date.now().toString(36)}-${zufall}`;
}

export interface PruefErgebnis {
  plan: Plan;
  /** true, wenn die Daten aus einer älteren Version umgewandelt wurden */
  migriert: boolean;
}

/**
 * Prüft unbekannte Daten (Import, Datei, Speicher) streng und migriert alte Versionen.
 * Wirft PlanFehler mit einer verständlichen Meldung.
 */
export function pruefePlanMitInfo(roh: unknown, neueId: () => string = standardId): PruefErgebnis {
  if (typeof roh !== 'object' || roh === null || Array.isArray(roh)) {
    throw new PlanFehler('Die Datei enthält keinen Urlaubsplan.');
  }
  const obj = roh as Record<string, unknown>;
  if (obj.schema === PLAN_SCHEMA) {
    const r = planSchema.safeParse(obj);
    if (!r.success) throw new PlanFehler(`Der Plan ist beschädigt oder unvollständig:\n${fehlerText(r.error)}`);
    return { plan: r.data as Plan, migriert: false };
  }
  if (typeof obj.schema === 'number' && obj.schema > PLAN_SCHEMA) {
    throw new PlanFehler('Der Plan stammt aus einer neueren Version der App. Bitte die App aktualisieren.');
  }
  if (obj.schema === 2) {
    const r = planV2Schema.safeParse(obj);
    if (!r.success) throw new PlanFehler(`Der Plan ist beschädigt oder unvollständig:\n${fehlerText(r.error)}`);
    const pruef = planSchema.safeParse(migriereV2(r.data));
    if (!pruef.success) throw new PlanFehler(`Der Plan konnte nicht umgewandelt werden:\n${fehlerText(pruef.error)}`);
    return { plan: pruef.data as Plan, migriert: true };
  }
  if (obj.version === 1) {
    const r = planV1Schema.safeParse(obj);
    if (!r.success) throw new PlanFehler(`Der alte Plan (Version 1) ist beschädigt:\n${fehlerText(r.error)}`);
    const neu = migriereV1(r.data, neueId);
    const pruef = planSchema.safeParse(neu);
    if (!pruef.success) throw new PlanFehler(`Der alte Plan konnte nicht umgewandelt werden:\n${fehlerText(pruef.error)}`);
    return { plan: pruef.data as Plan, migriert: true };
  }
  throw new PlanFehler('Unbekanntes Dateiformat – das ist keine Datei des Urlaubsplaners.');
}

export function pruefePlan(roh: unknown, neueId?: () => string): Plan {
  return pruefePlanMitInfo(roh, neueId).plan;
}
