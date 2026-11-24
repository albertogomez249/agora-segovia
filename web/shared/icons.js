/* Ágora iconography.

   A Roman vocabulary drawn to one grid: an amphora for the table, an arched
   calendar for the agenda, a wax tablet for work, a portrait bust for the self,
   an oil lamp for the assistant, a colonnade for the numbers.

   THE RULES. Every mark here obeys them; breaking one is how a set stops
   looking like a set.

   1. 24×24 box, 20×20 live area. Nothing touches the edge: the 2px margin is
      what keeps an icon from looking bigger than its neighbour.
   2. One optical weight. Not one stroke width — one *perceived* weight. A mark
      with six strokes reads heavier than a mark with two at the same width, so
      the dense ones (colonnade, racket) carry fewer lines than the subject
      really has. An icon is a word, not a drawing.
   3. `vector-effect: non-scaling-stroke`. These are used from 11px on a map pin
      to 23px in the tab bar. Without it the stroke scales with the box and the
      small sizes go to ghost — at 11px a 1.5 stroke renders at 0.69px. With it,
      stroke-width is in screen pixels and the CSS sets it per context.
   4. Nothing thinner than a 2px gap at nominal size, and no counter under
      2.5px. Anything finer fills in and turns to mud when it is shrunk.
   5. Round caps and joins, always. A square terminal among round ones is the
      kind of detail nobody names and everybody feels.
   6. Optical centring over geometric centring. The bust and the amphora sit a
      half pixel high because their mass is at the bottom.

   Legibility first — a metaphor nobody reads is decoration, not an icon. */
