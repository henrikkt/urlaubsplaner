import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import type { Ferien, Plan, Status, Wer } from '../lib/types';

export function StatusChip({
  name,
  status,
  onWeiter,
  deaktiviert,
}: {
  /** Name der Person; leer bei nur einer Person */
  name: string;
  status: Status;
  onWeiter?: () => void;
  deaktiviert?: boolean;
}) {
  const klasse = `chip status-${status.toLowerCase()}`;
  const wer = name ? `${name}: ` : '';
  if (!onWeiter) {
    return (
      <span className={klasse}>
        {name && <span className="chip-person">{name}</span>} {status}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={klasse}
      onClick={onWeiter}
      disabled={deaktiviert}
      title={`Status ${wer}${status} – antippen zum Weiterschalten`}
      aria-label={`Antragsstatus ${wer}${status}. Antippen schaltet zum nächsten Status.`}
    >
      {name && <span className="chip-person">{name}</span>} {status} <span aria-hidden="true">›</span>
    </button>
  );
}

export function FerienBadge({ ferien }: { ferien: Ferien[] }) {
  if (ferien.length === 0) {
    return (
      <span className="badge badge-ok" title="Keine Überschneidung mit den Schulferien">
        ✓ ferienfrei
      </span>
    );
  }
  const namen = ferien.map((f) => f.name).join(', ');
  return (
    <span className="badge badge-warn" title={`Überschneidung mit: ${namen}`}>
      ⚠ in Schulferien<span className="sr-only">: {namen}</span>
    </span>
  );
}

export function PersonPunkt({ person }: { person: Wer }) {
  return <span className={`punkt punkt-${person}`} aria-hidden="true" />;
}

/** Kurzer Hilfetext mit Info-Symbol */
export function Hilfe({ children }: { children: ReactNode }) {
  return <p className="hilfetext">{children}</p>;
}

// ---------------------------------------------------------------------------
// Farben
// ---------------------------------------------------------------------------

/** Relative Helligkeit nach WCAG */
function helligkeit(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const kanal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * kanal((n >> 16) & 255) + 0.7152 * kanal((n >> 8) & 255) + 0.0722 * kanal(n & 255);
}

/**
 * Weiße Schrift, solange sie WCAG AA für normalen Text erfüllt (≥ 4,5:1), sonst dunkle Schrift.
 * Eine der beiden Varianten erreicht bei jeder Farbe mindestens 4,5:1.
 */
export function textFarbeAuf(hex: string): string {
  const kontrastWeiss = 1.05 / (helligkeit(hex) + 0.05);
  return kontrastWeiss >= 4.5 ? '#fff' : '#111';
}

/** Kontrastverhältnis zweier Farben nach WCAG (1 … 21) */
export function kontrastVerhaeltnis(a: string, b: string): number {
  const [x, y] = [helligkeit(a), helligkeit(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** CSS-Variablen für die Personenfarben eines Plans (werden per CSSOM gesetzt – CSP-sicher) */
export function farbVariablen(plan: Plan | null): CSSProperties {
  if (!plan) return {};
  const v: Record<string, string> = {
    '--gemeinsam': plan.farbeGemeinsam,
    '--gemeinsam-text': textFarbeAuf(plan.farbeGemeinsam),
  };
  plan.personen.forEach((p, i) => {
    v[`--person-${i + 1}`] = p.farbe;
    v[`--person-${i + 1}-text`] = textFarbeAuf(p.farbe);
  });
  return v as CSSProperties;
}

// ---------------------------------------------------------------------------
// Dialog, Segmente, Icons
// ---------------------------------------------------------------------------

/** Modaler Dialog auf Basis von <dialog> (Fokusführung + Escape durch den Browser). */
export function Dialog({
  offen,
  titel,
  onSchliessen,
  children,
  breit,
}: {
  offen: boolean;
  titel: string;
  onSchliessen: () => void;
  children: ReactNode;
  breit?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (offen && !d.open) d.showModal();
    if (!offen && d.open) d.close();
  }, [offen]);
  return (
    <dialog
      ref={ref}
      className={breit ? 'dialog dialog-breit' : 'dialog'}
      onClose={onSchliessen}
      onCancel={(e) => {
        e.preventDefault();
        onSchliessen();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onSchliessen(); // Klick auf den Hintergrund
      }}
      aria-labelledby="dialog-titel"
    >
      {offen && (
        <div className="dialog-inhalt">
          <div className="dialog-kopf">
            <h2 id="dialog-titel">{titel}</h2>
            <button type="button" className="icon-btn" onClick={onSchliessen} aria-label="Dialog schließen">
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Segmente<T extends string>({
  wert,
  optionen,
  onChange,
  label,
}: {
  wert: T;
  optionen: { wert: T; text: string }[];
  onChange: (w: T) => void;
  label: string;
}) {
  return (
    <div className="segmente" role="radiogroup" aria-label={label}>
      {optionen.map((o) => (
        <button
          key={o.wert}
          type="button"
          role="radio"
          aria-checked={wert === o.wert}
          className={wert === o.wert ? 'aktiv' : ''}
          onClick={() => onChange(o.wert)}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

export type IconName =
  | 'uebersicht'
  | 'bloecke'
  | 'kalender'
  | 'brueckentage'
  | 'einstellungen'
  | 'export'
  | 'datenschutz'
  | 'hilfe'
  | 'mehr';

export function Icon({ name }: { name: IconName }) {
  const pfade: Record<IconName, ReactNode> = {
    uebersicht: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
    bloecke: (
      <>
        <path d="M8 6h13M8 12h13M8 18h13" />
        <circle cx="4" cy="6" r="1" />
        <circle cx="4" cy="12" r="1" />
        <circle cx="4" cy="18" r="1" />
      </>
    ),
    kalender: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
    brueckentage: (
      <>
        <path d="M2 18h20M4 18v-4a8 8 0 0 1 16 0v4" />
        <path d="M8 18v-3M12 18v-4M16 18v-3" />
      </>
    ),
    einstellungen: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" />
      </>
    ),
    export: (
      <>
        <path d="M12 3v12M7 10l5 5 5-5" />
        <path d="M4 17v3h16v-3" />
      </>
    ),
    datenschutz: (
      <>
        <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
    hilfe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01" />
      </>
    ),
    mehr: (
      <>
        <circle cx="5" cy="12" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {pfade[name]}
    </svg>
  );
}

export function ladeHerunter(dateiname: string, inhalt: string, typ: string) {
  const blob = new Blob([inhalt], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Dateiname-sicher: "Papa & Mama 2028" → "papa-mama-2028" */
export function dateiName(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'urlaubsplan'
  );
}
