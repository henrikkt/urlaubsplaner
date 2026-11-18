import { useMemo } from 'react';
import {
  berechneTracker,
  erstelleKontext,
  gemeinsameUrlaubstage,
  monatsuebersicht,
  naechsterUrlaub,
  ueberschneidungen,
  variantenvergleich,
  type ProPerson,
  type Tracker,
  type Ueberschneidung,
} from '../lib/berechnung';
import { formatDatumLang, formatZeitraum, heuteISO, MONATE } from '../lib/datum';
import { bundeslandName } from '../lib/feiertage';
import { effizienzText, formatEffizienz, formatZahl } from '../lib/format';
import { aktiveVarianteVon, alleNamen, istPaar, personName, zeigeVarianten } from '../lib/plan';
import type { PersonId, Plan, Variante } from '../lib/types';
import { PersonPunkt } from './ui';

export function VariantenUmschalter({
  plan,
  onWahl,
  gross,
}: {
  plan: Plan;
  onWahl: (id: string) => void;
  gross?: boolean;
}) {
  if (!zeigeVarianten(plan)) return null;
  return (
    <div className={gross ? 'varianten-gross' : 'varianten-klein'} role="radiogroup" aria-label="Aktive Variante">
      {plan.varianten.map((v) => {
        const aktiv = plan.aktiveVariante === v.id;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={aktiv}
            className={aktiv ? 'aktiv' : ''}
            onClick={() => onWahl(v.id)}
            title={v.beschreibung ? `Variante ${v.name}: ${v.beschreibung}` : `Variante ${v.name}`}
          >
            <span className="varianten-buchstabe">
              {gross ? 'Variante ' : ''}
              {v.name}
            </span>
            {gross && (v.beschreibung || v.startetLeer) && (
              <span className="varianten-text">{v.beschreibung || 'Eigene Planung: startet leer, mit Urlaubstipps'}</span>
            )}
            {gross && aktiv && <span className="varianten-haken">✓ aktiv</span>}
          </button>
        );
      })}
    </div>
  );
}