const ICON = (() => {
  const w = (d, extra) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
      stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"
      aria-hidden="true" ${extra || ''}>${d}</svg>`;

  return {
    /* ---------------------------------------------------------- navigation */

    /* A folded map, three panels. The old one drew the fold lines as well as
       the panel edges and closed up at 11px; the panels alone say "map". */
    map: w(`
      <path d="M3.4 6.8 9 4.7v12.5l-5.6 2.1z"/>
      <path d="M9 4.7l6 2.1v12.5l-6-2.1z"/>
      <path d="M15 6.8l5.6-2.1v12.5L15 19.3z"/>`),

    /* The table. Mass at the bottom, so it sits a touch high. */
    amphora: w(`
      <path d="M9.9 3.8h4.2v2.4c0 .7.4 1.1 1 1.5 1.8 1.5 2.9 3.4 2.9 5.5 0 3.3-2.6 5.6-6 5.6s-6-2.3-6-5.6c0-2.1 1.1-4 2.9-5.5.6-.4 1-.8 1-1.5z"/>
      <path d="M9.4 6.7C7.5 7.1 6.4 8.3 6.4 9.6"/>
      <path d="M14.6 6.7c1.9.4 3 1.6 3 2.9"/>
      <path d="M10.3 19.1v1.2M13.7 19.1v1.2M8.8 20.3h6.4"/>`),

    /* The agenda: an arch with a springing line and two voussoir marks. */
    arch: w(`
      <path d="M5.2 20.3V11.1a6.8 6.8 0 0 1 13.6 0v9.2"/>
      <path d="M8.9 20.3v-9.2a3.1 3.1 0 0 1 6.2 0v9.2"/>
      <path d="M3.4 20.3h17.2"/>`),

    /* Work: a wax tablet. Three rules, the last short, so it reads as text. */
    tablet: w(`
      <rect x="5.2" y="3.8" width="13.6" height="16.4" rx="2.2"/>
      <path d="M8.6 8.6h6.8M8.6 12h6.8M8.6 15.4h4.2"/>`),

    /* The self. Shoulders wider than the head by a clear margin, or at 11px
       the two merge into a thumbprint. */
    bust: w(`
      <circle cx="12" cy="8" r="3.7"/>
      <path d="M5.8 19.2c0-3.3 2.8-5.3 6.2-5.3s6.2 2 6.2 5.3"/>
      <path d="M4.4 20.7h15.2"/>`),

    /* The numbers. Three columns, not five: the subject has more, the icon
       cannot. Entablature and stylobate carry the rest of the meaning. */
    colonnade: w(`
      <path d="M3.6 6.4h16.8"/>
      <path d="M4.6 20.1h14.8"/>
      <path d="M7.4 6.4v13.7M12 6.4v13.7M16.6 6.4v13.7"/>`),

    /* --------------------------------------------------- leisure categories */

    /* Football. A ball reads as a ball by the pentagon at its centre; the
       old one had four radial ticks that closed up and looked like a clock. */
    ball: w(`
      <circle cx="12" cy="12" r="8.3"/>
      <path d="M12 7.9l3.9 2.8-1.5 4.6H9.6l-1.5-4.6z"/>
      <path d="M12 7.9V3.7M15.9 10.7l4-1.3M14.4 15.3l2.5 3.4M9.6 15.3l-2.5 3.4M8.1 10.7l-4-1.3"/>`),

    /* Theatre. The two masks, comic and tragic. Mouths only — eyes at this
       size are two dots that read as noise, and the mouths carry the mood. */
    mask: w(`
      <path d="M3.6 5.6h7v6.6a3.5 3.5 0 0 1-7 0z"/>
      <path d="M5.4 9.4c.9.8 2.3.8 3.2 0"/>
      <path d="M13.4 5.6h7v6.6a3.5 3.5 0 0 1-7 0z"/>
      <path d="M15.2 10.2c.9-.8 2.3-.8 3.2 0"/>
      <path d="M7.4 18.4c2.6 1.4 6.6 1.4 9.2 0"/>`),

    /* Cinema. A screen on a stand, with the beam of light as two rules. */
    screen: w(`
      <rect x="3.6" y="4.6" width="16.8" height="11" rx="1.6"/>
      <path d="M8.2 19.4h7.6M12 15.6v3.8"/>
      <path d="M8.4 8.2h7.2M8.4 11.4h4.4"/>`),

    /* Play together. A racket: the head, the throat, the handle, and two
       strings each way. The real thing has sixteen; two is what survives. */
    racket: w(`
      <path d="M12 2.9c3.9 0 6.6 3 6.6 7 0 3.3-2.1 5.9-4.3 7.2-.9.5-1.5 1-1.5 1.8v.6h-1.6v-.6c0-.8-.6-1.3-1.5-1.8-2.2-1.3-4.3-3.9-4.3-7.2 0-4 2.7-7 6.6-7z"/>
      <path d="M10.4 19.5h3.2v1.6h-3.2z"/>
      <path d="M9.9 8.1h.01M14.1 8.1h.01M12 11.4h.01M9.9 14.3h.01M14.1 14.3h.01"/>`),

    /* A pin, for a place. */
    pin: w(`
      <path d="M12 21.1c0 0 6.2-6 6.2-10.2a6.2 6.2 0 1 0-12.4 0C5.8 15.1 12 21.1 12 21.1z"/>
      <circle cx="12" cy="10.7" r="2.4"/>`),

    /* ------------------------------------------------------------- objects */

    /* The assistant: an oil lamp. */
    lamp: w(`
      <path d="M12 3.2c2.2 2.3 3.3 4 3.3 5.4a3.3 3.3 0 0 1-6.6 0c0-1.4 1.1-3.1 3.3-5.4z"/>
      <path d="M5.4 16.3c0-1.7 2.1-3 4.8-3h3.6c2.7 0 4.8 1.3 4.8 3 0 1.6-1.4 2.7-3.4 2.7H8.8c-2 0-3.4-1.1-3.4-2.7z"/>
      <path d="M18.6 15.4l2.6-.6"/>`),

    /* A seal, for what is granted or earned. */
    seal: w(`
      <circle cx="12" cy="10.2" r="6.2"/>
      <path d="M9.4 10.4l1.8 1.8 3.4-3.6"/>
      <path d="M8.9 15.8l-1 5 4.1-2.1 4.1 2.1-1-5"/>`),

    /* A scroll, for what is written. */
    scroll: w(`
      <path d="M7.6 4.4h9.6a2.4 2.4 0 0 1 0 4.8h-2.4"/>
      <path d="M7.6 4.4a2.4 2.4 0 0 0 0 4.8h2.4"/>
      <path d="M10 9.2v10.4h7.2a2.4 2.4 0 0 0 0-4.8"/>
      <path d="M10 19.6H6.8a2.4 2.4 0 0 1 0-4.8h3.2"/>`),

    /* The arcade: the aqueduct, three bays. */
    arcade: w(`
      <path d="M2.4 5.6h19.2"/>
      <path d="M4.3 20.4v-8.8a2.6 2.6 0 0 1 5.2 0v8.8"/>
      <path d="M9.5 20.4v-8.8a2.6 2.6 0 0 1 5.2 0v8.8"/>
      <path d="M14.7 20.4v-8.8a2.6 2.6 0 0 1 5.2 0v8.8"/>
      <path d="M3.2 8.6h17.6"/>`),

    /* The wallet. */
    wallet: w(`
      <path d="M3.8 8.2a2 2 0 0 1 2-2h12.4a2 2 0 0 1 2 2v9.6a2 2 0 0 1-2 2H5.8a2 2 0 0 1-2-2z"/>
      <path d="M3.8 10.4h4.6a2 2 0 0 1 0 4H3.8"/>`),

    /* The globe: two languages. */
    globe: w(`
      <circle cx="12" cy="12" r="8.3"/>
      <path d="M3.7 12h16.6"/>
      <path d="M12 3.7c2.1 2.3 3.2 5.2 3.2 8.3s-1.1 6-3.2 8.3c-2.1-2.3-3.2-5.2-3.2-8.3S9.9 6 12 3.7z"/>`),

    /* A spark: what is live right now. */
    spark: w(`
      <path d="M12 3.4l1.9 5.1 5.1 1.9-5.1 1.9L12 17.4l-1.9-5.1L5 10.4l5.1-1.9z"/>
      <path d="M18.4 16.6l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>`),

    /* A clock, for a window of time. */
    clock: w(`
      <circle cx="12" cy="12" r="8.3"/>
      <path d="M12 7.2V12l3.2 2"/>`),

    /* --------------------------------------------------------------- chrome
       The interface marks. These are held to the same grid, but they are
       geometric where the pictograms are drawn — a chevron is a chevron. */

    back:    w(`<path d="M15 5.6 8.4 12l6.6 6.4"/>`),
    chevron: w(`<path d="M9 5.6 15.6 12 9 18.4"/>`),
    close:   w(`<path d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6"/>`),
    check:   w(`<path d="M4.8 12.6 9.6 17.4 19.2 7"/>`),
    plus:    w(`<path d="M12 5.2v13.6M5.2 12h13.6"/>`),
    pause:   w(`<path d="M9.4 5.6v12.8M14.6 5.6v12.8"/>`),
    play:    w(`<path d="M7.8 5.4 18.2 12 7.8 18.6z"/>`),
  };
})();

