import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { duplizierePlan } from '../lib/plan';
import { pruefePlan } from '../lib/schema';
import type { Plan } from '../lib/types';
import { leererArbeitsbereich, type Arbeitsbereich } from '../speicher/arbeitsbereich';
import { BrowserSpeicher, fordereDauerhaftAn, persistStatus, type PersistStatus } from '../speicher/browser';
import { ServerSpeicher } from '../speicher/server';
import { SPEICHER_MODUS } from '../speicher/speicher';

export type SpeicherStatus = 'laden' | 'gespeichert' | 'ungespeichert' | 'speichert' | 'offline' | 'fehler';

export interface PlanInfo {
  id: string;
  name: string;
  planungsjahr: number;
}

export interface PlanZustand {
  /** false, solange noch geladen wird */
  bereit: boolean;
  /** aktiver Plan; null = noch kein Plan vorhanden (→ Startassistent) */
  plan: Plan | null;
  plaene: PlanInfo[];
  mehrerePlaene: boolean;
  modus: 'browser' | 'server';
  aendere: (fn: (p: Plan) => Plan) => void;
  status: SpeicherStatus;
  hinweis: string | null;
  schliesseHinweis: () => void;
  letztesBackup: string | null;
  merkeBackup: () => void;
  persist: PersistStatus;
  fordereDauerhaftAn: () => Promise<void>;
  wechslePlan: (id: string) => void;
  /** Neuen Plan anlegen und aktivieren (Server-Modus: ersetzt den einzigen Plan) */
  legePlanAn: (plan: Plan) => void;
  duplizierePlan: (id: string) => void;
  loeschePlan: (id: string) => void;
  /** Importierte Pläne übernehmen: hinzufügen (neue IDs bei Konflikt) oder alles ersetzen */
  importiere: (plaene: Plan[], art: 'hinzufuegen' | 'ersetzen') => void;
  allePlaene: () => Plan[];
  loescheAlles: () => Promise<void>;
}

const DEBOUNCE_MS = 400;

function info(p: Plan): PlanInfo {
  return { id: p.id, name: p.name, planungsjahr: p.planungsjahr };
}

// ===========================================================================
// Browser-Modus: alles in IndexedDB, mehrere Pläne
// ===========================================================================

let browserSpeicher: BrowserSpeicher | null = null;
function holeBrowserSpeicher(): BrowserSpeicher {
  browserSpeicher ??= new BrowserSpeicher();
  return browserSpeicher;
}

