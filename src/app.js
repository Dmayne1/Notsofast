/* Screens, the clock, sharing and the daily crowd numbers. Game state lives in this browser. */
(function () {
  'use strict';
  var E = window.BaitEngine;
  var NAME = 'Not So Fast';            // change it here and it changes everywhere
  var SHARE_URL = 'https://playnotsofast.com';
  var LIMIT = 120;                     // seconds per question
  var KEY = 'daily.v3';

  // Crowd numbers: anonymous counters on a free public counting service.
  // Set STATS to '' to switch them off. Nothing about the player is sent.
  var STATS = 'https://abacus.jasoncameron.dev';
  var STATS_NS = 'playnotsofast.com';
  var BUCKETS = [10, 20, 40, 70, 121]; // upper edge, in seconds, of each solve-time band
  var MIN_CROWD = 10;                  // do not show a percentage until this many have answered

  var SQUARE = { right: '🟩', bait: '🟨', wrong: '⬛', time: '⬛' };

  var view = document.getElementById('view');
  var veil = document.getElementById('veil');
  var toastEl = document.getElementById('toast');
  var fx = document.getElementById('fx');
  document.getElementById('brand').textContent = NAME;
  document.title = NAME;

  var hadLocal = false;
  var store = load();
  var game = null, typed = '', ticker = null, countdown = null, toastTimer = null, fresh = false;
  var table = { code: '', round: 1 };

  function blank() { return { stats: { played: 0, perfect: 0, streak: 0, best: 0, lastDay: 0, dist: [0, 0, 0, 0] }, daily: null }; }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.stats && s.stats.dist) { hadLocal = true; return s; }
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
  function stopTimers() { if (ticker) { clearInterval(ticker); ticker = null; } if (countdown) { clearInterval(countdown); countdown = null; } }
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
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 1400);
  }
  function rightCount(st) { return st.res.filter(function (r) { return r && r.f === 'right'; }).length; }
  function totalSecs(st) { var t = 0; st.res.forEach(function (r) { if (r) t += r.secs; }); return t; }
  function dailyState() {
    var d = store.daily;
    if (!d || d.day !== today()) return 'new';
    return d.done ? 'done' : 'going';
  }

  /* ---------- A small burst of squares for a right answer ---------- */
  function burst(x, y, n) {
    if (!fx || !fx.getContext) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var ctx = fx.getContext('2d'), dpr = window.devicePixelRatio || 1, w = window.innerWidth, h = window.innerHeight;
    fx.width = w * dpr; fx.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var css = getComputedStyle(document.documentElement);
    var cols = [css.getPropertyValue('--green').trim(), css.getPropertyValue('--amber').trim(), css.getPropertyValue('--edge').trim()];
    var ps = [];
    for (var i = 0; i < n; i++) ps.push({ x: x, y: y, vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 10 - 3, s: 5 + Math.random() * 6, c: cols[i % 3] });
    var t0 = performance.now();
    (function frame(t) {
      var k = (t - t0) / 1100;
      ctx.clearRect(0, 0, w, h);
      if (k >= 1) return;
      ctx.globalAlpha = 1 - k * k;
      for (var j = 0; j < ps.length; j++) { var p = ps[j]; p.vy += 0.42; p.x += p.vx; p.y += p.vy; ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s); }
      requestAnimationFrame(frame);
    })(t0);
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
    var base = 'd' + day + 'q' + (i + 1);
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
  function crowdLine(r) {
    var c = r.crowd;
    if (!c || !c.n) return '';
    if (c.n === 1) return 'You are the first to answer this one today.';
    if (c.n < MIN_CROWD) return 'You are one of the first ' + c.n + ' to answer this one today.';
    var s = Math.round(c.r / c.n * 100) + '% of ' + E.num(c.n) + ' players got this right.';
    if (r.f === 'right' && c.r >= MIN_CROWD) s = s.slice(0, -1) + ', and you were faster than ' + Math.min(99, Math.round(c.slower / (c.r - 1) * 100)) + '% of those.';
    return s;
  }

  /* ---------- Splash ---------- */
  function home() {
    stopTimers(); game = null;
    var state = dailyState();
    var label = state === 'done' ? 'See results' : state === 'going' ? 'Continue' : 'Play';
    view.innerHTML =
      '<section class="splash">' +
        '<div class="logo" aria-hidden="true"><i class="a"></i><i class="x"></i><i class="ok"></i></div>' +
        '<h1>' + esc(NAME) + '</h1>' +
        '<p class="tag">Three questions a day. One guess each. Your first answer is usually wrong.</p>' +
        '<button class="pill dark" data-act="daily">' + label + '</button>' +
        '<button class="pill line" data-act="table">Play with friends</button>' +
        '<p class="date"><b>' + esc(dateLine()) + '</b><span>No. ' + today() + '</span></p>' +
      '</section>';
  }

  /* ---------- Starting ---------- */
  function startDaily() {
    var d = today();
    if (!store.daily || store.daily.day !== d) { store.daily = { day: d, idx: 0, res: [], qStart: Date.now(), done: false }; save(); }
    game = { mode: 'daily', day: d, set: E.buildDaily(d), st: store.daily };
    typed = ''; fresh = false;
    if (game.st.done) end(); else play();
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
    return (q.pre ? '<span class="u">' + esc(q.pre.trim()) + '</span>' : '') + '<b>' + esc(text) + '</b>' + (suf ? '<span class="u">' + esc(suf) + '</span>' : '');
  }
  function markFor(f) {
    if (f === 'right') return '<div class="mark" aria-label="Right">✓</div>';
    if (f === 'bait') return '<div class="mark word" aria-label="The trap answer">Trap</div>';
    return '<div class="mark" aria-label="Wrong">✕</div>';
  }
  function keyBtn(k) { return '<button data-act="key" data-k="' + k + '">' + k + '</button>'; }
  function play() {
    stopTimers();
    var st = game.st, q = game.set[st.idx], r = st.res[st.idx];
    var steps = '';
    for (var i = 0; i < 3; i++) {
      var p = st.res[i];
      steps += '<i class="' + (p ? (p.f === 'right' ? 'ok' : p.f === 'bait' ? 'trap' : 'no') : i === st.idx ? 'now' : '') + '"></i>';
    }
    var row, foot;
    if (r) {
      row = '<div class="row set f-' + r.f + (fresh ? ' reveal' : '') + '" id="done"><div class="tile">' + (r.f === 'time' ? '<b>–</b>' : parts(q, r.t)) + '</div>' + markFor(r.f) + '</div>';
      var head = r.f === 'right'
        ? '<p class="verdict ok">Correct<span>in ' + mmss(r.secs) + '</span></p>'
        : '<p class="note">' + (r.f === 'bait' ? 'That is the trap answer.' : r.f === 'time' ? 'Out of time.' : 'Not this time.') + '</p><p class="ans">Answer<b>' + esc(E.show(q, q.a)) + '</b></p>';
      foot = '<div class="after">' + head +
        '<p class="crowd" id="crowd">' + esc(crowdLine(r)) + '</p>' +
        '<p class="why">' + esc(q.why) + '</p>' +
        '<button class="pill dark wide" data-act="next">' + (st.idx < 2 ? 'Next question' : 'See results') + '</button></div>';
    } else {
      row = '<div class="row cur" id="cur"><div class="tile" id="tile"></div><div class="mark"></div></div>';
      foot = '<div class="keys">' +
        '<div>' + [1, 2, 3, 4, 5].map(keyBtn).join('') + '</div>' +
        '<div>' + [6, 7, 8, 9, 0].map(keyBtn).join('') + '</div>' +
        '<div><button class="w" data-act="enter">Enter</button><button data-act="key" data-k="." aria-label="Decimal point">.</button><button class="w" data-act="key" data-k="del" aria-label="Delete">⌫</button></div>' +
      '</div>';
    }
    view.innerHTML =
      '<section class="play">' +
        '<div class="steps" aria-hidden="true">' + steps + '</div>' +
        '<div class="bar"><span class="count">Question ' + (st.idx + 1) + ' of 3</span><span class="clock' + (r ? ' stop' : '') + '" id="clock" aria-label="Time left">' + mmss(r ? LIMIT - r.secs : LIMIT) + '</span></div>' +
        '<div class="drain"><i id="drain" style="width:' + (r ? Math.max(0, (LIMIT - r.secs) / LIMIT * 100) : 100) + '%"></i></div>' +
        '<p class="q' + (q.q.length > 150 ? ' long' : '') + '">' + esc(q.q) + '</p>' +
        '<div class="board">' + row + '</div>' +
        '<div class="foot' + (r ? ' done' : '') + '">' + foot + '</div>' +
      '</section>';
    if (r) {
      if (fresh && r.f === 'right') {
        var box = document.getElementById('done').getBoundingClientRect();
        setTimeout(function () { burst(box.left + box.width / 2, box.top + box.height / 2, 34); }, 380);
      }
    } else {
      paintTyped(false);
      ticker = setInterval(tick, 200);
      tick();
    }
    fresh = false;
  }
  function tick() {
    if (!game) return;
    var st = game.st, left = LIMIT - (Date.now() - st.qStart) / 1000;
    if (left <= 0) { lock(true); return; }
    var c = document.getElementById('clock'), d = document.getElementById('drain');
    if (!c) return;
    c.textContent = mmss(Math.ceil(left));
    c.className = 'clock' + (left <= 15 ? ' low' : '');
    d.style.width = (left / LIMIT * 100) + '%';
    d.className = left <= 15 ? 'low' : '';
  }
  function paintTyped(pop) {
    var tile = document.getElementById('tile'), cur = document.getElementById('cur');
    if (!tile) return;
    tile.innerHTML = typed === '' ? '' : parts(game.set[game.st.idx], typed);
    cur.className = 'row cur' + (typed === '' ? '' : ' has');
    if (pop) { tile.classList.remove('pop'); void tile.offsetWidth; tile.classList.add('pop'); }
  }
  function key(k) {
    if (!game || game.st.done || game.st.res[game.st.idx]) return;
    if (k === 'del') typed = typed.slice(0, -1);
    else if (k === '.') { if (typed.indexOf('.') < 0 && typed.length < 6) typed += typed === '' ? '0.' : '.'; }
    else if (typed.length < 7) typed = typed === '0' ? String(k) : typed + k;
    paintTyped(k !== 'del');
  }
  function lock(timeout) {
    if (!game) return;
    var st = game.st, q = game.set[st.idx];
    if (st.res[st.idx]) return;
    var f = timeout ? 'time' : E.judge(q, typed);
    if (f === 'bad') {
      var cur = document.getElementById('cur');
      if (cur) { cur.classList.remove('shake'); void cur.offsetWidth; cur.classList.add('shake'); }
      toast('Type a number first');
      return;
    }
    if (f === 'low' || f === 'high') f = 'wrong';
    var used = Math.min(LIMIT, Math.max(0, (Date.now() - st.qStart) / 1000));
    var r = { t: timeout ? '' : String(parseFloat(typed)), f: f, secs: Math.round(used) };
    st.res[st.idx] = r;
    typed = ''; fresh = true;
    persist();
    if (f === 'right') toast(r.secs < 15 ? 'Lightning' : r.secs < 45 ? 'Sharp' : 'Got it');
    else toast(f === 'bait' ? 'That is the trap' : f === 'time' ? 'Out of time' : 'Not this time');
    if (game.mode === 'daily') askCrowd(game.day, st.idx, r);
    play();
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
    end();
    if (first && rightCount(st) === 3) setTimeout(function () { burst(window.innerWidth / 2, 190, 70); }, 250);
  }

  /* ---------- Results ---------- */
  function shareText() {
    var st = game.st;
    var head = game.mode === 'daily' ? NAME + ' #' + game.day : NAME + ' · ' + game.code + ' round ' + game.round;
    var grid = st.res.map(function (r) { return SQUARE[r.f]; }).join('');
    return head + ' ' + rightCount(st) + '/3\n' + grid + ' ' + mmss(totalSecs(st)) + (SHARE_URL ? '\n' + SHARE_URL : '');
  }
  function statsBlock() {
    var s = store.stats, live = s.lastDay >= today() - 1 ? s.streak : 0;
    var max = Math.max.apply(null, s.dist.concat(1)), bars = '';
    var mine = game && game.mode === 'daily' && game.st.done ? rightCount(game.st) : -1;
    for (var i = 3; i >= 0; i--) {
      bars += '<div><span>' + i + '</span><i class="' + (i === mine ? 'hi' : '') + '" style="width:' + Math.max(9, s.dist[i] / max * 100) + '%">' + s.dist[i] + '</i></div>';
    }
    return '<h2>Statistics</h2>' +
      '<div class="nums">' +
        '<div><b>' + s.played + '</b><span>Played</span></div>' +
        '<div><b>' + (s.played ? Math.round(s.perfect / s.played * 100) : 0) + '</b><span>Perfect %</span></div>' +
        '<div><b>' + live + '</b><span>Streak</span></div>' +
        '<div><b>' + s.best + '</b><span>Max streak</span></div>' +
      '</div>' +
      '<h2>Right answers per day</h2><div class="dist">' + bars + '</div>';
  }
  function end() {
    stopTimers(); clearTimeout(toastTimer); toastEl.hidden = true;
    var st = game.st, grid = '', recap = '';
    for (var i = 0; i < 3; i++) {
      var r = st.res[i], q = game.set[i];
      grid += '<i class="' + r.f + '"></i>';
      var c = r.crowd && r.crowd.n >= MIN_CROWD ? ' · ' + Math.round(r.crowd.r / r.crowd.n * 100) + '% got it' : '';
      recap += '<li><p>' + esc(q.q) + '</p><p class="ra"><span class="mini" aria-hidden="true"><i class="' + r.f + '"></i></span>' + esc(E.show(q, q.a)) +
        '<span class="rt">' + (r.f === 'right' ? mmss(r.secs) : r.f === 'time' ? 'out of time' : 'you said ' + esc(E.show(q, parseFloat(r.t)))) + esc(c) + '</span></p></li>';
    }
    var daily = game.mode === 'daily';
    view.innerHTML =
      '<section class="end">' +
        '<h2>' + (daily ? 'No. ' + game.day : 'Table ' + esc(game.code) + ' · Round ' + game.round) + '</h2>' +
        '<p class="score">' + rightCount(st) + ' of 3</p>' +
        '<div class="grid" role="img" aria-label="Your three answers">' + grid + '</div>' +
        '<p class="total">' + mmss(totalSecs(st)) + ' on the clock</p>' +
        (daily ? statsBlock() : '') +
        '<div class="endrow">' +
          (daily ? '<div><span>Next set</span><b id="cd">' + untilMidnight() + '</b></div>' : '<div><span>Round</span><b>' + game.round + '</b></div>') +
          '<button class="pill green" data-act="copy" id="copy">Share</button>' +
        '</div>' +
        '<pre class="sharetext" id="sharetext" hidden>' + esc(shareText()) + '</pre>' +
        '<div class="endbtns">' +
          (daily ? '<button class="pill line wide" data-act="table">Play with friends</button>' : '<button class="pill dark wide" data-act="nextround">Next round</button><button class="pill line wide" data-act="home">Back to today</button>') +
        '</div>' +
        '<ol class="recap">' + recap + '</ol>' +
      '</section>';
    window.scrollTo(0, 0);
    if (daily) runCountdown();
  }
  function copy() {
    var text = shareText();
    var fail = function () { var p = document.getElementById('sharetext'); if (p) p.hidden = false; toast('Press and hold the text to copy'); };
    try { navigator.clipboard.writeText(text).then(function () { toast('Copied results to clipboard'); }, fail); } catch (e) { fail(); }
  }

  /* ---------- Sheets ---------- */
  function sheet(label, body) {
    veil.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(label) + '"><div class="sheet-top"><button class="ico" data-act="close" aria-label="Close">✕</button></div>' + body + '</div>';
    veil.hidden = false;
  }
  function closeSheet() { veil.hidden = true; veil.innerHTML = ''; }
  function eg(f, val, note) {
    return '<div class="row set f-' + f + '"><div class="tile"><b>' + val + '</b><span class="u">cents</span></div>' + markFor(f) + '</div><p>' + note + '</p>';
  }
  function help() {
    sheet('How to play',
      '<h2 class="big">How to play</h2>' +
      '<p>Answer three questions. You get one guess at each.</p>' +
      '<ul><li>Every question has an obvious answer. It is usually wrong.</li><li>You have two minutes per question.</li><li>Lock in your answer and you see straight away how you did.</li></ul>' +
      '<div class="eg"><p><b>A bat and a ball cost €1.10. The bat costs €1.00 more than the ball. How much is the ball?</b></p>' +
        eg('right', '5', '<b>Right.</b>') +
        eg('bait', '10', '<b>The trap.</b> It is the answer most people give.') +
        eg('wrong', '4', '<b>Wrong.</b>') +
      '</div>' +
      '<p>A new set arrives every day at midnight, and it is the same for everyone.</p>' +
      '<p class="small">To show how other players did, the game sends an anonymous count of right and wrong answers. Nothing about you is sent or stored.</p>');
  }
  function stats() { sheet('Statistics', '<div style="text-align:center">' + statsBlock() + '</div>'); }
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
      '<div class="field"><label for="code">Code</label><input id="code" maxlength="8" autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + esc(table.code) + '"><button class="linkish" data-act="rand">Random code</button></div>' +
      '<div class="field"><span class="lab">Round</span><div class="stepper"><button data-act="round-" aria-label="Previous round">−</button><output id="round">' + table.round + '</output><button data-act="round+" aria-label="Next round">+</button></div></div>' +
      '<button class="pill dark wide" data-act="deal">Start</button>');
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
    else if (act === 'copy') copy();
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
    if (game.st.res[game.st.idx]) { if (e.key === 'Enter') { next(); e.preventDefault(); } return; }
    if (/^[0-9]$/.test(e.key)) key(e.key);
    else if (e.key === '.' || e.key === ',') key('.');
    else if (e.key === 'Backspace') { key('del'); e.preventDefault(); }
    else if (e.key === 'Enter') { lock(false); e.preventDefault(); }
  });

  /* ---------- Boot ---------- */
  function start(snap) {
    if (!hadLocal && snap && snap.store && snap.store.stats && snap.store.stats.dist) store = snap.store;
    home();
  }
  var hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(function () { return { store: store }; });
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
