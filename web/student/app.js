/* Ágora — student app.
   Where a decision came from the international benchmark (UNiDAYS, Student Beans,
   TOTUM, Knaek, Mecenat, Carte Culture) it is marked BENCH. */
const $ = s => document.querySelector(s);
let ME = null, TAB = 'map', RESUME = null;
let MAP = null, MAPLAYER = null, MARKS = [];
const PREF = JSON.parse(localStorage.getItem('agora_pref') || '{}');
/* A category or a sort order is a preference and is worth remembering. What you
   typed into the search box is not: coming back tomorrow to a city with one
   venue in it reads as a broken app, not as a filter you left on. So it is held
   for this visit only and never written to storage. */
delete PREF.q;
const savePref = () => {
  const { q, ...keep } = PREF;
  localStorage.setItem('agora_pref', JSON.stringify(keep));
};

/* Phase 1 is a leisure discounts app and the map is its front door, so the map
   is the first tab and the one the app opens on. Buying and going out are the
   two things a student does; the rest is support. Work is still built and still
   reachable from the card, but it is not what this phase is about. */
const TABS = [
  { id: 'map',    label: 'Map',      icon: 'map' },
  { id: 'buy',    label: 'Buy',      icon: 'amphora' },
  { id: 'out',    label: 'Go out',   icon: 'arch' },
  { id: 'campus', label: 'Campus',   icon: 'colonnade' },
  { id: 'me',     label: 'Card',     icon: 'bust' },
];

/* The seven categories, mirrored from agora/leisure.py. The API ships the list
   with every /api/map call, so this is only the fallback ordering and colours
   for a screen that renders before that call lands. */
let CATS = [];
const catIcon = k => ICON[(CATS.find(c => c.key === k) || {}).icon] || ICON.seal;
const catColour = k => (CATS.find(c => c.key === k) || {}).colour || 'var(--bronze)';
const catLabel = k => (CATS.find(c => c.key === k) || {}).en || '';
const catsIn = group => CATS.filter(c => c.group === group);

/* ------------------------------------------------------------------ gate */
document.body.insertAdjacentHTML('afterbegin', plateDefs());
$('#gateArc').innerHTML = arcade(300, 30, 7, 0.5);
$('#purse').innerHTML = ICON.wallet + '<span id="purseVal">—</span>';

/* BENCH — UNiDAYS and Knaek both let you see the offers before they ask who you
   are. The wall goes up at the moment of value, not at the front door. */
function askToVerify(why, resume) {
  RESUME = resume || null;
  $('#gateWhy').innerHTML = why ||
    'The student card of Segovia.<br><b>Verified by your university. Nobody else.</b>';
  $('#gate').classList.remove('hide');
  $('#gate').style.opacity = ''; $('#gate').style.transform = '';
  setTimeout(() => $('#email').focus(), 260);
}

$('#send').onclick = async e => {
  const email = $('#email').value.trim();
  fieldError('email', '');
  if (!email) return fieldError('email', 'We need your university address.');
  busy(e.currentTarget, true);
  try {
    const r = await Agora.post('/api/auth/request', { email, role: 'student' });
    $('#gate1').classList.add('hide'); $('#gate2').classList.remove('hide');
    $('#sent').innerHTML = 'We sent six digits to <b>' + esc(email) + '</b>' +
      (r.university ? ' · ' + esc(r.university) : '') +
      '<span class="big">' + r.dev_code + '</span>' +
      '<span style="font-size:12px;opacity:.8">Shown here because this is a demo — in production it only lands in your inbox.</span>';
    $('#code').value = r.dev_code;
    $('#nameWrap').classList.toggle('hide', !!r.existing);
    setTimeout(() => (r.existing ? $('#verify') : $('#name')).focus(), 120);
  } catch (err) { fieldError('email', err.message); }
  finally { busy(e.currentTarget, false); }
};
$('#email').onkeydown = e => { if (e.key === 'Enter') $('#send').click(); };
$('#again').onclick = () => { $('#gate2').classList.add('hide'); $('#gate1').classList.remove('hide'); };
$('#code').oninput = e => {
  e.target.value = e.target.value.replace(/\D/g, ''); fieldError('code', '');
  if (e.target.value.length === 6 && $('#nameWrap').classList.contains('hide')) $('#verify').click();
};
$('#verify').onclick = async e => {
  fieldError('code', ''); busy(e.currentTarget, true, 'Verifying');
  try {
    const r = await Agora.post('/api/auth/verify', {
      email: $('#email').value.trim(), code: $('#code').value.trim(),
      name: $('#name').value.trim(), invite: PREF.invite || '' });
    Agora.token = r.token; ME = r.me.student;
    $('#gate').style.transition = 'opacity .4s var(--ease),transform .4s var(--ease)';
    $('#gate').style.opacity = '0'; $('#gate').style.transform = 'scale(1.03)';
    setTimeout(() => { $('#gate').classList.add('hide'); }, 400);
    purse(); render();
    toast('Welcome, ' + ME.name.split(' ')[0] + ' · ' + money(ME.wallet_eur) + ' to start');
    const go = RESUME; RESUME = null;
    if (go) setTimeout(go, 560);
  } catch (err) { fieldError('code', err.message); }
  finally { busy(e.currentTarget, false); }
};

/* ------------------------------------------------------------------ shell */
function boot() {
  $('#tabs').innerHTML = TABS.map(t =>
    `<button role="tab" data-t="${t.id}" aria-selected="${t.id === TAB}">
       ${ICON[t.icon]}<span class="lb">${t.label}</span></button>`).join('');
  $('#tabs').querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
    if (TAB === b.dataset.t) return $('main').scrollTo({ top: 0, behavior: 'smooth' });
    TAB = b.dataset.t;
    $('#tabs').querySelectorAll('[data-t]').forEach(x => x.setAttribute('aria-selected', x === b));
    $('main').scrollTop = 0; render();
  });
  purse(); render();
}
function purse() { $('#purseVal').textContent = ME ? money(ME.wallet_eur) : 'Sign in'; }
$('#purse').onclick = () => ME ? walletSheet()
  : askToVerify('Verify once with your university email.<br><b>You keep a wallet, a card, and every euro you save.</b>');

/* ----------------------------------------------------------------- sheet
   A sheet can open on top of another one — a venue, then one of its offers —
   and until now the only way out of the second was the close button, which
   dropped you all the way back to the map. Two testers reported it, one of them
   as "I couldn't go back to the home page unless I refreshed". So a sheet that
   was opened from somewhere carries the way back to it, and Escape works. */
function sheet(inner, footer, back) {
  $('#sheet').innerHTML =
    (back ? `<button class="sheet-back" id="sb" aria-label="Back">${ICON.back}</button>` : '') +
    `<button class="sheet-x" id="sx" aria-label="Close">${ICON.close}</button>
     <div class="grab"><i></i></div>
     <div class="scrollable">${inner}</div>
     ${footer ? `<div class="foot">${footer}</div>` : '<div style="height:22px"></div>'}`;
  $('#sheet').classList.add('on'); $('#scrim').classList.add('on');
  $('#sx').onclick = shut;
  if (back) $('#sb').onclick = back;
}
function shut() { $('#sheet').classList.remove('on'); $('#scrim').classList.remove('on'); }
$('#scrim').onclick = shut;
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#sheet').classList.contains('on')) shut();
});

const skeleton = n => '<div class="rows">' + Array.from({ length: n }, () => `
  <div class="row-item"><div class="lead sk"></div><div class="body">
    <div class="sk" style="height:15px;width:62%"></div>
    <div class="sk" style="height:12px;width:40%;margin-top:9px"></div></div>
    <div class="sk" style="height:22px;width:54px"></div></div>`).join('') + '</div>';

const head = (label, title, note) =>
  `<div class="screen-head"><div class="inscript">${label}</div><h1>${title}</h1>
   ${note ? `<p>${note}</p>` : ''}</div>`;

const emptyState = (icon, t, d) =>
  `<div class="empty"><div class="ic">${ICON[icon]}</div><div class="t">${t}</div><div class="d">${d}</div></div>`;

/* BENCH — Knaek's most common complaint is listings that have gone stale, so
   freshness and real usage are shown on the row itself, not buried. */
const proof = (o) => {
  const bits = [];
  if (o.uses > 0) bits.push(`<span class="proof">${ICON.bust}${o.uses} student${o.uses === 1 ? '' : 's'}</span>`);
  if (o.fresh) bits.push(`<span class="proof">${ICON.check}checked this week</span>`);
  if (o.left != null && o.left <= 5) bits.push(`<span class="proof hot">only ${o.left} left</span>`);
  return bits.length ? `<span class="sub" style="display:flex;gap:11px;margin-top:5px">${bits.join('')}</span>` : '';
};

const demoNote = () => `
  <p class="demo-line">
    <b>Demonstration.</b> Real Segovia businesses · invented prices and reviews ·
    nothing here is an offer.
  </p>`;

