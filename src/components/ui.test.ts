import { describe, expect, it } from 'vitest';
import { STANDARD_FARBEN } from '../lib/types';
import { dateiName, textFarbeAuf } from './ui';

describe('Textfarbe auf Personenfarben', () => {
  it('Standardfarben behalten weiße Schrift (bisheriges Design)', () => {
    expect(textFarbeAuf(STANDARD_FARBEN.p1)).toBe('#fff');
    expect(textFarbeAuf(STANDARD_FARBEN.p2)).toBe('#fff');
    expect(textFarbeAuf(STANDARD_FARBEN.gemeinsam)).toBe('#fff');
  });
  it('mittlere Farben, die mit Weiß unter 4,5:1 liegen, bekommen dunkle Schrift (AA)', () => {
    expect(textFarbeAuf('#3B7DD8')).toBe('#111'); // frühere Standardfarbe: Weiß nur 4,0:1
  });
  it('helle Farben bekommen dunkle Schrift', () => {
    expect(textFarbeAuf('#FFE066')).toBe('#111');
    expect(textFarbeAuf('#ffffff')).toBe('#111');
  });
});

describe('Dateinamen', () => {
  it('ohne Umlaute und Sonderzeichen', () => {
    expect(dateiName('Papa & Mama 2028')).toBe('papa-mama-2028');
    expect(dateiName('Größte Ü-Reise')).toBe('groesste-ue-reise');
    expect(dateiName('!!!')).toBe('urlaubsplan');
  });
});
