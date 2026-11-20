/* Transport + the handful of helpers both apps share. */
const Agora = {
  /* Scoped per app: the two consoles share an origin, so one key would mean
     signing into the house would sign you out of the student app. You should be
     able to hold both at once — that is the whole demo. */
  key: location.pathname.indexOf('/business') === 0 ? 'agora_token_house' : 'agora_token_student',
  get token() { return localStorage.getItem(this.key); },
  set token(v) { v ? localStorage.setItem(this.key, v) : localStorage.removeItem(this.key); },

  async call(method, path, body) {
    const o = { method, headers: {} };
    if (this.token) o.headers.Authorization = 'Bearer ' + this.token;
    let url = path;
    if (method === 'GET' && body) {
      const qs = new URLSearchParams(
        Object.entries(body).filter(([, v]) => v !== '' && v != null)).toString();
      if (qs) url += '?' + qs;
    } else if (body) {
      o.headers['Content-Type'] = 'application/json';
      o.body = JSON.stringify(body);
    }
    let res;
    try { res = await fetch(url, o); }
    catch (e) { throw new Error('No connection to Ágora. Is the server running?'); }
    let data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok) throw new Error(data.error || 'Something went wrong (' + res.status + ')');
    return data;
  },
  get(p, b) { return this.call('GET', p, b); },
  post(p, b) { return this.call('POST', p, b); },
};

const money = n => '€' + Number(n).toFixed(2);
const esc = s => String(s == null ? '' : s)
  .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg, bad) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = (bad ? ICON.close : ICON.check) + '<span>' + esc(msg) + '</span>';
  t.className = 'on' + (bad ? ' bad' : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.className = ''; }, 3400);
}

/* Inline field errors read better than a toast that flies past. */
function fieldError(wrapId, message) {
  const w = document.getElementById(wrapId);
  if (!w) return;
  const f = w.closest('.field') || w;
  if (!message) { f.classList.remove('err'); return; }
  f.classList.add('err');
  const m = f.querySelector('.msg');
  if (m) m.textContent = message;
}

function busy(btn, on, label) {
  if (!btn) return;
  if (on) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="ld"></span>' + (label ? '<span>' + esc(label) + '</span>' : '');
  } else {
    btn.disabled = false;
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }
}