const guestStrip = (what) => ME ? '' : `
  <div class="guest">
    <div class="t">You are just looking. <b>Verify your university email</b> to ${what}.</div>
    <button class="btn btn--bronze btn--sm" id="gstrip">Verify</button>
  </div>`;
const wireGuest = (why) => {
  const b = $('#gstrip'); if (b) b.onclick = () => askToVerify(why);
};

/* Every screen fetches before it paints, and a slow tab used to finish painting
   after you had already moved on: a tester reported tapping Campus and getting
   Go out. Each render takes a ticket, and a render whose ticket is stale throws
   its output away instead of writing over the screen you are actually looking
   at. RENDER is also what the screens check before touching the DOM. */
let RENDER = 0;
async function render() {
  const v = $('#view');
  const turn = ++RENDER;
  v.classList.toggle('is-map', TAB === 'map');
  if (TAB !== 'map') { MAP = null; MARKS = []; }
  v.innerHTML = TAB === 'map' ? '' : head('·', '', '') + skeleton(5);
  try {
    if (TAB === 'map') return await mapScreen(v, turn);
    if (TAB === 'buy') return await listScreen(v, 'buy', turn);
    if (TAB === 'out') return await listScreen(v, 'out', turn);
    if (TAB === 'campus') return await campus(v, turn);
    return await card(v, turn);
  } catch (e) {
    if (turn === RENDER) v.innerHTML = emptyState('close', 'We could not load this', e.message);
  }
}
const stale = turn => turn !== undefined && turn !== RENDER;


/* ------------------------------------------------------- I · the map
   BENCH — TOTUM and Student Beans both bury location behind a search box, and
   both are mostly used from the sofa. The thing a student in Segovia actually
   has is a street and ten minutes, so the first screen answers "what is near
   me, and from how much" without a single tap. */

const chiprow = (sel, cats, attr) =>
  `<div class="chiprow">
     <button class="chip" data-${attr}="" aria-pressed="${!sel}">Everything</button>
     ${cats.map(c => `<button class="chip" data-${attr}="${c.key}"
        aria-pressed="${sel === c.key}">${c.en}</button>`).join('')}
   </div>`;

async function mapScreen(v, turn) {
  const sel = PREF.leisure || '';
  v.innerHTML = `
    <div class="mapstage">
      <div id="map"></div>
      <div class="mapchips"><div id="mapchips"></div></div>
    </div>
    <div class="maplist" id="maplist">${skeleton(4)}</div>`;

  const data = await Agora.get('/api/map', sel ? { leisure: sel } : {});
  if (stale(turn)) return;
  CATS = data.categories || CATS;
  $('#mapchips').innerHTML = chiprow(sel, CATS, 'c');
  $('#mapchips').querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
    PREF.leisure = b.dataset.c; savePref(); MAP = null; render();
  });

  const pins = data.pins.filter(p => p.lat != null && p.lng != null);
  drawMap(pins, data.centre);
  paintMapList(pins, sel);
  paintTopPicks(pins);
}

/* Earned, never bought. A venue can pay to be promoted and that promotion is
   labelled as such; it cannot pay its way in here, because this list comes
   only from moderated reviews written by students who paid. Keeping the two
   apart is the whole reason a label like this is worth anything. */
async function paintTopPicks(pins) {
  const slot = $('#toppicks');
  if (!slot) return;
  let d;
  try { d = await Agora.get('/api/top-picks', {}); } catch (e) { return; }
  if (!$('#toppicks') || !d.picks.length) return;
  slot.innerHTML =
    `<div class="lead-in"><div class="inscript dim">TOP PICKS</div>
       <span class="t-meta">by students, not by us</span></div>
     <div class="rail">${d.picks.map(b => `
       <button class="railcard" data-tp="${b.business_id}">
         <span class="art">${plate(b.name, 'b' + b.business_id)}
           <span class="over"><span class="n">${esc(b.name)}</span>
           <span class="m">${b.avg_rating.toFixed(1)}/5 · ${b.reviews} reviews</span></span></span>
         <span class="bar"><span class="p">${b.from_eur != null ? money(b.from_eur) : '—'}</span>
           <span class="w" style="text-decoration:none">${esc(b.leisure_en)}</span></span>
       </button>`).join('')}</div>
     <p class="t-meta" style="margin:-6px 0 18px">A top pick needs at least
       ${d.min_reviews} published reviews and a ${d.min_avg} average. No venue can buy one.</p>`;
  slot.querySelectorAll('[data-tp]').forEach(btn => btn.onclick = () => {
    const p = pins.find(x => x.business_id == btn.dataset.tp) ||
              d.picks.find(x => x.business_id == btn.dataset.tp);
    if (MAP && p && p.lat != null) MAP.flyTo([p.lat, p.lng], 16, { duration: .5 });
    venueSheet(p);
  });
}

/* Pins closer together than they are wide cannot both be tapped, so any cluster
   within about 40 metres is fanned onto a small circle around its own centre.
   The venue a pin belongs to does not move — only the marker does, far enough
   to be pressed and not far enough to point at the wrong street. */
function fanOut(pins) {
  const EPS = 0.00045;                       // ~40 m at this latitude
  const out = pins.map(p => [p.lat, p.lng]);
  const done = new Set();
  pins.forEach((p, i) => {
    if (done.has(i)) return;
    const group = [i];
    for (let j = i + 1; j < pins.length; j++) {
      if (done.has(j)) continue;
      if (Math.abs(pins[j].lat - p.lat) < EPS && Math.abs(pins[j].lng - p.lng) < EPS) group.push(j);
    }
    group.forEach(k => done.add(k));
    if (group.length === 1) return;
    const r = EPS * 0.8;
    group.forEach((k, n) => {
      const a = (2 * Math.PI * n) / group.length;
      out[k] = [p.lat + r * Math.sin(a) * 0.62, p.lng + r * Math.cos(a)];
    });
  });
  return out;
}

function drawMap(pins, centre) {
  const host = $('#map');
  if (!host) return;
  // Leaflet comes from a CDN. On a phone on campus wifi, or behind a captive
  // portal, it may simply never arrive — and a blank grey rectangle where the
  // main screen should be is the worst possible failure. So: say so, and let
  // the list below carry the screen.
  if (window.AGORA_NO_MAP || typeof L === 'undefined') {
    host.innerHTML = `
      <div class="nomap">
        <div class="ic">${ICON.pin}</div>
        <div class="t-title" style="font-size:16px">The map needs a connection</div>
        <p class="t-meta" style="margin:8px auto 0;max-width:30ch">
          Everything below still works, sorted by part of the city.</p>
      </div>`;
    return;
  }
  // Zoom sits bottom-right: top-left is where the category chips live, and a
  // control under a chip is a control nobody can press.
  MAP = L.map(host, { zoomControl: false, attributionControl: true })
         .setView([centre.lat, centre.lng], 14);
  L.control.zoom({ position: 'bottomright' }).addTo(MAP);
  // OpenStreetMap's own tiles. CARTO's light basemap now demands an API key —
  // it renders "API KEY REQUIRED" across the city — so it is not an option for
  // a demo. OSM's tile policy is fine at this volume; a real launch needs a
  // paid provider (Mapbox, MapTiler, Thunderforest) or self-hosted tiles.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(MAP);

  // Venues in the old town sit within a few metres of each other, and their
  // pins landed on top of one another: two testers reported markers in the
  // centre they simply could not tap. Pins that collide are fanned out around
  // the point they share, so every one of them has its own thumb-sized target.
  const spread = fanOut(pins);

  MARKS = pins.map((p, i) => {
    const m = L.marker(spread[i], {
      icon: L.divIcon({
        className: 'pin', iconSize: null,
        // "€5 for what?" was the second most reported problem of the session.
        // The pin now says the thing, not just the number.
        html: `<span class="b"><span class="d" style="background:${catColour(p.leisure)}">
                 ${catIcon(p.leisure)}</span><span class="pr">${money(p.from_eur)}</span>
               </span><span class="w">${esc(p.from_what || '')}</span>`,
      }),
      zIndexOffset: Math.round(1000 - (p.from_eur || 0)),
    }).addTo(MAP);
    m.on('click', () => venueSheet(p));
    return { id: p.business_id, m };
  });
  // The stage is sized in vh and the map is built before layout settles, so the
  // fit has to happen after Leaflet has been told the real size. Fitting first
  // and measuring second left the map zoomed into one street with every pin off
  // screen — which is the same blank-rectangle failure the fallback above
  // exists to prevent, only harder to notice.
  const fit = () => {
    if (!MAP) return;
    MAP.invalidateSize();
    if (!pins.length) return;
    // Asymmetric on purpose: the chips float over the top of the stage and a
    // pin tucked under them is a price nobody can read.
    MAP.fitBounds(L.latLngBounds(spread), {
      paddingTopLeft: [58, 80], paddingBottomRight: [58, 44], maxZoom: 16,
    });
  };
  setTimeout(fit, 60);
  // Phones settle late: a second pass once the stage has its final height.
  setTimeout(fit, 400);

  // What the price buys only fits once the city has opened up. Zoomed out, a
  // dozen captions overlap into noise and hide the prices underneath them, so
  // below street zoom the pins carry the number alone and the words come back
  // as soon as there is room for them.
  const captions = () => host.classList.toggle('show-what', MAP.getZoom() >= 15);
  MAP.on('zoomend', captions);
  setTimeout(captions, 420);

  MAP.on('zoomend moveend', declutter);
  setTimeout(declutter, 440);
  setTimeout(declutter, 950);
}

