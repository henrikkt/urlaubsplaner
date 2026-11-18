import { baue, differenzTage, istGueltigesDatum, istWochenende, jahrVon, jedenTag, monatVon, wochentag, zerlege } from './datum';
import { aktiveVarianteVon } from './plan';
import {
  ALLE_BLOECKE,
  AUS,
  IMMER,
  type BesondererTag,
  type Ferien,
  type ISODatum,
  type Person,
  type PersonId,
  type Plan,
  type Status,
  type Urlaubsblock,
  type Variante,
} from './types';

// ---------------------------------------------------------------------------
// Kontext: alles, was für Tageswerte nötig ist
// ---------------------------------------------------------------------------

export interface Kontext {
  jahr: number;
  feiertage: Map<ISODatum, string>;
  personen: Person[];
  personenIds: PersonId[];
  schulferien: Ferien[];
}

export function erstelleKontext(plan: Plan): Kontext {
  const feiertage = new Map<ISODatum, string>();
  for (const f of plan.feiertage) {
    if (!istGueltigesDatum(f.datum)) continue;
    const vorhanden = feiertage.get(f.datum);
    feiertage.set(f.datum, vorhanden ? `${vorhanden} / ${f.name}` : f.name);
  }
  return {
    jahr: plan.planungsjahr,
    feiertage,
    personen: plan.personen,
    personenIds: plan.personen.map((p) => p.id),
    schulferien: plan.schulferien.filter((f) => istGueltigesDatum(f.von) && istGueltigesDatum(f.bis)),
  };
}

function personAus(ctx: Kontext, p: PersonId): Person | undefined {
  return ctx.personen.find((x) => x.id === p);
}

// ---------------------------------------------------------------------------
// Grundregeln
// ---------------------------------------------------------------------------

/**
 * Aktiv, wenn variante = "Immer" oder = aktive Variante. "Aus" ist nie aktiv.
 * Ausnahme Varianten mit startetLeer (eigene Planung): dort zählen nur Blöcke genau dieser Variante.
 */
export function istAktiv(b: Urlaubsblock, aktiv: Variante): boolean {
  // Variantenvergleich aus: alles zählt außer geparkten Ideen
  if (aktiv.id === ALLE_BLOECKE) return b.variante !== AUS;
  if (aktiv.startetLeer) return b.variante === aktiv.id;
  return b.variante === IMMER || b.variante === aktiv.id;
}

export function betrifft(b: Urlaubsblock, p: PersonId): boolean {
  return b.wer === 'alle' || b.wer === p;
}

export function istFeiertag(d: ISODatum, ctx: Kontext): boolean {
  return ctx.feiertage.has(d);
}

/** Arbeitet die Person an diesem Wochentag? */
export function istArbeitstag(d: ISODatum, p: PersonId, ctx: Kontext): boolean {
  const person = personAus(ctx, p);
  return person ? person.arbeitstage.includes(wochentag(d) as Person['arbeitstage'][number]) : false;
}

/**
 * Urlaubstag-Wert eines Tages für eine Person:
 * 0 an Feiertagen und Tagen, an denen die Person nicht arbeitet,
 * am 24.12./31.12. der Einstellungswert, sonst 1.
 * Nur Tage im Planungsjahr zählen (sonst 0).
 */
export function tageswert(d: ISODatum, p: PersonId, ctx: Kontext): number {
  if (!istGueltigesDatum(d) || jahrVon(d) !== ctx.jahr) return 0;
  const person = personAus(ctx, p);
  if (!person) return 0;
  if (ctx.feiertage.has(d) || !istArbeitstag(d, p, ctx)) return 0;
  const { monat, tag } = zerlege(d);
  if (monat === 12 && tag === 24) return person.heiligabend;
  if (monat === 12 && tag === 31) return person.silvester;
  return 1;
}

export function personStatus(b: Urlaubsblock, p: PersonId): Status {
  return b.status[p] ?? 'Idee';
}

// ---------------------------------------------------------------------------
// Kennzahlen eines Blocks
// ---------------------------------------------------------------------------

/** Tage frei am Stück = bis − von + 1 (0 bei ungültigem Zeitraum). */
export function tageFrei(b: Pick<Urlaubsblock, 'von' | 'bis'>): number {
  if (!istGueltigesDatum(b.von) || !istGueltigesDatum(b.bis)) return 0;
  return Math.max(0, differenzTage(b.von, b.bis) + 1);
}

