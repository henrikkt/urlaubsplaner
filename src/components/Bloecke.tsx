import { useMemo } from 'react';
import { erstelleKontext, istAktiv, ueberschneidungen } from '../lib/berechnung';
import { formatZeitraum } from '../lib/datum';
import {
  aktiveVarianteVon,
  aktualisiereBlock,
  dupliziereBlock,
  entferneBlock,
  sortiereBloecke,
  varianteName,
  zeigeVarianten,
} from '../lib/plan';
import type { Plan, Urlaubsblock } from '../lib/types';
import { BlockEditor } from './BlockEditor';
import { UeberschneidungsHinweis } from './Uebersicht';
import { KofferBild } from './Illustrationen';
import { Hilfe } from './ui';

export function Bloecke({
  plan,
  aendere,
  onNeu,
}: {
  plan: Plan;
  aendere: (fn: (p: Plan) => Plan) => void;
  onNeu: () => void;
}) {
  const ctx = useMemo(() => erstelleKontext(plan), [plan]);
  const ueber = useMemo(() => ueberschneidungen(plan), [plan]);
  const v = aktiveVarianteVon(plan);
  const mehrereVarianten = zeigeVarianten(plan);

  const loeschen = (b: Urlaubsblock) => {
    if (window.confirm(`Block „${b.name || 'ohne Namen'}“ wirklich löschen?`)) aendere((p) => entferneBlock(p, b.id));
  };

  return (
    <section aria-labelledby="titel-bloecke">
      <div className="seitenkopf">
        <div>
          <h1 id="titel-bloecke">Urlaubsblöcke</h1>
          <p className="unterzeile">
            {!mehrereVarianten
              ? 'Alle Blöcke zählen – außer geparkten Ideen.'
              : v.startetLeer
                ? `Variante ${v.name} (eigene Planung) startet leer – aktiv sind nur Blöcke dieser Variante.`
                : `Aktiv sind Blöcke mit „Immer“ und der gewählten Variante ${v.name}.`}{' '}
            Alles wird automatisch gespeichert.
          </p>
        </div>
        <div className="aktionen">
          <button type="button" className="btn" onClick={() => aendere(sortiereBloecke)}>
            Nach Datum sortieren
          </button>
          <button type="button" className="btn btn-primaer" onClick={onNeu}>
            + Neuer Block
          </button>
        </div>
      </div>

      <Hilfe>
        Ein Block ist ein Zeitraum, in dem du frei hast – von Wochenende bis Wochenende. Die App zählt die Urlaubstage
        selbst und lässt Wochenenden und Feiertage weg.
      </Hilfe>

      <UeberschneidungsHinweis liste={ueber} plan={plan} />

      {plan.bloecke.length === 0 && (
        <div className="leer-zustand">
          <KofferBild />
          <p>
            <strong>Der Koffer ist noch leer.</strong>
            <br />
            Lege oben einen Urlaub an oder schau in den <a href="#/brueckentage">Brückentag-Finder</a>.
          </p>
        </div>
      )}

      <ul className="block-liste">
        {plan.bloecke.map((b) => {
          const aktiv = istAktiv(b, v);
          return (
            <li key={b.id} className={`karte block-karte ${aktiv ? '' : 'inaktiv'}`} id={`block-${b.id}`}>
              <div className="block-karte-kopf">
                <span className={`badge ${aktiv ? 'badge-aktiv' : 'badge-inaktiv'}`}>
                  {mehrereVarianten
                    ? `${aktiv ? '● zählt' : '○ zählt nicht'} · ${varianteName(plan, b.variante)}`
                    : aktiv
                      ? '● zählt mit'
                      : '○ geparkt'}
                </span>
                <span className="zeitraum">{formatZeitraum(b.von, b.bis)}</span>
                <span className="spacer" />
                <button type="button" className="btn btn-klein" onClick={() => aendere((p) => dupliziereBlock(p, b.id))}>
                  Duplizieren
                </button>
                <button type="button" className="btn btn-klein btn-gefahr" onClick={() => loeschen(b)}>
                  Löschen
                </button>
              </div>
              <BlockEditor
                block={b}
                plan={plan}
                ctx={ctx}
                onChange={(patch) => aendere((p) => aktualisiereBlock(p, b.id, patch))}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
