/** Zahl im deutschen Format: 5 → "5", 5.5 → "5,5", 1.7667 → "1,77" (max. Nachkommastellen). */
export function formatZahl(n: number, maxNachkomma = 1): string {
  if (!Number.isFinite(n)) return '–';
  return n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: maxNachkomma });
}

/** Effizienz "1,8x" bzw. "–" wenn nicht berechenbar. */
export function formatEffizienz(e: number | null, nachkomma = 1): string {
  if (e === null || !Number.isFinite(e)) return '–';
  return `${e.toLocaleString('de-DE', { minimumFractionDigits: nachkomma, maximumFractionDigits: nachkomma })}x`;
}

/** "1 Tag" / "5 Tage" */
export function tageText(n: number): string {
  return `${formatZahl(n)} ${n === 1 ? 'Tag' : 'Tage'}`;
}

/**
 * Effizienz in Alltagssprache: 2 → „1 Urlaubstag = 2 freie Tage“, 1,71 → „1 Urlaubstag ≈ 1,7 freie Tage“.
 * null (kein Urlaubstag nötig) → „ohne Urlaubstag“.
 */
export function effizienzText(e: number | null): string {
  if (e === null || !Number.isFinite(e)) return 'ohne Urlaubstag';
  const gerundet = Math.round(e * 10) / 10;
  const genau = Math.abs(e - gerundet) < 1e-9;
  return `1 Urlaubstag ${genau ? '=' : '≈'} ${formatZahl(gerundet)} ${gerundet === 1 ? 'freier Tag' : 'freie Tage'}`;
}

/** Kurzform „4 freie Tage“ (z. B. unter der Überschrift „Pro Urlaubstag“) */
export function effizienzKurz(e: number | null): string {
  if (e === null || !Number.isFinite(e)) return '–';
  const g = Math.round(e * 10) / 10;
  return `${formatZahl(g)} ${g === 1 ? 'freier Tag' : 'freie Tage'}`;
}

/** Freundliche Einordnung statt „4,0x“: „Top-Tipp“ ab 3 freien Tagen je Urlaubstag, „Sehr gut“ ab 2 */
export function effizienzBewertung(e: number | null): 'Top-Tipp' | 'Sehr gut' | null {
  if (e === null || !Number.isFinite(e)) return null;
  if (e >= 3) return 'Top-Tipp';
  if (e >= 2) return 'Sehr gut';
  return null;
}