/** Summe der Tageswerte im Zeitraum, falls die Person betroffen ist – sonst 0. */
export function urlaubstageBlock(b: Urlaubsblock, p: PersonId, ctx: Kontext): number {
  if (!betrifft(b, p)) return 0;
  return summeTageswerte(b.von, b.bis, p, ctx);
}

export function summeTageswerte(von: ISODatum, bis: ISODatum, p: PersonId, ctx: Kontext): number {
  let s = 0;
  for (const d of jedenTag(von, bis)) s += tageswert(d, p, ctx);
  return s;
}

/** Tage frei / größte Zahl an Urlaubstagen einer Person; null wenn kein Urlaubstag nötig ist. */
export function effizienz(freieTage: number, ut: number): number | null {
  if (ut <= 0) return null;
  return freieTage / ut;
}

/** Ferien, die sich mit dem Zeitraum überschneiden (von ≤ Ferienende und bis ≥ Ferienbeginn). */
export function ferienUeberschneidung(von: ISODatum, bis: ISODatum, ferien: Ferien[]): Ferien[] {
  if (!istGueltigesDatum(von) || !istGueltigesDatum(bis)) return [];
  return ferien.filter((f) => von <= f.bis && bis >= f.von);
}

export function ferienAm(d: ISODatum, ferien: Ferien[]): Ferien | undefined {
  return ferien.find((f) => d >= f.von && d <= f.bis);
}

export type ProPerson<T> = Partial<Record<PersonId, T>>;

export function proPerson<T>(ctx: Pick<Kontext, 'personenIds'>, f: (p: PersonId) => T): ProPerson<T> {
  const out: ProPerson<T> = {};
  for (const p of ctx.personenIds) out[p] = f(p);
  return out;
}

export function maxWert(werte: ProPerson<number>): number {
  return Math.max(0, ...Object.values(werte).map((x) => x ?? 0));
}

export interface BlockKennzahlen {
  tageFrei: number;
  ut: ProPerson<number>;
  effizienz: number | null;
  ferien: Ferien[];
  inFerien: boolean;
}

export function kennzahlenBlock(b: Urlaubsblock, ctx: Kontext): BlockKennzahlen {
  const frei = tageFrei(b);
  const ut = proPerson(ctx, (p) => urlaubstageBlock(b, p, ctx));
  const ferien = ferienUeberschneidung(b.von, b.bis, ctx.schulferien);
  return { tageFrei: frei, ut, effizienz: effizienz(frei, maxWert(ut)), ferien, inFerien: ferien.length > 0 };
}

// ---------------------------------------------------------------------------
// Tagesbelegung (Grundlage für Tracker, Kalender, Monate – nie doppelt zählen)
// ---------------------------------------------------------------------------

export type Belegung = Map<ISODatum, ProPerson<Urlaubsblock[]>>;

/** Für jeden Tag: welche aktiven Blöcke betreffen welche Person? */
export function belegung(bloecke: Urlaubsblock[], variante: Variante, personenIds: readonly PersonId[]): Belegung {
  const map: Belegung = new Map();
  for (const b of bloecke) {
    if (!istAktiv(b, variante)) continue;
    for (const d of jedenTag(b.von, b.bis)) {
      let eintrag = map.get(d);
      if (!eintrag) {
        eintrag = {};
        for (const p of personenIds) eintrag[p] = [];
        map.set(d, eintrag);
      }
      for (const p of personenIds) if (betrifft(b, p)) eintrag[p]!.push(b);
    }
  }
  return map;
}

export function belegungVon(plan: Plan, variante: Variante = aktiveVarianteVon(plan)): Belegung {
  return belegung(plan.bloecke, variante, plan.personen.map((p) => p.id));
}

export function hatUrlaub(bel: Belegung, d: ISODatum, p: PersonId): boolean {
  return (bel.get(d)?.[p]?.length ?? 0) > 0;
}

const STATUS_RANG: Record<Status, number> = { Abgelehnt: 0, Idee: 1, Abgestimmt: 2, Beantragt: 3, Genehmigt: 4 };

/** Bei überlappenden Blöcken gilt für einen Tag der "beste" Status. */
export function besterStatus(bloecke: Urlaubsblock[], p: PersonId): Status | null {
  let best: Status | null = null;
  for (const b of bloecke) {
    const s = personStatus(b, p);
    if (best === null || STATUS_RANG[s] > STATUS_RANG[best]) best = s;
  }
  return best;
}