/* Four venues on the same square metre of screen is four prices nobody can
   read: the old town is 400 metres across and the pins were landing on top of
   one another. Real coordinates stay real — the marker keeps its true position
   and only its label is nudged, by whole pixels, until the badges stop
   overlapping. Nothing moves on the map; the labels get out of each other's
   way, which is what a paper map engraver would have done. */
function declutter() {
  if (!MAP || !MARKS.length) return;
  const boxes = [];
  // Measured once: every badge is the same height and the width follows the
  // price, so reading one element is enough to size them all.
  const sample = MARKS[0].m.getElement();
  if (!sample) return;

  // Reset first, or offsets compound every time the map moves.
  MARKS.forEach(({ m }) => {
    const el = m.getElement();
    if (el) { el.style.setProperty('--dx', '0px'); el.style.setProperty('--dy', '0px'); }
  });

  const order = MARKS
    .map(({ m }) => ({ m, pt: MAP.latLngToContainerPoint(m.getLatLng()) }))
    .sort((a, b) => a.pt.y - b.pt.y);   // top ones keep their place

  for (const { m, pt } of order) {
    const el = m.getElement();
    const badge = el && el.querySelector('.b');
    if (!badge) continue;
    const w = badge.offsetWidth || 64, h = badge.offsetHeight || 26;
    // The stage the labels have to stay inside. The top edge is not the top of
    // the map: the category chips float over it, and a price hidden behind a
    // chip is worse than a price slightly off its pin.
    const size = MAP.getSize();
    const LIMIT = { top: 84, bottom: size.y - 30, left: 6, right: size.x - 6 };

    const boxAt = (dx, dy) => ({ l: pt.x - w / 2 + dx, r: pt.x + w / 2 + dx,
                                 t: pt.y - h + dy,     b: pt.y + dy });
    const inside = c => c.t >= LIMIT.top && c.b <= LIMIT.bottom &&
                        c.l >= LIMIT.left && c.r <= LIMIT.right;
    const clear = c => !boxes.some(o =>
      c.l < o.r + 3 && c.r > o.l - 3 && c.t < o.b + 3 && c.b > o.t - 3);

    // Candidates in order of how well the label still reads as belonging to
    // its point: straight up, straight down, then out to the sides.
    const step = h + 4;
    // Sideways before far-vertical: a label beside its pin still reads as
    // belonging to it, a label four rows above it does not.
    const cand = [[0, 0], [w * 0.62, 0], [-w * 0.62, 0]];
    for (let k = 1; k <= 4; k++) {
      cand.push([0, -k * step], [0, k * step],
                [w * 0.56, -k * step], [-w * 0.56, -k * step],
                [w * 0.56, k * step], [-w * 0.56, k * step]);
    }
    let dx = 0, dy = 0, placed = false;
    for (const [cx, cy] of cand) {
      const c = boxAt(cx, cy);
      if (inside(c) && clear(c)) { dx = cx; dy = cy; placed = true; break; }
    }
    // Nowhere clean to put it: leave it on its point rather than fling it
    // across the map. Overlapping honestly beats pointing at the wrong place.
    if (!placed) { dx = 0; dy = 0; }
    // Whatever happened above, a price that runs off the edge of the stage is
    // not a price. Overlapping a neighbour is recoverable; being cut in half
    // by the bezel is not, so the clamp wins over the collision test.
    const c0 = boxAt(dx, dy);
    if (c0.l < LIMIT.left)  dx += LIMIT.left - c0.l;
    if (c0.r > LIMIT.right) dx -= c0.r - LIMIT.right;
    const c1 = boxAt(dx, dy);
    if (c1.t < LIMIT.top)      dy += LIMIT.top - c1.t;
    if (c1.b > LIMIT.bottom)   dy -= c1.b - LIMIT.bottom;
    const box = () => boxAt(dx, dy);

    boxes.push(box());
    el.style.setProperty('--dx', Math.round(dx) + 'px');
    el.style.setProperty('--dy', Math.round(dy) + 'px');
    // A label that has stepped aside is joined to its point by a hairline, the
    // way an engraver leads a caption to the thing it names. A loose dot and a
    // floating price are two marks the reader has to pair up themselves; a
    // leader does the pairing for them, and it reads as drawn rather than as
    // dirt on the map. The line runs to the centre of the badge, which is
    // opaque, so only the part outside the badge is ever seen.
    const lx = dx, ly = dy - h / 2;
    el.style.setProperty('--lead-len', Math.round(Math.hypot(lx, ly)) + 'px');
    el.style.setProperty('--lead-ang', Math.atan2(ly, lx).toFixed(3) + 'rad');
    el.classList.toggle('moved', dx !== 0 || dy !== 0);
  }
}

/* The list under the map is not a leftover, it is the other half of the screen.
   A tester asked for it in as many words: "I would also like a list view where I
   can compare places more easily, especially by price, distance and type of
   discount." Price and discount sort here; the zone does the work distance would
   do, because the app has no permission to ask where you are standing. */
const SORTS = [
  ['price', 'Cheapest first'],
  ['pct',   'Biggest discount'],
  ['zone',  'By part of town'],
  ['name',  'A–Z'],
];
const sortPins = (pins, how) => {
  const c = [...pins];
  if (how === 'pct') c.sort((a, b) => (b.best_pct || 0) - (a.best_pct || 0));
  else if (how === 'zone') c.sort((a, b) => (a.zone || '').localeCompare(b.zone || '') ||
                                            a.name.localeCompare(b.name));
  else if (how === 'name') c.sort((a, b) => a.name.localeCompare(b.name));
  else c.sort((a, b) => (a.from_eur || 0) - (b.from_eur || 0));
  return c;
};

/* Search was asked for twice, and both times for the same reason: the chips
   answer "what kind of thing" but not "is my place in here at all". It matches
   the venue, the thing on offer and the part of town, because those are the
   three words a student actually types. */
const matches = (p, q) => {
  if (!q) return true;
  const hay = [p.name, p.from_what, catLabel(p.leisure), ZONE[p.zone] || p.zone]
    .join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
};

function paintMapList(pins, sel) {
  const box = $('#maplist');
  if (!box) return;
  const how = PREF.sort || 'price';
  const q = (PREF.q || '').trim();
  const found = pins.filter(p => matches(p, q));
  const rows = sortPins(found, how);
  const title = sel ? catLabel(sel) : 'Everywhere in Segovia';
  box.innerHTML =
    demoNote() +
    guestStrip('buy from your phone and show the code at the door') +
    '<div id="toppicks"></div>' +
    `<label class="seek">${ICON.seek || ICON.map}
       <input id="seek" type="search" inputmode="search" autocomplete="off"
              placeholder="A place, a dish, a part of town" value="${esc(q)}">
       ${q ? `<button class="seek-x" id="seekx" aria-label="Clear">${ICON.close}</button>` : ''}
     </label>` +
    `<div class="lead-in"><div class="inscript dim">${esc(
       (q ? 'RESULTS FOR “' + q + '”' : title).toUpperCase())}</div>
       <span class="t-meta">${found.length} place${found.length === 1 ? '' : 's'}</span></div>` +
    (found.length ? `<div class="filters" style="margin:0 0 4px;padding:0 0 14px">
       <div class="chiprow">${SORTS.map(([k, l]) =>
         `<button class="chip" data-s="${k}" aria-pressed="${how === k}">${l}</button>`).join('')}
       </div></div>` : '') +
    (found.length
      ? `<div class="rows stagger">${rows.map((p, i) => `
          <button class="row-item" data-p="${p.business_id}" style="animation-delay:${i * 26}ms">
            <span class="lead">${monogram(p.name)}</span>
            <span class="body">
              <span class="ttl">${esc(p.name)}</span>
              <span class="sub">${esc(catLabel(p.leisure))} · ${esc(ZONE[p.zone] || p.zone)}</span>
              <span class="sub cut">${esc(p.from_what || '')}${
                p.best_pct ? ' · up to −' + p.best_pct + '%' : ''}</span>
              ${p.hours ? `<span class="sub">${esc(p.hours)}</span>` : ''}
            </span>
            <span class="tail"><span class="t-meta">from</span><br>
              <span class="price">${money(p.from_eur)}</span></span>
          </button>`).join('')}</div>`
      : q
        ? emptyState('pin', 'Nothing matches “' + esc(q) + '”',
            'Try the name of the place, or the part of town.')
        : emptyState('pin', 'Nothing here yet',
            'No venue in this category has a live price. Try another one.'));
  wireGuest('Verify once with your university email.<br><b>Then every price in Segovia is one tap away.</b>');

  // Typing must not rebuild the field under the cursor, so the list repaints
  // and the input keeps its own value and selection.
  const seek = box.querySelector('#seek');
  if (seek) {
    seek.oninput = () => {
      PREF.q = seek.value; savePref();
      const at = seek.selectionStart;
      paintMapList(pins, sel); paintTopPicks(pins);
      const again = $('#seek');
      if (again) { again.focus(); again.setSelectionRange(at, at); }
    };
  }
  const seekx = box.querySelector('#seekx');
  if (seekx) seekx.onclick = () => {
    PREF.q = ''; savePref(); paintMapList(pins, sel); paintTopPicks(pins);
  };

  box.querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
    PREF.sort = b.dataset.s; savePref(); paintMapList(pins, sel); paintTopPicks(pins);
  });
  box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
    const p = pins.find(x => x.business_id == b.dataset.p);
    if (MAP && p.lat != null) MAP.flyTo([p.lat, p.lng], 16, { duration: .5 });
    venueSheet(p);
  });
}

