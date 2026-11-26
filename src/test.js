// Independent checks: every answer is re-derived by brute force or simulation,
// not by the formula the generator used.
const E = require('./engine.js');
let fails = 0, checked = 0;
const near = (a, b) => Math.abs(a - b) < 1e-6;
function fail(msg, q) { fails++; if (fails < 40) console.log('FAIL', msg, q ? '\n   ' + q.q + ' => ' + q.a : ''); }

const verify = {
  addup(v) { let t = 0; for (const x of v.parts) t += x; return t; },
  bidmas(v) { return Function('return ' + v.a + ' + ' + v.b + ' * ' + v.c)(); },
  count(v) { let c = 0; for (let i = v.lo; i <= v.hi; i++) if (!v.odd || i % 2 === 1) c++; return c; },
  tunnel(v) { let t = 0; for (let front = 0; front - v.L < v.T; front++) t++; return t; },   // one km a minute: the back is out when the front is L past the end
  eleven(v) { let x = 0; for (let i = 0; i < v.n; i++) x += 1000; for (let i = 0; i < v.n; i++) x += 100; return x + v.n; },
  agesum(v) { let s = v.sum; for (let y = 0; y < v.y; y++) for (let k = 0; k < v.n; k++) s++; return s; },
  glue(v) { const cubes = new Set(); for (let i = 0; i < v.n; i++) cubes.add(i); let showing = 0; for (const c of cubes) for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) if (!(d[1] === 0 && d[2] === 0 && cubes.has(c + d[0]))) showing++; return showing; },
  string(v) { let strands = 1; for (let i = 0; i < v.n; i++) strands *= 2; return strands + 1; },   // one cut per strand, and k cuts in one string make k + 1 pieces
  jar(v) { for (let j = 0; j <= v.full; j++) if (near(j + (v.full - j) / 2, v.half)) return j; },
  workrate(v) { for (let t = 1; t < 200; t++) if (near(t / v.x + t / v.y, 1)) return t; },
  liftavg(v) { for (let x = 0; x < 2000; x++) if (near((v.n * v.avg + x) / (v.n + 1), v.target)) return x; },
  around(v) {
    if (v.mode === 'path') { let c = 0; for (let x = -1; x <= v.s; x++) for (let y = -1; y <= v.s; y++) if (x < 0 || y < 0 || x >= v.s || y >= v.s) c++; return c; }
    const posts = new Set(); for (let i = 0; i < v.n; i++) { posts.add('0,' + i); posts.add((v.n - 1) + ',' + i); posts.add(i + ',0'); posts.add(i + ',' + (v.n - 1)); } return posts.size; },
  presale(v) { for (let x = 1; x < 5000; x++) if (near(x * (100 - v.p) / 100, v.after)) return x; },
  ladder(v) { let rungBelow = v.k; for (let h = 0; h < v.h; h++) { const water = v.g, ship = v.g; rungBelow += (water - ship) / v.g; } return rungBelow; },
  weekend() { let hit = 0; for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) if (a || b) hit++; return hit / 4 * 100; },
  chain(v) {   // open `whole` pieces completely and a few end links besides: the cut links must join what is left
    for (let cuts = 0; cuts < 50; cuts++) for (let whole = 0; whole * v.m <= cuts && whole < v.n; whole++) { const ends = cuts - whole * v.m; if (ends <= (v.n - whole) * (v.m > 1 ? 1 : 0) && cuts >= v.n - whole - 1) return cuts; } },
  triangle(v) { const s = (v.a + v.b + v.c) / 2; return Math.sqrt(Math.max(0, s * (s - v.a) * (s - v.b) * (s - v.c))); },
  slowclock(v) { let secs = 0; while (secs * (60 - v.L) < 60 * 3600) secs++; return secs / 60 - 60; },
  zeros(v) { let f = 1n; for (let i = 2n; i <= BigInt(v.n); i++) f *= i; let z = 0; while (f % 10n === 0n) { f /= 10n; z++; } return z; },
  boxes() {   // labels [A, O, M], all wrong: two ways to fill them. One fruit settles it if some box shows a different fruit in each.
    const ways = [['O', 'M', 'A'], ['M', 'A', 'O']], shows = c => c === 'M' ? 'ao' : c === 'A' ? 'a' : 'o';
    for (let box = 0; box < 3; box++) { const x = shows(ways[0][box]), y = shows(ways[1][box]); if (![...x].some(ch => y.includes(ch))) return 1; } return 2; },
  brothers(v) { for (let g = 1; g < 30; g++) for (let b = 2; b < 30; b++) if (b === g - 1 && g === v.k * (b - 1)) return g + b; },
  tyres(v) { const km = [0, 0, 0, 0, 0]; for (let leg = 0; leg < v.D / 100; leg++) for (let t = 0; t < 5; t++) if (t !== leg % 5) km[t] += 100; return km[0]; },
  piles(v) { const mine = { red: v.k, black: 26 - v.k }; return 26 - mine.black; },
  magnify(v) { const k = v.k, rad = v.deg * Math.PI / 180, ax = k, ay = 0, bx = k * Math.cos(rad), by = k * Math.sin(rad); return Math.round(Math.atan2(ax * by - ay * bx, ax * bx + ay * by) * 180 / Math.PI * 1e6) / 1e6; },   // scale both arms and measure the angle again
  triple(v) { const before = 100, after = before * v.k; return (after - before) / before * 100; },
  hourhand(v) { let pos = 0, rounds = 0; for (let h = 0; h < v.hours; h++) { pos++; if (pos === 12) { pos = 0; rounds++; } } return rounds; },
  decimaltime(v) { let m = 0; for (let secs = 0; secs < parseFloat(v.h) * 3600 - 1e-6; secs += 60) m++; return m; },
  combos(v) {
    if (v.mode === 'dials') { let c = 0; const go = left => { if (left === 0) { c++; return; } for (let d = 0; d <= 9; d++) go(left - 1); }; go(v.n); return c; }
    const seen = new Set(); for (let x = 0; x <= v.a; x++) for (let y = 0; y <= v.b; y++) seen.add(x + '-' + y); return seen.size; },
  step(v) {
    if (v.mode === 'carpet') { const n = 16; let len = 0; for (let i = 0; i < n; i++) { len += v.along / n; len += v.up / n; } return Math.round(len * 1e6) / 1e6; }
    const S = v.S, c = v.c, pts = [[0, 0], [S, 0], [S, S - c], [S - c, S - c], [S - c, S], [0, S]]; let per = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; per += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); } return per; },
  cake(v) { const C = (n, k) => { let x = 1; for (let i = 0; i < k; i++) x = x * (n - i) / (i + 1); return x; }; for (let cuts = 0; cuts < 20; cuts++) if (C(cuts, 0) + C(cuts, 1) + C(cuts, 2) + C(cuts, 3) >= v.n) return cuts; },   // the most pieces c flat cuts can make of a solid
  eitheror(v) {
    if (v.mode === 'cards') { let c = 0; for (const suit of 'HDSC') for (const rank of ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) { const inSuit = v.suit === 'red' ? (suit === 'H' || suit === 'D') : suit === v.suit; const inRank = v.rank === 'pic' ? 'JQK'.includes(rank) : rank === v.rank; if (inSuit || inRank) c++; } return c; }
    let c = 0; for (let i = 1; i <= v.N; i++) if (i % v.x === 0 || i % v.y === 0) c++; return c; },
  headstart(v) { const you = v.L, friend = v.L - v.d; let t = 0; const dt = 1 / 100000; while (you * t < v.L + v.d - 1e-9) t += dt; return Math.round((v.L - friend * t) * 100) / 100; },   // run the rematch: you need L + d, the friend needs L
  dicestack(v) {   // try every way the lower dice could be lying: the hidden total never changes
    let ans = null; const go = (i, sum) => { if (i === v.n) { if (ans !== null && ans !== sum) ans = NaN; else if (ans === null) ans = sum; return; } for (let top = 1; top <= 6; top++) go(i + 1, sum + top + (7 - top)); };
    go(1, 7 - v.top); return ans; },
  hat(v) { const row = 3, flow = 1.25, dt = 1 / 600; let boat = 0, hat = 0, t = 0; for (; t < v.m - 1e-9; t += dt) { boat += (row - flow) * dt; hat -= flow * dt; } let back = 0; while (boat > hat + 1e-9) { boat -= (row + flow) * dt; hat -= flow * dt; back += dt; } return Math.round(back * 100) / 100; },
  bags(v) { const weights = new Set(); for (let heavy = 1; heavy <= v.n; heavy++) { let w = 0; for (let b = 1; b <= v.n; b++) w += b * (b === heavy ? 11 : 10); weights.add(w); } return weights.size === v.n ? 1 : 2; },   // one weighing of 1, 2, 3… coins gives a different reading for every bag
  loaves(v) { const each = (v.a + v.b) / 3, gaveA = v.a - each, gaveB = v.b - each; return Math.round((v.a + v.b) * gaveA / (gaveA + gaveB) * 1e6) / 1e6; },
  untilaboy() { let boys = 0, girls = 0, p = 1; for (let k = 0; k < 200; k++) { p /= 2; boys += p; girls += p * k; } return Math.round(boys / (boys + girls) * 1e8) / 1e6; },   // a family with k girls then a boy has chance 1/2^(k+1)
  stick(v) { const n = 2000; let sum = 0; for (let i = 0; i < n; i++) { const x = (i + 0.5) * v.L / n, s = Math.min(x, v.L - x); sum += v.which === 'shorter' ? s : v.L - s; } return Math.round(sum / n * 1e6) / 1e6; },
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
    if (v.mode === 'monday') { let date = 1; for (let n = 1; n < v.k; n++) date += 7; return date; }
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
    if (v.mode === 'snap') { let pieces = 1; while (pieces < v.a * v.b) { pieces++; n++; } return n; }
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
    if (v.mode === 'units') { let c = 0; for (let x = 0; x < v.k; x++) for (let y = 0; y < v.k; y++) c++; return c; }
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
    if (v.mode === 'opposite') { let count = 0, prev = null; for (let s = 0; s <= v.H * 3600; s++) { const rel = ((s * (360 / 3600 - 30 / 3600)) + 180) % 360; if (prev !== null && rel < prev) count++; prev = rel; } return count; }
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
  baserate(v) { let scams = 0, flagged = 0; const N = 1000000; scams = N * v.prior / 100; flagged = scams + (N - scams) * v.f / 100; return scams / flagged * 100; },
  cuts(v) {   // count regions the hard way: each new line in general position adds one piece per line it crosses, plus one
    let pieces = 1; for (let line = 1; line <= v.n; line++) { let crossed = 0; for (let earlier = 1; earlier < line; earlier++) crossed++; pieces += crossed + 1; } return pieces; },
  pigeon(v) { if (v.mode === 'coins') { let hit = 0; for (let m = 0; m < 8; m++) { const f = [m & 1, (m >> 1) & 1, (m >> 2) & 1]; if (f[0] === f[1] || f[1] === f[2] || f[0] === f[2]) hit++; } return hit / 8 * 100; }
    const seen = new Set(); let people = 0; for (let c = 0; c < v.k; c++) { seen.add(c); people++; } return people + 1; },
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
    if (v.id === 'cards') { let red = 0, both = 0; for (const card of ['RR', 'BB', 'RB']) for (const side of [0, 1]) if (card[side] === 'R') { red++; if (card[1 - side] === 'R') both++; } return both / red * 100; }
    if (v.id === 'coinroll') { const r = 1, R = 1; return (2 * Math.PI * (R + r)) / (2 * Math.PI * r); }
    if (v.id === 'twokids') { let all = 0, both = 0; for (const a of 'BG') for (const b of 'BG') if (a === 'B' || b === 'B') { all++; if (a === 'B' && b === 'B') both++; } return all / both; }
    if (v.id === 'monty') { let wins = 0, games = 0; for (let car = 0; car < 3; car++) for (let pick = 0; pick < 3; pick++) { games++; const opened = [0, 1, 2].find(d => d !== pick && d !== car); const other = [0, 1, 2].find(d => d !== pick && d !== opened); if (other === car) wins++; } return wins / games * 100; }
    if (v.id === 'sum') { let s = 0; for (let i = 1; i <= 100; i++) s += i; return s; }
    if (v.id === 'cable') { const half = 80 / 2, drop = 50 - 10; return 2 * Math.sqrt(Math.max(0, half * half - drop * drop)); }
    if (v.id === 'chess') { let c = 0; for (let s = 1; s <= 8; s++) c += (9 - s) * (9 - s); return c; }
    if (v.id === 'monty100') { let wins = 0; for (let car = 0; car < 100; car++) { const pick = 0; if (pick !== car) wins++; } return wins; }
  },
  listen(v) {
    if (v.id === 'sheep') { const flock = []; for (let i = 0; i < v.n; i++) flock.push(i); let gone = 0; while (flock.length > v.k) { flock.pop(); gone++; } return flock.length; }
    if (v.id === 'apples') { const bowl = v.n, mine = []; for (let i = 0; i < v.k; i++) mine.push(1); return mine.length; }
    if (v.id === 'hole') return 0;   // the soil in a hole is whatever has not been dug out of it yet: none
    if (v.id === 'stamps') { let c = 0; for (let i = 0; i < 12; i++) c++; return c; }
    if (v.id === 'cats') { for (let n = 1; n < 20; n++) if (n - 1 === 3) return n; }
    if (v.id === 'months') return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31].filter(d => d >= 28).length;
    if (v.id === 'fathers') {   // fewest people in one family line holding two father roles and two son roles
      for (let n = 1; n < 6; n++) { const fathers = n - 1, sons = n - 1; if (fathers >= 2 && sons >= 2) return n; }
    }
  },
  corners(v) { let pts = v.n; pts -= 1; pts += 2; return pts; },
  hands(v) { let c = 0; for (let h = 0; h < v.n; h++) for (let f = 0; f < 5; f++) c++; return c; },
  divhalf(v) { let fit = 0; for (let x = 0.5; x <= v.a + 1e-9; x += 0.5) fit++; return fit + v.b; },
  dry(v) { const each = v.each; return Math.max(each, each, each); },
  family(v) { const kids = new Set(); for (let i = 0; i < v.s; i++) kids.add('sister' + i); for (let i = 0; i < v.s; i++) for (let j = 0; j < v.b; j++) kids.add('brother' + j); return kids.size; },
  refill(v) { let full = v.n, empty = 0, drunk = 0; while (full > 0) { full--; drunk++; empty++; if (empty === v.k) { empty = 0; full++; } } return drunk; },
  jointwork(v) { let done = 0, t = 0; const step = 1 / 1000; while (done < 1 - 1e-9) { done += step / v.x + step / v.y; t += step; } return Math.round(t * 1000) / 1000; }
};