/* An aqueduct arcade, drawn to the width it is given. Used as a quiet
   watermark in headers and on the pass — never as decoration for its own sake.
   Not an icon: it is a rule of the brand that happens to live beside them. */
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

/* A rating, drawn rather than typed. Everything else in this product is a mark
   we cut ourselves; the ratings were U+2605 and U+2606, which is to say they
   were whatever font happened to answer — different weight, different optical
   size and different vertical centring on every platform, in the one place a
   student's judgement of a venue is shown.
   Not an outline for the unearned half: a five-pointed star at 13px has
   counters under a pixel wide and an outlined one fills in to a blob. The
   earned stars are solid and the rest are the same solid star held back, which
   is legible at any size and keeps one shape on the row.
   Not an icon either, so it lives down here with the arcade: it takes a number
   and returns a row, where every icon takes nothing and returns one mark. */
const STAR = 'M12 3.4l2.62 5.42 5.88.83-4.26 4.2 1.02 5.9L12 17l-5.26 2.75 1.02-5.9L3.5 9.65l5.88-.83z';
function rating(n, px) {
  const s = px || 13, full = Math.max(0, Math.min(5, Math.round(n || 0)));
  let out = '';
  for (let i = 0; i < 5; i++) {
    out += `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"
      style="display:inline-block;vertical-align:-.12em;opacity:${i < full ? 1 : 0.3}"
      ><path d="${STAR}" fill="currentColor"/></svg>`;
  }
  return `<span role="img" aria-label="${full} of 5" style="display:inline-flex;gap:1.5px"
    >${out}</span>`;
}

/* The rating picker shows n stars, not n out of five: five marks beside the
   numeral "2" would say two different things at once. */
function ratingRun(n, px) {
  const s = px || 13;
  let out = '';
  for (let i = 0; i < n; i++) {
    out += `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"
      style="display:inline-block;vertical-align:-.12em"><path d="${STAR}" fill="currentColor"/></svg>`;
  }
  return `<span style="display:inline-flex;gap:1.5px">${out}</span>`;
}