/* Everything one venue holds, in one sheet: the map pin and the list row both
   land here, so a student never has to work out which screen a price lives on.

   Rebuilt after the 23 November test. Thirteen of forty-six testers tapped a pin
   and reported the same thing — "all I got was reviews". Three causes, all fixed
   here: the sheet fetched every offer and every event in the city and filtered
   them in the browser, so what the venue sells arrived last; reviews came from a
   separate, smaller call that usually won the race; and nothing on the sheet
   answered the two questions people actually had, which were what the price buys
   and whether the place is open. Now: one call, the offer first, the address and
   the hours under the name, and reviews at the bottom where they belong. */
async function venueSheet(p) {
  sheet(`<div class="hero">${plate(p.name, 'b' + p.business_id)}
      <div class="cap"><div class="k">${esc(catLabel(p.leisure))}</div>
        <div class="n">${esc(p.name)}</div></div></div>${creditLine(p.name)}
    <div id="vfacts"></div>
    <div id="vbody" style="margin:16px 0 0">${skeleton(3)}</div>`);

  let d;
  try { d = await Agora.get('/api/venue', { business_id: p.business_id }); }
  catch (err) {
    const box = $('#vbody');
    if (box) box.innerHTML = emptyState('close', 'We could not load this venue', err.message);
    return;
  }
  if (!$('#vbody')) return;           // the sheet was closed while we waited

  const v = d.venue, mine = d.offers, evs = d.events;

  // The facts a student standing in the street needs before anything else.
  $('#vfacts').innerHTML = `
    <p class="t-meta">${esc(v.address || '')}${v.zone ? ' · ' + esc(ZONE[v.zone] || v.zone) : ''}</p>
    ${v.hours ? `<p class="t-meta vhours">${ICON.clock}<span>${esc(v.hours)}</span></p>` : ''}
    ${d.rating.count ? `<p class="t-meta" style="margin:6px 0 0">
      <span class="stars" style="color:var(--bronze)">${stars(Math.round(d.rating.average))}</span>
      ${d.rating.average.toFixed(1)}/5 · ${d.rating.count} student review${d.rating.count === 1 ? '' : 's'}</p>` : ''}
    ${v.description_en ? `<p class="t-body" style="margin:12px 0 0">${esc(v.description_en)}</p>` : ''}`;

  const box = $('#vbody');
  box.innerHTML =
    (mine.length ? `<div class="inscript dim" style="margin:0 0 9px">WHAT YOU GET HERE</div>
      <div class="rows">${mine.map(o => `
        <button class="row-item" data-vo="${o.id}">
          <span class="body"><span class="ttl">${esc(o.title_en.replace(/ - .*$/, ''))}</span>
            <span class="sub">${esc(o.detail_en || '')}</span>
            <span class="sub cut">${KIND[o.kind]} · −${o.discount_pct}%${
              o.window_label ? ' · ' + esc(o.window_label) : ''}</span></span>
          <span class="tail">${priceTail(o)}</span>
        </button>`).join('')}</div>` : '') +
    (evs.length ? `<div class="inscript dim" style="margin:20px 0 9px">WHAT IS ON</div>
      <div class="rows">${evs.map(e => `
        <button class="row-item" data-ve="${e.id}">
          <span class="body"><span class="ttl">${esc(e.title_en)}</span>
            <span class="sub">${esc(e.when)}</span>
            <span class="sub cut">${e.left} of ${e.capacity} left</span></span>
          <span class="tail"><span class="price">${money(e.student_eur)}</span><br>
            <span class="was">${money(e.list_eur)}</span></span>
        </button>`).join('')}</div>` : '') +
    (!mine.length && !evs.length
      ? emptyState('pin', 'Nothing live here today',
          'This venue has no student price on sale right now. It stays on the map because it has had one before.') : '') +
    '<div id="vrev"></div>';
  box.querySelectorAll('[data-vo]').forEach(b => b.onclick = () =>
    offer(mine.find(o => o.id == b.dataset.vo), () => venueSheet(p)));
  box.querySelectorAll('[data-ve]').forEach(b => b.onclick = () =>
    evSheet(evs.find(e => e.id == b.dataset.ve), () => venueSheet(p)));
  paintReviews(p);
}

/* A percentage off a basket has no single price. Saying "€25.50" next to
   "15% off" reads as two different offers — a tester said exactly that — so the
   example is labelled as an example and the percentage carries the headline. */
function priceTail(o) {
  return o.price_is_example
    ? `<span class="price">−${o.discount_pct}%</span><br>
       <span class="t-meta">e.g. ${money(o.student_eur)} on ${money(o.list_eur)}</span>`
    : `<span class="price">${money(o.student_eur)}</span><br>
       <span class="was">${money(o.list_eur)}</span>`;
}

/* ------------------------------------------------------------- reviews
   BENCH — the student-card apps that carry reviews (Knaek, Mecenat) let anyone
   signed in write one, and the ratings read like noise. Here the gate is not
   "are you a student" but "did you pay here", which the app already knows. It
   is the one thing a scraped review site cannot copy. */
/* A review is written in one language and read in another. International
   students opened a venue, found the reviews in Spanish and said so — on a
   product whose whole argument is that Segovia is not written for you, that is
   the barrier itself showing up inside our own app. So: show it in the
   reader's language where we have it, label it where we do not, and keep the
   original one tap away, because a translation you cannot check is worth less.

   UI_LANG is what the app is reading in. The student app is English today; when
   the Spanish build lands it sets this and nothing else here changes. */
const UI_LANG = (document.documentElement.lang || 'en').slice(0, 2);

function reviewCard(r) {
  const lang = r.lang || UI_LANG;
  const foreign = lang !== UI_LANG;
  const shown = foreign && r.body_alt ? r.body_alt : r.body;
  const note = !foreign ? ''
    : r.body_alt
      ? `<button class="revlang" data-orig="${r.id}">
           ${ICON.globe}<span>Translated from ${lang === 'es' ? 'Spanish' : 'English'} ·
           show the original</span></button>`
      : `<span class="revlang is-plain">${ICON.globe}<span>Written in ${
           lang === 'es' ? 'Spanish' : 'English'}</span></span>`;
  return `<div class="revcard">
      <div class="top"><span class="vn">${esc(r.author || 'Student')}</span>
        <span class="stars">${stars(r.rating)}</span></div>
      <div class="who">${esc(r.degree || 'Student')}${r.year ? ', year ' + r.year : ''} · ${esc(r.when)}</div>
      <p class="bd" id="rb${r.id}">${esc(shown)}</p>
      ${note}
    </div>`;
}

/* Swap one card between the translation and what the student actually wrote. */
function wireReviewLangs(box, reviews) {
  box.querySelectorAll('[data-orig]').forEach(b => b.onclick = () => {
    const r = reviews.find(x => x.id == b.dataset.orig);
    const p = box.querySelector('#rb' + r.id);
    if (!r || !p) return;
    const showingOriginal = p.dataset.orig === '1';
    p.textContent = showingOriginal ? r.body_alt : r.body;
    p.dataset.orig = showingOriginal ? '' : '1';
    b.querySelector('span').textContent = showingOriginal
      ? `Translated from ${r.lang === 'es' ? 'Spanish' : 'English'} · show the original`
      : 'Showing the original · show the translation';
  });
}

