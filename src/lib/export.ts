import { addiereTage, formatDatum, istGueltigesDatum } from './datum';
import { erstelleKontext, istAktiv, kennzahlenBlock, personStatus } from './berechnung';
import { formatEffizienz, formatZahl } from './format';
import { aktiveVarianteVon, istPaar, varianteName, werText, zeigeVarianten } from './plan';
import type { Plan, Urlaubsblock } from './types';

// ---------------------------------------------------------------------------
// iCalendar (.ics) – ganztägige Termine aller aktiven Blöcke
// ---------------------------------------------------------------------------

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Zeilen nach RFC 5545 auf max. 75 Oktette falten (UTF-8-sicher). */
export function icsFalten(zeile: string): string {
  const enc = new TextEncoder();
  if (enc.encode(zeile).length <= 75) return zeile;
  const teile: string[] = [];
  let aktuell = '';
  let bytes = 0;
  let grenze = 75;
  for (const zeichen of zeile) {
    const b = enc.encode(zeichen).length;
    if (bytes + b > grenze) {
      teile.push(aktuell);
      aktuell = '';
      bytes = 0;
      grenze = 74; // Folgezeilen beginnen mit einem Leerzeichen
    }
    aktuell += zeichen;
    bytes += b;
  }
  teile.push(aktuell);
  return teile.join('\r\n ');
}

function icsDatum(d: string): string {
  return d.replace(/-/g, '');
}

function icsZeitstempel(jetzt: Date): string {
  return jetzt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function icsTitel(plan: Plan, b: Urlaubsblock): string {
  return `Urlaub: ${b.name.trim() || 'Ohne Namen'} (${werText(plan, b.wer)})`;
}

export function aktiveBloecke(plan: Plan): Urlaubsblock[] {
  const v = aktiveVarianteVon(plan);
  return plan.bloecke
    .filter((b) => istAktiv(b, v) && istGueltigesDatum(b.von) && istGueltigesDatum(b.bis) && b.von <= b.bis)
    .sort((x, y) => x.von.localeCompare(y.von));
}

export function erzeugeIcs(plan: Plan, jetzt: Date = new Date()): string {
  const stempel = icsZeitstempel(jetzt);
  const zeilen: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Urlaubsplaner//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(plan.name)}`,
  ];
  for (const b of aktiveBloecke(plan)) {
    const status = plan.personen.map((p) => `Status ${p.name}: ${personStatus(b, p.id)}`).join(', ');
    const variante = zeigeVarianten(plan) ? `Variante: ${varianteName(plan, b.variante)}` : '';
    const beschreibung = [b.notiz.trim(), variante, status].filter(Boolean).join('\n');
    zeilen.push(
      'BEGIN:VEVENT',
      `UID:${b.id}-${plan.planungsjahr}@urlaubsplaner.local`,
      `DTSTAMP:${stempel}`,
      `DTSTART;VALUE=DATE:${icsDatum(b.von)}`,
      // DTEND ist bei ganztägigen Terminen exklusiv → Tag nach "bis"
      `DTEND;VALUE=DATE:${icsDatum(addiereTage(b.bis, 1))}`,
      `SUMMARY:${icsEscape(icsTitel(plan, b))}`,
      `DESCRIPTION:${icsEscape(beschreibung)}`,
      'TRANSP:OPAQUE',
      'X-MICROSOFT-CDO-BUSYSTATUS:OOF',
      'X-MICROSOFT-CDO-ALLDAYEVENT:TRUE',
      'END:VEVENT',
    );
  }
  zeilen.push('END:VCALENDAR');
  return zeilen.map(icsFalten).join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// CSV für Excel (Semikolon, UTF-8 mit BOM, deutsche Zahlen)
// ---------------------------------------------------------------------------

function csvFeld(s: string): string {
  // Formel-Injektion in Excel verhindern (=, +, -, @ am Anfang)
  const sicher = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[;"\r\n]/.test(sicher) ? `"${sicher.replace(/"/g, '""')}"` : sicher;
}

export function erzeugeCsv(plan: Plan): string {
  const ctx = erstelleKontext(plan);
  const v = aktiveVarianteVon(plan);
  const paar = istPaar(plan);
  const mitVarianten = zeigeVarianten(plan);
  const kopf = [
    'Anlass',
    ...(mitVarianten ? ['Variante'] : []),
    mitVarianten ? 'Aktiv' : 'Zählt mit',
    ...(paar ? ['Wer'] : []),
    'Von',
    'Bis',
    'Tage frei',
    ...plan.personen.map((p) => (paar ? `UT ${p.name}` : 'Urlaubstage')),
    'Effizienz',
    'Schulferien',
    ...plan.personen.map((p) => (paar ? `Status ${p.name}` : 'Status')),
    'Notiz',
  ];
  const zeilen = plan.bloecke.map((b) => {
    const k = kennzahlenBlock(b, ctx);
    return [
      b.name,
      ...(mitVarianten ? [varianteName(plan, b.variante)] : []),
      istAktiv(b, v) ? 'ja' : mitVarianten ? 'nein' : 'geparkt',
      ...(paar ? [werText(plan, b.wer)] : []),
      formatDatum(b.von),
      formatDatum(b.bis),
      formatZahl(k.tageFrei),
      ...plan.personen.map((p) => formatZahl(k.ut[p.id] ?? 0)),
      formatEffizienz(k.effizienz),
      k.inFerien ? `in Ferien (${k.ferien.map((f) => f.name).join(', ')})` : 'ferienfrei',
      ...plan.personen.map((p) => personStatus(b, p.id)),
      b.notiz,
    ];
  });
  return '\uFEFF' + [kopf, ...zeilen].map((z) => z.map(csvFeld).join(';')).join('\r\n') + '\r\n';
}
