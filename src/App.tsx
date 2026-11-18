import { useCallback, useEffect, useState } from 'react';
import { Bloecke } from './components/Bloecke';
import { Brueckentage } from './components/Brueckentage';
import { Datenschutz } from './components/Datenschutz';
import { BlockBearbeitenDialog, NeuerBlockDialog, type NeuVorlage } from './components/Dialoge';
import { Einstellungen } from './components/Einstellungen';
import { exportiereBackup, ExportImport } from './components/ExportImport';
import { HilfeSeite, MehrSeite } from './components/Hilfe';
import { Kalender } from './components/Kalender';
import { Startassistent } from './components/Startassistent';
import { Uebersicht, VariantenUmschalter } from './components/Uebersicht';
import { farbVariablen, Icon, type IconName } from './components/ui';
import { UpdateHinweis } from './components/UpdateHinweis';
import { usePlan, type SpeicherStatus } from './hooks/usePlan';
import { geheZu, useRoute, type Route } from './hooks/useRoute';
import { addiereTage, heuteISO } from './lib/datum';
import { alleNamen, fuegeBlockHinzu, zeigeVarianten } from './lib/plan';
import { backupFaellig } from './speicher/arbeitsbereich';

const NAVIGATION: { route: Route; text: string; kurz: string; icon: IconName; nur?: 'desktop' | 'handy' }[] = [
  { route: 'uebersicht', text: 'Übersicht', kurz: 'Übersicht', icon: 'uebersicht' },
  { route: 'kalender', text: 'Kalender', kurz: 'Kalender', icon: 'kalender' },
  { route: 'bloecke', text: 'Urlaubsblöcke', kurz: 'Blöcke', icon: 'bloecke' },
  { route: 'brueckentage', text: 'Brückentage', kurz: 'Brücken', icon: 'brueckentage' },
  { route: 'einstellungen', text: 'Einstellungen', kurz: 'Einstell.', icon: 'einstellungen', nur: 'desktop' },
  { route: 'export', text: 'Export / Import', kurz: 'Export', icon: 'export', nur: 'desktop' },
  { route: 'datenschutz', text: 'Datenschutz & Daten', kurz: 'Daten', icon: 'datenschutz', nur: 'desktop' },
  { route: 'hilfe', text: 'Als App installieren', kurz: 'Hilfe', icon: 'hilfe', nur: 'desktop' },
  { route: 'mehr', text: 'Mehr', kurz: 'Mehr', icon: 'mehr', nur: 'handy' },
];

const MEHR_ROUTEN: Route[] = ['einstellungen', 'export', 'datenschutz', 'hilfe', 'mehr'];

const STATUS_TEXT: Record<SpeicherStatus, string> = {
  laden: 'Lädt …',
  gespeichert: 'Gespeichert ✓',
  ungespeichert: 'Änderungen …',
  speichert: 'Speichert …',
  offline: 'Offline – lokal gespeichert',
  fehler: 'Nicht gespeichert!',
};

function BackupBanner({ onBackup }: { onBackup: () => void }) {
  const [weg, setWeg] = useState(false);
  if (weg) return null;
  return (
    <div className="hinweis hinweis-warn banner nicht-drucken" role="status" style={{ display: 'flex' }}>
      <span>
        <strong>Zeit für ein Backup:</strong> Deine Planung liegt nur in diesem Browser. Speichere sie als Datei, damit nichts
        verloren geht.
      </span>
      <span className="aktionen">
        <button type="button" className="btn btn-primaer btn-klein" onClick={onBackup}>
          Backup speichern
        </button>
        <button type="button" className="btn btn-klein" onClick={() => setWeg(true)}>
          Später
        </button>
      </span>
    </div>
  );
}

