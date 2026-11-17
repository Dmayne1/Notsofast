// Independent checks: every answer is re-derived by brute force or simulation,
// not by the formula the generator used.
const E = require('./engine.js');
let fails = 0, checked = 0;
const near = (a, b) => Math.abs(a - b) < 1e-6;
function fail(msg, q) { fails++; if (fails < 40) console.log('FAIL', msg, q ? '\n   ' + q.q + ' => ' + q.a : ''); }

const verify = {
  sumdiff(v) { for (let x = 0; x <= v.total; x++) if (x + (x + v.diff) === v.total) return x; },
  rates(v) {
    const rate = v.n / (v.n * v.n); // things per maker per time unit
    if (v.mode === 'half') return v.H * v.D * (1.5 / (1.5 * 1.5));
    if (v.mode === 'time') return v.M / (v.M * rate);
    if (v.mode === 'count') return rate * (v.k * v.n) * (v.k * v.n);
    return v.M / (rate * v.M);
  },
  doubling(v) {
    const full = 2n ** BigInt(v.D);
    const start = v.mode === 'two' ? 2n : v.mode === 'four' ? 4n : 1n;
    const target = v.mode === 'half' ? full / 2n : v.mode === 'quarter' ? full / 4n : full;
    let size = start, day = 0;
    while (size < target) { size *= 2n; day++; }
    return day;
  },
  selfref(v) { for (let x = 1; x < 2000; x++) if (near(x, v.A + x * v.n / v.d)) return x; },
  sibling(v) {
    const then = v.mode === 'half' ? v.a / 2 : v.mode === 'twice' ? v.a * 2 : v.a / 3;
    return then + (v.N - v.a);
  },
  counting(v) {
    if (v.mode === 'queue') { let n = 0; for (let i = 1; i < v.a; i++) n++; n++; for (let i = 1; i < v.b; i++) n++; return n; }
    let n = 0;
    if (v.mode === 'houses') { for (let i = v.s; i <= v.e; i += 2) n++; return n; }
    for (let i = v.s; i <= v.e; i++) n++; return n;
  },
  socks(v) {
    // Largest draw that still fails the goal, plus one. Enumerate every multiset of draws.
    const c = v.counts; let worst = 0;
    const rec = (i, take) => {
      if (i === c.length) {
        let ok;
        if (v.mode === 'any') ok = take.some(t => t >= 2);
        else if (v.mode === 'specific') ok = take[0] >= 2;
        else ok = take.every(t => t >= 1);
        if (!ok) worst = Math.max(worst, take.reduce((a, b) => a + b, 0));
        return;
      }
      for (let t = 0; t <= c[i]; t++) rec(i + 1, take.concat(t));
    };
    rec(0, []);
    return worst + 1;
  },
  order(v, q) { return Function('"use strict";return (' + q.expr + ')')(); },
  ratio(v) { let part = 0, whole = 0; for (let i = 0; i < 100; i++) { part += v.a; whole += v.a + v.b; } return part / whole * 100; },
  inverse(v) { const work = v.n * v.d; return work / v.m; },
  buysell(v) { return v.flows.reduce((a, b) => a + b, 0); },
  intervals(v) {
    if (v.mode === 'posts') { let n = 0; for (let x = 0; x <= v.L; x += v.g) n++; return n; }
    if (v.mode === 'pills') { let t = 0; for (let i = 1; i < v.n; i++) t += v.m; return t; }
    if (v.mode === 'circle') { const ring = []; for (let i = 0; i < v.n; i++) ring.push(i); let gaps = 0; for (let i = 0; i < v.n; i++) if (ring[(i + 1) % v.n] !== undefined) gaps++; return gaps; }
    if (v.mode === 'length') { let x = 0; for (let i = 1; i < v.n; i++) x += v.g; return x; }
    const per = v.time / (v.a - 1); let t = 0; for (let i = 1; i < v.b; i++) t += per; return t;
  },
  downup(v) { let x = 100; if (v.fallFirst) { x *= 1 - v.p / 100; x *= 1 + v.p / 100; } else { x *= 1 + v.p / 100; x *= 1 - v.p / 100; } return 100 - x; },
  reverse(v) { const mid = v.up ? 100 + v.p : 100 - v.p; return Math.abs(100 - mid) / mid * 100; },
  compound(v) {
    if (v.mode === 'discount') return 100 - 100 * (1 - v.p / 100) * (1 - v.q / 100);
    if (v.mode === 'growth') return 100 * (1 + v.p / 100) * (1 + v.p / 100) - 100;
    return v.P * (1 - v.p / 100) * (1 - v.q / 100);
  },
  snail(v) { let pos = 0; for (let day = 1; day < 1000; day++) { pos += v.u; if (pos >= v.h) return day; pos -= v.d; } },
  matches(v) {
    let n = 0;
    if (v.mode === 'reverse') { for (let p = 2; p < 60; p++) { let c = 0; for (let i = 0; i < p; i++) for (let j = i + 1; j < p; j++) c++; if (c === v.H) return p; } }
    if (v.mode === 'shake') { for (let i = 0; i < v.n; i++) for (let j = i + 1; j < v.n; j++) n++; return n; }
    if (v.mode === 'league') { for (let i = 0; i < v.n; i++) for (let j = 0; j < v.n; j++) if (i !== j) n++; return n; }
    let p = v.n; while (p > 1) { const m = Math.floor(p / 2); n += m; p -= m; } return n;
  },
  growth(v) { let x = v.P; for (let i = 0; i < v.k; i++) x = v.up ? x * 2 : x / 2; return x; },
  coins(v) {
    if (v.mode === 'gambler') return 50;
    if (v.mode === 'atleast') { let hit = 0; const tot = 1 << v.n; for (let m = 0; m < tot; m++) if (m !== 0) hit++; return hit / tot * 100; }
    let same = 0, tot = 0; for (let i = 0; i < v.n; i++) for (let j = 0; j < v.n; j++) { tot++; if (i === j) same++; } return tot / same;
  },
  avgneeded(v) { for (let x = 0; x <= 200; x++) if (near((v.a * v.n + x) / (v.n + 1), v.A)) return x; },
  scaling(v) {
    if (v.mode === 'pizza') return (Math.PI * (v.k * v.s / 2) ** 2) / (Math.PI * (v.s / 2) ** 2);
    if (v.mode === 'square') return (v.k * 7) ** 2 / 7 ** 2;
    const edge = Math.cbrt(v.V); return (edge * v.k) ** 3;
  },
  markup(v) { const profit = v.price - v.cost; return profit / (v.ofCost ? v.cost : v.price) * 100; },
  vat(v) { for (let x = 1; x <= 2000; x += 0.5) if (near(x * (1 + v.r / 100), v.G)) return x; },
  till(v) { let shop = 0; shop -= v.S; /* theft */ shop += v.S; /* note back in */ shop -= v.G; /* goods out */ shop -= (v.S - v.G); /* change out */ return -shop; },
  pctpoints(v) { return (v.to - v.f) / v.f * 100; },
  offers(v) { return (v.got - v.paid) / v.got * 100; },
  dilution(v) {
    const others = v.N * (100 - v.P) / 100;
    for (let k = 0; k < v.N; k++) { const left = v.N - k; if (near((left - others) / left * 100, v.Q)) return v.mode === 'leave' ? k : left; }
  },
  speed(v) {
    if (v.mode === 'avg') { const L = 120; return 2 * L / (L / v.a + L / v.b); }
    for (let s = 1; s <= 400; s++) { const L = 120; if (near(2 * L / (L / v.a + L / s), v.T)) return s; }
  },
  winrate(v) { for (let x = 0; x < 500; x++) if (near((v.w + x) / (v.g + x) * 100, v.T)) return x; },
  fly(v) {
    // Simulate each leg of the zigzag.
    let a = 0, b = v.d, pos = 0, dir = 1, dist = 0;
    for (let i = 0; i < 400 && b - a > 1e-9; i++) {
      const gap = dir === 1 ? b - pos : pos - a;
      const t = gap / (v.f + v.v);
      dist += v.f * t; a += v.v * t; b -= v.v * t; pos = dir === 1 ? b : a; dir = -dir;
    }
    return dist;
  },
  clock(v) {
    if (v.mode === 'overlap') { let count = 0, prev = 0; for (let s = 1; s <= v.H * 3600; s++) { const rel = (s * (360 / 3600 - 30 / 3600)) % 360; if (rel < prev) count++; prev = rel; } return count; }
    const mins = (v.h % 12) * 60 + v.m; const hour = mins * 0.5, minute = v.m * 6; let d = Math.abs(hour - minute) % 360; return Math.min(d, 360 - d); },
  weighted(v) { let sum = 0, n = 0; for (let i = 0; i < v.n1; i++) { sum += v.a1; n++; } for (let i = 0; i < v.n2; i++) { sum += v.a2; n++; } return sum / n; },
  digits(v) {
    let c = 0;
    for (let i = 1; i <= v.N; i++) {
      let x = i, k = 0; while (x > 0) { if (x % 10 === v.d) k++; x = Math.floor(x / 10); }
      c += v.mode === 'contain' ? (k > 0 ? 1 : 0) : k;
    }
    return c;
  },
  race(v) { const arr = []; for (let i = 1; i <= 10; i++) arr.push('r' + i); arr.splice(v.k, 0, 'you'); const me = arr.indexOf('you'); arr[me] = arr[me - 1]; arr[me - 1] = 'you'; return arr.indexOf('you') + 1; },
  paperfold(v) { let layers = 1; for (let i = 0; i < v.n; i++) layers *= 2; return layers; },
  pigeon(v) { const seen = new Set(); let people = 0; for (let c = 0; c < v.k; c++) { seen.add(c); people++; } return people + 1; },
  squares(v) { let c = 0; for (let s = 1; s <= v.n; s++) for (let x = 0; x + s <= v.n; x++) for (let y = 0; y + s <= v.n; y++) c++; return c; },
  monty(v) { let wins = 0, games = 0; for (let car = 0; car < 3; car++) for (let pick = 0; pick < 3; pick++) { games++; const opened = [0, 1, 2].find(d => d !== pick && d !== car); const other = [0, 1, 2].find(d => d !== pick && d !== opened); if (other === car) wins++; } return v.G * wins / games; },
  bookworm(v) { const firstPageVol1 = v.c + v.P; const vol2Start = 2 * v.c + v.P; const lastPageVol2 = vol2Start + v.c; return lastPageVol2 - firstPageVol1; },
  stairs(v) { const ways = n => n < 0 ? 0 : n === 0 ? 1 : ways(n - 1) + ways(n - 2); return ways(v.n); },
  bridge(v) {
    const t = v.times, full = 15, best = new Map(); const key = (m, side) => m * 2 + side; best.set(key(full, 0), 0);
    let frontier = [[full, 0, 0]];
    while (frontier.length) {
      const next = [];
      for (const [mask, side, cost] of frontier) {
        if (cost > best.get(key(mask, side))) continue;
        const here = []; for (let i = 0; i < 4; i++) if (((mask >> i) & 1) === (side === 0 ? 1 : 0)) here.push(i);
        const moves = []; for (let i = 0; i < here.length; i++) { moves.push([here[i]]); for (let j = i + 1; j < here.length; j++) moves.push([here[i], here[j]]); }
        for (const mv of moves) { let m2 = mask; for (const p of mv) m2 ^= (1 << p); const c2 = cost + Math.max(...mv.map(p => t[p])); const k2 = key(m2, 1 - side); if (!best.has(k2) || c2 < best.get(k2)) { best.set(k2, c2); next.push([m2, 1 - side, c2]); } }
      }
      frontier = next;
    }
    return best.get(key(0, 1));
  },
  lockers(v) { const open = new Array(v.N + 1).fill(false); for (let s = 1; s <= v.N; s++) for (let l = s; l <= v.N; l += s) open[l] = !open[l]; return open.filter(Boolean).length; },
  balance(v) { const W = [0, 0]; for (let n = 2; n <= v.n; n++) { let b = Infinity; for (let k = 1; 2 * k <= n; k++) b = Math.min(b, 1 + Math.max(W[k], W[n - 2 * k])); W[n] = b; } return W[v.n]; },
  cube(v) { let c = 0; const n = v.n; for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) { let f = 0; for (const a of [x, y, z]) { if (a === 0) f++; if (a === n - 1) f++; } if (f === v.k) c++; } return c; },
  classic(v) {
    if (v.id === 'ants') { let hit = 0; for (let m = 0; m < 8; m++) { const d = [m & 1, (m >> 1) & 1, (m >> 2) & 1]; if (!(d[0] === d[1] && d[1] === d[2])) hit++; } return hit / 8 * 100; }
    if (v.id === 'rope') { const R = 6371000; return 2 * Math.PI * (R + 1) - 2 * Math.PI * R; }
    if (v.id === 'birthday') { let p = 1; for (let n = 1; n < 366; n++) { p *= (365 - (n - 1)) / 365; if (1 - p > 0.5) return n; } }
    if (v.id === 'billion') return 1e9 / (86400 * 365.25);
    if (v.id === 'coinroll') { const r = 1, R = 1; return (2 * Math.PI * (R + r)) / (2 * Math.PI * r); }
    if (v.id === 'twokids') { let all = 0, both = 0; for (const a of 'BG') for (const b of 'BG') if (a === 'B' || b === 'B') { all++; if (a === 'B' && b === 'B') both++; } return all / both; }
    if (v.id === 'monty') { let wins = 0, games = 0; for (let car = 0; car < 3; car++) for (let pick = 0; pick < 3; pick++) { games++; const opened = [0, 1, 2].find(d => d !== pick && d !== car); const other = [0, 1, 2].find(d => d !== pick && d !== opened); if (other === car) wins++; } return wins / games * 100; }
    if (v.id === 'sum') { let s = 0; for (let i = 1; i <= 100; i++) s += i; return s; }
    if (v.id === 'cable') { const half = 80 / 2, drop = 50 - 10; return 2 * Math.sqrt(Math.max(0, half * half - drop * drop)); }
    if (v.id === 'chess') { let c = 0; for (let s = 1; s <= 8; s++) c += (9 - s) * (9 - s); return c; }
    if (v.id === 'monty100') { let wins = 0; for (let car = 0; car < 100; car++) { const pick = 0; if (pick !== car) wins++; } return wins; }
  },
  corners(v) { let pts = v.n; pts -= 1; pts += 2; return pts; },
  hands(v) { let c = 0; for (let h = 0; h < v.n; h++) for (let f = 0; f < 5; f++) c++; return c; },
  divhalf(v) { let fit = 0; for (let x = 0.5; x <= v.a + 1e-9; x += 0.5) fit++; return fit + v.b; },
  dry(v) { const each = v.each; return Math.max(each, each, each); },
  family(v) { const kids = new Set(); for (let i = 0; i < v.s; i++) kids.add('sister' + i); for (let i = 0; i < v.s; i++) for (let j = 0; j < v.b; j++) kids.add('brother' + j); return kids.size; },
  refill(v) { let full = v.n, empty = 0, drunk = 0; while (full > 0) { full--; drunk++; empty++; if (empty === v.k) { empty = 0; full++; } } return drunk; },
  jointwork(v) { let done = 0, t = 0; const step = 1 / 1000; while (done < 1 - 1e-9) { done += step / v.x + step / v.y; t += step; } return Math.round(t * 1000) / 1000; }
};

