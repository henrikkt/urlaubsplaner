import { useEffect, useId, useMemo, useState } from 'react';
import { erstelleKontext, kennzahlenBlock, type Kontext } from '../lib/berechnung';
import { formatDatumLang, formatZeitraum } from '../lib/datum';
import { formatEffizienz, formatZahl } from '../lib/format';
import {
  aktiveVarianteVon,
  aktualisiereBlock,
  blockVarianteText,
  blockVariantenOptionen,
  dupliziereBlock,
  entferneBlock,
  hatFehler,
  istPaar,
  neuerBlock,
  validiereBlock,
  werOptionen,
} from '../lib/plan';
import { IMMER, type Plan, type Urlaubsblock, type Wer } from '../lib/types';
import { BlockEditor } from './BlockEditor';
import { Dialog, FerienBadge } from './ui';

export interface NeuVorlage {
  von: string;
  bis: string;
  name?: string;
  notiz?: string;
}

/** Standard-Variante für neue Blöcke: in einer "eigenen Planung" diese, sonst die gewählte (bzw. "Immer" bei nur einer) */
function standardVariante(plan: Plan): string {
  const v = aktiveVarianteVon(plan);
  return plan.varianten.length > 1 || v.startetLeer ? v.id : IMMER;
}

export function NeuerBlockDialog({
  vorlage,
  plan,
  onSchliessen,
  onAnlegen,
}: {
  vorlage: NeuVorlage | null;
  plan: Plan;
  onSchliessen: () => void;
  onAnlegen: (b: Urlaubsblock) => void;
}) {
  const id = useId();
  const [entwurf, setEntwurf] = useState<Urlaubsblock | null>(null);
  const [versucht, setVersucht] = useState(false);

  useEffect(() => {
    if (vorlage) {
      setEntwurf(
        neuerBlock(plan, {
          von: vorlage.von,
          bis: vorlage.bis,
          name: vorlage.name ?? '',
          notiz: vorlage.notiz ?? '',
          variante: standardVariante(plan),
        }),
      );
      setVersucht(false);
    } else {
      setEntwurf(null);
    }
    // nur bei neuer Vorlage zurücksetzen, nicht bei jeder Planänderung
  }, [vorlage]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = useMemo(() => erstelleKontext(plan), [plan]);

  return (
    <Dialog offen={Boolean(vorlage && entwurf)} titel="Neuer Urlaubsblock" onSchliessen={onSchliessen}>
      {entwurf && (
        <NeuerBlockFormular
          entwurf={entwurf}
          setEntwurf={setEntwurf}
          versucht={versucht}
          setVersucht={setVersucht}
          plan={plan}
          ctx={ctx}
          id={id}
          onSchliessen={onSchliessen}
          onAnlegen={onAnlegen}
        />
      )}
    </Dialog>
  );
}

function NeuerBlockFormular({
  entwurf,
  setEntwurf,
  versucht,
  setVersucht,
  plan,
  ctx,
  id,
  onSchliessen,
  onAnlegen,
}: {
  entwurf: Urlaubsblock;
  setEntwurf: (b: Urlaubsblock) => void;
  versucht: boolean;
  setVersucht: (v: boolean) => void;
  plan: Plan;
  ctx: Kontext;
  id: string;
  onSchliessen: () => void;
  onAnlegen: (b: Urlaubsblock) => void;
}) {
  const fehler = validiereBlock(entwurf);
  const k = kennzahlenBlock(entwurf, ctx);
  const setze = (patch: Partial<Urlaubsblock>) => setEntwurf({ ...entwurf, ...patch });
  const paar = istPaar(plan);
  const varianten = blockVariantenOptionen(plan);

  return (
    <form
      className="formular"
      onSubmit={(e) => {
        e.preventDefault();
        setVersucht(true);
        if (!hatFehler(fehler)) onAnlegen({ ...entwurf, name: entwurf.name.trim() });
      }}
      noValidate
    >
      <p className="zeitraum-gross">{formatZeitraum(entwurf.von, entwurf.bis)}</p>
      <div className="feld">
        <label htmlFor={`${id}-name`}>Anlass</label>
        <input
          id={`${id}-name`}
          autoFocus
          type="text"
          maxLength={200}
          value={entwurf.name}
          onChange={(e) => setze({ name: e.target.value })}
          aria-invalid={versucht && Boolean(fehler.name)}
          placeholder="z. B. Städtereise"
        />
        {versucht && fehler.name && <p className="fehler">{fehler.name}</p>}
      </div>
      <div className="feld-reihe">
        {paar && (
          <div className="feld">
            <label htmlFor={`${id}-wer`}>Wer</label>
            <select id={`${id}-wer`} value={entwurf.wer} onChange={(e) => setze({ wer: e.target.value as Wer })}>
              {werOptionen(plan).map((w) => (
                <option key={w.wert} value={w.wert}>
                  {w.text}
                </option>
              ))}
            </select>
          </div>
        )}
        {varianten.length > 2 && (
          <div className="feld">
            <label htmlFor={`${id}-variante`}>Variante</label>
            <select id={`${id}-variante`} value={entwurf.variante} onChange={(e) => setze({ variante: e.target.value })}>
              {varianten.map((v) => (
                <option key={v} value={v}>
                  {blockVarianteText(plan, v)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="feld">
          <label htmlFor={`${id}-von`}>Von</label>
          <input id={`${id}-von`} type="date" value={entwurf.von} onChange={(e) => setze({ von: e.target.value })} />
          <small className="hilfe">{formatDatumLang(entwurf.von)}</small>
        </div>
        <div className="feld">
          <label htmlFor={`${id}-bis`}>Bis</label>
          <input id={`${id}-bis`} type="date" value={entwurf.bis} onChange={(e) => setze({ bis: e.target.value })} />
          <small className="hilfe">{formatDatumLang(entwurf.bis)}</small>
        </div>
      </div>
      {fehler.zeitraum && <p className="fehler">{fehler.zeitraum}</p>}
      <p className="vorschau">
        {formatZahl(k.tageFrei)} Tage frei ·{' '}
        {plan.personen.map((p) => `${paar ? `${p.name} ` : ''}${formatZahl(k.ut[p.id] ?? 0)} Urlaubstage`).join(' · ')} ·{' '}
        {formatEffizienz(k.effizienz)} <FerienBadge ferien={k.ferien} />
      </p>
      <div className="dialog-fuss">
        <button type="button" className="btn" onClick={onSchliessen}>
          Abbrechen
        </button>
        <button type="submit" className="btn btn-primaer">
          Block anlegen
        </button>
      </div>
    </form>
  );
}

export function BlockBearbeitenDialog({
  ids,
  plan,
  aendere,
  onSchliessen,
}: {
  ids: string[] | null;
  plan: Plan;
  aendere: (fn: (p: Plan) => Plan) => void;
  onSchliessen: () => void;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [ids]);
  const ctx = useMemo(() => erstelleKontext(plan), [plan]);
  const bloecke = (ids ?? []).map((id) => plan.bloecke.find((b) => b.id === id)).filter(Boolean) as Urlaubsblock[];
  const block = bloecke[Math.min(index, bloecke.length - 1)];
  const offen = Boolean(ids && block);

  return (
    <Dialog offen={offen} titel="Urlaubsblock bearbeiten" onSchliessen={onSchliessen} breit>
      {block && (
        <>
          {bloecke.length > 1 && (
            <div className="tabs" role="tablist" aria-label="Blöcke an diesem Tag">
              {bloecke.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  className={i === index ? 'aktiv' : ''}
                  onClick={() => setIndex(i)}
                >
                  {b.name || 'Ohne Namen'}
                </button>
              ))}
            </div>
          )}
          <BlockEditor
            block={block}
            plan={plan}
            ctx={ctx}
            onChange={(patch) => aendere((p) => aktualisiereBlock(p, block.id, patch))}
          />
          <div className="dialog-fuss">
            <button
              type="button"
              className="btn btn-gefahr"
              onClick={() => {
                if (window.confirm(`Block „${block.name || 'ohne Namen'}“ wirklich löschen?`)) {
                  aendere((p) => entferneBlock(p, block.id));
                  onSchliessen();
                }
              }}
            >
              Löschen
            </button>
            <button type="button" className="btn" onClick={() => aendere((p) => dupliziereBlock(p, block.id))}>
              Duplizieren
            </button>
            <span className="spacer" />
            <button type="button" className="btn btn-primaer" onClick={onSchliessen}>
              Fertig
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
