// Shared by carbon.html and learn.html: API helper, login/register card, sidebar user chip.
(function () {
  'use strict';
  var API = 'http://localhost:3000/api';
  var PT = window.PT = { me: null, offline: false };
  var st = document.createElement('style');
  st.textContent = '[hidden]{display:none!important}.sidebar .user a{margin-left:6px;text-decoration:underline;cursor:pointer}';
  document.head.appendChild(st);

  PT.token = function () { try { return localStorage.getItem('token'); } catch (e) { return null; } };
  function save(t) { try { if (t) localStorage.setItem('token', t); else localStorage.removeItem('token'); } catch (e) {} }

  // Resolves { status, data }. Rejects only when the server cannot be reached.
  PT.api = function (path, method, body) {
    var h = { 'Content-Type': 'application/json' }, t = PT.token();
    if (t) h.Authorization = 'Bearer ' + t;
    return fetch(API + path, { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        if (r.status === 204) return { status: 204, data: {} };
        return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, data: d }; });
      });
  };

  PT.init = function () {
    var p = PT.token() ? PT.api('/auth/me') : Promise.resolve({ status: 401 });
    return p.then(function (r) {
      PT.me = r.status === 200 ? r.data : null;
      if (r.status === 401) save(null);
    }).catch(function () { PT.offline = true; PT.me = null; })
      .then(function () { sidebar(); return PT.me; });
  };

  function sidebar() {
    var u = document.querySelector('.sidebar .user');
    if (!u) return;
    var name = PT.me ? (PT.me.name || PT.me.email) : 'Guest';
    u.querySelector('.avatar').textContent = name.slice(0, 2).toUpperCase();
    u.querySelector('strong').textContent = name;
    var sm = u.querySelector('small');
    sm.textContent = PT.me ? (PT.me.role === 'admin' ? 'Admin' : 'Resident') : 'Not logged in';
    if (PT.me) {
      var a = document.createElement('a');
      a.textContent = 'Log out';
      a.onclick = function () { save(null); location.reload(); };
      sm.appendChild(a);
    }
  }

  // Draws a login / register card into `box`, then calls done() after success.
  PT.authCard = function (box, done) {
    var mode = 'login';
    box.innerHTML =
      '<section class="card" style="max-width:440px"><h2 id="au-title">Log in</h2>' +
      '<p class="muted">Log in to use this page.</p>' +
      '<form class="field-stack" style="gap:14px" novalidate>' +
      '<div class="field-stack" id="au-name-wrap" hidden><label for="au-name">Name (optional)</label><input id="au-name" maxlength="60" autocomplete="name"></div>' +
      '<div class="field-stack"><label for="au-email">Email</label><input id="au-email" type="email" autocomplete="email"></div>' +
      '<div class="field-stack"><label for="au-pass">Password</label><input id="au-pass" type="password" autocomplete="current-password"></div>' +
      '<div id="au-msg" class="notice notice--error" role="alert" hidden></div>' +
      '<button class="btn btn--dark btn--block" type="submit" id="au-go">Log in</button></form>' +
      '<p class="muted"><a href="#" id="au-switch">New here? Create an account</a></p></section>';
    var q = function (id) { return box.querySelector('#' + id); };
    q('au-switch').onclick = function (e) {
      e.preventDefault();
      mode = mode === 'login' ? 'register' : 'login';
      var reg = mode === 'register';
      q('au-title').textContent = reg ? 'Create an account' : 'Log in';
      q('au-go').textContent = reg ? 'Create account' : 'Log in';
      q('au-name-wrap').hidden = !reg;
      q('au-switch').textContent = reg ? 'Already have an account? Log in' : 'New here? Create an account';
      q('au-msg').hidden = true;
    };
    box.querySelector('form').onsubmit = function (e) {
      e.preventDefault();
      var msg = q('au-msg');
      var body = { email: q('au-email').value.trim(), password: q('au-pass').value };
      if (mode === 'register') body.name = q('au-name').value;
      PT.api('/auth/' + mode, 'POST', body).then(function (r) {
        if (r.status === 200 || r.status === 201) { save(r.data.token); PT.me = r.data.user; sidebar(); done(); }
        else { msg.textContent = r.data.message || 'Something went wrong. Try again.'; msg.hidden = false; }
      }).catch(function () {
        msg.textContent = 'Can\u2019t reach the server. Is the backend running (npm start)?'; msg.hidden = false;
      });
    };
  };
})();