function varianteAus(plan: Plan, v: Variante | string | undefined): Variante {
  if (v === undefined) return aktiveVarianteVon(plan);
  if (typeof v !== 'string') return v;
  return plan.varianten.find((x) => x.id === v) ?? aktiveVarianteVon(plan);
}

// ---------------------------------------------------------------------------
// Tracker je Person
// ---------------------------------------------------------------------------

export interface Tracker {
  person: PersonId;
  anspruch: number;
  resturlaub: number;
  verfuegbar: number;
  verplant: number;
  nochVerfuegbar: number;
  genehmigt: number;
  beantragt: number;
  nichtBeantragt: number;
  abgelehnt: number;
  inSchulferien: number;
  /** Kalendertage in aktiven Blöcken der Person (ohne Doppelzählung) */
  freieTage: number;
  effizienz: number | null;
}

export function berechneTracker(plan: Plan, p: PersonId, variante?: Variante | string, ctx = erstelleKontext(plan)): Tracker {
  const bel = belegungVon(plan, varianteAus(plan, variante));
  const person = plan.personen.find((x) => x.id === p);
  const anspruch = person?.anspruch ?? 0;
  const resturlaub = person?.resturlaub ?? 0;
  let verplant = 0;
  let genehmigt = 0;
  let beantragt = 0;
  let nichtBeantragt = 0;
  let abgelehnt = 0;
  let inSchulferien = 0;
  let freieTage = 0;

  for (const [d, eintrag] of bel) {
    const bl = eintrag[p] ?? [];
    if (bl.length === 0) continue;
    freieTage++;
    const w = tageswert(d, p, ctx);
    if (w === 0) continue;
    verplant += w;
    if (ferienAm(d, ctx.schulferien)) inSchulferien += w;
    const s = besterStatus(bl, p);
    if (s === 'Genehmigt') genehmigt += w;
    else if (s === 'Beantragt') beantragt += w;
    else if (s === 'Abgelehnt') abgelehnt += w;
    else nichtBeantragt += w;
  }

  const verfuegbar = anspruch + resturlaub;
  return {
    person: p,
    anspruch,
    resturlaub,
    verfuegbar,
    verplant,
    nochVerfuegbar: verfuegbar - verplant,
    genehmigt,
    beantragt,
    nichtBeantragt,
    abgelehnt,
    inSchulferien,
    freieTage,
    effizienz: effizienz(freieTage, verplant),
  };
}