export function App() {
  const zustand = usePlan();
  const { plan, aendere, status, hinweis, schliesseHinweis } = zustand;
  const route = useRoute();
  const [neuVorlage, setNeuVorlage] = useState<NeuVorlage | null>(null);
  const [bearbeiteIds, setBearbeiteIds] = useState<string[] | null>(null);
  const [erfolg, setErfolg] = useState<{ text: string; nr: number } | null>(null);

  // Erfolgsmeldung nach ein paar Sekunden wieder ausblenden
  useEffect(() => {
    if (!erfolg) return;
    const t = window.setTimeout(() => setErfolg(null), 3500);
    return () => window.clearTimeout(t);
  }, [erfolg]);

  const setVariante = useCallback(
    (v: string) => aendere((p) => (p.aktiveVariante === v ? p : { ...p, aktiveVariante: v })),
    [aendere],
  );
  const oeffneNeu = useCallback((v: NeuVorlage) => setNeuVorlage(v), []);
  const oeffneBlock = useCallback((ids: string[]) => setBearbeiteIds(ids), []);

  useEffect(() => {
    document.title = plan ? `${plan.name} – Urlaubsplaner` : 'Urlaubsplaner';
  }, [plan?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!zustand.bereit) {
    return (
      <div className="laden" role="status">
        Planung wird geladen …
      </div>
    );
  }

  if (!plan || route === 'neu') {
    return (
      <div style={farbVariablen(plan)}>
        <UpdateHinweis />
        {hinweis && (
          <div className="hinweis hinweis-info banner" role="status">
            <span>{hinweis}</span>
            <button type="button" className="icon-btn" onClick={schliesseHinweis} aria-label="Hinweis schließen">
              ✕
            </button>
          </div>
        )}
        <Startassistent
          ersetztPlan={Boolean(plan) && !zustand.mehrerePlaene}
          onAbbrechen={plan ? () => geheZu('uebersicht') : null}
          onImport={
            plan
              ? undefined
              : (plaene) => {
                  zustand.importiere(plaene, 'ersetzen');
                  geheZu('uebersicht');
                }
          }
          onFertig={(neu) => {
            zustand.legePlanAn(neu);
            geheZu('uebersicht');
          }}
        />
      </div>
    );
  }

  const standardNeu = (): NeuVorlage => {
    const start = heuteISO() < `${plan.planungsjahr}-01-01` ? `${plan.planungsjahr}-01-01` : heuteISO();
    return { von: start, bis: addiereTage(start, 6) };
  };

  const zeigeBackupBanner = zustand.modus === 'browser' && backupFaellig(zustand.letztesBackup) && route !== 'export';
  const aktivRoute = (r: Route) => route === r || (r === 'mehr' && MEHR_ROUTEN.includes(route));

  return (
    <div className="app" style={farbVariablen(plan)}>
      <a href="#hauptinhalt" className="skip-link">
        Zum Inhalt springen
      </a>
      <aside className="seitenleiste nicht-drucken">
        <div className="logo">
          <span className="logo-zeichen" aria-hidden="true">
            ☀
          </span>
          <span>
            Urlaubsplaner
            <strong>{plan.planungsjahr}</strong>
          </span>
        </div>
        <nav aria-label="Hauptnavigation">
          <ul>
            {NAVIGATION.map((n) => (
              <li key={n.route} className={n.nur === 'desktop' ? 'nav-nur-desktop' : n.nur === 'handy' ? 'nav-nur-handy' : ''}>
                <a
                  href={`#/${n.route}`}
                  className={aktivRoute(n.route) ? 'aktiv' : ''}
                  aria-current={route === n.route ? 'page' : undefined}
                >
                  <Icon name={n.icon} />
                  <span className="nav-lang">{n.text}</span>
                  <span className="nav-kurz">{n.kurz}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="seitenleiste-fuss">{alleNamen(plan)}</p>
      </aside>

      <div className="hauptbereich">
        <header className="kopfleiste nicht-drucken">
          {zustand.mehrerePlaene && zustand.plaene.length > 1 ? (
            <span className="plan-wahl">
              <label htmlFor="plan-wahl" className="sr-only">
                Plan wählen
              </label>
              <select id="plan-wahl" value={plan.id} onChange={(e) => zustand.wechslePlan(e.target.value)}>
                {zustand.plaene.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </span>
          ) : (
            <span className="plan-titel">{plan.name}</span>
          )}
          {zeigeVarianten(plan) && (
            <div className="kopf-variante">
              <span className="kopf-label">Variante</span>
              <VariantenUmschalter plan={plan} onWahl={setVariante} />
            </div>
          )}
          <span className={`speicher-status status-${status}`} role="status" aria-live="polite">
            {STATUS_TEXT[status]}
          </span>
        </header>

        <UpdateHinweis />

        {hinweis && (
          <div className="hinweis hinweis-info app-hinweis nicht-drucken" role="status">
            <span>{hinweis}</span>
            <button type="button" className="icon-btn" onClick={schliesseHinweis} aria-label="Hinweis schließen">
              ✕
            </button>
          </div>
        )}

        {zeigeBackupBanner && <BackupBanner onBackup={() => exportiereBackup(zustand)} />}

        <main id="hauptinhalt" tabIndex={-1}>
          {route === 'uebersicht' && <Uebersicht plan={plan} onVariante={setVariante} />}
          {route === 'bloecke' && <Bloecke plan={plan} aendere={aendere} onNeu={() => oeffneNeu(standardNeu())} />}
          {route === 'kalender' && <Kalender plan={plan} onBlockOeffnen={oeffneBlock} onNeu={oeffneNeu} />}
          {route === 'brueckentage' && <Brueckentage plan={plan} onUebernehmen={oeffneNeu} />}
          {route === 'einstellungen' && <Einstellungen zustand={zustand} />}
          {route === 'export' && <ExportImport zustand={zustand} />}
          {route === 'datenschutz' && <Datenschutz zustand={zustand} />}
          {route === 'hilfe' && <HilfeSeite />}
          {route === 'mehr' && <MehrSeite zustand={zustand} />}
        </main>
      </div>

      <NeuerBlockDialog
        vorlage={neuVorlage}
        plan={plan}
        onSchliessen={() => setNeuVorlage(null)}
        onAnlegen={(b) => {
          aendere((p) => fuegeBlockHinzu(p, b));
          setNeuVorlage(null);
          setErfolg({ text: `Eingetragen: ${b.name || 'Urlaub'}`, nr: Date.now() });
        }}
      />
      <BlockBearbeitenDialog ids={bearbeiteIds} plan={plan} aendere={aendere} onSchliessen={() => setBearbeiteIds(null)} />

      {/* Live-Bereich bleibt immer im DOM, damit Screenreader neue Meldungen zuverlässig vorlesen */}
      <div className="toast-bereich nicht-drucken" role="status" aria-live="polite">
        {erfolg && (
          <p key={erfolg.nr} className="toast">
            <span className="toast-haken" aria-hidden="true">
              ✓
            </span>
            {erfolg.text} – die Vorfreude beginnt!
          </p>
        )}
      </div>
    </div>
  );
}
