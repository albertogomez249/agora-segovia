/* Ágora — the house console. */
const $ = s => document.querySelector(s);
let BIZ = null, PAGE = 'home', COUNTS = {};

const NAV = [
  { id: 'home',      label: 'The house',   icon: 'colonnade' },
  { id: 'assistant', label: 'Assistant',   icon: 'lamp' },
  { id: 'items',     label: 'What is live', icon: 'arcade' },
  { id: 'till',      label: 'Confirm',     icon: 'seal' },
  { id: 'apps',      label: 'Applicants',  icon: 'scroll' },
];

/* ------------------------------------------------------------------ gate */
$('#plateArc').innerHTML = arcade(560, 150, 5, 0.22);

$('#send').onclick = async e => {
  const email = $('#email').value.trim();
  fieldError('email', '');
  if (!email) return fieldError('email', 'We need the address you run the business from.');
  busy(e.currentTarget, true);
  try {
    const r = await Agora.post('/api/auth/request', { email, role: 'business' });
    $('#g1').classList.add('hide'); $('#g2').classList.remove('hide');
    $('#sent').innerHTML = 'Six digits on their way to <b>' + esc(email) + '</b>' +
      '<span class="big">' + r.dev_code + '</span>' +
      '<span style="font-size:12px;opacity:.85">Shown here because this is a demo.</span>';
    $('#code').value = r.dev_code;
    $('#nameWrap').classList.toggle('hide', !!r.existing);
    setTimeout(() => (r.existing ? $('#verify') : $('#name')).focus(), 120);
  } catch (err) { fieldError('email', err.message); }
  finally { busy(e.currentTarget, false); }
};
$('#email').onkeydown = e => { if (e.key === 'Enter') $('#send').click(); };
$('#again').onclick = () => { $('#g2').classList.add('hide'); $('#g1').classList.remove('hide'); };
$('#code').oninput = e => {
  e.target.value = e.target.value.replace(/\D/g, ''); fieldError('code', '');
  if (e.target.value.length === 6 && $('#nameWrap').classList.contains('hide')) $('#verify').click();
};
$('#verify').onclick = async e => {
  fieldError('code', ''); busy(e.currentTarget, true, 'Verifying');
  try {
    const r = await Agora.post('/api/auth/verify', {
      email: $('#email').value.trim(), code: $('#code').value.trim(), name: $('#name').value.trim() });
    Agora.token = r.token; BIZ = r.me.business; enter();
  } catch (err) { fieldError('code', err.message); }
  finally { busy(e.currentTarget, false); }
};
$('#out').onclick = async () => { await Agora.post('/api/auth/logout', {}); Agora.token = null; location.reload(); };

function enter() {
  $('#gate').classList.add('hide'); $('#shell').classList.remove('hide');
  $('#who').innerHTML = '<b>' + esc(BIZ.name) + '</b>' + esc(BIZ.email);
  paintNav();
  go(BIZ.profile_complete ? 'home' : 'assistant');
}
function paintNav() {
  $('#nav').innerHTML = NAV.map(n =>
    `<button data-p="${n.id}" aria-current="${n.id === PAGE}">${ICON[n.icon]}<span>${n.label}</span>
      ${n.id === 'apps' && COUNTS.applications ? `<span class="pip">${COUNTS.applications}</span>` : ''}
      ${n.id === 'till' && COUNTS.pending ? `<span class="pip">${COUNTS.pending}</span>` : ''}</button>`).join('');
  $('#nav').querySelectorAll('[data-p]').forEach(b => b.onclick = () => go(b.dataset.p));
}
function go(p) { PAGE = p; paintNav(); render(); window.scrollTo({ top: 0 }); }

const phead = (label, title, sub) =>
  `<div class="page-head"><div class="inscript">${label}</div><h1>${title}</h1>
   ${sub ? `<p class="sub">${sub}</p>` : ''}</div>`;