async function paintReviews(p) {
  const box = $('#vrev');
  if (!box) return;
  box.innerHTML = '<div style="height:10px"></div>' + skeleton(2);
  let d;
  try { d = await Agora.get('/api/reviews', { business_id: p.business_id }); }
  catch (e) { box.innerHTML = ''; return; }
  if (!$('#vrev')) return;

  box.innerHTML =
    `<div class="inscript dim" style="margin:22px 0 2px">WHAT STUDENTS SAY${
      d.average ? ` · <span class="figure">${d.average.toFixed(1)}</span>/5 FROM <span
        class="figure">${d.count}</span>` : ''}</div>` +
    (d.reviews.length
      ? `<div>${d.reviews.slice(0, 6).map(r => reviewCard(r)).join('')}</div>`
      : `<p class="t-meta" style="margin:10px 0 0">No published review yet.</p>`) +
    (d.mine
      ? `<div class="guest" style="margin:16px 0 0">
           <div class="t">Your review is <b style="color:var(--oxblood)">${esc(d.mine.status)}</b>.
             ${d.mine.status === 'pending' ? 'A moderator reads it before it appears.' : ''}</div></div>`
      : d.can_review
        ? `<button class="btn btn--quiet btn--block" id="wrev" style="margin:16px 0 0">
             ${ICON.scroll}<span>Write a review</span></button>`
        : `<p class="t-meta" style="margin:14px 0 0">${esc(d.why || '')}</p>`) +
    `<p class="t-meta" style="margin:14px 0 0">Every review is written by a student who paid
       here, and read by a moderator before it appears. Venues cannot remove them.</p>
     <div style="height:16px"></div>`;

  wireReviewLangs(box, d.reviews);
  const b = $('#wrev');
  if (b) b.onclick = () => writeReview(p);
}

function writeReview(p) {
  let rating = 0;
  sheet(`
    <div class="inscript" style="margin:4px 0 10px">${esc(p.name)}</div>
    <h2 class="t-title">How was it?</h2>
    <p class="t-body" style="margin:12px 0 18px">You are reviewing a place you actually paid for.
      A moderator reads it before anyone else does.</p>
    <div class="chiprow" id="rate" style="margin:0 0 6px">
      ${[1, 2, 3, 4, 5].map(n =>
        `<button class="chip" data-r="${n}" aria-pressed="false">${n}&nbsp;${ratingRun(n, 12)}</button>`).join('')}
    </div>
    <span class="msg" id="rateMsg"></span>
    <label class="field" style="margin-top:14px"><span class="lbl">In your own words</span>
      <textarea class="inp" id="rbody" rows="4"
        placeholder="What would you tell someone in your class?"></textarea>
      <span class="msg" id="rbodyMsg"></span></label>`,
    `<button class="btn btn--block" id="rsend">Send for review</button>`);

  $('#rate').querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
    rating = +b.dataset.r;
    $('#rate').querySelectorAll('[data-r]').forEach(x =>
      x.setAttribute('aria-pressed', x === b));
    $('#rateMsg').textContent = '';
  });

  $('#rsend').onclick = async e => {
    $('#rateMsg').textContent = ''; fieldError('rbody', '');
    if (!rating) { $('#rateMsg').textContent = 'Pick a rating first.'; return; }
    const text = $('#rbody').value.trim();
    if (text.length < 15) return fieldError('rbody', 'A line or two — fifteen characters at least.');
    busy(e.currentTarget, true, 'Sending');
    try {
      const r = await Agora.post('/api/reviews',
        { business_id: p.business_id, rating, body: text });
      shut(); toast(r.message || 'Sent to a moderator');
    } catch (err) { busy(e.currentTarget, false); fieldError('rbody', err.message); }
  };
}

/* ------------------------------------------------- II · buying and going out */
/* Four kinds that mean the same thing to a roast house, a cinema and a padel
   court. The time window is an attribute of the offer, not a kind of its own. */
const KIND = { percent: 'Percent off', fixed: 'Student price', twofor: 'Two for one', bundle: 'Bundle' };
const ZONE = { centro: 'Old town', nueva: 'Nueva Segovia', sanlo: 'San Lorenzo', zorrilla: 'J. Zorrilla' };

/* One screen for both halves of phase 1, because they behave the same: pick a
   category, see a price, pay. "Buy" is the two things you take away with you,
   "Go out" the five you turn up to — and the only real difference is that
   going out has a date on it. */
async function listScreen(v, group, turn) {
  const cats = catsIn(group);
  let sel = PREF['sel_' + group] || '';
  if (sel && !cats.some(c => c.key === sel)) sel = '';

  const want = sel ? [sel] : cats.map(c => c.key);
  const [{ offers }, ev] = await Promise.all([
    Agora.get('/api/offers', sel ? { leisure: sel } : {}),
    group === 'out' ? Agora.get('/api/events', sel ? { leisure: sel } : {})
                    : Promise.resolve({ events: [] }),
  ]);
  if (stale(turn)) return;
  const mine = offers.filter(o => want.includes(o.leisure));
  const events = (ev.events || []).filter(e => want.includes(e.leisure));

  const copy = group === 'buy'
    ? ['I · SHOP·AND·DINE', 'Buy for less',
       'Student prices held at real Segovia tables and shops, inside the walls and beyond them.']
    : ['II · GO·OUT', 'Go out for less',
       'Clubbing, football, theatre, cinema, and sport you turn up to and play together.'];

  v.innerHTML =
    head(copy[0], copy[1], copy[2]) +
    demoNote() +
    guestStrip('pay from your phone and keep what you save') +
    `<div class="filters">${chiprow(sel, cats, 'g')}</div>` +
    (events.length ? `
      <div class="inscript dim" style="margin:4px 0 11px">WITH A DATE ON IT</div>
      <div class="stagger">${events.map((e, i) => `
        <button class="evcard" data-e="${e.id}" style="animation-delay:${i * 34}ms">
          <span class="art">${plate(e.title_en, 'e' + e.id)}
            <span class="tagline">${esc(catLabel(e.leisure) || e.category)}</span>
            <span class="when">${esc(e.when)}</span></span>
          <span class="meat">
            <span class="n">${esc(e.title_en)}</span>
            <span class="m">${esc(e.venue || e.business_name)}${e.uses ? ' · ' + e.uses + ' going' : ''}</span>
            <span class="row2">
              <span class="proof ${e.left <= 8 ? 'hot' : ''}">${e.left} of ${e.capacity} left</span>
              <span><span class="price" style="font-size:21px">${money(e.student_eur)}</span>
                <span class="was" style="margin-left:6px">${money(e.list_eur)}</span></span>
            </span>
          </span>
        </button>`).join('')}</div>` : '') +
    (mine.length ? `
      <div class="inscript dim" style="margin:${events.length ? '22px' : '4px'} 0 11px">${
        group === 'out' ? 'ON ANY DAY' : 'ON THE TABLE'}</div>
      <div class="rows stagger">${mine.map((o, i) => `
        <button class="row-item" data-o="${o.id}" style="animation-delay:${i * 30}ms">
          <span class="lead">${monogram(o.business_name)}</span>
          <span class="body">
            <span class="ttl">${esc(o.title_en.replace(/ - .*$/, ''))}</span>
            <span class="sub">${esc(o.business_name)} · ${esc(catLabel(o.leisure))}</span>
            <span class="sub cut">${KIND[o.kind]} · −${o.discount_pct}%</span>
            ${proof(o)}
          </span>
          <span class="tail"><span class="price">${money(o.student_eur)}</span><br>
            <span class="was">${money(o.list_eur)}</span></span>
        </button>`).join('')}</div>` : '') +
    (!mine.length && !events.length
      ? emptyState(group === 'buy' ? 'amphora' : 'arch', 'Nothing here today',
          'No student price in this category right now. Try another one.') : '');

  wireGuest('Verify once.<br><b>Then every student price in Segovia is one tap away.</b>');
  v.querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
    PREF['sel_' + group] = b.dataset.g; savePref(); render();
  });
  v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => offer(mine.find(o => o.id == b.dataset.o)));
  v.querySelectorAll('[data-e]').forEach(b => b.onclick = () => evSheet(events.find(e => e.id == b.dataset.e)));
}

