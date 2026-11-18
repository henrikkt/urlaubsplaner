import { useRef, useState } from 'react';
import type { PlanZustand } from '../hooks/usePlan';
import { formatDatum, heuteISO } from '../lib/datum';
import { aktiveBloecke, erzeugeCsv, erzeugeIcs } from '../lib/export';
import { aktiveVarianteVon } from '../lib/plan';
import { PlanFehler } from '../lib/schema';
import type { Plan } from '../lib/types';
import { erzeugeBackup, leseImport } from '../speicher/arbeitsbereich';
import { geheZu } from '../hooks/useRoute';
import { dateiName, Dialog, Hilfe, ladeHerunter } from './ui';

export function exportiereBackup(zustand: PlanZustand, nurAktuell = false) {
  const plaene = nurAktuell && zustand.plan ? [zustand.plan] : zustand.allePlaene();
  const name = nurAktuell && zustand.plan ? dateiName(zustand.plan.name) : 'urlaubsplaner-backup';
  ladeHerunter(`${name}-${heuteISO()}.json`, JSON.stringify(erzeugeBackup(plaene), null, 2), 'application/json');
  if (!nurAktuell || zustand.plaene.length <= 1) zustand.merkeBackup();
}

export function ExportImport({ zustand }: { zustand: PlanZustand }) {
  const plan = zustand.plan!;
  const dateiRef = useRef<HTMLInputElement>(null);
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);
  const [import_, setImport] = useState<{ datei: string; plaene: Plan[] } | null>(null);
  const anzahlAktiv = aktiveBloecke(plan).length;
  const v = aktiveVarianteVon(plan);
  const mehrere = zustand.mehrerePlaene;

  const lesen = async (datei: File) => {
    setMeldung(null);
    try {
      const plaene = leseImport(await datei.text());
      setImport({ datei: datei.name, plaene });
    } catch (e) {
      setMeldung({
        art: 'fehler',
        text: e instanceof PlanFehler ? e.message : 'Die Datei konnte nicht gelesen werden.',
      });
    } finally {
      if (dateiRef.current) dateiRef.current.value = '';
    }
  };

  const uebernehmen = (art: 'hinzufuegen' | 'ersetzen') => {
    if (!import_) return;
    zustand.importiere(import_.plaene, art);
    const n = import_.plaene.length;
    setMeldung({
      art: 'ok',
      text:
        art === 'ersetzen'
          ? `Import erfolgreich: ${n === 1 ? '1 Plan' : `${n} Pläne`} übernommen.`
          : `Import erfolgreich: ${n === 1 ? '1 Plan' : `${n} Pläne`} hinzugefügt.`,
    });
    setImport(null);
  };

  return (
    <section aria-labelledby="titel-export">
      <div className="seitenkopf">
        <div>
          <h1 id="titel-export">Export / Import</h1>
          <p className="unterzeile">Backups, Kalenderdateien und Druckansicht.</p>
        </div>
      </div>

      {meldung && (
        <div className={`hinweis ${meldung.art === 'ok' ? 'hinweis-ok' : 'hinweis-fehler'}`} role={meldung.art === 'ok' ? 'status' : 'alert'}>
          <span style={{ whiteSpace: 'pre-line' }}>{meldung.text}</span>
        </div>
      )}

      <div className="raster-2">
        <article className="karte">
          <h2>Backup (Sicherung)</h2>
          <p>
            Speichert {mehrere ? 'alle deine Pläne' : 'den Plan'} als Datei. Bewahre sie gut auf, z. B. in deinen Dokumenten oder
            in einer Mail an dich selbst.
          </p>
          {zustand.letztesBackup && <p className="unterzeile">Letztes Backup: {formatDatum(zustand.letztesBackup.slice(0, 10))}</p>}
          <div className="aktionen">
            <button type="button" className="btn btn-primaer" onClick={() => exportiereBackup(zustand)}>
              Backup speichern
            </button>
            <button type="button" className="btn" onClick={() => dateiRef.current?.click()}>
              Backup einspielen …
            </button>
            <input
              ref={dateiRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-label="Backup-Datei auswählen"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void lesen(f);
              }}
            />
          </div>
        </article>

        {mehrere && zustand.plaene.length > 1 && (
          <article className="karte">
            <h2>Nur diesen Plan teilen</h2>
            <p>Speichert nur „{plan.name}“ als Datei – z. B. um ihn jemandem zu schicken. Die andere Person spielt die Datei bei sich ein.</p>
            <button type="button" className="btn" onClick={() => exportiereBackup(zustand, true)}>
              Plan als Datei speichern
            </button>
          </article>
        )}

        <article className="karte">
          <h2>Kalender (.ics)</h2>
          <p>
            {anzahlAktiv} {anzahlAktiv === 1 ? 'Urlaubsblock' : 'Urlaubsblöcke'}
            {plan.varianten.length > 1 ? ` der Variante ${v.name}` : ''} als ganztägige Termine – für Outlook, Google Kalender
            oder das Handy.
          </p>
          <button
            type="button"
            className="btn btn-primaer"
            disabled={anzahlAktiv === 0}
            onClick={() =>
              ladeHerunter(
                `${dateiName(plan.name)}${plan.varianten.length > 1 ? `-variante-${dateiName(v.name)}` : ''}.ics`,
                erzeugeIcs(plan),
                'text/calendar;charset=utf-8',
              )
            }
          >
            .ics speichern
          </button>
        </article>

        <article className="karte">
          <h2>Excel (CSV)</h2>
          <p>Alle Blöcke mit berechneten Spalten. Öffnet sich direkt in Excel.</p>
          <button
            type="button"
            className="btn"
            onClick={() => ladeHerunter(`${dateiName(plan.name)}.csv`, erzeugeCsv(plan), 'text/csv;charset=utf-8')}
          >
            CSV speichern
          </button>
        </article>

        <article className="karte">
          <h2>Drucken</h2>
          <p>Jahreskalender auf einer A4-Seite im Querformat (auch als PDF speicherbar).</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              geheZu('kalender');
              window.setTimeout(() => window.print(), 400);
            }}
          >
            Kalender drucken
          </button>
        </article>
      </div>

      <Hilfe>
        Eine Backup-Datei enthält deine Urlaubsplanung im Klartext. Teile sie nur mit Menschen, die sie sehen dürfen.
      </Hilfe>

      <Dialog offen={Boolean(import_)} titel="Backup einspielen" onSchliessen={() => setImport(null)}>
        {import_ && (
          <>
            <p>
              Die Datei „{import_.datei}“ enthält {import_.plaene.length === 1 ? 'einen Plan' : `${import_.plaene.length} Pläne`}:
            </p>
            <ul>
              {import_.plaene.map((p) => (
                <li key={p.id}>
                  <strong>{p.name}</strong> – {p.bloecke.length} Blöcke, {p.personen.map((x) => x.name).join(' & ')}
                </li>
              ))}
            </ul>
            {mehrere ? (
              <p>Sollen die Pläne zu deinen vorhandenen Plänen dazukommen, oder sollen sie alles auf diesem Gerät ersetzen?</p>
            ) : (
              <p>Der aktuelle Plan wird dabei ersetzt.</p>
            )}
            <div className="dialog-fuss">
              <button type="button" className="btn" onClick={() => setImport(null)}>
                Abbrechen
              </button>
              {mehrere && (
                <button type="button" className="btn btn-primaer" onClick={() => uebernehmen('hinzufuegen')}>
                  Hinzufügen
                </button>
              )}
              <button
                type="button"
                className="btn btn-gefahr"
                onClick={() => {
                  const frage = mehrere
                    ? `Wirklich ALLE ${zustand.plaene.length} Pläne auf diesem Gerät ersetzen? Das kann nicht rückgängig gemacht werden.`
                    : 'Den aktuellen Plan wirklich ersetzen? Das kann nicht rückgängig gemacht werden.';
                  if (window.confirm(frage)) uebernehmen('ersetzen');
                }}
              >
                {mehrere ? 'Alles ersetzen' : 'Plan ersetzen'}
              </button>
            </div>
          </>
        )}
      </Dialog>
    </section>
  );
}
