import { addiereTage, istWochenende, jahrVon, jedenTag, wochentag, zerlege } from './datum';
import { feiertageFuer } from './feiertage';
import {
  belegungVon,
  erstelleKontext,
  ferienUeberschneidung,
  hatUrlaub,
  istArbeitstag,
  maxWert,
  proPerson,
  tageswert,
  type Kontext,
  type ProPerson,
} from './berechnung';
import type { Ferien, ISODatum, Plan } from './types';

export type ChancenArt = 'Brückentag' | 'Ganze Woche' | 'Anlass';

export interface Chance {
  id: string;
  art: ChancenArt;
  von: ISODatum;
  bis: ISODatum;
  /** Feiertage bzw. Anlässe im Zeitraum, z. B. "Christi Himmelfahrt" */
  anlass: string;
  ut: ProPerson<number>;
  /** größte Zahl an Urlaubstagen einer Person */
  utMax: number;
  tageFrei: number;
  effizienz: number;
  /** Tage, an denen (mindestens eine Person) Urlaub nehmen muss */
  urlaubstage: ISODatum[];
  ferien: Ferien[];
  inFerien: boolean;
  /** Zeitraum ist für alle Personen bereits komplett durch aktive Blöcke abgedeckt */
  bereitsVerplant: boolean;
}

const MAX_BRUECKEN_UT = 2;
const MIN_TAGE_BRUECKE = 4;
const SUCHRADIUS = 4;

export interface ZeitraumWerkzeug {
  /** Tag ist für alle ohnehin frei (kein Arbeitstag, Feiertag, 24./31.12. mit Wert 0) */
  frei: (d: ISODatum) => boolean;
  /** Zeitraum über angrenzende freie Tage hinweg verlängern */
  verlaengere: (s: ISODatum, e: ISODatum) => [ISODatum, ISODatum];
  /** Kennzahlen eines Zeitraums; null, wenn er nichts kostet oder Arbeitstage außerhalb des Jahres enthält */
  bewerte: (von: ISODatum, bis: ISODatum, art: ChancenArt, anlass?: string) => Chance | null;
}

export function zeitraumWerkzeug(plan: Plan, ctx: Kontext = erstelleKontext(plan)): ZeitraumWerkzeug {
  const jahr = ctx.jahr;
  // Feiertage der Nachbarjahre nur, um Zeiträume über den Jahreswechsel korrekt zu verlängern
  const nachbarFeiertage = new Set(
    [
      ...feiertageFuer(plan.bundesland, jahr - 1, plan.regionaleFeiertage),
      ...feiertageFuer(plan.bundesland, jahr + 1, plan.regionaleFeiertage),
    ].map((f) => f.datum),
  );

  const frei = (d: ISODatum): boolean => {
    if (jahrVon(d) !== jahr) return nachbarFeiertage.has(d) || ctx.personenIds.every((p) => !istArbeitstag(d, p, ctx));
    return ctx.personenIds.every((p) => tageswert(d, p, ctx) === 0);
  };

  const verlaengere = (s: ISODatum, e: ISODatum): [ISODatum, ISODatum] => {
    let von = s;
    let bis = e;
    for (let i = 0; i < 40 && frei(addiereTage(von, -1)); i++) von = addiereTage(von, -1);
    for (let i = 0; i < 40 && frei(addiereTage(bis, 1)); i++) bis = addiereTage(bis, 1);
    return [von, bis];
  };

  const bel = belegungVon(plan);

  const bewerte = (von: ISODatum, bis: ISODatum, art: ChancenArt, anlass?: string): Chance | null => {
    const tage = jedenTag(von, bis);
    // Arbeitstage außerhalb des Planungsjahres gehören zu einem anderen Urlaubskonto → nicht vorschlagen
    if (tage.some((d) => jahrVon(d) !== jahr && !frei(d))) return null;
    const ut = proPerson(ctx, () => 0);
    const urlaubstage: ISODatum[] = [];
    for (const d of tage) {
      let kostet = false;
      for (const p of ctx.personenIds) {
        const w = tageswert(d, p, ctx);
        ut[p] = (ut[p] ?? 0) + w;
        if (w > 0) kostet = true;
      }
      if (kostet) urlaubstage.push(d);
    }
    const utMax = maxWert(ut);
    if (utMax <= 0) return null;
    const ferien = ferienUeberschneidung(von, bis, ctx.schulferien);
    return {
      id: `${von}_${bis}`,
      art,
      von,
      bis,
      anlass: anlass ?? anlassText(tage, ctx),
      ut,
      utMax,
      tageFrei: tage.length,
      effizienz: tage.length / utMax,
      urlaubstage,
      ferien,
      inFerien: ferien.length > 0,
      bereitsVerplant: tage.every((d) => ctx.personenIds.every((p) => hatUrlaub(bel, d, p))),
    };
  };

  return { frei, verlaengere, bewerte };
}

