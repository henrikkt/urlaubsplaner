import { describe, expect, it } from 'vitest';
import { testplan } from '../test/testplan';
import { erzeugeCsv, erzeugeIcs, icsFalten } from './export';
import { naechsterStatus, validiereBlock } from './plan';

describe('ICS-Export', () => {
  const ics = erzeugeIcs(testplan(), new Date(Date.UTC(2026, 10, 18, 12, 0, 0)));

  it('enthält nur aktive Blöcke (Variante A) als ganztägige Termine', () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4);
    expect(ics).toContain('DTSTART;VALUE=DATE:20270904');
    expect(ics).toContain('DTEND;VALUE=DATE:20270927'); // exklusiv
    expect(ics).not.toContain('Frühsommerreise');
    expect(ics).toContain('DTSTAMP:20261118T120000Z');
  });

  it('Titel im gewünschten Format, Namen aus dem Plan', () => {
    const entfaltet = ics.replace(/\r\n /g, '');
    expect(entfaltet).toContain('SUMMARY:Urlaub: Spätsommerreise (Person A & Person B)');
    expect(entfaltet).toContain('Status Person A: Idee\\, Status Person B: Idee');
    expect(entfaltet).toContain('X-WR-CALNAME:Testplan 2027');
  });

  it('bei einer Person nur deren Name', () => {
    const p = testplan();
    p.personen = [p.personen[0]];
    expect(erzeugeIcs(p).replace(/\r\n /g, '')).toContain('SUMMARY:Urlaub: Spätsommerreise (Person A)');
  });

  it('CRLF und gefaltete Zeilen ≤ 75 Oktette', () => {
    const enc = new TextEncoder();
    for (const z of ics.split('\r\n')) expect(enc.encode(z).length).toBeLessThanOrEqual(75);
    expect(icsFalten('x'.repeat(80))).toBe('x'.repeat(75) + '\r\n ' + 'x'.repeat(5));
  });
});

describe('CSV-Export', () => {
  it('Semikolon-getrennt mit deutschen Zahlen', () => {
    const csv = erzeugeCsv(testplan());
    const zeilen = csv.replace('﻿', '').trim().split('\r\n');
    expect(zeilen).toHaveLength(13); // Kopf + 12 Blöcke
    expect(zeilen[0]).toContain('UT Person A;UT Person B');
    expect(zeilen[1]).toContain('24.04.2027;09.05.2027;16;9;9;1,8x;ferienfrei');
  });
  it('eine Person: ohne „Wer“, eine UT-Spalte', () => {
    const p = testplan();
    p.personen = [p.personen[0]];
    const zeilen = erzeugeCsv(p).replace('﻿', '').trim().split('\r\n');
    expect(zeilen[0]).not.toContain('Wer');
    expect(zeilen[1]).toContain('24.04.2027;09.05.2027;16;9;1,8x;ferienfrei');
  });
  it('schützt vor Formeln in Excel', () => {
    const p = testplan();
    p.bloecke[0].name = '=HYPERLINK("x")';
    expect(erzeugeCsv(p)).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('Plan-Hilfen', () => {
  it('Status weiterschalten im Kreis', () => {
    expect(naechsterStatus('Idee')).toBe('Abgestimmt');
    expect(naechsterStatus('Genehmigt')).toBe('Abgelehnt');
    expect(naechsterStatus('Abgelehnt')).toBe('Idee');
  });
  it('Validierung', () => {
    expect(validiereBlock({ name: '', von: '2027-01-02', bis: '2027-01-01' })).toEqual({
      name: expect.any(String),
      zeitraum: expect.any(String),
    });
    expect(validiereBlock({ name: 'x', von: '2027-01-01', bis: '2027-01-01' })).toEqual({});
  });
});
