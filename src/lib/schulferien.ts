import daten from '../data/schulferien.json';
import type { Bundesland } from './feiertage';
import type { Ferien } from './types';

interface FerienRoh {
  name: string;
  von: string;
  bis: string;
}

const LAENDER = daten.laender as Record<Bundesland, FerienRoh[]>;

/** Jahre, für die Schulferien mitgeliefert werden. */
export const FERIEN_JAHRE: readonly number[] = daten.jahre;
export const FERIEN_QUELLE = { quelle: daten.quelle, lizenz: daten.lizenz, abgerufenAm: daten.abgerufenAm };

/**
 * Schulferien eines Landes, die das Planungsjahr berühren (inkl. Weihnachtsferien über den Jahreswechsel).
 * IDs sind stabil, damit ein erneutes Laden keine Duplikate erzeugt.
 */
export function schulferienFuer(land: Bundesland, jahr: number): Ferien[] {
  const anfang = `${jahr}-01-01`;
  const ende = `${jahr}-12-31`;
  return (LAENDER[land] ?? [])
    .filter((f) => f.von <= ende && f.bis >= anfang)
    .map((f) => ({ id: `ferien-${land}-${f.von}`, name: f.name, von: f.von, bis: f.bis }));
}

/** Gibt es für dieses Jahr mitgelieferte Ferien (mindestens die Sommerferien)? */
export function hatFerienDaten(land: Bundesland, jahr: number): boolean {
  return (LAENDER[land] ?? []).some((f) => f.von.startsWith(String(jahr)) && /sommer/i.test(f.name));
}