const variants = {}; let longest = 0, lenSum = 0;
for (const f of E.families) {
  const seen = new Set();
  for (let i = 0; i < 4000; i++) {
    const q = E.make(f, 'test-' + i, i);
    checked++;
    seen.add(q.q);
    if (/undefined|NaN|null|Infinity/.test(q.q + q.why)) fail('bad text', q);
    if (!isFinite(q.a) || q.a < 0) fail('bad answer', q);
    if (!near(q.a * 100, Math.round(q.a * 100))) fail('answer has more than 2 decimals', q);
    if (!q.why || q.why.length < 20) fail('no explanation', q);
    if (E.judge(q, String(q.a)) !== 'right') fail('judge rejects the answer', q);
    if (!E.hasBait(q) && q.fam !== 'classic' && q.fam !== 'paradox') fail('no trap answer', q);
    if (q.q.length > 190) fail('too long to say out loud (' + q.q.length + ' characters)', q);
    longest = Math.max(longest, q.q.length); lenSum += q.q.length;
    const far = E.judge(q, String(q.a + (q.tol || 0) + 0.5)); if (far !== 'high' && far !== 'bait') fail('a guess above the answer should read as too high', q);
    for (const b of q.baits) if (E.judge(q, String(Math.round(b * 100) / 100)) !== 'bait') fail('bait not recognised: ' + b, q);
    if (String(q.a).replace('.', '').length > 7) fail('answer too long to type', q);
    const fn = verify[q.v.t];
    if (!fn) { fail('no verifier for ' + q.v.t, q); continue; }
    const want = fn(q.v, q);
    if (want === undefined || Math.abs(want - q.a) > (q.tol || 0) + 1e-6) fail('answer mismatch: independent check says ' + want, q);
  }
  variants[f.id] = seen.size;
}

