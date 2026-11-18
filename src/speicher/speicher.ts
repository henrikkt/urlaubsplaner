import type { Arbeitsbereich, GeladenerArbeitsbereich } from './arbeitsbereich';

/**
 * Gemeinsame Schnittstelle für beide Betriebsmodi.
 *  - "browser": IndexedDB im Browser des Nutzers (GitHub Pages)
 *  - "server":  Express-API mit data/urlaubsplan.json (lokal im WLAN)
 */
export interface PlanSpeicher {
  readonly modus: 'browser' | 'server';
  /** Unterstützt der Speicher mehrere Pläne (Umschalter, Duplizieren, Löschen)? */
  readonly mehrerePlaene: boolean;
  /** null = noch nichts gespeichert (erster Start → Startassistent) */
  load(): Promise<GeladenerArbeitsbereich | null>;
  save(ab: Arbeitsbereich): Promise<void>;
}

export const SPEICHER_MODUS: 'browser' | 'server' = import.meta.env.VITE_STORAGE_MODE === 'server' ? 'server' : 'browser';
