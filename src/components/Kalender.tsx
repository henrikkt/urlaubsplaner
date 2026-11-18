import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import {
  belegungVon,
  besondereTageAm,
  erstelleKontext,
  ferienAm,
  istAktiv,
  monatsuebersicht,
  type Belegung,
  type Kontext,
  type Monatszeile,
} from '../lib/berechnung';
import type { Chance } from '../lib/brueckentage';
import {
  addiereTage,
  baue,
  formatDatum,
  formatDatumKurz,
  formatDatumLang,
  formatZeitraum,
  heuteISO,
  istWochenende,
  MONATE,
  tageImMonat,
  WOCHENTAGE_KURZ,
  wochentag,
} from '../lib/datum';
import { formatEffizienz, formatZahl, tageText } from '../lib/format';
import { aktiveVarianteVon, istPaar, personName, werText, zeigeVarianten } from '../lib/plan';
import { tippsProTag, urlaubstipps } from '../lib/tipps';
import type { BesondererTag, PersonId, Plan, Urlaubsblock } from '../lib/types';
import { utText, vorlageAus } from './Brueckentage';
import type { NeuVorlage } from './Dialoge';
import { Dialog, FerienBadge, Hilfe, PersonPunkt, Segmente } from './ui';

type Filter = 'alle' | PersonId;

interface TagDaten {
  datum: string;
  klassen: string;
  text: string;
  symbol: string | null;
}

function tagDaten(
  d: string,
  plan: Plan,
  ctx: Kontext,
  bel: Belegung,
  besondere: BesondererTag[],
  filter: Filter,
  heute: string,
  tipps: Chance[] | undefined,
): TagDaten {
  const eintrag = bel.get(d);
  const sichtbar = ctx.personenIds.filter((p) => filter === 'alle' || filter === p);
  const mitUrlaub = sichtbar.filter((p) => (eintrag?.[p]?.length ?? 0) > 0);
  const urlaub = mitUrlaub.length > 0;
  const feiertag = ctx.feiertage.get(d);
  const ferien = ferienAm(d, ctx.schulferien);
  const wochenende = istWochenende(d);
  const bes = besondereTageAm(d, besondere);

  const k = ['tag'];
  if (urlaub) {
    const alle = ctx.personenIds.length > 1 && mitUrlaub.length === ctx.personenIds.length;
    k.push('urlaub', alle ? 'urlaub-alle' : `urlaub-${mitUrlaub[0]}`);
  } else if (feiertag) k.push('feiertag');
  else if (wochenende) k.push('wochenende');
  else if (ferien) k.push('ferien');
  if (ferien && urlaub) k.push('urlaub-in-ferien');
  if (ferien && !urlaub && (feiertag || wochenende)) k.push('ferien-streifen');
  if (feiertag && urlaub) k.push('mit-feiertag');
  const mitTipp = !urlaub && Boolean(tipps?.length);
  if (mitTipp) {
    k.push('tipp');
    if (tipps!.some((c) => c.urlaubstage.includes(d))) k.push('tipp-ut');
  }
  if (bes.length) k.push('besonders');
  if (d === heute) k.push('heute');

  const teile = [formatDatumLang(d)];
  if (feiertag) teile.push(`Feiertag: ${feiertag}`);
  if (urlaub) {
    const bloecke = new Map<string, Urlaubsblock>();
    for (const p of mitUrlaub) for (const b of eintrag![p] ?? []) bloecke.set(b.id, b);
    const wer = istPaar(plan) ? ` ${mitUrlaub.map((p) => personName(plan, p)).join(' & ')}` : '';
    teile.push(`Urlaub${wer}: ${[...bloecke.values()].map((b) => b.name || 'ohne Namen').join(', ')}`);
  } else if (wochenende) {
    teile.push('Wochenende');
  }
  if (ferien) teile.push(`Schulferien: ${ferien.name}${urlaub ? ' – Urlaub in den Ferien!' : ''}`);
  for (const t of bes) teile.push(`${t.symbol} ${t.name}`);
  if (mitTipp) {
    for (const c of tipps!.slice(0, 3)) {
      teile.push(`Urlaubstipp: ${utText(c, plan)} → ${tageText(c.tageFrei)} frei (${c.anlass})`);
    }
    if (tipps!.some((c) => c.urlaubstage.includes(d))) teile.push('Tipp: hier Urlaub nehmen');
  }
  if (d === heute) teile.push('Heute');

  return { datum: d, klassen: k.join(' '), text: teile.join(' · '), symbol: bes[0]?.symbol ?? null };
}

