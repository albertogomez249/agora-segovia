/* ============================================================================
   Generated artwork.
   Every venue and every event gets its own plate, drawn from its name. No stock
   photography, no placeholder grey: six Roman masonry and mosaic patterns in six
   duotone palettes, picked deterministically, so a place always looks like
   itself and the list has real visual texture.
   ========================================================================== */

function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

const PALETTES = [
  { bg: '#1F242A', fg: '#C19A68', tint: '#9C7246' },   /* bronze on basalt   */
  { bg: '#EFE7D9', fg: '#8E3B22', tint: '#C8481F' },   /* oxblood on lime    */
  { bg: '#2B3A33', fg: '#A8C4AE', tint: '#4A6B55' },   /* verdigris on slate */
  { bg: '#E7DFCE', fg: '#2B323A', tint: '#4A535E' },   /* ink on travertine  */
  { bg: '#3A2A22', fg: '#E0A878', tint: '#C8793F' },   /* terracotta on umber*/
  { bg: '#D9CFBA', fg: '#6B5636', tint: '#9C7246' },   /* ochre on sand      */
];

/* --- the six patterns, each drawn to fill a 100×64 tile ------------------- */
const PATTERNS = [
  /* opus reticulatum — the diagonal net the Romans laid their walls in */
  (p) => {
    let d = '';
    for (let i = -8; i < 16; i++) {
      d += `<path d="M${i * 9},0 L${i * 9 + 64},64" stroke="${p.fg}" stroke-width="1.1" opacity=".55"/>`;
      d += `<path d="M${i * 9},64 L${i * 9 + 64},0" stroke="${p.fg}" stroke-width="1.1" opacity=".55"/>`;
    }
    return d;
  },
  /* arcade — the aqueduct, close up */
  (p) => {
    let d = `<rect x="0" y="16" width="100" height="2.4" fill="${p.fg}" opacity=".85"/>`;
    for (let i = 0; i < 5; i++) {
      const x = i * 21 + 2, w = 16, r = w / 2;
      d += `<path d="M${x},64 L${x},${30 + r} A${r},${r} 0 0 1 ${x + w},${30 + r} L${x + w},64"
             fill="none" stroke="${p.fg}" stroke-width="2.2" opacity=".8"/>`;
    }
    return d;
  },
  /* meander — the Greek key border Rome borrowed and never gave back */
  (p) => {
    let d = '';
    for (let i = 0; i < 6; i++) {
      const x = i * 18;
      d += `<path d="M${x + 2},54 v-32 h14 v24 h-8 v-16 h3" fill="none"
             stroke="${p.fg}" stroke-width="2.4" opacity=".75"/>`;
    }
    return d;
  },
  /* tesserae — mosaic chips, laid slightly loose by hand */
  (p) => {
    let d = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 13; x++) {
      const o = ((x * 7 + y * 13) % 5) / 9 + .22;
      const c = (x + y) % 3 === 0 ? p.tint : p.fg;
      d += `<rect x="${x * 8 + (y % 2) * 2}" y="${y * 8.2}" width="6" height="6"
             rx="1" fill="${c}" opacity="${o.toFixed(2)}"/>`;
    }
    return d;
  },
  /* fluting — the channels cut down a column */
  (p) => {
    let d = '';
    for (let i = 0; i < 11; i++) {
      const x = i * 9.4 + 3;
      d += `<path d="M${x},64 L${x},10 a3,3 0 0 1 6,0 L${x + 6},64" fill="none"
             stroke="${p.fg}" stroke-width="1.5" opacity=".6"/>`;
    }
    return d;
  },
  /* rosette — the ceiling coffer */
  (p) => {
    let d = '';
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      d += `<path d="M50,32 L${(50 + Math.cos(a) * 46).toFixed(1)},${(32 + Math.sin(a) * 30).toFixed(1)}"
             stroke="${p.fg}" stroke-width="1.4" opacity=".5"/>`;
    }
    d += `<circle cx="50" cy="32" r="13" fill="none" stroke="${p.fg}" stroke-width="2" opacity=".8"/>`;
    d += `<circle cx="50" cy="32" r="5" fill="${p.tint}" opacity=".9"/>`;
    return d;
  },
];

/* A plate for a name. `seedExtra` lets two things at the same venue differ. */
function plate(name, seedExtra) {
  const h = hash32((name || 'Ágora') + (seedExtra || ''));
  const p = PALETTES[h % PALETTES.length];
  const pat = PATTERNS[(h >> 3) % PATTERNS.length];
  return `<svg viewBox="0 0 100 64" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
    style="width:100%;height:100%;display:block">
    <rect width="100" height="64" fill="${p.bg}"/>
    ${pat(p)}
    <rect width="100" height="64" fill="url(#plateFade)" opacity=".28"/>
  </svg>`;
}

/* One shared gradient definition, injected once. */
function plateDefs() {
  return `<svg width="0" height="0" style="position:absolute"><defs>
    <linearGradient id="plateFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".55"/>
    </linearGradient></defs></svg>`;
}

/* The initial, set in the Roman capital, over the venue's own pattern. */
function monogram(name) {
  const h = hash32(name || 'A');
  const p = PALETTES[h % PALETTES.length];
  const raw = (name || 'A').replace(/^(the|bar|caf\u00e9|cafe|el|la|los|las)\s+/i, '').trim();
  const letter = (raw[0] || 'A').toUpperCase();
  return `<svg viewBox="0 0 100 64" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
    style="width:100%;height:100%;display:block">
    <rect width="100" height="64" fill="${p.bg}"/>
    <g opacity=".3">${PATTERNS[(h >> 3) % PATTERNS.length](p)}</g>
    <text x="50" y="43" text-anchor="middle" font-family="Marcellus,Georgia,serif"
      font-size="34" fill="${p.fg}">${letter}</text>
  </svg>`;
}
