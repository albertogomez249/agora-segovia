/* Shared behaviour for the public pages: generated art, scroll reveals. */

/* The site links to the student app across a tunnel, and a tunnel dies quietly.
   On 23 November it was down while forty-six people were testing, and six of
   them reported the main button as the app rejecting them: "not authorized",
   "a loop", "an error message". They read a dead link as our verification
   turning them away, which is the most damaging thing it could have said.
   So the links are checked before anyone is sent anywhere, and if the app is
   not reachable the page says so in the reader's own language. */
async function appIsUp(base) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    await fetch(base + '/api/health', { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(t);
    return true;
  } catch (e) { return false; }
}

async function wireAppLinks() {
  const base = (window.AGORA_APP_BASE || '').replace(/\/$/, '');
  const local = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  const links = [...document.querySelectorAll('[data-app]')];
  const offline = () => links.forEach(a => {
    a.href = '#demo';
    a.removeAttribute('target');
    a.addEventListener('click', e => { e.preventDefault(); demoNote(); });
  });

  if (!base && local) { links.forEach(a => { a.href = '/' + a.dataset.app + '/'; }); return; }
  if (!base) return offline();          // published without a backend at all

  // Point them at the app, then withdraw the link if it turns out to be dead.
  links.forEach(a => {
    a.href = base + '/' + a.dataset.app + '/';
    a.target = '_blank'; a.rel = 'noopener';
  });
  if (!(await appIsUp(base))) offline();
}

/* Both languages, because this box appears on the English page too and used to
   open in Spanish — on a product whose whole argument is that Segovia is not
   written for you. */
function demoNote() {
  const en = document.documentElement.lang === 'en';
  let n = document.getElementById('demoNote');
  if (!n) {
    n = document.createElement('div');
    n.id = 'demoNote';
    n.innerHTML = `<div class="dn-scrim"></div>
      <div class="dn-box">
        <div class="eyebrow">${en ? 'SHOWN LIVE' : 'DEMO EN VIVO'}</div>
        <h3>${en ? 'The app is not running right now'
                 : 'La app no está levantada ahora mismo'}</h3>
        <p>${en
          ? 'This site is the proposal. The student app and the business console run on our own '
            + 'server and are demonstrated live, so they are only reachable while that server is up '
            + '— which it is not at this moment. Nothing is wrong with your account: there is no '
            + 'account yet.'
          : 'Esta web es la propuesta. La app de estudiante y la consola de negocio corren sobre un '
            + 'servidor propio y se enseñan en directo, así que solo se llega a ellas mientras ese '
            + 'servidor está levantado — y ahora mismo no lo está. No es un problema de tu cuenta: '
            + 'todavía no hay cuenta.'}</p>
        <button class="btn btn--quiet" id="dnClose">${en ? 'Understood' : 'Entendido'}</button>
      </div>`;
    document.body.appendChild(n);
    n.querySelector('.dn-scrim').onclick = () => n.classList.remove('on');
    n.querySelector('#dnClose').onclick = () => n.classList.remove('on');
  }
  requestAnimationFrame(() => n.classList.add('on'));
}

document.addEventListener('DOMContentLoaded', () => {
  document.body.insertAdjacentHTML('afterbegin', plateDefs());
  wireAppLinks();

  document.querySelectorAll('[data-art]').forEach(el => {
    el.innerHTML = plate(el.dataset.art, el.dataset.seed || '');
  });
  document.querySelectorAll('[data-arcade]').forEach(el => {
    const [w, h, n] = el.dataset.arcade.split(',').map(Number);
    el.innerHTML = arcade(w, h, n, 1);
  });
  document.querySelectorAll('[data-icon]').forEach(el => {
    el.innerHTML = ICON[el.dataset.icon] || '';
  });

  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = (Math.min(i, 5) * 60) + 'ms';
    io.observe(el);
  });
});