async function render() {
  const v = $('#view');
  v.innerHTML = phead('·', '', '') + '<div class="sk" style="height:150px;border-radius:14px"></div>';
  try {
    ({ home, assistant: lab, items, till, apps }[PAGE] || home)(v);
  } catch (e) { v.innerHTML = '<p class="t-meta">' + esc(e.message) + '</p>'; }
}

/* ------------------------------------------------------------- the house */
async function home(v) {
  const d = await Agora.get('/api/biz/dashboard', {});
  BIZ = Object.assign(BIZ || {}, d.business);
  COUNTS = { applications: d.counts.applications, pending: d.totals.pending };
  paintNav();
  const t = d.totals, ZONE = { centro: 'Inside the walls', nueva: 'Nueva Segovia',
    sanlo: 'San Lorenzo', zorrilla: 'José Zorrilla' };
  v.innerHTML =
    phead('I · THE·HOUSE', esc(d.business.name),
      `${esc(ZONE[d.business.zone] || d.business.zone)} · ${d.business.premium
        ? 'Premium, assistant working' : 'Free plan'}`) +
    `<div class="stats">
      <div class="s"><div class="k">Taken through Ágora</div><div class="v coin">${money(t.gross_eur)}</div>
        <div class="n">${t.sales} confirmed sale${t.sales === 1 ? '' : 's'}</div></div>
      <div class="s"><div class="k">You keep</div><div class="v">${money(t.net_eur)}</div>
        <div class="n">after the 8% commission</div></div>
      <div class="s"><div class="k">Students served</div><div class="v">${t.students}</div>
        <div class="n">each one verified by a university</div></div>
      <div class="s"><div class="k">Given back</div><div class="v">${money(t.given_back_eur)}</div>
        <div class="n">as student discount</div></div>
    </div>
    <div class="cols2">
      <div class="panel"><h3>What is live</h3><p class="ph">Everything a student can see from you.</p>
        <div class="kv"><span class="k">Offers at the table</span><span class="v">${d.counts.offers}</span></div>
        <div class="kv"><span class="k">In the agenda</span><span class="v">${d.counts.events}</span></div>
        <div class="kv"><span class="k">Work posted</span><span class="v">${d.counts.jobs}</span></div>
        <div class="kv"><span class="k">Codes waiting at your till</span>
          <span class="v" ${t.pending ? 'style="color:var(--oxblood)"' : ''}>${t.pending}</span></div>
      </div>
      <div class="panel"><h3>What Ágora charges</h3>
        <p class="ph">Only on a sale a student made and your till confirmed.</p>
        <div class="kv"><span class="k">Commission on sales (8%)</span><span class="v">${money(t.commission_eur)}</span></div>
        <div class="kv"><span class="k">Subscription and listings</span><span class="v">${money(t.fees_eur)}</span></div>
        <div style="margin-top:18px"><button class="btn ${d.business.premium ? 'btn--quiet' : 'btn--bronze'} btn--sm" id="prem">
          ${d.business.premium ? 'Turn premium off' : 'Turn premium on · €39 a month'}</button></div>
      </div>
    </div>
    <div class="panel" style="padding:24px 10px 6px">
      <h3 style="padding:0 14px">Recent</h3><p class="ph" style="padding:0 14px">Latest movements on your account.</p>
      <table><thead><tr><th>When</th><th>Student</th><th>Kind</th><th class="num">Paid</th>
        <th class="num">Commission</th><th class="num">You keep</th><th>Status</th></tr></thead>
      <tbody>${d.recent.length ? d.recent.map(r => `<tr>
        <td style="color:var(--ink-04)">${esc(r.when)}</td><td style="font-weight:600">${esc(r.student_name)}</td>
        <td style="color:var(--ink-04)">${esc(r.ref_type)}</td><td class="num">${money(r.paid_eur)}</td>
        <td class="num" style="color:var(--ink-04)">${money(r.commission_eur)}</td>
        <td class="num" style="font-weight:600">${money(r.net_eur)}</td>
        <td><span class="badge ${r.status === 'completed' ? 'badge--live' : ''}">${esc(r.status)}</span></td>
      </tr>`).join('') : `<tr><td colspan="7" style="color:var(--ink-04);padding:26px 14px">
        No sales yet. Publish something and they will appear here the moment a student pays.</td></tr>`}
      </tbody></table>
    </div>`;
  $('#prem').onclick = async e => {
    busy(e.currentTarget, true);
    try { const r = await Agora.post('/api/biz/premium', { on: !d.business.premium });
      toast(r.note); render(); } catch (err) { busy(e.currentTarget, false); toast(err.message, true); }
  };
}

