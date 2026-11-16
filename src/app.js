/* Screens, guesses, sharing. All state lives in this browser. */
(function () {
  'use strict';
  var E = window.BaitEngine;
  var NAME = 'Not So Fast';            // working title: change it here and it changes everywhere
  var SHARE_URL = 'https://playnotsofast.com';
  var TRIES = 3;
  var KEY = 'daily.v2';
  var SQUARE = { right: '🟩', bait: '🟨', low: '⬛', high: '⬛' };

  var view = document.getElementById('view');
  var veil = document.getElementById('veil');
  var toastEl = document.getElementById('toast');
  document.getElementById('brand').textContent = NAME;
  document.title = NAME;

  var hadLocal = false;
  var store = load();
  var game = null, typed = '', countdown = null, toastTimer = null, fresh = -1;
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
  function untilMidnight() {
    var n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
    var s = Math.max(0, Math.floor((m - n) / 1000));
    var h = Math.floor(s / 3600), mi = Math.floor((s % 3600) / 60), se = s % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi + ':' + (se < 10 ? '0' : '') + se;
  }
  function stopCountdown() { if (countdown) { clearInterval(countdown); countdown = null; } }
  function runCountdown() {
    var day = today();
    countdown = setInterval(function () {
      var el = document.getElementById('cd');
      if (!el) { stopCountdown(); return; }
      if (today() !== day) { stopCountdown(); home(); return; }
      el.textContent = untilMidnight();
    }, 1000);
  }
  function toast(msg) {
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 1500);
  }

  function solved(row) { return row.length > 0 && row[row.length - 1].f === 'right'; }
  function over(row) { return solved(row) || row.length >= TRIES; }
  function allOver(st) { return st.rows.every(over); }
  function solvedCount(st) { return st.rows.filter(solved).length; }
  function dailyState() {
    var d = store.daily;
    if (!d || d.day !== today()) return 'new';
    return d.done ? 'done' : 'going';
  }

  /* ---------- Splash ---------- */
  function home() {
    stopCountdown(); game = null;
    var state = dailyState();
    var label = state === 'done' ? 'See results' : state === 'going' ? 'Continue' : 'Play';
    view.innerHTML =
      '<section class="splash">' +
        '<div class="logo" aria-hidden="true"><i class="a"></i><i class="x"></i><i class="ok"></i></div>' +
        '<h1>' + esc(NAME) + '</h1>' +
        '<p class="tag">Three questions a day. Three guesses each. Your first answer is usually wrong.</p>' +
        '<button class="pill dark" data-act="daily">' + label + '</button>' +
        '<button class="pill line" data-act="table">Play with friends</button>' +
        '<p class="date"><b>' + esc(dateLine()) + '</b><span>No. ' + today() + '</span></p>' +
      '</section>';
  }

  /* ---------- Starting ---------- */
  function startDaily() {
    var d = today();
    if (!store.daily || store.daily.day !== d) { store.daily = { day: d, idx: 0, rows: [[], [], []], done: false }; save(); }
    game = { mode: 'daily', day: d, set: E.buildDaily(d), st: store.daily };
    typed = ''; fresh = -1;
    if (game.st.done) end(); else play();
  }
  function startTable(code, round) {
    game = { mode: 'table', code: code, round: round, set: E.buildTable(code, round), st: { idx: 0, rows: [[], [], []], done: false } };
    typed = ''; fresh = -1;
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
    if (f === 'low') return '<div class="mark" aria-label="Too low, go higher">▲</div>';
    return '<div class="mark" aria-label="Too high, go lower">▼</div>';
  }
  function play() {
    stopCountdown();
    var st = game.st, q = game.set[st.idx], row = st.rows[st.idx], done = over(row);
    var steps = '';
    for (var i = 0; i < 3; i++) {
      var r = st.rows[i];
      steps += '<i class="' + (over(r) ? (solved(r) ? 'ok' : 'no') : i === st.idx ? 'now' : '') + '"></i>';
    }
    var board = '';
    for (var g = 0; g < TRIES; g++) {
      if (g < row.length) {
        board += '<div class="row set f-' + row[g].f + (g === fresh ? ' reveal' : '') + '"><div class="tile">' + parts(q, row[g].t) + '</div>' + markFor(row[g].f) + '</div>';
      } else if (g === row.length && !done) {
        board += '<div class="row cur" id="cur"><div class="tile" id="tile"></div><div class="mark"></div></div>';
      } else {
        board += '<div class="row"><div class="tile"></div><div class="mark"></div></div>';
      }
    }
    var foot;
    if (done) {
      foot = '<div class="after"><p class="ans">Answer<b>' + esc(E.show(q, q.a)) + '</b></p><p class="why">' + esc(q.why) + '</p>' +
        '<button class="pill dark wide" data-act="next">' + (st.idx < 2 ? 'Next question' : 'See results') + '</button></div>';
    } else {
      foot = '<div class="keys">' +
        '<div>' + [1, 2, 3, 4, 5].map(keyBtn).join('') + '</div>' +
        '<div>' + [6, 7, 8, 9, 0].map(keyBtn).join('') + '</div>' +
        '<div><button class="w" data-act="enter">Enter</button><button data-act="key" data-k="." aria-label="Decimal point">.</button><button class="w" data-act="key" data-k="del" aria-label="Delete">⌫</button></div>' +
      '</div>';
    }
    view.innerHTML =
      '<section class="play">' +
        '<div class="steps" aria-hidden="true">' + steps + '</div>' +
        '<p class="count">Question ' + (st.idx + 1) + ' of 3</p>' +
        '<p class="q' + (q.q.length > 150 ? ' long' : '') + '">' + esc(q.q) + '</p>' +
        '<div class="board">' + board + '</div>' +
        '<div class="foot">' + foot + '</div>' +
      '</section>';
    fresh = -1;
    if (!done) paintTyped(false);
  }
  function keyBtn(k) { return '<button data-act="key" data-k="' + k + '">' + k + '</button>'; }
  function paintTyped(pop) {
    var tile = document.getElementById('tile'), cur = document.getElementById('cur');
    if (!tile) return;
    var q = game.set[game.st.idx];
    tile.innerHTML = typed === '' ? '' : parts(q, typed);
    cur.className = 'row cur' + (typed === '' ? '' : ' has');
    if (pop) { tile.classList.remove('pop'); void tile.offsetWidth; tile.classList.add('pop'); }
  }
  function key(k) {
    if (!game || over(game.st.rows[game.st.idx])) return;
    if (k === 'del') typed = typed.slice(0, -1);
    else if (k === '.') { if (typed.indexOf('.') < 0 && typed.length < 6) typed += typed === '' ? '0.' : '.'; }
    else if (typed.length < 7) typed = typed === '0' ? String(k) : typed + k;
    paintTyped(k !== 'del');
  }
  function enter() {
    if (!game) return;
    var st = game.st, row = st.rows[st.idx], q = game.set[st.idx];
    if (over(row)) return;
    var f = E.judge(q, typed);
    if (f === 'bad') {
      var cur = document.getElementById('cur');
      if (cur) { cur.classList.remove('shake'); void cur.offsetWidth; cur.classList.add('shake'); }
      toast('Type a number first');
      return;
    }
    if (row.some(function (g) { return parseFloat(g.t) === parseFloat(typed); })) { toast('You already tried that'); return; }
    row.push({ t: String(parseFloat(typed)), f: f });
    typed = ''; fresh = row.length - 1;
    persist();
    if (f === 'right') toast(['First go', 'Second time lucky', 'Just in time'][row.length - 1]);
    else if (row.length >= TRIES) toast('Out of guesses');
    else toast(f === 'bait' ? 'That is the trap' : f === 'low' ? 'Higher' : 'Lower');
    play();
  }
  function next() {
    var st = game.st;
    if (!over(st.rows[st.idx])) return;
    if (st.idx >= 2) { finish(); return; }
    st.idx++; typed = '';
    persist();
    play();
    window.scrollTo(0, 0);
  }
  function finish() {
    var st = game.st;
    if (game.mode === 'daily' && !st.done) {
      var s = store.stats;
      if (s.lastDay !== game.day) {
        s.played++;
        if (solvedCount(st) === 3) s.perfect++;
        s.streak = s.lastDay === game.day - 1 ? s.streak + 1 : 1;
        s.best = Math.max(s.best, s.streak);
        s.lastDay = game.day;
        st.rows.forEach(function (r) { s.dist[solved(r) ? r.length - 1 : 3]++; });
      }
    }
    st.done = true;
    persist();
    end();
  }

  /* ---------- Results ---------- */
  function shareText() {
    var st = game.st;
    var head = game.mode === 'daily' ? NAME + ' #' + game.day : NAME + ' · ' + game.code + ' round ' + game.round;
    var grid = st.rows.map(function (r) { return r.map(function (g) { return SQUARE[g.f]; }).join(''); }).join('\n');
    return head + ' ' + solvedCount(st) + '/3\n' + grid + (SHARE_URL ? '\n' + SHARE_URL : '');
  }
  function statsBlock() {
    var s = store.stats, live = s.lastDay >= today() - 1 ? s.streak : 0;
    var max = Math.max.apply(null, s.dist.concat(1)), labels = ['1', '2', '3', '✕'], bars = '';
    var last = game && game.mode === 'daily' && game.st.done ? game.st.rows.map(function (r) { return solved(r) ? r.length - 1 : -1; }) : [];
    for (var i = 0; i < 4; i++) {
      bars += '<div><span>' + labels[i] + '</span><i class="' + (last.indexOf(i) >= 0 ? 'hi' : '') + '" style="width:' + Math.max(9, s.dist[i] / max * 100) + '%">' + s.dist[i] + '</i></div>';
    }
    return '<h2>Statistics</h2>' +
      '<div class="nums">' +
        '<div><b>' + s.played + '</b><span>Played</span></div>' +
        '<div><b>' + (s.played ? Math.round(s.perfect / s.played * 100) : 0) + '</b><span>Perfect %</span></div>' +
        '<div><b>' + live + '</b><span>Streak</span></div>' +
        '<div><b>' + s.best + '</b><span>Max streak</span></div>' +
      '</div>' +
      '<h2>Solved on guess</h2><div class="dist">' + bars + '</div>';
  }
  function end() {
    stopCountdown(); clearTimeout(toastTimer); toastEl.hidden = true;
    var st = game.st, grid = '', recap = '';
    for (var i = 0; i < 3; i++) {
      var r = st.rows[i], q = game.set[i];
      var sq = r.map(function (g) { return '<i class="' + g.f + '"></i>'; }).join('');
      grid += '<div>' + sq + '</div>';
      recap += '<li><p>' + esc(q.q) + '</p><p class="ra">' + esc(E.show(q, q.a)) + '<span class="mini" aria-hidden="true">' + sq + '</span></p></li>';
    }
    var daily = game.mode === 'daily';
    view.innerHTML =
      '<section class="end">' +
        '<h2>' + (daily ? 'No. ' + game.day : 'Table ' + esc(game.code) + ' · Round ' + game.round) + '</h2>' +
        '<p class="score">' + solvedCount(st) + ' of 3</p>' +
        '<div class="grid" role="img" aria-label="Your guesses">' + grid + '</div>' +
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
      '<p>Answer three questions in three guesses each.</p>' +
      '<ul><li>Every question has an obvious answer. It is usually wrong.</li><li>There is no clock. Take your time.</li><li>After each guess, the row shows how you did.</li></ul>' +
      '<div class="eg"><p><b>A bat and a ball cost €1.10. The bat costs €1.00 more than the ball. How much is the ball?</b></p>' +
        eg('bait', '10', '<b>Trap.</b> That is the answer most people give.') +
        eg('low', '4', '<b>Wrong.</b> The arrow says the answer is higher.') +
        eg('right', '5', '<b>Right.</b>') +
      '</div>' +
      '<p>A new set arrives every day at midnight, and it is the same for everyone.</p>');
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
    else if (act === 'enter') enter();
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
    if (over(game.st.rows[game.st.idx])) { if (e.key === 'Enter') { next(); e.preventDefault(); } return; }
    if (/^[0-9]$/.test(e.key)) key(e.key);
    else if (e.key === '.' || e.key === ',') key('.');
    else if (e.key === 'Backspace') { key('del'); e.preventDefault(); }
    else if (e.key === 'Enter') { enter(); e.preventDefault(); }
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