export function UeberschneidungsHinweis({ liste, plan }: { liste: Ueberschneidung[]; plan: Plan }) {
  if (liste.length === 0) return null;
  return (
    <div className="hinweis hinweis-warn" role="status">
      <strong>⚠ Überschneidende Blöcke:</strong>
      <ul>
        {liste.map((u) => (
          <li key={`${u.a.id}-${u.b.id}`}>
            „{u.a.name}“ und „{u.b.name}“ überschneiden sich {formatZeitraum(u.von, u.bis)}
            {istPaar(plan) ? ` (${u.personen.map((p) => personName(plan, p)).join(' & ')})` : ''}. Die Tage werden nur
            einmal gezählt.
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Fortschrittsring: eingeplante Tage als Bogen in der Personenfarbe, in der Mitte die übrigen Tage */
export function Fortschrittsring({
  eingeplant,
  verfuegbar,
  farbe,
  name,
}: {
  eingeplant: number;
  verfuegbar: number;
  farbe: string;
  name: string;
}) {
  const r = 52;
  const umfang = 2 * Math.PI * r;
  const ueber = eingeplant > verfuegbar;
  const anteil = verfuegbar > 0 ? Math.min(1, eingeplant / verfuegbar) : eingeplant > 0 ? 1 : 0;
  const uebrig = verfuegbar - eingeplant;
  const beschreibung = ueber
    ? `${name}: ${formatZahl(eingeplant)} von ${formatZahl(verfuegbar)} Urlaubstagen eingeplant – ${formatZahl(-uebrig)} zu viel`
    : `${name}: ${formatZahl(eingeplant)} von ${formatZahl(verfuegbar)} Urlaubstagen eingeplant, ${formatZahl(uebrig)} übrig`;
  return (
    <div className={`ring ${ueber ? 'ring-ueber' : ''}`} role="img" aria-label={beschreibung}>
      <svg viewBox="0 0 128 128" width="128" height="128" aria-hidden="true">
        <circle className="ring-spur" cx="64" cy="64" r={r} />
        {anteil > 0 && (
        <circle
          className="ring-bogen"
          cx="64"
          cy="64"
          r={r}
          stroke={ueber ? undefined : farbe}
          strokeDasharray={`${umfang * anteil} ${umfang}`}
          transform="rotate(-90 64 64)"
        />
        )}
      </svg>
      <span className="ring-mitte" aria-hidden="true">
        <strong>{formatZahl(Math.abs(uebrig))}</strong>
        <span>{ueber ? 'zu viel' : uebrig === 1 ? 'Tag übrig' : 'Tage übrig'}</span>
      </span>
    </div>
  );
}

function TrackerKarte({ t, plan, variante }: { t: Tracker; plan: Plan; variante: Variante }) {
  const basis = Math.max(t.verfuegbar, t.verplant, 1);
  const anteil = (n: number) => `${Math.min(100, (n / basis) * 100)}%`;
  const person = plan.personen.find((p) => p.id === t.person);
  const name = personName(plan, t.person);
  const mehrereVarianten = zeigeVarianten(plan);
  const uebrig = t.nochVerfuegbar;
  return (
    <article className={`karte tracker tracker-${t.person}`} aria-labelledby={`tracker-${t.person}`}>
      <h2 id={`tracker-${t.person}`}>
        <PersonPunkt person={t.person} /> {name}
      </h2>
      <div className="tracker-oben">
        <Fortschrittsring eingeplant={t.verplant} verfuegbar={t.verfuegbar} farbe={person?.farbe ?? 'currentColor'} name={name} />
        <dl className="tracker-zeilen">
          <div>
            <dt>Urlaubstage im Jahr</dt>
            <dd>{formatZahl(t.anspruch)}</dd>
          </div>
          <div>
            <dt>+ Resturlaub</dt>
            <dd>{formatZahl(t.resturlaub)}</dd>
          </div>
          <div className="summe">
            <dt>= zusammen</dt>
            <dd>{formatZahl(t.verfuegbar)}</dd>
          </div>
          <div>
            <dt>schon eingeplant{mehrereVarianten ? ` (Variante ${variante.name})` : ''}</dt>
            <dd>{formatZahl(t.verplant)}</dd>
          </div>
          <div className={`gross ${uebrig < 0 ? 'wert-rot' : uebrig > 0 ? 'wert-gelb' : 'wert-gruen'}`}>
            <dt>{uebrig < 0 ? 'zu viel eingeplant' : 'noch übrig'}</dt>
            <dd>
              {formatZahl(Math.abs(uebrig))}
              {uebrig === 0 && <span className="wert-text">alles eingeplant ✓</span>}
            </dd>
          </div>
        </dl>
      </div>
      <div
        className="balken-stapel"
        role="img"
        aria-label={`${formatZahl(t.verplant)} von ${formatZahl(t.verfuegbar)} Tagen eingeplant: ${formatZahl(t.genehmigt)} genehmigt, ${formatZahl(t.beantragt)} beantragt, ${formatZahl(t.nichtBeantragt)} noch nicht beantragt`}
      >
        <span className="seg seg-genehmigt" style={{ width: anteil(t.genehmigt) }} />
        <span className="seg seg-beantragt" style={{ width: anteil(t.beantragt) }} />
        <span className="seg seg-offen" style={{ width: anteil(t.nichtBeantragt) }} />
        <span className="seg seg-abgelehnt" style={{ width: anteil(t.abgelehnt) }} />
      </div>
      <ul className="status-legende">
        <li>
          <span className="quadrat seg-genehmigt" aria-hidden="true" /> genehmigt <strong>{formatZahl(t.genehmigt)}</strong>
        </li>
        <li>
          <span className="quadrat seg-beantragt" aria-hidden="true" /> beantragt <strong>{formatZahl(t.beantragt)}</strong>
        </li>
        <li>
          <span className="quadrat seg-offen" aria-hidden="true" /> noch nicht beantragt{' '}
          <strong>{formatZahl(t.nichtBeantragt)}</strong>
        </li>
        {t.abgelehnt > 0 && (
          <li className="wert-rot">
            <span className="quadrat seg-abgelehnt" aria-hidden="true" /> abgelehnt <strong>{formatZahl(t.abgelehnt)}</strong>
          </li>
        )}
      </ul>
      <dl className="tracker-zeilen tracker-unten">
        <div className={t.inSchulferien > 0 ? 'wert-orange' : ''}>
          <dt>Urlaubstage in den Schulferien</dt>
          <dd>
            {formatZahl(t.inSchulferien)} {t.inSchulferien > 0 ? '⚠' : '✓'}
          </dd>
        </div>
        <div>
          <dt>Freie Tage insgesamt</dt>
          <dd>{formatZahl(t.freieTage)}</dd>
        </div>
        <div className="tracker-effizienz">
          <dt>So viel bringt’s</dt>
          <dd>{effizienzText(t.effizienz)}</dd>
        </div>
      </dl>
    </article>
  );
}

/** Begrüßung mit großem Countdown bis zum nächsten Urlaub */
function Begruessung({ plan }: { plan: Plan }) {
  const heute = heuteISO();
  const n = naechsterUrlaub(plan, heute);
  const euer = istPaar(plan) ? 'eurem' : 'deinem';
  return (
    <section className="begruessung" aria-labelledby="titel-begruessung">
      <div className="begruessung-text">
        <p className="begruessung-hallo">
          Hallo {alleNamen(plan)} <span aria-hidden="true">👋</span>
        </p>
        {!n ? (
          <>
            <h2 id="titel-begruessung" className="begruessung-titel">
              Noch kein Urlaub geplant – Zeit zum Träumen! <span aria-hidden="true">☀️</span>
            </h2>
            <p className="begruessung-unter">Der Brückentag-Finder zeigt dir die besten Gelegenheiten für {plan.planungsjahr}.</p>
            <a className="btn begruessung-knopf" href="#/brueckentage">
              Brückentage ansehen
            </a>
          </>
        ) : (
          <>
            <h2 id="titel-begruessung" className="begruessung-titel">
              {n.laufend ? (
                n.nochTage === 1 ? (
                  <>Heute ist der letzte Urlaubstag – genieß ihn!</>
                ) : (
                  <>
                    Schönen Urlaub! Noch <span className="begruessung-zahl">{n.nochTage}</span> Tage
                  </>
                )
              ) : n.tageBis === 1 ? (
                <>Morgen geht’s los!</>
              ) : (
                <>
                  Noch <span className="begruessung-zahl">{n.tageBis}</span> Tage bis zu {euer} nächsten Urlaub
                </>
              )}{' '}
              <span aria-hidden="true">{n.laufend ? '🌴' : '☀️'}</span>
            </h2>
            <p className="begruessung-unter">
              <strong>{n.block.name || 'Urlaub'}</strong> · {formatZeitraum(n.block.von, n.block.bis)}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function Monatsuebersicht({ plan }: { plan: Plan }) {
  const zeilen = useMemo(() => monatsuebersicht(plan), [plan]);
  const paar = istPaar(plan);
  const max = Math.max(1, ...zeilen.flatMap((z) => plan.personen.map((p) => z.ut[p.id] ?? 0)));
  const maxFrei = Math.max(1, ...zeilen.map((z) => z.gemeinsamFrei));
  const summe = (f: (z: (typeof zeilen)[number]) => number) => zeilen.reduce((s, z) => s + f(z), 0);
  const Balken = ({ wert, maxWert, klasse }: { wert: number; maxWert: number; klasse: string }) => (
    <span className="mini-balken">
      <span className="mini-balken-spur" aria-hidden="true">
        <span className={`mini-balken-fuellung ${klasse}`} style={{ width: `${(wert / maxWert) * 100}%` }} />
      </span>
      <span className="mini-balken-zahl">{formatZahl(wert)}</span>
    </span>
  );
  const ut = (z: (typeof zeilen)[number], id: PersonId) => z.ut[id] ?? 0;
  return (
    <article className="karte" aria-labelledby="titel-monate">
      <h2 id="titel-monate">Monatsübersicht</h2>
      <div className="tabelle-scroll">
        <table className="tabelle monats-tabelle">
          <thead>
            <tr>
              <th scope="col">Monat</th>
              {plan.personen.map((p) => (
                <th key={p.id} scope="col">
                  <PersonPunkt person={p.id} /> {paar ? `Urlaubstage ${p.name}` : 'Urlaubstage'}
                </th>
              ))}
              {paar && (
                <th scope="col">
                  <PersonPunkt person="alle" /> gemeinsam frei
                  <span className="th-hilfe">Kalendertage</span>
                </th>
              )}
              <th scope="col" className="zahl">
                Feiertage Mo–Fr
              </th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => {
              const leer = plan.personen.every((p) => ut(z, p.id) === 0) && z.gemeinsamFrei === 0;
              return (
                <tr key={z.monat} className={leer ? 'leer-zeile' : ''}>
                  <th scope="row">{MONATE[z.monat - 1]}</th>
                  {plan.personen.map((p) => (
                    <td key={p.id}>
                      <Balken wert={ut(z, p.id)} maxWert={max} klasse={`farbe-${p.id}`} />
                    </td>
                  ))}
                  {paar && (
                    <td>
                      <Balken wert={z.gemeinsamFrei} maxWert={maxFrei} klasse="farbe-alle" />
                    </td>
                  )}
                  <td className="zahl">{z.feiertageWerktags || '–'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Summe</th>
              {plan.personen.map((p) => (
                <td key={p.id}>{formatZahl(summe((z) => ut(z, p.id)))}</td>
              ))}
              {paar && <td>{formatZahl(summe((z) => z.gemeinsamFrei))}</td>}
              <td className="zahl">{summe((z) => z.feiertageWerktags)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </article>
  );
}

function Variantenvergleich({ plan, onWahl }: { plan: Plan; onWahl: (id: string) => void }) {
  const ergebnisse = useMemo(() => variantenvergleich(plan), [plan]);
  const paar = istPaar(plan);
  const ids = plan.personen.map((p) => p.id);
  const werte = (t: ProPerson<Tracker>, f: (x: Tracker) => number, fmt: (n: number) => string = formatZahl) => {
    const liste = ids.map((id) => f(t[id]!));
    if (liste.every((x) => x === liste[0])) return fmt(liste[0]);
    return ids.map((id, i) => `${personName(plan, id).slice(0, 1)} ${fmt(liste[i])}`).join(' · ');
  };
  const zeilen: { label: string; wert: (t: ProPerson<Tracker>, gemeinsam: number) => string }[] = [
    { label: 'Urlaubstage verplant', wert: (t) => werte(t, (x) => x.verplant) },
    { label: 'noch verfügbar', wert: (t) => werte(t, (x) => x.nochVerfuegbar) },
    { label: 'Freie Tage insgesamt', wert: (t) => werte(t, (x) => x.freieTage) },
    {
      label: 'Effizienz',
      wert: (t) => werte(t, (x) => x.effizienz ?? 0, (n) => formatEffizienz(n > 0 ? n : null, 2)),
    },
    { label: 'Urlaubstage in Schulferien', wert: (t) => werte(t, (x) => x.inSchulferien) },
    ...(paar ? [{ label: 'Gemeinsame Urlaubstage', wert: (_t: ProPerson<Tracker>, g: number) => formatZahl(g) }] : []),
  ];
  return (
    <article className="karte" aria-labelledby="titel-vergleich">
      <h2 id="titel-vergleich">Variantenvergleich</h2>
      <div className="tabelle-scroll">
        <table className="tabelle vergleich-tabelle">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Kennzahl</span>
              </th>
              {ergebnisse.map((e) => {
                const aktiv = plan.aktiveVariante === e.variante.id;
                return (
                  <th key={e.variante.id} scope="col" className={aktiv ? 'spalte-aktiv' : ''}>
                    <button type="button" className="link-btn" onClick={() => onWahl(e.variante.id)}>
                      Variante {e.variante.name}
                    </button>
                    {aktiv && <span className="badge badge-aktiv">aktiv</span>}
                    {e.variante.beschreibung && <span className="th-hilfe">{e.variante.beschreibung}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => (
              <tr key={z.label}>
                <th scope="row">{z.label}</th>
                {ergebnisse.map((e) => (
                  <td key={e.variante.id} className={plan.aktiveVariante === e.variante.id ? 'spalte-aktiv' : ''}>
                    {z.wert(e.tracker, e.gemeinsameUrlaubstage)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function Uebersicht({ plan, onVariante }: { plan: Plan; onVariante: (id: string) => void }) {
  const ctx = useMemo(() => erstelleKontext(plan), [plan]);
  const variante = aktiveVarianteVon(plan);
  const tracker = useMemo(() => plan.personen.map((p) => berechneTracker(plan, p.id, variante, ctx)), [plan, variante, ctx]);
  const paar = istPaar(plan);
  const gemeinsam = useMemo(() => gemeinsameUrlaubstage(plan, variante, ctx), [plan, variante, ctx]);
  const ueber = useMemo(() => ueberschneidungen(plan), [plan]);

  return (
    <section aria-labelledby="titel-uebersicht">
      <div className="seitenkopf">
        <div>
          <h1 id="titel-uebersicht">{plan.name}</h1>
          <p className="unterzeile">
            Heute ist {formatDatumLang(heuteISO())}. Feiertage und Schulferien: {bundeslandName(plan.bundesland)}.
          </p>
        </div>
      </div>

      <Begruessung plan={plan} />

      <VariantenUmschalter plan={plan} onWahl={onVariante} gross />

      <UeberschneidungsHinweis liste={ueber} plan={plan} />

      <div className="raster-3">
        {tracker.map((t) => (
          <TrackerKarte key={t.person} t={t} plan={plan} variante={variante} />
        ))}
        {paar && (
          <div className="stapel">
            <article className="karte kennzahl-karte gemeinsam-karte">
              <h2>
                <PersonPunkt person="alle" /> Zusammen frei
              </h2>
              <p className="gross-zahl">{formatZahl(gemeinsam)}</p>
              <p className="unterzeile">
                {gemeinsam === 1 ? 'Arbeitstag' : 'Arbeitstage'}, an denen ihr beide Urlaub habt – Zeit für gemeinsame Erlebnisse.
              </p>
            </article>
          </div>
        )}
      </div>

      <div className="raster-2">
        <Monatsuebersicht plan={plan} />
        {zeigeVarianten(plan) && <Variantenvergleich plan={plan} onWahl={onVariante} />}
      </div>
    </section>
  );
}