/* -------------------------------------------------------------- assistant */
async function lab(v) {
  const s = await Agora.get('/api/biz/assistant', {});
  v.innerHTML =
    phead('II · THE·ASSISTANT', 'Tell it about the house',
      'It writes your profile in Spanish and English, prices the student offer against your category, and publishes. Pricing is a rule, not a guess — it will tell you when a discount eats your margin.') +
    `<div class="lab">
      <div class="talk">
        <div class="thread" id="thread"></div>
        <div class="quick" id="quick"></div>
        <div class="say">
          <input class="inp" id="say" placeholder="Type your answer…" autocomplete="off">
          <button class="btn btn--bronze" id="send2" style="min-width:104px">Send</button>
        </div>
      </div>
      <div id="side"></div>
    </div>
    <button class="btn btn--plain" id="reset" style="margin:18px 0 0">Start the conversation again</button>`;
  paint(s);
  $('#send2').onclick = () => say($('#say').value);
  $('#say').onkeydown = e => { if (e.key === 'Enter') say($('#say').value); };
  $('#reset').onclick = async () => paint(await Agora.post('/api/biz/assistant/reset', {}));
  $('#say').focus();
}

function paint(s) {
  const th = $('#thread');
  th.innerHTML = s.messages.map((m, i) =>
    `<div class="bub ${m.who}" style="animation-delay:${Math.min(i, 6) * 30}ms">${esc(m.text)}</div>`).join('');
  th.scrollTop = th.scrollHeight;
  const last = s.messages.filter(m => m.who === 'assistant').slice(-1)[0];
  const acts = (last && last.actions) || [];
  $('#quick').innerHTML = acts.map((a, i) => `<button data-q="${i}">${esc(a.label)}</button>`).join('');
  $('#quick').querySelectorAll('[data-q]').forEach(b =>
    b.onclick = () => say(acts[b.dataset.q].send));
  side(s.draft);
  if (s.published) { BIZ.profile_complete = 1; toast('Published — students can see you now'); }
}

function side(d) {
  const el = $('#side');
  if (!d || !d.pricing) {
    el.innerHTML = `<div class="panel">
      <h3>What comes out of this</h3>
      <p class="ph">Seven short answers, then:</p>
      <div class="kv"><span class="k">A profile in Spanish and English</span></div>
      <div class="kv"><span class="k">One student offer, priced for your category</span></div>
      <div class="kv"><span class="k">A margin warning if the discount is too deep</span></div>
      <div class="kv"><span class="k">Then an event and a job, from the same chat</span></div>
      <p class="ph" style="margin:18px 0 0">The three things students open Ágora for, set up once.</p>
    </div>`;
    return;
  }
  const p = d.pricing;
  el.innerHTML = `<div class="draft">
    <div class="inscript on-dark">DRAFT · NOT YET PUBLISHED</div>
    <h4>${esc(d.copy.title_en)}</h4>
    <div class="es">${esc(d.copy.title_es)}</div>
    <div class="ln"><span class="k">Normal price</span><span class="v">${money(p.list_cents / 100)}</span></div>
    <div class="ln hi"><span class="k">Student price</span><span class="v">${money(p.student_cents / 100)}</span></div>
    <div class="ln"><span class="k">They save</span><span class="v">${money(p.saved_cents / 100)}</span></div>
    <div class="ln"><span class="k">Ágora takes (8%)</span><span class="v">${money(p.commission_cents / 100)}</span></div>
    <div class="ln hi"><span class="k">You keep per sale</span><span class="v">${money(p.net_cents / 100)}</span></div>
    ${d.warning ? `<div class="warn">${esc(d.warning)}</div>` : ''}
    <div class="prose"><b>Profile · Español</b>${esc(d.profile.description_es)}</div>
    <div class="prose"><b>Profile · English</b>${esc(d.profile.description_en)}</div>
    <div style="height:26px"></div>
    <div class="wm">${arcade(330, 34, 9, 0.16)}</div>
  </div>`;
}

