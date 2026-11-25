/* Screens, the lights, the clock, sounds, sharing, friends and the live counters. Game state lives in this browser. */
(function () {
  'use strict';
  var E = window.BaitEngine;
  var NAME = 'Not So Fast';            // change it here and it changes everywhere
  var SITE = 'playnotsofast.com';
  var LINK = 'https://' + SITE + '/';
  var LIMIT = 180;                     // seconds for all three questions on your own: one clock, not three
  var PARTY_LIMIT = 60;                // seconds per player when one phone is passed round
  var KEY = 'nsf.v4', OLD_KEY = 'daily.v3';
  var SETV = 'v10';                     // bump when the question bank changes: today's set restarts and counts never mix

  // Live counters: anonymous tallies on a free public counting service.
  // Set STATS to '' to switch them off. Nothing about the player is sent.
  var STATS = 'https://abacus.jasoncameron.dev';
  var STATS_NS = 'playnotsofast.com';
  var BUCKETS = [10, 20, 40, 70, 121]; // upper edge, in seconds, of each solve-time band
  var MIN_CROWD = 10;                  // do not show a percentage until this many have answered
  var PLACE_DAY = 11;                  // finishing times have been counted since day 11; earlier days only have greens

  var EMOJI = { right: '🟢', bait: '🔴', wrong: '🔴', time: '🔴' };
  var WORD = { right: 'Correct', bait: 'Not so fast', wrong: 'Wrong', time: 'Out of time' };
  // The whole game is three lights and one clock. A right answer turns a light green and the next
  // question arrives by itself: green means go. Anything else turns it red and stops you, to show
  // why: red means stop. The clock runs only while a question is on screen. Three greens is the goal.
  var LEVEL = { 1: 'Easy', 2: 'Tricky', 3: 'Hard' };
  var STEP = 270;                      // metres the road behind the screen moves on for each green light
  var FS = { right: 1, bait: 1, wrong: 1, time: 1 };   // the four verdicts
  var RIVAL_D = /^d(\d{1,5})$/, RIVAL_T = /^t([A-Z0-9]{1,8})-([1-9]\d?)$/;   // the two kinds of game a friend's link can point at

  var app = document.getElementById('app');
  var view = document.getElementById('view');
  var veil = document.getElementById('veil');
  var toastEl = document.getElementById('toast');
  document.getElementById('brand').textContent = NAME;
  document.title = NAME;

  var hadLocal = false;
  var store = load();
  var game = null, ask = null, typed = '', ticker = null, countdown = null, pending = null, seq = [], toastTimer = null, fresh = false, lastBeep = -1;
  var table = { code: '', round: 1 };
  var cfg = { names: (store.names || []).slice(0, 6), count: 5 };
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var desk = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;   // a laptop: type the answer
  if (desk) document.body.classList.add('desk');
  var RUN_LIMIT = 60, RUN_LIVES = 3;   // endless mode: a minute a question, three reds and you are out
  var kindTotal = 0;
  var quiet = 0;       // taps are ignored until this time: a second tap must not land on the screen the first one opened
  var broke = false;
  // Opened from a link inside another app, the game runs in that app's own browser, which keeps its own storage.
  var UA = navigator.userAgent || '';
  var INAPP = /musical_ly|Bytedance|TikTok|Trill_/i.test(UA) ? 'TikTok' : /Instagram/i.test(UA) ? 'Instagram' : /Snapchat/i.test(UA) ? 'Snapchat' : /FBAN|FBAV|FBIOS|FB_IAB/.test(UA) ? 'Facebook' : '';
  var BROWSER = /Android/i.test(UA) ? 'Chrome' : /iPhone|iPad|iPod/i.test(UA) ? 'Safari' : 'your usual browser';

  function blank() { return { sound: false, stats: { played: 0, perfect: 0, streak: 0, best: 0, lastDay: 0, dist: [0, 0, 0, 0] }, daily: null, names: [], rival: null, live: null, seen: {}, recent: [] }; }

  /* Nothing read back from storage is trusted. A half-written save, an older version or a curious
     player with the developer tools open must never be able to break the page, so every value is
     rebuilt from scratch and anything that does not make sense is dropped. */
  function int(v, lo, hi, d) { v = Number(v); return isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d; }
  function okRes(r, limit) {
    if (!r || typeof r !== 'object' || FS[r.f] !== 1) return null;
    var t = r.f === 'time' ? '' : String(r.t == null ? '' : r.t).slice(0, 12);
    if (r.f !== 'time' && !isFinite(parseFloat(t))) return null;
    var o = { t: t, f: r.f, secs: int(r.secs, 0, limit, 0) }, c = r.crowd;
    if (r.skip && r.f === 'time') o.skip = 1;
    if (c && typeof c === 'object' && isFinite(c.n) && c.n >= 0) o.crowd = { n: int(c.n, 0, 1e9, 0), r: int(c.r, 0, 1e9, 0), t: int(c.t, 0, 1e9, 0), slower: int(c.slower, 0, 1e9, 0) };
    return o;
  }
  function okSt(d, limit) {   // three questions in progress: the answers so far, and which one is on screen
    if (!d || typeof d !== 'object' || !Array.isArray(d.res)) return null;
    var res = [], i, r, now = Date.now(), q = Number(d.qStart);
    for (i = 0; i < 3 && i < d.res.length; i++) { r = okRes(d.res[i], limit); if (!r) break; res.push(r); }
    var idx = int(d.idx, 0, 2, 0);
    if (idx > res.length) idx = res.length;          // cannot be on a question without answering the one before
    if (idx < res.length - 1 && !res[idx + 1].skip) idx = res.length - 1;   // unless the clock ran out there and the rest were never reached
    return { idx: Math.min(2, idx), res: res, qStart: isFinite(q) && q > 0 && q < now + 60000 ? q : now, done: d.done === true && res.length === 3 };
  }
  function okDaily(d) {
    var st = okSt(d, LIMIT);
    if (!st || typeof d.v !== 'string' || !isFinite(d.day)) return null;
    st.v = d.v.slice(0, 8); st.day = int(d.day, 1, 1e6, 1);
    if (Array.isArray(d.field) && d.field.length === 4) st.field = d.field.map(function (x) { return int(x, 0, 1e9, 0); });
    if (st.field && d.place && typeof d.place === 'object') st.place = { faster: int(d.place.faster, 0, 1e9, 0), tie: int(d.place.tie, 0, 1e9, 0) };
    return st;
  }
  function okRival(v) {
    if (!v || typeof v !== 'object' || typeof v.key !== 'string') return null;
    var o = { key: v.key, n: int(v.n, 0, 3, 0), s: int(v.s, 0, 999, 0), at: int(v.at, 1, Date.now(), Date.now()) }, m;
    if (RIVAL_D.test(v.key)) return o;
    if (!(m = RIVAL_T.exec(v.key))) return null;
    o.code = m[1]; o.round = +m[2]; if (v.played) o.played = 1;
    return o;
  }
  function clean(s) {
    var b = blank(), st = (s.stats && typeof s.stats === 'object' && s.stats) || {}, i, age = s.live && typeof s.live === 'object' ? Date.now() - Number(s.live.at) : NaN;
    b.sound = s.sound === true; if (s.demo) b.demo = 1;
    ['played', 'perfect', 'streak', 'best', 'lastDay'].forEach(function (k) { b.stats[k] = int(st[k], 0, 1e6, 0); });
    for (i = 0; i < 4; i++) b.stats.dist[i] = int(st.dist && st.dist[i], 0, 1e6, 0);
    b.stats.runTop = int(st.runTop, 0, 1e5, 0);
    if (Array.isArray(s.names)) b.names = s.names.slice(0, 6).map(function (n) { return String(n == null ? '' : n).slice(0, 10); });
    if (s.seen && typeof s.seen === 'object') Object.keys(s.seen).slice(0, 500).forEach(function (k) { if (/^[a-z0-9]{3,40}$/.test(k)) b.seen[k] = 1; });
    if (Array.isArray(s.recent)) b.recent = s.recent.filter(function (k) { return typeof k === 'string' && /^[a-z0-9]{3,40}$/.test(k); }).slice(-90);   // the kinds endless mode has shown, oldest first
    b.daily = okDaily(s.daily); b.rival = okRival(s.rival);
    if (age > -60000 && age < 6 * 3600 * 1000 && s.live.v === SETV && s.live.game && typeof s.live.game === 'object') b.live = { v: SETV, at: Number(s.live.at), game: s.live.game };   // checked again when it is resumed
    return b;
  }
  function parse(raw) { var s = JSON.parse(raw); return s && typeof s === 'object' && !Array.isArray(s) ? s : null; }
  function load() {
    try {
      var s = parse(localStorage.getItem(KEY));
      if (s && s.stats) { hadLocal = true; return clean(s); }
      var old = parse(localStorage.getItem(OLD_KEY));  // keep the streak from the earlier version
      if (old && old.stats && old.stats.dist) { hadLocal = true; return clean({ stats: old.stats }); }
    } catch (e) { /* storage may be unavailable */ }
    return blank();
  }
  function peek() { try { var s = parse(localStorage.getItem(KEY)); return s && s.stats ? clean(s) : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* play on without it */ } }

  /* More than one tab. Each tab holds its own copy of the save, so without care the last one to
     write would wipe what another had done. adopt() takes in what was written elsewhere and keeps
     whatever this tab is further on with. It returns true when storage should be rewritten. */
  function rank(d) { return d && d.v === SETV ? d.day * 100 + (d.done ? 50 : 0) + d.res.length * 10 + d.idx : -1; }
  function adopt() {
    var p = peek(), fix = false, a = store.stats, b, k;
    if (!p) return false;
    b = p.stats;
    if (a.played > b.played || (a.played === b.played && a.lastDay > b.lastDay)) { p.stats = a; b = a; fix = true; }
    else { k = Math.max(a.runTop || 0, b.runTop || 0); if (k !== b.runTop) { b.runTop = k; fix = true; } }
    for (k in store.seen) if (!p.seen[k]) { p.seen[k] = 1; fix = true; }
    if (rank(store.daily) >= rank(p.daily)) { if (rank(store.daily) > rank(p.daily)) fix = true; p.daily = store.daily; }
    if (game && (game.mode === 'run' || game.mode === 'party' || game.mode === 'table')) p.live = store.live;   // this tab's own game: written again at its next step
    if (store.demo) p.demo = 1;
    store = p;
    return fix;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function today() { return E.dayNumber(new Date()); }
  function dateLine() { return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function mmss(sec) { sec = Math.max(0, Math.round(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function untilMidnight() {
    var n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
    var s = Math.max(0, Math.floor((m - n) / 1000));
    var h = Math.floor(s / 3600), mi = Math.floor((s % 3600) / 60), se = s % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi + ':' + (se < 10 ? '0' : '') + se;
  }
  function stopTimers() {
    if (ticker) { clearInterval(ticker); ticker = null; }
    if (countdown) { clearInterval(countdown); countdown = null; }
    if (pending) { clearTimeout(pending); pending = null; }
    seq.forEach(clearTimeout); seq = [];
  }
  function runCountdown() {
    var day = today();
    countdown = setInterval(function () {
      var el = document.getElementById('cd');
      if (!el) { clearInterval(countdown); countdown = null; return; }
      if (today() !== day) { stopTimers(); home(); return; }
      el.textContent = untilMidnight();
    }, 1000);
  }
  function toast(msg) {
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 1600);
  }
  function scoreLine(n, s) { return n + ' of 3 in ' + mmss(s); }
  function beat(q, r) { if (r.f !== 'right') return; store.seen = store.seen || {}; if (!store.seen[q.kind]) { store.seen[q.kind] = 1; save(); } }
  function beatenLine() {
    if (!kindTotal) kindTotal = E.kinds().length;
    return 'Kinds of trap you have beaten: ' + Object.keys(store.seen || {}).filter(function (k) { return E.GRADE.hasOwnProperty(k); }).length + ' of ' + kindTotal + '.';
  }
  function rightCount(st) { return st.res.filter(function (r) { return r && r.f === 'right'; }).length; }
  function totalSecs(st) { var t = 0; st.res.forEach(function (r) { if (r) t += r.secs; }); return t; }
  function liveStreak() { var s = store.stats; return s.lastDay >= today() - 1 ? s.streak : 0; }
  function dailyState() {
    var d = store.daily;
    if (!d || d.day !== today() || d.v !== SETV) return 'new';
    return d.done ? 'done' : 'going';
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function times(n) { return n === 1 ? 'once' : n === 2 ? 'twice' : n + ' times'; }

  /* ---------- The sign on the front page ---------- */
  function oct(s) {
    var a = 35.15, pts = [[a, 0], [120 - a, 0], [120, a], [120, 120 - a], [120 - a, 120], [a, 120], [0, 120 - a], [0, a]];
    return pts.map(function (p) { return (60 + (p[0] - 60) * s).toFixed(1) + ',' + (60 + (p[1] - 60) * s).toFixed(1); }).join(' ');
  }
  function sign() {
    var ys = [45.5, 70, 94.5];
    return '<svg viewBox="0 0 120 120" role="img" aria-label="Not so fast"><polygon points="' + oct(1) + '" fill="#fff"/><polygon points="' + oct(0.9) + '" fill="#D8281C"/><polygon points="' + oct(0.9) + '" fill="url(#sheen)"/>' +
      ['NOT', 'SO', 'FAST'].map(function (w, i) { return '<text x="60" y="' + ys[i] + '" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="29" fill="#fff">' + w + '</text>'; }).join('') + '</svg>';
  }
  var ICON = {
    on: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    off: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9z" fill="currentColor"/><path d="M16 9l5.5 6M21.5 9L16 15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    del: '<svg viewBox="0 0 28 20" aria-hidden="true"><path d="M9.5 1.5H25a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H9.5L1.5 10z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M13.5 6.5l7 7M20.5 6.5l-7 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>'
  };

  /* ---------- Sound and buzz ---------- */
  var AC = window.AudioContext || window.webkitAudioContext, actx = null;
  function audio() {
    if (!store.sound || !AC) return null;
    try { if (!actx) actx = new AC(); if (actx.state === 'suspended') actx.resume(); } catch (e) { return null; }
    return actx;
  }
  function tone(freq, at, dur, type, vol, slide) {
    var a = audio(); if (!a) return;
    try {
      var o = a.createOscillator(), g = a.createGain(), t = a.currentTime + at;
      o.type = type || 'triangle';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + dur + 0.03);
    } catch (e) { /* sound is a nicety */ }
  }
  var SFX = {
    key: function () { tone(700, 0, 0.05, 'triangle', 0.09); },
    del: function () { tone(360, 0, 0.05, 'triangle', 0.09); },
    lock: function () { tone(150, 0, 0.14, 'sine', 0.32, 70); },
    beep: function () { tone(1000, 0, 0.04, 'square', 0.035); },
    right: function () { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, i * 0.075, 0.24, 'triangle', 0.2); }); tone(1568, 0.3, 0.4, 'sine', 0.09); },
    bait: function () { [0, 0.21].forEach(function (s) { tone(311, s, 0.16, 'sawtooth', 0.11); tone(392, s, 0.16, 'sawtooth', 0.09); }); },  // a double honk
    wrong: function () { tone(330, 0, 0.16, 'triangle', 0.2); tone(247, 0.15, 0.3, 'triangle', 0.2); },
    time: function () { tone(392, 0, 0.55, 'triangle', 0.2, 185); },
    sweep: function () { [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach(function (f, i) { tone(f, i * 0.085, 0.32, 'triangle', 0.2); }); }
  };
  function buzz(p) {
    try { if (navigator.vibrate && !(navigator.userActivation && !navigator.userActivation.hasBeenActive)) navigator.vibrate(p); } catch (e) { /* not every phone can */ }   // browsers refuse it before the first tap
  }
  function paintSound() {
    var b = document.getElementById('snd');
    b.innerHTML = store.sound ? ICON.on : ICON.off;
    b.setAttribute('aria-label', store.sound ? 'Sound is on. Turn it off' : 'Sound is off. Turn it on');
  }

  /* ---------- Lights ---------- */
  function replay(el, cls) { if (!el || calm) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function lamp(state, extra) { return '<i class="lt ' + state + (extra ? ' ' + extra : '') + '"></i>'; }
  function lightOf(r) { return r.f === 'right' ? 'green' : 'red'; }
  // Three lights are the goal and the score in one. now: the question being asked. lit: the one that has
  // just changed. When the clock ran out there, the lights it took with it turn red one after another.
  function lightsHtml(res, now, cls, lit) {
    var h = '', g = 0, k, r, out = lit >= 0 && res[lit] && res[lit].f === 'time';
    for (k = 0; k < 3; k++) {
      r = res[k]; if (r && r.f === 'right') g++;
      var fresh1 = k === lit || (out && k > lit && r && r.skip);
      h += '<i class="lt ' + (r ? lightOf(r) : k === now ? 'now' : 'off') + (fresh1 ? ' lit' : '') + '"' + (fresh1 && k > lit ? ' style="animation-delay:' + ((k - lit) * 0.22) + 's"' : '') + '></i>';
    }
    return '<div class="lights' + (cls ? ' ' + cls : '') + '" role="img" aria-label="' + g + ' of 3 green">' + h + '</div>';
  }
  function react(f) { SFX[f](); buzz(f === 'right' ? [15, 40, 25] : 60); }

  // The road is only a backdrop. It moves on a stretch each time a light turns green, from the
  // street lamps in town out to open country, where the sky is the reward for three greens.
  var GLOW = ['#ffb347', '#ffa23c', '#ff7d3c', '#6fa3ff', '#4fd6c4'];
  var bgEl = document.getElementById('bg'), cv = document.createElement('canvas'), g2 = cv.getContext && cv.getContext('2d');
  bgEl.appendChild(cv);
  var road = { d: 0, from: 0, to: 0, t0: 0, ms: 0, cb: null, W: 0, H: 0, dpr: 1, last: 0, dirty: true, car: 0, nextCar: 0 };
  var STARS = (function () { var r = E.rngFrom('stars'), a = []; for (var i = 0; i < 230; i++) a.push([r(), r(), i < 46 ? 0.6 + r() * 1.1 : 0.5 + r() * 0.9, r() * 6.3]); return a; })();
  var DUST = (function () { var r = E.rngFrom('dust'), a = []; for (var i = 0; i < 170; i++) a.push([r() * 2 - 1, (r() + r() + r() - 1.5) * 0.11, 0.2 + r() * 0.55]); return a; })();
  function rnd(k) { var x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }   // the same "random" value for the same object every frame
  function rgba(hex, a) { return 'rgba(' + parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16) + ',' + a + ')'; }
  function glowIndex(m) { return m >= 700 ? 4 : m >= 500 ? 3 : m >= 250 ? 2 : m >= 1 ? 1 : 0; }
  function fitRoad() {
    road.dpr = Math.min(2, window.devicePixelRatio || 1); road.W = bgEl.clientWidth; road.H = bgEl.clientHeight;
    cv.width = Math.round(road.W * road.dpr); cv.height = Math.round(road.H * road.dpr); road.dirty = true;
  }
  function paintRoad(now) {
    var c = g2, W = road.W, H = road.H, d = road.d, k, z, s, x, y, side;
    if (!c || !W) return;
    c.setTransform(road.dpr, 0, 0, road.dpr, 0, 0); c.globalAlpha = 1;
    var hy = Math.round(H * 0.3) + (road.ms ? Math.sin(now / 36) * 1.3 : 0), cx = W / 2, S = Math.min(W, H * 0.66);
    var zn = 5, A = zn * (H - hy), P = 0.8 * S * zn / 3.3, far = 300;
    var Y = function (zz) { return hy + A / zz; }, X = function (xx, zz) { return cx + xx * P / zz; };
    var glow = GLOW[glowIndex(d)];
    var near = function (zz) { return road.ms ? 1 : Math.max(0, Math.min(1, (zz - 11) / 14)); };   // stopped: fade out whatever is right beside you

    // The sky is where the road is taking you. In town the street lights wash it out. The further
    // you get, the darker the ground and the more the sky opens: more stars, the Milky Way,
    // then planets and an aurora once you are far from any lamp.
    var dark = Math.max(0, Math.min(1, (d - 300) / 420)), deep = Math.max(0, Math.min(1, (d - 620) / 180));
    var sky = c.createLinearGradient(0, 0, 0, hy); sky.addColorStop(0, '#04060c'); sky.addColorStop(1, '#182139');
    c.fillStyle = sky; c.fillRect(0, 0, W, hy + 2);
    if (dark > 0.03) {
      c.save(); c.translate(cx + S * 0.08, hy * 0.42); c.rotate(-0.55);
      c.save(); c.scale(1, 0.2);
      var mw = c.createRadialGradient(0, 0, 0, 0, 0, S * 1.05); mw.addColorStop(0, 'rgba(178,190,255,' + (0.22 * dark) + ')'); mw.addColorStop(1, 'rgba(178,190,255,0)');
      c.fillStyle = mw; c.beginPath(); c.arc(0, 0, S * 1.05, 0, 6.3); c.fill(); c.restore();
      c.fillStyle = '#fff';
      for (k = 0; k < DUST.length; k++) { c.globalAlpha = dark * DUST[k][2]; c.fillRect(DUST[k][0] * S, DUST[k][1] * S, 1, 1); }
      c.restore();
    }
    c.fillStyle = '#fff';
    for (k = 0; k < STARS.length; k++) {   // the first few show even in town; the rest come out as it gets darker
      c.globalAlpha = (calm ? 0.75 : 0.5 + 0.4 * Math.sin(now / 900 + STARS[k][3])) * (k < 46 ? 1 : dark);
      c.fillRect(STARS[k][0] * W, STARS[k][1] * hy * 0.92, STARS[k][2], STARS[k][2]);
    }
    c.globalAlpha = 1;
    var mr = Math.max(7, S * 0.024), mx = cx - S * 0.36, my = hy * 0.62;
    c.fillStyle = '#ece8d6'; c.beginPath(); c.arc(mx, my, mr, 0, 6.3); c.fill();
    c.fillStyle = '#131a2f'; c.beginPath(); c.arc(mx + mr * 0.5, my - mr * 0.3, mr * 0.9, 0, 6.3); c.fill();
    if (deep > 0) {
      // the aurora: a curtain of thin rays with a sharp lower edge, green low down and violet above
      c.save(); c.globalCompositeOperation = 'lighter';
      if (!road.aur) { road.aur = c.createLinearGradient(0, 0, 0, 1); road.aur.addColorStop(0, 'rgba(150,110,255,0)'); road.aur.addColorStop(0.4, 'rgba(140,120,255,0.3)'); road.aur.addColorStop(0.8, 'rgba(70,255,170,0.75)'); road.aur.addColorStop(0.93, 'rgba(120,255,190,0.95)'); road.aur.addColorStop(1, 'rgba(70,255,170,0)'); }
      c.fillStyle = road.aur;
      var tm = calm ? 0 : now / 3200, sw = Math.max(3, Math.round(W / 280));
      for (var au = 0; au < 2; au++) for (x = 0; x < W; x += sw) {
        var ux = x / S, wave = Math.sin(ux * 3.1 + tm + au * 2.2) + 0.5 * Math.sin(ux * 7.3 - tm * 1.4 + au);
        var ray = 0.5 + 0.5 * Math.sin(ux * 46 + tm * 3 + 4 * Math.sin(ux * 5 + au * 3)), fold = 0.5 + 0.5 * Math.sin(ux * 2.3 - tm * 0.7 + au * 1.7);
        var bot = hy * (0.66 - au * 0.2 + 0.09 * wave), tall = hy * (0.3 + 0.16 * ray);
        c.globalAlpha = deep * (au ? 0.2 : 0.42) * (0.25 + 0.75 * ray) * (0.2 + 0.8 * fold);
        c.save(); c.translate(x, bot - tall); c.scale(1, tall); c.fillRect(0, 0, sw, 1); c.restore();
      }
      c.restore();
      // a ringed planet and a small red one, lit from the left, sitting in the gap the dials leave clear
      var px = cx + S * 0.2, py = hy * 0.36, pr = Math.max(4.5, S * 0.023);
      c.globalAlpha = deep;
      c.strokeStyle = 'rgba(232,214,176,0.8)'; c.lineWidth = Math.max(1, pr * 0.16);
      c.beginPath(); c.ellipse(px, py, pr * 2, pr * 0.5, -0.35, Math.PI, 2 * Math.PI); c.stroke();
      var pg = c.createRadialGradient(px - pr * 0.4, py - pr * 0.35, pr * 0.1, px, py, pr); pg.addColorStop(0, '#f3dfb4'); pg.addColorStop(0.7, '#c9a56c'); pg.addColorStop(1, '#6d5536');
      c.fillStyle = pg; c.beginPath(); c.arc(px, py, pr, 0, 6.3); c.fill();
      c.beginPath(); c.ellipse(px, py, pr * 2, pr * 0.5, -0.35, 0, Math.PI); c.stroke();
      var qx = cx - S * 0.05, qy = hy * 0.22, qr = Math.max(2, S * 0.006);
      var qg = c.createRadialGradient(qx, qy, 0, qx, qy, qr * 4); qg.addColorStop(0, 'rgba(255,150,110,0.55)'); qg.addColorStop(1, 'rgba(255,150,110,0)');
      c.fillStyle = qg; c.beginPath(); c.arc(qx, qy, qr * 4, 0, 6.3); c.fill();
      c.fillStyle = '#ffb08e'; c.beginPath(); c.arc(qx, qy, qr, 0, 6.3); c.fill();
      c.globalAlpha = 1;
    }
    if (road.shoot) {   // a shooting star
      var sk = (now - road.shoot[0]) / 480;
      if (sk >= 1) road.shoot = null;
      else {
        var sx = road.shoot[1] * W + sk * S * 0.3, sy = road.shoot[2] * hy * 0.5 + sk * S * 0.13, sg = c.createLinearGradient(sx, sy, sx - S * 0.12, sy - S * 0.052);
        sg.addColorStop(0, 'rgba(255,255,255,' + (1 - sk) + ')'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        c.strokeStyle = sg; c.lineWidth = 1.6; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - S * 0.12, sy - S * 0.052); c.stroke();
      }
    }
    c.save(); c.translate(cx, hy); c.scale(1, 0.26);
    var gr = c.createRadialGradient(0, 0, 0, 0, 0, S * 0.95); gr.addColorStop(0, rgba(glow, 0.85 - 0.45 * dark)); gr.addColorStop(1, rgba(glow, 0));
    c.fillStyle = gr; c.beginPath(); c.arc(0, 0, S * 0.95, 0, 6.3); c.fill(); c.restore();
    c.fillStyle = '#070910'; c.beginPath(); c.moveTo(0, hy + 2);
    for (x = 0; x <= W + 8; x += 8) { var u = (x - cx) / S + d * 0.00012; c.lineTo(x, hy - S * (1 + 1.1 * dark) * (0.014 + 0.024 * (Math.sin(u * 5.1 + 1) + 1) + 0.012 * (Math.sin(u * 11.3 + 2) + 1)) * (0.3 + Math.min(1, Math.abs((x - cx) / S) * 2.4))); }
    c.lineTo(W, hy + 2); c.fill();

    // ground and tarmac
    c.fillStyle = '#0a0b0e'; c.fillRect(0, hy, W, H - hy);
    var rg = c.createLinearGradient(0, hy, 0, H); rg.addColorStop(0, '#101115'); rg.addColorStop(1, '#383a42');
    c.fillStyle = rg; c.beginPath(); c.moveTo(cx - 1.2, hy); c.lineTo(cx + 1.2, hy); c.lineTo(X(3.3, zn), H); c.lineTo(X(-3.3, zn), H); c.fill();

    // what stands beside the road, far to near: houses, then town blocks, then trees
    for (k = Math.floor((d + far) / 17); k >= Math.max(0, Math.floor(d / 17)); k--) {
      var at = k * 17 + 9; z = at - d; if (z < 4 || z > far) continue;
      s = P / z; y = Y(z); side = k % 2 ? 1 : -1; c.globalAlpha = Math.min(1, 150 / z) * near(z);
      if (at < 700) {
        var town = at >= 260, bw = (town ? 9 : 7) * s, bh = (town ? 7 + 7 * rnd(k) : 4.4) * s; x = X(side * (town ? 13 : 11 + 3 * rnd(k)), z);
        c.fillStyle = '#0c0e16'; c.fillRect(x - bw / 2, y - bh, bw, bh);
        if (!town) { c.beginPath(); c.moveTo(x - bw * 0.58, y - bh); c.lineTo(x, y - bh - 2.3 * s); c.lineTo(x + bw * 0.58, y - bh); c.fill(); }
        var cols = town ? 3 : 2, rows = town ? Math.max(1, Math.floor(bh / s / 3)) : 1;
        for (var wy = 0; wy < rows; wy++) for (var wx = 0; wx < cols; wx++) {
          c.fillStyle = rnd(k * 31 + wy * 7 + wx) > 0.45 ? '#ffd27a' : '#1a2032';
          c.fillRect(x - bw / 2 + bw * (wx + 0.5) / cols - 0.5 * s, y - bh + (0.9 + wy * 3) * s, s, 1.3 * s);
        }
      } else {
        var th = (7 + 5 * rnd(k)) * s; x = X(side * (7.5 + 5 * rnd(k + 3)), z);
        c.fillStyle = '#05070b'; c.beginPath(); c.moveTo(x - 2.1 * s, y - 1.2 * s); c.lineTo(x, y - th); c.lineTo(x + 2.1 * s, y - 1.2 * s); c.fill(); c.fillRect(x - 0.2 * s, y - 1.3 * s, 0.4 * s, 1.3 * s);
      }
    }
    // street lamps through the built-up stretch, each with a pool of light on the road
    for (k = Math.floor((d + far) / 45); k >= Math.max(0, Math.floor(d / 45)); k--) {
      var la = k * 45 + 30; z = la - d; if (z < 4 || z > far || la < 100 || la > 700) continue;
      s = P / z; y = Y(z); side = k % 2 ? 1 : -1; x = X(side * 5.1, z); var lx = X(side * 3.5, z), ly = y - 6.2 * s;
      c.globalAlpha = Math.min(1, 120 / z) * near(z);
      c.fillStyle = 'rgba(255,207,122,0.1)'; c.beginPath(); c.ellipse(X(side * 2, z), y, 3 * s, Math.max(1, 4 * A / (z * z)), 0, 0, 6.3); c.fill();
      c.strokeStyle = '#2a2c33'; c.lineWidth = Math.max(1, 0.12 * s); c.beginPath(); c.moveTo(x, y); c.lineTo(x, ly); c.lineTo(lx, ly); c.stroke();
      var lg = c.createRadialGradient(lx, ly, 0, lx, ly, 2.4 * s); lg.addColorStop(0, 'rgba(255,214,140,0.9)'); lg.addColorStop(0.25, 'rgba(255,207,122,0.35)'); lg.addColorStop(1, 'rgba(255,207,122,0)');
      c.fillStyle = lg; c.beginPath(); c.arc(lx, ly, 2.4 * s, 0, 6.3); c.fill();
    }
    c.globalAlpha = 1;
    // edge lines, lane dashes and reflector posts
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(cx - 1.2, hy); c.lineTo(X(-3.3, zn), H); c.moveTo(cx + 1.2, hy); c.lineTo(X(3.3, zn), H); c.stroke();
    c.fillStyle = '#FFD21F';
    for (k = Math.floor((d + far) / 9); k >= Math.floor(d / 9); k--) {
      var z0 = k * 9 - d, z1 = z0 + 3.2; if (z1 < 2.4) continue; if (z0 < 2.4) z0 = 2.4;
      c.globalAlpha = Math.min(1, 30 / z0);
      c.beginPath(); c.moveTo(X(-0.1, z0), Y(z0)); c.lineTo(X(0.1, z0), Y(z0)); c.lineTo(X(0.1, z1), Y(z1)); c.lineTo(X(-0.1, z1), Y(z1)); c.fill();
    }
    for (k = Math.floor((d + far) / 20); k >= Math.floor(d / 20); k--) {
      z = k * 20 + 10 - d; if (z < 3) continue; s = P / z; c.globalAlpha = Math.min(1, 46 / z);
      c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(X(-3.9, z), Y(z) - 0.6 * s, Math.max(0.7, 0.075 * s), 0, 6.3); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(X(3.9, z), Y(z) - 0.6 * s, Math.max(0.7, 0.075 * s), 0, 6.3); c.fill();
    }
    c.globalAlpha = 1;
    // a car coming the other way, now and then, while you are stopped
    if (road.car > 0) {
      z = road.car; s = P / z; y = Y(z) - 0.65 * s;
      for (side = -1; side <= 1; side += 2) {
        x = X(1.75 + side * 0.72, z); var hr = Math.max(1.2, 0.13 * s), hg = c.createRadialGradient(x, y, 0, x, y, hr * 7);
        hg.addColorStop(0, 'rgba(255,255,255,0.95)'); hg.addColorStop(0.15, 'rgba(255,248,224,0.5)'); hg.addColorStop(1, 'rgba(255,248,224,0)');
        c.fillStyle = hg; c.beginPath(); c.arc(x, y, hr * 7, 0, 6.3); c.fill();
      }
    }
    // your own headlights on the road in front
    var hl = c.createRadialGradient(cx, H * 1.02, 0, cx, H * 1.02, S * 0.85); hl.addColorStop(0, 'rgba(255,244,214,0.16)'); hl.addColorStop(1, 'rgba(255,244,214,0)');
    c.fillStyle = hl; c.fillRect(0, hy, W, H - hy);
  }
  function roadLoop(now) {
    requestAnimationFrame(roadLoop);
    if (document.hidden || !road.W) return;
    if (road.ms) {   // driving: ease in, ease out
      var k = Math.min(1, (now - road.t0) / road.ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      road.d = road.from + (road.to - road.from) * e; road.car = 0;
      if (k >= 1) { road.ms = 0; var cb = road.cb; road.cb = null; road.d = road.to; paintRoad(now); road.last = now; if (cb) cb(); return; }
    } else {
      if (calm) { if (!road.dirty) return; }
      else {
        if (now - road.last < 45 && !road.dirty) return;   // idle: about 20 frames a second is plenty for stars and the odd car
        if (!road.car && now > road.nextCar) { road.car = road.nextCar ? 240 : 0; road.nextCar = now + 7000 + Math.random() * 9000; }
        if (!road.shoot && road.d > 420 && now > (road.nextShoot || 0)) { if (road.nextShoot) road.shoot = [now, 0.1 + Math.random() * 0.6, 0.2 + Math.random() * 0.9]; road.nextShoot = now + 6000 + Math.random() * 9000; }
        if (road.car > 0) { road.car -= 240 * Math.min(100, now - road.last) / 2200; if (road.car < 2.5) road.car = 0; }
      }
    }
    road.dirty = false; road.last = now;
    paintRoad(now);
  }
  function setRoad(m) { if (road.ms) return; road.d = m; road.dirty = true; }
  function drive(to, ms, cb) {
    if (calm || !g2 || Math.abs(to - road.d) < 1) { road.d = to; road.dirty = true; if (cb) cb(); return; }
    road.from = road.d; road.to = to; road.ms = ms; road.cb = cb || null; road.t0 = performance.now();
  }
  fitRoad(); window.addEventListener('resize', fitRoad);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { road.dirty = true; });
  requestAnimationFrame(roadLoop);

  /* ---------- How today's players did: anonymous counts of how many greens each finished with ---------- */
  function readField(day, mine) {
    var jobs = [];
    for (var b = 0; b < 4; b++) jobs.push(api(b === mine ? 'hit' : 'get', SETV + 'd' + day + 'g' + b));
    return Promise.all(jobs);
  }
  // Where one finished game sits among the day's: more greens first, then the faster time. Each finisher
  // adds one to a 30-second band and to a 5-second band inside it, under their number of greens; the bands
  // faster than their own say how many were quicker. Counts only: nothing here says who anyone is.
  function placeCost(secs) { var t = Math.max(0, Math.min(LIMIT - 1, secs)); return 2 + Math.floor(t / 30) + Math.floor(t % 30 / 5); }   // requests one placing takes
  function readPlace(day, greens, secs) {
    var t = Math.max(0, Math.min(LIMIT - 1, secs)), C = Math.floor(t / 30), F = Math.floor(t % 30 / 5), base = SETV + 'd' + day + 'g' + greens + 'c', j;
    var jobs = [api('hit', base + C), api('hit', base + C + 'f' + F)];
    for (j = 0; j < C; j++) jobs.push(api('get', base + j));
    for (j = 0; j < F; j++) jobs.push(api('get', base + C + 'f' + j));
    return Promise.all(jobs).then(function (v) {
      var faster = 0; for (var k = 2; k < v.length; k++) faster += v[k];
      return { faster: faster, tie: Math.max(0, v[1] - 1) };
    });
  }
  function fieldNow(day) {   // the front page's read of today's field, kept for a minute so a reload does not ask again
    var k = 'nsf.field', now = Date.now(), d = store.daily;
    if (d && d.done && d.day === day && d.v === SETV && d.field) return Promise.resolve(d.field);
    try { var m = JSON.parse(sessionStorage.getItem(k)); if (m && m.d === day && m.v === SETV && now - m.at < 60000 && now >= m.at && Array.isArray(m.c) && m.c.length === 4) return Promise.resolve(m.c.map(function (x) { return int(x, 0, 1e9, 0); })); } catch (e) { /* no session storage */ }
    return readField(day, -1).then(function (c) { try { sessionStorage.setItem(k, JSON.stringify({ d: day, v: SETV, at: now, c: c })); } catch (e) { /* fine */ } return c; });
  }
  function fieldLine(c) {   // numbers only, so safe to set as HTML
    var n = c[0] + c[1] + c[2] + c[3];
    if (n < MIN_CROWD) return '';
    var pct = Math.round(c[3] / n * 100);
    return '<b>' + E.num(n) + '</b> players today. ' + (pct < 50 ? 'Only ' : '') + '<b>' + pct + '%</b> got all three.';
  }

  // How one finished game did against the day so far: more greens first, then the faster time. `c` is the
  // field by greens, this player included; `p`, when the times could be read, says how many with the same
  // greens were faster and how many share the same five seconds. Without it, players level on greens count
  // as level. Numbers only, so safe as HTML.
  function placeLine(c, mine, p) {
    var n = c[0] + c[1] + c[2] + c[3], others = n - 1, behind = 0, ahead = 0, g;
    if (n < 2) return standingLine(c, mine);
    for (g = 0; g < mine; g++) behind += c[g];
    for (g = mine + 1; g < 4; g++) ahead += c[g];
    var level = Math.max(0, c[mine] - 1), faster = p ? Math.min(p.faster, level) : 0, tie = p ? Math.min(p.tie, level - faster) : level;
    behind += level - faster - tie;
    var all = others === 1 ? 'the only other player' : 'all <b>' + E.num(others) + '</b> other players';
    if (p && mine === 3 && ahead + faster === 0) {   // nobody with three greens was quicker
      if (c[3] === 1) return '<b class="first">The only one with all three so far today.</b> <span class="more">You did better than ' + all + '.</span>';
      if (!tie) return '<b class="first">Fastest three greens so far today.</b> <span class="more">You did better than ' + all + '.</span>';
      return '<b class="first">Equal fastest three greens so far today.</b>' + (n >= MIN_CROWD ? ' <span class="more">You did better than <b>' + Math.floor(behind / others * 100) + '%</b> of players.</span>' : '');
    }
    if (behind < 1) return standingLine(c, mine);
    if (n < MIN_CROWD) return 'You did better than <b>' + behind + '</b> of the <b>' + others + '</b> other players so far today.';
    return 'You did better than <b>' + Math.max(1, Math.floor(behind / others * 100)) + '%</b> of players today.';
  }
  // The day's players by how many greens they got, with this player's own row lit. Numbers only.
  function distHtml(c, mine) {
    var n = c[0] + c[1] + c[2] + c[3], max = Math.max(c[0], c[1], c[2], c[3]), out = '', g;
    if (n < 2) return '';
    for (g = 3; g >= 0; g--) {
      out += '<div class="drow' + (g === mine ? ' me' : '') + '"><span class="dl">' + g + (g === 1 ? ' green' : ' greens') + '</span>' +
        '<span class="db"><i style="width:' + Math.round(c[g] / max * 100) + '%"></i></span>' +
        '<span class="dn">' + (n < MIN_CROWD ? E.num(c[g]) : Math.round(c[g] / n * 100) + '%') + (g === mine ? ' <em>you</em>' : '') + '</span></div>';
    }
    return out;
  }

  // The same counts, read for one player: how their greens compare with everyone else's today.
  // `c` already includes this player. Numbers only, so safe to set as HTML.
  function standingLine(c, mine) {
    var n = c[0] + c[1] + c[2] + c[3], others = n - 1, below = 0, g;
    if (n < 1) return '';
    if (n === 1) return 'You are the first to play today.';
    if (n < MIN_CROWD) return 'You are one of <b>' + n + '</b> players so far today.';
    for (g = 0; g < mine; g++) below += c[g];
    var all = Math.round(c[3] / n * 100), beat = Math.round(below / others * 100), none = Math.round(Math.max(0, c[0] - 1) / others * 100), of = ' of today’s <b>' + E.num(n) + '</b> players';
    if (mine >= 3) return all < 50 ? 'Top <b>' + all + '%</b>' + of + '.' : '<b>' + all + '%</b>' + of + ' got all three.';
    if (mine > 0 && beat > 0) return 'You beat <b>' + beat + '%</b>' + of + '.';
    if (mine === 0 && none > 0) return '<b>' + none + '%</b> of today’s <b>' + E.num(n) + '</b> also got none.';
    return '<b>' + all + '%</b>' + of + ' got all three.';
  }

  /* ---------- Analytics: who comes, where from, and how they get on ----------
     PostHog, on its EU cloud, in cookieless mode: nothing is stored on the player's device and no
     identifier is kept, so a visitor is counted by a hash that changes every day. Every event carries
     only what just happened in the game. PH_KEY is the project key from PostHog (public by design);
     while it is empty nothing is loaded and nothing is sent. It only ever runs on the live site. */
  var PH_KEY = window.__NSF_PH_KEY != null ? String(window.__NSF_PH_KEY) : '/*PH_KEY*/';   // filled in by build.js from analytics.json
  var PH_HOST = '/*PH_HOST*/' || 'https://eu.i.posthog.com';
  var LIVE = /(^|\.)playnotsofast\.com$/.test(location.hostname);
  var ph = null, phq = [];
  // Where this visit came from: a tagged link (?utm_source=tiktok, or ?c=name for one creator's link), the app it was opened in, or the referring site.
  var CREATOR = (function () { var m = /[?&]c=([A-Za-z0-9_-]{1,30})(&|#|$)/.exec(location.search || ''); return m ? m[1].toLowerCase() : ''; })();
  var SRC = (function () {
    var m = /[?&]utm_source=([A-Za-z0-9_.-]{1,30})(&|#|$)/.exec(location.search || '');
    if (m) return m[1].toLowerCase();
    if (CREATOR) return 'creator';
    if (INAPP) return INAPP.toLowerCase();
    try { var h = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; return !h || /playnotsofast\.com$/.test(h) ? 'direct' : h.slice(0, 40); } catch (e) { return 'direct'; }
  })();
  // Where this visit came from and what it is played on: carried by every event, PostHog's own page views included.
  function visit() {
    var p = { src: SRC, in_app: INAPP || 'no', keypad: desk ? 'computer' : 'phone' };
    if (CREATOR) p.creator = CREATOR;
    return p;
  }
  function track(name, props) {
    if (!PH_KEY || !LIVE) return;
    var p = visit(), k;
    for (k in props) p[k] = props[k];
    if (ph) { try { ph.capture(name, p); } catch (e) { /* analytics never breaks the game */ } }
    else if (phq.length < 300) phq.push([name, p]);
  }
  function loadAnalytics() {
    if (!PH_KEY || !LIVE || ph) return;
    var s = document.createElement('script');
    s.async = true; s.crossOrigin = 'anonymous';
    s.src = PH_HOST.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js';
    s.onload = function () {
      try {
        var lib = window.posthog;
        lib.init(PH_KEY, { api_host: PH_HOST, defaults: '2026-01-30', cookieless_mode: 'always', person_profiles: 'never',
          autocapture: false, capture_pageview: true, capture_pageleave: true, disable_session_recording: true, disable_surveys: true, advanced_disable_flags: true,
          loaded: function (p) { try { p.register(visit()); } catch (e) {} } });   // kept in memory only, so the first page view carries it too
        ph = window.posthog || lib;
        phq.forEach(function (e) { ph.capture(e[0], e[1]); }); phq = [];
      } catch (e) { ph = null; }
    };
    document.head.appendChild(s);
  }
  // The few facts worth knowing about one answer, the same in every mode.
  // Streaks go out as a band, never the exact count: an exact streak would let one device be picked
  // out from one day to the next, and the game promises it sends nothing that says who you are.
  function streakBand(n) { return n <= 1 ? '1 day' : n <= 3 ? '2 to 3 days' : n <= 7 ? '4 to 7 days' : n <= 30 ? '8 to 30 days' : 'over 30 days'; }
  function trackAnswer(mode, q, r, slot, extra) {
    var p = { mode: mode, slot: slot, kind: q.kind, grade: q.grade, level: LEVEL[q.level], verdict: r.f === 'bait' ? 'trap' : r.f, secs: r.secs }, k;
    if (r.f !== 'time' && isFinite(parseFloat(r.t))) p.typed = parseFloat(r.t);   // the number they gave: shows which wrong answers a question really draws
    p.question = String(q.q).slice(0, 200); p.answer = q.a;   // so the dashboard can show the question itself, not a code name
    for (k in extra) p[k] = extra[k];
    track('question_answered', p);
  }

  /* ---------- Live counters ---------- */
  // A refused or garbled reply is a failure, never a zero: a wrong number on screen is worse than none.
  // After any failure the game leaves the service alone for a minute rather than keep knocking.
  var apiRest = 0, apiLog = [];
  // The service allows 30 requests in any 10 seconds from one address. Anything that can wait asks for
  // room first, so a quick finish never trips the limit and loses the numbers for a minute.
  function room(n) {
    return new Promise(function (go) {
      (function wait() {
        var now = Date.now(); apiLog = apiLog.filter(function (t) { return now - t < 10000; });
        if (apiLog.length + n <= 28) go(); else setTimeout(wait, 400);
      })();
    });
  }
  function api(kind, key) {
    if (Date.now() < apiRest) return Promise.reject(new Error('resting'));
    var ctl = window.AbortController ? new AbortController() : null, opt = { cache: 'no-store' };
    if (ctl) opt.signal = ctl.signal;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 5000);
    apiLog.push(Date.now()); if (apiLog.length > 120) apiLog = apiLog.slice(-60);
    return fetch(STATS + '/' + kind + '/' + STATS_NS + '/' + key, opt)
      .then(function (r) {
        if (kind === 'get' && r.status === 404) return { value: 0 };   // a counter nobody has hit yet: a true zero, not a failure
        if (!r.ok) throw new Error('refused'); return r.json();
      })
      .then(function (j) { clearTimeout(timer); var v = Number(j && j.value); if (!isFinite(v) || v < 0 || v > 1e9) throw new Error('odd'); return Math.round(v); })
      .catch(function (e) { clearTimeout(timer); apiRest = Date.now() + 60000; throw e; });
  }
  function band(secs) { for (var i = 0; i < BUCKETS.length; i++) if (secs < BUCKETS[i]) return i; return BUCKETS.length - 1; }
  // Lifetime tallies per kind of question, so real difficulty can be read back (see the numbers page).
  function countKind(q, r) {
    if (!STATS || !window.fetch) return;
    var base = SETV + 'k' + q.kind, quiet = function () {};
    api('hit', base + 'n').catch(quiet);
    if (r.f === 'right') api('hit', base + 'r').catch(quiet);
    if (r.f === 'bait') api('hit', base + 't').catch(quiet);
  }
  function askCrowd(day, i, r) {
    if (!STATS || !window.fetch) return;
    var base = SETV + 'd' + day + 'q' + (i + 1);
    var jobs = [api('hit', base + 'n'), api(r.f === 'right' ? 'hit' : 'get', base + 'r'), api(r.f === 'bait' ? 'hit' : 'get', base + 't')];
    if (r.f === 'right') {
      var b = band(r.secs);
      jobs.push(api('hit', base + 'b' + b));
      for (var j = b + 1; j < BUCKETS.length; j++) jobs.push(api('get', base + 'b' + j));
    }
    Promise.all(jobs).then(function (v) {
      var slower = 0; for (var k = 4; k < v.length; k++) slower += v[k];
      r.crowd = { n: v[0], r: Math.min(v[0], v[1]), t: Math.min(v[0], v[2]), slower: slower };
      save();
      var el = document.getElementById('crowd');
      if (el && game && game.mode === 'daily' && game.st.res[i] === r && game.st.idx === i) el.textContent = crowdLine(r);
    }).catch(function () { /* the game works without the numbers */ });
  }
  function crowdPct(r) { var c = r && r.crowd; return c && c.n >= MIN_CROWD ? Math.round(c.r / c.n * 100) : -1; }
  function crowdLine(r) {
    var c = r.crowd;
    if (!c || !c.n) return '';
    if (c.n === 1) return 'You are the first to answer this one today.';
    if (c.n < MIN_CROWD) return 'You are one of the first ' + c.n + ' to answer this one today.';
    var pct = crowdPct(r), got = (pct < 50 ? 'Only ' : '') + pct + '% of ' + E.num(c.n) + ' players got this right.';
    if (r.f === 'bait') return 'You are in good company: ' + Math.round((c.t || 0) / c.n * 100) + '% of ' + E.num(c.n) + ' players fell for it too. ' + (pct < 50 ? 'Only ' : '') + pct + '% got it right.';
    if (r.f === 'right' && c.r >= MIN_CROWD) return got + ' You were faster than ' + Math.min(99, Math.round(c.slower / (c.r - 1) * 100)) + '% of them.';
    return got;
  }

  /* ---------- A friend's score, carried in the link they sent ---------- */
  function gameKey() { return game.mode === 'daily' ? 'd' + game.day : 't' + game.code + '-' + game.round; }
  function rivalHere() { var v = store.rival; return v && game && (game.mode === 'daily' || game.mode === 'table') && v.key === gameKey() ? v : null; }
  function myLink() {
    var st = game.st;
    return LINK + '#' + gameKey() + '-' + rightCount(st) + '-' + totalSecs(st);
  }
  function readLink() {
    var h = (location.hash || '').slice(1, 80), m, v = null;
    if ((m = /^(d\d{1,5})-([0-3])-(\d{1,3})$/.exec(h))) v = { key: m[1], n: +m[2], s: +m[3] };
    else if ((m = /^(t[A-Z0-9]{1,8}-[1-9]\d?)-([0-3])-(\d{1,3})$/.exec(h))) v = { key: m[1], n: +m[2], s: +m[3] };
    if (v) v = okRival(v);
    if (v) { store.rival = v; save(); track('challenge_arrived', { mode: v.code ? 'private' : 'daily' }); }
    if (h && h !== 'numbers') { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* fine */ } }
    return h;
  }
  function rivalCard() {
    var v = store.rival;
    if (!v) return '';
    if (v.code) return v.played ? '' : '<div class="card">A friend sent you a private round. They got ' + scoreLine(v.n, v.s) + '.<button class="btn" data-act="rivalround">Play their three</button></div>';
    if (v.key !== 'd' + today()) return '';
    return '<div class="card">A friend got ' + scoreLine(v.n, v.s) + ' today. Beat that.</div>';
  }
  function duelCard() {   // more greens wins; level on greens, the faster one wins
    var v = rivalHere();
    if (!v) return '';
    var st = game.st, n = rightCount(st), t = totalSecs(st);
    var res = n !== v.n ? (n > v.n ? 1 : -1) : t !== v.s ? (t < v.s ? 1 : -1) : 0;
    return '<div class="card duel"><p class="dh">' + (res > 0 ? 'You beat your friend' : res < 0 ? 'Your friend wins' : 'Dead heat') + '</p>' +
      '<p class="dr"><span>You</span><b>' + scoreLine(n, t) + '</b></p><p class="dr"><span>Your friend</span><b>' + scoreLine(v.n, v.s) + '</b></p></div>';
  }

  /* ---------- Home ---------- */
  // What the front page depends on. If this changes while it sits open (another tab, midnight), it is redrawn.
  var homeSig = '';
  function sig() { var v = store.rival; return today() + dailyState() + liveStreak() + (v ? v.key + v.n + '-' + v.s + (v.played || '') : ''); }
  function onHome() { return !game && !!view.querySelector('.home'); }
  function home() {
    stopTimers(); game = null; ask = null; drop();
    var rv = store.rival;
    if (rv && (rv.code ? rv.played || Date.now() - rv.at > 7 * 86400000 : rv.key !== 'd' + today())) { store.rival = null; save(); }   // yesterday's challenge has expired; a private one lasts a week or until played
    var state = dailyState(), streak = liveStreak(), d = store.daily, res = state === 'new' ? [] : d.res;
    if (state === 'done') { startDaily(); return; }   // once today is done, the result is the front page
    setRoad(rightCount({ res: res }) * STEP);
    homeSig = sig();
    view.innerHTML =
      '<section class="home">' +
        '<div class="hero" aria-hidden="true"><div class="sg">' + sign() + '</div></div>' +
        '<p class="pitch">Three questions. Three minutes.<b>Get three green lights.</b></p>' +
        lightsHtml(res, state === 'going' && !res[d.idx] ? d.idx : -1, 'mid') +
        rivalCard() +
        '<button class="btn" data-act="daily" data-enter>' + (state === 'going' ? 'Carry on' : 'Play') + '</button>' +
        '<button class="btn plate" data-act="friends">Play with friends</button>' +
        '<p class="today" id="today" role="status"></p>' +
        '<p class="meta"><span>No. ' + today() + (streak > 1 ? ', ' + streak + '-day streak' : '') + '</span><span>' + esc(dateLine()) + '</span></p>' +
      '</section>';
    if (STATS && window.fetch) fieldNow(today()).then(function (c) { var el = document.getElementById('today'); if (el) el.innerHTML = fieldLine(c); }).catch(function () { /* fine without */ });
  }

  /* ---------- Starting ---------- */
  function startDaily() {
    if (adopt()) save();   // another tab may have played on
    var d = today();
    if (dailyState() === 'new') { store.daily = { v: SETV, day: d, idx: 0, res: [], qStart: Date.now(), done: false }; save(); track('game_start', { mode: 'daily', game_day: d, returning: store.stats.played > 0 }); }   // returning: this device has finished a day before
    game = { mode: 'daily', day: d, set: E.buildDaily(d), st: store.daily };
    fresh = false;
    if (game.st.done) end(false); else play();
  }
  function startTable(code, round) {
    game = { mode: 'table', code: code, round: round, set: E.buildTable(code, round), st: { idx: 0, res: [], qStart: Date.now(), done: false } };
    fresh = false; keep(); track('game_start', { mode: 'private' });
    play();
  }
  function persist() { if (!game) return; if (game.mode === 'daily') save(); else keep(); }

  /* A game other than the daily three is kept as plain data too, so a refresh, or a phone that drops
     the page while you look at something else, puts you back where you were. Only seeds are kept for
     the questions: they are rebuilt by the engine, never read back. */
  function snap() {
    var g = game;
    if (g.mode === 'run') return { mode: 'run', n: g.n, lives: g.lives, right: g.right, strikes: g.strikes, recent: g.recent, kind: g.kind, seed: g.seed, res: g.res, start: g.start, over: g.over ? 1 : 0, was: g.was || 0 };
    if (g.mode === 'party') return { mode: 'party', seed: g.seed, count: g.set.length, players: g.players, k: g.k, turn: g.turn, ans: g.ans, scored: g.scored, at: g.at, start: g.start || 0 };
    return { mode: 'table', code: g.code, round: g.round, st: g.st };
  }
  function keep() { if (!game || (game.mode !== 'run' && game.mode !== 'party' && game.mode !== 'table')) return; store.live = { v: SETV, at: Date.now(), game: snap() }; save(); }
  function drop() { if (store.live) { store.live = null; save(); } }
  function resume() {
    var g = store.live && store.live.game, i, j, now = Date.now();
    if (!g) return false;
    try {
      if (g.mode === 'table') {
        var st = okSt(g.st, LIMIT);
        if (!st || !/^[A-Z0-9]{1,8}$/.test(g.code)) throw 0;
        game = { mode: 'table', code: g.code, round: int(g.round, 1, 99, 1), st: st };
        game.set = E.buildTable(game.code, game.round);
        fresh = false;
        if (st.done) end(false); else play();
      } else if (g.mode === 'run') {
        if (typeof g.kind !== 'string' || !E.GRADE.hasOwnProperty(g.kind) || typeof g.seed !== 'string') throw 0;
        var strikes = (Array.isArray(g.strikes) ? g.strikes : []).filter(function (x) { return FS[x] === 1 && x !== 'right'; }).slice(0, RUN_LIVES);
        game = { mode: 'run', n: int(g.n, 1, 1e5, 1), lives: RUN_LIVES - strikes.length, right: int(g.right, 0, 1e5, 0), strikes: strikes,
          recent: (Array.isArray(g.recent) ? g.recent : []).filter(function (x) { return typeof x === 'string'; }).slice(-24), kind: g.kind,
          seed: g.seed.slice(0, 60), res: okRes(g.res, RUN_LIMIT), start: int(g.start, 1, now + 60000, now), was: int(g.was, 0, 1e5, 0) };
        game.cur = E.makeKind(game.kind, game.seed + '-' + (game.n - 1), game.n - 1);
        if (g.over && game.lives <= 0) runEnd(true); else runPlay();
      } else if (g.mode === 'party') {
        var ps = (Array.isArray(g.players) ? g.players : []).slice(0, 6), count = g.count === 3 || g.count === 5 || g.count === 7 ? g.count : 0, n = ps.length;
        if (n < 2 || !count || typeof g.seed !== 'string') throw 0;
        game = { mode: 'party', seed: g.seed.slice(0, 60), k: int(g.k, 0, count, 0), turn: 0, ans: [], scored: [], at: g.at, start: int(g.start, 1, now + 60000, now),
          players: ps.map(function (q, x) { q = q || {}; return { name: String(q.name == null ? '' : q.name).slice(0, 12) || 'Player ' + (x + 1), right: int(q.right, 0, 99, 0), bait: int(q.bait, 0, 99, 0), secs: int(q.secs, 0, 1e5, 0) }; }) };
        game.set = E.buildParty(game.seed, count);
        for (i = 0; i < count; i++) {
          var row = Array.isArray(g.ans) && Array.isArray(g.ans[i]) ? g.ans[i] : [], out = [];
          for (j = 0; j < n; j++) out[j] = okRes(row[j], PARTY_LIMIT);
          game.ans[i] = out; game.scored[i] = !!(Array.isArray(g.scored) && g.scored[i]);
        }
        for (i = 0; i < game.k; i++) for (j = 0; j < n; j++) if (!game.ans[i][j]) throw 0;   // every earlier question must have every answer
        if (game.at === 'final' || game.k >= count) { game.k = count; partyFinal(); }
        else {
          var ord = order(), got = 0;
          while (got < n && game.ans[game.k][ord[got]]) got++;
          game.turn = got;                                   // go by the answers that are there, not by a counter
          if (got === n) { if (game.at === 'reveal') partyReveal(); else partyGather(); }
          else if (game.at === 'answer') partyAnswer(true);
          else partyPass();
        }
      } else throw 0;
      return true;
    } catch (e) { stopTimers(); game = null; ask = null; drop(); return false; }
  }

  /* ---------- Asking one question: shared by every mode ---------- */
  function parts(q, text) {
    var suf = q.suf || '';
    if (q.ordinal) { var n = parseInt(text, 10); suf = isFinite(n) && n > 0 ? E.ord(n).slice(String(n).length) : ''; }
    else if (parseFloat(text) === 1) suf = suf.replace(/^([a-z]+)s\b/, '$1');
    return (q.pre ? '<span class="u">' + esc(q.pre.trim()) + '</span>' : '') + '<b>' + esc(text) + '</b>' + (suf ? '<span class="u">' + esc(suf) + '</span>' : '');
  }
  function keyBtn(k) { return '<button data-act="key" data-k="' + k + '">' + k + '</button>'; }
  function entryHtml() {
    return '<div class="entry"><div class="read" id="read"><span class="v" id="val"></span></div>' +
      '<div class="pad">' +
        keyBtn(1) + keyBtn(2) + keyBtn(3) + '<button data-act="key" data-k="del" aria-label="Delete">' + ICON.del + '</button>' +
        keyBtn(4) + keyBtn(5) + keyBtn(6) + '<button data-act="key" data-k="." aria-label="Decimal point">.</button>' +
        keyBtn(7) + keyBtn(8) + keyBtn(9) + '<button class="lock" data-act="enter">Lock<br>in</button>' +
        '<button class="zero" data-act="key" data-k="0">0</button>' +
      '</div></div>';
  }
  // The top of every question is one instrument: the lights on the left, the clock on the right, and
  // between them a fuse that burns from the clock towards the lights. Nobody has to be told what
  // happens when it gets there. In the last seconds the lights still to be won flash red.
  // Once there is an answer the clock stays where it is, visibly stopped.
  // lead: the lights, or a player's name. r: the answer, once given.
  function hudHtml(left, total, lead, r) {
    var f = Math.max(0, Math.min(1, left / total));
    return '<div class="hud' + (r ? ' stopped' : left <= 15 ? ' low' : '') + '" id="hud">' + lead +
      '<div class="fuse" aria-hidden="true"><i id="bar" style="transform:scaleX(' + f + ')"></i><b id="spark" style="left:' + (f * 100) + '%"></b></div>' +
      '<b class="clock" id="clock" role="timer" aria-label="' + (r ? 'Clock stopped. Time left' : 'Time left') + '">' + mmss(Math.ceil(left)) + '</b></div>';
  }
  function timeLeft(limit, start) { return Math.max(0, limit - (Date.now() - start) / 1000); }
  function plateHtml(q, label) {
    return '<div class="plate-q">' +
      '<p class="lvl"><span>' + label + '</span><b>' + LEVEL[q.level] + '</b></p>' +
      '<p class="q' + (q.q.length > 125 ? ' long' : '') + '">' + esc(q.q) + '</p></div>';
  }
  // a: { q, limit, total, start, beat, commit(r), reveal(r) }. limit: seconds this question may take. total: what a full bar stands for. commit stores the answer at once; reveal shows what happens next.
  function beginAsk(a) {
    ask = a; typed = ''; lastBeep = -1;
    paintTyped(false);
    ticker = setInterval(tick, 200);
    tick();
  }
  function tick() {
    if (!ask) return;
    var left = ask.limit - (Date.now() - ask.start) / 1000;
    if (left <= 0) { lock(true); return; }
    var c = document.getElementById('clock'), bar = document.getElementById('bar'), spark = document.getElementById('spark'), hud = document.getElementById('hud');
    if (!c) return;
    var whole = Math.ceil(left), f = Math.max(0, left / (ask.total || ask.limit));
    c.textContent = mmss(whole);
    if (bar) bar.style.transform = 'scaleX(' + f + ')';
    if (spark) spark.style.left = (f * 100) + '%';
    if (hud) hud.className = 'hud' + (left <= 15 ? ' low' : '');
    if (whole <= 10 && whole !== lastBeep) { lastBeep = whole; SFX.beep(); }
  }
  function paintTyped(pop) {
    var val = document.getElementById('val'), read = document.getElementById('read');
    if (!val || !ask) return;
    val.innerHTML = typed === '' ? '<span class="ph">' + (desk ? 'Type or click your answer' : 'Type your answer') + '</span>' : parts(ask.q, typed);
    if (pop) replay(read, 'pop');
  }
  function key(k) {
    if (!ask) return;
    if (k === 'del') { typed = typed.slice(0, -1); SFX.del(); }
    else {
      if (k === '.') { if (typed.indexOf('.') < 0 && typed.length < 6) typed += typed === '' ? '0.' : '.'; }
      else if (typed.length < 7) typed = typed === '0' ? String(k) : typed + k;
      SFX.key();
    }
    buzz(8);
    paintTyped(k !== 'del');
  }
  function lock(timeout) {
    if (!ask) return;
    var a = ask, f = timeout ? 'time' : E.judge(a.q, typed);
    if (f === 'bad') {
      replay(document.getElementById('read'), 'shake');
      toast('Type a number first');
      return;
    }
    if (f === 'low' || f === 'high') f = 'wrong';
    var used = Math.min(a.limit, Math.max(0, (Date.now() - a.start) / 1000));
    var r = { t: timeout ? '' : String(parseFloat(typed)), f: f, secs: Math.round(used) };
    ask = null; typed = '';
    stopTimers();
    if (timeout) quiet = Date.now() + 600;   // the keys vanish under a finger that may already be on its way down
    if (a.commit(r) === 'stale') { toast('Already answered in another tab'); startDaily(); return; }   // stored at once, so a reload cannot buy a second guess
    var show = function () { pending = null; if (game) a.reveal(r); };
    if (timeout || calm || !a.beat) { show(); return; }
    SFX.lock(); buzz(20);
    var read = document.getElementById('read'); if (read) read.classList.add('locking');
    pending = setTimeout(show, 320);   // one held breath before the light changes
  }

  /* ---------- Playing on your own ---------- */
  function youLine(q, r) {
    return r.f === 'right' ? 'You got it in ' + mmss(r.secs) + '.' : r.f === 'bait' ? 'You said ' + E.show(q, parseFloat(r.t)) + '. That is the trap.' :
      r.f === 'time' ? 'You ran out of time.' : 'You said ' + E.show(q, parseFloat(r.t)) + '.';
  }
  // After an answer the same screen stays: the light has changed, and under the question sit the
  // answer, one line on why, and a single button.
  function resultHtml(q, r, i, nextLabel) {
    var ans = E.show(q, q.a);
    return '<div class="result">' +
      '<p class="say ' + lightOf(r) + '" role="status">' + WORD[r.f] + '</p>' +
      '<p class="lab">The answer</p><p class="big' + (ans.length > 10 ? ' sm' : '') + '">' + esc(ans) + '</p>' +
      '<p class="you">' + esc(youLine(q, r)) + '</p>' +
      '<p class="why">' + esc(q.why) + '</p>' +
      '<p class="crowd" id="crowd" role="status">' + esc(crowdLine(r)) + '</p>' +
      '<button class="linkish quiet" data-act="friend" data-i="' + i + '">Ask a friend this one</button>' +
      '<button class="btn" data-act="next" data-enter>' + nextLabel + '</button>' +
    '</div>';
  }
  function spent(st, upto) { var t = 0; for (var k = 0; k < upto; k++) if (st.res[k]) t += st.res[k].secs; return t; }
  // Green means go: the light changes, the answer glows for a moment, and what comes next arrives by itself.
  function go(i, cb) {
    var lts = view.querySelectorAll('.hud .lights .lt'), read = document.getElementById('read');
    if (lts[i]) lts[i].className = 'lt green lit';
    if (read) { read.classList.remove('locking'); read.classList.add('good'); }
    react('right');
    pending = setTimeout(function () { pending = null; cb(); }, calm ? 450 : 850);
  }
  function play() {
    stopTimers(); ask = null;
    var st = game.st, i = st.idx, r = st.res[i];
    if (r && r.f === 'right' && !fresh) {   // a green never stops you: after a refresh, carry straight on
      if (i >= 2) { finish(); return; }
      st.idx = ++i; st.qStart = Date.now(); persist(); r = st.res[i];
    }
    var q = game.set[i], budget = Math.max(0, LIMIT - spent(st, i)), last = i >= 2 || !!st.res[i + 1];
    if (r && last) { game.lastQ = i; finish(); return; }   // a refresh on the last answer: the result screen shows it
    var left = r ? Math.max(0, budget - r.secs) : timeLeft(budget, st.qStart);
    if (!fresh) setRoad(rightCount(st) * STEP);
    view.innerHTML =
      '<section class="play">' +
        hudHtml(left, LIMIT, lightsHtml(st.res, r ? -1 : i, '', fresh ? i : -1), r) +
        plateHtml(q, 'Question ' + (i + 1) + ' of 3') +
        (r ? resultHtml(q, r, i, 'Next question') : entryHtml()) +
      '</section>';
    if (r) return;
    var mode = game.mode, day = game.day;
    beginAsk({ q: q, limit: budget, total: LIMIT, start: st.qStart, beat: true,
      commit: function (res) {
        if (mode === 'daily') { var p = peek(), pd = p && p.daily; if (pd && pd.v === SETV && pd.day === day && (pd.res[i] || pd.idx !== i)) return 'stale'; }   // one guess, however many tabs
        st.res[i] = res;
        if (res.f === 'time') for (var k = i + 1; k < 3; k++) st.res[k] = { t: '', f: 'time', secs: 0, skip: 1 };   // the clock ran out: the rest are never reached
        persist(); beat(q, res); countKind(q, res); if (mode === 'daily') askCrowd(day, i, res);
        trackAnswer(mode === 'daily' ? 'daily' : 'private', q, res, i + 1, mode === 'daily' ? { game_day: day, clock_left: Math.max(0, budget - res.secs) } : { clock_left: Math.max(0, budget - res.secs) });
      },
      reveal: function (res) {
        if (res.f !== 'right' && (i >= 2 || st.res[i + 1])) { react(res.f); game.lastQ = i; finish(); return; }   // the last one: straight to the result, which shows its answer
        if (res.f !== 'right') { fresh = true; play(); fresh = false; react(res.f); return; }   // red: stop, and see why
        drive(rightCount(st) * STEP, 1400);                                                    // green: the road moves on
        go(i, function () { if (game && game.st === st) next(); });
      } });
  }
  function next() {   // never held up by an animation
    var st = game.st;
    if (!st.res[st.idx]) return;
    if (st.idx >= 2 || st.res[st.idx + 1]) { finish(); return; }   // the last question, or the clock ran out
    st.idx++; st.qStart = Date.now(); persist(); quiet = Date.now() + 200; play(); window.scrollTo(0, 0);
  }
  function finish() {
    var st = game.st;
    if (game.mode === 'daily' && !st.done) {
      var s = store.stats;
      if (s.lastDay < game.day) {   // a day counts once, and never out of order
        var n = rightCount(st);
        s.played++;
        if (n === 3) s.perfect++;
        s.streak = s.lastDay === game.day - 1 ? s.streak + 1 : 1;
        s.best = Math.max(s.best, s.streak);
        s.lastDay = game.day;
        s.dist[n]++;
      }
    }
    var first = !st.done;
    if (first) track('game_finish', game.mode === 'daily'
      ? { mode: 'daily', game_day: game.day || 0, greens: rightCount(st), secs: totalSecs(st), timed_out: st.res.some(function (r) { return r.f === 'time'; }), vs_friend: !!rivalHere(), streak: streakBand(store.stats.streak), returning: store.stats.played > 1 }
      : { mode: 'private', game_day: 0, greens: rightCount(st), secs: totalSecs(st), timed_out: st.res.some(function (r) { return r.f === 'time'; }), vs_friend: !!rivalHere() });
    st.done = true;
    if (game.mode === 'table' && rivalHere()) store.rival.played = 1;   // the challenge has been answered: do not offer it again
    persist();
    end(first);
    if (first && rightCount(st) === 3) seq.push(setTimeout(function () { SFX.sweep(); buzz([20, 40, 20, 40, 40]); }, 350));
  }

  /* ---------- Score ---------- */
  function shareText() {
    var st = game.st, daily = game.mode === 'daily';
    return (daily ? NAME + ' #' + game.day : NAME + ', a private round') + '\n' +
      st.res.map(function (r) { return EMOJI[r.f]; }).join('') + ' ' + scoreLine(rightCount(st), totalSecs(st)) + '\n' +
      (daily ? 'Beat me: ' : 'Same three questions: ') + myLink();
  }
  function friendText(q, r) {
    var pct = crowdPct(r);
    return (r && r.f === 'right' ? 'I got this one in ' + mmss(r.secs) + '. Can you?' : 'This one caught me. Can you get it?') +
      '\n\n' + q.q + '\n\n' + (pct >= 0 && pct < 50 ? 'Only ' + pct + '% of players got it today. ' : '') + 'No calculator. ' + SITE;
  }
  function copyText(text, done) {
    var showIt = function () { sheet('Copy this', '<h2 class="big">Copy this</h2><p>Press and hold the text to copy it.</p><pre class="sharetext">' + esc(text) + '</pre>'); };
    try { navigator.clipboard.writeText(text).then(function () { toast(done); }, showIt); } catch (e) { showIt(); }
  }
  function send(text, done) {
    var clip = function () { copyText(text, done); };
    if (touch && navigator.share) {
      try { navigator.share({ text: text }).catch(function (e) { if (!e || e.name !== 'AbortError') clip(); }); } catch (e) { clip(); }
    } else clip();
  }
  // Inside another app's browser the streak lives in that app. One quiet line says so; the detail is a tap away.
  function inAppNote() { return INAPP ? '<button class="linkish quiet" data-act="inapp">Keep your streak: open in ' + BROWSER + '</button>' : ''; }
  function inAppSheet() {
    sheet('Keep your streak', '<h2 class="big">Keep your streak</h2><p>You are playing inside ' + INAPP + ', which has its own browser. Your streak is only saved there.</p>' +
      '<p>To keep it in one place, open <b>' + SITE + '</b> in ' + BROWSER + '.</p><button class="btn" data-act="copylink">Copy the link</button>');
  }
  function statsBlock() {
    var s = store.stats, max = Math.max.apply(null, s.dist.concat(1)), bars = '';
    var mine = game && game.mode === 'daily' && game.st.done ? rightCount(game.st) : -1;
    var d = store.daily, field = d && d.done && d.day === today() && d.v === SETV && d.field ? d.field : null;   // today's field, once this player has finished
    for (var i = 3; i >= 0; i--) bars += '<div><span>' + i + '</span><i class="' + (i === mine ? 'hi' : '') + '" style="width:' + Math.max(10, s.dist[i] / max * 100) + '%">' + s.dist[i] + '</i></div>';
    return '<h2>Your record</h2>' +
      '<div class="nums">' +
        '<div><b>' + s.played + '</b><span>Played</span></div>' +
        '<div><b>' + liveStreak() + '</b><span>Streak</span></div>' +
        '<div><b>' + s.best + '</b><span>Best streak</span></div>' +
        '<div><b>' + s.perfect + '</b><span>All three</span></div>' +
      '</div>' +
      (field ? '<h2>Today’s players</h2><div class="spread">' + distHtml(field, rightCount(d)) + '</div>' : '') +
      '<h2>Your green lights per day</h2><div class="dist">' + bars + '</div>' +
      '<p class="beaten">' + beatenLine() + (s.runTop ? ' Endless best: ' + s.runTop + ' green.' : '') + '</p>';
  }
  // The score is one complete screen: the three lights, one number, one button, and when the next
  // three arrive. Nothing runs off the bottom. The answers are one tap away, in a sheet.
  function answersSheet() {
    var st = game.st, recap = '', title = game.mode === 'daily' ? 'Today\u2019s three' : 'This round';
    for (var i = 0; i < 3; i++) {
      var r = st.res[i], q = game.set[i], pct = crowdPct(r);
      recap += '<li><p class="rq">' + esc(q.q) + '</p>' +
        '<p class="ra">' + lamp(lightOf(r), 'sm') + '<b>' + esc(E.show(q, q.a)) + '</b><span class="rt">' +
          esc(r.f === 'right' ? 'in ' + mmss(r.secs) : r.skip ? 'not reached' : r.f === 'time' ? 'out of time' : 'you said ' + E.show(q, parseFloat(r.t))) + (pct >= 0 ? ', ' + pct + '% got it' : '') + '</span></p>' +
        '<p class="rw">' + esc(q.why) + '</p>' +
        '<button class="linkish quiet" data-act="friend" data-i="' + i + '">Ask a friend this one</button></li>';
    }
    sheet(title, '<h2 class="big">' + title + '</h2><ol class="recap">' + recap + '</ol>');
  }
  function end(first) {
    stopTimers(); ask = null; clearTimeout(toastTimer); toastEl.hidden = true;
    var st = game.st, n = rightCount(st), daily = game.mode === 'daily', streak = liveStreak();
    var li = first && typeof game.lastQ === 'number' ? game.lastQ : -1, lr = li >= 0 ? st.res[li] : null, lq = lr && lr.f !== 'right' ? game.set[li] : null;
    setRoad(n * STEP);
    view.innerHTML =
      '<section class="end' + (lq ? ' haslast' : '') + '">' +
        (lq ? '<div class="last"><p class="say ' + lightOf(lr) + '" role="status">' + WORD[lr.f] + '</p>' +
          '<p class="lastans"><span>The answer</span><b>' + esc(E.show(lq, lq.a)) + '</b></p><p class="why">' + esc(lq.why) + '</p></div>' : '') +
        '<div class="score">' +
          '<p class="endno">' + (daily ? 'No. ' + game.day : 'Private round ' + esc(game.code) + ', number ' + game.round) + '</p>' +
          lightsHtml(st.res, -1, 'big' + (first ? ' fresh' : '')) +
          '<p class="tally">' + n + ' of 3</p>' +
          '<p class="total">in ' + mmss(totalSecs(st)) + (daily && streak > 0 ? ', <b class="streak">' + streak + '-day streak</b>' : '') + '</p>' +
        '</div>' +
        (daily ? '<p class="standing" id="standing" role="status">' + (st.field ? placeLine(st.field, n, st.place) : '') + '</p>' +
          '<div class="spread" id="dist" aria-label="How today’s players scored">' + (st.field ? distHtml(st.field, n) : '') + '</div>' : '') +
        duelCard() +
        '<div class="endbtns">' + (rivalHere() ? '<button class="btn" data-act="copy">Send your score back</button>' : '<button class="btn two" data-act="copy"><span>Share your result</span><small>and challenge a friend</small></button>') +
          '<div class="pair">' + (daily ? '<button class="btn plate" data-act="run">Endless mode</button><button class="btn plate" data-act="friends">With friends</button>' : '<button class="btn plate" data-act="nextround">Another three</button><button class="btn plate" data-act="home">Home</button>') + '</div>' +
        '</div>' +
        '<div class="foot">' + (daily ? (streak > 0 ? '<p class="keep">Come back tomorrow to keep your streak.</p>' : '') + '<p class="nextset"><span>Next three in</span><b id="cd">' + untilMidnight() + '</b></p>' : '') +
          '<button class="linkish quiet" data-act="answers">See the answers</button>' + (daily ? inAppNote() : '') + '</div>' +
      '</section>';
    window.scrollTo(0, 0);
    if (daily) runCountdown();
    if (daily && first && STATS && window.fetch) {
      var show = function () {
        var el = document.getElementById('standing'), ds = document.getElementById('dist');
        if (!game || game.st !== st || !st.field) return;
        if (el) el.innerHTML = placeLine(st.field, n, st.place);
        if (ds) ds.innerHTML = distHtml(st.field, n);
      };
      var day = game.day, secs = totalSecs(st);
      readField(day, n).then(function (c) {
        st.field = c; save(); show();
        if (day < PLACE_DAY) return;
        return room(placeCost(secs)).then(function () { return readPlace(day, n, secs); }).then(function (p) { st.place = p; save(); show(); });
      }).catch(function () { /* fine without */ });
    }
  }

  /* ---------- Endless mode: keep answering until three reds ---------- */
  var RUN_STEP = 90;   // the road moves on a little for every green
  function startRun() {
    if (adopt()) save();
    game = { mode: 'run', n: 0, lives: RUN_LIVES, right: 0, strikes: [], recent: [], cur: null, res: null, seed: Date.now() + '-' + Math.random() };
    track('game_start', { mode: 'endless' });
    runNext();
  }
  function runNext() {
    var n = game.n++, grade = n < 6 ? [1, 2, 2, 3, 3, 4][n] : [3, 4, 2, 5, 3, 4, 1, 5][(n - 6) % 8];   // ease in, then everything, the brutal ones included
    // The kind whose idea this player met longest ago, across every run on this device and today's three,
    // so a new run never opens with the questions the last one did.
    var met = (store.recent || []).slice(), kind;
    try { E.buildDaily(today()).forEach(function (q) { met.push(q.kind); }); } catch (e) { /* the daily set is only a hint here */ }
    kind = E.nextKind(grade, met, Math.random);
    store.recent = (store.recent || []).concat([kind]).slice(-90); save();
    game.recent.push(kind); if (game.recent.length > 24) game.recent.shift();
    game.kind = kind; game.cur = E.makeKind(kind, game.seed + '-' + n, n); game.res = null; game.start = Date.now();
    keep();
    runPlay();
    window.scrollTo(0, 0);
  }
  function runLead() {   // the three lights here are the three reds you are allowed
    var h = '';
    for (var k = 0; k < RUN_LIVES; k++) h += lamp(k < game.strikes.length ? 'red' : 'off');
    return '<div class="lights" role="img" aria-label="' + game.strikes.length + ' of ' + RUN_LIVES + ' reds used">' + h + '</div><span class="hudn">' + game.right + ' green</span>';
  }
  function runPlay() {
    stopTimers(); ask = null;
    var q = game.cur, r = game.res;
    if (r && r.f === 'right' && !fresh) { runNext(); return; }   // a green never stops you
    if (!fresh) setRoad(game.right * RUN_STEP);
    view.innerHTML =
      '<section class="play">' +
        hudHtml(r ? RUN_LIMIT - r.secs : timeLeft(RUN_LIMIT, game.start), RUN_LIMIT, runLead(), r) +
        plateHtml(q, 'Question ' + game.n) +
        (r ? resultHtml(q, r, 'run', game.lives > 0 ? 'Next question' : 'See your result') : entryHtml()) +
      '</section>';
    if (r) return;
    beginAsk({ q: q, limit: RUN_LIMIT, start: game.start, beat: true,
      commit: function (res) { game.res = res; if (res.f === 'right') game.right++; else { game.lives--; game.strikes.push(res.f); } beat(q, res); keep(); trackAnswer('endless', q, res, game.n); },
      reveal: function (res) {
        if (res.f !== 'right') { fresh = true; runPlay(); fresh = false; react(res.f); return; }
        var n = view.querySelector('.hudn'), g = game; if (n) n.textContent = game.right + ' green';
        drive(game.right * RUN_STEP, 1200);
        go(-1, function () { if (game === g) runNext(); });
      } });
  }
  function runEnd(again) {   // again: the page was refreshed on this screen
    stopTimers(); ask = null;
    var s = store.stats, old = again ? game.was : s.runTop || 0, isBest = game.right > old;
    if (isBest) s.runTop = Math.max(s.runTop || 0, game.right);
    if (!again) track('game_finish', { mode: 'endless', greens: game.right, questions: game.n, best: isBest });
    game.over = true; game.was = old;
    save(); keep();
    setRoad(game.right * RUN_STEP);
    view.innerHTML =
      '<section class="end">' +
        '<div class="score">' +
          '<p class="endno">Endless mode</p>' +
          '<p class="tally">' + game.right + '</p>' +
          '<p class="total">green ' + (game.right === 1 ? 'light' : 'lights') + ' before three reds.' + (isBest && old ? ' Your best yet.' : !isBest && old ? ' Your best is ' + old + '.' : '') + '</p>' +
        '</div>' +
        '<div class="endbtns"><button class="btn" data-act="run" data-enter>Go again</button><div class="pair"><button class="btn plate" data-act="runshare">Share it</button><button class="btn plate" data-act="home">Home</button></div></div>' +
      '</section>';
    window.scrollTo(0, 0);
    if (isBest && !again) seq.push(setTimeout(function () { SFX.sweep(); }, 300));
  }

  /* ---------- One phone, passed round ---------- */
  function startParty(names, count) {
    var seed = Date.now() + '-' + Math.random();
    game = { mode: 'party', players: names.map(function (nm) { return { name: nm, right: 0, bait: 0, secs: 0 }; }),
      seed: seed, set: E.buildParty(seed, count), k: 0, turn: 0, ans: [], scored: [], at: 'pass', start: 0 };
    setRoad(0); track('game_start', { mode: 'party', players: names.length, questions: count });
    partyPass();
  }
  function order() { var n = game.players.length, o = []; for (var i = 0; i < n; i++) o.push((game.k + i) % n); return o; }   // a different player goes first each time
  function ranked() {
    return game.players.slice().sort(function (a, b) { return b.right - a.right || a.secs - b.secs; });
  }
  function standings(detail) {
    return '<ol class="table">' + ranked().map(function (p) {
      return '<li><span>' + esc(p.name) + '</span>' + (detail ? '<small>' + mmss(p.secs) + (p.bait ? ', trapped ' + times(p.bait) : '') + '</small>' : '') + '<b>' + p.right + lamp('green', 'sm') + '</b></li>';
    }).join('') + '</ol>';
  }
  function partyPass() {
    stopTimers(); ask = null; game.at = 'pass'; keep();
    var p = game.players[order()[game.turn]];
    view.innerHTML =
      '<section class="pass">' +
        '<p class="sm">Question ' + (game.k + 1) + ' of ' + game.set.length + '</p>' +
        '<p class="sm">' + (game.turn === 0 ? 'First up. Hand the phone to' : 'Locked in. Now hand the phone to') + '</p>' +
        '<p class="who">' + esc(p.name) + '</p>' +
        '<p class="sm">Everyone else, eyes off. One guess, ' + PARTY_LIMIT + ' seconds.</p>' +
        '<button class="btn" data-act="pgo" data-enter>Show ' + esc(p.name) + ' the question</button>' +
        (game.k > 0 && game.turn === 0 ? standings(false) : '') +
      '</section>';
    window.scrollTo(0, 0);
  }
  function partyAnswer(again) {   // again: the page was refreshed mid-question, so the clock carries on
    stopTimers();
    var k = game.k, pi = order()[game.turn], q = game.set[k];
    if (!again) game.start = Date.now();
    game.at = 'answer'; keep();
    view.innerHTML =
      '<section class="play">' +
        hudHtml(timeLeft(PARTY_LIMIT, game.start), PARTY_LIMIT, '<span class="chip">' + esc(game.players[pi].name) + '</span>', null) +
        plateHtml(q, 'Question ' + (k + 1) + ' of ' + game.set.length) + entryHtml() +
      '</section>';
    beginAsk({ q: q, limit: PARTY_LIMIT, start: game.start, beat: false,
      commit: function (r) { (game.ans[k] = game.ans[k] || [])[pi] = r; game.turn++; game.at = game.turn < game.players.length ? 'pass' : 'gather'; keep(); trackAnswer('party', q, r, k + 1); },
      reveal: function () { SFX.lock(); if (game.turn < game.players.length) partyPass(); else partyGather(); } });
  }
  function partyGather() {
    stopTimers(); game.at = 'gather'; keep();
    view.innerHTML =
      '<section class="pass">' +
        '<p class="sm">Question ' + (game.k + 1) + ' of ' + game.set.length + '</p>' +
        '<p class="who">Everyone is in</p>' +
        '<p class="sm">Gather round the phone.</p>' +
        '<button class="btn" data-act="preveal" data-enter>Show the answers</button>' +
      '</section>';
  }
  function partyReveal() {
    stopTimers();
    var k = game.k, q = game.set[k], a = game.ans[k], ord = order(), last = k >= game.set.length - 1;
    if (!game.scored[k]) {
      game.scored[k] = true;
      ord.forEach(function (pi) {
        var r = a[pi], p = game.players[pi];
        p.secs += r.secs;
        if (r.f === 'right') p.right++;
        if (r.f === 'bait') p.bait++;
      });
    }
    game.at = 'reveal'; keep();
    var rows = ord.map(function (pi) {
      var r = a[pi];
      var said = r.f === 'time' ? 'ran out of time' : 'said ' + E.show(q, parseFloat(r.t)) + (r.f === 'right' ? ' in ' + mmss(r.secs) : r.f === 'bait' ? ', the trap' : '');
      return '<div class="prow hid" data-f="' + r.f + '">' + lamp(lightOf(r)) + '<p class="nm">' + esc(game.players[pi].name) + '<span class="said">' + esc(said) + '</span></p></div>';
    }).join('');
    view.innerHTML =
      '<section class="rev">' +
        plateHtml(q, 'Question ' + (k + 1) + ' of ' + game.set.length) +
        '<p class="answer"><span>The answer</span><b>' + esc(E.show(q, q.a)) + '</b></p>' +
        rows +
        '<div class="after hid" id="after"><p class="why">' + esc(q.why) + '</p>' + standings(false) +
          '<button class="btn" data-act="pnext" data-enter>' + (last ? 'See who won' : 'Next question') + '</button></div>' +
      '</section>';
    window.scrollTo(0, 0);
    var els = view.querySelectorAll('.prow'), after = document.getElementById('after');
    var showRow = function (el) {
      var f = el.getAttribute('data-f');
      el.classList.remove('hid'); el.classList.add('show');
      SFX[f](); buzz(25);
    };
    if (calm) { for (var i = 0; i < els.length; i++) els[i].classList.remove('hid'); after.classList.remove('hid'); return; }
    Array.prototype.forEach.call(els, function (el, i) { seq.push(setTimeout(function () { showRow(el); }, 600 + i * 850)); });
    seq.push(setTimeout(function () { after.classList.remove('hid'); }, 600 + els.length * 850));
  }
  function partyNext() {
    game.k++; game.turn = 0;
    if (game.k >= game.set.length) partyFinal(); else partyPass();
  }
  function listNames(ps) { var n = ps.map(function (p) { return p.name; }); return n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n[0]; }
  function partyFinal() {
    stopTimers();
    if (game.at !== 'final') track('game_finish', { mode: 'party', players: game.players.length, questions: game.set.length });
    game.at = 'final'; keep();
    var r = ranked(), top = r.filter(function (p) { return p.right === r[0].right && p.secs === r[0].secs; });
    var most = Math.max.apply(null, r.map(function (p) { return p.bait; })), trapped = r.filter(function (p) { return p.bait === most; });
    view.innerHTML =
      '<section class="pass" style="justify-content:flex-start">' +
        '<p class="sm">After ' + game.set.length + ' questions</p>' +
        '<p class="who">' + (top.length === 1 ? esc(top[0].name) + ' wins' : 'Dead heat') + '</p>' +
        (top.length > 1 ? '<p class="sm">' + esc(listNames(top)) + ' share it.</p>' : '') +
        standings(true) +
        (most > 0 ? '<p class="sm">Most trapped: ' + esc(listNames(trapped)) + ', caught ' + times(most) + (trapped.length > 1 ? ' each' : '') + '.</p>' : '<p class="sm">Nobody fell for a single trap.</p>') +
        '<button class="btn" data-act="pagain" data-enter>Play again</button>' +
        '<button class="btn plate" data-act="pshare">Share the result</button>' +
        '<button class="btn plate" data-act="home">Home</button>' +
      '</section>';
    window.scrollTo(0, 0);
    seq.push(setTimeout(function () { SFX.sweep(); buzz([20, 40, 20, 40, 40]); }, 250));
  }
  function partyShare() {
    return NAME + ', ' + game.set.length + ' questions round the table\n' +
      ranked().map(function (p, i) { return (i + 1) + '. ' + p.name + ' ' + p.right + ' of ' + game.set.length + (p.bait ? ' (trapped ' + times(p.bait) + ')' : ''); }).join('\n') + '\n' + SITE;
  }

  /* ---------- Sheets ---------- */
  function sheet(label, body) {
    veil.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(label) + '"><div class="sheet-top"><button class="ico" data-act="close" aria-label="Close"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button></div>' + body + '</div>';
    veil.hidden = false;
  }
  function closeSheet() { veil.hidden = true; veil.innerHTML = ''; }
  function eg(light, val, note) { return '<div class="line">' + lamp(light) + '<p><b>' + val + '</b><span>' + note + '</span></p></div>'; }
  function leaveSheet() {
    sheet('Leave this game?', '<h2 class="big">Leave this game?</h2><p>Your place in it will be lost.</p><button class="btn" data-act="close">Keep playing</button><button class="btn plate" data-act="home" data-sure>Leave</button>');
  }
  function help() {
    sheet('How to play',
      '<h2 class="big">How to play</h2>' +
      '<ul><li>Three trick questions a day, the same three for everyone.</li><li>One guess each, and three minutes for all three, on one clock.</li><li>Right: the light turns green and the next question arrives.</li><li>Wrong: the light turns red, the clock stops, and you see why.</li><li>Get three green lights.</li></ul>' +
      '<div class="eg"><p class="egq">A bat and a ball cost \u20AC1.10. The bat costs \u20AC1.00 more than the ball. How much is the ball?</p>' +
        eg('green', '5 cents', 'Correct. It takes a second look.') +
        eg('red', '10 cents', 'The trap: the answer that jumps out first.') +
      '</div>' +
      '<p>The questions go from easy to hard. A new three arrive at midnight.</p>' +
      '<p>Your result comes with a link, so a friend can play the same three and see who won.</p>' +
      '<p class="small">To show how players are doing, the game sends anonymous counts of visits and answers. It stores nothing on your device to follow you, and sends nothing that says who you are.</p>');
  }
  function stats() { sheet('Your record', statsBlock()); }
  function stepper(label, value, minus, plus) {
    return '<div class="field"><span class="lab">' + label + '</span><div class="stepper"><button data-act="' + minus + '" aria-label="Fewer">−</button><output>' + value + '</output><button data-act="' + plus + '" aria-label="More">+</button></div></div>';
  }
  function friendsSheet() {
    sheet('Play with friends',
      '<h2 class="big">Play with friends</h2>' +
      '<button class="choice" data-act="party"><b>One phone, passed round</b><span>For when you are in the same room. Everyone answers in secret, then the answers are shown together. Two to six players.</span></button>' +
      '<button class="choice" data-act="table"><b>Each on your own phone</b><span>A private three that only your group gets. Play it, then send the link and they see if they beat you.</span></button>');
  }
  function readNames() { var els = veil.querySelectorAll('.names input'); for (var i = 0; i < els.length; i++) cfg.names[i] = els[i].value.replace(/\s+/g, ' ').trim().slice(0, 10); }
  function partySheet() {
    while (cfg.names.length < 2) cfg.names.push('');
    var inputs = cfg.names.map(function (nm, i) { return '<input maxlength="10" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Player ' + (i + 1) + '" value="' + esc(nm) + '" aria-label="Name of player ' + (i + 1) + '">'; }).join('');
    sheet('One phone, passed round',
      '<h2 class="big">One phone</h2>' +
      '<p>Everyone answers the same question in secret, one after another. Then the answers are shown for all to see.</p>' +
      stepper('Players', cfg.names.length, 'pn-', 'pn+') +
      '<div class="names">' + inputs + '</div>' +
      stepper('Questions', cfg.count, 'pq-', 'pq+') +
      '<p class="small">Most green lights wins. Level on greens, the faster player wins.</p>' +
      '<button class="btn" data-act="pstart">Start</button>');
  }
  function partyStart() {
    readNames();
    var names = cfg.names.map(function (nm, i) { return nm || 'Player ' + (i + 1); });
    store.names = cfg.names.slice(); save();
    closeSheet();
    startParty(names, cfg.count);
  }
  function randomCode() {
    var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ', c = '';
    for (var i = 0; i < 4; i++) c += a.charAt(Math.floor(Math.random() * a.length));
    return c;
  }
  function tableSheet() {
    if (!table.code) table.code = randomCode();
    sheet('Each on your own phone',
      '<h2 class="big">Own phones</h2>' +
      '<p>Start a private three. When you finish, send the link: your friends get the same questions and see whether they beat you. Or agree a code out loud and all type it in.</p>' +
      '<div class="field"><label for="code">Code</label><input id="code" maxlength="8" autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + esc(table.code) + '"><button class="linkish" data-act="rand" style="justify-self:start">Give me a random code</button></div>' +
      '<div class="field"><span class="lab">Round</span><div class="stepper"><button data-act="round-" aria-label="Previous round">−</button><output id="round">' + table.round + '</output><button data-act="round+" aria-label="Next round">+</button></div></div>' +
      '<button class="btn" data-act="deal">Start</button>');
  }
  function deal() {
    var input = document.getElementById('code');
    var code = String((input && input.value) || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (!code) { toast('Type a code first'); return; }
    table.code = code;
    closeSheet();
    startTable(table.code, table.round);
  }

  /* ---------- The numbers page: how hard each kind of question really is (open the site with #numbers) ---------- */
  function numbers() {
    stopTimers(); game = null; ask = null;
    var ks = E.kinds().sort(function (a, b) { return a.grade - b.grade || (a.kind < b.kind ? -1 : 1); }), rows = '', lv = 0;
    var aim = { 1: 'Grade 1, giveaways: endless mode only', 2: 'Grade 2, the first question: aiming for about 60% right', 3: 'Grade 3, the second: about 45% right', 4: 'Grade 4, the third: about 30% right', 5: 'Grade 5, brutal: endless mode only' };
    ks.forEach(function (k, i) {
      if (k.grade !== lv) { lv = k.grade; rows += '<tr class="lv"><td colspan="4">' + aim[lv] + '</td></tr>'; }
      rows += '<tr title="' + esc(k.eg) + '"><td>' + esc(k.kind) + '</td><td id="n' + i + '">…</td><td id="r' + i + '"></td><td id="t' + i + '"></td></tr>';
    });
    view.innerHTML = '<section class="numbers"><p class="rank">The numbers</p><p class="total" id="nstate">Reading the live counts. This takes about a minute.</p>' +
      '<p class="total" id="nerr"></p><table><thead><tr><th>Kind</th><th>Answered</th><th>Right</th><th>Trapped</th></tr></thead><tbody>' + rows + '</tbody></table></section>';
    if (!STATS || !window.fetch) return;
    api('get', SETV + 'err').then(function (v) { var el = document.getElementById('nerr'); if (el) el.textContent = 'Players who hit an error: ' + v + '.'; }).catch(function () {});
    var i = 0, base = function (k) { return SETV + 'k' + k.kind; };
    var step = function () {
      if (game || !document.getElementById('nstate')) return;
      if (i >= ks.length) { document.getElementById('nstate').textContent = 'Lifetime counts since this question bank went live. Fewer than 30 answers tells you little.'; return; }
      var k = ks[i], at = i++;
      Promise.all([api('get', base(k) + 'n'), api('get', base(k) + 'r'), api('get', base(k) + 't')]).then(function (v) {
        var cell = function (id, txt) { var el = document.getElementById(id + at); if (el) el.textContent = txt; };
        cell('n', v[0]); cell('r', v[0] ? Math.round(v[1] / v[0] * 100) + '%' : '–'); cell('t', v[0] ? Math.round(v[2] / v[0] * 100) + '%' : '–');
      }).catch(function () {}).then(function () { seq.push(setTimeout(step, 1100)); });   // three requests a go, kept under the service's limit
    };
    step();
  }

  /* ---------- Events ---------- */
  // If anything does go wrong, say so and offer a reload rather than leave a dead screen.
  function oops(e) {
    if (broke) return; broke = true;
    try { if (window.console) console.error('Not So Fast:', e && (e.message || e)); } catch (x) { /* no console */ }
    try { if (STATS && window.fetch) api('hit', SETV + 'err').catch(function () {}); } catch (x) { /* fine */ }
    var el = document.getElementById('oops'); if (el) el.hidden = false;
    track('game_error', { message: String((e && (e.message || e)) || '').slice(0, 120) });
  }
  window.addEventListener('error', function (e) { if (e && e.filename && e.filename.split('#')[0] === location.href.split('#')[0]) oops(e); });
  document.addEventListener('click', function (e) { try { tap(e); } catch (x) { oops(x); } });
  function tap(e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t) { if (e.target === veil) closeSheet(); return; }
    var act = t.getAttribute('data-act'), now = Date.now();
    if (act === 'reload') { location.reload(); return; }
    if (now < quiet) return;
    if (!/^(key|sound|pn[-+]|pq[-+]|round[-+]|rand)$/.test(act)) quiet = now + 350;
    if (act === 'daily' && onHome() && sig() !== homeSig) { home(); return; }   // the page sat open past midnight: show today's button first
    if (act === 'key') key(t.getAttribute('data-k'));
    else if (act === 'enter') { lock(false); if (ask) quiet = 0; }   // nothing was locked (no number yet), so nothing changed
    else if (act === 'next') {
      if (game.mode !== 'run') next();
      else if (game.lives <= 0) runEnd();
      else runNext();
    }
    else if (act === 'run') { closeSheet(); startRun(); }
    else if (act === 'runshare') { track('share', { what: 'endless', mode: 'endless', greens: game.right }); send(NAME + ', endless mode\n' + EMOJI.right + ' ' + game.right + ' green ' + (game.right === 1 ? 'light' : 'lights') + ' before three reds\n' + SITE, 'Copied. Paste it anywhere.'); }
    else if (act === 'daily') startDaily();
    else if (act === 'friends') friendsSheet();
    else if (act === 'party') partySheet();
    else if (act === 'table') tableSheet();
    else if (act === 'help') { help(); track('help_opened', {}); }
    else if (act === 'stats') stats();
    else if (act === 'answers') { answersSheet(); track('answers_opened', { mode: game.mode === 'daily' ? 'daily' : 'private' }); }
    else if (act === 'inapp') inAppSheet();
    else if (act === 'close') closeSheet();
    else if (act === 'copy') { send(shareText(), 'Copied. Paste it to a friend.'); track('share', { what: 'result', mode: game.mode === 'daily' ? 'daily' : 'private', greens: rightCount(game.st) }); }
    else if (act === 'friend') { track('share', { what: 'question', mode: game.mode }); var fi = t.getAttribute('data-i'); send(fi === 'run' ? friendText(game.cur, game.res) : friendText(game.set[+fi], game.st.res[+fi]), 'Question copied. Paste it to a friend.'); }
    else if (act === 'sound') { store.sound = !store.sound; save(); paintSound(); if (store.sound) SFX.key(); }
    else if (act === 'home') {
      var mid = game && ((game.mode === 'run' && !game.over) || (game.mode === 'party' && game.at !== 'final') || (game.mode === 'table' && !game.st.done));
      if (mid && !t.hasAttribute('data-sure')) leaveSheet(); else { closeSheet(); home(); }
    }
    else if (act === 'copylink') { copyText(LINK, 'Link copied. Paste it into ' + BROWSER + '.'); track('share', { what: 'link', mode: 'daily' }); }
    else if (act === 'deal') deal();
    else if (act === 'rand') { table.code = randomCode(); var c = document.getElementById('code'); if (c) c.value = table.code; }
    else if (act === 'round-' || act === 'round+') {
      table.round = Math.max(1, Math.min(99, table.round + (act === 'round+' ? 1 : -1)));
      var o = document.getElementById('round'); if (o) o.textContent = table.round;
    }
    else if (act === 'nextround') { table.round = game.round + 1; startTable(game.code, table.round); }
    else if (act === 'rivalround') { table.code = store.rival.code; table.round = store.rival.round; startTable(table.code, table.round); }
    else if (act === 'pn-' || act === 'pn+') {
      readNames();
      if (act === 'pn+' && cfg.names.length < 6) cfg.names.push('');
      if (act === 'pn-' && cfg.names.length > 2) cfg.names.pop();
      partySheet();
    }
    else if (act === 'pq-' || act === 'pq+') { readNames(); cfg.count = Math.max(3, Math.min(7, cfg.count + (act === 'pq+' ? 2 : -2))); partySheet(); }
    else if (act === 'pstart') partyStart();
    else if (act === 'pgo') partyAnswer();
    else if (act === 'preveal') partyReveal();
    else if (act === 'pnext') partyNext();
    else if (act === 'pagain') startParty(game.players.map(function (p) { return p.name; }), game.set.length);
    else if (act === 'pshare') { send(partyShare(), 'Result copied. Paste it anywhere.'); track('share', { what: 'party', mode: 'party' }); }
  }
  document.addEventListener('keydown', function (e) { try { typedKey(e); } catch (x) { oops(x); } });
  function typedKey(e) {
    if (e.key === 'Enter' && e.repeat) { e.preventDefault(); return; }   // a held key must not run through the screens
    if (!veil.hidden) { if (e.key === 'Escape') closeSheet(); else if (e.key === 'Enter' && document.getElementById('code')) deal(); return; }
    if (ask) {
      if (/^[0-9]$/.test(e.key)) key(e.key);
      else if (e.key === '.' || e.key === ',') key('.');
      else if (e.key === 'Backspace') { key('del'); e.preventDefault(); }
      else if (e.key === 'Enter') { lock(false); e.preventDefault(); }
    } else if (e.key === 'Enter' && !pending) {
      var b = view.querySelector('[data-enter]');
      if (b && !(b.closest('.hid'))) { b.click(); e.preventDefault(); }
    }
  }

  /* ---------- Keeping up with other tabs, with midnight, and with a page that was put away ---------- */
  function heard() {
    var was = store.daily;
    if (adopt()) save();
    if (game && game.mode === 'daily') {
      if (store.daily !== was && store.daily && store.daily.day === game.day) startDaily();   // another tab played on: show where things stand
      else if (store.daily !== was) { store.daily = was; }
    } else if (onHome() && sig() !== homeSig) home();
  }
  window.addEventListener('storage', function (e) { if (e.key === KEY) { try { heard(); } catch (x) { oops(x); } } });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { try { heard(); } catch (x) { oops(x); } } });
  window.addEventListener('pageshow', function (e) { if (e.persisted) { try { heard(); } catch (x) { oops(x); } } });
  window.addEventListener('hashchange', function () {   // a friend's link pasted into a tab that is already open
    try { var h = readLink(); if (h === 'numbers' && !game) numbers(); else if (onHome() || (game && game.mode === 'daily' && game.st.done)) home(); } catch (x) { oops(x); }
  });

  /* ---------- Boot ---------- */
  function start(snap) {
    if (!hadLocal && snap && snap.store && typeof snap.store === 'object' && snap.store.stats) store = clean(snap.store);
    paintSound();
    var h = readLink();
    if (h === 'numbers') numbers();
    else if (resume()) { /* back in endless mode, the party or the private round they were in */ }
    else if (dailyState() === 'going') startDaily();   // a refresh mid-game goes back to the question, where the one clock is still running
    else home();   // everyone else, new or not, starts at the front page: the goal, the lights, one button
  }
  function boot(snap) {
    try { start(snap); loadAnalytics(); }
    catch (e) {   // should be impossible; if it is not, drop the game in progress and keep the record
      oops(e); stopTimers(); game = null; ask = null; store.live = null; store.daily = null; store.rival = null; save();
      try { home(); } catch (e2) { /* the bar offers a reload */ }
    }
  }
  var hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(function () { return { store: store }; });
  if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
})();