const variants = {}; let longest = 0, lenSum = 0; const madeKinds = new Set();
for (const f of E.families) {
  const seen = new Set();
  for (let i = 0; i < 4000; i++) {
    const q = E.make(f, 'test-' + i, i);
    checked++;
    seen.add(q.q); madeKinds.add(q.kind);
    if (!(q.grade >= 1 && q.grade <= 5) || q.level !== (q.grade <= 2 ? 1 : q.grade === 3 ? 2 : 3)) fail('grade and level disagree', q);
    if (/undefined|NaN|null|Infinity/.test(q.q + q.why)) fail('bad text', q);
    if (!isFinite(q.a) || q.a < 0) fail('bad answer', q);
    if (!near(q.a * 100, Math.round(q.a * 100))) fail('answer has more than 2 decimals', q);
    if (!q.why || q.why.length < 20) fail('no explanation', q);
    if (E.judge(q, String(q.a)) !== 'right') fail('judge rejects the answer', q);
    if (!E.hasBait(q) && q.fam !== 'classic') fail('no trap answer', q);
    if (!/^[a-z0-9]{3,40}$/.test(q.kind)) fail('kind is not a safe counter name: ' + q.kind, q);
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

// Calendar checks over three years.
const lastIdea = {}, lastKind = {}, lastText = {}, kindDays = {}, ideaGaps = [];
let minIdea = 9999, minKind = 9999, minText = 9999, sameCorner = 0;
for (let day = 1; day <= 1095; day++) {
  const set = E.buildDaily(day);
  if (set.length !== 3) fail('day ' + day + ' has ' + set.length + ' questions');
  const ideas = set.map(q => E.ideaOf(q.kind)), corners = set.map(q => E.domainOf(q.kind)).filter(Boolean);
  if (new Set(ideas).size !== 3) fail('day ' + day + ' uses one idea twice: ' + ideas.join(', '));
  if (new Set(corners).size !== corners.length) sameCorner++;
  if (set.map(q => q.level).join('') !== '123') fail('day ' + day + ' levels ' + set.map(q => q.level).join(''));
  if (set.map(q => q.grade).join('') !== '234') fail('day ' + day + ' grades ' + set.map(q => q.grade).join('') + ': a day must climb 2, 3, 4');
  set.forEach(q => {
    const idea = E.ideaOf(q.kind);
    const byHand = E.pinned[day];   // a day set by hand may bring a classic back early on purpose
    if (lastIdea[idea] && day > 2 && !byHand) { minIdea = Math.min(minIdea, day - lastIdea[idea]); ideaGaps.push(day - lastIdea[idea]); }   // days 1 and 2 are the old calendar's, kept as history
    if (lastKind[q.kind] && !byHand) minKind = Math.min(minKind, day - lastKind[q.kind]);
    if (lastText[q.q] && !byHand) minText = Math.min(minText, day - lastText[q.q]);
    lastIdea[idea] = day; lastKind[q.kind] = day; lastText[q.q] = day; kindDays[q.kind] = (kindDays[q.kind] || 0) + 1;
  });
  const again = E.buildDaily(day);
  if (JSON.stringify(again.map(q => q.q)) !== JSON.stringify(set.map(q => q.q))) fail('day ' + day + ' not deterministic');
}
if (sameCorner) fail(sameCorner + ' days took two questions from the same corner of maths');
if (minIdea < 12) fail('an idea came back after only ' + minIdea + ' days');
if (minKind < 12) fail('a kind came back after only ' + minKind + ' days');
if (minText < 24) fail('the very same question came back after only ' + minText + ' days');
// Endless mode: the next kind is always one whose idea the player has not met for as long as possible.
{
  const recent = []; let rs = 1; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 600; n++) {
    const grade = n < 6 ? [1, 2, 2, 3, 3, 4][n] : [3, 4, 2, 5, 3, 4, 1, 5][(n - 6) % 8], k = E.nextKind(grade, recent, rnd);
    if (E.GRADE[k] !== grade) fail('endless asked for grade ' + grade + ' and got ' + k);
    const pool = new Set(E.kindsAt(grade).map(E.ideaOf)), since = recent.slice(-(pool.size - 1)).filter(x => E.GRADE[x] === grade).map(E.ideaOf);
    if (since.slice(-(Math.min(since.length, pool.size - 1))).includes(E.ideaOf(k)) && new Set(since).size < pool.size) fail('endless repeated the idea ' + E.ideaOf(k) + ' while others at grade ' + grade + ' were waiting');
    recent.push(k); if (recent.length > 90) recent.shift();
  }
}
// Table sets: same code gives same set; different codes differ.
const t1 = E.buildTable('LADS', 1), t2 = E.buildTable('LADS', 1), t3 = E.buildTable('LADS', 2);
if (JSON.stringify(t1.map(q => q.q)) !== JSON.stringify(t2.map(q => q.q))) fail('table not deterministic');
if (JSON.stringify(t1.map(q => q.q)) === JSON.stringify(t3.map(q => q.q))) fail('table rounds identical');
// Party sets: right length, easy first, no family twice, same seed gives the same set.
for (const n of [3, 5, 7]) for (let i = 0; i < 300; i++) {
  const set = E.buildParty('p' + i, n);
  if (set.length !== n) fail('party set has ' + set.length + ' questions, wanted ' + n);
  if (new Set(set.map(q => E.ideaOf(q.kind))).size !== n) fail('party set repeats an idea');
  if (set.map(q => q.grade).join('') !== set.map(q => q.grade).sort().join('')) fail('party set is not easy-first');
  if (set.some(q => q.grade < 2 || q.grade > 4)) fail('party set uses a giveaway or a brutal one');
  if (JSON.stringify(E.buildParty('p' + i, n).map(q => q.q)) !== JSON.stringify(set.map(q => q.q))) fail('party set not deterministic');
}
const kinds = E.kinds();
if (new Set(kinds.map(k => k.kind)).size !== kinds.length) fail('duplicate kinds');
// Grades: every kind the bank can make has one, nothing graded is unmakeable, and a kind can be asked for by name.
const graded = new Set(Object.keys(E.GRADE));
for (const k of madeKinds) if (!graded.has(k)) fail('kind has no grade: ' + k);
for (const k of graded) if (!madeKinds.has(k)) fail('graded kind is never made: ' + k);
for (const k of graded) for (let i = 0; i < 40; i++) { const q = E.makeKind(k, 'mk-' + i, i); if (q.kind !== k) fail('asked for ' + k + ', got ' + q.kind); }
for (const k of graded) if (E.GRADE[k] >= 2 && E.GRADE[k] <= 4 && !kindDays[k]) fail('a daily kind never comes up in three years: ' + k);
for (const k of Object.keys(kindDays)) if (E.GRADE[k] < 2 || E.GRADE[k] > 4) fail('a giveaway or a brutal kind appeared in a daily set: ' + k);
if (JSON.stringify(E.buildTable('LADS', 1).map(q => q.grade)) !== '[2,3,4]') fail('private round does not climb 2, 3, 4');
// Days already played are locked: the calendar must hand back exactly what the table says.
for (const d of Object.keys(E.served)) { const got = E.planDay(Number(d)); if (JSON.stringify(got) !== JSON.stringify(E.served[d])) fail('day ' + d + ' is locked but the calendar changed it'); }
if (!E.served[E.dayNumber(new Date())] && !E.served[E.dayNumber(new Date()) - 1]) console.log('note: the locked days stop before yesterday; run node src/freeze.js before changing the bank');
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
console.log('kinds of question:', kinds.length, '(grade ' + [1, 2, 3, 4, 5].map(g => g + ': ' + kinds.filter(k => k.grade === g).length).join(', ') + ')');
console.log('ideas in the daily bank:', new Set(Object.keys(E.GRADE).filter(k => E.GRADE[k] >= 2 && E.GRADE[k] <= 4).map(E.ideaOf)).size);
ideaGaps.sort((a, b) => a - b);
console.log('days before an idea returns: shortest', minIdea + ', typical', ideaGaps[Math.floor(ideaGaps.length / 2)] + ', longest', ideaGaps[ideaGaps.length - 1]);
console.log('days before the same kind returns: shortest', minKind);
console.log('days before the very same wording returns: shortest', minText);
console.log(fails ? 'FAILURES: ' + fails : 'ALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
