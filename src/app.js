/* Screens, the clock, signs, sounds, sharing and the daily crowd numbers. Game state lives in this browser. */
(function () {
  'use strict';
  var E = window.BaitEngine;
  var NAME = 'Not So Fast';            // change it here and it changes everywhere
  var SHARE_URL = 'playnotsofast.com';
  var LIMIT = 120;                     // seconds per question
  var KEY = 'nsf.v4', OLD_KEY = 'daily.v3';

  // Crowd numbers: anonymous counters on a free public counting service.
  // Set STATS to '' to switch them off. Nothing about the player is sent.
  var STATS = 'https://abacus.jasoncameron.dev';
  var STATS_NS = 'playnotsofast.com';
  var STATS_VER = 'v4';                // bump when the question bank changes, so counts never mix
  var BUCKETS = [10, 20, 40, 70, 121]; // upper edge, in seconds, of each solve-time band
  var MIN_CROWD = 10;                  // do not show a percentage until this many have answered

  var EMOJI = { right: '🟢', bait: '🛑', wrong: '❌', time: '🐌' };
  var WORD = { right: 'Nailed it', bait: 'Not so fast', wrong: 'Nope', time: 'Too slow' };
  var RANK = ['Slow down', 'Caught speeding', 'Sharp', 'Untrappable'];

  var app = document.getElementById('app');
  var view = document.getElementById('view');
  var veil = document.getElementById('veil');
  var toastEl = document.getElementById('toast');
  var flashEl = document.getElementById('flash');
  var fx = document.getElementById('fx');
  document.getElementById('brand').textContent = NAME;
  document.title = NAME;

  var hadLocal = false;
  var store = load();
  var game = null, typed = '', ticker = null, countdown = null, pending = null, toastTimer = null, fresh = false, lastBeep = -1;
  var table = { code: '', round: 1 };
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  function blank() { return { sound: true, stats: { played: 0, perfect: 0, streak: 0, best: 0, lastDay: 0, dist: [0, 0, 0, 0] }, daily: null }; }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.stats && s.stats.dist) { hadLocal = true; if (typeof s.sound !== 'boolean') s.sound = true; return s; }
      var old = JSON.parse(localStorage.getItem(OLD_KEY));  // keep the streak from the earlier version
      if (old && old.stats && old.stats.dist) { hadLocal = true; var b = blank(); b.stats = old.stats; return b; }
    } catch (e) { /* storage may be unavailable */ }
    return blank();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* play on without it */ } }
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
  function rightCount(st) { return st.res.filter(function (r) { return r && r.f === 'right'; }).length; }
  function totalSecs(st) { var t = 0; st.res.forEach(function (r) { if (r) t += r.secs; }); return t; }
  function liveStreak() { var s = store.stats; return s.lastDay >= today() - 1 ? s.streak : 0; }
  function dailyState() {
    var d = store.daily;
    if (!d || d.day !== today()) return 'new';
    return d.done ? 'done' : 'going';
  }

  /* ---------- Signs and the snail ---------- */
  function oct(s) {
    var a = 35.15, pts = [[a, 0], [120 - a, 0], [120, a], [120, 120 - a], [120 - a, 120], [a, 120], [0, 120 - a], [0, a]];
    return pts.map(function (p) { return (60 + (p[0] - 60) * s).toFixed(1) + ',' + (60 + (p[1] - 60) * s).toFixed(1); }).join(' ');
  }
  function words(lines, size, fill, ys) {
    return lines.map(function (w, i) { return '<text x="60" y="' + ys[i] + '" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="' + size + '" fill="' + fill + '">' + w + '</text>'; }).join('');
  }
  // kind: right | bait | wrong | time. With words it is the big verdict; without, a small marker.
  function sign(kind, big) {
    var s;
    if (kind === 'bait') {
      s = '<polygon points="' + oct(1) + '"/><polygon points="' + oct(0.94) + '" fill="#fff"/><polygon points="' + oct(0.85) + '" fill="#E1251B"/>' +
        (big ? words(['NOT', 'SO', 'FAST'], 28, '#fff', [45, 69.5, 94]) : '<rect x="53" y="28" width="14" height="42" rx="7" fill="#fff"/><circle cx="60" cy="86" r="8" fill="#fff"/>');
    } else if (kind === 'right') {
      s = '<circle cx="60" cy="60" r="60"/><circle cx="60" cy="60" r="56.5" fill="#fff"/><circle cx="60" cy="60" r="51" fill="#0A8F43"/>' +
        (big ? words(['NAILED', 'IT'], 28, '#fff', [57, 83]) : '<path d="M36 62l16 16 32-34" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>');
    } else {
      s = '<circle cx="60" cy="60" r="60"/><circle cx="60" cy="60" r="56.5" fill="#fff"/><circle cx="60" cy="60" r="52.5" fill="#E1251B"/><circle cx="60" cy="60" r="40" fill="#fff"/>' +
        (kind === 'time'
          ? (big ? words(['TOO', 'SLOW'], 23, '#000', [57, 79]) : '<path d="M60 40v22l13 9" fill="none" stroke="#000" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>')
          : (big ? words(['NOPE'], 29, '#000', [70.5]) : '<path d="M45 45l30 30M75 45L45 75" fill="none" stroke="#000" stroke-width="11" stroke-linecap="round"/>'));
    }
    return '<svg viewBox="0 0 120 120" role="img" aria-label="' + WORD[kind] + '">' + s + '</svg>';
  }
  var SNAIL = '<svg class="snail" viewBox="0 0 66 48" aria-hidden="true">' +
    '<path d="M52 15l-3-9M58 15l4-8" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/><circle cx="49" cy="5" r="3.2"/><circle cx="62" cy="6" r="3.2"/>' +
    '<path d="M3 44c-1-5 5-11 14-11h29V20c0-5 4-8 8.5-8S63 15 63 20v15c0 6-4 9-10 9z" fill="#fff" stroke="#000" stroke-width="3" stroke-linejoin="round"/>' +
    '<circle cx="27" cy="24" r="17" fill="#E1251B" stroke="#000" stroke-width="3"/>' +
    '<path d="M27 25a3.5 3.5 0 1 1 3.5-3.5A8 8 0 1 1 19 26" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M51 27q3.5 3 7 0" fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round"/></svg>';
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
  function buzz(p) { try { if (store.sound && navigator.vibrate) navigator.vibrate(p); } catch (e) { /* not every phone can */ } }
  function paintSound() {
    var b = document.getElementById('snd');
    b.innerHTML = store.sound ? ICON.on : ICON.off;
    b.setAttribute('aria-label', store.sound ? 'Sound is on. Turn it off' : 'Sound is off. Turn it on');
  }

  /* ---------- Confetti, the camera flash and the shake ---------- */
  function burst(x, y, n) {
    if (calm || !fx || !fx.getContext) return;
    var ctx = fx.getContext('2d'), dpr = window.devicePixelRatio || 1, w = window.innerWidth, h = window.innerHeight;
    fx.width = w * dpr; fx.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cols = ['#0A8F43', '#fff', '#000', '#E1251B'], ps = [];
    for (var i = 0; i < n; i++) ps.push({ x: x, y: y, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 13 - 3, s: 5 + Math.random() * 7, c: cols[i % 4], o: i % 3 === 0 });
    var t0 = performance.now();
    (function frame(t) {
      var k = (t - t0) / 1300;
      ctx.clearRect(0, 0, w, h);
      if (k >= 1) return;
      ctx.globalAlpha = 1 - k * k;
      for (var j = 0; j < ps.length; j++) {
        var p = ps[j]; p.vy += 0.45; p.x += p.vx; p.y += p.vy; ctx.fillStyle = p.c;
        if (p.o) { ctx.beginPath(); ctx.arc(p.x, p.y, p.s / 2, 0, 6.3); ctx.fill(); } else ctx.fillRect(p.x, p.y, p.s, p.s);
      }
      requestAnimationFrame(frame);
    })(t0);
  }
  function replay(el, cls) { if (!el || calm) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function cheer(f) {
    SFX[f]();
    if (f === 'right') {
      buzz([15, 40, 25]);
      var s = document.getElementById('sg');
      if (s) { var b = s.getBoundingClientRect(); setTimeout(function () { burst(b.left + b.width / 2, b.top + b.height / 2, 46); }, 170); }
    } else if (f === 'bait') {
      buzz([90, 50, 90]);
      setTimeout(function () { replay(flashEl, 'go'); replay(app, 'quake'); }, 190);
    } else buzz(70);
  }

  /* ---------- Crowd numbers ---------- */
  function api(kind, key) {
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 5000);
    return fetch(STATS + '/' + kind + '/' + STATS_NS + '/' + key, ctl ? { signal: ctl.signal } : undefined)
      .then(function (r) { return r.ok ? r.json() : { value: 0 }; })
      .then(function (j) { clearTimeout(timer); return Number(j.value) || 0; });
  }
  function band(secs) { for (var i = 0; i < BUCKETS.length; i++) if (secs < BUCKETS[i]) return i; return BUCKETS.length - 1; }
  function askCrowd(day, i, r) {
    if (!STATS || !window.fetch) return;
    var base = STATS_VER + 'd' + day + 'q' + (i + 1);
    var jobs = [api('hit', base + 'n'), api(r.f === 'right' ? 'hit' : 'get', base + 'r')];
    if (r.f === 'right') {
      var b = band(r.secs);
      jobs.push(api('hit', base + 'b' + b));
      for (var j = b + 1; j < BUCKETS.length; j++) jobs.push(api('get', base + 'b' + j));
    }
    Promise.all(jobs).then(function (v) {
      var slower = 0; for (var k = 3; k < v.length; k++) slower += v[k];
      r.crowd = { n: v[0], r: Math.min(v[0], v[1]), slower: slower };
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
    var pct = crowdPct(r), s = (pct < 50 ? 'Only ' : '') + pct + '% of ' + E.num(c.n) + ' players got this right.';
    if (r.f === 'right' && c.r >= MIN_CROWD) s += ' You were faster than ' + Math.min(99, Math.round(c.slower / (c.r - 1) * 100)) + '% of them.';
    return s;
  }

  /* ---------- Home ---------- */
  function home() {
    stopTimers(); game = null;
    var state = dailyState(), streak = liveStreak();
    var label = state === 'done' ? 'See my score' : state === 'going' ? 'Carry on' : 'Play today’s three';
    view.innerHTML =
      '<section class="home">' +
        '<div class="hero" aria-hidden="true"><i class="post"></i><div class="sg">' + sign('bait', true) + '</div>' + SNAIL + '</div>' +
        '<p class="pitch">Three questions a day. One guess each. The obvious answer is the trap.</p>' +
        (streak > 1 ? '<p class="streak">' + streak + '-day streak</p>' : '') +
        '<button class="btn" data-act="daily">' + label + '</button>' +
        '<button class="btn plate" data-act="table">Play with friends</button>' +
        '<p class="meta"><span>No. ' + today() + '</span><span>' + esc(dateLine()) + '</span></p>' +
      '</section>';
  }

  /* ---------- Starting ---------- */
  function startDaily() {
    var d = today();
    if (!store.daily || store.daily.day !== d) { store.daily = { day: d, idx: 0, res: [], qStart: Date.now(), done: false }; save(); }
    game = { mode: 'daily', day: d, set: E.buildDaily(d), st: store.daily };
    typed = ''; fresh = false;
    if (game.st.done) end(false); else play();
  }
  function startTable(code, round) {
    game = { mode: 'table', code: code, round: round, set: E.buildTable(code, round), st: { idx: 0, res: [], qStart: Date.now(), done: false } };
    typed = ''; fresh = false;
    play();
  }
  function persist() { if (game && game.mode === 'daily') save(); }

  /* ---------- Play ---------- */
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
        keyBtn(7) + keyBtn(8) + keyBtn(9) + '<button class="lock" data-act="enter">Lock<br>it in</button>' +
        '<button class="zero" data-act="key" data-k="0">0</button>' +
      '</div></div>';
  }
  function resultHtml(q, r, i) {
    var ans = E.show(q, q.a), you;
    if (r.f === 'right') you = 'Solved in ' + mmss(r.secs) + (r.secs < 15 ? '. Lightning.' : r.secs < 45 ? '. Sharp.' : '.');
    else if (r.f === 'bait') you = 'You said ' + E.show(q, parseFloat(r.t)) + '. That is the trap.';
    else if (r.f === 'time') you = 'The two minutes ran out.';
    else you = 'You said ' + E.show(q, parseFloat(r.t)) + '.';
    return '<div class="result">' +
      '<div class="verdict"><div class="sg' + (fresh ? ' slam' : '') + '" id="sg">' + sign(r.f, true) + '</div>' +
        '<div class="vt"><p class="lab">' + (r.f === 'right' ? 'Your answer' : 'The answer') + '</p><p class="big' + (ans.length > 8 ? ' sm' : '') + '">' + esc(ans) + '</p><p class="you">' + esc(you) + '</p></div></div>' +
      '<p class="crowd" id="crowd" role="status">' + esc(crowdLine(r)) + '</p>' +
      '<p class="why">' + esc(q.why) + '</p>' +
      '<div class="btns"><button class="btn plate" data-act="friend" data-i="' + i + '">Ask a friend</button><button class="btn" data-act="next">' + (i < 2 ? 'Next question' : 'See my score') + '</button></div>' +
    '</div>';
  }
  function play() {
    stopTimers();
    var st = game.st, i = st.idx, q = game.set[i], r = st.res[i], hud = '';
    for (var k = 0; k < 3; k++) { var p = st.res[k]; hud += p ? sign(p.f, false) : '<i class="dot' + (k === i ? ' now' : '') + '">' + (k + 1) + '</i>'; }
    view.innerHTML =
      '<section class="play">' +
        '<div class="hud"><span class="hudq" role="group" aria-label="Question ' + (i + 1) + ' of 3" style="display:contents">' + hud + '</span>' +
          '<span class="clock" id="clock" aria-label="Time left">' + mmss(r ? LIMIT - r.secs : LIMIT) + '</span></div>' +
        '<div class="road" id="road" style="--p:' + (r ? Math.min(1, r.secs / LIMIT) : 0) + '">' + SNAIL + '</div>' +
        '<div class="plate-q' + (r ? '' : ' solo') + '"><p class="q' + (q.q.length > 125 ? ' long' : '') + '">' + esc(q.q) + '</p></div>' +
        (r ? resultHtml(q, r, i) : entryHtml()) +
      '</section>';
    if (!r) {
      lastBeep = -1;
      paintTyped(false);
      ticker = setInterval(tick, 200);
      tick();
    }
  }
  function tick() {
    if (!game) return;
    var st = game.st, left = LIMIT - (Date.now() - st.qStart) / 1000;
    if (left <= 0) { lock(true); return; }
    var c = document.getElementById('clock'), road = document.getElementById('road');
    if (!c) return;
    var whole = Math.ceil(left);
    c.textContent = mmss(whole);
    c.className = 'clock' + (left <= 15 ? ' low' : '');
    road.style.setProperty('--p', Math.min(1, 1 - left / LIMIT));
    if (whole <= 10 && whole !== lastBeep) { lastBeep = whole; SFX.beep(); }
  }
  function paintTyped(pop) {
    var val = document.getElementById('val'), read = document.getElementById('read');
    if (!val) return;
    val.innerHTML = typed === '' ? '<span class="ph">Type your answer</span>' : parts(game.set[game.st.idx], typed);
    if (pop) replay(read, 'pop');
  }
  function key(k) {
    if (!game || game.st.done || game.st.res[game.st.idx]) return;
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
    if (!game) return;
    var st = game.st, q = game.set[st.idx];
    if (st.res[st.idx]) return;
    var f = timeout ? 'time' : E.judge(q, typed);
    if (f === 'bad') {
      replay(document.getElementById('read'), 'shake');
      toast('Type a number first');
      return;
    }
    if (f === 'low' || f === 'high') f = 'wrong';
    var used = Math.min(LIMIT, Math.max(0, (Date.now() - st.qStart) / 1000));
    var r = { t: timeout ? '' : String(parseFloat(typed)), f: f, secs: Math.round(used) };
    st.res[st.idx] = r;      // stored at once, so a reload cannot buy a second guess
    typed = '';
    persist();
    stopTimers();
    if (game.mode === 'daily') askCrowd(game.day, st.idx, r);
    var show = function () { pending = null; if (!game) return; fresh = true; play(); fresh = false; cheer(r.f); };
    if (timeout || calm) { show(); return; }
    SFX.lock(); buzz(20);
    var read = document.getElementById('read'); if (read) read.classList.add('locking');
    pending = setTimeout(show, 430);   // one held breath before the sign lands
  }
  function next() {
    var st = game.st;
    if (!st.res[st.idx]) return;
    if (st.idx >= 2) { finish(); return; }
    st.idx++; st.qStart = Date.now(); typed = '';
    persist();
    play();
    window.scrollTo(0, 0);
  }
  function finish() {
    var st = game.st;
    if (game.mode === 'daily' && !st.done) {
      var s = store.stats;
      if (s.lastDay !== game.day) {
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
    st.done = true;
    persist();
    end(first);
    if (first && rightCount(st) === 3) { setTimeout(function () { SFX.sweep(); buzz([20, 40, 20, 40, 40]); burst(window.innerWidth / 2, 200, 90); }, 520); }
  }

  /* ---------- Score ---------- */
  function shareText() {
    var st = game.st;
    var head = game.mode === 'daily' ? NAME + ' #' + game.day : NAME + ', table ' + game.code + ' round ' + game.round;
    return head + '\n' + st.res.map(function (r) { return EMOJI[r.f]; }).join('') + '  ' + rightCount(st) + '/3 in ' + mmss(totalSecs(st)) + '\n' + SHARE_URL;
  }
  function friendText(i) {
    var q = game.set[i], r = game.st.res[i], pct = crowdPct(r);
    return (r.f === 'right' ? 'I got this one in ' + mmss(r.secs) + '. Can you?' : 'This one caught me. Can you get it?') +
      '\n\n' + q.q + '\n\n' + (pct >= 0 && pct < 50 ? 'Only ' + pct + '% of players got it today. ' : '') + 'No calculator. ' + SHARE_URL;
  }
  function send(text, done) {
    var showIt = function () { sheet('Copy this', '<h2 class="big">Copy this</h2><p>Press and hold the text to copy it.</p><pre class="sharetext">' + esc(text) + '</pre>'); };
    var clip = function () { try { navigator.clipboard.writeText(text).then(function () { toast(done); }, showIt); } catch (e) { showIt(); } };
    if (touch && navigator.share) {
      try { navigator.share({ text: text }).catch(function (e) { if (!e || e.name !== 'AbortError') clip(); }); } catch (e) { clip(); }
    } else clip();
  }
  function statsBlock() {
    var s = store.stats, max = Math.max.apply(null, s.dist.concat(1)), bars = '';
    var mine = game && game.mode === 'daily' && game.st.done ? rightCount(game.st) : -1;
    for (var i = 3; i >= 0; i--) bars += '<div><span>' + i + '</span><i class="' + (i === mine ? 'hi' : '') + '" style="width:' + Math.max(10, s.dist[i] / max * 100) + '%">' + s.dist[i] + '</i></div>';
    return '<h2>Your record</h2>' +
      '<div class="nums">' +
        '<div><b>' + s.played + '</b><span>Played</span></div>' +
        '<div><b>' + (s.played ? Math.round(s.perfect / s.played * 100) : 0) + '%</b><span>Perfect</span></div>' +
        '<div><b>' + liveStreak() + '</b><span>Streak</span></div>' +
        '<div><b>' + s.best + '</b><span>Best</span></div>' +
      '</div>' +
      '<h2>Right answers per day</h2><div class="dist">' + bars + '</div>';
  }
  function end(first) {
    stopTimers(); clearTimeout(toastTimer); toastEl.hidden = true;
    var st = game.st, signs = '', recap = '', n = rightCount(st), daily = game.mode === 'daily';
    for (var i = 0; i < 3; i++) {
      var r = st.res[i], q = game.set[i], pct = crowdPct(r);
      signs += '<div class="sg">' + sign(r.f, true) + '</div>';
      recap += '<li><p class="rq">' + esc(q.q) + '</p>' +
        '<p class="ra">' + sign(r.f, false) + '<b>' + esc(E.show(q, q.a)) + '</b><span class="rt">' +
          esc(r.f === 'right' ? 'in ' + mmss(r.secs) : r.f === 'time' ? 'out of time' : 'you said ' + E.show(q, parseFloat(r.t))) + (pct >= 0 ? ', ' + pct + '% got it' : '') + '</span></p>' +
        '<button class="linkish" data-act="friend" data-i="' + i + '">Ask a friend this one</button></li>';
    }
    view.innerHTML =
      '<section class="end">' +
        '<p class="endno">' + (daily ? 'No. ' + game.day : 'Table ' + esc(game.code) + ', round ' + game.round) + '</p>' +
        '<div class="endsigns' + (first ? ' fresh' : '') + '">' + signs + '</div>' +
        '<p class="rank">' + RANK[n] + '</p>' +
        '<p class="total">' + n + ' of 3 right, ' + mmss(totalSecs(st)) + ' on the clock</p>' +
        '<div class="endbtns"><button class="btn" data-act="copy">Share my score</button>' +
          (daily ? '<button class="btn plate" data-act="table">Play with friends</button>' : '<button class="btn plate" data-act="nextround">Next round</button><button class="btn plate" data-act="home">Back to today</button>') +
        '</div>' +
        (daily ? '<p class="nextset"><span>Next three in</span><b id="cd">' + untilMidnight() + '</b></p>' + statsBlock() : '') +
        '<h2>' + (daily ? 'Today’s three' : 'This round') + '</h2><ol class="recap">' + recap + '</ol>' +
      '</section>';
    window.scrollTo(0, 0);
    if (first && n < 3) SFX.lock();
    if (daily) runCountdown();
  }

  /* ---------- Sheets ---------- */
  function sheet(label, body) {
    veil.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(label) + '"><div class="sheet-top"><button class="ico" data-act="close" aria-label="Close"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button></div>' + body + '</div>';
    veil.hidden = false;
  }
  function closeSheet() { veil.hidden = true; veil.innerHTML = ''; }
  function eg(kind, val, note) { return '<div class="line">' + sign(kind, false) + '<p><b>' + val + '</b><span>' + note + '</span></p></div>'; }
  function help() {
    sheet('How to play',
      '<h2 class="big">How to play</h2>' +
      '<ul><li>Three questions a day, the same three for everyone.</li><li>One guess at each, with two minutes on the clock.</li><li>Every question has an obvious answer. It is usually the trap.</li></ul>' +
      '<div class="eg"><p class="egq">A bat and a ball cost €1.10. The bat costs €1.00 more than the ball. How much is the ball?</p>' +
        eg('right', '5 cents', 'Right. It takes a second look.') +
        eg('bait', '10 cents', 'The trap. It is the answer that jumps out first.') +
        eg('wrong', 'Anything else', 'Wrong, but at least you dodged the trap.') +
      '</div>' +
      '<p>A new three arrive at midnight. Send any question to a friend with “Ask a friend” and see if it catches them too.</p>' +
      '<p class="small">To show how other players did, the game sends an anonymous count of right and wrong answers. Nothing about you is sent or stored.</p>');
  }
  function stats() { sheet('Your record', statsBlock()); }
  function randomCode() {
    var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ', c = '';
    for (var i = 0; i < 4; i++) c += a.charAt(Math.floor(Math.random() * a.length));
    return c;
  }
  function tableSheet() {
    if (!table.code) table.code = randomCode();
    sheet('Play with friends',
      '<h2 class="big">Play with friends</h2>' +
      '<p>Everyone types the same code and gets the same three questions. Play on your own phones, then compare.</p>' +
      '<div class="field"><label for="code">Code</label><input id="code" maxlength="8" autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + esc(table.code) + '"><button class="linkish" data-act="rand" style="justify-self:start">Give me a random code</button></div>' +
      '<div class="field"><span class="lab">Round</span><div class="stepper"><button data-act="round-" aria-label="Previous round">−</button><output id="round">' + table.round + '</output><button data-act="round+" aria-label="Next round">+</button></div></div>' +
      '<button class="btn" data-act="deal">Start the round</button>');
  }
  function deal() {
    var input = document.getElementById('code');
    var code = String((input && input.value) || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (!code) { toast('Type a code first'); return; }
    table.code = code;
    closeSheet();
    startTable(table.code, table.round);
  }

  /* ---------- Events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t) { if (e.target === veil) closeSheet(); return; }
    var act = t.getAttribute('data-act');
    if (act === 'key') key(t.getAttribute('data-k'));
    else if (act === 'enter') lock(false);
    else if (act === 'next') next();
    else if (act === 'daily') startDaily();
    else if (act === 'table') tableSheet();
    else if (act === 'help') help();
    else if (act === 'stats') stats();
    else if (act === 'close') closeSheet();
    else if (act === 'copy') send(shareText(), 'Score copied. Paste it anywhere.');
    else if (act === 'friend') send(friendText(Number(t.getAttribute('data-i'))), 'Question copied. Paste it to a friend.');
    else if (act === 'sound') { store.sound = !store.sound; save(); paintSound(); if (store.sound) SFX.key(); }
    else if (act === 'home') { closeSheet(); home(); }
    else if (act === 'deal') deal();
    else if (act === 'rand') { table.code = randomCode(); var c = document.getElementById('code'); if (c) c.value = table.code; }
    else if (act === 'round-' || act === 'round+') {
      table.round = Math.max(1, Math.min(99, table.round + (act === 'round+' ? 1 : -1)));
      var o = document.getElementById('round'); if (o) o.textContent = table.round;
    }
    else if (act === 'nextround') { table.round = game.round + 1; startTable(game.code, table.round); }
  });
  document.addEventListener('keydown', function (e) {
    if (!veil.hidden) { if (e.key === 'Escape') closeSheet(); else if (e.key === 'Enter' && document.getElementById('code')) deal(); return; }
    if (!game || game.st.done) return;
    if (game.st.res[game.st.idx]) { if (e.key === 'Enter' && !pending) { next(); e.preventDefault(); } return; }
    if (/^[0-9]$/.test(e.key)) key(e.key);
    else if (e.key === '.' || e.key === ',') key('.');
    else if (e.key === 'Backspace') { key('del'); e.preventDefault(); }
    else if (e.key === 'Enter') { lock(false); e.preventDefault(); }
  });

  /* ---------- Boot ---------- */
  function start(snap) {
    if (!hadLocal && snap && snap.store && snap.store.stats && snap.store.stats.dist) { store = snap.store; if (typeof store.sound !== 'boolean') store.sound = true; }
    paintSound();
    home();
  }
  var hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(function () { return { store: store }; });
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
