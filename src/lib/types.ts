import type { Bundesland } from './feiertage';

/** ISO-Datum im Format YYYY-MM-DD. Wird nie mit lokalen Uhrzeiten verrechnet. */
export type ISODatum = string;

/** Aktuelle Schema-Version eines Plans. Ältere Versionen werden beim Laden migriert. */
export const PLAN_SCHEMA = 3 as const;

/** Personen haben feste IDs: "p1" und optional "p2" (bestimmt auch die Farbe). */
export type PersonId = 'p1' | 'p2';
export const PERSON_IDS: readonly PersonId[] = ['p1', 'p2'] as const;

export type Status = 'Idee' | 'Abgestimmt' | 'Beantragt' | 'Genehmigt' | 'Abgelehnt';
export const STATUS_REIHENFOLGE: readonly Status[] = ['Idee', 'Abgestimmt', 'Beantragt', 'Genehmigt', 'Abgelehnt'] as const;

/** Wert für 24.12. / 31.12.: ganzer, halber oder kein Urlaubstag. */
export type TagesAnteil = 0 | 0.5 | 1;

/** Wochentag: 0 = Montag … 6 = Sonntag */
export type Wochentag = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const STANDARD_ARBEITSTAGE: readonly Wochentag[] = [0, 1, 2, 3, 4] as const;

export interface Person {
  id: PersonId;
  name: string;
  /** Farbe als #RRGGBB */
  farbe: string;
  anspruch: number;
  resturlaub: number;
  /** Wochentage, an denen die Person arbeitet (0 = Mo … 6 = So) */
  arbeitstage: Wochentag[];
  heiligabend: TagesAnteil;
  silvester: TagesAnteil;
}

export const STANDARD_FARBEN: Record<PersonId | 'gemeinsam', string> = {
  p1: '#3B7DD8',
  p2: '#D9468F',
  gemeinsam: '#2E9E5B',
};

/** Block-Variante: "Immer", "Aus" oder die ID einer Variante des Plans */
export const IMMER = 'Immer';
export const AUS = 'Aus';
/** Interne ID, wenn der Variantenvergleich ausgeschaltet ist: alle Blöcke außer "Aus" zählen */
export const ALLE_BLOECKE = '*';
export type BlockVariante = string;

export interface Variante {
  id: string;
  name: string;
  beschreibung: string;
  /**
   * true = "Eigene Planung": startet leer. In dieser Variante zählen nur ihre eigenen Blöcke,
   * auch "Immer"-Blöcke sind nicht aktiv. Der Kalender zeigt dazu Urlaubstipps.
   */
  startetLeer: boolean;
}

/** "alle" = alle Personen des Plans, sonst eine einzelne Person */
export type Wer = 'alle' | PersonId;

export interface Urlaubsblock {
  id: string;
  /** Anlass */
  name: string;
  variante: BlockVariante;
  wer: Wer;
  /** Erster freier Tag (inkl. Wochenenden/Feiertage) */
  von: ISODatum;
  /** Letzter freier Tag (inkl.) */
  bis: ISODatum;
  /** Antragsstatus je Person */
  status: Partial<Record<PersonId, Status>>;
  notiz: string;
}

export interface Feiertag {
  datum: ISODatum;
  name: string;
}

export interface Ferien {
  id: string;
  name: string;
  von: ISODatum;
  bis: ISODatum;
}

export interface BesondererTag {
  id: string;
  datum: ISODatum;
  name: string;
  /** true: wiederholt sich jedes Jahr am selben Tag (z. B. Geburtstag) */
  jaehrlich: boolean;
  symbol: string;
}

export interface Plan {
  schema: typeof PLAN_SCHEMA;
  id: string;
  /** z. B. "Urlaub 2027" */
  name: string;
  bundesland: Bundesland;
  /** IDs aus REGIONALE_FEIERTAGE, die für diesen Plan gelten */
  regionaleFeiertage: string[];
  planungsjahr: number;
  /** 1 oder 2 Personen, IDs "p1" und "p2" in dieser Reihenfolge */
  personen: Person[];
  /** Farbe für gemeinsamen Urlaub */
  farbeGemeinsam: string;
  /**
   * "Varianten vergleichen" an/aus. Aus: kein Umschalter, alle Blöcke außer "Aus" (geparkt) zählen.
   * Die Varianten bleiben gespeichert, damit sie beim Einschalten wieder da sind.
   */
  variantenAktiv: boolean;
  /** mindestens eine Variante */
  varianten: Variante[];
  aktiveVariante: string;
  feiertage: Feiertag[];
  schulferien: Ferien[];
  besondereTage: BesondererTag[];
  bloecke: Urlaubsblock[];
  /** Server-Modus: wird vom Server bei jedem Speichern erhöht. */
  revision?: number;
  /** ISO-Zeitstempel der letzten Speicherung (nur Anzeige). */
  geaendertAm?: string;
}