async function say(text) {
  if (!text.trim()) return;
  $('#say').value = '';
  const th = $('#thread');
  th.insertAdjacentHTML('beforeend', `<div class="bub business">${esc(text)}</div>`);
  th.scrollTop = th.scrollHeight;
  try { paint(await Agora.post('/api/biz/assistant', { message: text })); }
  catch (e) { toast(e.message, true); }
}

/* ----------------------------------------------------------- what is live */
async function items(v) {
  const d = await Agora.get('/api/biz/items', {});
  const list = (arr, type, render) => arr.length
    ? `<div class="rows">${arr.map(x => `
        <div class="row-item" style="align-items:center">
          <span class="body">${render(x)}</span>
          <span class="tail"><button class="btn btn--quiet btn--sm" data-t="${type}" data-id="${x.id}">
            ${x.active ? ICON.pause : ICON.play}<span>${x.active ? 'Pause' : 'Resume'}</span></button></span>
        </div>`).join('')}</div>`
    : `<p class="t-meta" style="padding:10px 0">Nothing yet.</p>`;
  v.innerHTML =
    phead('III · WHAT·IS·LIVE', 'Everything students see',
      'The three verticals, one console. Pause anything and it disappears from the app immediately.') +
    `<div class="cols3">
      <div class="panel"><h3>At the table</h3><p class="ph">Offers, set menus, free tables.</p>
        ${list(d.offers, 'offers', o => `
          <span class="ttl">${esc(o.title_en.replace(/ - .*$/, ''))}</span>
          <span class="sub">${money(o.student_eur)} · was ${money(o.list_eur)} · −${o.discount_pct}%
          ${o.stock ? ' · ' + o.claimed + '/' + o.stock + ' taken' : ''}</span>`)}
        <button class="btn btn--quiet btn--sm btn--block" id="nOffer" style="margin-top:16px">${ICON.plus}<span>New offer</span></button>
      </div>
      <div class="panel"><h3>In the agenda</h3><p class="ph">What is on this week.</p>
        ${list(d.events, 'events', e => `
          <span class="ttl">${esc(e.title_en)}</span>
          <span class="sub">${esc(e.when)} · ${money(e.student_eur)} · ${e.sold}/${e.capacity} sold</span>`)}
        <button class="btn btn--quiet btn--sm btn--block" id="nEvent" style="margin-top:16px">${ICON.plus}<span>New event</span></button>
      </div>
      <div class="panel"><h3>Work</h3><p class="ph">Shifts open to students.</p>
        ${list(d.jobs, 'jobs', j => `
          <span class="ttl">${esc(j.title_en)}</span>
          <span class="sub">${money(j.pay_eur)}/h · ${esc(j.schedule || 'flexible')}</span>`)}
        <button class="btn btn--quiet btn--sm btn--block" id="nJob" style="margin-top:16px">${ICON.plus}<span>Post work</span></button>
      </div>
    </div>
    <div id="form" style="margin:26px 0 0"></div>`;
  v.querySelectorAll('[data-t]').forEach(b => b.onclick = async () => {
    busy(b, true);
    await Agora.post('/api/biz/toggle', { type: b.dataset.t, id: b.dataset.id });
    render();
  });
  $('#nOffer').onclick = fOffer; $('#nEvent').onclick = fEvent; $('#nJob').onclick = fJob;
}

