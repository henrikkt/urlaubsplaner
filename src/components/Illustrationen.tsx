/*
 * Kleine, selbst gezeichnete Illustrationen (rein dekorativ, daher aria-hidden).
 * Bewusst ohne Verläufe/IDs, damit sie mehrfach auf einer Seite stehen können, und ohne externe Dateien (CSP).
 */

export function SonneBild({ className = '' }: { className?: string }) {
  const strahlen = Array.from({ length: 12 }, (_, i) => {
    const w = (i * Math.PI) / 6;
    const innen = 40;
    const aussen = i % 2 === 0 ? 54 : 49;
    return (
      <line
        key={i}
        x1={60 + innen * Math.cos(w)}
        y1={60 + innen * Math.sin(w)}
        x2={60 + aussen * Math.cos(w)}
        y2={60 + aussen * Math.sin(w)}
      />
    );
  });
  return (
    <svg className={`illu illu-sonne ${className}`} viewBox="0 0 120 120" width="120" height="120" aria-hidden="true" focusable="false">
      <g stroke="#FFF1BF" strokeWidth="6" strokeLinecap="round">
        {strahlen}
      </g>
      <circle cx="60" cy="60" r="31" fill="#FFE07A" stroke="#FFF6D6" strokeWidth="3" />
      <circle cx="49" cy="55" r="3.6" fill="#8A3B12" />
      <circle cx="71" cy="55" r="3.6" fill="#8A3B12" />
      <circle cx="43" cy="65" r="4.5" fill="#FF9A62" opacity="0.65" />
      <circle cx="77" cy="65" r="4.5" fill="#FF9A62" opacity="0.65" />
      <path d="M49 66q11 10 22 0" fill="none" stroke="#8A3B12" strokeWidth="3.6" strokeLinecap="round" />
      <path
        d="M14 98a11 11 0 0 1 12-12a15 15 0 0 1 28 2a10 10 0 0 1 4 19H20a8 8 0 0 1-6-9z"
        fill="#FFFFFF"
        opacity="0.92"
      />
    </svg>
  );
}

export function KofferBild({ className = '' }: { className?: string }) {
  return (
    <svg className={`illu illu-koffer ${className}`} viewBox="0 0 140 124" width="140" height="124" aria-hidden="true" focusable="false">
      <ellipse cx="70" cy="114" rx="48" ry="6" fill="#000" opacity="0.08" />
      <rect x="52" y="12" width="36" height="22" rx="9" fill="none" stroke="#8A4B2A" strokeWidth="6" />
      <rect x="20" y="28" width="100" height="78" rx="16" fill="#E8603C" />
      <rect x="38" y="28" width="11" height="78" fill="#C2410C" />
      <rect x="91" y="28" width="11" height="78" fill="#C2410C" />
      <circle cx="70" cy="58" r="13" fill="#FFE07A" />
      <path d="M64 58l4 4 8-9" fill="none" stroke="#8A3B12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="56" y="80" width="28" height="14" rx="4" fill="#7CC4E8" transform="rotate(-8 70 87)" />
      <circle cx="36" cy="109" r="5" fill="#5A3020" />
      <circle cx="104" cy="109" r="5" fill="#5A3020" />
    </svg>
  );
}

export function PalmeBild({ className = '' }: { className?: string }) {
  return (
    <svg className={`illu illu-palme ${className}`} viewBox="0 0 170 120" width="170" height="120" aria-hidden="true" focusable="false">
      <circle cx="138" cy="30" r="17" fill="#FFD166" />
      <path d="M0 104q21-9 42 0t42 0t42 0t44 0V120H0z" fill="#7CC4E8" />
      <ellipse cx="74" cy="100" rx="48" ry="11" fill="#FFD9A0" />
      <path d="M78 98c-2-22 2-44 14-62" fill="none" stroke="#A0522D" strokeWidth="7" strokeLinecap="round" />
      <g fill="#2E8B57">
        <path d="M92 36c-14-10-32-10-44 2c14-2 28 0 44-2z" />
        <path d="M92 36c4-16 18-24 34-22c-12 6-22 14-34 22z" />
        <path d="M92 36c14-6 30-2 40 10c-14-4-26-6-40-10z" />
      </g>
      <g fill="#3BA36A">
        <path d="M92 36c-10 4-20 14-22 28c8-10 14-18 22-28z" />
        <path d="M92 36c-4-12-14-22-28-24c10 8 18 16 28 24z" />
      </g>
      <circle cx="88" cy="40" r="3.5" fill="#7A4A2A" />
      <circle cx="94" cy="41" r="3.5" fill="#7A4A2A" />
    </svg>
  );
}