/** Tage mit Urlaubswert > 0, an denen alle Personen Urlaub haben (nur sinnvoll bei zwei Personen). */
export function gemeinsameUrlaubstage(plan: Plan, variante?: Variante | string, ctx = erstelleKontext(plan)): number {
  if (plan.personen.length < 2) return 0;
  const bel = belegungVon(plan, varianteAus(plan, variante));
  let n = 0;
  for (const [d, eintrag] of bel) {
    if (!ctx.personenIds.every((p) => (eintrag[p]?.length ?? 0) > 0)) continue;
    if (ctx.personenIds.some((p) => tageswert(d, p, ctx) > 0)) n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Überschneidungen aktiver Blöcke
// ---------------------------------------------------------------------------

export interface Ueberschneidung {
  a: Urlaubsblock;
  b: Urlaubsblock;
  personen: PersonId[];
  von: ISODatum;
  bis: ISODatum;
}

export function ueberschneidungen(plan: Plan, variante?: Variante | string): Ueberschneidung[] {
  const v = varianteAus(plan, variante);
  const ids = plan.personen.map((p) => p.id);
  const aktiv = plan.bloecke.filter(
    (b) => istAktiv(b, v) && istGueltigesDatum(b.von) && istGueltigesDatum(b.bis) && b.von <= b.bis,
  );
  const out: Ueberschneidung[] = [];
  for (let i = 0; i < aktiv.length; i++) {
    for (let j = i + 1; j < aktiv.length; j++) {
      const a = aktiv[i];
      const b = aktiv[j];
      if (a.von > b.bis || a.bis < b.von) continue;
      const personen = ids.filter((p) => betrifft(a, p) && betrifft(b, p));
      if (personen.length === 0) continue;
      out.push({ a, b, personen, von: a.von > b.von ? a.von : b.von, bis: a.bis < b.bis ? a.bis : b.bis });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Monatsübersicht
// ---------------------------------------------------------------------------

export interface Monatszeile {
  monat: number; // 1–12
  ut: ProPerson<number>;
  /** Kalendertage, an denen alle Personen in einem aktiven Block sind */
  gemeinsamFrei: number;
  /** Feiertage, die auf Mo–Fr fallen */
  feiertageWerktags: number;
}

export function monatsuebersicht(plan: Plan, variante?: Variante | string, ctx = erstelleKontext(plan)): Monatszeile[] {
  const zeilen: Monatszeile[] = Array.from({ length: 12 }, (_, i) => ({
    monat: i + 1,
    ut: proPerson(ctx, () => 0),
    gemeinsamFrei: 0,
    feiertageWerktags: 0,
  }));
  const bel = belegungVon(plan, varianteAus(plan, variante));
  for (const [d, eintrag] of bel) {
    if (jahrVon(d) !== ctx.jahr) continue;
    const z = zeilen[monatVon(d) - 1];
    for (const p of ctx.personenIds) if ((eintrag[p]?.length ?? 0) > 0) z.ut[p] = (z.ut[p] ?? 0) + tageswert(d, p, ctx);
    if (ctx.personenIds.length > 1 && ctx.personenIds.every((p) => (eintrag[p]?.length ?? 0) > 0)) z.gemeinsamFrei++;
  }
  for (const d of ctx.feiertage.keys()) {
    if (jahrVon(d) === ctx.jahr && !istWochenende(d)) zeilen[monatVon(d) - 1].feiertageWerktags++;
  }
  return zeilen;
}

// ---------------------------------------------------------------------------
// Variantenvergleich
// ---------------------------------------------------------------------------

export interface VariantenErgebnis {
  variante: Variante;
  tracker: ProPerson<Tracker>;
  gemeinsameUrlaubstage: number;
}

export function variantenvergleich(plan: Plan, ctx = erstelleKontext(plan)): VariantenErgebnis[] {
  return plan.varianten.map((v) => ({
    variante: v,
    tracker: proPerson(ctx, (p) => berechneTracker(plan, p, v, ctx)),
    gemeinsameUrlaubstage: gemeinsameUrlaubstage(plan, v, ctx),
  }));
}

// ---------------------------------------------------------------------------
// Countdown
// ---------------------------------------------------------------------------

export interface NaechsterUrlaub {
  block: Urlaubsblock;
  laufend: boolean;
  /** Tage bis zum Beginn (0 wenn laufend) */
  tageBis: number;
  /** Verbleibende Tage inkl. heute, falls laufend */
  nochTage: number;
}

export function naechsterUrlaub(plan: Plan, heute: ISODatum): NaechsterUrlaub | null {
  const v = aktiveVarianteVon(plan);
  const kandidaten = plan.bloecke
    .filter((b) => istAktiv(b, v) && tageFrei(b) > 0 && b.bis >= heute)
    .sort((x, y) => x.von.localeCompare(y.von));
  const b = kandidaten[0];
  if (!b) return null;
  if (b.von <= heute) return { block: b, laufend: true, tageBis: 0, nochTage: differenzTage(heute, b.bis) + 1 };
  return { block: b, laufend: false, tageBis: differenzTage(heute, b.von), nochTage: 0 };
}

// ---------------------------------------------------------------------------
// Besondere Tage
// ---------------------------------------------------------------------------

export function besondereTageAm(d: ISODatum, liste: BesondererTag[]): BesondererTag[] {
  if (!istGueltigesDatum(d)) return [];
  return liste.filter((t) => {
    if (!istGueltigesDatum(t.datum)) return false;
    if (t.datum === d) return true;
    return t.jaehrlich && t.datum.slice(5) === d.slice(5);
  });
}

/** Datum eines besonderen Tags im Planungsjahr (für jährliche Tage), sonst sein Originaldatum. */
export function besondererTagImJahr(t: BesondererTag, jahr: number): ISODatum {
  if (!t.jaehrlich || !istGueltigesDatum(t.datum)) return t.datum;
  const { monat, tag } = zerlege(t.datum);
  const kandidat = baue(jahr, monat, tag);
  return istGueltigesDatum(kandidat) ? kandidat : baue(jahr, 2, 28);
}