const Tag = memo(function Tag({ t, markiert }: { t: TagDaten; markiert: boolean }) {
  const tag = Number(t.datum.slice(8));
  return (
    <button
      type="button"
      className={markiert ? `${t.klassen} markiert` : t.klassen}
      data-datum={t.datum}
      title={t.text.replace(/ · /g, '\n')}
      aria-label={t.text}
    >
      {t.symbol && (
        <span className="tag-symbol" aria-hidden="true">
          {t.symbol}
        </span>
      )}
      <span className="tag-zahl">{tag}</span>
    </button>
  );
});

function Monat({
  plan,
  monat,
  tage,
  zeile,
  istMarkiert,
}: {
  plan: Plan;
  monat: number;
  tage: Map<string, TagDaten>;
  zeile: Monatszeile;
  istMarkiert: (d: string) => boolean;
}) {
  const jahr = plan.planungsjahr;
  const erster = baue(jahr, monat, 1);
  const versatz = wochentag(erster);
  const anzahl = tageImMonat(jahr, monat);
  const zellen = [];
  for (let i = 0; i < versatz; i++) zellen.push(<span key={`l${i}`} className="tag-leer" aria-hidden="true" />);
  for (let t = 1; t <= anzahl; t++) {
    const d = baue(jahr, monat, t);
    zellen.push(<Tag key={d} t={tage.get(d)!} markiert={istMarkiert(d)} />);
  }
  const paar = istPaar(plan);
  return (
    <section className="monat" aria-label={`${MONATE[monat - 1]} ${jahr}`}>
      <h3>{MONATE[monat - 1]}</h3>
      <div className="monat-raster">
        {WOCHENTAGE_KURZ.map((w) => (
          <span key={w} className={`wt ${w === 'Sa' || w === 'So' ? 'wt-we' : ''}`} aria-hidden="true">
            {w}
          </span>
        ))}
        {zellen}
      </div>
      <p className="monat-summe">
        {plan.personen.map((p) => (
          <span key={p.id}>
            <PersonPunkt person={p.id} /> {paar ? `${p.name} ` : 'Urlaubstage '}
            <strong>{formatZahl(zeile.ut[p.id] ?? 0)}</strong>
          </span>
        ))}
      </p>
    </section>
  );
}

export function Legende({ plan, mitTipps }: { plan: Plan; mitTipps?: boolean }) {
  const paar = istPaar(plan);
  return (
    <ul className="legende" aria-label="Legende">
      {mitTipps && (
        <>
          <li>
            <span className="legende-feld tipp" /> Urlaubstipp (Zeitraum)
          </li>
          <li>
            <span className="legende-feld tipp tipp-ut" /> Tipp: hier Urlaub nehmen
          </li>
        </>
      )}
      {paar ? (
        <>
          <li>
            <span className="legende-feld urlaub-alle" /> Beide Urlaub
          </li>
          {plan.personen.map((p) => (
            <li key={p.id}>
              <span className={`legende-feld urlaub-${p.id}`} /> nur {p.name}
            </li>
          ))}
        </>
      ) : (
        <li>
          <span className="legende-feld urlaub-p1" /> Urlaub
        </li>
      )}
      <li>
        <span className="legende-feld feiertag" /> Feiertag
      </li>
      <li>
        <span className="legende-feld wochenende" /> Wochenende
      </li>
      <li>
        <span className="legende-feld ferien" /> Schulferien
      </li>
      <li>
        <span className={`legende-feld ${paar ? 'urlaub-alle' : 'urlaub-p1'} urlaub-in-ferien`} /> Urlaub in Schulferien
      </li>
      <li>
        <span className="legende-besonders">14</span> besonderer Tag (🎂 ⭐ …)
      </li>
    </ul>
  );
}

