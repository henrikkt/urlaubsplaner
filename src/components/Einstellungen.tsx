import { useEffect, useId, useState } from 'react';
import type { PlanZustand } from '../hooks/usePlan';
import { formatDatumLang, istGueltigesDatum } from '../lib/datum';
import { bundeslandName, feiertageFuer, type Bundesland } from '../lib/feiertage';
import {
  aktualisierePerson,
  aktualisiereVariante,
  bloeckeNurFuer,
  entfernePerson,
  entferneVariante,
  fuegePersonHinzu,
  fuegeVarianteHinzu,
  istPaar,
  neueId,
  setzeOrtUndJahr,
  setzeRegionaleFeiertage,
} from '../lib/plan';
import { FERIEN_QUELLE, hatFerienDaten, schulferienFuer } from '../lib/schulferien';
import type { Plan } from '../lib/types';
import { BundeslandWahl, jahresOptionen, PersonFelder, RegionaleFeiertageWahl } from './Formular';
import { Hilfe, PersonPunkt } from './ui';

const SYMBOLE = ['🎂', '⭐', '❤️', '✈️', '🎉', '📌', '💍', '🎓'];

type Aendere = (fn: (p: Plan) => Plan) => void;

function PlaeneKarte({ zustand }: { zustand: PlanZustand }) {
  const { plaene, plan } = zustand;
  if (!zustand.mehrerePlaene) {
    return (
      <article className="karte" aria-labelledby="einst-plaene">
        <h2 id="einst-plaene">Plan neu einrichten</h2>
        <p>Der Startassistent richtet den Plan von vorn ein. Der bisherige Plan wird dabei ersetzt – vorher ein Backup machen.</p>
        <a className="btn" href="#/neu">
          Startassistent öffnen
        </a>
      </article>
    );
  }
  return (
    <article className="karte" aria-labelledby="einst-plaene">
      <div className="karten-kopf">
        <h2 id="einst-plaene">Meine Pläne</h2>
        <a className="btn btn-primaer btn-klein" href="#/neu">
          + Neuer Plan
        </a>
      </div>
      <Hilfe>Du kannst mehrere Pläne anlegen, z. B. einen pro Jahr oder einen zweiten zum Ausprobieren.</Hilfe>
      <ul className="liste-editor">
        {plaene.map((p) => (
          <li key={p.id} className="liste-zeile">
            <strong style={{ flex: '1 1 200px' }}>
              {p.name} {p.id === plan?.id && <span className="badge badge-aktiv">geöffnet</span>}
            </strong>
            {p.id !== plan?.id && (
              <button type="button" className="btn btn-klein" onClick={() => zustand.wechslePlan(p.id)}>
                Öffnen
              </button>
            )}
            <button type="button" className="btn btn-klein" onClick={() => zustand.duplizierePlan(p.id)}>
              Duplizieren
            </button>
            <button
              type="button"
              className="btn btn-klein btn-gefahr"
              onClick={() => {
                if (
                  window.confirm(
                    `Plan „${p.name}“ wirklich löschen?\n\nAlle Urlaubsblöcke dieses Plans gehen verloren. Das kann nicht rückgängig gemacht werden.`,
                  )
                )
                  zustand.loeschePlan(p.id);
              }}
            >
              Löschen
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

function OrtUndJahr({ plan, aendere }: { plan: Plan; aendere: Aendere }) {
  const id = useId();
  const [land, setLand] = useState<Bundesland>(plan.bundesland as Bundesland);
  const [jahr, setJahr] = useState(plan.planungsjahr);
  useEffect(() => {
    setLand(plan.bundesland as Bundesland);
    setJahr(plan.planungsjahr);
  }, [plan.bundesland, plan.planungsjahr]);
  const geaendert = land !== plan.bundesland || jahr !== plan.planungsjahr;

  const uebernehmen = () => {
    if (
      !window.confirm(
        `Auf ${bundeslandName(land)} ${jahr} umstellen?\n\nFeiertage und Schulferien werden neu geladen. Eigene Änderungen an diesen Listen gehen dabei verloren. Deine Urlaubsblöcke bleiben erhalten.`,
      )
    )
      return;
    aendere((p) => setzeOrtUndJahr(p, land, jahr));
  };

  return (
    <article className="karte" aria-labelledby="einst-ort">
      <h2 id="einst-ort">Plan, Bundesland und Jahr</h2>
      <div className="feld-reihe">
        <div className="feld">
          <label htmlFor={`${id}-name`}>Name des Plans</label>
          <input
            id={`${id}-name`}
            type="text"
            maxLength={80}
            value={plan.name}
            onChange={(e) => aendere((p) => ({ ...p, name: e.target.value }))}
            onBlur={(e) => !e.target.value.trim() && aendere((p) => ({ ...p, name: `Urlaub ${p.planungsjahr}` }))}
          />
        </div>
        <BundeslandWahl wert={land} onChange={setLand} />
        <div className="feld">
          <label htmlFor={`${id}-jahr`}>Planungsjahr</label>
          <select id={`${id}-jahr`} value={jahr} onChange={(e) => setJahr(Number(e.target.value))}>
            {jahresOptionen(plan.planungsjahr).map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </div>
      </div>
      {geaendert && (
        <div className="aktionen" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-primaer" onClick={uebernehmen}>
            Umstellen auf {bundeslandName(land)} {jahr}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setLand(plan.bundesland as Bundesland);
              setJahr(plan.planungsjahr);
            }}
          >
            Abbrechen
          </button>
        </div>
      )}
      <RegionaleFeiertageWahl
        land={plan.bundesland as Bundesland}
        wert={plan.regionaleFeiertage}
        onChange={(ids) => aendere((p) => setzeRegionaleFeiertage(p, ids))}
      />
    </article>
  );
}

function Personen({ plan, aendere }: { plan: Plan; aendere: Aendere }) {
  const [neuName, setNeuName] = useState('');
  const paar = istPaar(plan);
  return (
    <>
      <div className="raster-2">
        {plan.personen.map((p) => (
          <article key={p.id} className={`karte person-karte person-${p.id}`} aria-labelledby={`einst-${p.id}`}>
            <div className="karten-kopf">
              <h2 id={`einst-${p.id}`}>
                <PersonPunkt person={p.id} /> {p.name}
              </h2>
              {paar && (
                <button
                  type="button"
                  className="btn btn-klein btn-gefahr"
                  onClick={() => {
                    const n = bloeckeNurFuer(plan, p.id);
                    if (
                      window.confirm(
                        `${p.name} aus dem Plan entfernen?${n ? `\n\n${n} Block/Blöcke nur für ${p.name} werden dabei gelöscht.` : ''}`,
                      )
                    )
                      aendere((x) => entfernePerson(x, p.id));
                  }}
                >
                  Entfernen
                </button>
              )}
            </div>
            <PersonFelder
              nummer={p.id === 'p1' ? 1 : 2}
              wert={p}
              onChange={(patch) => aendere((x) => aktualisierePerson(x, p.id, patch))}
            />
          </article>
        ))}
      </div>
      {!paar ? (
        <article className="karte">
          <h2>Zweite Person</h2>
          <p className="unterzeile">Plant ihr zu zweit? Dann hier den Namen eintragen.</p>
          <div className="feld-zeile">
            <div className="feld" style={{ flex: '1 1 200px' }}>
              <label htmlFor="neue-person">Name</label>
              <input id="neue-person" type="text" maxLength={60} value={neuName} onChange={(e) => setNeuName(e.target.value)} />
            </div>
            <button
              type="button"
              className="btn btn-primaer"
              disabled={!neuName.trim()}
              onClick={() => {
                aendere((x) => fuegePersonHinzu(x, neuName));
                setNeuName('');
              }}
            >
              Hinzufügen
            </button>
          </div>
        </article>
      ) : (
        <article className="karte">
          <h2>
            <PersonPunkt person="alle" /> Farbe für gemeinsamen Urlaub
          </h2>
          <span className="farbe-feld">
            <input
              type="color"
              aria-label="Farbe für gemeinsamen Urlaub"
              value={plan.farbeGemeinsam}
              onChange={(e) => aendere((x) => ({ ...x, farbeGemeinsam: e.target.value }))}
            />
          </span>
        </article>
      )}
    </>
  );
}

function Varianten({ plan, aendere }: { plan: Plan; aendere: Aendere }) {
  return (
    <article className="karte" aria-labelledby="einst-varianten">
      <div className="karten-kopf">
        <h2 id="einst-varianten">Varianten</h2>
        <button
          type="button"
          className="btn btn-klein"
          disabled={plan.varianten.length >= 12}
          onClick={() => aendere((p) => fuegeVarianteHinzu(p, ''))}
        >
          + Variante
        </button>
      </div>
      <Hilfe>
        Mit Varianten vergleichst du verschiedene Ideen, z. B. „Sommer lang“ gegen „viele Kurztrips“. Blöcke mit „Immer“
        zählen in jeder Variante. Eine Variante mit „startet leer“ ist eine eigene Planung ohne die „Immer“-Blöcke.
      </Hilfe>
      <ul className="liste-editor">
        {plan.varianten.map((v) => (
          <li key={v.id} className="liste-zeile">
            <input
              type="text"
              aria-label="Name der Variante"
              maxLength={40}
              value={v.name}
              style={{ flex: '0 1 140px' }}
              onChange={(e) => aendere((p) => aktualisiereVariante(p, v.id, { name: e.target.value }))}
              onBlur={(e) => !e.target.value.trim() && aendere((p) => aktualisiereVariante(p, v.id, { name: v.id }))}
            />
            <input
              type="text"
              aria-label={`Beschreibung Variante ${v.name}`}
              placeholder="Beschreibung (optional)"
              maxLength={200}
              value={v.beschreibung}
              onChange={(e) => aendere((p) => aktualisiereVariante(p, v.id, { beschreibung: e.target.value }))}
            />
            <label className="schalter">
              <input
                type="checkbox"
                checked={v.startetLeer}
                onChange={(e) => aendere((p) => aktualisiereVariante(p, v.id, { startetLeer: e.target.checked }))}
              />
              startet leer
            </label>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Variante ${v.name} löschen`}
              disabled={plan.varianten.length <= 1}
              onClick={() => {
                const n = plan.bloecke.filter((b) => b.variante === v.id).length;
                if (window.confirm(`Variante „${v.name}“ löschen?${n ? `\n\n${n} Block/Blöcke werden auf „Aus“ gesetzt (bleiben als Idee erhalten).` : ''}`))
                  aendere((p) => entferneVariante(p, v.id));
              }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

function Feiertage({ plan, aendere }: { plan: Plan; aendere: Aendere }) {
  return (
    <article className="karte" aria-labelledby="einst-feiertage">
      <div className="karten-kopf">
        <h2 id="einst-feiertage">Feiertage {bundeslandName(plan.bundesland as Bundesland)}</h2>
        <div className="aktionen">
          <button
            type="button"
            className="btn btn-klein"
            onClick={() => {
              if (window.confirm(`Feiertage für ${plan.planungsjahr} neu berechnen? Eigene Änderungen gehen verloren.`))
                aendere((p) => ({ ...p, feiertage: feiertageFuer(p.bundesland as Bundesland, p.planungsjahr, p.regionaleFeiertage) }));
            }}
          >
            Neu berechnen
          </button>
          <button
            type="button"
            className="btn btn-klein"
            onClick={() => aendere((p) => ({ ...p, feiertage: [...p.feiertage, { datum: `${p.planungsjahr}-01-01`, name: '' }] }))}
          >
            + Feiertag
          </button>
        </div>
      </div>
      <p className="unterzeile">Werden automatisch berechnet. Du kannst sie hier ändern oder ergänzen.</p>
      <ul className="liste-editor">
        {plan.feiertage.map((f, i) => (
          <li key={i} className="liste-zeile">
            <input
              type="date"
              aria-label={`Datum Feiertag ${i + 1}`}
              value={f.datum}
              onChange={(e) =>
                aendere((p) => ({ ...p, feiertage: p.feiertage.map((x, j) => (j === i ? { ...x, datum: e.target.value } : x)) }))
              }
            />
            <span className="wochentag-hilfe">{istGueltigesDatum(f.datum) ? formatDatumLang(f.datum).slice(0, 2) : ''}</span>
            <input
              type="text"
              aria-label={`Name Feiertag ${i + 1}`}
              value={f.name}
              maxLength={200}
              placeholder="Name"
              onChange={(e) =>
                aendere((p) => ({ ...p, feiertage: p.feiertage.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) }))
              }
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={`Feiertag ${f.name} entfernen`}
              onClick={() => aendere((p) => ({ ...p, feiertage: p.feiertage.filter((_, j) => j !== i) }))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

function Schulferien({ plan, aendere }: { plan: Plan; aendere: Aendere }) {
  const land = plan.bundesland as Bundesland;
  const vorhanden = hatFerienDaten(land, plan.planungsjahr);
  return (
    <article className="karte" aria-labelledby="einst-ferien">
      <div className="karten-kopf">
        <h2 id="einst-ferien">Schulferien {bundeslandName(land)}</h2>
        <div className="aktionen">
          <button
            type="button"
            className="btn btn-klein"
            disabled={!vorhanden}
            onClick={() => {
              if (window.confirm('Schulferien neu laden? Eigene Änderungen an der Liste gehen verloren.'))
                aendere((p) => ({ ...p, schulferien: schulferienFuer(land, p.planungsjahr) }));
            }}
          >
            Neu laden
          </button>
          <button
            type="button"
            className="btn btn-klein"
            onClick={() =>
              aendere((p) => ({
                ...p,
                schulferien: [
                  ...p.schulferien,
                  { id: neueId('f'), name: 'Neue Ferien', von: `${p.planungsjahr}-01-01`, bis: `${p.planungsjahr}-01-01` },
                ],
              }))
            }
          >
            + Ferien
          </button>
        </div>
      </div>
      <p className="unterzeile">
        {vorhanden
          ? `Quelle: ${FERIEN_QUELLE.quelle}, Stand ${FERIEN_QUELLE.abgerufenAm}. Bitte im Zweifel mit dem Kultusministerium abgleichen.`
          : `Für ${plan.planungsjahr} sind noch keine Ferien hinterlegt – bitte selbst eintragen.`}
      </p>
      <ul className="liste-editor">
        {plan.schulferien.map((f) => {
          const setze = (patch: Partial<typeof f>) =>
            aendere((p) => ({ ...p, schulferien: p.schulferien.map((x) => (x.id === f.id ? { ...x, ...patch } : x)) }));
          const ungueltig = istGueltigesDatum(f.von) && istGueltigesDatum(f.bis) && f.bis < f.von;
          return (
            <li key={f.id} className="liste-zeile">
              <input type="text" aria-label="Name der Ferien" maxLength={200} value={f.name} onChange={(e) => setze({ name: e.target.value })} />
              <input type="date" aria-label={`${f.name} von`} value={f.von} onChange={(e) => setze({ von: e.target.value })} />
              <span aria-hidden="true">–</span>
              <input
                type="date"
                aria-label={`${f.name} bis`}
                value={f.bis}
                aria-invalid={ungueltig}
                onChange={(e) => setze({ bis: e.target.value })}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={`${f.name} entfernen`}
                onClick={() => aendere((p) => ({ ...p, schulferien: p.schulferien.filter((x) => x.id !== f.id) }))}
              >
                ✕
              </button>
              {ungueltig && <p className="fehler">„Bis“ liegt vor „Von“.</p>}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function BesondereTageListe({ plan, aendere }: { plan: Plan; aendere: Aendere }) {
  return (
    <>
      <ul className="liste-editor">
        {plan.besondereTage.map((t) => {
          const setze = (patch: Partial<typeof t>) =>
            aendere((p) => ({ ...p, besondereTage: p.besondereTage.map((x) => (x.id === t.id ? { ...x, ...patch } : x)) }));
          return (
            <li key={t.id} className="liste-zeile">
              <select aria-label="Symbol" value={t.symbol} onChange={(e) => setze({ symbol: e.target.value })} className="symbol-wahl">
                {(SYMBOLE.includes(t.symbol) ? SYMBOLE : [t.symbol, ...SYMBOLE]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input type="date" aria-label="Datum" value={t.datum} onChange={(e) => setze({ datum: e.target.value })} />
              <input
                type="text"
                aria-label="Anlass"
                placeholder="Anlass, z. B. Geburtstag"
                maxLength={200}
                value={t.name}
                onChange={(e) => setze({ name: e.target.value })}
              />
              <label className="schalter">
                <input type="checkbox" checked={t.jaehrlich} onChange={(e) => setze({ jaehrlich: e.target.checked })} />
                jedes Jahr
              </label>
              <button
                type="button"
                className="icon-btn"
                aria-label={`${t.name || 'Tag'} entfernen`}
                onClick={() => aendere((p) => ({ ...p, besondereTage: p.besondereTage.filter((x) => x.id !== t.id) }))}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="btn btn-klein"
        style={{ marginTop: 8 }}
        onClick={() =>
          aendere((p) => ({
            ...p,
            besondereTage: [...p.besondereTage, { id: neueId('t'), datum: `${p.planungsjahr}-01-01`, name: '', jaehrlich: false, symbol: '⭐' }],
          }))
        }
      >
        + Besonderer Tag
      </button>
    </>
  );
}

export function Einstellungen({ zustand }: { zustand: PlanZustand }) {
  const plan = zustand.plan!;
  const aendere = zustand.aendere;
  return (
    <section aria-labelledby="titel-einstellungen">
      <div className="seitenkopf">
        <div>
          <h1 id="titel-einstellungen">Einstellungen</h1>
          <p className="unterzeile">Änderungen wirken sofort und werden automatisch gespeichert.</p>
        </div>
      </div>

      <PlaeneKarte zustand={zustand} />
      <OrtUndJahr plan={plan} aendere={aendere} />
      <Personen plan={plan} aendere={aendere} />
      <Varianten plan={plan} aendere={aendere} />

      <article className="karte" aria-labelledby="einst-besondere">
        <h2 id="einst-besondere">Besondere Tage</h2>
        <p className="unterzeile">Geburtstage, Feste, Termine. „Jedes Jahr“ wiederholt den Tag in jedem Planungsjahr.</p>
        <BesondereTageListe plan={plan} aendere={aendere} />
      </article>

      <Feiertage plan={plan} aendere={aendere} />
      <Schulferien plan={plan} aendere={aendere} />
    </section>
  );
}
