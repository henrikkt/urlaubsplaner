import { useId, useMemo, useRef, useState } from 'react';
import { PlanFehler } from '../lib/schema';
import { leseImport } from '../speicher/arbeitsbereich';
import { findeBrueckentage, type Chance } from '../lib/brueckentage';
import { formatDatumKurz, formatZeitraum } from '../lib/datum';
import { bundeslandName, type Bundesland } from '../lib/feiertage';
import { formatZahl, tageText } from '../lib/format';
import { neuerBlock, neuerPlan, standardRegionaleFeiertage, type PersonEingabe } from '../lib/plan';
import { IMMER, STANDARD_FARBEN, type BesondererTag, type Plan } from '../lib/types';
import { EffizienzAbzeichen, utText } from './Brueckentage';
import { BundeslandWahl, jahresOptionen, PersonFelder, RegionaleFeiertageWahl } from './Formular';
import { FerienBadge, Hilfe } from './ui';

const SCHRITTE = ['Plan', 'Personen', 'Urlaub', 'Besondere Tage', 'Vorschläge'] as const;

function standardPerson(nr: 1 | 2): PersonEingabe {
  return {
    name: '',
    farbe: nr === 1 ? STANDARD_FARBEN.p1 : STANDARD_FARBEN.p2,
    anspruch: 30,
    resturlaub: 0,
    arbeitstage: [0, 1, 2, 3, 4],
    // gesetzlich normale Arbeitstage – im Zweifel lieber nicht zu knapp rechnen
    heiligabend: 1,
    silvester: 1,
  };
}

type BesondererEntwurf = Omit<BesondererTag, 'id'> & { key: number };

/** Gute Vorschläge vorauswählen: Brückentage außerhalb der Ferien, effizient, ohne Überschneidung */
function vorauswahl(chancen: Chance[]): Set<string> {
  const gewaehlt: Chance[] = [];
  for (const c of chancen) {
    if (c.inFerien || c.art !== 'Brückentag' || c.effizienz < 2.5) continue;
    if (gewaehlt.some((g) => c.von <= g.bis && c.bis >= g.von)) continue;
    gewaehlt.push(c);
  }
  return new Set(gewaehlt.map((c) => c.id));
}

function BackupEinspielen({ onImport }: { onImport: (plaene: Plan[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <article className="karte">
      <h2>Du hast schon ein Backup?</h2>
      <p className="unterzeile">Zum Beispiel vom alten Handy oder vom Computer. Dann kannst du es hier einspielen.</p>
      <button type="button" className="btn" onClick={() => ref.current?.click()}>
        Backup einspielen …
      </button>
      <input
        ref={ref}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        aria-label="Backup-Datei auswählen"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            onImport(leseImport(await f.text()));
          } catch (err) {
            setFehler(err instanceof PlanFehler ? err.message : 'Die Datei konnte nicht gelesen werden.');
          }
        }}
      />
      {fehler && (
        <p className="fehler" role="alert" style={{ whiteSpace: 'pre-line' }}>
          {fehler}
        </p>
      )}
    </article>
  );
}

