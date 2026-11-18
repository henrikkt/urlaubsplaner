import { useId } from 'react';
import { kennzahlenBlock, personStatus, type Kontext } from '../lib/berechnung';
import { formatDatumLang } from '../lib/datum';
import { formatEffizienz, formatZahl } from '../lib/format';
import {
  blockVarianteText,
  blockVariantenOptionen,
  istPaar,
  naechsterStatus,
  validiereBlock,
  werOptionen,
  zeigeVarianten,
} from '../lib/plan';
import { AUS, IMMER, type Plan, type Urlaubsblock, type Wer } from '../lib/types';
import { FerienBadge, StatusChip } from './ui';

export function Kennzahlen({ block, ctx, plan }: { block: Urlaubsblock; ctx: Kontext; plan: Plan }) {
  const k = kennzahlenBlock(block, ctx);
  const paar = istPaar(plan);
  return (
    <dl className="kennzahlen">
      <div>
        <dt>Tage frei</dt>
        <dd>{formatZahl(k.tageFrei)}</dd>
      </div>
      {plan.personen.map((p) => (
        <div key={p.id}>
          <dt>{paar ? `Urlaubstage ${p.name}` : 'Urlaubstage'}</dt>
          <dd>{formatZahl(k.ut[p.id] ?? 0)}</dd>
        </div>
      ))}
      <div>
        <dt>Effizienz</dt>
        <dd>{formatEffizienz(k.effizienz)}</dd>
      </div>
      <div className="kennzahl-ferien">
        <dt className="sr-only">Schulferien</dt>
        <dd>
          <FerienBadge ferien={k.ferien} />
        </dd>
      </div>
    </dl>
  );
}

export function BlockEditor({
  block,
  plan,
  ctx,
  onChange,
}: {
  block: Urlaubsblock;
  plan: Plan;
  ctx: Kontext;
  onChange: (patch: Partial<Urlaubsblock>) => void;
}) {
  const id = useId();
  const fehler = validiereBlock(block);
  const paar = istPaar(plan);
  const varianten = blockVariantenOptionen(plan);
  return (
    <div className="block-editor">
      <div className="editor-oben">
        <div className="feld feld-name">
          <label htmlFor={`${id}-name`}>Anlass</label>
          <input
            id={`${id}-name`}
            type="text"
            value={block.name}
            maxLength={200}
            onChange={(e) => onChange({ name: e.target.value })}
            aria-invalid={Boolean(fehler.name)}
            aria-describedby={fehler.name ? `${id}-name-fehler` : undefined}
            placeholder="z. B. Sommerurlaub"
          />
          {fehler.name && (
            <p className="fehler" id={`${id}-name-fehler`}>
              {fehler.name}
            </p>
          )}
        </div>
        {zeigeVarianten(plan) ? (
          <div className="feld">
            <label htmlFor={`${id}-variante`}>Variante</label>
            <select id={`${id}-variante`} value={block.variante} onChange={(e) => onChange({ variante: e.target.value })}>
              {[...new Set([...varianten, block.variante])].map((v) => (
                <option key={v} value={v}>
                  {blockVarianteText(plan, v)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="feld">
            <label htmlFor={`${id}-variante`}>Zählt mit?</label>
            <select
              id={`${id}-variante`}
              value={block.variante === AUS ? AUS : IMMER}
              onChange={(e) => onChange({ variante: e.target.value })}
            >
              <option value={IMMER}>Ja, zählt mit</option>
              <option value={AUS}>Nein, geparkt</option>
            </select>
          </div>
        )}
        {paar && (
          <div className="feld">
            <label htmlFor={`${id}-wer`}>Wer</label>
            <select id={`${id}-wer`} value={block.wer} onChange={(e) => onChange({ wer: e.target.value as Wer })}>
              {werOptionen(plan).map((w) => (
                <option key={w.wert} value={w.wert}>
                  {w.text}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="feld">
          <label htmlFor={`${id}-von`}>Von</label>
          <input
            id={`${id}-von`}
            type="date"
            value={block.von}
            onChange={(e) => onChange({ von: e.target.value })}
            aria-invalid={Boolean(fehler.zeitraum)}
            aria-describedby={`${id}-von-text`}
          />
          <small id={`${id}-von-text`} className="hilfe">
            {formatDatumLang(block.von)}
          </small>
        </div>
        <div className="feld">
          <label htmlFor={`${id}-bis`}>Bis</label>
          <input
            id={`${id}-bis`}
            type="date"
            value={block.bis}
            min={block.von || undefined}
            onChange={(e) => onChange({ bis: e.target.value })}
            aria-invalid={Boolean(fehler.zeitraum)}
            aria-describedby={`${id}-bis-text`}
          />
          <small id={`${id}-bis-text`} className="hilfe">
            {formatDatumLang(block.bis)}
          </small>
        </div>
      </div>
      {fehler.zeitraum && (
        <p className="fehler" role="alert">
          {fehler.zeitraum}
        </p>
      )}
      <div className="editor-mitte">
        <Kennzahlen block={block} ctx={ctx} plan={plan} />
        <div className="status-reihe" role="group" aria-label="Antragsstatus">
          {plan.personen.map((p) => (
            <StatusChip
              key={p.id}
              name={paar ? p.name : ''}
              status={personStatus(block, p.id)}
              onWeiter={() => onChange({ status: { ...block.status, [p.id]: naechsterStatus(personStatus(block, p.id)) } })}
              deaktiviert={block.wer !== 'alle' && block.wer !== p.id}
            />
          ))}
        </div>
      </div>
      <div className="feld">
        <label htmlFor={`${id}-notiz`}>Notiz</label>
        <textarea
          id={`${id}-notiz`}
          rows={1}
          maxLength={2000}
          value={block.notiz}
          onChange={(e) => onChange({ notiz: e.target.value })}
        />
      </div>
    </div>
  );
}
