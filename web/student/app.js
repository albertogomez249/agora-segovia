/* Ágora — student app.
   Where a decision came from the international benchmark (UNiDAYS, Student Beans,
   TOTUM, Knaek, Mecenat, Carte Culture) it is marked BENCH. */
const $ = s => document.querySelector(s);
let ME = null, TAB = 'shop', RESUME = null;
const PREF = JSON.parse(localStorage.getItem('agora_pref') || '{}');
const savePref = () => localStorage.setItem('agora_pref', JSON.stringify(PREF));

const TABS = [
  { id: 'shop',   label: 'Table',  icon: 'amphora' },
  { id: 'events', label: 'Agenda', icon: 'arch' },
  { id: 'jobs',   label: 'Work',   icon: 'tablet' },
  { id: 'me',     label: 'Card',   icon: 'bust' },
];

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

/* ----------------------------------------------------------------- sheet */
function sheet(inner, footer) {
  $('#sheet').innerHTML =
    `<button class="sheet-x" id="sx" aria-label="Close">${ICON.close}</button>
     <div class="grab"><i></i></div>
     <div class="scrollable">${inner}</div>
     ${footer ? `<div class="foot">${footer}</div>` : '<div style="height:22px"></div>'}`;
  $('#sheet').classList.add('on'); $('#scrim').classList.add('on');
  $('#sx').onclick = shut;
}
function shut() { $('#sheet').classList.remove('on'); $('#scrim').classList.remove('on'); }
$('#scrim').onclick = shut;

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
  <div class="guest" style="background:var(--stone-02);color:var(--ink-02)">
    <div class="t" style="font-size:12.5px;line-height:1.45">
      <b style="color:var(--oxblood)">Demonstration.</b> These are real Segovia businesses,
      but the discounts, prices and reviews are invented. Nothing here is an offer.
    </div>
  </div>`;

const guestStrip = (what) => ME ? '' : `
  <div class="guest">
    <div class="t">You are just looking. <b>Verify your university email</b> to ${what}.</div>
    <button class="btn btn--bronze btn--sm" id="gstrip">Verify</button>
  </div>`;
const wireGuest = (why) => {
  const b = $('#gstrip'); if (b) b.onclick = () => askToVerify(why);
};

async function render() {
  const v = $('#view');
  v.innerHTML = head('·', '', '') + skeleton(5);
  try {
    if (TAB === 'shop') return shop(v);
    if (TAB === 'events') return events(v);
    if (TAB === 'jobs') return jobs(v);
    return card(v);
  } catch (e) { v.innerHTML = emptyState('close', 'We could not load this', e.message); }
}

/* ----------------------------------------------------------- I · the table */
/* Four kinds that mean the same thing to a roast house, a cinema and a padel
   court. The time window is an attribute of the offer, not a kind of its own. */
const KIND = { percent: 'Percent off', fixed: 'Student price', twofor: 'Two for one', bundle: 'Bundle' };
const ZONE = { centro: 'Old town', nueva: 'Nueva Segovia', sanlo: 'San Lorenzo', zorrilla: 'J. Zorrilla' };

async function shop(v) {
  const f = { kind: PREF.kind || '', zone: PREF.zone || '' };
  const { offers } = await Agora.get('/api/offers', f);
  const now = offers.filter(o => o.discount_pct >= 40).slice(0, 6);
  const kinds = [['', 'Everything'], ['percent', 'Percent off'], ['fixed', 'Student price'],
                 ['twofor', 'Two for one'], ['bundle', 'Bundles']];
  const zones = [['', 'All Segovia'], ...Object.entries(ZONE)];
  v.innerHTML =
    head('I · SHOP·AND·DINE', 'At the table',
      'Prices held for verified students, inside the walls and beyond them.') +
    demoNote() +
    guestStrip('pay from your phone and keep what you save') +
    (now.length && !f.kind ? `
      <div class="inscript dim" style="margin:0 0 11px">BIGGEST CUTS TODAY</div>
      <div class="rail">${now.map(o => `
        <button class="railcard" data-o="${o.id}">
          <span class="art">${plate(o.business_name, 'o' + o.id)}
            <span class="over"><span class="n">${esc(o.business_name)}</span>
            <span class="m">${esc(o.window_label || ZONE[o.zone] || '')}</span></span></span>
          <span class="bar"><span class="p">${money(o.student_eur)}</span>
            <span class="w">${money(o.list_eur)}</span></span>
        </button>`).join('')}</div>` : '') +
    `<div class="filters"><div class="chiprow">${kinds.map(([k, l]) =>
      `<button class="chip" data-k="${k}" aria-pressed="${f.kind === k}">${l}</button>`).join('')}</div></div>` +
    `<div class="filters"><div class="chiprow">${zones.map(([k, l]) =>
      `<button class="chip" data-z="${k}" aria-pressed="${f.zone === k}">${l}</button>`).join('')}</div></div>` +
    (offers.length
      ? `<div class="rows stagger">${offers.map((o, i) => `
          <button class="row-item" data-o="${o.id}" style="animation-delay:${i * 32}ms">
            <span class="lead">${monogram(o.business_name)}</span>
            <span class="body">
              <span class="ttl">${esc(o.title_en.replace(/ - .*$/, ''))}</span>
              <span class="sub">${esc(o.business_name)} · ${esc(ZONE[o.zone] || o.zone)}</span>
              <span class="sub cut">${KIND[o.kind]} · −${o.discount_pct}%</span>
              ${proof(o)}
            </span>
            <span class="tail"><span class="price">${money(o.student_eur)}</span><br>
              <span class="was">${money(o.list_eur)}</span></span>
          </button>`).join('')}</div>`
      : emptyState('amphora', 'Nothing open here', 'Try another part of the city, or clear the filter.'));
  wireGuest('Verify once.<br><b>Then every table in Segovia is one tap away.</b>');
  v.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { PREF.kind = b.dataset.k; savePref(); render(); });
  v.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { PREF.zone = b.dataset.z; savePref(); render(); });
  v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => offer(offers.find(o => o.id == b.dataset.o)));
}

function offer(o) {
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
      <div class="ln"><span class="k">Normal price</span><span class="was" style="font-size:15px">${money(o.list_eur)}</span></div>
      <div class="ln"><span class="k">You save</span><span style="color:var(--verd)">−${money(o.saved_eur)}</span></div>
      <div class="ln total"><span class="k">Your price</span><span class="price lg">${money(o.student_eur)}</span></div>
    </div>
    <p class="t-meta" style="margin:16px 0 22px">Paid from your wallet now. The venue releases it when
      they confirm your code, so you are never charged for a table you did not take.</p>`,
    ME ? `<button class="btn btn--block" id="pay">Pay ${money(o.student_eur)}</button>`
       : `<button class="btn btn--bronze btn--block" id="join">Verify to claim · ${money(o.student_eur)}</button>`);
  if (!ME) {
    $('#join').onclick = () => { shut(); askToVerify(
      `<b>${esc(o.business_name)}</b> holds this price for verified students.<br>One email, once.`,
      () => offer(o)); };
    return;
  }
  $('#pay').onclick = async e => {
    busy(e.currentTarget, true, 'Paying');
    try {
      const r = await Agora.post('/api/offers/claim', { offer_id: o.id });
      ME.wallet_eur = +(ME.wallet_eur - o.student_eur).toFixed(2); purse();
      pass('Show this at the till', o.business_name, r.code,
           `Paid ${money(r.paid_eur)} · saved ${money(r.saved_eur)}`,
           `${esc(o.business_name)} confirms it on their side and the money is released.`);
    } catch (err) { busy(e.currentTarget, false); toast(err.message, true); }
  };
}

