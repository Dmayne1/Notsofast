/* Bait engine: seeded puzzle families. No DOM in this file. */
(function (root) {
  'use strict';

  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngFrom(str) { return mulberry32(xmur3(str)()); }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function shuffle(r, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function num(n) {
    const v = Math.round(n * 100) / 100;
    return v.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  }
  function eur(n) { return '€' + num(n); }
  function cents(c) { return '€' + (c / 100).toFixed(2); }
  function ord(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function lcm(a, b) { return a * b / gcd(a, b); }
  function pl(n, one, many) { return n === 1 ? one : many; }
  function walk(r, turn, list) { return typeof turn === 'number' ? list[turn % list.length] : pick(r, list); }

  const F = [];
  function fam(id, level, gen) { F.push({ id: id, level: level, gen: gen }); }

  /* ---------- Level 1 ---------- */

  fam('sumdiff', 1, function (r) {
    if (r() < 0.5) {
      const p = pick(r, [['bat', 'ball'], ['racket', 'shuttlecock'], ['burger', 'drink'], ['coffee', 'biscuit'], ['magazine', 'pen'], ['sandwich', 'banana']]);
      const D = pick(r, [100, 200]);
      const c = pick(r, [5, 10, 15, 20, 25, 30, 40, 45]) * (D / 100);
      const total = D + 2 * c;
      return {
        q: 'A ' + p[0] + ' and a ' + p[1] + ' cost ' + cents(total) + ' together. The ' + p[0] + ' costs ' + cents(D) + ' more than the ' + p[1] + '. How much is the ' + p[1] + '?',
        suf: 'cents', a: c, baits: [2 * c],
        why: 'If the ' + p[1] + ' were ' + (2 * c) + ' cents, the ' + p[0] + ' would be ' + cents(2 * c + D) + ' and the pair would cost ' + cents(4 * c + D) + '. At ' + c + ' cents it adds up: ' + cents(c) + ' plus ' + cents(c + D) + '.',
        v: { t: 'sumdiff', total: total, diff: D }
      };
    }
    const p = pick(r, [['laptop', 'mouse'], ['bike', 'helmet'], ['TV', 'remote'], ['guitar', 'strap'], ['sofa', 'cushion'], ['phone', 'case']]);
    const D = pick(r, [100, 500, 1000]);
    const c = pick(r, D === 100 ? [5, 10, 15, 20, 25] : D === 500 ? [20, 25, 30, 40, 50] : [25, 50, 75, 100]);
    const total = D + 2 * c;
    return {
      q: 'A ' + p[0] + ' and a ' + p[1] + ' cost ' + eur(total) + ' together. The ' + p[0] + ' costs ' + eur(D) + ' more than the ' + p[1] + '. How much is the ' + p[1] + '?',
      pre: '€', a: c, baits: [2 * c],
      why: 'If the ' + p[1] + ' were ' + eur(2 * c) + ', the ' + p[0] + ' would be ' + eur(2 * c + D) + ' and the pair would cost ' + eur(4 * c + D) + '. At ' + eur(c) + ' it adds up: ' + eur(c) + ' plus ' + eur(c + D) + '.',
      v: { t: 'sumdiff', total: total, diff: D }
    };
  });

  fam('rates', 1, function (r) {
    const mode = pick(r, ['time', 'count', 'workers', 'half']);
    if (mode === 'time') {
      const s = pick(r, [['machines', 'widgets'], ['bakers', 'loaves'], ['printers', 'posters'], ['robots', 'toys']]);
      const n = pick(r, [3, 4, 5, 6, 8]);
      const M = pick(r, [20, 50, 100, 200]);
      return {
        q: n + ' ' + s[0] + ' take ' + n + ' minutes to make ' + n + ' ' + s[1] + '. How many minutes do ' + M + ' ' + s[0] + ' take to make ' + M + ' ' + s[1] + '?',
        suf: 'minutes', a: n, baits: [M],
        why: 'Each of the ' + s[0] + ' makes one of the ' + s[1] + ' in ' + n + ' minutes. ' + M + ' working side by side make ' + M + ' in the same ' + n + ' minutes.',
        v: { t: 'rates', mode: mode, n: n, M: M }
      };
    }
    if (mode === 'half') {
      const p = pick(r, [[3, 3], [6, 6], [3, 6], [6, 3], [9, 3]]);
      const H = p[0], D = p[1], ans = H * D * 2 / 3;
      return {
        q: 'A hen and a half lays an egg and a half in a day and a half. How many eggs do ' + H + ' hens lay in ' + D + ' days?',
        suf: 'eggs', a: ans, baits: [Math.max(H, D), H * D],
        why: 'Scale it down: one hen lays one egg in a day and a half, which is 2 eggs every 3 days. ' + H + ' hens over ' + D + ' days lay ' + ans + '.',
        v: { t: 'rates', mode: mode, H: H, D: D }
      };
    }
    if (mode === 'count') {
      const s = pick(r, [['hens', 'lay', 'eggs', 'days', 'hen', 'egg'], ['bakers', 'bake', 'cakes', 'hours', 'baker', 'cake'], ['cats', 'catch', 'mice', 'minutes', 'cat', 'mouse']]);
      const n = pick(r, [2, 3, 4, 5]);
      const k = pick(r, [2, 3, 4]);
      return {
        q: n + ' ' + s[0] + ' ' + s[1] + ' ' + n + ' ' + s[2] + ' in ' + n + ' ' + s[3] + '. How many ' + s[2] + ' do ' + (k * n) + ' ' + s[0] + ' ' + s[1] + ' in ' + (k * n) + ' ' + s[3] + '?',
        suf: s[2], a: k * k * n, baits: [k * n],
        why: 'One ' + s[4] + ' manages one ' + s[5] + ' every ' + n + ' ' + s[3] + ', so ' + k + ' in ' + (k * n) + ' ' + s[3] + '. With ' + (k * n) + ' of them that is ' + (k * n) + ' × ' + k + ' = ' + (k * k * n) + '.',
        v: { t: 'rates', mode: mode, n: n, k: k }
      };
    }
    const s = pick(r, [['cats', 'catch', 'mice', 'minutes'], ['mechanics', 'fix', 'cars', 'hours'], ['chefs', 'plate', 'dishes', 'minutes']]);
    const n = pick(r, [2, 3, 4, 5, 6]);
    const k = pick(r, [5, 10, 20]);
    const M = n * k;
    return {
      q: n + ' ' + s[0] + ' ' + s[1] + ' ' + n + ' ' + s[2] + ' in ' + n + ' ' + s[3] + '. How many ' + s[0] + ' are needed to ' + s[1] + ' ' + M + ' ' + s[2] + ' in ' + M + ' ' + s[3] + '?',
      suf: s[0], a: n, baits: [M],
      why: 'Each one gets through one every ' + n + ' ' + s[3] + ', so ' + k + ' in ' + M + ' ' + s[3] + '. To reach ' + M + ' you need ' + M + ' ÷ ' + k + ' = ' + n + '.',
      v: { t: 'rates', mode: mode, n: n, M: M }
    };
  });

  fam('doubling', 1, function (r) {
    const s = pick(r, [['A patch of lily pads', 'pond'], ['A bloom of algae', 'lake'], ['A patch of weeds', 'field'], ['A spot of mould', 'wall']]);
    const mode = pick(r, ['half', 'quarter', 'two', 'four']);
    const D = pick(r, (mode === 'half' || mode === 'two') ? [20, 24, 30, 36, 48, 60] : [20, 24, 36, 48, 60]);
    const base = s[0] + ' doubles in size every day. It takes ' + D + ' days to cover the whole ' + s[1] + '. ';
    if (mode === 'half') return { q: base + 'How many days did it take to cover half the ' + s[1] + '?', suf: 'days', a: D - 1, baits: [D / 2], why: 'It doubles daily, so one day before the ' + s[1] + ' was full it was half full. That is day ' + (D - 1) + ', not day ' + (D / 2) + '.', v: { t: 'doubling', mode: mode, D: D } };
    if (mode === 'quarter') return { q: base + 'How many days did it take to cover a quarter of the ' + s[1] + '?', suf: 'days', a: D - 2, baits: [D / 4, D / 2], why: 'Half covered on day ' + (D - 1) + ', and a quarter the day before that: day ' + (D - 2) + '.', v: { t: 'doubling', mode: mode, D: D } };
    if (mode === 'two') return { q: base + 'If you start with two identical patches instead of one, how many days does it take?', suf: 'days', a: D - 1, baits: [D / 2], why: 'Two patches are just one patch a day later. You save a single day, not half the time.', v: { t: 'doubling', mode: mode, D: D } };
    return { q: base + 'If you start with four identical patches instead of one, how many days does it take?', suf: 'days', a: D - 2, baits: [D / 4, D / 2], why: 'Four patches are one patch two days later. You save two days, not three quarters of the time.', v: { t: 'doubling', mode: mode, D: D } };
  });

  fam('selfref', 1, function (r) {
    const f = pick(r, [
      { w: 'half', n: 1, d: 2, A: [4, 6, 8, 10, 12, 20, 30], rest: 'the other half' },
      { w: 'a third of', n: 1, d: 3, A: [6, 12, 18, 30, 60], rest: 'two thirds' },
      { w: 'a quarter of', n: 1, d: 4, A: [12, 24, 36, 60], rest: 'three quarters' },
      { w: 'two thirds of', n: 2, d: 3, A: [3, 6, 9, 12, 15], rest: 'one third' },
      { w: 'three quarters of', n: 3, d: 4, A: [4, 8, 12, 20], rest: 'one quarter' }
    ]);
    const A = pick(r, f.A);
    const ans = A * f.d / (f.d - f.n);
    const bait = A * (f.d + f.n) / f.d;
    const s = pick(r, [['book', 'costs', 'price', '€', ''], ['ticket', 'costs', 'price', '€', ''], ['brick', 'weighs', 'weight', '', 'kg']]);
    const amt = function (x) { return s[3] + num(x) + (s[4] ? ' ' + s[4] : ''); };
    return {
      q: 'A ' + s[0] + ' ' + s[1] + ' ' + amt(A) + ' plus ' + f.w + ' its own ' + s[2] + '. What is its full ' + s[2] + '?',
      pre: s[3], suf: s[4], a: ans, baits: [bait],
      why: 'Take away ' + f.w + ' the ' + s[2] + ' and ' + amt(A) + ' is what remains, which is ' + f.rest + ' of it. So the full ' + s[2] + ' is ' + amt(ans) + ', not ' + amt(bait) + '.',
      v: { t: 'selfref', A: A, n: f.n, d: f.d }
    };
  });

  fam('sibling', 1, function (r) {
    const mode = pick(r, ['half', 'twice', 'third']);
    if (mode === 'half') {
      const a = pick(r, [4, 6, 8, 10, 12]), N = pick(r, [30, 40, 50, 60, 70]);
      return { q: 'When I was ' + a + ', my sister was half my age. I am ' + N + ' now. How old is my sister?', suf: 'years old', a: N - a / 2, baits: [N / 2], why: 'Back then the gap was ' + (a / 2) + ' years, and an age gap never changes. ' + N + ' − ' + (a / 2) + ' = ' + (N - a / 2) + '.', v: { t: 'sibling', mode: mode, a: a, N: N } };
    }
    if (mode === 'twice') {
      const a = pick(r, [5, 6, 8, 10]), N = pick(r, [20, 30, 40, 50]);
      return { q: 'When I was ' + a + ', my brother was twice my age. I am ' + N + ' now. How old is my brother?', suf: 'years old', a: N + a, baits: [2 * N], why: 'Back then the gap was ' + a + ' years, and an age gap never changes. ' + N + ' + ' + a + ' = ' + (N + a) + '.', v: { t: 'sibling', mode: mode, a: a, N: N } };
    }
    const a = pick(r, [6, 9, 12]), N = pick(r, [30, 45, 60]);
    return { q: 'When I was ' + a + ', my cousin was a third of my age. I am ' + N + ' now. How old is my cousin?', suf: 'years old', a: N - 2 * a / 3, baits: [N / 3], why: 'Back then the gap was ' + (2 * a / 3) + ' years, and an age gap never changes. ' + N + ' − ' + (2 * a / 3) + ' = ' + (N - 2 * a / 3) + '.', v: { t: 'sibling', mode: mode, a: a, N: N } };
  });

  fam('counting', 1, function (r) {
    const mode = pick(r, ['queue', 'queue', 'pages']);
    if (mode === 'queue') {
      const a = 6 + Math.floor(r() * 20);
      const b = r() < 0.5 ? a : 6 + Math.floor(r() * 20);
      return { q: 'You are ' + ord(a) + ' from the front of a queue and ' + ord(b) + ' from the back. How many people are in the queue?', suf: 'people', a: a + b - 1, baits: [a + b], why: 'Adding ' + a + ' and ' + b + ' counts you twice, so take one off: ' + (a + b - 1) + '.', v: { t: 'counting', mode: mode, a: a, b: b } };
    }
    if (mode === 'pages') {
      const s = 12 + Math.floor(r() * 49), len = pick(r, [15, 20, 25, 30, 40, 50]);
      return { q: 'You read from the top of page ' + s + ' to the bottom of page ' + (s + len) + '. How many pages is that?', suf: 'pages', a: len + 1, baits: [len], why: (s + len) + ' − ' + s + ' = ' + len + ' only counts the steps between pages. You read both end pages, so it is ' + (len + 1) + '.', v: { t: 'counting', mode: mode, s: s, e: s + len } };
    }
    if (mode === 'days') {
      const s = 3 + Math.floor(r() * 10), len = pick(r, [6, 9, 10, 13, 14, 16]);
      return { q: 'A festival runs from the ' + ord(s) + ' to the ' + ord(s + len) + ' of the month, with events on both of those days. How many days does it run?', suf: 'days', a: len + 1, baits: [len], why: (s + len) + ' − ' + s + ' = ' + len + ' counts the nights in between. Counting both end days gives ' + (len + 1) + '.', v: { t: 'counting', mode: mode, s: s, e: s + len } };
    }
    const s = pick(r, [2, 10, 20, 30, 40]), k = pick(r, [10, 15, 20, 25, 30]);
    return { q: 'The houses on one side of a street use even numbers only, from ' + s + ' to ' + (s + 2 * k) + '. How many houses are on that side?', suf: 'houses', a: k + 1, baits: [k, 2 * k], why: 'From ' + s + ' to ' + (s + 2 * k) + ' in twos is ' + k + ' steps, and ' + k + ' steps join ' + (k + 1) + ' houses.', v: { t: 'counting', mode: mode, s: s, e: s + 2 * k } };
  });

  fam('socks', 1, function (r) {
    const mode = pick(r, ['any', 'any', 'specific', 'each']);
    const cols = ['black', 'white', 'grey', 'navy'];
    if (mode === 'any') {
      const c = pick(r, [2, 3, 4]);
      const counts = [];
      for (let i = 0; i < c; i++) counts.push(pick(r, [6, 8, 10, 12]));
      const parts = counts.map(function (n, i) { return n + ' ' + cols[i]; });
      const list = parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] + ' socks';
      return { q: 'A drawer holds ' + list + ', all loose and mixed up. With the light off, how many socks must you pull out to be certain of a matching pair?', suf: 'socks', a: c + 1, baits: [2, Math.max.apply(null, counts) + 1, c], why: 'With ' + c + ' colours, your first ' + c + ' socks could all be different. Sock number ' + (c + 1) + ' has to match one of them.', v: { t: 'socks', mode: mode, counts: counts } };
    }
    const A = pick(r, [6, 8, 10, 12]);
    let B = pick(r, [4, 6, 8, 10]);
    if (B === A) B += 2;
    const list = A + ' black and ' + B + ' white socks';
    if (mode === 'specific') {
      return { q: 'A drawer holds ' + list + ', all loose and mixed up. With the light off, how many socks must you pull out to be certain of a pair of black socks?', suf: 'socks', a: B + 2, baits: [3, 2], why: 'Worst case, you pull out all ' + B + ' white socks first. Only then are the next two certain to be black: ' + B + ' + 2 = ' + (B + 2) + '.', v: { t: 'socks', mode: mode, counts: [A, B] } };
    }
    return { q: 'A drawer holds ' + list + ', all loose and mixed up. With the light off, how many socks must you pull out to be certain of holding at least one of each colour?', suf: 'socks', a: Math.max(A, B) + 1, baits: [2, 3], why: 'Worst case, you draw every sock of the bigger colour first: ' + Math.max(A, B) + '. The next one has to be the other colour.', v: { t: 'socks', mode: mode, counts: [A, B] } };
  });

  fam('order', 1, function (r) {
    const mode = pick(r, ['plus', 'zero', 'div', 'mid']);
    if (mode === 'plus') {
      const a = 2 + Math.floor(r() * 8), b = 2 + Math.floor(r() * 8), c = 2 + Math.floor(r() * 8);
      return { q: 'Work it out: ' + a + ' + ' + b + ' × ' + c, expr: a + '+' + b + '*' + c, a: a + b * c, baits: [(a + b) * c], why: 'Multiplying comes before adding. ' + b + ' × ' + c + ' = ' + (b * c) + ', then add ' + a + '.', v: { t: 'order' } };
    }
    if (mode === 'zero') {
      const a = pick(r, [20, 30, 40, 50, 60]), b = pick(r, [5, 10, 20]), c = 3 + Math.floor(r() * 7);
      return { q: 'Work it out: ' + a + ' − ' + b + ' × 0 + ' + c, expr: a + '-' + b + '*0+' + c, a: a + c, baits: [c, 0], why: 'Only the ' + b + ' is multiplied by zero. That leaves ' + a + ' − 0 + ' + c + ' = ' + (a + c) + '.', v: { t: 'order' } };
    }
    if (mode === 'div') {
      const a = pick(r, [4, 5, 6, 7, 8, 9, 12]);
      return { q: 'Work it out: ' + a + ' + ' + a + ' ÷ ' + a, expr: a + '+' + a + '/' + a, a: a + 1, baits: [2], why: 'Dividing comes before adding. ' + a + ' ÷ ' + a + ' = 1, then add ' + a + '.', v: { t: 'order' } };
    }
    const a = 3 + Math.floor(r() * 7);
    return { q: 'Work it out: ' + a + ' + ' + a + ' × 0 + ' + a, expr: a + '+' + a + '*0+' + a, a: 2 * a, baits: [a, 0], why: 'Only the middle ' + a + ' is multiplied by zero. That leaves ' + a + ' + 0 + ' + a + ' = ' + (2 * a) + '.', v: { t: 'order' } };
  });

  fam('ratio', 1, function (r) {
    const p = pick(r, [[1, 4], [1, 3], [1, 9], [2, 3], [3, 2], [1, 19], [3, 7], [1, 7], [3, 5]]);
    const a = p[0], b = p[1], ans = a / (a + b) * 100;
    const s = pick(r, [
      'A drink is mixed from ' + a + ' ' + pl(a, 'part', 'parts') + ' cordial to ' + b + ' parts water. What percentage of the drink is cordial?',
      'A paint is mixed from ' + a + ' ' + pl(a, 'part', 'parts') + ' blue to ' + b + ' parts white. What percentage of the mix is blue?',
      'A team wins ' + a + ' ' + pl(a, 'match', 'matches') + ' for every ' + b + ' it loses, with no draws. What percentage of its matches does it win?'
    ]);
    return { q: s, suf: '%', a: ans, baits: [a / b * 100], why: a + ' to ' + b + ' means ' + a + ' out of every ' + (a + b) + ', not ' + a + ' out of ' + b + '. ' + a + ' ÷ ' + (a + b) + ' = ' + num(ans) + '%.', v: { t: 'ratio', a: a, b: b } };
  });

  fam('inverse', 1, function (r) {
    const p = pick(r, [[6, 4, 12], [3, 12, 9], [4, 6, 8], [5, 12, 15], [10, 6, 15], [2, 9, 6], [6, 10, 3], [8, 3, 4], [4, 9, 12], [6, 6, 9]]);
    const n = p[0], d = p[1], m = p[2], ans = n * d / m;
    const s = pick(r, [['painters', 'paint a hall', 'days', 'painter'], ['pumps', 'drain a pool', 'hours', 'pump'], ['chefs', 'prep a banquet', 'hours', 'chef'], ['diggers', 'dig a trench', 'days', 'digger']]);
    return {
      q: n + ' ' + s[0] + ' take ' + d + ' ' + s[2] + ' to ' + s[1] + '. At the same pace, how long would ' + m + ' ' + s[0] + ' take?',
      suf: s[2], a: ans, baits: [d * m / n],
      why: 'The job is ' + (n * d) + ' ' + s[3] + '-' + s[2] + ' of work. Shared between ' + m + ', that is ' + ans + ' ' + s[2] + '. ' + (m > n ? 'More hands means less time, not more.' : 'Fewer hands means more time, not less.'),
      v: { t: 'inverse', n: n, d: d, m: m }
    };
  });

  fam('buysell', 1, function (r) {
    const b = pick(r, [40, 50, 60, 80, 100, 200]), d = pick(r, [5, 10, 20, 50]);
    const s = pick(r, ['a share', 'a bike', 'a concert ticket', 'a vintage jersey']);
    return {
      q: 'You buy ' + s + ' for ' + eur(b) + ', sell it for ' + eur(b + d) + ', buy it back for ' + eur(b + 2 * d) + ' and sell it again for ' + eur(b + 3 * d) + '. What is your total profit?',
      pre: '€', a: 2 * d, baits: [d, 3 * d, 0],
      why: 'These are two separate deals, and each one makes ' + eur(d) + '. Paying more to buy it back is not a loss. It is just the cost of the second deal.',
      v: { t: 'buysell', flows: [-b, b + d, -(b + 2 * d), b + 3 * d] }
    };
  });

  /* ---------- Level 2 ---------- */

  fam('intervals', 2, function (r) {
    const mode = pick(r, ['log', 'clock', 'floors', 'posts', 'pills']);
    if (mode === 'log') {
      const c = pick(r, [2, 3, 4, 5, 6]);
      const p = pick(r, [[2, 4], [2, 6], [3, 6], [2, 8], [3, 9], [4, 8], [2, 10]]);
      const thing = pick(r, ['log', 'plank', 'pipe']);
      const t = c * (p[0] - 1), ans = c * (p[1] - 1);
      return { q: 'Sawing a ' + thing + ' into ' + p[0] + ' pieces takes ' + t + ' minutes. At the same pace, how many minutes does it take to saw one into ' + p[1] + ' pieces?', suf: 'minutes', a: ans, baits: [t * p[1] / p[0]], why: p[0] + ' pieces need ' + (p[0] - 1) + ' ' + pl(p[0] - 1, 'cut', 'cuts') + ', so each cut takes ' + c + ' minutes. ' + p[1] + ' pieces need ' + (p[1] - 1) + ' cuts: ' + ans + ' minutes.', v: { t: 'intervals', mode: mode, a: p[0], b: p[1], time: t } };
    }
    if (mode === 'clock') {
      const g = pick(r, [1, 2, 3]);
      const p = pick(r, [[3, 6], [6, 12], [4, 8], [5, 10], [2, 10], [3, 9], [4, 12]]);
      const t = g * (p[0] - 1), ans = g * (p[1] - 1);
      return { q: 'A clock takes ' + t + ' ' + pl(t, 'second', 'seconds') + ' to strike ' + p[0] + " o'clock. How many seconds does it take to strike " + p[1] + " o'clock?", suf: 'seconds', a: ans, baits: [t * p[1] / p[0]], why: p[0] + ' strikes have ' + (p[0] - 1) + ' ' + pl(p[0] - 1, 'gap', 'gaps') + ' between them, so each gap lasts ' + g + ' ' + pl(g, 'second', 'seconds') + '. ' + p[1] + ' strikes have ' + (p[1] - 1) + ' gaps: ' + ans + ' seconds.', v: { t: 'intervals', mode: mode, a: p[0], b: p[1], time: t } };
    }
    if (mode === 'floors') {
      const s = pick(r, [10, 12, 15, 20]);
      const p = pick(r, [[3, 6], [4, 8], [5, 10], [2, 6], [3, 9], [4, 12]]);
      const t = s * (p[0] - 1), ans = s * (p[1] - 1);
      return { q: 'Climbing the stairs from floor 1 to floor ' + p[0] + ' takes ' + t + ' seconds. At the same pace, how many seconds does it take from floor 1 to floor ' + p[1] + '?', suf: 'seconds', a: ans, baits: [t * p[1] / p[0]], why: 'Floor 1 to floor ' + p[0] + ' is ' + (p[0] - 1) + ' ' + pl(p[0] - 1, 'flight', 'flights') + ', so one flight takes ' + s + ' seconds. Floor 1 to floor ' + p[1] + ' is ' + (p[1] - 1) + ' flights: ' + ans + ' seconds.', v: { t: 'intervals', mode: mode, a: p[0], b: p[1], time: t } };
    }
    if (mode === 'posts') {
      const p = pick(r, [[100, 10], [60, 5], [120, 10], [90, 15], [200, 20], [50, 5], [80, 8]]);
      const gaps = p[0] / p[1];
      return { q: 'A straight fence is ' + p[0] + ' metres long, with a post every ' + p[1] + ' metres and a post at each end. How many posts does it have?', suf: 'posts', a: gaps + 1, baits: [gaps], why: p[0] + ' ÷ ' + p[1] + ' gives ' + gaps + ' gaps, and a row of ' + gaps + ' gaps needs ' + (gaps + 1) + ' posts.', v: { t: 'intervals', mode: mode, L: p[0], g: p[1] } };
    }
    const n = pick(r, [3, 4, 5, 6]), m = pick(r, [15, 20, 30, 45]);
    return { q: 'You have ' + n + ' tablets and take one every ' + m + ' minutes, starting right now. How many minutes from now do you take the last one?', suf: 'minutes', a: (n - 1) * m, baits: [n * m], why: 'The first goes down at minute 0, so ' + n + ' tablets span ' + (n - 1) + ' gaps of ' + m + ' minutes: ' + ((n - 1) * m) + '.', v: { t: 'intervals', mode: mode, n: n, m: m } };
  });

  fam('downup', 2, function (r) {
    const p = pick(r, [10, 20, 30, 40, 50, 60]);
    const ans = p * p / 100;
    const s = pick(r, [
      ['A share price falls ' + p + '% on Monday and rises ' + p + '% on Tuesday. By what percentage is it now below where it started?', true],
      ['A shop cuts a price by ' + p + '%, then raises the new price by ' + p + '%. By what percentage is it now below the original price?', true],
      ['Your follower count drops ' + p + '% one month and grows ' + p + '% the next. By what percentage are you below where you started?', true],
      ['A house price rises ' + p + '% one year and falls ' + p + '% the next. By what percentage is it now below where it started?', false]
    ]);
    const why = s[1]
      ? 'Start at 100. A ' + p + '% fall leaves ' + (100 - p) + '. A ' + p + '% rise on ' + (100 - p) + ' only adds ' + num(p * (100 - p) / 100) + ', so you finish on ' + num(100 - ans) + '.'
      : 'Start at 100. A ' + p + '% rise makes ' + (100 + p) + '. A ' + p + '% fall on ' + (100 + p) + ' removes ' + num(p * (100 + p) / 100) + ', so you finish on ' + num(100 - ans) + '.';
    return { q: s[0], suf: '%', a: ans, baits: [0], why: why, v: { t: 'downup', p: p, fallFirst: s[1] } };
  });

  fam('reverse', 2, function (r) {
    if (r() < 0.5) {
      const p = pick(r, [[25, 20], [100, 50], [150, 60], [300, 75], [400, 80], [900, 90]]);
      const q = pick(r, [
        'A shop raises a price by ' + p[0] + '%. What percentage discount on the new price brings it back to the original?',
        'A share rises ' + p[0] + '%. What percentage fall from there wipes out the whole gain?'
      ]);
      return { q: q, suf: '%', a: p[1], baits: [p[0]], why: '100 becomes ' + (100 + p[0]) + '. Getting back means removing ' + p[0] + ', and ' + p[0] + ' is ' + p[1] + '% of ' + (100 + p[0]) + '.', v: { t: 'reverse', up: true, p: p[0] } };
    }
    const p = pick(r, [[20, 25], [50, 100], [60, 150], [75, 300], [80, 400], [90, 900]]);
    const q = pick(r, [
      'Your pay is cut by ' + p[0] + '%. What percentage raise on the new pay gets you back to where you were?',
      'A share falls ' + p[0] + '%. What percentage rise does it need to get back to where it started?'
    ]);
    return { q: q, suf: '%', a: p[1], baits: [p[0]], why: '100 becomes ' + (100 - p[0]) + '. Getting back means adding ' + p[0] + ', and ' + p[0] + ' is ' + p[1] + '% of ' + (100 - p[0]) + '.', v: { t: 'reverse', up: false, p: p[0] } };
  });

  fam('compound', 2, function (r) {
    const mode = pick(r, ['discount', 'growth']);
    if (mode === 'discount') {
      const p = pick(r, [[20, 20], [10, 10], [50, 50], [30, 30], [20, 50], [10, 20], [40, 50], [25, 20], [50, 20], [30, 10], [40, 25], [50, 10], [20, 10]]);
      const left = (100 - p[0]) * (100 - p[1]) / 100;
      return { q: 'A jacket is ' + p[0] + '% off in the sale. At the till, a further ' + p[1] + '% comes off the sale price. What is the total discount on the original price?', suf: '%', a: 100 - left, baits: [p[0] + p[1]], why: 'On a €100 jacket, ' + p[0] + '% off leaves €' + (100 - p[0]) + '. Then ' + p[1] + '% off that leaves €' + num(left) + '. The total discount is ' + num(100 - left) + '%, not ' + (p[0] + p[1]) + '%.', v: { t: 'compound', mode: mode, p: p[0], q: p[1] } };
    }
    if (mode === 'growth') {
      const p = pick(r, [10, 20, 30, 40, 50, 100]);
      const ans = 2 * p + p * p / 100;
      const q = pick(r, [
        "A town's population grows " + p + '% a year for two years running. By what percentage has it grown in total?',
        "A startup's revenue grows " + p + '% a year for two years running. By what percentage has it grown in total?',
        'Your savings grow ' + p + '% a year for two years running. By what percentage have they grown in total?'
      ]);
      return { q: q, suf: '%', a: ans, baits: [2 * p], why: '100 becomes ' + (100 + p) + ' after year one. Year two adds ' + p + '% of ' + (100 + p) + ', which is ' + num(p * (100 + p) / 100) + '. Total growth: ' + num(ans) + '%.', v: { t: 'compound', mode: mode, p: p } };
    }
    const P = pick(r, [100, 200, 400]);
    const p = pick(r, [[50, 20], [20, 20], [10, 10], [25, 20], [50, 10], [30, 10], [40, 25], [20, 10], [20, 50]]);
    const ans = P * (100 - p[0]) * (100 - p[1]) / 10000;
    return { q: 'A ' + eur(P) + ' coat is ' + p[0] + '% off in the sale. A voucher takes a further ' + p[1] + '% off the sale price. What do you pay?', pre: '€', a: ans, baits: [P * (100 - p[0] - p[1]) / 100], why: p[0] + '% off ' + eur(P) + ' is ' + eur(P * (100 - p[0]) / 100) + '. The ' + p[1] + '% comes off that, not off the original: ' + eur(ans) + '.', v: { t: 'compound', mode: mode, P: P, p: p[0], q: p[1] } };
  });

  fam('snail', 2, function (r) {
    const p = pick(r, [[10, 3, 2], [20, 5, 4], [12, 4, 2], [15, 3, 2], [18, 4, 2], [30, 5, 3], [24, 6, 4], [16, 4, 3], [21, 6, 3], [28, 8, 4]]);
    const h = p[0], u = p[1], d = p[2];
    let day = 0, pos = 0;
    for (;;) { day++; pos += u; if (pos >= h) break; pos -= d; }
    const s = pick(r, [['A snail sits at the bottom of a ' + h + ' m well', 'it climbs', 'it slips back'], ['A frog sits at the bottom of a ' + h + ' m pit', 'it jumps up', 'it slides back'], ['A beetle starts at the foot of a ' + h + ' m wall', 'it climbs', 'it slides back']]);
    return {
      q: s[0] + '. Each day ' + s[1] + ' ' + u + ' m, and each night ' + s[2] + ' ' + d + ' m. On which day does it reach the top?',
      pre: 'Day ', a: day, baits: [h / (u - d)],
      why: 'It gains ' + (u - d) + ' m per full day, but on the last day it gets out before it can slip. After ' + (day - 1) + ' days it sits at ' + ((day - 1) * (u - d)) + ' m, and the next ' + u + ' m takes it over the top.',
      v: { t: 'snail', h: h, u: u, d: d }
    };
  });

  fam('matches', 2, function (r) {
    const mode = pick(r, ['shake', 'knockout', 'league', 'reverse']);
    if (mode === 'shake') {
      const n = pick(r, [5, 6, 7, 8, 9, 10, 12]);
      return { q: n + ' people meet, and each shakes hands once with every other person. How many handshakes is that?', suf: 'handshakes', a: n * (n - 1) / 2, baits: [n * (n - 1), n * n], why: 'Each of the ' + n + ' shakes ' + (n - 1) + ' hands, but that counts every handshake twice. ' + n + ' × ' + (n - 1) + ' ÷ 2 = ' + (n * (n - 1) / 2) + '.', v: { t: 'matches', mode: mode, n: n } };
    }
    if (mode === 'reverse') {
      const p = pick(r, [[15, 6], [21, 7], [28, 8], [45, 10], [66, 12]]);
      return { q: 'Everyone at a party shook hands once with everyone else. There were ' + p[0] + ' handshakes in total. How many people were at the party?', suf: 'people', a: p[1], baits: [p[0], Math.round(p[0] / 2)], why: p[1] + ' people each shake ' + (p[1] - 1) + ' hands, and every handshake is shared by two people: ' + p[1] + ' \u00D7 ' + (p[1] - 1) + ' \u00F7 2 = ' + p[0] + '.', v: { t: 'matches', mode: mode, n: p[1], H: p[0] } };
    }
    if (mode === 'knockout') {
      const n = pick(r, [16, 32, 64, 128, 20, 37, 50, 100]);
      return { q: n + ' players enter a knockout tournament: lose once and you are out. How many matches are played to find the winner?', suf: 'matches', a: n - 1, baits: [n / 2, n], why: 'Every match knocks out exactly one player, and ' + (n - 1) + ' players have to be knocked out.', v: { t: 'matches', mode: mode, n: n } };
    }
    const n = pick(r, [6, 8, 10, 12, 20]);
    return { q: n + ' teams are in a league. Each plays every other team twice, once at home and once away. How many matches are in the season?', suf: 'matches', a: n * (n - 1), baits: [n * (n - 1) / 2, n * n, 2 * n], why: 'Each team hosts every other team once: ' + n + ' × ' + (n - 1) + ' = ' + (n * (n - 1)) + ' matches.', v: { t: 'matches', mode: mode, n: n } };
  });

  fam('growth', 2, function (r) {
    if (r() < 0.55) {
      const y = pick(r, [5, 6, 7, 8, 10]), k = pick(r, [3, 4, 5]), P = pick(r, [100, 500, 1000, 2000]);
      const chain = []; for (let i = 0; i <= k; i++) chain.push(eur(P * Math.pow(2, i)));
      return { q: 'An investment doubles in value every ' + y + ' years. What is ' + eur(P) + ' worth after ' + (k * y) + ' years?', pre: '€', a: P * Math.pow(2, k), baits: [P * k, P * 2 * k], why: (k * y) + ' years is ' + k + ' doublings: ' + chain.join(' → ') + '. That is ' + Math.pow(2, k) + ' times the start, not ' + (2 * k) + ' times.', v: { t: 'growth', up: true, P: P, k: k } };
    }
    const y = pick(r, [2, 3, 4]), k = pick(r, [2, 3]), P = pick(r, [8000, 16000, 24000, 32000, 40000]);
    const chain = []; for (let i = 0; i <= k; i++) chain.push(eur(P / Math.pow(2, i)));
    return { q: 'A car loses half its value every ' + y + ' years. It cost ' + eur(P) + ' new. What is it worth after ' + (k * y) + ' years?', pre: '€', a: P / Math.pow(2, k), baits: [0, P / (2 * k)], why: 'Each halving takes half of what is left, not half of the original: ' + chain.join(' → ') + '.', v: { t: 'growth', up: false, P: P, k: k } };
  });

  fam('coins', 2, function (r) {
    const mode = pick(r, ['gambler', 'atleast', 'match', 'match']);
    if (mode === 'gambler') {
      const n = pick(r, [4, 5, 6, 8, 10]);
      return { q: 'A fair coin lands heads ' + n + ' times in a row. What is the percentage chance that the next flip is heads?', suf: '%', a: 50, baits: [], baitBelow: 50, baitLabel: 'anything under 50%', why: 'The coin has no memory. Every flip is 50%, whatever came before it.', v: { t: 'coins', mode: mode } };
    }
    if (mode === 'atleast') {
      const n = pick(r, [2, 3]);
      const ans = 100 - 100 / Math.pow(2, n);
      return { q: 'You flip ' + (n === 2 ? 'two' : 'three') + ' fair coins. What is the percentage chance that at least one lands heads?', suf: '%', a: ans, baits: n === 2 ? [50, 100] : [50, 100, 75], why: 'The only way to miss is all tails, which is 1 chance in ' + Math.pow(2, n) + '. Everything else has a head in it: ' + num(ans) + '%.', v: { t: 'coins', mode: mode, n: n } };
    }
    const s = pick(r, [['You roll two dice', 'they show the same number', 6], ['Two friends each secretly pick a day of the week at random', 'they pick the same day', 7], ['Two people each pick a whole number from 1 to 10 at random', 'they pick the same number', 10], ['Two people each pick a card suit at random', 'they pick the same suit', 4], ['Two people each pick a month of the year at random', 'they pick the same month', 12], ['Two people play rock, paper, scissors, each choosing at random', 'they pick the same shape', 3], ['Two people each pick a letter from A to E at random', 'they pick the same letter', 5]]);
    return { q: s[0] + '. The chance that ' + s[1] + ' is 1 in what?', pre: '1 in ', a: s[2], baits: [s[2] * s[2]], why: 'Whatever the first one is, the second has a 1 in ' + s[2] + ' chance of matching it. 1 in ' + (s[2] * s[2]) + ' is the chance of both landing on one value named in advance.', v: { t: 'coins', mode: mode, n: s[2] } };
  });

  fam('avgneeded', 2, function (r) {
    if (r() < 0.65) {
      const p = pick(r, [[80, 4, 84], [70, 3, 75], [60, 4, 65], [50, 9, 55], [70, 4, 72], [60, 3, 70], [40, 4, 50], [65, 4, 70], [82, 4, 85], [75, 3, 80]]);
      const ans = p[2] * (p[1] + 1) - p[0] * p[1];
      return { q: 'You have averaged ' + p[0] + '% across ' + p[1] + ' tests. What must you score on the next test to bring your average up to ' + p[2] + '%?', suf: '%', a: ans, baits: [2 * p[2] - p[0]], why: 'An average of ' + p[2] + ' over ' + (p[1] + 1) + ' tests needs ' + (p[2] * (p[1] + 1)) + ' marks in total. You have ' + (p[0] * p[1]) + ' so far, so the next one must be ' + ans + '.', v: { t: 'avgneeded', a: p[0], n: p[1], A: p[2] } };
    }
    const p = pick(r, [[20, 4, 22], [10, 9, 11], [15, 5, 16], [12, 3, 14], [18, 5, 20]]);
    const ans = p[2] * (p[1] + 1) - p[0] * p[1];
    return { q: 'A player has averaged ' + p[0] + ' points over ' + p[1] + ' games. How many points does she need in the next game to lift her average to ' + p[2] + '?', suf: 'points', a: ans, baits: [2 * p[2] - p[0]], why: 'An average of ' + p[2] + ' over ' + (p[1] + 1) + ' games needs ' + (p[2] * (p[1] + 1)) + ' points in total. She has ' + (p[0] * p[1]) + ' so far, so the next game must be ' + ans + '.', v: { t: 'avgneeded', a: p[0], n: p[1], A: p[2] } };
  });

  fam('scaling', 2, function (r) {
    const mode = pick(r, ['pizza', 'square', 'cube']);
    if (mode === 'pizza') {
      const p = pick(r, [[6, 2], [5, 3], [8, 2], [4, 3], [6, 3], [5, 4], [7, 2]]);
      return { q: 'One ' + (p[0] * p[1]) + '-inch pizza has the same amount of pizza as how many ' + p[0] + '-inch pizzas of the same thickness?', suf: 'pizzas', a: p[1] * p[1], baits: [p[1]], why: 'Area grows with the square of the width. ' + p[1] + ' times as wide means ' + (p[1] * p[1]) + ' times the pizza.', v: { t: 'scaling', mode: mode, k: p[1], s: p[0] } };
    }
    if (mode === 'square') {
      const k = pick(r, [2, 3, 4, 5, 10]);
      const word = k === 2 ? 'twice' : k === 3 ? 'three times' : k + ' times';
      return { q: 'You make every side of a square garden ' + word + ' as long. The new area is how many times the old area?', suf: 'times', a: k * k, baits: [k], why: 'Both the length and the width grow ' + k + '-fold, so the area grows ' + k + ' × ' + k + ' = ' + (k * k) + '-fold.', v: { t: 'scaling', mode: mode, k: k } };
    }
    const V = pick(r, [10, 50, 100, 125, 200]), k = pick(r, [2, 3]);
    return { q: 'A cube-shaped tank holds ' + V + ' litres. How many litres does a tank hold if every edge is ' + (k === 2 ? 'twice' : 'three times') + ' as long?', suf: 'litres', a: V * k * k * k, baits: [V * k, V * k * k], why: 'Length, width and height each grow ' + k + '-fold, so the volume grows ' + k + ' × ' + k + ' × ' + k + ' = ' + (k * k * k) + '-fold.', v: { t: 'scaling', mode: mode, k: k, V: V } };
  });

  fam('markup', 2, function (r) {
    const item = pick(r, ['jacket', 'lamp', 'bike', 'pair of boots']);
    if (r() < 0.5) {
      const p = pick(r, [[80, 100], [40, 50], [50, 100], [20, 25], [60, 75], [40, 100], [25, 100], [50, 75]]);
      const ans = (p[1] - p[0]) / p[0] * 100, bait = (p[1] - p[0]) / p[1] * 100;
      return { q: 'A shop buys a ' + item + ' for ' + eur(p[0]) + ' and sells it for ' + eur(p[1]) + '. What is its profit as a percentage of the cost?', suf: '%', a: ans, baits: [bait], why: 'The profit is ' + eur(p[1] - p[0]) + '. Against the ' + eur(p[0]) + ' cost that is ' + num(ans) + '%. Measured against the selling price it would be ' + num(bait) + '%.', v: { t: 'markup', cost: p[0], price: p[1], ofCost: true } };
    }
    const p = pick(r, [[80, 100], [50, 100], [60, 100], [75, 100], [40, 50], [30, 50], [150, 200]]);
    const ans = (p[1] - p[0]) / p[1] * 100, bait = (p[1] - p[0]) / p[0] * 100;
    return { q: 'A shop buys a ' + item + ' for ' + eur(p[0]) + ' and sells it for ' + eur(p[1]) + '. What is its profit as a percentage of the selling price?', suf: '%', a: ans, baits: [bait], why: 'The profit is ' + eur(p[1] - p[0]) + '. Against the ' + eur(p[1]) + ' selling price that is ' + num(ans) + '%. Measured against the cost it would be ' + num(bait) + '%.', v: { t: 'markup', cost: p[0], price: p[1], ofCost: false } };
  });

  fam('vat', 2, function (r) {
    const rr = pick(r, [20, 25, 10, 50]);
    const net = pick(r, rr === 20 ? [50, 100, 200, 250, 400] : rr === 25 ? [40, 80, 100, 200, 400] : rr === 10 ? [100, 200, 300, 500] : [100, 200, 40]);
    const G = net * (100 + rr) / 100, bait = G * (100 - rr) / 100;
    const q = pick(r, [
      'A price of ' + eur(G) + ' includes ' + rr + '% tax. What is the price before tax?',
      'A restaurant bill of ' + eur(G) + ' includes a ' + rr + '% service charge. What was the bill before the charge?'
    ]);
    return { q: q, pre: '€', a: net, baits: [bait], why: eur(G) + ' is ' + (100 + rr) + '% of the original, so divide by ' + num(1 + rr / 100) + ' to get ' + eur(net) + '. Knocking ' + rr + '% off ' + eur(G) + ' gives ' + eur(bait) + ', which is too low.', v: { t: 'vat', G: G, r: rr } };
  });

  fam('till', 2, function (r) {
    const S = pick(r, [100, 50, 200, 20]);
    const G = pick(r, S === 100 ? [55, 60, 65, 70, 75, 80, 85] : S === 50 ? [20, 25, 30, 35, 40] : S === 200 ? [120, 130, 150, 170] : [8, 12, 15]);
    return {
      q: 'A thief takes a ' + eur(S) + " note from a shop's till. Later he uses that same note to buy " + eur(G) + ' of goods in the shop and gets ' + eur(S - G) + ' change. How much is the shop down overall?',
      pre: '€', a: S, baits: [S + (S - G), S + G, 2 * S, G],
      why: 'The purchase is a fair swap, so ignore it. The shop is down exactly what was taken: ' + eur(S) + ', now in the form of ' + eur(G) + ' of goods and ' + eur(S - G) + ' of change.',
      v: { t: 'till', S: S, G: G }
    };
  });

  fam('pctpoints', 2, function (r) {
    const p = pick(r, [[2, 3], [4, 5], [1, 2], [5, 6], [2, 5], [10, 12], [4, 6], [20, 25], [8, 10], [50, 60], [40, 50], [10, 15]]);
    const ans = (p[1] - p[0]) / p[0] * 100;
    const q = pick(r, [
      'A bank raises its interest rate from ' + p[0] + '% to ' + p[1] + '%. By what percentage has the rate itself gone up?',
      "A shop's profit margin rises from " + p[0] + '% to ' + p[1] + '%. By what percentage has the margin grown?',
      'The share of customers who leave a tip rises from ' + p[0] + '% to ' + p[1] + '%. By what percentage has that share increased?'
    ]);
    return { q: q, suf: '%', a: ans, baits: [p[1] - p[0]], why: 'It rose by ' + (p[1] - p[0]) + ' percentage ' + pl(p[1] - p[0], 'point', 'points') + '. But ' + (p[1] - p[0]) + ' on a base of ' + p[0] + ' is a ' + num(ans) + '% increase.', v: { t: 'pctpoints', f: p[0], to: p[1] } };
  });

  fam('offers', 2, function (r) {
    const o = pick(r, [
      { o: 'Buy one, get one free', got: 2, paid: 1, bait: 100, why: 'You carry out two and pay for one: half price overall. 100% off only describes the second item.' },
      { o: 'Buy one, get one half price', got: 2, paid: 1.5, bait: 50, why: 'You pay 1.5 prices for 2 items. That is 75% of full price, so 25% off.' },
      { o: 'Buy three, get one free', got: 4, paid: 3, bait: 100 / 3, why: 'You get 4 items for the price of 3: one quarter off. One third is the saving measured against what you paid.' },
      { o: 'Buy four, get one free', got: 5, paid: 4, bait: 25, why: 'You get 5 items for the price of 4: one fifth off. One quarter is the saving measured against what you paid.' },
      { o: 'Buy nine, get the tenth free', got: 10, paid: 9, bait: 100 / 9, why: 'You get 10 items for the price of 9: exactly one tenth off.' },
      { o: 'Buy one, get the second for a quarter of the price', got: 2, paid: 1.25, bait: 75, why: 'You pay 1.25 prices for 2 items. That is 62.5% of full price, so 37.5% off.' },
      { o: 'Five for the price of four', got: 5, paid: 4, bait: 25, why: 'You carry out 5 and pay for 4: one fifth off. One quarter is the saving measured against what you paid.' },
      { o: 'Four for the price of three', got: 4, paid: 3, bait: 100 / 3, why: 'You carry out 4 and pay for 3: one quarter off. One third is the saving measured against what you paid.' },
      { o: 'Two for the price of one', got: 2, paid: 1, bait: 100, why: 'You carry out two and pay for one: half price overall. 100% off only describes the second item.' }
    ]);
    return { q: 'A shop offers “' + o.o + '” on identical items. If you take the full offer, what percentage discount is that on everything you carry out?', suf: '%', a: (1 - o.paid / o.got) * 100, baits: [o.bait], why: o.why, v: { t: 'offers', got: o.got, paid: o.paid } };
  });

  /* ---------- Level 3 ---------- */

  fam('dilution', 3, function (r) {
    const V = [[100, 99, 98], [200, 99, 98], [100, 98, 96], [100, 95, 90], [100, 90, 80], [100, 90, 75], [50, 98, 96], [100, 99, 95], [100, 99, 90], [100, 98, 95], [100, 95, 80], [100, 80, 75], [100, 60, 50], [100, 70, 50], [100, 90, 50], [100, 96, 92], [200, 98, 96]];
    const p = pick(r, V);
    const N = p[0], P = p[1], Q = p[2];
    const m = N * (100 - P) / 100, remain = m * 100 / (100 - Q), leave = N - remain;
    if (r() < 0.6) {
      const s = pick(r, [['people', 'in a room', 'are right-handed', 'right-handed people'], ['fans', 'in a stand', 'support the home team', 'home fans'], ['guests', 'at a party', 'are wearing black', 'guests in black']]);
      const bait = N * (P - Q) / 100;
      return {
        q: N + ' ' + s[0] + ' are ' + s[1] + ' and ' + P + '% of them ' + s[2] + '. How many ' + s[3] + ' must leave so that exactly ' + Q + '% of those still there ' + s[2] + '?',
        suf: s[0], a: leave, baits: [bait],
        why: 'The other ' + m + ' never leave. For them to be ' + (100 - Q) + '% of the group, the group must shrink to ' + remain + '. So ' + leave + ' must go, not ' + bait + '.',
        v: { t: 'dilution', mode: 'leave', N: N, P: P, Q: Q }
      };
    }
    const item = pick(r, ['tomatoes', 'mushrooms', 'grapes', 'watermelons']);
    const bait = N - N * (P - Q) / 100;
    return {
      q: 'A crate of ' + item + ' weighs ' + N + ' kg and is ' + P + '% water. It dries out until it is ' + Q + '% water. How much does it weigh now?',
      suf: 'kg', a: remain, baits: [bait],
      why: 'The dry part weighs ' + m + ' kg and does not change. If that is now ' + (100 - Q) + '% of the total, the total is ' + remain + ' kg, not ' + bait + ' kg.',
      v: { t: 'dilution', mode: 'weigh', N: N, P: P, Q: Q }
    };
  });

  fam('speed', 3, function (r) {
    if (r() < 0.5) {
      const p = pick(r, [[30, 60], [20, 30], [40, 60], [12, 4], [10, 15], [60, 120], [30, 45], [40, 120], [20, 60], [6, 3]]);
      const a = p[0], b = p[1], ans = 2 * a * b / (a + b), L = lcm(a, b);
      return {
        q: 'You travel to a town at ' + a + ' km/h and come back along the same road at ' + b + ' km/h. What is your average speed for the whole trip?',
        suf: 'km/h', a: ans, baits: [(a + b) / 2],
        why: 'Make the road ' + L + ' km. Out takes ' + (L / a) + ' h and back takes ' + (L / b) + ' h, so ' + (2 * L) + ' km takes ' + (L / a + L / b) + ' h. You spend longer at the slower speed, which drags the average below ' + num((a + b) / 2) + '.',
        v: { t: 'speed', mode: 'avg', a: a, b: b }
      };
    }
    const p = pick(r, [[30, 40, 60], [20, 24, 30], [40, 48, 60], [20, 30, 60], [60, 80, 120], [30, 36, 45], [10, 12, 15], [40, 60, 120]]);
    const a = p[0], T = p[1], ans = p[2], L = lcm(a, ans);
    return {
      q: 'You cover the first half of a route at ' + a + ' km/h. How fast must you cover the second half, which is the same distance, to average ' + T + ' km/h for the whole route?',
      suf: 'km/h', a: ans, baits: [2 * T - a],
      why: 'Make each half ' + L + ' km. Averaging ' + T + ' km/h means ' + (2 * L / T) + ' h in total. The first half used ' + (L / a) + ' h, leaving ' + (2 * L / T - L / a) + ' h for the last ' + L + ' km.',
      v: { t: 'speed', mode: 'need', a: a, T: T }
    };
  });

  fam('winrate', 3, function (r) {
    const p = pick(r, [[8, 20, 50], [6, 20, 50], [12, 30, 50], [9, 30, 50], [4, 10, 50], [3, 10, 50], [16, 40, 50], [18, 40, 50], [7, 20, 50], [12, 20, 75], [14, 20, 75], [24, 40, 75], [10, 20, 75], [27, 40, 75], [14, 20, 80], [12, 20, 80], [15, 20, 80], [30, 40, 80], [28, 40, 80], [16, 20, 90], [17, 20, 90], [34, 40, 90]]);
    const w = p[0], g = p[1], T = p[2];
    const x = (T * g - 100 * w) / (100 - T), bait = T * g / 100 - w;
    const s = pick(r, [
      ['A team has won ' + w + ' of its ' + g + ' matches. How many matches in a row must it now win to reach a ' + T + '% win rate?', 'wins'],
      ['A basketball player has made ' + w + ' of ' + g + ' free throws. How many must she now make in a row to be shooting ' + T + '%?', 'in a row'],
      ['You have passed ' + w + ' of ' + g + ' weekly quizzes. How many must you now pass in a row to reach a ' + T + '% pass rate?', 'in a row']
    ]);
    return { q: s[0], suf: s[1], a: x, baits: [bait], why: 'After ' + x + ' more, the record is ' + (w + x) + ' out of ' + (g + x) + ', which is exactly ' + T + '%. Every success also adds an attempt, so ' + bait + ' is not enough.', v: { t: 'winrate', w: w, g: g, T: T } };
  });

  fam('fly', 3, function (r) {
    const p = pick(r, [[100, 50, 75], [120, 30, 40], [200, 50, 80], [90, 45, 60], [150, 25, 40], [240, 60, 90], [60, 30, 50], [80, 20, 30], [180, 45, 70], [300, 50, 80], [160, 40, 55], [120, 60, 100]]);
    const d = p[0], v = p[1], f = p[2], hrs = d / (2 * v), ans = f * hrs;
    const s = pick(r, [['Two trains start ' + d + ' km apart and head towards each other at ' + v + ' km/h each. A fly zips back and forth between them at ' + f + ' km/h until they meet. How far does the fly travel?', 'fly'], ['Two cyclists start ' + d + ' km apart and ride towards each other at ' + v + ' km/h each. A dog runs back and forth between them at ' + f + ' km/h until they meet. How far does the dog run?', 'dog']]);
    return { q: s[0], suf: 'km', a: ans, baits: [d, d / 2], why: 'Forget the zigzags. The gap closes at ' + (2 * v) + ' km/h, so they meet after ' + hrs + ' ' + pl(hrs, 'hour', 'hours') + '. The ' + s[1] + ' moves at ' + f + ' km/h for that whole time: ' + ans + ' km.', v: { t: 'fly', d: d, v: v, f: f } };
  });

  fam('clock', 3, function (r) {
    if (r() < 0.3) {
      const H = pick(r, [12, 24]);
      return { q: 'How many times do the hour hand and the minute hand of a clock sit exactly on top of each other in ' + H + ' hours?', suf: 'times', a: 11 * H / 12, baits: [H, H + 1], why: 'The minute hand catches the hour hand once every 65 and a bit minutes, not once an hour. That fits 11 times into every 12 hours.', v: { t: 'clock', mode: 'overlap', H: H } };
    }
    const p = pick(r, [[3, 15], [6, 30], [9, 45], [12, 15], [3, 30], [12, 30], [9, 15], [6, 15], [2, 10], [4, 20], [1, 5], [5, 25], [8, 40], [10, 50]]);
    const h = p[0], m = p[1];
    const base = (30 * h) % 360, hourA = base + m / 2, minA = 6 * m;
    const sm = function (x) { x = Math.abs(x) % 360; return Math.min(x, 360 - x); };
    const ans = sm(hourA - minA), bait = sm(base - minA);
    return {
      q: 'What is the angle between the hour hand and the minute hand of a clock at exactly ' + h + ':' + (m < 10 ? '0' + m : m) + '? Give the smaller angle.',
      suf: '°', a: ans, baits: [bait],
      why: 'The minute hand points at ' + minA + '°. The hour hand is not sitting on the ' + h + ': after ' + m + ' minutes it has crept ' + num(m / 2) + '° past it, to ' + num(hourA) + '°. The gap is ' + num(ans) + '°.',
      v: { t: 'clock', h: h, m: m }
    };
  });

  fam('weighted', 3, function (r) {
    if (r() < 0.6) {
      const p = pick(r, [[20, 60, 30, 70], [10, 50, 30, 70], [10, 80, 40, 60], [25, 60, 75, 80], [10, 40, 90, 80], [30, 50, 10, 70], [20, 90, 80, 70], [40, 55, 10, 80], [15, 90, 45, 70], [30, 80, 20, 60]]);
      const tot = p[0] * p[1] + p[2] * p[3], ans = tot / (p[0] + p[2]);
      return { q: 'A class of ' + p[0] + ' students averages ' + p[1] + '% on a test. Another class of ' + p[2] + ' averages ' + p[3] + '%. What is the average for all ' + (p[0] + p[2]) + ' students?', suf: '%', a: ans, baits: [(p[1] + p[3]) / 2], why: 'The bigger class counts for more. Total marks: ' + p[0] + ' × ' + p[1] + ' + ' + p[2] + ' × ' + p[3] + ' = ' + num(tot) + '. Divide by ' + (p[0] + p[2]) + ' students: ' + num(ans) + '%.', v: { t: 'weighted', n1: p[0], a1: p[1], n2: p[2], a2: p[3] } };
    }
    const p = pick(r, [[1, 20, 3, 28], [2, 15, 3, 25], [1, 30, 4, 20], [1, 10, 2, 25], [3, 10, 1, 30], [2, 12, 1, 24], [4, 15, 1, 25]]);
    const dist = p[0] * p[1] + p[2] * p[3], ans = dist / (p[0] + p[2]);
    return { q: 'You cycle for ' + p[0] + ' ' + pl(p[0], 'hour', 'hours') + ' at ' + p[1] + ' km/h, then for ' + p[2] + ' ' + pl(p[2], 'hour', 'hours') + ' at ' + p[3] + ' km/h. What is your average speed for the whole ride?', suf: 'km/h', a: ans, baits: [(p[1] + p[3]) / 2], why: 'Distance: ' + (p[0] * p[1]) + ' + ' + (p[2] * p[3]) + ' = ' + dist + ' km in ' + (p[0] + p[2]) + ' hours. That is ' + num(ans) + ' km/h, pulled towards the speed you held for longer.', v: { t: 'weighted', n1: p[0], a1: p[1], n2: p[2], a2: p[3] } };
  });

  fam('digits', 3, function (r) {
    const mode = pick(r, ['appear', 'contain', 'sign']);
    const count = function (N, d, distinct) {
      let c = 0;
      for (let i = 1; i <= N; i++) {
        const s = String(i);
        let k = 0;
        for (let j = 0; j < s.length; j++) if (s[j] === String(d)) k++;
        c += distinct ? (k > 0 ? 1 : 0) : k;
      }
      return c;
    };
    if (mode === 'appear') {
      const d = 2 + Math.floor(r() * 8);
      return { q: 'You write out every whole number from 1 to 100. How many times do you write the digit ' + d + '?', suf: 'times', a: count(100, d, false), baits: [10, 11, 19], why: 'It shows up 10 times in the units place (' + d + ', 1' + d + ', 2' + d + ' and so on) and 10 times in the tens place (' + d + '0 to ' + d + '9). The number ' + d + d + ' has it twice.', v: { t: 'digits', mode: mode, N: 100, d: d } };
    }
    if (mode === 'contain') {
      const d = 2 + Math.floor(r() * 8);
      return { q: 'How many whole numbers from 1 to 100 contain the digit ' + d + '?', suf: 'numbers', a: count(100, d, true), baits: [10, 20, 11], why: 'Ten numbers end in ' + d + ' and ten start with ' + d + ' (' + d + '0 to ' + d + '9), but ' + d + d + ' is on both lists. 10 + 10 − 1 = 19.', v: { t: 'digits', mode: mode, N: 100, d: d } };
    }
    const N = pick(r, [50, 60, 80]), d = 1 + Math.floor(r() * 5);
    let u = 0, tens = 0;
    for (let i = 1; i <= N; i++) { if (i % 10 === d) u++; if (Math.floor(i / 10) === d) tens++; }
    return { q: 'A signwriter paints the door numbers 1 to ' + N + ' along a street. How many times does she paint the digit ' + d + '?', suf: 'times', a: u + tens, baits: [u, 10, u + 1], why: 'Units place: ' + u + ' times. Tens place: ' + tens + ' times (' + d + '0 to ' + Math.min(d * 10 + 9, N) + '). Together that is ' + (u + tens) + '.', v: { t: 'digits', mode: mode, N: N, d: d } };
  });

  fam('jointwork', 3, function (r) {
    const p = pick(r, [[6, 3], [10, 15], [12, 6], [20, 30], [4, 12], [10, 40], [30, 15], [20, 5], [6, 30], [12, 24], [9, 18], [15, 30], [12, 4], [3, 6]]);
    const x = p[0], y = p[1], ans = x * y / (x + y);
    const s = pick(r, [
      ['One tap fills a bath in ' + x + ' minutes. A second tap fills it in ' + y + ' minutes. How many minutes does it take with both taps on?', 'minutes', 'minute'],
      ['Ana can paint a fence in ' + x + ' hours. Ben can paint it in ' + y + ' hours. How many hours does it take them working together?', 'hours', 'hour'],
      ['One pump drains a pool in ' + x + ' hours. Another drains it in ' + y + ' hours. How many hours does it take with both running?', 'hours', 'hour']
    ]);
    return { q: s[0], suf: s[1], a: ans, baits: [(x + y) / 2, x + y], why: 'Each ' + s[2] + ', the first does 1/' + x + ' of the job and the second does 1/' + y + '. Together that is 1/' + ans + ' of the job per ' + s[2] + ', so it takes ' + ans + ' ' + s[1] + '. Working together must be quicker than either alone.', v: { t: 'jointwork', x: x, y: y } };
  });

  /* ---------- Added in version 2 ---------- */

  fam('race', 1, function (r, turn) {
    const k = walk(r, turn, [2, 4, 3, 5]);
    return { q: 'You are running a race and you overtake the runner in ' + ord(k) + ' place. What place are you in now?', ordinal: true, a: k, baits: [k - 1], why: 'You take the place of the runner you passed, so you are ' + ord(k) + '. Everyone who was ahead of them is still ahead of you.', v: { t: 'race', k: k } };
  });

  fam('paperfold', 1, function (r) {
    const n = pick(r, [4, 5, 6, 7, 8, 10]);
    return { q: 'You fold a sheet of paper in half, then in half again, and keep going until you have folded it ' + n + ' times. How many layers thick is it?', suf: 'layers', a: Math.pow(2, n), baits: [2 * n, n + 1, n], why: 'Every fold doubles the layers: 2, 4, 8 and so on. After ' + n + ' folds that is ' + num(Math.pow(2, n)) + '.', v: { t: 'paperfold', n: n } };
  });

  fam('pigeon', 1, function (r) {
    const p = pick(r, [['were born in the same month', 12, 'a different month', [2]], ['were born on the same day of the week', 7, 'a different day', [2]], ['share a birthday (ignore leap years)', 365, 'a different birthday', [23, 183]], ['have the same star sign', 12, 'a different star sign', [2]], ['have first names starting with the same letter', 26, 'a different first letter', [2]], ['have phone numbers ending in the same digit', 10, 'a different last digit', [2]]]);
    return { q: 'How many people must be in a room before you can be certain that at least two of them ' + p[0] + '?', suf: 'people', a: p[1] + 1, baits: [p[1]].concat(p[3]), why: 'With ' + p[1] + ' people, every one of them could still have ' + p[2] + '. Person number ' + (p[1] + 1) + ' has to match somebody.', v: { t: 'pigeon', k: p[1] } };
  });

  fam('squares', 2, function (r, turn) {
    const n = walk(r, turn, [3, 4, 2]);
    const parts = []; let tot = 0;
    for (let s = 1; s <= n; s++) { const c = (n - s + 1) * (n - s + 1); tot += c; parts.push(c + ' of size ' + s + '×' + s); }
    return { q: 'A square grid is ' + n + ' small squares wide and ' + n + ' tall. Counting squares of every size, how many squares are in it?', suf: 'squares', a: tot, baits: [n * n, n * n + 1], why: 'Count each size: ' + parts.join(', ') + '. That makes ' + tot + '.', v: { t: 'squares', n: n } };
  });

  fam('monty', 2, function (r, turn) {
    const G = walk(r, turn, [300, 30, 900, 600]);
    return { q: 'A game show has 3 doors. One hides a car, two hide goats. You pick a door. The host, who knows where the car is, opens one of the other two to show a goat, then offers you the switch. If you always switch, how many games out of ' + G + ' would you expect to win?', suf: 'games', a: 2 * G / 3, baits: [G / 2, G / 3], why: 'Your first pick is right 1 time in 3. Every other time, the host has left the car behind the one remaining door, so switching wins 2 times in 3.', v: { t: 'monty', G: G } };
  });

  fam('bookworm', 2, function (r) {
    const P = pick(r, [30, 40, 50]), c = pick(r, [2, 3, 5]);
    return { q: 'Volumes 1 and 2 of an encyclopedia stand side by side on a shelf, in order, spines facing out. In each volume the pages are ' + P + ' mm thick in total and each cover is ' + c + ' mm thick. A bookworm eats in a straight line from the first page of Volume 1 to the last page of Volume 2. How far does it travel?', suf: 'mm', a: 2 * c, baits: [2 * P + 2 * c, 2 * P + 4 * c, P + 2 * c], why: 'On a shelf, the first page of Volume 1 is on its right-hand side, right beside Volume 2. The last page of Volume 2 is on its left-hand side. Only two covers lie between them.', v: { t: 'bookworm', P: P, c: c } };
  });

  fam('stairs', 2, function (r) {
    const n = pick(r, [4, 5, 6, 7, 8]);
    const f = [1, 1]; for (let i = 2; i <= n; i++) f.push(f[i - 1] + f[i - 2]);
    return { q: 'You can climb a staircase one step or two steps at a time. In how many different ways can you climb ' + n + ' steps?', suf: 'ways', a: f[n], baits: [n, 2 * n, Math.pow(2, n - 1)], why: 'Your last move is either a single step or a double. So the count for ' + n + ' steps is the count for ' + (n - 1) + ' plus the count for ' + (n - 2) + ': ' + f[n - 1] + ' + ' + f[n - 2] + ' = ' + f[n] + '.', v: { t: 'stairs', n: n } };
  });

  fam('bridge', 3, function (r) {
    const p = pick(r, [[1, 2, 5, 10], [1, 2, 7, 10], [1, 3, 6, 8], [2, 3, 7, 9], [1, 2, 6, 9]]);
    const a = p[0], b = p[1], c = p[2], d = p[3];
    const escort = 2 * a + b + c + d, pair = a + 3 * b + d;
    return { q: 'Four friends must cross a narrow bridge at night with one torch. At most two can cross at a time, anyone crossing needs the torch, and a pair walks at the pace of the slower one. On their own they take ' + a + ', ' + b + ', ' + c + ' and ' + d + ' minutes. What is the fastest that all four can get across?', suf: 'minutes', a: Math.min(escort, pair), baits: [Math.max(escort, pair)], why: 'Send the two slowest across together. The ' + a + ' and ' + b + ' cross (' + b + '), the ' + a + ' comes back (' + a + '), the ' + c + ' and ' + d + ' cross (' + d + '), the ' + b + ' comes back (' + b + '), then the ' + a + ' and ' + b + ' cross again (' + b + '). Total: ' + pair + '.', v: { t: 'bridge', times: p } };
  });

  fam('lockers', 3, function (r, turn) {
    const N = walk(r, turn, [100, 25, 50]);
    const ans = Math.floor(Math.sqrt(N));
    return { q: N + ' lockers in a row are all closed. Student 1 opens every locker. Student 2 flips every 2nd locker (open ones close, closed ones open). Student 3 flips every 3rd, and so on up to student ' + N + '. How many lockers are open at the end?', suf: 'lockers', a: ans, baits: [Math.floor(N / 2), Math.ceil(N / 2), 1], why: 'A locker gets flipped once for every number that divides it. Only square numbers have an odd count of divisors, so only lockers 1, 4, 9, 16 and so on finish open: ' + ans + ' of them.', v: { t: 'lockers', N: N } };
  });

  fam('balance', 3, function (r, turn) {
    const p = walk(r, turn, [[9, 2, [3, 4]], [27, 3, [4, 5]], [8, 2, [3]], [3, 1, [2]]]);
    return { q: 'You have ' + p[0] + ' coins that look identical, but one is slightly heavier. You have a balance scale with two pans. What is the smallest number of weighings that is certain to find the heavy coin?', suf: pl(p[1], 'weighing', 'weighings'), a: p[1], baits: p[2], why: 'A weighing has three outcomes: left side heavier, right side heavier, or level. So split the coins into three groups, not two. One weighing sorts out 3 coins, two sort out 9, three sort out 27.', v: { t: 'balance', n: p[0] } };
  });

  fam('cube', 3, function (r) {
    const p = pick(r, [[3, 0], [4, 0], [5, 0], [10, 0], [3, 1], [4, 1], [5, 1], [3, 2], [4, 2], [5, 2], [4, 3], [10, 3]]);
    const n = p[0], k = p[1], m = n - 2;
    const ans = [m * m * m, 6 * m * m, 12 * m, 8][k];
    const what = ['no paint on them at all', 'paint on exactly one face', 'paint on exactly two faces', 'paint on exactly three faces'][k];
    const baits = [[0, n * n * n - 6 * n * n, 1], [6, n * n, 6 * n * n], [8, 12, 12 * n], [4, 6, 12]][k];
    const why = [
      'Peel off the painted outer layer and what is left is a cube ' + m + ' along each edge: ' + m + ' × ' + m + ' × ' + m + ' = ' + ans + '.',
      'Each of the 6 faces has a ' + m + ' by ' + m + ' patch in the middle whose cubes show one painted face: 6 × ' + (m * m) + ' = ' + ans + '.',
      'These sit along the 12 edges, leaving out the corners: 12 × ' + m + ' = ' + ans + '.',
      'Only the corner cubes have three painted faces, and a cube has 8 corners whatever its size.'
    ][k];
    return { q: 'A wooden cube is painted red on the outside, then sawn into ' + num(n * n * n) + ' small cubes, ' + n + ' along each edge. How many of the small cubes have ' + what + '?', suf: 'cubes', a: ans, baits: baits, why: why, v: { t: 'cube', n: n, k: k } };
  });

  // One-off classics. Each appears once per pass through the list, in order.
  fam('classic', 3, function (r, turn) {
    const list = [
      { q: 'Three ants sit on the three corners of a triangle. Each one picks one of its two edges at random and walks along it. What is the percentage chance that at least two ants collide?', suf: '%', a: 75, baits: [50, 25], why: 'They only miss each other if all three go clockwise or all three go anticlockwise. That is 2 of the 8 possible combinations, so 6 in 8 end in a collision.', v: { t: 'classic', id: 'ants' } },
      { q: "A rope is wrapped snugly around the Earth's equator, about 40,000 km. You want to lift it so it sits 1 metre above the ground all the way round. How many extra metres of rope do you need, to the nearest metre?", suf: 'metres', a: 6, baits: [], baitAbove: 100, baitLabel: 'hundreds or thousands', why: 'The extra rope is 2 × π × the extra height, which is about 6.28 metres. The size of the Earth cancels out completely.', v: { t: 'classic', id: 'rope' } },
      { q: 'What is 1 + 2 + 3 + … + 100?', a: 5050, baits: [5000, 10000, 1000], why: 'Pair the ends: 1 + 100, 2 + 99, 3 + 98 and so on. That is 50 pairs of 101, which makes 5,050.', v: { t: 'classic', id: 'sum' } },
      { q: 'Two poles, each 50 m tall, stand on flat ground. An 80 m cable hangs between their tops, and at its lowest point it is 10 m above the ground. How far apart are the poles?', suf: 'm', a: 0, baits: [], why: 'The cable drops 40 m from each pole top to its lowest point, and 40 + 40 is the whole 80 m. It hangs straight down and straight back up, so the poles must be touching.', v: { t: 'classic', id: 'cable' } },
      { q: 'How many squares are there on a chessboard, counting squares of every size?', suf: 'squares', a: 204, baits: [64, 65], why: '64 small squares, 49 two-by-two squares, 36 three-by-three, and so on down to the 1 big square: 64 + 49 + 36 + 25 + 16 + 9 + 4 + 1 = 204.', v: { t: 'classic', id: 'chess' } },
      { q: 'A game show has 100 doors, one car and 99 goats. You pick a door. The host, who knows where the car is, opens 98 of the others to show goats and offers you the one door left shut. If you always switch, how many games out of 100 would you expect to win?', suf: 'games', a: 99, baits: [50, 1], why: 'Your first pick is right 1 time in 100. The other 99 times, the car is behind the single door the host chose to leave shut.', v: { t: 'classic', id: 'monty100' } },
      { q: 'A string is tied snugly around a football. You want to lift it so it sits 1 metre off the ball all the way round. How many extra metres of string do you need, to the nearest metre?', suf: 'metres', a: 6, baits: [], why: 'The extra length is 2 × π × the extra height, about 6.28 metres. It is the same answer for a football, the Moon or the Earth.', v: { t: 'classic', id: 'rope' } }
    ];
    const i = typeof turn === 'number' ? turn % list.length : Math.floor(r() * list.length);
    return list[i];
  });

  // Parked: these read like homework, so version 2 leaves them out of every set.
  const PARKED = ['order', 'ratio', 'growth', 'avgneeded', 'markup', 'vat', 'pctpoints', 'offers', 'weighted'];
  const LEVEL = { intervals: 1, jointwork: 2, digits: 2, clock: 2, inverse: 2 };
  for (let i = F.length - 1; i >= 0; i--) {
    if (PARKED.indexOf(F[i].id) >= 0) F.splice(i, 1);
    else if (LEVEL[F[i].id]) F[i].level = LEVEL[F[i].id];
  }

  /* ---------- Sets ---------- */

  const BY = { 1: F.filter(function (f) { return f.level === 1; }), 2: F.filter(function (f) { return f.level === 2; }), 3: F.filter(function (f) { return f.level === 3; }) };
  const PER = { 1: 1, 2: 1, 3: 1 };

  // Each level runs in cycles: every family appears once per cycle, and a family
  // never appears on the last day of one cycle and the first day of the next.
  function cycleOrder(level, target) {
    const fams = BY[level], k = PER[level], days = Math.floor(fams.length / k);
    let prev = null, sh = null;
    for (let c = 0; c <= target; c++) {
      sh = shuffle(rngFrom('cycle-' + level + '-' + c), fams);
      if (prev) {
        for (let tries = 0; tries < days; tries++) {
          const first = sh.slice(0, k);
          if (!first.some(function (f) { return prev.indexOf(f) >= 0; })) break;
          sh = sh.slice(k).concat(first);
        }
      }
      prev = sh.slice((days - 1) * k, days * k);
    }
    return sh;
  }
  function daySlice(level, i) {
    const k = PER[level], days = Math.floor(BY[level].length / k);
    const order = cycleOrder(level, Math.floor(i / days));
    const j = i % days;
    return { fams: order.slice(j * k, j * k + k), turn: Math.floor(i / days) };
  }
  function make(f, seed, turn) {
    const q = f.gen(rngFrom(seed + '-' + f.id), turn);
    q.fam = f.id; q.level = f.level;
    q.a = Math.round(q.a * 1e6) / 1e6;
    q.pre = q.pre || ''; q.suf = q.suf || '';
    q.baits = (q.baits || []).filter(function (b, i, arr) {
      return isFinite(b) && b >= 0 && Math.abs(b - q.a) > 0.006 && arr.indexOf(b) === i;
    });
    return q;
  }
  function buildDaily(day) {
    const i = Math.max(0, day - 1);
    return [1, 2, 3].map(function (level, n) {
      const s = daySlice(level, i);
      return make(s.fams[0], 'daily-' + day + '-' + n, s.turn);
    });
  }
  function buildTable(code, round) {
    const key = 'table-' + code + '-' + round;
    const r = rngFrom(key);
    const fams = [pick(r, BY[1]), pick(r, BY[2]), pick(r, BY[3])];
    return fams.map(function (f, n) { return make(f, key + '-' + n); });
  }

  const EPOCH = Date.UTC(2026, 10, 16); // No. 1 is 16 November 2026, by the player's local date
  function dayNumber(date) {
    const t = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.max(1, Math.round((t - EPOCH) / 86400000) + 1);
  }

  function judge(q, text) {
    const v = parseFloat(text);
    if (text === '' || text === '.' || !isFinite(v)) return 'bad';
    if (Math.abs(v - q.a) <= 0.006) return 'right';
    for (let i = 0; i < q.baits.length; i++) {
      const b = q.baits[i];
      const tol = Math.abs(b - Math.round(b)) < 1e-9 ? 0.006 : 0.5;
      if (Math.abs(v - b) <= tol) return 'bait';
    }
    if (typeof q.baitBelow === 'number' && v < q.baitBelow) return 'bait';
    if (typeof q.baitAbove === 'number' && v > q.baitAbove) return 'bait';
    return v < q.a ? 'low' : 'high';
  }
  function hasBait(q) { return q.baits.length > 0 || typeof q.baitBelow === 'number' || typeof q.baitAbove === 'number'; }
  function show(q, v) {
    if (q.ordinal) return ord(v);
    const tight = q.suf === '%' || q.suf === '°';
    return q.pre + num(v) + (q.suf ? (tight ? '' : ' ') + q.suf : '');
  }

  const api = { families: F, buildDaily: buildDaily, buildTable: buildTable, dayNumber: dayNumber, judge: judge, hasBait: hasBait, show: show, num: num, ord: ord, rngFrom: rngFrom, make: make };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BaitEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