function offer(o, back) {
  const pct = o.price_is_example;
  sheet(`
    <div class="hero">${plate(o.business_name, 'o' + o.id)}
      <div class="cap"><div class="k">${KIND[o.kind]}</div>
        <div class="n">${esc(o.title_en.replace(/ - .*$/, ''))}</div></div></div>
    <p class="t-meta">${esc(o.business_name)} · ${esc(o.address || '')}</p>
    <p class="t-body" style="margin:14px 0 0">${esc(o.detail_en)}</p>
    <div style="display:flex;gap:9px;flex-wrap:wrap;margin:14px 0 0">
      ${o.window_label ? `<span class="badge badge--bronze">${esc(o.window_label)}</span>` : ''}
      ${o.uses ? `<span class="badge">${o.uses} students used this</span>` : ''}
      ${o.fresh ? `<span class="badge badge--live">${ICON.check} checked this week</span>` : ''}
    </div>
    <div class="ledger">
      ${pct
        ? `<div class="ln"><span class="k">Your discount</span><span class="price lg">−${o.discount_pct}%</span></div>
           <div class="ln"><span class="k">Example: a ${money(o.list_eur)} basket</span>
             <span>${money(o.student_eur)}</span></div>
           <div class="ln total"><span class="k">You would save</span>
             <span style="color:var(--verd)">−${money(o.saved_eur)}</span></div>`
        : `<div class="ln"><span class="k">Normal price</span><span class="was" style="font-size:15px">${money(o.list_eur)}</span></div>
           <div class="ln"><span class="k">You save</span><span style="color:var(--verd)">−${money(o.saved_eur)}</span></div>
           <div class="ln total"><span class="k">Your price</span><span class="price lg">${money(o.student_eur)}</span></div>`}
    </div>
    <p class="t-meta" style="margin:16px 0 22px">${pct
      ? 'A percentage comes off whatever you actually spend, so the figures above are an example, not the price. You show your code at the till and the discount is taken there.'
      : 'Reserved now, paid at the till. You show six digits, the venue confirms them, and the discount is already in the price — so you are never charged for a table you did not take.'}</p>`,
    ME ? `<button class="btn btn--block" id="pay">${pct ? 'Get my code' : 'Reserve · ' + money(o.student_eur)}</button>`
       : `<button class="btn btn--bronze btn--block" id="join">Verify to claim${pct ? '' : ' · ' + money(o.student_eur)}</button>`,
    back);
  if (!ME) {
    $('#join').onclick = () => { shut(); askToVerify(
      `<b>${esc(o.business_name)}</b> holds this price for verified students.<br>One email, once.`,
      () => offer(o, back)); };
    return;
  }
  $('#pay').onclick = async e => {
    busy(e.currentTarget, true, pct ? 'Getting your code' : 'Reserving');
    try {
      const r = await Agora.post('/api/offers/claim', { offer_id: o.id });
      if (r.pay_here) {
        ME.wallet_eur = +(ME.wallet_eur - o.student_eur).toFixed(2); purse();
      }
      pass('Show this at the till', o.business_name, r.code,
           r.pay_here ? `Paid ${money(r.paid_eur)} · saved ${money(r.saved_eur)}`
                      : `−${o.discount_pct}% off whatever you spend`,
           r.message || '');
    } catch (err) { busy(e.currentTarget, false); toast(err.message, true); }
  };
}

/* "I'd want a way to show my code at the door with no signal." A club doorway
   and a stone-walled dining room are exactly where a phone has none, and a code
   that needs a round trip to be read is a code that fails at the only moment it
   matters. Every pass is kept on the device as it is issued, and the card lists
   the live ones whether or not the app can reach us. */
const PASSES = () => { try { return JSON.parse(localStorage.getItem('agora_passes') || '[]'); }
                       catch (e) { return []; } };
function keepPass(p) {
  const all = PASSES().filter(x => x.code !== p.code);
  all.unshift(p);
  // A pass is worth keeping for about a day; after that it is clutter.
  const fresh = all.filter(x => Date.now() - x.at < 36 * 3600 * 1000).slice(0, 12);
  try { localStorage.setItem('agora_passes', JSON.stringify(fresh)); } catch (e) {}
}

function pass(title, venue, code, line, note) {
  keepPass({ code, venue, line, title, at: Date.now() });
  sheet(`
    <div style="text-align:center;padding:4px 0 2px">
      <div class="inscript" style="margin:0 0 10px">${esc(venue)}</div>
      <h2 class="t-title">${title}</h2>
      <p class="t-meta" style="margin:9px auto 22px;max-width:30ch">${note}</p>
    </div>
    <div class="pass">
      <div class="head"><div class="inscript on-dark">ÁGORA · SEGOVIA</div></div>
      <div class="perf"></div>
      <div class="code">${code}</div>
      <div class="foot"><span class="t-meta" style="color:var(--ink-04)">${line}</span></div>
      <div class="wm">${arcade(360, 30, 10, 0.13)}</div>
    </div>
    <div style="height:18px"></div>`,
    `<button class="btn btn--quiet btn--block" id="done">Done</button>`);
  $('#done').onclick = () => { shut(); render(); };
}

/* Legacy event vocabulary, still written to the database alongside the
   leisure category so older rows keep reading. */
const EV = { party: 'Party', theatre: 'Theatre', concert: 'Concert',
             sport_play: 'Play', sport_watch: 'Watch', tour: 'Walk' };

function evSheet(e, back) {
  sheet(`
    <div class="hero">${plate(e.title_en, 'e' + e.id)}
      <div class="cap"><div class="k">${EV[e.category] || e.category}</div>
        <div class="n">${esc(e.title_en)}</div></div></div>
    <p class="t-meta">${esc(e.when)} · ${esc(e.venue || e.business_name)}</p>
    <p class="t-body" style="margin:14px 0 0">${esc(e.detail_en)}</p>
    ${e.uses ? `<div class="badge" style="margin:14px 0 0">${e.uses} students going</div>` : ''}
    <div class="ledger">
      <div class="ln"><span class="k">At the door</span><span class="was" style="font-size:15px">${money(e.list_eur)}</span></div>
      <div class="ln"><span class="k">Seats left</span><span>${e.left}</span></div>
      <div class="ln total"><span class="k">Student ticket</span><span class="price lg">${money(e.student_eur)}</span></div>
    </div>
    <div style="height:22px"></div>`,
    ME ? `<button class="btn btn--block" id="buy">Buy ticket · ${money(e.student_eur)}</button>`
       : `<button class="btn btn--bronze btn--block" id="join">Verify to buy · ${money(e.student_eur)}</button>`,
    back);
  if (!ME) {
    $('#join').onclick = () => { shut(); askToVerify(
      `This seat is <b>${money(e.student_eur)}</b> for a verified student, ${money(e.list_eur)} at the door.`,
      () => evSheet(e, back)); };
    return;
  }
  $('#buy').onclick = async ev => {
    busy(ev.currentTarget, true, 'Reserving');
    try {
      const r = await Agora.post('/api/events/buy', { event_id: e.id });
      ME.wallet_eur = +(ME.wallet_eur - e.student_eur).toFixed(2); purse();
      pass('Your ticket', e.title_en, r.ticket_code, `${e.when} · paid ${money(r.paid_eur)}`,
           'Show this at the door.');
    } catch (err) { busy(ev.currentTarget, false); toast(err.message, true); }
  };
}

/* ----------------------------------------------------------------- work
   Not a phase-1 tab. The screen is unchanged; only its door moved, from the
   tab bar to the card, so the five that matter keep the thumb. */
function workSheet() {
  sheet('<div id="workbody">' + skeleton(4) + '</div>');
  jobs($('#workbody'));
}

async function jobs(v) {
  const k = PREF.jobkind || '';
  const { jobs } = await Agora.get('/api/jobs', k ? { kind: k } : {});
  v.innerHTML =
    // "I don't understand how students are able to earn something from this"
    // — the name was doing all the explaining and none of it landed. Say what
    // the two things are, who pays, and what Ágora keeps.
    head('III · WORK·AND·LEARNING', 'Earn a little',
      'Two ways to be paid rather than to spend: take a shift at a Segovia business, '
      + 'or teach something you already know to another student. The business or the '
      + 'student pays you; Ágora keeps 10% of a tutoring hour and nothing from a shift.') +
    guestStrip('apply, or teach something yourself') +
    `<div class="filters"><div class="chiprow">${[['', 'Everything'], ['job', 'Shifts'], ['tutoring', 'Tutoring']]
      .map(([v2, l]) => `<button class="chip" data-j="${v2}" aria-pressed="${k === v2}">${l}</button>`).join('')}
      </div></div>` +
    (jobs.length
      ? `<div class="rows stagger">${jobs.map((j, i) => `
          <button class="row-item" data-j2="${j.id}" style="animation-delay:${i * 28}ms">
            <span class="lead">${monogram(j.poster)}</span>
            <span class="body">
              <span class="ttl">${esc(j.title_en)}</span>
              <span class="sub">${esc(j.poster)}${j.schedule ? ' · ' + esc(j.schedule) : ''}</span>
              ${j.hours_per_week ? `<span class="sub cut">${j.hours_per_week}h a week</span>` : ''}
            </span>
            <span class="tail"><span class="price" style="font-size:18px">${money(j.pay_eur)}</span>
              <span class="t-meta">/hour</span></span>
          </button>`).join('')}</div>`
      : emptyState('tablet', 'Nothing open', 'No shifts posted right now.')) +
    `<button class="btn btn--quiet btn--block" id="teach" style="margin:22px 0 8px">
       ${ICON.plus}<span>Offer to teach something</span></button>`;
  wireGuest('Only verified students can apply or teach here.<br><b>That is what keeps it worth reading.</b>');
  v.querySelectorAll('[data-j]').forEach(b => b.onclick = () => { PREF.jobkind = b.dataset.j; savePref(); render(); });
  v.querySelectorAll('[data-j2]').forEach(b => b.onclick = () => jobSheet(jobs.find(j => j.id == b.dataset.j2)));
  $('#teach').onclick = () => ME ? teach()
    : askToVerify('Teaching pays <b>€12–15 an hour</b> here.<br>Verify once to publish your listing.', teach);
}

