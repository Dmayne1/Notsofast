/* Screens, the clock, signs, sounds, sharing, friends and the live counters. Game state lives in this browser. */
(function () {
  'use strict';
  var E = window.BaitEngine;
  var NAME = 'Not So Fast';            // change it here and it changes everywhere
  var SITE = 'playnotsofast.com';
  var LINK = 'https://' + SITE + '/';
  var LIMIT = 120;                     // seconds per question on your own
  var PARTY_LIMIT = 60;                // seconds per player when one phone is passed round
  var KEY = 'nsf.v4', OLD_KEY = 'daily.v3';
  var SETV = 'v6';                     // bump when the question bank changes: today's set restarts and counts never mix

  // Live counters: anonymous tallies on a free public counting service.
  // Set STATS to '' to switch them off. Nothing about the player is sent.
  var STATS = 'https://abacus.jasoncameron.dev';
  var STATS_NS = 'playnotsofast.com';
  var BUCKETS = [10, 20, 40, 70, 121]; // upper edge, in seconds, of each solve-time band
  var MIN_CROWD = 10;                  // do not show a percentage until this many have answered

  var EMOJI = { right: '🟢', bait: '🛑', wrong: '❌', time: '🐌' };
  var WORD = { right: 'Correct', bait: 'Not so fast', wrong: 'Wrong', time: 'Out of time' };
  // The score is a distance. A right answer moves your snail on, further for a harder question,
  // plus a metre for every second left on the clock; anything else moves it nowhere.
  // So speed pays, but only if you are right, and the last question is worth the most.
  var BASE = { 1: 100, 2: 150, 3: 200 };
  var LEVEL = { 1: 'Warm-up', 2: 'Trickier', 3: 'The hard one' };
  var DAY_MAX = BASE[1] + BASE[2] + BASE[3] + 3 * LIMIT;
  var PLACES = [[700, 'The open road'], [500, 'Edge of town'], [250, 'End of the street'], [1, 'The garden gate'], [0, 'Still on the doorstep']];

  var app = document.getElementById('app');
  var view = document.getElementById('view');
  var veil = document.getElementById('veil');
  var toastEl = document.getElementById('toast');
  var flashEl = document.getElementById('flash');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
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
  var RUN_LIMIT = 60, RUN_LIVES = 3;   // the long road: a minute a question, three wrong turns and you are out
  var kindTotal = 0;

  function blank() { return { sound: false, stats: { played: 0, perfect: 0, streak: 0, best: 0, lastDay: 0, dist: [0, 0, 0, 0] }, daily: null, names: [], rival: null }; }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.stats && s.stats.dist) { hadLocal = true; if (typeof s.sound !== 'boolean') s.sound = false; return s; }
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
  function night() { /* one dark theme: kept so screens can still say when play starts */ }
  function mOf(r) { return !r ? 0 : typeof r.m === 'number' ? r.m : r.f === 'right' ? 100 + Math.max(0, LIMIT - r.secs) : 0; }
  function totalM(st) { var t = 0; st.res.forEach(function (r) { t += mOf(r); }); return t; }
  function place(m) { for (var i = 0; i < PLACES.length; i++) if (m >= PLACES[i][0]) return PLACES[i][1]; }
  function far(m) { return m < 1000 ? m + ' m' : (m / 1000).toFixed(1) + ' km'; }
  function beat(q, r) { if (r.f !== 'right') return; store.seen = store.seen || {}; if (!store.seen[q.kind]) { store.seen[q.kind] = 1; save(); } }
  function beatenLine() {
    if (!kindTotal) kindTotal = E.kinds().length;
    return 'Kinds of trap you have beaten: ' + Object.keys(store.seen || {}).length + ' of ' + kindTotal + '.';
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

  /* ---------- Signs and the snail ---------- */
  function oct(s) {
    var a = 35.15, pts = [[a, 0], [120 - a, 0], [120, a], [120, 120 - a], [120 - a, 120], [a, 120], [0, 120 - a], [0, a]];
    return pts.map(function (p) { return (60 + (p[0] - 60) * s).toFixed(1) + ',' + (60 + (p[1] - 60) * s).toFixed(1); }).join(' ');
  }
  function words(lines, size, fill, ys) {
    return lines.map(function (w, i) { return '<text x="60" y="' + ys[i] + '" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="' + size + '" fill="' + fill + '">' + w + '</text>'; }).join('');
  }
  // kind: right | bait | wrong | time. Flat and exact, like the real thing. Only the trap sign carries words.
  function sign(kind, big) {
    var s;
    if (kind === 'bait') {
      s = '<polygon points="' + oct(1) + '" fill="#fff"/><polygon points="' + oct(0.9) + '" fill="#D8281C"/>' +
        (big ? words(['NOT', 'SO', 'FAST'], 29, '#fff', [45.5, 70, 94.5]) : '<rect x="53.5" y="28" width="13" height="42" rx="6.5" fill="#fff"/><circle cx="60" cy="86" r="7.5" fill="#fff"/>');
    } else if (kind === 'right') {
      s = '<circle cx="60" cy="60" r="60" fill="#fff"/><circle cx="60" cy="60" r="54" fill="#12924A"/><path d="M36 62l16 16 32-34" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>';
    } else {
      s = '<circle cx="60" cy="60" r="60" fill="#fff"/><circle cx="60" cy="60" r="55" fill="#D8281C"/><circle cx="60" cy="60" r="41" fill="#fff"/>' +
        (kind === 'time' ? '<path d="M60 40v22l13 9" fill="none" stroke="#000" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>'
          : '<path d="M46 46l28 28M74 46L46 74" fill="none" stroke="#000" stroke-width="10" stroke-linecap="round"/>');
    }
    return '<svg viewBox="0 0 120 120" role="img" aria-label="' + WORD[kind] + '">' + s + '</svg>';
  }
  // The marker on the road: a snail as a road-sign pictogram. One flat colour, no face.
  var SNAIL = '<svg class="snail" viewBox="0 0 66 46" aria-hidden="true">' +
    '<path d="M52 13l-3-9M58 13l4-8" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>' +
    '<path d="M2 44c-1-6 6-11 15-11h29V19c0-4.6 3.8-8 8.5-8S63 14.400 63 19v16c0 6-4 9-10 9z" fill="currentColor"/>' +
    '<circle cx="27" cy="23" r="18" fill="currentColor"/>' +
    '<path d="M27 24a3.500 3.500 0 1 1 3.500-3.500A8 8 0 1 1 19 25" fill="none" stroke="#17181a" stroke-width="3.200" stroke-linecap="round"/></svg>';
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
    crawl: function () { for (var i = 0; i < 7; i++) tone(420 + i * 70, i * 0.11, 0.07, 'triangle', 0.08); },
    right: function () { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, i * 0.075, 0.24, 'triangle', 0.2); }); tone(1568, 0.3, 0.4, 'sine', 0.09); },
    bait: function () { [0, 0.21].forEach(function (s) { tone(311, s, 0.16, 'sawtooth', 0.11); tone(392, s, 0.16, 'sawtooth', 0.09); }); },  // a double honk
    wrong: function () { tone(330, 0, 0.16, 'triangle', 0.2); tone(247, 0.15, 0.3, 'triangle', 0.2); },
    time: function () { tone(392, 0, 0.55, 'triangle', 0.2, 185); },
    sweep: function () { [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach(function (f, i) { tone(f, i * 0.085, 0.32, 'triangle', 0.2); }); }
  };
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* not every phone can */ } }
  function paintSound() {
    var b = document.getElementById('snd');
    b.innerHTML = store.sound ? ICON.on : ICON.off;
    b.setAttribute('aria-label', store.sound ? 'Sound is on. Turn it off' : 'Sound is off. Turn it on');
  }

  /* ---------- Confetti, the flash and the shake ---------- */
  function replay(el, cls) { if (!el || calm) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function flash(colour) { flashEl.style.background = colour; replay(flashEl, 'go'); }
  function cheer(f) {
    SFX[f]();
    if (f === 'right') {
      buzz([15, 40, 25]);
      setTimeout(function () { flash('#12924A'); }, 120);
    } else if (f === 'bait') {
      buzz([90, 50, 90]);
      setTimeout(function () { flash('#fff'); replay(app, 'quake'); }, 120);   // caught on camera
    } else buzz(70);
  }

  function countUp(el, from, to, ms, fmt) {
    if (!el) return;
    if (calm) { el.textContent = fmt(to); return; }
    var t0 = performance.now();
    (function frame(t) {
      var k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (k < 1 && el.isConnected) requestAnimationFrame(frame);
    })(t0);
  }
  function inM(v) { return v + ' m'; }
  // After the sign lands, the snail crawls on by whatever the answer earned. The trap makes it flinch instead.
  function crawl(from, to, max, f) {
    var road = document.getElementById('road'), dist = document.getElementById('dist');
    if (!road) return;
    if (to <= from) { if (f === 'bait') seq.push(setTimeout(function () { replay(road.querySelector('.snail'), 'bump'); }, 240)); return; }
    if (calm) { road.style.setProperty('--p', Math.min(1, to / max)); if (dist) dist.textContent = inM(to); return; }
    seq.push(setTimeout(function () { road.classList.add('moving'); road.style.setProperty('--p', Math.min(1, to / max)); SFX.crawl(); countUp(dist, from, to, 900, inM); }, 560));
    seq.push(setTimeout(function () { road.classList.remove('moving'); replay(dist, 'pop'); }, 1500));
  }

  /* ---------- Live counters ---------- */
  function api(kind, key) {
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 5000);
    return fetch(STATS + '/' + kind + '/' + STATS_NS + '/' + key, ctl ? { signal: ctl.signal } : undefined)
      .then(function (r) { return r.ok ? r.json() : { value: 0 }; })
      .then(function (j) { clearTimeout(timer); return Number(j.value) || 0; });
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
    return LINK + '#' + gameKey() + '-' + rightCount(st) + '-' + totalM(st);
  }
  function readLink() {
    var h = (location.hash || '').slice(1), m, v = null;
    if ((m = /^d(\d{1,5})-([0-3])-(\d{1,3})$/.exec(h))) v = { key: 'd' + m[1], n: +m[2], m: +m[3] };
    else if ((m = /^t([A-Z0-9]{1,8})-(\d{1,2})-([0-3])-(\d{1,3})$/.exec(h))) v = { key: 't' + m[1] + '-' + m[2], code: m[1], round: +m[2], n: +m[3], m: +m[4] };
    if (v) { store.rival = v; save(); }
    if (h && h !== 'numbers') { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* fine */ } }
    return h;
  }
  function rivalCard() {
    var v = store.rival;
    if (!v) return '';
    if (v.code) return '<div class="card">A friend sent you a private round. They made it ' + v.m + ' m.<button class="btn" data-act="rivalround">Play their three</button></div>';
    if (v.key !== 'd' + today()) return '';
    return '<div class="card">A friend made it ' + v.m + ' m today, with ' + v.n + ' of 3 right. Beat that.</div>';
  }
  function duelCard() {
    var v = rivalHere();
    if (!v) return '';
    var st = game.st, n = rightCount(st), t = totalM(st);
    var res = t !== v.m ? (t > v.m ? 1 : -1) : 0;
    return '<div class="card duel"><p class="dh">' + (res > 0 ? 'You beat your friend' : res < 0 ? 'Your friend wins' : 'Dead heat') + '</p>' +
      '<p class="dr"><span>You, ' + n + ' of 3</span><b>' + t + ' m</b></p><p class="dr"><span>Your friend, ' + v.n + ' of 3</span><b>' + v.m + ' m</b></p></div>';
  }

  /* ---------- Home ---------- */
  function home() {
    stopTimers(); game = null; ask = null;
    night(false);
    if (store.rival && (typeof store.rival.m !== 'number' || (!store.rival.code && store.rival.key !== 'd' + today()))) { store.rival = null; save(); }   // yesterday's challenge has expired
    var state = dailyState(), streak = liveStreak();
    var label = state === 'done' ? 'See my score' : state === 'going' ? 'Carry on' : 'Play today’s three';
    view.innerHTML =
      '<section class="home">' +
        '<div class="hero" aria-hidden="true"><div class="sg">' + sign('bait', true) + '</div></div>' +
        '<p class="pitch">Three questions a day, each harder than the last. One guess each. The obvious answer is the trap.</p>' +
        rivalCard() +
        (streak > 1 ? '<p class="streak">' + streak + '-day streak</p>' : '') +
        '<button class="btn" data-act="daily" data-enter>' + label + '</button>' +
        (state === 'done' ? '<button class="btn plate" data-act="run">Take the long road</button>' : '') +
        '<button class="btn plate" data-act="friends">Play with friends</button>' +
        '<p class="meta"><span>No. ' + today() + '</span><span>' + esc(dateLine()) + '</span></p>' +
      '</section>';
  }

  /* ---------- Starting ---------- */
  function startDaily() {
    var d = today();
    if (dailyState() === 'new') { store.daily = { v: SETV, day: d, idx: 0, res: [], qStart: Date.now(), done: false }; save(); }
    game = { mode: 'daily', day: d, set: E.buildDaily(d), st: store.daily };
    fresh = false; night(true);
    if (game.st.done) end(false); else play();
  }
  function startTable(code, round) {
    game = { mode: 'table', code: code, round: round, set: E.buildTable(code, round), st: { idx: 0, res: [], qStart: Date.now(), done: false } };
    fresh = false; night(true);
    play();
  }
  function persist() { if (game && game.mode === 'daily') save(); }

  /* ---------- Asking one question: shared by every mode ---------- */
  function parts(q, text) {
    var suf = q.suf || '';
    if (q.ordinal) { var n = parseInt(text, 10); suf = isFinite(n) && n > 0 ? E.ord(n).slice(String(n).length) : ''; }
    else if (parseFloat(text) === 1) suf = suf.replace(/^([a-z]+)s\b/, '$1');
    return (q.pre ? '<span class="u">' + esc(q.pre.trim()) + '</span>' : '') + '<b>' + esc(text) + '</b>' + (suf ? '<span class="u">' + esc(suf) + '</span>' : '');
  }
  function keyBtn(k) { return '<button data-act="key" data-k="' + k + '">' + k + '</button>'; }
  function entryHtml() {
    if (desk) return '<div class="entry"><div class="read" id="read"><span class="v" id="val"></span></div>' +
      '<div class="deskrow"><p class="hint">Type your answer, then press Enter.</p><button class="btn" data-act="enter">Lock it in</button></div></div>';
    return '<div class="entry"><div class="read" id="read"><span class="v" id="val"></span></div>' +
      '<div class="pad">' +
        keyBtn(1) + keyBtn(2) + keyBtn(3) + '<button data-act="key" data-k="del" aria-label="Delete">' + ICON.del + '</button>' +
        keyBtn(4) + keyBtn(5) + keyBtn(6) + '<button data-act="key" data-k="." aria-label="Decimal point">.</button>' +
        keyBtn(7) + keyBtn(8) + keyBtn(9) + '<button class="lock" data-act="enter">Lock<br>it in</button>' +
        '<button class="zero" data-act="key" data-k="0">0</button>' +
      '</div></div>';
  }
  // Every plate says where the question sits on the day's climb, and what it is worth.
  function plateHtml(q, solo) {
    return '<div class="plate-q' + (solo ? ' solo' : '') + '">' +
      '<p class="lvl"><span class="bars l' + q.level + '" aria-hidden="true"><i></i><i></i><i></i></span>' + LEVEL[q.level] + '<b>worth ' + BASE[q.level] + ' m</b></p>' +
      '<p class="q' + (q.q.length > 125 ? ' long' : '') + '">' + esc(q.q) + '</p></div>';
  }
  function partyMax() { var t = 0; game.set.forEach(function (q) { t += BASE[q.level] + PARTY_LIMIT; }); return t; }
  function roadHtml(m, max, label) { return '<div class="road" id="road" style="--p:' + Math.min(1, m / max) + '">' + SNAIL + (label ? '<span class="dist" id="dist" aria-label="Distance so far">' + inM(m) + '</span>' : '') + '</div>'; }
  // a: { q, limit, start, beat, commit(r), reveal(r) }. commit stores the answer at once; reveal shows what happens next.
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
    var c = document.getElementById('clock');
    if (!c) return;
    var whole = Math.ceil(left);
    c.textContent = mmss(whole);
    c.className = 'clock' + (left <= 15 ? ' low' : '');
    if (whole <= 10 && whole !== lastBeep) { lastBeep = whole; SFX.beep(); }
  }
  function paintTyped(pop) {
    var val = document.getElementById('val'), read = document.getElementById('read');
    if (!val || !ask) return;
    val.innerHTML = typed === '' ? '<span class="ph">Type your answer</span>' : parts(ask.q, typed);
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
    r.m = f === 'right' ? BASE[a.q.level] + Math.max(0, a.limit - r.secs) : 0;
    ask = null; typed = '';
    stopTimers();
    a.commit(r);             // stored at once, so a reload cannot buy a second guess
    var show = function () { pending = null; if (game) a.reveal(r); };
    if (timeout || calm || !a.beat) { show(); return; }
    SFX.lock(); buzz(20);
    var read = document.getElementById('read'); if (read) read.classList.add('locking');
    pending = setTimeout(show, 430);   // one held breath before the sign lands
  }

  /* ---------- Playing on your own ---------- */
  function resultHtml(q, r, i, nextLabel) {
    var ans = E.show(q, q.a), you;
    if (r.f === 'right') you = 'Solved in ' + mmss(r.secs) + '. That is ' + mOf(r) + ' m further down the road.';
    else if (r.f === 'bait') you = 'You said ' + E.show(q, parseFloat(r.t)) + '. That is the trap.';
    else if (r.f === 'time') you = 'The clock ran out.';
    else you = 'You said ' + E.show(q, parseFloat(r.t)) + '.';
    return '<div class="result">' +
      '<div class="verdict"><div class="sg' + (fresh ? ' slam' : '') + '" id="sg">' + sign(r.f, true) + '</div>' +
        '<div class="vt"><p class="lab">' + (r.f === 'right' ? 'Correct' : r.f === 'bait' ? 'Not so fast. The answer is' : 'The answer is') + '</p><p class="big' + (ans.length > 8 ? ' sm' : '') + '">' + esc(ans) + '</p><p class="you">' + esc(you) + '</p></div></div>' +
      '<p class="crowd" id="crowd" role="status">' + esc(crowdLine(r)) + '</p>' +
      '<p class="why">' + esc(q.why) + '</p>' +
      '<div class="btns"><button class="btn plate" data-act="friend" data-i="' + i + '">Ask a friend</button><button class="btn" data-act="next" data-enter>' + (nextLabel || (i < 2 ? 'Next question' : 'See my score')) + '</button></div>' +
    '</div>';
  }
  function play() {
    stopTimers(); ask = null;
    var st = game.st, i = st.idx, q = game.set[i], r = st.res[i], hud = '';
    var shown = totalM(st) - (fresh && r ? mOf(r) : 0);   // on a fresh verdict the snail starts where it was, then crawls
    for (var k = 0; k < 3; k++) { var p = st.res[k]; hud += p ? sign(p.f, false) : '<i class="dot' + (k === i ? ' now' : '') + '">' + (k + 1) + '</i>'; }
    view.innerHTML =
      '<section class="play">' +
        '<div class="hud">' + hud + '<span class="clock" id="clock" aria-label="Time left">' + mmss(r ? LIMIT - r.secs : LIMIT) + '</span></div>' +
        roadHtml(shown, DAY_MAX, true) + plateHtml(q, !r) +
        (r ? resultHtml(q, r, i) : entryHtml()) +
      '</section>';
    if (r) return;
    var mode = game.mode, day = game.day;
    beginAsk({ q: q, limit: LIMIT, start: st.qStart, beat: true,
      commit: function (res) { st.res[i] = res; persist(); beat(q, res); countKind(q, res); if (mode === 'daily') askCrowd(day, i, res); },
      reveal: function (res) { fresh = true; play(); fresh = false; cheer(res.f); crawl(totalM(st) - mOf(res), totalM(st), DAY_MAX, res.f); } });
  }
  function next() {
    var st = game.st;
    if (!st.res[st.idx]) return;
    if (st.idx >= 2) { finish(); return; }
    st.idx++; st.qStart = Date.now();
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
        var went = totalM(st);
        game.newBest = went > (s.far || 0) && s.played > 1;
        s.far = Math.max(s.far || 0, went);
        s.metres = (s.metres || 0) + went;
      }
    }
    var first = !st.done;
    st.done = true;
    persist();
    end(first);
    if (first && rightCount(st) === 3) seq.push(setTimeout(function () { SFX.sweep(); buzz([20, 40, 20, 40, 40]); flash('#12924A'); }, 1900));
  }

  /* ---------- Score ---------- */
  function shareText() {
    var st = game.st, daily = game.mode === 'daily';
    return (daily ? NAME + ' #' + game.day : NAME + ', a private round') + '\n' +
      st.res.map(function (r) { return EMOJI[r.f]; }).join('') + '  \uD83D\uDC0C ' + totalM(st) + ' m\n' +
      (daily ? 'Beat me: ' : 'Same three questions: ') + myLink();
  }
  function friendText(q, r) {
    var pct = crowdPct(r);
    return (r && r.f === 'right' ? 'I got this one in ' + mmss(r.secs) + '. Can you?' : 'This one caught me. Can you get it?') +
      '\n\n' + q.q + '\n\n' + (pct >= 0 && pct < 50 ? 'Only ' + pct + '% of players got it today. ' : '') + 'No calculator. ' + SITE;
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
        '<div><b>' + liveStreak() + '</b><span>Streak</span></div>' +
        '<div><b>' + far(s.far || 0) + '</b><span>Best day</span></div>' +
        '<div><b>' + far(s.metres || 0) + '</b><span>In all</span></div>' +
      '</div>' +
      '<h2>Right answers per day</h2><div class="dist">' + bars + '</div>' +
      '<p class="beaten">' + beatenLine() + (s.runBest ? ' Longest road: ' + far(s.runBest) + '.' : '') + '</p>';
  }
  function end(first) {
    stopTimers(); ask = null; clearTimeout(toastTimer); toastEl.hidden = true;
    night(true);
    var st = game.st, signs = '', recap = '', n = rightCount(st), daily = game.mode === 'daily', went = totalM(st);
    for (var i = 0; i < 3; i++) {
      var r = st.res[i], q = game.set[i], pct = crowdPct(r);
      signs += '<div class="sg">' + sign(r.f, true) + '</div>';
      recap += '<li><p class="rq">' + esc(q.q) + '</p>' +
        '<p class="ra">' + sign(r.f, false) + '<b>' + esc(E.show(q, q.a)) + '</b><span class="rt">' +
          esc(r.f === 'right' ? 'in ' + mmss(r.secs) + ', ' + mOf(r) + ' m' : r.f === 'time' ? 'out of time' : 'you said ' + E.show(q, parseFloat(r.t))) + (pct >= 0 ? ', ' + pct + '% got it' : '') + '</span></p>' +
        '<button class="linkish" data-act="friend" data-i="' + i + '">Ask a friend this one</button></li>';
    }
    view.innerHTML =
      '<section class="end">' +
        '<p class="endno">' + (daily ? 'No. ' + game.day : 'Private round ' + esc(game.code) + ', number ' + game.round) + '</p>' +
        '<div class="endsigns' + (first ? ' fresh' : '') + '">' + signs + '</div>' +
        roadHtml(first ? 0 : went, DAY_MAX, false) +
        '<p class="far"><b id="tot">' + (first ? 0 : went) + '</b> m</p>' +
        '<p class="rank">' + place(went) + '</p>' +
        '<p class="total">' + n + ' of 3 right in ' + mmss(totalSecs(st)) + '.' + (daily ? (game.newBest ? ' Your best day yet.' : store.stats.far > went ? ' Your best day is ' + store.stats.far + ' m.' : '') : '') + '</p>' +
        duelCard() +
        '<div class="endbtns"><button class="btn" data-act="copy">' + (rivalHere() ? 'Send your score back' : 'Challenge a friend to beat it') + '</button>' +
          (daily ? '<button class="btn plate" data-act="run">Still bored? Take the long road</button><button class="btn plate" data-act="friends">Play with friends</button>' : '<button class="btn plate" data-act="nextround">Play another three</button><button class="btn plate" data-act="home">Back to today</button>') +
        '</div>' +
        (daily ? '<p class="nextset"><span>Next three in</span><b id="cd">' + untilMidnight() + '</b></p>' + statsBlock() : '') +
        '<h2>' + (daily ? 'Today’s three' : 'This round') + '</h2><ol class="recap">' + recap + '</ol>' +
      '</section>';
    window.scrollTo(0, 0);
    if (daily) runCountdown();
    if (first && went > 0) {   // replay the whole journey: the snail crawls the distance while the number counts up
      var road = document.getElementById('road'), tot = document.getElementById('tot');
      if (calm) { road.style.setProperty('--p', Math.min(1, went / DAY_MAX)); tot.textContent = went; return; }
      seq.push(setTimeout(function () { road.classList.add('moving'); road.style.setProperty('--p', Math.min(1, went / DAY_MAX)); SFX.crawl(); countUp(tot, 0, went, 1300, String); }, 500));
      seq.push(setTimeout(function () { road.classList.remove('moving'); replay(tot, 'pop'); }, 1850));
    }
  }

  /* ---------- The long road: keep answering until three wrong turns ---------- */
  function startRun() {
    game = { mode: 'run', n: 0, lives: RUN_LIVES, m: 0, right: 0, strikes: [], recent: [], cur: null, res: null, seed: Date.now() + '-' + Math.random() };
    night(true);
    runNext();
  }
  function runNext() {
    var n = game.n++, level = n < 5 ? [1, 1, 2, 2, 3][n] : [2, 3, 2, 3, 1, 3][(n - 5) % 6];   // ease in, then mostly the harder two
    var all = E.families.filter(function (f) { return f.level === level; });
    var pool = all.filter(function (f) { return game.recent.indexOf(f.id) < 0; });
    var f = (pool.length ? pool : all)[Math.floor(Math.random() * (pool.length ? pool : all).length)];
    game.recent.push(f.id); if (game.recent.length > 14) game.recent.shift();
    game.cur = E.make(f, game.seed + '-' + n); game.res = null; game.start = Date.now();
    runPlay();
    window.scrollTo(0, 0);
  }
  function runGoal() { return Math.max(1000, store.stats.runBest || 0); }
  function runPlay() {
    stopTimers(); ask = null;
    var q = game.cur, r = game.res, hud = '';
    for (var k = 0; k < RUN_LIVES; k++) hud += k < game.strikes.length ? sign(game.strikes[k], false) : '<i class="dot life" aria-hidden="true"></i>';
    var shown = game.m - (fresh && r ? r.m : 0);
    view.innerHTML =
      '<section class="play">' +
        '<div class="hud"><span role="img" aria-label="' + game.strikes.length + ' of ' + RUN_LIVES + ' wrong turns used" style="display:contents">' + hud + '</span><span class="hudn">Question ' + game.n + '</span><span class="clock" id="clock" aria-label="Time left">' + mmss(r ? RUN_LIMIT - r.secs : RUN_LIMIT) + '</span></div>' +
        roadHtml(shown, runGoal(), true) + plateHtml(q, !r) +
        (r ? resultHtml(q, r, 'run', game.lives > 0 ? 'Next question' : 'See how far I got') : entryHtml()) +
      '</section>';
    if (r) return;
    beginAsk({ q: q, limit: RUN_LIMIT, start: game.start, beat: true,
      commit: function (res) { game.res = res; game.m += res.m; if (res.f === 'right') game.right++; else { game.lives--; game.strikes.push(res.f); } beat(q, res); },
      reveal: function (res) { fresh = true; runPlay(); fresh = false; cheer(res.f); crawl(game.m - res.m, game.m, runGoal(), res.f); } });
  }
  function runEnd() {
    stopTimers(); ask = null;
    var s = store.stats, old = s.runBest || 0, isBest = game.m > old && game.m > 0;
    if (isBest) { s.runBest = game.m; save(); }
    game.over = true;
    view.innerHTML =
      '<section class="end">' +
        '<p class="endno">The long road</p>' +
        roadHtml(0, Math.max(1000, old, game.m), false) +
        '<p class="far"><b id="tot">0</b> m</p>' +
        '<p class="rank">' + (isBest && old ? 'Your longest road yet' : game.right === 0 ? 'Stalled at the start' : 'Three wrong turns') + '</p>' +
        '<p class="total">' + game.right + ' right out of ' + game.n + '.' + (!isBest && old ? ' Your longest road is ' + far(old) + '.' : '') + '</p>' +
        '<p class="total">' + beatenLine() + '</p>' +
        '<div class="endbtns"><button class="btn" data-act="run" data-enter>Go again</button><button class="btn plate" data-act="runshare">Share it</button><button class="btn plate" data-act="home">Back to today</button></div>' +
      '</section>';
    window.scrollTo(0, 0);
    var road = document.getElementById('road'), tot = document.getElementById('tot'), went = game.m, top = Math.max(1000, old, went);
    if (!went) return;
    if (calm) { road.style.setProperty('--p', went / top); tot.textContent = went; return; }
    seq.push(setTimeout(function () { road.classList.add('moving'); road.style.setProperty('--p', went / top); SFX.crawl(); countUp(tot, 0, went, 1300, String); }, 400));
    seq.push(setTimeout(function () { road.classList.remove('moving'); replay(tot, 'pop'); if (isBest) { SFX.sweep(); flash('#12924A'); } }, 1750));
  }

  /* ---------- One phone, passed round ---------- */
  function startParty(names, count) {
    game = { mode: 'party', players: names.map(function (nm) { return { name: nm, m: 0, right: 0, bait: 0 }; }),
      set: E.buildParty(Date.now() + '-' + Math.random(), count), k: 0, turn: 0, ans: [], scored: [] };
    night(true);
    partyPass();
  }
  function order() { var n = game.players.length, o = []; for (var i = 0; i < n; i++) o.push((game.k + i) % n); return o; }   // a different player goes first each time
  function ranked() {
    return game.players.slice().sort(function (a, b) { return b.m - a.m || b.right - a.right; });
  }
  function standings(detail) {
    return '<ol class="table">' + ranked().map(function (p) {
      return '<li><span>' + esc(p.name) + '</span>' + (detail ? '<small>' + p.right + ' right' + (p.bait ? ', trapped ' + times(p.bait) : '') + '</small>' : '') + '<b>' + p.m + ' m</b></li>';
    }).join('') + '</ol>';
  }
  function partyPass() {
    stopTimers(); ask = null;
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
  function partyAnswer() {
    stopTimers();
    var k = game.k, pi = order()[game.turn], q = game.set[k];
    view.innerHTML =
      '<section class="play">' +
        '<div class="hud"><span class="chip">' + esc(game.players[pi].name) + '</span><span class="hudn">' + (k + 1) + ' of ' + game.set.length + '</span><span class="clock" id="clock" aria-label="Time left">' + mmss(PARTY_LIMIT) + '</span></div>' +
        roadHtml(game.players[pi].m, partyMax(), true) + plateHtml(q, true) + entryHtml() +
      '</section>';
    beginAsk({ q: q, limit: PARTY_LIMIT, start: Date.now(), beat: false,
      commit: function (r) { (game.ans[k] = game.ans[k] || [])[pi] = r; },
      reveal: function () { SFX.lock(); game.turn++; if (game.turn < game.players.length) partyPass(); else partyGather(); } });
  }
  function partyGather() {
    stopTimers();
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
        p.m += r.m;
        if (r.f === 'right') p.right++;
        if (r.f === 'bait') p.bait++;
      });
    }
    var rows = ord.map(function (pi) {
      var r = a[pi];
      var said = r.f === 'time' ? 'ran out of time' : 'said ' + E.show(q, parseFloat(r.t)) + (r.f === 'right' ? ' in ' + mmss(r.secs) : r.f === 'bait' ? ', the trap' : '');
      return '<div class="prow hid" data-f="' + r.f + '"><div class="sg">' + sign(r.f, true) + '</div><p class="nm">' + esc(game.players[pi].name) + '<span class="said">' + esc(said) + '</span></p><span class="pt">' + (r.m ? '+' + r.m + ' m' : '') + '</span></div>';
    }).join('');
    view.innerHTML =
      '<section class="rev">' +
        plateHtml(q, false) +
        '<p class="answer"><span>The answer</span><b>' + esc(E.show(q, q.a)) + '</b></p>' +
        rows +
        '<div class="after hid" id="after"><p class="why">' + esc(q.why) + '</p>' + standings(false) +
          '<button class="btn" data-act="pnext" data-enter>' + (last ? 'Final scores' : 'Next question') + '</button></div>' +
      '</section>';
    window.scrollTo(0, 0);
    var els = view.querySelectorAll('.prow'), after = document.getElementById('after');
    var showRow = function (el) {
      var f = el.getAttribute('data-f');
      el.classList.remove('hid'); el.classList.add('show');
      SFX[f](); buzz(f === 'bait' ? [70, 40, 70] : 25);
      if (f === 'bait') flash('#fff');
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
    var r = ranked(), top = r.filter(function (p) { return p.m === r[0].m; });
    var most = Math.max.apply(null, r.map(function (p) { return p.bait; })), trapped = r.filter(function (p) { return p.bait === most; });
    view.innerHTML =
      '<section class="pass" style="justify-content:flex-start">' +
        '<p class="sm">After ' + game.set.length + ' questions</p>' +
        '<p class="who">' + (top.length === 1 ? esc(top[0].name) + ' wins' : 'Dead heat') + '</p>' +
        (top.length > 1 ? '<p class="sm">' + esc(listNames(top)) + ' share it on ' + r[0].m + ' m.</p>' : '') +
        standings(true) +
        (most > 0 ? '<p class="sm">Most trapped: ' + esc(listNames(trapped)) + ', caught ' + times(most) + (trapped.length > 1 ? ' each' : '') + '.</p>' : '<p class="sm">Nobody fell for a single trap.</p>') +
        '<button class="btn" data-act="pagain" data-enter>Play again</button>' +
        '<button class="btn plate" data-act="pshare">Share the result</button>' +
        '<button class="btn plate" data-act="home">Back to today</button>' +
      '</section>';
    window.scrollTo(0, 0);
    seq.push(setTimeout(function () { SFX.sweep(); buzz([20, 40, 20, 40, 40]); }, 250));
  }
  function partyShare() {
    return NAME + ', ' + game.set.length + ' questions round the table\n' +
      ranked().map(function (p, i) { return (i + 1) + '. ' + p.name + ' ' + p.m + ' m' + (p.bait ? ' (trapped ' + times(p.bait) + ')' : ''); }).join('\n') + '\n' + SITE;
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
      '<ul><li>Three questions a day, the same three for everyone.</li><li>One guess at each, with two minutes on the clock.</li><li>Every question has an obvious answer. It is usually the trap.</li><li>They go from easiest to hardest: a warm-up, a trickier one, then the hard one.</li><li>A right answer moves you down the road: 100 m, 150 m, then 200 m, plus a metre for every second left on the clock. The trap moves you nowhere.</li></ul>' +
      '<div class="eg"><p class="egq">A bat and a ball cost €1.10. The bat costs €1.00 more than the ball. How much is the ball?</p>' +
        eg('right', '5 cents', 'Correct. It takes a second look.') +
        eg('bait', '10 cents', 'The trap. It is the answer that jumps out first.') +
        eg('wrong', 'Anything else', 'Wrong, but at least you dodged the trap.') +
      '</div>' +
      '<p>A new three arrive at midnight. Your score comes with a link, so a friend can play the same three and see who won.</p>' +
      '<p>Done for the day and still bored? The long road keeps the questions coming until you take three wrong turns.</p>' +
      '<p>Sound is off until you turn it on.</p>' +
      '<p class="small">To show how other players did, the game sends an anonymous count of right and wrong answers. Nothing about you is sent or stored.</p>');
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
      '<p class="small">The questions go from easiest to hardest. A right answer is worth 100 to 200 m, plus a metre for every second you had left. Blurt out the trap and you get nothing.</p>' +
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
    stopTimers(); game = null; ask = null; night(true);
    var ks = E.kinds().sort(function (a, b) { return a.level - b.level || (a.kind < b.kind ? -1 : 1); }), rows = '', lv = 0;
    var aim = { 1: 'Openers, aiming for about 70% right', 2: 'Coin flips, aiming for about 50% right', 3: 'Closers, aiming for about 30% right' };
    ks.forEach(function (k, i) {
      if (k.level !== lv) { lv = k.level; rows += '<tr class="lv"><td colspan="4">' + aim[lv] + '</td></tr>'; }
      rows += '<tr title="' + esc(k.eg) + '"><td>' + esc(k.kind) + '</td><td id="n' + i + '">…</td><td id="r' + i + '"></td><td id="t' + i + '"></td></tr>';
    });
    view.innerHTML = '<section class="numbers"><p class="rank">The numbers</p><p class="total" id="nstate">Reading the live counts. This takes about a minute.</p>' +
      '<table><thead><tr><th>Kind</th><th>Answered</th><th>Right</th><th>Trapped</th></tr></thead><tbody>' + rows + '</tbody></table></section>';
    if (!STATS || !window.fetch) return;
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
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t) { if (e.target === veil) closeSheet(); return; }
    var act = t.getAttribute('data-act');
    if (act === 'key') key(t.getAttribute('data-k'));
    else if (act === 'enter') lock(false);
    else if (act === 'next') { if (game.mode === 'run') { if (game.lives > 0) runNext(); else runEnd(); } else next(); }
    else if (act === 'run') { closeSheet(); startRun(); }
    else if (act === 'runshare') send(NAME + ', the long road\n\uD83D\uDC0C ' + game.m + ' m before three wrong turns\n' + SITE, 'Copied. Paste it anywhere.');
    else if (act === 'daily') startDaily();
    else if (act === 'friends') friendsSheet();
    else if (act === 'party') partySheet();
    else if (act === 'table') tableSheet();
    else if (act === 'help') help();
    else if (act === 'stats') stats();
    else if (act === 'close') closeSheet();
    else if (act === 'copy') send(shareText(), 'Copied. Paste it to a friend.');
    else if (act === 'friend') { var fi = t.getAttribute('data-i'); send(fi === 'run' ? friendText(game.cur, game.res) : friendText(game.set[+fi], game.st.res[+fi]), 'Question copied. Paste it to a friend.'); }
    else if (act === 'sound') { store.sound = !store.sound; save(); paintSound(); if (store.sound) SFX.key(); }
    else if (act === 'home') { closeSheet(); home(); }
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
    else if (act === 'pshare') send(partyShare(), 'Result copied. Paste it anywhere.');
  });
  document.addEventListener('keydown', function (e) {
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
  });

  /* ---------- Boot ---------- */
  function start(snap) {
    if (!hadLocal && snap && snap.store && snap.store.stats && snap.store.stats.dist) { store = snap.store; if (typeof store.sound !== 'boolean') store.sound = false; }
    paintSound();
    if (readLink() === 'numbers') numbers(); else home();
  }
  var hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(function () { return { store: store }; });
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