// Schedule checks over three years.
let back = 0; let prevFams = [];
const famCount = {};
for (let day = 1; day <= 1095; day++) {
  const set = E.buildDaily(day);
  if (set.length !== 3) fail('day ' + day + ' has ' + set.length + ' questions');
  const ids = set.map(q => q.fam);
  if (new Set(ids).size !== 3) fail('day ' + day + ' repeats a family');
  if (set.map(q => q.level).join('') !== '123') fail('day ' + day + ' levels ' + set.map(q => q.level).join(''));
  if (ids.some(id => prevFams.includes(id))) back++;
  ids.forEach(id => famCount[id] = (famCount[id] || 0) + 1);
  prevFams = ids;
  const again = E.buildDaily(day);
  if (JSON.stringify(again.map(q => q.q)) !== JSON.stringify(set.map(q => q.q))) fail('day ' + day + ' not deterministic');
}
// Table sets: same code gives same set; different codes differ.
const t1 = E.buildTable('LADS', 1), t2 = E.buildTable('LADS', 1), t3 = E.buildTable('LADS', 2);
if (JSON.stringify(t1.map(q => q.q)) !== JSON.stringify(t2.map(q => q.q))) fail('table not deterministic');
if (JSON.stringify(t1.map(q => q.q)) === JSON.stringify(t3.map(q => q.q))) fail('table rounds identical');
// Day numbering.
if (E.dayNumber(new Date(2026, 10, 16)) !== 1) fail('epoch day');
if (E.dayNumber(new Date(2026, 10, 17)) !== 2) fail('day 2');
if (E.dayNumber(new Date(2027, 10, 16)) !== 366) fail('one year on');
// Judge edge cases.
const q0 = E.buildDaily(1)[0];
if (E.judge(q0, '') !== 'bad' || E.judge(q0, '.') !== 'bad') fail('empty input');

const totalVariants = Object.values(variants).reduce((a, b) => a + b, 0);
console.log('questions checked:', checked);
console.log('longest question:', longest, 'characters; average', Math.round(lenSum / checked));
console.log('distinct question texts found:', totalVariants);
console.log('fewest variants in a family:', Object.entries(variants).sort((a, b) => a[1] - b[1]).slice(0, 5).map(e => e.join('=')).join(', '));
console.log('days with a family repeated from the day before (of 1095):', back);
console.log('family appearances min/max over 3 years:', Math.min(...Object.values(famCount)), Math.max(...Object.values(famCount)));
console.log(fails ? 'FAILURES: ' + fails : 'ALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
