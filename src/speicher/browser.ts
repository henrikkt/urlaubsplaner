import { clear, createStore, del, get, keys, set, type UseStore } from 'idb-keyval';
import { pruefeArbeitsbereich, type Arbeitsbereich, type GeladenerArbeitsbereich } from './arbeitsbereich';
import type { PlanSpeicher } from './speicher';

const DB_NAME = 'urlaubsplaner';
const STORE_NAME = 'daten';
const SCHLUESSEL = 'arbeitsbereich';
const LS_SCHLUESSEL = 'urlaubsplaner-arbeitsbereich';
const KANAL = 'urlaubsplaner-aenderung';

/** Fallback, wenn IndexedDB nicht verfügbar ist (z. B. in sehr restriktiven Browsern). */
interface Ablage {
  lies(): Promise<unknown>;
  schreib(wert: unknown): Promise<void>;
  sichereDefekt(roh: unknown): Promise<void>;
  loescheAlles(): Promise<void>;
}

function idbAblage(store: UseStore): Ablage {
  return {
    lies: () => get(SCHLUESSEL, store),
    schreib: (wert) => set(SCHLUESSEL, wert, store),
    sichereDefekt: (roh) => set(`defekt-${new Date().toISOString()}`, roh, store),
    loescheAlles: () => clear(store),
  };
}

function lsAblage(): Ablage {
  return {
    lies: async () => {
      const t = localStorage.getItem(LS_SCHLUESSEL);
      return t ? JSON.parse(t) : undefined;
    },
    schreib: async (wert) => localStorage.setItem(LS_SCHLUESSEL, JSON.stringify(wert)),
    sichereDefekt: async (roh) => localStorage.setItem(`${LS_SCHLUESSEL}-defekt`, JSON.stringify(roh)),
    loescheAlles: async () => {
      for (const k of Object.keys(localStorage)) if (k.startsWith('urlaubsplaner')) localStorage.removeItem(k);
    },
  };
}

async function idbVerfuegbar(store: UseStore): Promise<boolean> {
  try {
    if (typeof indexedDB === 'undefined') return false;
    await keys(store);
    return true;
  } catch {
    return false;
  }
}

export class BrowserSpeicher implements PlanSpeicher {
  readonly modus = 'browser' as const;
  readonly mehrerePlaene = true;
  private ablage: Promise<Ablage>;
  private kanal: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(KANAL) : null;

  constructor(dbName = DB_NAME) {
    const store = createStore(dbName, STORE_NAME);
    this.ablage = idbVerfuegbar(store).then((ok) => (ok ? idbAblage(store) : lsAblage()));
  }

  async load(): Promise<GeladenerArbeitsbereich | null> {
    const a = await this.ablage;
    const roh = await a.lies();
    if (roh === undefined || roh === null) return null;
    try {
      const geladen = pruefeArbeitsbereich(roh);
      // Beschädigte Pläne nicht stillschweigend verlieren: Rohdaten getrennt sichern
      if (geladen.defekt.length) await a.sichereDefekt(geladen.defekt);
      return geladen;
    } catch {
      await a.sichereDefekt(roh);
      return null;
    }
  }

  async save(ab: Arbeitsbereich): Promise<void> {
    const a = await this.ablage;
    await a.schreib(ab);
    this.kanal?.postMessage('gespeichert');
  }

  /** Löscht alle Daten dieser App auf diesem Gerät. */
  async loescheAlles(): Promise<void> {
    const a = await this.ablage;
    await a.loescheAlles();
    try {
      await del(SCHLUESSEL, createStore(DB_NAME, STORE_NAME));
    } catch {
      /* bereits gelöscht */
    }
    this.kanal?.postMessage('geloescht');
  }

  /** Andere Tabs derselben App melden Änderungen. */
  beiAenderungInAnderemTab(f: (art: string) => void): () => void {
    if (!this.kanal) return () => {};
    const h = (e: MessageEvent) => f(String(e.data));
    this.kanal.addEventListener('message', h);
    return () => this.kanal?.removeEventListener('message', h);
  }
}

// ---------------------------------------------------------------------------
// Dauerhafter Speicher (navigator.storage.persist)
// ---------------------------------------------------------------------------

export type PersistStatus = 'dauerhaft' | 'nicht-dauerhaft' | 'unbekannt';

export async function persistStatus(): Promise<PersistStatus> {
  try {
    if (!navigator.storage?.persisted) return 'unbekannt';
    return (await navigator.storage.persisted()) ? 'dauerhaft' : 'nicht-dauerhaft';
  } catch {
    return 'unbekannt';
  }
}

export async function fordereDauerhaftAn(): Promise<PersistStatus> {
  try {
    if (!navigator.storage?.persist) return 'unbekannt';
    return (await navigator.storage.persist()) ? 'dauerhaft' : 'nicht-dauerhaft';
  } catch {
    return 'unbekannt';
  }
}
