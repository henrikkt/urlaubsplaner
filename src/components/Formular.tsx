import { useId } from 'react';
import { WOCHENTAGE_KURZ } from '../lib/datum';
import { BUNDESLAENDER, regionaleFeiertageFuer, type Bundesland } from '../lib/feiertage';
import type { PersonEingabe } from '../lib/plan';
import type { TagesAnteil, Wochentag } from '../lib/types';

export const ANTEILE: { wert: TagesAnteil; text: string }[] = [
  { wert: 1, text: 'ganzer Tag' },
  { wert: 0.5, text: 'halber Tag' },
  { wert: 0, text: 'frei' },
];

export function zahlAus(s: string): number {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? Math.max(0, Math.min(366, n)) : 0;
}

/** Planungsjahre: aktuelles Jahr bis +2 (plus ein evtl. schon gewähltes anderes Jahr) */
export function jahresOptionen(aktuell?: number): number[] {
  const j = new Date().getFullYear();
  const liste = [j, j + 1, j + 2];
  if (aktuell && !liste.includes(aktuell)) liste.push(aktuell);
  return liste.sort((a, b) => a - b);
}

export function WochentageWahl({
  wert,
  onChange,
  label,
}: {
  wert: Wochentag[];
  onChange: (w: Wochentag[]) => void;
  label: string;
}) {
  const id = useId();
  return (
    <fieldset className="feld feldgruppe">
      <legend className="feld-titel" id={id}>
        {label}
      </legend>
      <div className="wochentage-wahl" role="group" aria-labelledby={id}>
        {WOCHENTAGE_KURZ.map((name, i) => {
          const tag = i as Wochentag;
          const an = wert.includes(tag);
          return (
            <label key={name} title={an ? `${name}: Arbeitstag` : `${name}: frei`}>
              <input
                type="checkbox"
                checked={an}
                aria-label={name}
                onChange={() => {
                  const neu = an ? wert.filter((x) => x !== tag) : [...wert, tag].sort();
                  if (neu.length > 0) onChange(neu as Wochentag[]);
                }}
              />
              <span aria-hidden="true">{name}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function AnteilWahl({
  label,
  wert,
  onChange,
}: {
  label: string;
  wert: TagesAnteil;
  onChange: (w: TagesAnteil) => void;
}) {
  const id = useId();
  return (
    <div className="feld">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={wert} onChange={(e) => onChange(Number(e.target.value) as TagesAnteil)}>
        {ANTEILE.map((a) => (
          <option key={a.wert} value={a.wert}>
            {a.text}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ZahlFeld({
  label,
  wert,
  onChange,
  hilfe,
}: {
  label: string;
  wert: number;
  onChange: (n: number) => void;
  hilfe?: string;
}) {
  const id = useId();
  return (
    <div className="feld">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={0}
        max={366}
        step={0.5}
        inputMode="decimal"
        value={wert}
        onChange={(e) => onChange(zahlAus(e.target.value))}
        aria-describedby={hilfe ? `${id}-h` : undefined}
      />
      {hilfe && (
        <small className="hilfe" id={`${id}-h`}>
          {hilfe}
        </small>
      )}
    </div>
  );
}

/** Eingaben für eine Person (Startassistent und Einstellungen) */
export function PersonFelder({
  wert,
  onChange,
  nummer,
  mitName = true,
}: {
  wert: PersonEingabe;
  onChange: (patch: Partial<PersonEingabe>) => void;
  nummer: number;
  mitName?: boolean;
}) {
  const id = useId();
  return (
    <div className="formular">
      {mitName && (
        <div className="feld-reihe">
          <div className="feld">
            <label htmlFor={`${id}-name`}>Name</label>
            <input
              id={`${id}-name`}
              type="text"
              maxLength={60}
              autoComplete="off"
              value={wert.name}
              placeholder={nummer === 1 ? 'z. B. Papa' : 'z. B. Mama'}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </div>
          <div className="feld">
            <label htmlFor={`${id}-farbe`}>Farbe im Kalender</label>
            <span className="farbe-feld">
              <input id={`${id}-farbe`} type="color" value={wert.farbe ?? '#3B7DD8'} onChange={(e) => onChange({ farbe: e.target.value })} />
            </span>
          </div>
        </div>
      )}
      <div className="feld-reihe">
        <ZahlFeld
          label="Urlaubstage pro Jahr"
          wert={wert.anspruch}
          onChange={(n) => onChange({ anspruch: n })}
          hilfe="laut Arbeitsvertrag"
        />
        <ZahlFeld
          label="Resturlaub"
          wert={wert.resturlaub}
          onChange={(n) => onChange({ resturlaub: n })}
          hilfe="aus dem Vorjahr, 0 wenn keiner"
        />
      </div>
      <WochentageWahl
        label="An welchen Tagen wird gearbeitet?"
        wert={(wert.arbeitstage ?? [0, 1, 2, 3, 4]) as Wochentag[]}
        onChange={(w) => onChange({ arbeitstage: w })}
      />
      <fieldset className="feldgruppe">
        <legend className="feld-titel">Wie viel Urlaub kosten Heiligabend und Silvester?</legend>
        <div className="feld-reihe">
          <AnteilWahl label="Heiligabend (24.12.)" wert={wert.heiligabend} onChange={(w) => onChange({ heiligabend: w })} />
          <AnteilWahl label="Silvester (31.12.)" wert={wert.silvester} onChange={(w) => onChange({ silvester: w })} />
        </div>
      </fieldset>
    </div>
  );
}

export function BundeslandWahl({
  wert,
  onChange,
  label = 'Bundesland',
}: {
  wert: Bundesland;
  onChange: (b: Bundesland) => void;
  label?: string;
}) {
  const id = useId();
  return (
    <div className="feld">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={wert} onChange={(e) => onChange(e.target.value as Bundesland)}>
        {BUNDESLAENDER.map((b) => (
          <option key={b.code} value={b.code}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function RegionaleFeiertageWahl({
  land,
  wert,
  onChange,
}: {
  land: Bundesland;
  wert: string[];
  onChange: (ids: string[]) => void;
}) {
  const liste = regionaleFeiertageFuer(land);
  if (liste.length === 0) return null;
  return (
    <fieldset className="feld feldgruppe feldgruppe-abstand">
      <legend className="feld-titel">Feiertage, die nur in Teilen des Landes gelten</legend>
      <ul className="checkbox-liste">
        {liste.map((r) => (
          <li key={r.id}>
            <label className="schalter">
              <input
                type="checkbox"
                checked={wert.includes(r.id)}
                onChange={(e) => onChange(e.target.checked ? [...wert, r.id] : wert.filter((x) => x !== r.id))}
              />
              {r.name}
            </label>
            <small className="hilfe">gilt {r.gebiet}</small>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
