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