function useBrowserPlan(): PlanZustand {
  const speicher = holeBrowserSpeicher();
  const [ab, setAb] = useState<Arbeitsbereich | null>(null);
  const [status, setStatus] = useState<SpeicherStatus>('laden');
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [persist, setPersist] = useState<PersistStatus>('unbekannt');
  const aktuell = useRef<Arbeitsbereich | null>(null);
  const offen = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const speichern = useCallback(async () => {
    window.clearTimeout(timer.current);
    const stand = aktuell.current;
    if (!stand || !offen.current) return;
    setStatus('speichert');
    try {
      await speicher.save(stand);
      if (aktuell.current === stand) {
        offen.current = false;
        setStatus('gespeichert');
      }
    } catch {
      setStatus('fehler');
      setHinweis('Speichern im Browser ist fehlgeschlagen. Bitte ein Backup exportieren (Export / Import).');
    }
  }, [speicher]);

  const setze = useCallback(
    (neu: Arbeitsbereich, sofort = false) => {
      aktuell.current = neu;
      offen.current = true;
      setAb(neu);
      setStatus('ungespeichert');
      window.clearTimeout(timer.current);
      if (sofort) void speichern();
      else timer.current = window.setTimeout(() => void speichern(), DEBOUNCE_MS);
    },
    [speichern],
  );

  const laden = useCallback(async () => {
    try {
      const g = await speicher.load();
      const stand = g?.ab ?? leererArbeitsbereich();
      aktuell.current = stand;
      offen.current = false;
      setAb(stand);
      setStatus('gespeichert');
      if (g?.defekt.length) {
        setHinweis(`${g.defekt.length} beschädigte(r) Plan/Pläne konnten nicht geladen werden. Die Rohdaten wurden im Browser gesichert.`);
      } else if (g?.migriert) {
        setHinweis('Deine Daten wurden auf das neue Format umgestellt.');
      }
      if (!g) setPersist(await fordereDauerhaftAn());
      else setPersist(await persistStatus());
    } catch {
      aktuell.current = leererArbeitsbereich();
      setAb(aktuell.current);
      setStatus('fehler');
      setHinweis('Die gespeicherten Daten konnten nicht gelesen werden.');
    }
  }, [speicher]);

  useEffect(() => {
    void laden();
  }, [laden]);

  // Änderungen aus anderen Tabs übernehmen
  useEffect(
    () =>
      speicher.beiAenderungInAnderemTab((art) => {
        if (art === 'geloescht') window.location.reload();
        else if (!offen.current) void laden();
      }),
    [speicher, laden],
  );

  // Beim Verlassen / Wechsel in den Hintergrund sofort speichern
  useEffect(() => {
    const raus = () => {
      if (offen.current) void speichern();
    };
    const sichtbar = () => document.visibilityState === 'hidden' && raus();
    window.addEventListener('pagehide', raus);
    document.addEventListener('visibilitychange', sichtbar);
    return () => {
      window.removeEventListener('pagehide', raus);
      document.removeEventListener('visibilitychange', sichtbar);
    };
  }, [speichern]);

  const plan = ab?.plaene.find((p) => p.id === ab.aktiverPlanId) ?? null;

  const aendere = useCallback(
    (fn: (p: Plan) => Plan) => {
      const stand = aktuell.current;
      const p = stand?.plaene.find((x) => x.id === stand.aktiverPlanId);
      if (!stand || !p) return;
      const neu = fn(p);
      if (neu === p) return;
      setze({ ...stand, plaene: stand.plaene.map((x) => (x.id === p.id ? neu : x)) });
    },
    [setze],
  );

  const mitStand = useCallback(
    (fn: (s: Arbeitsbereich) => Arbeitsbereich) => {
      const stand = aktuell.current ?? leererArbeitsbereich();
      setze(fn(stand), true);
    },
    [setze],
  );

  return useMemo<PlanZustand>(
    () => ({
      bereit: ab !== null,
      plan,
      plaene: (ab?.plaene ?? []).map(info),
      mehrerePlaene: true,
      modus: 'browser',
      aendere,
      status,
      hinweis,
      schliesseHinweis: () => setHinweis(null),
      letztesBackup: ab?.letztesBackup ?? null,
      merkeBackup: () => mitStand((s) => ({ ...s, letztesBackup: new Date().toISOString() })),
      persist,
      fordereDauerhaftAn: async () => setPersist(await fordereDauerhaftAn()),
      wechslePlan: (id) => mitStand((s) => (s.plaene.some((p) => p.id === id) ? { ...s, aktiverPlanId: id } : s)),
      legePlanAn: (neu) => mitStand((s) => ({ ...s, plaene: [...s.plaene, neu], aktiverPlanId: neu.id })),
      duplizierePlan: (id) =>
        mitStand((s) => {
          const quelle = s.plaene.find((p) => p.id === id);
          if (!quelle) return s;
          const kopie = duplizierePlan(quelle);
          return { ...s, plaene: [...s.plaene, kopie], aktiverPlanId: kopie.id };
        }),
      loeschePlan: (id) =>
        mitStand((s) => {
          const plaene = s.plaene.filter((p) => p.id !== id);
          return { ...s, plaene, aktiverPlanId: s.aktiverPlanId === id ? (plaene[0]?.id ?? null) : s.aktiverPlanId };
        }),
      importiere: (neu, art) =>
        mitStand((s) => {
          if (art === 'ersetzen') return { ...s, plaene: neu, aktiverPlanId: neu[0]?.id ?? null };
          const vorhanden = new Set(s.plaene.map((p) => p.id));
          const hinzu = neu.map((p) => (vorhanden.has(p.id) ? { ...duplizierePlan(p, p.name) } : p));
          return { ...s, plaene: [...s.plaene, ...hinzu], aktiverPlanId: hinzu[0]?.id ?? s.aktiverPlanId };
        }),
      allePlaene: () => aktuell.current?.plaene ?? [],
      loescheAlles: async () => {
        window.clearTimeout(timer.current);
        offen.current = false;
        await speicher.loescheAlles();
        aktuell.current = leererArbeitsbereich();
        setAb(aktuell.current);
        setStatus('gespeichert');
      },
    }),
    [ab, plan, aendere, status, hinweis, persist, mitStand, speicher],
  );
}