function pass(title, venue, code, line, note) {
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

/* ---------------------------------------------------------- II · the agenda */
const EV = { party: 'Party', theatre: 'Theatre', concert: 'Concert',
             sport_play: 'Play', sport_watch: 'Watch', tour: 'Walk' };

async function events(v) {
  const { events } = await Agora.get('/api/events', {});
  v.innerHTML =
    head('II · THE·AGENDA', 'This week',
      'Parties, theatre, concerts, matches to watch and sport to play together.') +
    demoNote() +
    guestStrip('buy a student ticket') +
    (events.length
      ? `<div class="stagger">${events.map((e, i) => `
          <button class="evcard" data-e="${e.id}" style="animation-delay:${i * 36}ms">
            <span class="art">${plate(e.title_en, 'e' + e.id)}
              <span class="tagline">${EV[e.category] || e.category}</span>
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
          </button>`).join('')}</div>`
      : emptyState('arch', 'The agenda is quiet', 'Nothing on sale right now. Come back on Thursday.'));
  wireGuest('Student tickets are held for verified students.<br><b>One email, once.</b>');
  v.querySelectorAll('[data-e]').forEach(b => b.onclick = () => evSheet(events.find(e => e.id == b.dataset.e)));
}

function evSheet(e) {
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
       : `<button class="btn btn--bronze btn--block" id="join">Verify to buy · ${money(e.student_eur)}</button>`);
  if (!ME) {
    $('#join').onclick = () => { shut(); askToVerify(
      `This seat is <b>${money(e.student_eur)}</b> for a verified student, ${money(e.list_eur)} at the door.`,
      () => evSheet(e)); };
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

/* ------------------------------------------------------------- III · work */
async function jobs(v) {
  const k = PREF.jobkind || '';
  const { jobs } = await Agora.get('/api/jobs', k ? { kind: k } : {});
  v.innerHTML =
    head('III · WORK·AND·LEARNING', 'Earn a little',
      'Shifts from Segovia businesses, and classes taught by students like you.') +
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
            <span class="tail"><span class="price" style="font-size:19px">${money(j.pay_eur)}</span>
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
      <div class="ln"><span class="k">Pay</span><span class="price" style="font-size:20px">${money(j.pay_eur)}/h</span></div>
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

/* --------------------------------------------------------------- IV · card */
function walletSheet() {
  sheet(`
    <div class="inscript" style="margin:4px 0 10px">Your wallet</div>
    <h2 class="t-title">${money(ME.wallet_eur)}</h2>
    <p class="t-body" style="margin:12px 0 20px">Top up once, then pay anywhere in Segovia
      without taking out a card.</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px">
      ${[10, 25, 50].map(a => `<button class="btn btn--quiet" data-a="${a}">€${a}</button>`).join('')}
    </div>`, '');
  $('#sheet').querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    busy(b, true);
    try {
      const r = await Agora.post('/api/wallet/topup', { amount_eur: +b.dataset.a });
      ME.wallet_eur = r.wallet_eur; purse(); shut(); toast('Added ' + money(b.dataset.a));
      if (TAB === 'me') render();
    } catch (e) { busy(b, false); toast(e.message, true); }
  });
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

async function card(v) {
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

    <div class="inscript dim">RECENT</div>
    ${act.transactions.length ? `<div class="rows" style="margin-top:12px">${act.transactions.map(t => `
      <div class="row-item"><span class="lead">${monogram(t.business_name)}</span>
        <span class="body"><span class="ttl" style="font-size:15px">${esc(t.business_name)}</span>
          <span class="sub">${esc(t.when)} · ${t.status === 'completed' ? 'confirmed' : 'waiting at the till'}</span></span>
        <span class="tail"><span style="font-weight:600">${money(t.paid_eur)}</span><br>
          <span class="t-meta" style="color:var(--verd)">saved ${money(t.saved_eur)}</span></span>
      </div>`).join('')}</div>`
      : `<p class="t-meta" style="margin:12px 0 0">Nothing yet. Your first table is waiting under Table.</p>`}

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

    <button class="btn btn--plain btn--block" id="out" style="margin:34px 0 10px">Sign out</button>`;
  $('#top').onclick = walletSheet;
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
      <div class="code" style="font-size:34px;letter-spacing:.2em;padding:24px 18px 20px">${esc(s.invite_code || '—')}</div>
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