const F = (id, label, ph, mode) =>
  `<label class="field"><span class="lbl">${label}</span>
   <input class="inp" id="${id}" placeholder="${ph || ''}" ${mode ? 'inputmode="' + mode + '"' : ''}>
   <span class="msg"></span></label>`;

function formShell(title, note, inner, cta) {
  $('#form').innerHTML = `<div class="panel" style="max-width:580px">
    <h3>${title}</h3><p class="ph">${note}</p>${inner}
    <button class="btn btn--bronze" id="save" style="min-width:190px">${cta}</button></div>`;
  $('#form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function fOffer() {
  formShell('New offer', 'It appears in the student app the moment you save.', `
    <label class="field"><span class="lbl">Category</span><select class="inp" id="leisure">
      <option value="restaurants">Restaurants</option><option value="products">Products</option>
      <option value="club">Clubbing</option><option value="football">Football</option>
      <option value="theatre">Theatre</option><option value="cinema">Cinema</option>
      <option value="play">Play together</option></select></label>
    <label class="field"><span class="lbl">Shape of the discount</span><select class="inp" id="kind">
      <option value="percent">Percent off</option><option value="fixed">Student price</option>
      <option value="twofor">Two for one</option><option value="bundle">Bundle</option></select></label>
    ${F('t_en', 'Title · English', 'Set menu, starter and main')}
    ${F('t_es', 'Title · Español', 'Menú del día, primero y segundo')}
    ${F('list', 'Normal price (€)', '14', 'decimal')}
    ${F('stu', 'Student price (€)', '9.50', 'decimal')}
    ${F('stock', 'Places (0 = unlimited)', '0', 'numeric')}
    ${F('win', 'Time window', 'Mon–Wed 18:00–20:00')}`, 'Publish offer');
  $('#save').onclick = async e => {
    busy(e.currentTarget, true, 'Publishing');
    try {
      await Agora.post('/api/biz/offers', { kind: $('#kind').value,
        leisure: $('#leisure').value, title_en: $('#t_en').value,
        title_es: $('#t_es').value, list_eur: $('#list').value, student_eur: $('#stu').value,
        stock: $('#stock').value || 0, window_label: $('#win').value });
      toast('Live in the student app'); render();
    } catch (err) { busy(e.currentTarget, false); fieldError('stu', err.message); }
  };
}
function fEvent() {
  formShell('New event', 'Ágora charges €1.20 for each ticket sold.', `
    <label class="field"><span class="lbl">Kind</span><select class="inp" id="cat">
      <option value="party">Party</option><option value="theatre">Theatre</option>
      <option value="concert">Concert</option><option value="sport_play">Sport to play</option>
      <option value="sport_watch">Sport to watch</option><option value="tour">Walk</option></select></label>
    ${F('t_en', 'Title · English', 'Student night')}
    ${F('t_es', 'Title · Español', 'Noche estudiante')}
    ${F('days', 'In how many days', '3', 'numeric')}
    ${F('list', 'Door price (€)', '10', 'decimal')}
    ${F('stu', 'Student price (€)', '5', 'decimal')}
    ${F('cap', 'Capacity', '80', 'numeric')}`, 'Publish event');
  $('#save').onclick = async e => {
    busy(e.currentTarget, true, 'Publishing');
    try {
      await Agora.post('/api/biz/events', { category: $('#cat').value, title_en: $('#t_en').value,
        title_es: $('#t_es').value, in_days: $('#days').value || 3, list_eur: $('#list').value,
        student_eur: $('#stu').value, capacity: $('#cap').value });
      toast('In the agenda'); render();
    } catch (err) { busy(e.currentTarget, false); fieldError('stu', err.message); }
  };
}
function fJob() {
  formShell('Post work', '€25 for thirty days. Applications land in Applicants.', `
    ${F('t_en', 'Title · English', 'Waiter, lunch service')}
    ${F('t_es', 'Title · Español', 'Camarero/a, servicio de comidas')}
    ${F('pay', 'Pay per hour (€)', '9.50', 'decimal')}
    ${F('hrs', 'Hours a week', '12', 'decimal')}
    ${F('sch', 'Schedule', 'Mon–Fri 13:00–16:00')}`, 'Post work');
  $('#save').onclick = async e => {
    busy(e.currentTarget, true, 'Posting');
    try {
      await Agora.post('/api/biz/jobs', { title_en: $('#t_en').value, title_es: $('#t_es').value,
        pay_eur: $('#pay').value, hours_per_week: $('#hrs').value || 0, schedule: $('#sch').value });
      toast('Posted'); render();
    } catch (err) { busy(e.currentTarget, false); fieldError('pay', err.message); }
  };
}

/* ---------------------------------------------------------------- the till */
function till(v) {
  v.innerHTML =
    phead('IV · AT·THE·TILL', 'Confirm a code',
      'The student shows six digits. Confirming them is what releases the money and proves the sale came from Ágora.') +
    `<div class="till">
      <input class="codefield" id="code" maxlength="6" inputmode="numeric" placeholder="······">
      <button class="btn btn--block" id="go" style="margin-top:14px">Confirm</button>
      <div id="out"></div>
    </div>`;
  const run = async () => {
    const code = $('#code').value.trim();
    if (code.length !== 6) return;
    busy($('#go'), true, 'Checking');
    try {
      const r = await Agora.post('/api/biz/redeem', { code });
      $('#out').innerHTML = `<div class="result good">
        <div class="big">${esc(r.student)}</div>
        <div class="t-meta">${esc(r.university)}</div>
        <div class="kv" style="margin-top:12px"><span class="k">Paid</span><span class="v">${money(r.paid_eur)}</span></div>
        <div class="kv"><span class="k">Commission</span><span class="v">${money(r.commission_eur)}</span></div>
        <div class="kv"><span class="k">You keep</span><span class="v" style="color:var(--verd)">${money(r.net_eur)}</span></div>
      </div>`;
      $('#code').value = '';
      COUNTS.pending = Math.max((COUNTS.pending || 1) - 1, 0); paintNav();
    } catch (e) {
      $('#out').innerHTML = `<div class="result bad"><div class="big">Not accepted</div>
        <div class="t-meta">${esc(e.message)}</div></div>`;
    } finally { busy($('#go'), false); $('#code').focus(); }
  };
  $('#go').onclick = run;
  $('#code').oninput = e => {
    e.target.value = e.target.value.replace(/\D/g, '');
    if (e.target.value.length === 6) run();
  };
  $('#code').focus();
}

/* --------------------------------------------------------------- applicants */
async function apps(v) {
  const d = await Agora.get('/api/biz/items', {});
  v.innerHTML =
    phead('V · APPLICANTS', 'Who wants the work',
      'Every one of them verified by a university before they could apply.') +
    (d.applications.length
      ? `<div class="panel" style="padding:24px 10px 6px"><table>
          <thead><tr><th>When</th><th>Student</th><th>University</th><th>For</th><th>What they said</th></tr></thead>
          <tbody>${d.applications.map(a => `<tr>
            <td style="color:var(--ink-04)">${esc(a.when)}</td>
            <td style="font-weight:600">${esc(a.student_name)}</td>
            <td style="color:var(--ink-04)">${esc(a.university)}</td>
            <td>${esc(a.title_en)}</td>
            <td style="color:var(--ink-04)">${esc(a.message || '—')}</td></tr>`).join('')}
          </tbody></table></div>`
      : `<div class="panel"><div class="empty"><div class="ic">${ICON.scroll}</div>
         <div class="t">Nobody yet</div>
         <div class="d">Post a shift in “What is live” and applications arrive here.</div></div></div>`);
}

/* ----------------------------------------------------------------- startup */
(async () => {
  if (!Agora.token) return;
  try {
    const r = await Agora.get('/api/me');
    if (r.role !== 'business') { Agora.token = null; return; }
    BIZ = r.business; enter();
  } catch (e) { Agora.token = null; }
})();
