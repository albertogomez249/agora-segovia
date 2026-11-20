/* Shared behaviour for the public pages: generated art, scroll reveals. */
function wireAppLinks() {
  const base = (window.AGORA_APP_BASE || '').replace(/\/$/, '');
  const local = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  document.querySelectorAll('[data-app]').forEach(a => {
    const path = '/' + a.dataset.app + '/';
    if (base) { a.href = base + path; a.target = '_blank'; a.rel = 'noopener'; return; }
    if (local) { a.href = path; return; }
    // Published without a backend: say so instead of serving a 404.
    a.href = '#demo';
    a.addEventListener('click', e => { e.preventDefault(); demoNote(); });
  });
}

function demoNote() {
  let n = document.getElementById('demoNote');
  if (!n) {
    n = document.createElement('div');
    n.id = 'demoNote';
    n.innerHTML = `<div class="dn-scrim"></div>
      <div class="dn-box">
        <div class="eyebrow">DEMO EN VIVO</div>
        <h3>La app se enseña en directo</h3>
        <p>Esta web es la propuesta de valor. La app de estudiante y la consola de negocio
           corren sobre un servidor propio y se demuestran en la sesión, con datos reales
           de Segovia.</p>
        <p class="en">This site is the value proposition. The student app and the house
           console run on their own server and are demonstrated live.</p>
        <button class="btn btn--quiet" id="dnClose">Entendido</button>
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