/** Mo–Fr-Woche um einen Tag (bei Sa/So: die Woche davor), über freie Tage verlängert. */
export function wocheUm(d: ISODatum, w: ZeitraumWerkzeug): [ISODatum, ISODatum] {
  const montag = addiereTage(d, -wochentag(d));
  return w.verlaengere(montag, addiereTage(montag, 4));
}

export function sortiereNachEffizienz(liste: Chance[]): Chance[] {
  return [...liste].sort((x, y) => y.effizienz - x.effizienz || y.tageFrei - x.tageFrei || x.von.localeCompare(y.von));
}

/**
 * Findet alle Feiertags-Chancen im Planungsjahr:
 *  - "Brückentag": mit höchstens 2 Urlaubstagen den Feiertag zu ≥ 4 freien Tagen verlängern (beste Effizienz)
 *  - "Ganze Woche": die komplette Mo–Fr-Woche um den Feiertag herum frei nehmen
 * Anker sind Feiertage an Tagen, an denen mindestens eine Person sonst arbeiten würde,
 * sowie 24.12./31.12. (wenn sie Urlaub kosten). Sortiert nach Effizienz (absteigend), dann Länge.
 */
export function findeBrueckentage(plan: Plan, ctx: Kontext = erstelleKontext(plan)): Chance[] {
  const jahr = ctx.jahr;
  const w = zeitraumWerkzeug(plan, ctx);

  const anker: ISODatum[] = [];
  for (const d of [`${jahr}-12-24`, `${jahr}-12-31`]) {
    if (!w.frei(d)) anker.push(d);
  }
  for (const d of ctx.feiertage.keys()) {
    if (jahrVon(d) === jahr && ctx.personenIds.some((p) => istArbeitstag(d, p, ctx))) anker.push(d);
  }

  const ergebnisse = new Map<string, Chance>();
  const merke = (c: Chance | null) => {
    if (!c) return;
    const vorhanden = ergebnisse.get(c.id);
    if (!vorhanden || (vorhanden.art === 'Ganze Woche' && c.art === 'Brückentag')) ergebnisse.set(c.id, c);
  };

  for (const a of anker) {
    // 1) Beste Brücke mit ≤ 2 Urlaubstagen
    let beste: Chance | null = null;
    for (let vor = 0; vor <= SUCHRADIUS; vor++) {
      for (let nach = 0; nach <= SUCHRADIUS; nach++) {
        const [von, bis] = w.verlaengere(addiereTage(a, -vor), addiereTage(a, nach));
        const c = w.bewerte(von, bis, 'Brückentag');
        if (!c || c.utMax > MAX_BRUECKEN_UT || c.tageFrei < MIN_TAGE_BRUECKE) continue;
        if (
          !beste ||
          c.effizienz > beste.effizienz + 1e-9 ||
          (Math.abs(c.effizienz - beste.effizienz) < 1e-9 && c.tageFrei > beste.tageFrei)
        ) {
          beste = c;
        }
      }
    }
    merke(beste);

    // 2) Ganze Woche (Mo–Fr) rund um den Anker – nur wenn der Anker kein Wochenende ist
    if (!istWochenende(a)) {
      const [von, bis] = wocheUm(a, w);
      merke(w.bewerte(von, bis, 'Ganze Woche'));
    }
  }

  return sortiereNachEffizienz([...ergebnisse.values()]);
}

export function anlassText(tage: ISODatum[], ctx: Kontext): string {
  const namen: string[] = [];
  for (const d of tage) {
    const f = ctx.feiertage.get(d);
    if (f && !namen.includes(f)) namen.push(f);
    const { monat, tag } = zerlege(d);
    if (jahrVon(d) === ctx.jahr && monat === 12 && tag === 24 && !namen.includes('Heiligabend')) namen.push('Heiligabend');
    if (jahrVon(d) === ctx.jahr && monat === 12 && tag === 31 && !namen.includes('Silvester')) namen.push('Silvester');
  }
  return namen.join(' + ') || 'Wochenende';
}
