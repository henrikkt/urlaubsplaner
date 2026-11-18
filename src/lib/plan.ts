import { istGueltigesDatum } from './datum';
import { feiertageFuer, regionaleFeiertageFuer, type Bundesland } from './feiertage';
import { schulferienFuer } from './schulferien';
import {
  ALLE_BLOECKE,
  AUS,
  IMMER,
  PERSON_IDS,
  PLAN_SCHEMA,
  STANDARD_ARBEITSTAGE,
  STANDARD_FARBEN,
  STATUS_REIHENFOLGE,
  type BesondererTag,
  type Person,
  type PersonId,
  type Plan,
  type Status,
  type Urlaubsblock,
  type Variante,
  type Wer,
} from './types';

export { PlanFehler, pruefePlan, pruefePlanMitInfo } from './schema';

export function neueId(prefix = 'id'): string {
  const zufall =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${zufall}`;
}

export function naechsterStatus(s: Status): Status {
  const i = STATUS_REIHENFOLGE.indexOf(s);
  return STATUS_REIHENFOLGE[(i + 1) % STATUS_REIHENFOLGE.length];
}

// ---------------------------------------------------------------------------
// Lesende Helfer
// ---------------------------------------------------------------------------

export function person(plan: Plan, id: PersonId): Person | undefined {
  return plan.personen.find((p) => p.id === id);
}

export function personName(plan: Plan, id: PersonId): string {
  return person(plan, id)?.name ?? id;
}

export function istPaar(plan: Plan): boolean {
  return plan.personen.length > 1;
}

/** "Anna & Ben", bei einer Person nur der Name */
export function alleNamen(plan: Plan): string {
  return plan.personen.map((p) => p.name).join(' & ');
}

/** Wer-Text für Anzeige/Export: "Anna & Ben" bzw. "Anna" */
export function werText(plan: Plan, w: Wer): string {
  return w === 'alle' ? alleNamen(plan) : personName(plan, w);
}

/** Auswahl-Optionen für "Wer" (bei einer Person nur „alle“) */
export function werOptionen(plan: Plan): { wert: Wer; text: string }[] {
  if (!istPaar(plan)) return [{ wert: 'alle', text: plan.personen[0]?.name ?? 'Ich' }];
  return [
    { wert: 'alle', text: 'Beide' },
    ...plan.personen.map((p) => ({ wert: p.id as Wer, text: `Nur ${p.name}` })),
  ];
}

/** Ohne Variantenvergleich: alle Blöcke außer "Aus" (geparkt) zählen */
export const ALLE_BLOECKE_VARIANTE: Variante = { id: ALLE_BLOECKE, name: '', beschreibung: '', startetLeer: false };

/** Die Variante, nach der gerechnet wird (bei ausgeschaltetem Vergleich: alle Blöcke) */
export function aktiveVarianteVon(plan: Plan): Variante {
  if (!plan.variantenAktiv) return ALLE_BLOECKE_VARIANTE;
  return plan.varianten.find((v) => v.id === plan.aktiveVariante) ?? plan.varianten[0];
}

/** Variantenvergleich eingeschaltet und mehr als eine Variante vorhanden? */
export function zeigeVarianten(plan: Plan): boolean {
  return plan.variantenAktiv && plan.varianten.length > 1;
}

/** Anzahl Blöcke, die einer Variante zugeordnet sind (weder "Immer" noch geparkt) */
export function bloeckeInVarianten(plan: Plan): number {
  return plan.bloecke.filter((b) => b.variante !== IMMER && b.variante !== AUS).length;
}

/**
 * Variantenvergleich ein- oder ausschalten. Beim Ausschalten werden Blöcke, die einer Variante
 * zugeordnet sind, zu "Immer" (zählen mit) oder "Aus" (geparkt) – je nach Wahl.
 */
export function setzeVariantenAktiv(plan: Plan, an: boolean, bloeckeWerden: typeof IMMER | typeof AUS = IMMER): Plan {
  if (an) return { ...plan, variantenAktiv: true };
  return {
    ...plan,
    variantenAktiv: false,
    bloecke: plan.bloecke.map((b) => (b.variante !== IMMER && b.variante !== AUS ? { ...b, variante: bloeckeWerden } : b)),
  };
}

export function varianteName(plan: Plan, id: string): string {
  if (id === IMMER) return 'Immer';
  if (id === AUS) return 'Aus';
  return plan.varianten.find((v) => v.id === id)?.name ?? id;
}

/** Text für die Varianten-Auswahl eines Blocks */
export function blockVarianteText(plan: Plan, id: string): string {
  if (id === IMMER) {
    const normal = plan.varianten.filter((v) => !v.startetLeer).map((v) => v.name);
    return normal.length > 1 ? `Immer (${normal.join(', ')})` : 'Immer';
  }
  if (id === AUS) return 'Aus (nur Idee)';
  const v = plan.varianten.find((x) => x.id === id);
  return v ? `Nur Variante ${v.name}${v.startetLeer ? ' (eigene Planung)' : ''}` : id;
}

export function blockVariantenOptionen(plan: Plan): string[] {
  return [IMMER, ...(zeigeVarianten(plan) ? plan.varianten.map((v) => v.id) : []), AUS];
}

// ---------------------------------------------------------------------------
// Blöcke
// ---------------------------------------------------------------------------

export interface BlockFehler {
  name?: string;
  zeitraum?: string;
}

export function validiereBlock(b: Pick<Urlaubsblock, 'name' | 'von' | 'bis'>): BlockFehler {
  const f: BlockFehler = {};
  if (!b.name.trim()) f.name = 'Bitte einen Namen (Anlass) eingeben.';
  if (!istGueltigesDatum(b.von) || !istGueltigesDatum(b.bis)) f.zeitraum = 'Bitte gültiges Von- und Bis-Datum wählen.';
  else if (b.bis < b.von) f.zeitraum = '„Bis“ darf nicht vor „Von“ liegen.';
  return f;
}

export function hatFehler(f: BlockFehler): boolean {
  return Boolean(f.name || f.zeitraum);
}

export function aktualisiereBlock(plan: Plan, id: string, patch: Partial<Urlaubsblock>): Plan {
  return { ...plan, bloecke: plan.bloecke.map((b) => (b.id === id ? { ...b, ...patch } : b)) };
}

export function setzeBlockStatus(plan: Plan, id: string, p: PersonId, s: Status): Plan {
  return {
    ...plan,
    bloecke: plan.bloecke.map((b) => (b.id === id ? { ...b, status: { ...b.status, [p]: s } } : b)),
  };
}

export function fuegeBlockHinzu(plan: Plan, b: Urlaubsblock): Plan {
  return { ...plan, bloecke: [...plan.bloecke, b] };
}

export function entferneBlock(plan: Plan, id: string): Plan {
  return { ...plan, bloecke: plan.bloecke.filter((b) => b.id !== id) };
}

export function dupliziereBlock(plan: Plan, id: string): Plan {
  const i = plan.bloecke.findIndex((b) => b.id === id);
  if (i < 0) return plan;
  const kopie: Urlaubsblock = {
    ...plan.bloecke[i],
    status: { ...plan.bloecke[i].status },
    id: neueId('b'),
    name: `${plan.bloecke[i].name} (Kopie)`,
  };
  const bloecke = [...plan.bloecke];
  bloecke.splice(i + 1, 0, kopie);
  return { ...plan, bloecke };
}

export function sortiereBloecke(plan: Plan): Plan {
  return { ...plan, bloecke: [...plan.bloecke].sort((a, b) => a.von.localeCompare(b.von) || a.bis.localeCompare(b.bis)) };
}

export function neuerBlock(
  plan: Pick<Plan, 'personen'>,
  teil: Partial<Urlaubsblock> & Pick<Urlaubsblock, 'von' | 'bis'>,
): Urlaubsblock {
  const status: Partial<Record<PersonId, Status>> = {};
  for (const p of plan.personen) status[p.id] = 'Idee';
  return { id: neueId('b'), name: '', variante: IMMER, wer: 'alle', status, notiz: '', ...teil };
}

// ---------------------------------------------------------------------------
// Neuer Plan (Startassistent)
// ---------------------------------------------------------------------------

export interface PersonEingabe {
  name: string;
  farbe?: string;
  anspruch: number;
  resturlaub: number;
  arbeitstage?: Person['arbeitstage'];
  heiligabend: Person['heiligabend'];
  silvester: Person['silvester'];
}

export interface PlanOptionen {
  name: string;
  bundesland: Bundesland;
  planungsjahr: number;
  /** Standard: die im Land üblichen regionalen Feiertage */
  regionaleFeiertage?: string[];
  personen: PersonEingabe[];
  besondereTage?: Omit<BesondererTag, 'id'>[];
}

export function standardVarianten(): Variante[] {
  return [
    { id: 'A', name: 'A', beschreibung: '', startetLeer: false },
    { id: 'B', name: 'B', beschreibung: '', startetLeer: false },
  ];
}

export function standardRegionaleFeiertage(land: Bundesland): string[] {
  return regionaleFeiertageFuer(land)
    .filter((r) => r.standard)
    .map((r) => r.id);
}

export function neuerPlan(o: PlanOptionen): Plan {
  const regional = o.regionaleFeiertage ?? standardRegionaleFeiertage(o.bundesland);
  const personen: Person[] = o.personen.slice(0, 2).map((p, i) => ({
    id: PERSON_IDS[i],
    name: p.name.trim() || `Person ${i + 1}`,
    farbe: p.farbe ?? STANDARD_FARBEN[PERSON_IDS[i]],
    anspruch: p.anspruch,
    resturlaub: p.resturlaub,
    arbeitstage: p.arbeitstage?.length ? [...p.arbeitstage].sort() : [...STANDARD_ARBEITSTAGE],
    heiligabend: p.heiligabend,
    silvester: p.silvester,
  }));
  return {
    schema: PLAN_SCHEMA,
    id: neueId('plan'),
    name: o.name.trim() || `Urlaub ${o.planungsjahr}`,
    bundesland: o.bundesland,
    regionaleFeiertage: regional,
    planungsjahr: o.planungsjahr,
    personen,
    farbeGemeinsam: STANDARD_FARBEN.gemeinsam,
    // Varianten sind für Einsteiger verwirrend → erst auf Wunsch in den Einstellungen einschalten
    variantenAktiv: false,
    varianten: standardVarianten(),
    aktiveVariante: 'A',
    feiertage: feiertageFuer(o.bundesland, o.planungsjahr, regional),
    schulferien: schulferienFuer(o.bundesland, o.planungsjahr),
    besondereTage: (o.besondereTage ?? []).map((t) => ({ ...t, id: neueId('t') })),
    bloecke: [],
  };
}

export function duplizierePlan(plan: Plan, name = `${plan.name} (Kopie)`): Plan {
  const { revision: _r, geaendertAm: _g, ...rest } = structuredClone(plan);
  return { ...rest, id: neueId('plan'), name };
}

// ---------------------------------------------------------------------------
// Jahr, Bundesland, regionale Feiertage
// ---------------------------------------------------------------------------

/** Wechselt Jahr und/oder Bundesland und berechnet Feiertage und Schulferien neu. */
export function setzeOrtUndJahr(plan: Plan, land: Bundesland, jahr: number, regional?: string[]): Plan {
  const reg =
    regional ?? (land === plan.bundesland ? plan.regionaleFeiertage : standardRegionaleFeiertage(land));
  return {
    ...plan,
    bundesland: land,
    planungsjahr: jahr,
    regionaleFeiertage: reg,
    feiertage: feiertageFuer(land, jahr, reg),
    schulferien: schulferienFuer(land, jahr),
  };
}

/** Nur die Feiertage neu berechnen (z. B. nach Änderung der regionalen Feiertage). */
export function setzeRegionaleFeiertage(plan: Plan, regional: string[]): Plan {
  return { ...plan, regionaleFeiertage: regional, feiertage: feiertageFuer(plan.bundesland, plan.planungsjahr, regional) };
}

// ---------------------------------------------------------------------------
// Personen
// ---------------------------------------------------------------------------

export function aktualisierePerson(plan: Plan, id: PersonId, patch: Partial<Omit<Person, 'id'>>): Plan {
  return { ...plan, personen: plan.personen.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

/** Zweite Person hinzufügen. Bisherige Blöcke gehörten nur Person 1 und werden ihr zugeordnet. */
export function fuegePersonHinzu(plan: Plan, name: string): Plan {
  if (plan.personen.length >= 2) return plan;
  const erste = plan.personen[0];
  const neu: Person = {
    id: 'p2',
    name: name.trim() || 'Person 2',
    farbe: STANDARD_FARBEN.p2,
    anspruch: erste?.anspruch ?? 30,
    resturlaub: 0,
    arbeitstage: [...STANDARD_ARBEITSTAGE],
    heiligabend: erste?.heiligabend ?? 1,
    silvester: erste?.silvester ?? 1,
  };
  return {
    ...plan,
    personen: [...plan.personen, neu],
    bloecke: plan.bloecke.map((b) => ({
      ...b,
      wer: b.wer === 'alle' ? 'p1' : b.wer,
      status: { ...b.status, p2: 'Idee' },
    })),
  };
}

/** Wie viele Blöcke gehören nur dieser Person (und würden beim Entfernen gelöscht)? */
export function bloeckeNurFuer(plan: Plan, id: PersonId): number {
  return plan.bloecke.filter((b) => b.wer === id).length;
}

/**
 * Person entfernen (nur bei zwei Personen). Blöcke nur dieser Person werden gelöscht,
 * die verbleibende Person wird zu "p1".
 */
export function entfernePerson(plan: Plan, id: PersonId): Plan {
  if (plan.personen.length < 2) return plan;
  const bleibt = plan.personen.find((p) => p.id !== id)!;
  return {
    ...plan,
    personen: [{ ...bleibt, id: 'p1' }],
    bloecke: plan.bloecke
      .filter((b) => b.wer !== id)
      .map((b) => ({ ...b, wer: 'alle' as Wer, status: { p1: b.status[bleibt.id] ?? 'Idee' } })),
  };
}

// ---------------------------------------------------------------------------
// Varianten
// ---------------------------------------------------------------------------

export function fuegeVarianteHinzu(plan: Plan, name: string, startetLeer = false): Plan {
  const v: Variante = { id: neueId('v'), name: name.trim() || `Variante ${plan.varianten.length + 1}`, beschreibung: '', startetLeer };
  return { ...plan, varianten: [...plan.varianten, v] };
}

export function aktualisiereVariante(plan: Plan, id: string, patch: Partial<Omit<Variante, 'id'>>): Plan {
  return { ...plan, varianten: plan.varianten.map((v) => (v.id === id ? { ...v, ...patch } : v)) };
}

/** Variante löschen: ihre Blöcke werden auf „Aus“ gesetzt (bleiben als Idee erhalten). */
export function entferneVariante(plan: Plan, id: string): Plan {
  if (plan.varianten.length <= 1) return plan;
  const varianten = plan.varianten.filter((v) => v.id !== id);
  return {
    ...plan,
    varianten,
    aktiveVariante: plan.aktiveVariante === id ? varianten[0].id : plan.aktiveVariante,
    bloecke: plan.bloecke.map((b) => (b.variante === id ? { ...b, variante: AUS } : b)),
  };
}
