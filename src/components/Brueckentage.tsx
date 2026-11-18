import { useMemo, useState } from 'react';
import { findeBrueckentage, type Chance } from '../lib/brueckentage';
import { formatDatumKurz, formatZeitraum } from '../lib/datum';
import { effizienzBewertung, formatZahl, tageText } from '../lib/format';
import type { Plan } from '../lib/types';
import type { NeuVorlage } from './Dialoge';
import { FerienBadge, Hilfe } from './ui';

/** "3 Urlaubstage" oder bei unterschiedlichen Werten "Urlaubstage: Anna 3, Ben 2" */
export function utText(c: Chance, plan: Plan): string {
  const werte = plan.personen.map((p) => c.ut[p.id] ?? 0);
  if (werte.every((w) => w === werte[0])) return `${formatZahl(c.utMax)} ${c.utMax === 1 ? 'Urlaubstag' : 'Urlaubstage'}`;
  return 'Urlaubstage: ' + plan.personen.map((p, i) => `${p.name} ${formatZahl(werte[i])}`).join(', ');
}

/** Freundliches Abzeichen statt „4,0x“ – nur bei besonders guten Gelegenheiten */
export function EffizienzAbzeichen({ effizienz }: { effizienz: number | null }) {
  const b = effizienzBewertung(effizienz);
  if (!b) return null;
  return <span className={`chance-eff ${b === 'Top-Tipp' ? 'chance-top' : ''}`}>{b === 'Top-Tipp' ? '⭐ Top-Tipp' : 'Sehr gut'}</span>;
}

export function ChancenListe({
  liste,
  plan,
  onUebernehmen,
}: {
  liste: Chance[];
  plan: Plan;
  onUebernehmen: (c: Chance) => void;
}) {
  return (
    <ul className="chancen-liste">
      {liste.map((c) => (
        <li key={c.id} className={`karte chance ${c.bereitsVerplant ? 'chance-verplant' : ''}`}>
          <div className="chance-haupt">
            <p className="chance-formel">
              <strong>{utText(c, plan)}</strong> → <strong>{tageText(c.tageFrei)} frei</strong>
              <EffizienzAbzeichen effizienz={c.effizienz} />
            </p>
            <p className="chance-anlass">
              <span className={`badge ${c.art === 'Brückentag' ? 'badge-bruecke' : 'badge-woche'}`}>{c.art}</span> {c.anlass}
            </p>
            <p className="unterzeile">{formatZeitraum(c.von, c.bis)}</p>
            <p className="unterzeile">Urlaub nehmen: {c.urlaubstage.map((d) => formatDatumKurz(d)).join(', ')}</p>
          </div>
          <div className="chance-seite">
            <FerienBadge ferien={c.ferien} />
            {c.bereitsVerplant && <span className="badge badge-aktiv">✓ schon eingeplant</span>}
            <button type="button" className="btn btn-primaer btn-klein" onClick={() => onUebernehmen(c)}>
              In den Plan übernehmen
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function vorlageAus(c: Chance, plan: Plan): NeuVorlage {
  return {
    von: c.von,
    bis: c.bis,
    name: c.art === 'Anlass' ? `Kurztrip: ${c.anlass}` : c.anlass,
    notiz: `Aus dem Brückentag-Finder: ${utText(c, plan)} → ${tageText(c.tageFrei)} frei`,
  };
}

export function Brueckentage({ plan, onUebernehmen }: { plan: Plan; onUebernehmen: (v: NeuVorlage) => void }) {
  const [nurFerienfrei, setNurFerienfrei] = useState(false);
  const alle = useMemo(() => findeBrueckentage(plan), [plan]);
  const liste = nurFerienfrei ? alle.filter((c) => !c.inFerien) : alle;

  return (
    <section aria-labelledby="titel-bruecken">
      <div className="seitenkopf">
        <div>
          <h1 id="titel-bruecken">Brückentag-Finder {plan.planungsjahr}</h1>
          <p className="unterzeile">Alle Feiertags-Chancen, die besten zuerst.</p>
        </div>
        <div className="aktionen">
          <label className="schalter">
            <input type="checkbox" checked={nurFerienfrei} onChange={(e) => setNurFerienfrei(e.target.checked)} />
            nur außerhalb der Schulferien
          </label>
        </div>
      </div>

      <Hilfe>
        „Brückentag“ heißt: mit 1–2 Urlaubstagen einen Feiertag zu mindestens 4 freien Tagen verlängern. „Ganze
        Woche“ heißt: die komplette Woche rund um den Feiertag frei nehmen. „⭐ Top-Tipp“ heißt: Für jeden
        Urlaubstag bekommst du mindestens drei freie Tage.
      </Hilfe>

      {liste.length === 0 && <p className="leer">Keine Chancen gefunden.</p>}

      <ChancenListe liste={liste} plan={plan} onUebernehmen={(c) => onUebernehmen(vorlageAus(c, plan))} />
    </section>
  );
}
