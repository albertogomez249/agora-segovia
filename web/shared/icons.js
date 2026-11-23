/* Ágora iconography.
   Hand-drawn 24px line marks with a Roman vocabulary: an amphora for the table,
   an arched calendar for the agenda, a wax tablet for work, a portrait bust for
   the self, an oil lamp for the assistant, a colonnade for the numbers.
   Legibility first — a metaphor nobody reads is decoration, not an icon. */
const ICON = (() => {
  const w = (d, extra) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra || ''}>${d}</svg>`;

  return {

    /* Phase-1 leisure categories. A Roman vocabulary where one exists —
       the comic-and-tragic masks for the theatre, a laurel ball for the
       circus — and a plain legible mark where it does not. */
    ball: w(`
      <circle cx="12" cy="12" r="8.4"/>
      <path d="M12 3.6v3.1M12 17.3v3.1M3.6 12h3.1M17.3 12h3.1"/>
      <path d="M12 8.4 15.4 11l-1.3 4h-4.2L8.6 11z"/>`),

    mask: w(`
      <path d="M3.4 5.4h7.2v6.9a3.6 3.6 0 0 1-7.2 0z"/>
      <path d="M5.3 8.1h.01M8.7 8.1h.01"/>
      <path d="M13.4 5.4h7.2v6.9a3.6 3.6 0 0 1-7.2 0z"/>
      <path d="M15.3 8.1h.01M18.7 8.1h.01"/>
      <path d="M7 19.1c1.6 1.2 8.4 1.2 10 0"/>`),

    screen: w(`
      <rect x="3.4" y="4.6" width="17.2" height="11.2" rx="1.4"/>
      <path d="M7.2 19.4h9.6M12 15.8v3.6"/>
      <path d="M8.4 7.8h7.2M8.4 10.6h4.6"/>`),

    racket: w(`
      <ellipse cx="14.2" cy="9.1" rx="5.2" ry="6"/>
      <path d="M11.3 13.8 5.6 19.5"/>
      <path d="M4.2 20.9 6.9 18.2"/>
      <path d="M10.6 6.1v6M14.2 4.4v9.4M17.8 6.1v6"/>
      <path d="M9.6 7.6h9.2M9.6 10.6h9.2"/>`),

    pin: w(`
      <path d="M12 21.2s6.4-6.1 6.4-10.4A6.4 6.4 0 0 0 5.6 10.8C5.6 15.1 12 21.2 12 21.2z"/>
      <circle cx="12" cy="10.6" r="2.5"/>`),

    map: w(`
      <path d="M3.4 6.6 9 4.6v12.8l-5.6 2z"/>
      <path d="M9 4.6l6 2v12.8l-6-2z"/>
      <path d="M15 6.6l5.6-2v12.8l-5.6 2z"/>`),

    amphora: w(`
      <path d="M9.9 3.6h4.2v2.6c0 .7.4 1.1 1 1.6 1.9 1.5 3 3.5 3 5.7 0 3.4-2.7 5.8-6.1 5.8S6 17 6 13.5c0-2.2 1.1-4.2 3-5.7.6-.5 1-.9 1-1.6V3.6z"/>
      <path d="M9.4 6.6C7.3 7 6.1 8.3 6.1 9.7"/>
      <path d="M14.6 6.6c2.1.4 3.3 1.7 3.3 3.1"/>
      <path d="M10.2 19.4v1.3M13.8 19.4v1.3M8.7 20.7h6.6"/>`),

    arch: w(`
      <path d="M4.6 20.4V11a7.4 7.4 0 0 1 14.8 0v9.4z"/>
      <path d="M4.6 14.6h14.8"/>
      <path d="M9.4 17.6h.01M14.6 17.6h.01"/>`),

    tablet: w(`
      <rect x="5" y="3.6" width="14" height="16.8" rx="2.2"/>
      <path d="M8.6 8.4h6.8M8.6 12h6.8M8.6 15.6h4.4"/>`),

    bust: w(`
      <circle cx="12" cy="8.2" r="3.9"/>
      <path d="M5.6 19.4c0-3.4 2.9-5.4 6.4-5.4s6.4 2 6.4 5.4"/>
      <path d="M4.2 20.9h15.6"/>`),

    lamp: w(`
      <path d="M3.4 14.1c0-2.1 2.6-3.8 5.8-3.8s5.8 1.7 5.8 3.8-2.6 3.8-5.8 3.8-5.8-1.7-5.8-3.8z"/>
      <path d="M14.8 13.2 19.6 12"/>
      <path d="M19.6 12c1-.7 1.2-1.9.5-2.8"/>
      <path d="M3.6 12.6c-1.4-.4-2.2-1.4-1.9-2.3"/>`),

    colonnade: w(`
      <path d="M6 20V10.4M12 20V6.2M18 20v-6.6"/>
      <path d="M4.6 10.4h2.8M10.6 6.2h2.8M16.6 13.4h2.8"/>
      <path d="M3.2 20.6h17.6"/>`),

    arcade: w(`
      <path d="M3.4 19.4v-4.2a2.6 2.6 0 0 1 5.2 0v4.2"/>
      <path d="M9.4 19.4v-4.2a2.6 2.6 0 0 1 5.2 0v4.2"/>
      <path d="M15.4 19.4v-4.2a2.6 2.6 0 0 1 5.2 0v4.2"/>
      <path d="M2.6 20.8h18.8M2.6 11.4h18.8"/>`),

    seal: w(`
      <circle cx="12" cy="12" r="8.4"/>
      <path d="M8.4 12.2l2.6 2.6 4.6-5"/>`),

    scroll: w(`
      <path d="M7.6 5.2h9.6a1.8 1.8 0 0 1 0 3.6H7.6"/>
      <path d="M7.6 5.2a1.8 1.8 0 0 0 0 3.6"/>
      <path d="M7.6 18.8h9.6a1.8 1.8 0 0 0 0-3.6H7.6"/>
      <path d="M7.6 18.8a1.8 1.8 0 0 1 0-3.6"/>
      <path d="M6.4 8.8v6.4M17.6 8.8v6.4"/>`),

    back: w(`<path d="M14.6 5.4 8 12l6.6 6.6"/>`),
    close: w(`<path d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6"/>`),
    check: w(`<path d="M5 12.4l4.6 4.6L19 6.6"/>`),
    chevron: w(`<path d="M9.4 5.6 15.8 12l-6.4 6.4"/>`),
    plus: w(`<path d="M12 5.4v13.2M5.4 12h13.2"/>`),
    pause: w(`<path d="M9.4 6.4v11.2M14.6 6.4v11.2"/>`),
    play: w(`<path d="M8.4 5.8 18 12l-9.6 6.2z"/>`),
    wallet: w(`
      <rect x="3.2" y="6.4" width="17.6" height="12.2" rx="2.4"/>
      <path d="M3.2 10.4h17.6"/><path d="M16.6 14.6h1.6"/>`),
    globe: w(`
      <circle cx="12" cy="12" r="8.4"/>
      <path d="M3.6 12h16.8"/>
      <path d="M12 3.6c2.2 2.4 3.3 5.3 3.3 8.4s-1.1 6-3.3 8.4c-2.2-2.4-3.3-5.3-3.3-8.4S9.8 6 12 3.6z"/>`),
    spark: w(`
      <path d="M12 3.4l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1L5 10.4l5.1-1.9z"/>
      <path d="M18.6 16.4l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/>`),
  };
})();

/* An aqueduct arcade, drawn to the width it is given. Used as a quiet
   watermark in headers and on the pass — never as decoration for its own sake. */
function arcade(width, height, arches, opacity) {
  const w = width, h = height, n = arches || 9, gap = w / n;
  const aw = gap * 0.76, r = aw / 2, top = h - h * 0.72;
  let p = `<rect x="0" y="${(h * 0.16).toFixed(1)}" width="${w}" height="1.6" fill="currentColor"/>`;
  for (let i = 0; i < n; i++) {
    const x = i * gap + (gap - aw) / 2;
    p += `<path d="M${x.toFixed(1)},${h} L${x.toFixed(1)},${(top + r).toFixed(1)}
      A${r.toFixed(1)},${r.toFixed(1)} 0 0 1 ${(x + aw).toFixed(1)},${(top + r).toFixed(1)}
      L${(x + aw).toFixed(1)},${h}" fill="none" stroke="currentColor" stroke-width="1.6"/>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" aria-hidden="true"
    style="opacity:${opacity == null ? 0.16 : opacity}">${p}</svg>`;
}
