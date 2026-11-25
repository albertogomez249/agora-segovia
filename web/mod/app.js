/* Ágora — review moderation.

   The one screen a venue must never see. Its whole reason to exist is that a
   business cannot delete a review it dislikes, and that a student's words are
   read by a person before they are published. Both of those are promises the
   student app makes out loud, so this console is what makes them true. */
const $ = s => document.querySelector(s);
let ME = null, FILTER = 'pending';

const stars = (n, px) => rating(n, px);   // drawn in shared/icons.js

/* ------------------------------------------------------------------ gate */
$('#send').onclick = async e => {
  const email = $('#email').value.trim();
  fieldError('email', '');
  if (!email) return fieldError('email', 'We need your address.');
  busy(e.currentTarget, true);
  try {
    const r = await Agora.post('/api/auth/request', { email, role: 'moderator' });
    $('#gate1').classList.add('hide'); $('#gate2').classList.remove('hide');
    $('#sent').innerHTML = 'We sent six digits to <b>' + esc(email) + '</b>' +
      '<span class="big">' + r.dev_code + '</span>' +
      '<span style="font-size:12px;opacity:.8">Shown here because this is a demo — ' +
      'in production it only lands in your inbox.</span>';
    $('#code').value = r.dev_code;
    setTimeout(() => $('#verify').focus(), 120);
  } catch (err) { fieldError('email', err.message); }
  finally { busy(e.currentTarget, false); }
};
$('#email').onkeydown = e => { if (e.key === 'Enter') $('#send').click(); };
$('#again').onclick = () => { $('#gate2').classList.add('hide'); $('#gate1').classList.remove('hide'); };
$('#code').oninput = e => { e.target.value = e.target.value.replace(/\D/g, ''); fieldError('code', ''); };

$('#verify').onclick = async e => {
  fieldError('code', ''); busy(e.currentTarget, true, 'Verifying');
  try {
    const r = await Agora.post('/api/auth/verify',
      { email: $('#email').value.trim(), code: $('#code').value.trim() });
    Agora.token = r.token;
    enter($('#email').value.trim());
  } catch (err) { fieldError('code', err.message); }
  finally { busy(e.currentTarget, false); }
};

function enter(email) {
  ME = email;
  $('#gate').classList.add('hide');
  $('#bar').classList.remove('hide');
  $('#who').innerHTML = 'signed in as <b>' + esc(email) + '</b> · ' +
    '<button id="out" style="color:inherit;text-decoration:underline">sign out</button>';
  $('#out').onclick = async () => {
    try { await Agora.post('/api/auth/logout', {}); } catch (e) {}
    Agora.token = null; location.reload();
  };
  render();
}

/* ----------------------------------------------------------------- queue */
const LABEL = { pending: 'waiting on you', published: 'published', rejected: 'rejected' };

async function render() {
  const v = $('#view');
  v.innerHTML = '<p class="t-meta">Loading…</p>';
  let d;
  try { d = await Agora.get('/api/mod/reviews', { status: FILTER }); }
  catch (err) {
    v.innerHTML = `<p class="t-meta">${esc(err.message)}</p>`;
    return;
  }

  // The launch plan's one metric, where the people who could act on it will
  // actually see it. A number that lives in a spreadsheet nobody opens is a
  // number nobody steers by.
  let sp = null;
  try { sp = await Agora.get('/api/mod/second-plan'); } catch (e) { sp = null; }

  v.innerHTML =
    (sp ? `<section class="metric">
       <div class="k inscript dim">THE SECOND PLAN</div>
       <p class="big"><b class="figure">${sp.came_back}</b> of
          <b class="figure">${sp.took_part}</b> who made a plan made another
${sp.median_days === null ? ''
            : `, a median of <b class="figure">${sp.median_days}</b> days later`}.</p>
       <p class="why">A first plan is curiosity and a launch party can manufacture it.
          The second is the moment the product exists for that person, which is why this
          is the number to steer by for the first two months — not downloads, not
          sign-ups. Counted on taking part, not on organising: joining someone else's
          plan is a plan happening for you.
          ${sp.demo ? `<b>These are demonstration figures.</b> The rate is a property
            of invented data, not evidence of anything — the point here is that the
            number is measured and visible, not what it says today.` : ''}</p>
     </section>` : '') +
    `<div class="counts">${['pending', 'published', 'rejected'].map(k => `
       <button data-f="${k}" aria-pressed="${FILTER === k}">
         <span class="n">${d.counts[k]}</span><span class="k">${LABEL[k]}</span></button>`).join('')}
     </div>` +
    (d.reviews.length
      ? d.reviews.map(r => card(r)).join('')
      : `<p class="t-meta">Nothing ${FILTER === 'pending' ? 'waiting' : 'here'}.</p>`) +
    `<p class="note">A moderator sees the writer's full name, because the decision is
       yours and you are accountable for it. Readers never do: the student app shows a
       first name, a degree and a year, which is enough to judge whether the reviewer is
       like you and not enough to find them. Rejecting a review does not delete it.</p>`;

  v.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { FILTER = b.dataset.f; render(); });
  v.querySelectorAll('[data-decide]').forEach(b => b.onclick = () => decide(b));
}

function card(r) {
  const acts = r.status === 'pending'
    ? `<div class="acts">
         <button class="btn btn--sm" data-decide="published" data-id="${r.id}">Publish</button>
         <button class="btn btn--quiet btn--sm" data-decide="rejected" data-id="${r.id}">Reject</button>
       </div>`
    : `<div class="acts">
         <span class="verdict ${r.status === 'published' ? 'pub' : 'rej'}">${esc(r.status)}</span>
         ${r.status === 'rejected'
           ? `<button class="btn btn--plain btn--sm" data-decide="published" data-id="${r.id}">Publish after all</button>`
           : `<button class="btn btn--plain btn--sm" data-decide="rejected" data-id="${r.id}">Take it down</button>`}
       </div>`;
  return `
    <article class="rv" id="rv${r.id}">
      <div class="top">
        <div>
          <div class="venue">${esc(r.business_name)}</div>
          <div class="meta">${esc(r.student_name || 'Student')}${
            r.degree ? ' · ' + esc(r.degree) : ''}${r.year ? ', year ' + r.year : ''}<br>
            ${esc(r.university || '')} · ${esc(r.when || '')}</div>
        </div>
        <div class="stars" title="${r.rating} of 5">${stars(r.rating, 15)}</div>
      </div>
      <div class="body">${esc(r.body)}</div>
      ${acts}
    </article>`;
}

async function decide(btn) {
  const id = btn.dataset.id, decision = btn.dataset.decide;
  busy(btn, true, decision === 'published' ? 'Publishing' : 'Rejecting');
  try {
    await Agora.post('/api/mod/decide', { review_id: +id, decision });
    const el = $('#rv' + id);
    if (el) el.classList.add('gone');
    toast(decision === 'published' ? 'Published' : 'Rejected');
    setTimeout(render, 420);
  } catch (err) { busy(btn, false); toast(err.message, true); }
}

/* Already signed in? The token outlives the tab. */
(async () => {
  if (!Agora.token) return;
  try {
    const r = await Agora.get('/api/me', {});
    if (r.role === 'moderator') return enter('moderator');
  } catch (e) { Agora.token = null; }
})();