// ===========================================================================
// Server-Modus: ein Plan auf dem lokalen Server, Abgleich zwischen Geräten
// ===========================================================================

const LS_KEY = 'urlaubsplanung-plan';
const LS_KONFLIKT = 'urlaubsplanung-konflikt-backup';
const LS_BACKUP = 'urlaubsplaner-letztes-backup';
const ABGLEICH_MS = 8000;

interface LokalerStand {
  plan: Plan;
  /** true = Änderungen, die der Server noch nicht hat */
  offen: boolean;
  /** Server-Revision, auf der die lokalen Änderungen beruhen */
  basisRevision: number;
}

function leseLokal(): LokalerStand | null {
  try {
    const roh = localStorage.getItem(LS_KEY);
    if (!roh) return null;
    const x = JSON.parse(roh);
    // pruefePlan migriert auch noch alte lokale Stände (Version 1)
    return { plan: pruefePlan(x.plan), offen: x.offen === true, basisRevision: Number(x.basisRevision) || 0 };
  } catch {
    return null;
  }
}

function schreibeLokal(stand: LokalerStand) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(stand));
  } catch {
    /* Speicher voll oder gesperrt – ignorieren */
  }
}

let serverSpeicher: ServerSpeicher | null = null;

function useServerPlan(): PlanZustand {
  serverSpeicher ??= new ServerSpeicher();
  const speicher = serverSpeicher;
  const [plan, setPlan] = useState<Plan | null>(null);
  const [bereit, setBereit] = useState(false);
  const [status, setStatus] = useState<SpeicherStatus>('laden');
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [letztesBackup, setLetztesBackup] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LS_BACKUP);
    } catch {
      return null;
    }
  });

  const aktuell = useRef<Plan | null>(null);
  const offen = useRef(false);
  const revision = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const speichertGerade = useRef(false);

  const speichern = useCallback(async () => {
    const p = aktuell.current;
    if (!p || speichertGerade.current) return;
    speichertGerade.current = true;
    setStatus('speichert');
    try {
      const antwort = await speicher.speicherePlan(p);
      revision.current = antwort.revision;
      if (aktuell.current === p) {
        offen.current = false;
        setStatus('gespeichert');
        schreibeLokal({ plan: p, offen: false, basisRevision: antwort.revision });
      }
    } catch {
      schreibeLokal({ plan: p, offen: true, basisRevision: revision.current });
      setStatus('offline');
    } finally {
      speichertGerade.current = false;
      // Während des Speicherns kam eine neue Änderung → gleich nochmal
      if (offen.current && aktuell.current !== p && navigator.onLine !== false) {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(speichern, DEBOUNCE_MS);
      }
    }
  }, [speicher]);

  const uebernimm = useCallback((p: Plan, warOffen: boolean) => {
    aktuell.current = p;
    offen.current = warOffen;
    setPlan(p);
  }, []);

  // Erstes Laden
  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      const lokal = leseLokal();
      try {
        const server = await speicher.holePlan();
        if (abgebrochen) return;
        setBereit(true);
        if (!server) {
          // Server hat noch keinen Plan → Startassistent
          setStatus('gespeichert');
          return;
        }
        revision.current = server.revision ?? 0;
        if (lokal?.offen) {
          if ((server.revision ?? 0) <= lokal.basisRevision) {
            // Unsere Offline-Änderungen sind neuer → hochladen
            uebernimm(lokal.plan, true);
            setHinweis('Offline gemachte Änderungen wurden zum Server übertragen.');
            void speichern();
            return;
          }
          try {
            localStorage.setItem(LS_KONFLIKT, JSON.stringify(lokal.plan));
          } catch {
            /* ignorieren */
          }
          setHinweis(
            'Auf dem Server gab es neuere Änderungen (z. B. vom anderen Gerät). Deine offline gemachten Änderungen wurden nicht übernommen, sind aber im Browser gesichert.',
          );
        }
        uebernimm(server, false);
        setStatus('gespeichert');
        schreibeLokal({ plan: server, offen: false, basisRevision: revision.current });
      } catch {
        if (abgebrochen) return;
        setBereit(true);
        if (lokal) uebernimm(lokal.plan, lokal.offen);
        setStatus('offline');
        setHinweis(
          lokal
            ? 'Server nicht erreichbar – es wird lokal im Browser gespeichert.'
            : 'Server nicht erreichbar. Bitte prüfen, ob die App auf dem PC läuft.',
        );
      }
    })();
    return () => {
      abgebrochen = true;
    };
  }, [speicher, speichern, uebernimm]);

  // Abgleich mit dem Server (Änderungen vom anderen Gerät übernehmen, Offline-Stand nachspeichern)
  useEffect(() => {
    const abgleich = async () => {
      if (document.visibilityState !== 'visible' || speichertGerade.current) return;
      if (offen.current && aktuell.current) {
        void speichern();
        return;
      }
      try {
        const server = await speicher.holePlan();
        if (offen.current || speichertGerade.current || !server) return;
        setStatus((s) => (s === 'offline' ? 'gespeichert' : s));
        if ((server.revision ?? 0) > revision.current || !aktuell.current) {
          revision.current = server.revision ?? 0;
          uebernimm(server, false);
          schreibeLokal({ plan: server, offen: false, basisRevision: revision.current });
        }
      } catch {
        setStatus('offline');
      }
    };
    const id = window.setInterval(abgleich, ABGLEICH_MS);
    const sichtbar = () => void abgleich();
    document.addEventListener('visibilitychange', sichtbar);
    window.addEventListener('focus', sichtbar);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', sichtbar);
      window.removeEventListener('focus', sichtbar);
    };
  }, [speicher, speichern, uebernimm]);

  // Beim Schließen noch offene Änderungen senden
  useEffect(() => {
    const raus = () => {
      if (!offen.current || !aktuell.current) return;
      window.clearTimeout(timer.current);
      speicher.speicherePlan(aktuell.current, true).catch(() => {
        /* localStorage hat den Stand */
      });
    };
    window.addEventListener('pagehide', raus);
    return () => window.removeEventListener('pagehide', raus);
  }, [speicher]);

  const setzePlan = useCallback(
    (neu: Plan, sofort = false) => {
      aktuell.current = neu;
      offen.current = true;
      setPlan(neu);
      setStatus('ungespeichert');
      schreibeLokal({ plan: neu, offen: true, basisRevision: revision.current });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(speichern, sofort ? 0 : DEBOUNCE_MS);
    },
    [speichern],
  );

  const aendere = useCallback(
    (fn: (p: Plan) => Plan) => {
      const vorher = aktuell.current;
      if (!vorher) return;
      const neu = fn(vorher);
      if (neu !== vorher) setzePlan(neu);
    },
    [setzePlan],
  );

  return useMemo<PlanZustand>(
    () => ({
      bereit,
      plan,
      plaene: plan ? [info(plan)] : [],
      mehrerePlaene: false,
      modus: 'server',
      aendere,
      status,
      hinweis,
      schliesseHinweis: () => setHinweis(null),
      letztesBackup,
      merkeBackup: () => {
        const jetzt = new Date().toISOString();
        setLetztesBackup(jetzt);
        try {
          localStorage.setItem(LS_BACKUP, jetzt);
        } catch {
          /* ignorieren */
        }
      },
      persist: 'unbekannt',
      fordereDauerhaftAn: async () => {},
      wechslePlan: () => {},
      legePlanAn: (neu) => setzePlan({ ...neu, revision: aktuell.current?.revision }, true),
      duplizierePlan: () => {},
      loeschePlan: () => {},
      importiere: (neu) => {
        if (neu[0]) setzePlan({ ...neu[0], id: aktuell.current?.id ?? neu[0].id, revision: aktuell.current?.revision }, true);
      },
      allePlaene: () => (aktuell.current ? [aktuell.current] : []),
      loescheAlles: async () => {
        try {
          localStorage.removeItem(LS_KEY);
          localStorage.removeItem(LS_KONFLIKT);
        } catch {
          /* ignorieren */
        }
      },
    }),
    [bereit, plan, aendere, status, hinweis, letztesBackup, setzePlan],
  );
}

/** Wählt zur Build-Zeit den passenden Speicher (VITE_STORAGE_MODE). */
export const usePlan: () => PlanZustand = SPEICHER_MODUS === 'server' ? useServerPlan : useBrowserPlan;
