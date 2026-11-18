import { useState } from 'react';
import type { PlanZustand } from '../hooks/usePlan';
import { formatDatum } from '../lib/datum';
import { FERIEN_QUELLE } from '../lib/schulferien';
import { exportiereBackup } from './ExportImport';
import { Dialog } from './ui';

const PERSIST_TEXT = {
  dauerhaft: '✓ Der Browser hat zugesagt, die Daten dauerhaft aufzubewahren.',
  'nicht-dauerhaft':
    'Der Browser hat noch nicht zugesagt, die Daten dauerhaft aufzubewahren. Bei Speichermangel könnte er sie löschen – deshalb ist ein Backup besonders wichtig. Als App installiert klappt die Zusage meist.',
  unbekannt: 'Dieser Browser sagt nicht, ob er die Daten dauerhaft aufbewahrt. Mach deshalb regelmäßig ein Backup.',
} as const;

export function Datenschutz({ zustand }: { zustand: PlanZustand }) {
  const [loeschDialog, setLoeschDialog] = useState(false);
  const [geloescht, setGeloescht] = useState(false);
  const browser = zustand.modus === 'browser';

  return (
    <section aria-labelledby="titel-datenschutz" className="text-seite">
      <div className="seitenkopf">
        <div>
          <h1 id="titel-datenschutz">Datenschutz &amp; Daten</h1>
          <p className="unterzeile">Was mit deinen Daten passiert – in einfachen Worten.</p>
        </div>
      </div>

      {geloescht && (
        <div className="hinweis hinweis-ok" role="status">
          Alle Daten auf diesem Gerät wurden gelöscht.
        </div>
      )}

      <article className="karte">
        <h2>Deine Daten bleiben bei dir</h2>
        {browser ? (
          <ul>
            <li>
              <strong>Alles bleibt auf diesem Gerät.</strong> Deine Planung wird nur hier im Browser gespeichert und nirgendwohin
              geschickt.
            </li>
            <li>
              <strong>Kein Konto, keine Anmeldung.</strong> Niemand außer dir kann deine Planung sehen.
            </li>
            <li>
              <strong>Kein Tracking, keine Werbung, keine Cookies.</strong> Es gibt keine Statistik-Dienste und keine eingebundenen
              fremden Inhalte.
            </li>
            <li>
              <strong>Kein Server.</strong> Feiertage und Schulferien sind in der App eingebaut. Nach dem ersten Laden funktioniert
              sie auch ohne Internet.
            </li>
          </ul>
        ) : (
          <ul>
            <li>
              <strong>Die Planung liegt auf dem PC</strong>, auf dem die App läuft (Datei <code>data/urlaubsplan.json</code>). Alle
              Geräte im WLAN sehen dieselben Daten.
            </li>
            <li>
              <strong>Kein Konto, kein Tracking, keine Werbung.</strong> Es werden keine Daten ins Internet geschickt.
            </li>
          </ul>
        )}
      </article>

      {browser && (
        <article className="karte">
          <h2>Wichtig: Backup machen</h2>
          <p>
            Wenn du im Browser die <strong>Browserdaten oder den Verlauf löschst</strong>, ist auch deine Urlaubsplanung weg. Das
            gilt auch, wenn du das Handy wechselst oder zurücksetzt. Speichere deshalb ab und zu ein Backup als Datei – die App
            erinnert dich nach 30 Tagen daran.
          </p>
          <p className="unterzeile">
            {zustand.letztesBackup ? `Letztes Backup: ${formatDatum(zustand.letztesBackup.slice(0, 10))}` : 'Noch kein Backup gemacht.'}
          </p>
          <div className="aktionen">
            <button type="button" className="btn btn-primaer" onClick={() => exportiereBackup(zustand)}>
              Backup jetzt speichern
            </button>
            <a className="btn" href="#/export">
              Backup einspielen …
            </a>
          </div>
          <h3 style={{ marginTop: 16 }}>Speicher-Status</h3>
          <p>{PERSIST_TEXT[zustand.persist]}</p>
          {zustand.persist === 'nicht-dauerhaft' && (
            <button type="button" className="btn btn-klein" onClick={() => void zustand.fordereDauerhaftAn()}>
              Dauerhaften Speicher erneut anfragen
            </button>
          )}
        </article>
      )}

      <article className="karte">
        <h2>Quellen</h2>
        <p>
          Feiertage werden in der App selbst berechnet. Die Schulferien stammen von der {FERIEN_QUELLE.quelle} (Stand{' '}
          {formatDatum(FERIEN_QUELLE.abgerufenAm)}), Lizenz {FERIEN_QUELLE.lizenz}. Angaben ohne Gewähr – bitte wichtige Termine
          beim Kultusministerium deines Landes prüfen.
        </p>
      </article>

      {browser && (
        <article className="karte karte-gefahr">
          <h2>Alle Daten auf diesem Gerät löschen</h2>
          <p>Löscht alle Pläne und Einstellungen dieser App in diesem Browser. Andere Geräte sind nicht betroffen.</p>
          <button type="button" className="btn btn-gefahr" onClick={() => setLoeschDialog(true)}>
            Alle Daten auf diesem Gerät löschen
          </button>
        </article>
      )}

      <Dialog offen={loeschDialog} titel="Wirklich alles löschen?" onSchliessen={() => setLoeschDialog(false)}>
        <p>
          Dabei werden <strong>{zustand.plaene.length === 1 ? 'dein Plan' : `alle ${zustand.plaene.length} Pläne`}</strong>{' '}
          unwiderruflich von diesem Gerät gelöscht. Das kann nicht rückgängig gemacht werden.
        </p>
        <p>Tipp: Speichere vorher ein Backup, dann kannst du die Daten später wieder einspielen.</p>
        <div className="dialog-fuss">
          <button type="button" className="btn" onClick={() => exportiereBackup(zustand)}>
            Erst Backup speichern
          </button>
          <button type="button" className="btn" onClick={() => setLoeschDialog(false)}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn btn-gefahr"
            onClick={async () => {
              await zustand.loescheAlles();
              setLoeschDialog(false);
              setGeloescht(true);
            }}
          >
            Ja, alles löschen
          </button>
        </div>
      </Dialog>
    </section>
  );
}