export function Startassistent({
  onFertig,
  onAbbrechen,
  onImport,
  ersetztPlan,
}: {
  onFertig: (plan: Plan) => void;
  /** null = kein Abbrechen möglich (erster Start) */
  onAbbrechen: (() => void) | null;
  /** Backup einspielen statt neu anlegen (nur beim ersten Start) */
  onImport?: (plaene: Plan[]) => void;
  /** Server-Modus: der vorhandene Plan wird ersetzt */
  ersetztPlan: boolean;
}) {
  const id = useId();
  const jetzt = new Date().getFullYear();
  const [schritt, setSchritt] = useState(0);
  const [jahr, setJahr] = useState(jetzt + 1);
  const [name, setName] = useState('');
  const [land, setLand] = useState<Bundesland>('NW');
  const [regional, setRegional] = useState<string[]>(standardRegionaleFeiertage('NW'));
  const [anzahl, setAnzahl] = useState<1 | 2>(1);
  const [personen, setPersonen] = useState<[PersonEingabe, PersonEingabe]>([standardPerson(1), standardPerson(2)]);
  const [besondere, setBesondere] = useState<BesondererEntwurf[]>([]);
  const [auswahl, setAuswahl] = useState<Set<string> | null>(null);
  const [nurFerienfrei, setNurFerienfrei] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const planName = name.trim() || `Urlaub ${jahr}`;
  const aktivePersonen = personen.slice(0, anzahl);

  const vorschau = useMemo(
    () =>
      neuerPlan({
        name: planName,
        bundesland: land,
        planungsjahr: jahr,
        regionaleFeiertage: regional,
        personen: aktivePersonen.map((p, i) => ({ ...p, name: p.name.trim() || `Person ${i + 1}` })),
        besondereTage: besondere.filter((t) => t.datum).map(({ key: _k, ...t }) => t),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planName, land, jahr, regional, anzahl, personen, besondere],
  );
  const chancen = useMemo(() => (schritt === 4 ? findeBrueckentage(vorschau) : []), [schritt, vorschau]);
  const gewaehlt = auswahl ?? vorauswahl(chancen);
  const liste = nurFerienfrei ? chancen.filter((c) => !c.inFerien || gewaehlt.has(c.id)) : chancen;
  const utSumme = chancen.filter((c) => gewaehlt.has(c.id)).reduce((s, c) => s + c.utMax, 0);
  const budget = Math.min(...aktivePersonen.map((p) => p.anspruch + p.resturlaub));

  const setzePerson = (i: 0 | 1, patch: Partial<PersonEingabe>) =>
    setPersonen((alt) => {
      const neu: [PersonEingabe, PersonEingabe] = [...alt];
      neu[i] = { ...neu[i], ...patch };
      return neu;
    });

  const weiter = () => {
    setFehler(null);
    if (schritt === 1 && aktivePersonen.some((p) => !p.name.trim())) {
      setFehler(anzahl === 1 ? 'Bitte einen Namen eingeben.' : 'Bitte beide Namen eingeben.');
      return;
    }
    if (schritt === 2 && aktivePersonen.some((p) => p.anspruch <= 0)) {
      setFehler('Bitte die Urlaubstage pro Jahr eintragen.');
      return;
    }
    setSchritt((s) => Math.min(SCHRITTE.length - 1, s + 1));
    window.scrollTo(0, 0);
  };

  const fertig = () => {
    const bloecke = chancen
      .filter((c) => gewaehlt.has(c.id))
      .sort((a, b) => a.von.localeCompare(b.von))
      .map((c) =>
        neuerBlock(vorschau, {
          name: c.anlass,
          von: c.von,
          bis: c.bis,
          variante: IMMER,
          notiz: `Vorschlag: ${utText(c, vorschau)} → ${tageText(c.tageFrei)} frei`,
        }),
      );
    if (ersetztPlan && !window.confirm('Der bisherige Plan wird durch den neuen ersetzt. Fortfahren?')) return;
    onFertig({ ...vorschau, bloecke });
  };

  const umschalten = (cid: string) => {
    const neu = new Set(gewaehlt);
    if (neu.has(cid)) neu.delete(cid);
    else neu.add(cid);
    setAuswahl(neu);
  };

  return (
    <div className="assistent">
      <div className="assistent-kopf">
        <img className="assistent-logo" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={56} height={56} />
        <div>
          <h1>{onAbbrechen ? 'Neuer Plan' : 'Willkommen beim Urlaubsplaner'}</h1>
          <p className="unterzeile">
            Schritt {schritt + 1} von {SCHRITTE.length}: {SCHRITTE[schritt]}
          </p>
        </div>
      </div>
      <ol className="schritte" aria-hidden="true">
        {SCHRITTE.map((s, i) => (
          <li key={s} className={i <= schritt ? 'erledigt' : ''} />
        ))}
      </ol>

      {schritt === 0 && (
        <>
          {!onAbbrechen && (
            <Hilfe>
              In fünf kurzen Schritten richtest du deine Urlaubsplanung ein. Alles bleibt auf diesem Gerät – es gibt kein
              Konto und keinen Server. Du kannst später alles in den Einstellungen ändern.
            </Hilfe>
          )}
          <article className="karte">
            <h2>Was planst du?</h2>
            <div className="feld-reihe">
              <div className="feld">
                <label htmlFor={`${id}-jahr`}>Planungsjahr</label>
                <select id={`${id}-jahr`} value={jahr} onChange={(e) => setJahr(Number(e.target.value))}>
                  {jahresOptionen().map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
              </div>
              <div className="feld">
                <label htmlFor={`${id}-name`}>Name des Plans</label>
                <input
                  id={`${id}-name`}
                  type="text"
                  maxLength={80}
                  value={name}
                  placeholder={`Urlaub ${jahr}`}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
          </article>
          <article className="karte">
            <h2>Wo arbeitest du?</h2>
            <p className="unterzeile">Danach richten sich die Feiertage und Schulferien.</p>
            <BundeslandWahl
              wert={land}
              onChange={(l) => {
                setLand(l);
                setRegional(standardRegionaleFeiertage(l));
              }}
            />
            <RegionaleFeiertageWahl land={land} wert={regional} onChange={setRegional} />
          </article>
          {onImport && <BackupEinspielen onImport={onImport} />}
        </>
      )}

      {schritt === 1 && (
        <article className="karte">
          <h2>Wer plant?</h2>
          <div className="wahl-karten" role="radiogroup" aria-label="Anzahl Personen">
            {([1, 2] as const).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={anzahl === n}
                className="wahl-karte"
                onClick={() => setAnzahl(n)}
              >
                {n === 1 ? 'Nur ich' : 'Wir zu zweit'}
                <small>{n === 1 ? 'Ein Urlaubskonto' : 'Zwei Urlaubskonten, gemeinsamer Kalender'}</small>
              </button>
            ))}
          </div>
          {aktivePersonen.map((p, i) => (
            <div key={i} className="feld-reihe" style={{ marginTop: 16 }}>
              <div className="feld">
                <label htmlFor={`${id}-p${i}`}>{anzahl === 1 ? 'Dein Name' : `Name Person ${i + 1}`}</label>
                <input
                  id={`${id}-p${i}`}
                  type="text"
                  maxLength={60}
                  autoComplete="off"
                  value={p.name}
                  placeholder={i === 0 ? 'z. B. Papa' : 'z. B. Mama'}
                  onChange={(e) => setzePerson(i as 0 | 1, { name: e.target.value })}
                />
              </div>
              <div className="feld">
                <label htmlFor={`${id}-f${i}`}>Farbe im Kalender</label>
                <span className="farbe-feld">
                  <input
                    id={`${id}-f${i}`}
                    type="color"
                    value={p.farbe}
                    onChange={(e) => setzePerson(i as 0 | 1, { farbe: e.target.value })}
                  />
                </span>
              </div>
            </div>
          ))}
        </article>
      )}

      {schritt === 2 &&
        aktivePersonen.map((p, i) => (
          <article key={i} className={`karte person-karte person-p${i + 1}`}>
            <h2>{anzahl === 1 ? 'Dein Urlaub' : `Urlaub von ${p.name || `Person ${i + 1}`}`}</h2>
            <PersonFelder nummer={i + 1} wert={p} mitName={false} onChange={(patch) => setzePerson(i as 0 | 1, patch)} />
          </article>
        ))}

      {schritt === 3 && (
        <article className="karte">
          <h2>Besondere Tage (freiwillig)</h2>
          <p className="unterzeile">
            Geburtstage, Feste oder feste Termine. Sie erscheinen im Kalender, und die App schlägt passende Kurzurlaube vor.
          </p>
          <ul className="liste-editor" style={{ marginTop: 12 }}>
            {besondere.map((t) => (
              <li key={t.key} className="liste-zeile">
                <input
                  type="date"
                  aria-label="Datum"
                  value={t.datum}
                  onChange={(e) => setBesondere((l) => l.map((x) => (x.key === t.key ? { ...x, datum: e.target.value } : x)))}
                />
                <input
                  type="text"
                  aria-label="Anlass"
                  maxLength={200}
                  placeholder="z. B. Geburtstag"
                  value={t.name}
                  onChange={(e) => setBesondere((l) => l.map((x) => (x.key === t.key ? { ...x, name: e.target.value } : x)))}
                />
                <label className="schalter">
                  <input
                    type="checkbox"
                    checked={t.jaehrlich}
                    onChange={(e) => setBesondere((l) => l.map((x) => (x.key === t.key ? { ...x, jaehrlich: e.target.checked } : x)))}
                  />
                  jedes Jahr
                </label>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Entfernen"
                  onClick={() => setBesondere((l) => l.filter((x) => x.key !== t.key))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn"
            style={{ marginTop: 12 }}
            onClick={() =>
              setBesondere((l) => [...l, { key: Date.now(), datum: `${jahr}-01-01`, name: '', jaehrlich: true, symbol: '🎂' }])
            }
          >
            + Besonderen Tag hinzufügen
          </button>
        </article>
      )}

      {schritt === 4 && (
        <article className="karte">
          <h2>Vorschläge für {jahr}</h2>
          <Hilfe>
            Das sind die besten Gelegenheiten in {bundeslandName(land)}: Mit wenigen Urlaubstagen bekommst du viele freie
            Tage. Gute Vorschläge sind schon angehakt – ändere die Auswahl, wie du magst. Du kannst später alles anpassen.
          </Hilfe>
          <div className="status-zeile" style={{ marginBottom: 12 }}>
            <strong>
              {formatZahl(utSumme)} von {formatZahl(budget)} Urlaubstagen ausgewählt
            </strong>
            <label className="schalter">
              <input type="checkbox" checked={nurFerienfrei} onChange={(e) => setNurFerienfrei(e.target.checked)} />
              nur außerhalb der Schulferien
            </label>
          </div>
          {liste.length === 0 ? (
            <p className="leer">Keine Vorschläge gefunden.</p>
          ) : (
            <ul className="vorschlag-liste">
              {liste.map((c) => (
                <li key={c.id}>
                  <label className="vorschlag">
                    <input type="checkbox" checked={gewaehlt.has(c.id)} onChange={() => umschalten(c.id)} />
                    <span>
                      <strong>
                        {utText(c, vorschau)} → {tageText(c.tageFrei)} frei
                      </strong>{' '}
                      <EffizienzAbzeichen effizienz={c.effizienz} />
                      <br />
                      {c.anlass} · {formatZeitraum(c.von, c.bis)}
                      <br />
                      <small className="hilfe">Urlaub nehmen: {c.urlaubstage.map((d) => formatDatumKurz(d)).join(', ')}</small>{' '}
                      {c.inFerien && <FerienBadge ferien={c.ferien} />}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </article>
      )}

      {fehler && (
        <p className="hinweis hinweis-fehler" role="alert">
          {fehler}
        </p>
      )}

      <div className="assistent-fuss">
        <div className="aktionen">
          {schritt > 0 && (
            <button type="button" className="btn" onClick={() => setSchritt((s) => s - 1)}>
              ← Zurück
            </button>
          )}
          {onAbbrechen && (
            <button type="button" className="btn" onClick={onAbbrechen}>
              Abbrechen
            </button>
          )}
        </div>
        {schritt < SCHRITTE.length - 1 ? (
          <button type="button" className="btn btn-primaer" onClick={weiter}>
            {schritt === 3 && besondere.length === 0 ? 'Überspringen →' : 'Weiter →'}
          </button>
        ) : (
          <button type="button" className="btn btn-primaer" onClick={fertig}>
            {gewaehlt.size > 0 ? `Plan mit ${gewaehlt.size} ${gewaehlt.size === 1 ? 'Block' : 'Blöcken'} anlegen` : 'Plan anlegen'}
          </button>
        )}
      </div>
    </div>
  );
}