export function Kalender({
  plan,
  onBlockOeffnen,
  onNeu,
}: {
  plan: Plan;
  onBlockOeffnen: (ids: string[]) => void;
  onNeu: (v: NeuVorlage) => void;
}) {
  const variante = aktiveVarianteVon(plan);
  const [filter, setFilter] = useState<Filter>('alle');
  const [tippsAn, setTippsAn] = useState(() => variante.startetLeer || plan.bloecke.length === 0);
  const [auchFerienTipps, setAuchFerienTipps] = useState(false);
  const [tippTag, setTippTag] = useState<string | null>(null);
  const [auswahlStart, setAuswahlStart] = useState<string | null>(null);
  const [zieh, setZieh] = useState<{ start: string; ende: string } | null>(null);
  const ziehRef = useRef<{ start: string; ende: string } | null>(null);
  const klickUnterdruecken = useRef(false);
  const rasterRef = useRef<HTMLDivElement>(null);

  // Beim Wechsel in eine "eigene Planung" die Tipps einschalten
  useEffect(() => {
    if (variante.startetLeer) setTippsAn(true);
  }, [variante.id, variante.startetLeer]);

  const jahr = plan.planungsjahr;
  const heute = heuteISO();
  const paar = istPaar(plan);
  const ctx = useMemo(() => erstelleKontext(plan), [plan]);
  const bel = useMemo(() => belegungVon(plan, variante), [plan, variante]);
  const monate = useMemo(() => monatsuebersicht(plan, variante, ctx), [plan, variante, ctx]);

  // Bereits komplett verplante Tipps ausblenden
  const tipps = useMemo(
    () => (tippsAn ? urlaubstipps(plan, ctx).filter((c) => !c.bereitsVerplant && (auchFerienTipps || !c.inFerien)) : []),
    [tippsAn, plan, ctx, auchFerienTipps],
  );
  const tippMap = useMemo(() => tippsProTag(tipps), [tipps]);

  const tage = useMemo(() => {
    const m = new Map<string, TagDaten>();
    for (let mo = 1; mo <= 12; mo++) {
      for (let t = 1; t <= tageImMonat(jahr, mo); t++) {
        const d = baue(jahr, mo, t);
        m.set(d, tagDaten(d, plan, ctx, bel, plan.besondereTage, filter, heute, tippMap.get(d)));
      }
    }
    return m;
  }, [jahr, plan, ctx, bel, filter, heute, tippMap]);

  const uebernehmen = (c: Chance) => {
    setTippTag(null);
    onNeu(vorlageAus(c, plan));
  };

  const bereich = zieh
    ? [zieh.start < zieh.ende ? zieh.start : zieh.ende, zieh.start < zieh.ende ? zieh.ende : zieh.start]
    : auswahlStart
      ? [auswahlStart, auswahlStart]
      : null;
  const istMarkiert = (d: string) => Boolean(bereich && d >= bereich[0] && d <= bereich[1]);

  const neuAus = useCallback(
    (a: string, b: string) => {
      setAuswahlStart(null);
      onNeu({ von: a < b ? a : b, bis: a < b ? b : a });
    },
    [onNeu],
  );

  // Ziehen mit der Maus (Touch nutzt Antippen von Start- und Endtag, damit Scrollen weiter funktioniert)
  useEffect(() => {
    const hoch = () => {
      const z = ziehRef.current;
      if (!z) return;
      ziehRef.current = null;
      setZieh(null);
      if (z.start !== z.ende) {
        // Das click-Event nach dem Ziehen ignorieren – es folgt synchron auf pointerup
        klickUnterdruecken.current = true;
        window.setTimeout(() => (klickUnterdruecken.current = false), 0);
        neuAus(z.start, z.ende);
      }
    };
    const abbruch = () => {
      ziehRef.current = null;
      setZieh(null);
    };
    window.addEventListener('pointerup', hoch);
    window.addEventListener('pointercancel', abbruch);
    return () => {
      window.removeEventListener('pointerup', hoch);
      window.removeEventListener('pointercancel', abbruch);
    };
  }, [neuAus]);

  useEffect(() => {
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setAuswahlStart(null);
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);

  const datumAus = (el: EventTarget | Element | null): string | null => {
    const zelle = (el as HTMLElement | null)?.closest?.('[data-datum]') as HTMLElement | null;
    return zelle?.dataset.datum ?? null;
  };

  const runter = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const d = datumAus(e.target);
    if (!d) return;
    ziehRef.current = { start: d, ende: d };
  };

  const bewegen = (e: PointerEvent) => {
    const z = ziehRef.current;
    if (!z) return;
    const d = datumAus(document.elementFromPoint(e.clientX, e.clientY));
    if (d && d !== z.ende) {
      z.ende = d;
      setZieh({ ...z });
    }
  };

  const klick = (e: MouseEvent) => {
    if (klickUnterdruecken.current) {
      klickUnterdruecken.current = false;
      return;
    }
    const d = datumAus(e.target);
    if (!d) return;
    if (auswahlStart) {
      neuAus(auswahlStart, d);
      return;
    }
    const eintrag = bel.get(d);
    const ids = new Set<string>();
    if (eintrag) {
      for (const p of ctx.personenIds) if (filter === 'alle' || filter === p) eintrag[p]?.forEach((b) => ids.add(b.id));
    }
    if (ids.size > 0) onBlockOeffnen([...ids]);
    else if (tippMap.get(d)?.length) setTippTag(d);
    else setAuswahlStart(d);
  };

  const taste = (e: KeyboardEvent) => {
    const d = datumAus(e.target);
    if (!d) return;
    const schritt = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!schritt) return;
    e.preventDefault();
    const ziel = addiereTage(d, schritt);
    rasterRef.current?.querySelector<HTMLElement>(`[data-datum="${ziel}"]`)?.focus();
  };

  const mehrereVarianten = zeigeVarianten(plan);

  return (
    <section aria-labelledby="titel-kalender" className="kalender-seite">
      <div className="seitenkopf">
        <div>
          <h1 id="titel-kalender">
            Kalender {jahr}
            {mehrereVarianten && <span className="titel-zusatz"> · Variante {variante.name}</span>}
          </h1>
          <p className="nur-drucken">
            {plan.name} · Stand: {formatDatum(heute)}
          </p>
        </div>
        <div className="aktionen nicht-drucken">
          <button
            type="button"
            role="switch"
            aria-checked={tippsAn}
            className={`schalter-gross ${tippsAn ? 'an' : ''}`}
            onClick={() => setTippsAn(!tippsAn)}
          >
            <span className="switch-spur" aria-hidden="true">
              <span className="switch-knopf" />
            </span>
            Urlaubstipps zeigen
          </button>
          {paar && (
            <Segmente<Filter>
              label="Anzeigen für"
              wert={filter}
              onChange={setFilter}
              optionen={[
                { wert: 'alle', text: 'Beide' },
                ...plan.personen.map((p) => ({ wert: p.id as Filter, text: `Nur ${p.name}` })),
              ]}
            />
          )}
          <button type="button" className="btn" onClick={() => window.print()}>
            Drucken
          </button>
        </div>
      </div>

      <div className="nicht-drucken">
        <Hilfe>
          So legst du Urlaub an: ersten Tag antippen, dann den letzten Tag antippen. Mit der Maus geht auch Ziehen. Ein
          Tipp auf einen farbigen Urlaubstag öffnet den Block.
          {variante.startetLeer && ` Variante ${variante.name} ist deine eigene Planung und startet leer.`}
        </Hilfe>
      </div>

      <Legende plan={plan} mitTipps={tippsAn} />

      {tippsAn && (
        <details className="karte tipp-panel nicht-drucken" open>
          <summary>
            <strong>💡 {tipps.length} Urlaubstipps</strong>
            <span className="unterzeile"> – die besten zuerst</span>
          </summary>
          <label className="schalter tipp-filter">
            <input type="checkbox" checked={auchFerienTipps} onChange={(e) => setAuchFerienTipps(e.target.checked)} />
            auch Tipps in den Schulferien zeigen
          </label>
          {tipps.length === 0 ? (
            <p className="unterzeile">Keine offenen Tipps – alles übernommen oder ausgefiltert.</p>
          ) : (
            <ul className="tipp-liste">
              {tipps.map((c) => (
                <TippEintrag key={c.id} c={c} plan={plan} onUebernehmen={() => uebernehmen(c)} />
              ))}
            </ul>
          )}
        </details>
      )}

      {auswahlStart && (
        <div className="hinweis hinweis-info auswahl-banner nicht-drucken" role="status">
          <span>
            Start: <strong>{formatDatumLang(auswahlStart)}</strong> – jetzt den letzten Tag antippen.
          </span>
          <span className="aktionen">
            <button type="button" className="btn btn-klein" onClick={() => neuAus(auswahlStart, auswahlStart)}>
              Nur diesen Tag
            </button>
            <button type="button" className="btn btn-klein" onClick={() => setAuswahlStart(null)}>
              Abbrechen
            </button>
          </span>
        </div>
      )}

      <div
        ref={rasterRef}
        className={`monate ${zieh ? 'zieht' : ''}`}
        onPointerDown={runter}
        onPointerMove={bewegen}
        onClick={klick}
        onKeyDown={taste}
      >
        {monate.map((z) => (
          <Monat key={z.monat} plan={plan} monat={z.monat} tage={tage} zeile={z} istMarkiert={istMarkiert} />
        ))}
      </div>

      <p className="unterzeile nur-drucken">
        Aktive Blöcke:{' '}
        {plan.bloecke
          .filter((b) => istAktiv(b, variante))
          .sort((a, b) => a.von.localeCompare(b.von))
          .map((b) => `${b.name} (${formatDatum(b.von)}–${formatDatum(b.bis)}${paar ? `, ${werText(plan, b.wer)}` : ''})`)
          .join(' · ') || '–'}
      </p>

      <Dialog offen={Boolean(tippTag)} titel="Urlaubstipps" onSchliessen={() => setTippTag(null)}>
        {tippTag && (
          <>
            <p className="unterzeile">Tipps, die {formatDatumLang(tippTag)} enthalten:</p>
            <ul className="tipp-liste">
              {(tippMap.get(tippTag) ?? []).map((c) => (
                <TippEintrag key={c.id} c={c} plan={plan} onUebernehmen={() => uebernehmen(c)} />
              ))}
            </ul>
            <div className="dialog-fuss">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setAuswahlStart(tippTag);
                  setTippTag(null);
                }}
              >
                Eigenen Zeitraum ab diesem Tag wählen
              </button>
              <button type="button" className="btn btn-primaer" onClick={() => setTippTag(null)}>
                Schließen
              </button>
            </div>
          </>
        )}
      </Dialog>
    </section>
  );
}

function TippEintrag({ c, plan, onUebernehmen }: { c: Chance; plan: Plan; onUebernehmen: () => void }) {
  return (
    <li className="tipp-eintrag">
      <div>
        <p className="tipp-formel">
          <strong>
            {utText(c, plan)} → {tageText(c.tageFrei)} frei
          </strong>
          <span className="chance-eff">{formatEffizienz(c.effizienz)}</span>
        </p>
        <p className="tipp-anlass">{c.anlass}</p>
        <p className="unterzeile">
          {formatZeitraum(c.von, c.bis)} · Urlaub: {c.urlaubstage.map((d) => formatDatumKurz(d)).join(', ')}
        </p>
      </div>
      <div className="tipp-aktionen">
        <FerienBadge ferien={c.ferien} />
        <button type="button" className="btn btn-primaer btn-klein" onClick={onUebernehmen}>
          Übernehmen
        </button>
      </div>
    </li>
  );
}