function jobSheet(j) {
  sheet(`
    <div class="hero">${plate(j.poster || j.title_en, 'j' + j.id)}
      <div class="cap"><div class="k">${j.kind === 'tutoring' ? 'Tutoring' : 'Shift'}</div>
        <div class="n">${esc(j.title_en)}</div></div></div>
    <p class="t-meta">${esc(j.poster)}${j.schedule ? ' · ' + esc(j.schedule) : ''}</p>
    <p class="t-body" style="margin:14px 0 0">${esc(j.detail_en)}</p>
    <div class="ledger">
      <div class="ln"><span class="k">Pay</span><span class="price" style="font-size:21px">${money(j.pay_eur)}/h</span></div>
      ${j.hours_per_week ? `<div class="ln"><span class="k">Hours</span><span>${j.hours_per_week} a week</span></div>` : ''}
    </div>
    ${ME ? `<label class="field" style="margin-top:22px"><span class="lbl">A line about you</span>
      <textarea class="inp" id="msg" placeholder="Second year, free on weekday evenings."></textarea></label>` : ''}`,
    ME ? `<button class="btn btn--block" id="apply">Send application</button>`
       : `<button class="btn btn--bronze btn--block" id="join">Verify to apply</button>`);
  if (!ME) {
    $('#join').onclick = () => { shut(); askToVerify(
      'Businesses only see applications from <b>verified students</b>.', () => jobSheet(j)); };
    return;
  }
  $('#apply').onclick = async e => {
    busy(e.currentTarget, true, 'Sending');
    try {
      await Agora.post('/api/jobs/apply', { job_id: j.id, message: $('#msg').value });
      shut(); toast('Application sent');
    } catch (err) { busy(e.currentTarget, false); toast(err.message, true); }
  };
}

function teach() {
  sheet(`
    <div class="inscript" style="margin:4px 0 10px">Your own listing</div>
    <h2 class="t-title">Teach what you know</h2>
    <p class="t-body" style="margin:14px 0 20px">Other verified students see it. Ágora holds the
      payment until the class happens and keeps 10% of the hour.</p>
    <label class="field"><span class="lbl">Subject</span>
      <input class="inp" id="subj" placeholder="Statistics"><span class="msg"></span></label>
    <label class="field"><span class="lbl">Your rate per hour</span>
      <input class="inp" id="rate" inputmode="decimal" placeholder="15"><span class="msg"></span></label>
    <label class="field"><span class="lbl">When you are free</span>
      <input class="inp" id="sched" placeholder="Weekday evenings"></label>`,
    `<button class="btn btn--block" id="post">Publish listing</button>`);
  $('#post').onclick = async e => {
    fieldError('subj', ''); fieldError('rate', '');
    if (!$('#subj').value.trim()) return fieldError('subj', 'Say what you can teach.');
    busy(e.currentTarget, true, 'Publishing');
    try {
      await Agora.post('/api/jobs/tutoring', {
        subject: $('#subj').value, pay_eur: $('#rate').value, schedule: $('#sched').value });
      shut(); toast('Your listing is live'); render();
    } catch (err) { busy(e.currentTarget, false); fieldError('rate', err.message); }
  };
}


/* -------------------------------------------------- IV · my university
   BENCH — Mecenat and Knaek both show national rankings, which a student in a
   city of two campuses reads as noise. What travels here is what the people in
   your own lecture hall are doing. That is also the dangerous one: a degree-year
   group in Segovia can be a dozen people, so a count can name them. The API
   refuses any cohort under five and this screen says so out loud rather than
   quietly showing a blank. */
const stars = (n, px) => rating(n, px);   // drawn in shared/icons.js

async function campus(v, turn) {
  const sel = { university: PREF.uni || (ME ? ME.university : ''), degree: PREF.degree || '' };
  const d = await Agora.get('/api/university', sel);
  if (stale(turn)) return;
  const unis = d.universities || [];

  // Built in pieces rather than one nested ternary: the version that read as
  // one expression hid a paren mismatch that only the parser could see.
  const places = (d.popular || []).length ? `
    <div class="inscript dim" style="margin:4px 0 11px">WHERE THEY ACTUALLY GO</div>
    <div class="rows stagger">${(d.popular || []).map((r, i) => `
      <button class="row-item" data-pb="${r.business_id}" style="animation-delay:${i * 28}ms">
        <span class="lead">${monogram(r.name)}</span>
        <span class="body">
          <span class="ttl">${esc(r.name)}</span>
          <span class="sub">${r.people} student${r.people === 1 ? '' : 's'} · ${r.buys} time${r.buys === 1 ? '' : 's'}</span>
        </span>
        <span class="tail"><span class="t-meta">saved</span><br>
          <span class="price">${money(r.saved_eur)}</span></span>
      </button>`).join('')}</div>`
    : emptyState('colonnade', 'No pattern yet',
        'Not enough has been bought here to show where this group goes.');

  const written = (d.reviews || []).length ? `
    <div class="inscript dim" style="margin:24px 0 2px">WHAT THEY WROTE</div>
    <div>${d.reviews.map(r => `
      <div class="revcard">
        <div class="top"><span class="vn">${esc(r.business_name)}</span>
          <span class="stars">${stars(r.rating)}</span></div>
        <div class="who">${esc(r.degree || 'Student')}${r.year ? ', year ' + r.year : ''}</div>
        <p class="bd">${esc(r.body)}</p>
      </div>`).join('')}</div>
    <p class="t-meta" style="margin:16px 0 0">Every review is read by a moderator before it
      appears. Nothing here is anonymous to us, and nothing here names anyone to you.</p>` : '';

  const small = `Fewer than ${d.min_cohort} people, so nothing is broken down —
    a count this small would point at individuals.`;

  v.innerHTML =
    head('III · MY·UNIVERSITY', 'Your campus',
      'What students here actually buy — never who. Counts only, and only once a group is big enough to be a group.') +
    (unis.length > 1 ? `<div class="filters"><div class="chiprow">${unis.map(u =>
      `<button class="chip" data-u="${esc(u.name)}" aria-pressed="${d.university === u.name}">${
        esc(u.name.replace('Universidad de Valladolid - Campus Segovia', 'UVa Segovia'))}</button>`).join('')}
      </div></div>` : '') +
    `<div class="filters"><div class="chiprow">
       <button class="chip" data-d="" aria-pressed="${!d.degree}">All degrees</button>
       ${(d.degrees || []).map(x => `
         <button class="chip" data-d="${esc(x.degree)}" aria-pressed="${d.degree === x.degree}"
           aria-disabled="${!x.enough}">${esc(x.degree)}</button>`).join('')}
     </div></div>` +
    `<div class="cohort">
       <div class="n">${d.cohort}</div>
       <div class="k">verified student${d.cohort === 1 ? '' : 's'} in
         <b>${esc(d.degree || d.university)}</b>${d.degree ? '' : ' across every degree'}.
         ${d.enough ? '' : small}</div>
     </div>` +
    (d.enough ? places + written : '') +
    '<div style="height:20px"></div>';

  v.querySelectorAll('[data-u]').forEach(b => b.onclick = () => {
    PREF.uni = b.dataset.u; PREF.degree = ''; savePref(); render();
  });
  v.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
    if (b.getAttribute('aria-disabled') === 'true') {
      return toast(`Fewer than ${d.min_cohort} students on that degree — too few to show on its own`);
    }
    PREF.degree = b.dataset.d; savePref(); render();
  });
  v.querySelectorAll('[data-pb]').forEach(b => b.onclick = async () => {
    const { pins } = await Agora.get('/api/map', {});
    const p = pins.find(x => x.business_id == b.dataset.pb);
    if (p) venueSheet(p);
  });
}

/* --------------------------------------------------------------- V · card */
/* The most uncomfortable screen in the test. One tester noticed that money was
   added "when you click on an amount, without entering any bank details, which
   is a problem" — in a prototype that is a missing payment step, but to anyone
   using it, it is a wallet behaving in a way no wallet should. Three others said
   plainly they would rather show a card than move money through us at all, and
   asked the questions this screen never answered: who holds it, do I get unused
   money back, what happens if a venue does not honour the price.
   So: answer them, and stop pretending a demo credit is a payment. */
function walletSheet() {
  sheet(`
    <div class="inscript" style="margin:4px 0 10px">Your wallet</div>
    <h2 class="t-title">${money(ME.wallet_eur)}</h2>
    <p class="t-body" style="margin:12px 0 18px">You never need it for a discount: a percentage
      comes off at the till and costs nothing here. The wallet is only for things you reserve
      in advance — a ticket, a table, a court.</p>

    <div class="ledger" style="margin-top:0">
      <div class="ln"><span class="k">Who holds it</span><span>Ágora, until the venue confirms your code</span></div>
      <div class="ln"><span class="k">Money you do not spend</span><span>Yours — withdraw any time</span></div>
      <div class="ln"><span class="k">If a venue refuses the price</span><span>Refunded in full</span></div>
      <div class="ln total"><span class="k">If you never turn up</span><span>Released back to you</span></div>
    </div>

    <div class="guest" style="margin:20px 0 0">
      <div class="t" style="font-size:12px;line-height:1.45">
        <b style="color:var(--oxblood)">Demonstration.</b> The buttons below add pretend credit so
        you can try a reservation. No card is asked for because no money moves — a real version
        takes you to your bank.
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:16px">
      ${[10, 25, 50].map(a => `<button class="btn btn--quiet" data-a="${a}">€${a} demo</button>`).join('')}
    </div>
    <div style="height:14px"></div>`, '');
  $('#sheet').querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    busy(b, true);
    try {
      const r = await Agora.post('/api/wallet/topup', { amount_eur: +b.dataset.a });
      ME.wallet_eur = r.wallet_eur; purse(); shut();
      toast('Added ' + money(b.dataset.a) + ' of demo credit');
      if (TAB === 'me') render();
    } catch (e) { busy(b, false); toast(e.message, true); }
  });
}

/* The codes you are carrying right now, read from the device rather than from
   us. This is the block that works in a doorway with no signal. */
function livePasses() {
  const live = PASSES();
  if (!live.length) return '';
  return `<div class="inscript dim">YOUR CODES</div>
    <p class="t-meta" style="margin:8px 0 12px">Kept on this phone, so they still open
      if you have no signal at the door.</p>
    <div class="rows" style="margin:0 0 30px">${live.map(p => `
      <div class="row-item">
        <span class="body"><span class="ttl" style="font-size:15px">${esc(p.venue)}</span>
          <span class="sub">${esc(p.line || '')}</span></span>
        <span class="tail"><span class="passcode">${esc(p.code)}</span></span>
      </div>`).join('')}</div>`;
}

/* BENCH — TOTUM and ISIC make the card itself the product; the member looks at
   it. And UNiDAYS surfaces lifetime savings, which is the number that brings
   people back. Both live on this screen. */
const membershipCard = (s) => `
  <div class="mcard">
    <div class="pat">${arcade(380, 240, 7, 1)}</div>
    <div class="foil"></div>
    <div class="inner">
      <div class="top"><span class="wm">ÁGORA</span>
        <span class="seal">${ICON.check} Verified</span></div>
      <div class="nm">${esc(s.name)}</div>
      <div class="uni">${esc(s.university)}</div>
      <div class="bot"><span class="no">${esc(s.card_no)}</span>
        <span class="since">Member since<br>${esc(s.member_since)}</span></div>
    </div>
  </div>`;

async function card(v, turn) {
  if (!ME) {
    v.innerHTML = head('IV · YOUR·CARD', 'Your card', '') + `
      <div class="mcard" style="opacity:.55">
        <div class="pat">${arcade(380, 240, 7, 1)}</div><div class="foil"></div>
        <div class="inner"><div class="top"><span class="wm">ÁGORA</span></div>
          <div class="nm">Your name here</div>
          <div class="uni">Your university</div>
          <div class="bot"><span class="no">•••• ••••</span>
            <span class="since">Member since<br>—</span></div></div></div>
      <div class="band">
        <div class="c"><div class="v coin">€0.00</div><div class="k">saved</div></div>
        <div class="c"><div class="v">0</div><div class="k">visits</div></div>
        <div class="c"><div class="v">€5</div><div class="k">to start</div></div>
      </div>
      <p class="t-body" style="margin:22px 0 18px">One email from your university and the card is
        yours: a wallet, a price only you get, and every euro you save counted here.</p>
      <button class="btn btn--bronze btn--block" id="getcard">Get my card</button>`;
    $('#getcard').onclick = () => askToVerify(
      'Your card takes one email and about twenty seconds.<br><b>It is free, and always will be.</b>');
    return;
  }
  const [{ student }, act] = await Promise.all([Agora.get('/api/me'), Agora.get('/api/my/activity')]);
  if (stale(turn)) return;
  ME = student; purse();
  v.innerHTML =
    head('IV · YOUR·CARD', esc(student.name.split(' ')[0] + "'s card"), '') +
    membershipCard(student) +
    `<div class="band">
      <div class="c"><div class="v coin">${money(student.saved_eur)}</div><div class="k">saved so far</div></div>
      <div class="c"><div class="v">${student.visits}</div><div class="k">visits</div></div>
      <div class="c"><div class="v">${money(student.wallet_eur)}</div><div class="k">in wallet</div></div>
    </div>
    <div style="display:flex;gap:9px;margin:18px 0 28px">
      <button class="btn btn--quiet btn--sm grow" id="top">Top up</button>
      <button class="btn btn--quiet btn--sm grow" id="inv">${ICON.spark}<span>Invite</span></button>
      <button class="btn btn--quiet btn--sm" id="lang">${ICON.globe}<span>${student.locale === 'en' ? 'ES' : 'EN'}</span></button>
    </div>

    ${livePasses()}

    <div class="inscript dim">RECENT</div>
    ${act.transactions.length ? `<div class="rows" style="margin-top:12px">${act.transactions.map(t => `
      <div class="row-item"><span class="lead">${monogram(t.business_name)}</span>
        <span class="body"><span class="ttl" style="font-size:15px">${esc(t.business_name)}</span>
          <span class="sub">${esc(t.when)} · ${t.status === 'completed' ? 'confirmed' : 'waiting at the till'}</span></span>
        <span class="tail"><span style="font-weight:600">${money(t.paid_eur)}</span><br>
          <span class="t-meta" style="color:var(--verd)">saved ${money(t.saved_eur)}</span></span>
      </div>`).join('')}</div>`
      : `<p class="t-meta" style="margin:12px 0 0">Nothing yet. Open the map and pick a price.</p>`}

    ${act.my_listings.length ? `<div class="inscript dim" style="margin-top:30px">YOU TEACH</div>
      <div class="rows" style="margin-top:12px">${act.my_listings.map(j => `
        <div class="row-item"><span class="body"><span class="ttl" style="font-size:15px">${esc(j.title_en)}</span>
          <span class="sub">${esc(j.schedule || 'Flexible')}</span></span>
          <span class="tail price" style="font-size:18px">${money(j.pay_eur)}</span></div>`).join('')}</div>` : ''}

    ${act.applications.length ? `<div class="inscript dim" style="margin-top:30px">YOU APPLIED</div>
      <div class="rows" style="margin-top:12px">${act.applications.map(a => `
        <div class="row-item"><span class="body"><span class="ttl" style="font-size:15px">${esc(a.title_en)}</span>
          <span class="sub">${esc(a.poster)}</span></span>
          <span class="tail"><span class="badge">${esc(a.status)}</span></span></div>`).join('')}</div>` : ''}

    <button class="btn btn--quiet btn--block" id="work" style="margin:34px 0 0">
      ${ICON.tablet}<span>Shifts and tutoring</span></button>
    <button class="btn btn--plain btn--block" id="out" style="margin:10px 0 10px">Sign out</button>`;
  $('#top').onclick = walletSheet;
  $('#work').onclick = () => workSheet();
  $('#inv').onclick = () => inviteSheet(student);
  $('#lang').onclick = async () => {
    try { await Agora.post('/api/me/locale', { locale: student.locale === 'en' ? 'es' : 'en' });
      render(); toast('Language preference saved'); } catch (e) { toast(e.message, true); }
  };
  $('#out').onclick = async () => { await Agora.post('/api/auth/logout', {}); Agora.token = null; location.reload(); };
}

/* BENCH — every one of these products grows on word of mouth between students;
   the credit lands on both sides, which is what makes it get said out loud. */
function inviteSheet(s) {
  sheet(`
    <div class="inscript" style="margin:4px 0 10px">Bring someone</div>
    <h2 class="t-title">You both get ${s.invite_credit_eur ? money(s.invite_credit_eur) : '€5.00'}</h2>
    <p class="t-body" style="margin:14px 0 20px">Give a classmate your code. When they verify with
      their university email, the credit lands in both wallets.</p>
    <div class="pass" style="border-radius:14px">
      <div class="code" style="font-size:36px;letter-spacing:.2em;padding:24px 18px 20px">${esc(s.invite_code || '—')}</div>
      <div class="foot" style="padding-bottom:26px"><span class="t-meta" style="color:var(--ink-04)">
        ${s.invited_count} already joined through you</span></div>
      <div class="wm">${arcade(360, 26, 10, 0.12)}</div>
    </div>
    <div style="height:18px"></div>`,
    `<button class="btn btn--block" id="copy">Copy the code</button>`);
  $('#copy').onclick = async () => {
    try { await navigator.clipboard.writeText(s.invite_code); toast('Code copied'); }
    catch (e) { toast('Your code is ' + s.invite_code); }
  };
}

/* --------------------------------------------------------------- startup */
(async () => {
  const q = new URLSearchParams(location.search).get('invite');
  if (q) { PREF.invite = q.toUpperCase(); savePref(); }
  // Which venues have a photograph, before the first screen is drawn — so a
  // row never paints its pattern and then swaps to a picture under the thumb.
  await loadPhotos();
  if (Agora.token) {
    try {
      const r = await Agora.get('/api/me');
      if (r.role === 'student') ME = r.student; else Agora.token = null;
    } catch (e) { Agora.token = null; }
  }
  boot();
  if (!ME && PREF.invite) {
    setTimeout(() => askToVerify(
      `A classmate invited you.<br><b>€5 lands in your wallet</b> when you verify.`), 700);
  }
})();
