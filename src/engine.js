/* Not So Fast question engine. No DOM in this file.
   Every question must pass three tests:
   1. Sayable: short enough to ask a friend from memory.
   2. No real calculation: once you see it, the sum is one easy step.
   3. One illusion: a single obvious answer that is wrong, and a click when you see why.
   And one rule of fairness: a minute of thinking must be able to reach the answer. No trivia.

   The three levels are the three slots in a day, aimed at these shares of players getting it right:
   1. the opener, about 7 in 10   2. the coin flip, about 5 in 10   3. the closer, about 3 in 10.
   Those shares are estimates until the live counters say otherwise; each question carries a
   `kind` so real results can be read back per kind and the levels re-sorted. */
(function (root) {
  'use strict';

  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return function () { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
  }
  function mulberry32(a) {
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function rngFrom(str) { return mulberry32(xmur3(str)()); }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function walk(r, turn, list) { return typeof turn === 'number' ? list[turn % list.length] : pick(r, list); }
  function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function num(n) { return (Math.round(n * 100) / 100).toLocaleString('en-GB', { maximumFractionDigits: 2 }); }
  function eur(n) { return '€' + num(n); }
  function cents(c) { return '€' + (c / 100).toFixed(2); }
  function ord(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function pl(n, one, many) { return n === 1 ? one : many; }

  const F = [];
  function fam(id, level, gen) { F.push({ id: id, level: level, gen: gen }); }

  /* ---------- Level 1: the opener. Instant to read, instant to get wrong. ---------- */

  fam('sumdiff', 2, function (r) {
    if (r() < 0.6) {
      const p = pick(r, [['bat', 'ball'], ['burger', 'drink'], ['coffee', 'biscuit'], ['pen', 'pencil'], ['kite', 'string']]);
      const c = pick(r, [5, 10, 15, 20, 25]), total = 100 + 2 * c;
      return { q: 'A ' + p[0] + ' and a ' + p[1] + ' cost ' + cents(total) + '. The ' + p[0] + ' costs €1.00 more than the ' + p[1] + '. How much is the ' + p[1] + '?', suf: 'cents', a: c, baits: [2 * c], why: 'If the ' + p[1] + ' were ' + (2 * c) + ' cents, the ' + p[0] + ' would be ' + cents(100 + 2 * c) + ' and the two would cost ' + cents(100 + 4 * c) + '.', v: { t: 'sumdiff', total: total, diff: 100 } };
    }
    const p = pick(r, [['phone', 'case'], ['bike', 'helmet'], ['laptop', 'mouse'], ['guitar', 'strap']]);
    const D = pick(r, [100, 1000]), c = D === 100 ? pick(r, [5, 10, 20]) : pick(r, [50, 100]), total = D + 2 * c;
    return { q: 'A ' + p[0] + ' and a ' + p[1] + ' cost ' + eur(total) + '. The ' + p[0] + ' costs ' + eur(D) + ' more than the ' + p[1] + '. How much is the ' + p[1] + '?', pre: '€', a: c, baits: [2 * c], why: 'If the ' + p[1] + ' were ' + eur(2 * c) + ', the ' + p[0] + ' would be ' + eur(2 * c + D) + ' and the two would cost ' + eur(4 * c + D) + '.', v: { t: 'sumdiff', total: total, diff: D } };
  });

  fam('race', 1, function (r, turn) {
    const k = walk(r, turn, [2, 3, 4, 5]);
    return { q: 'You overtake the runner in ' + ord(k) + ' place. What place are you in now?', ordinal: true, a: k, baits: [k - 1], why: 'You take their place, so you are ' + ord(k) + '. Everyone ahead of them is still ahead of you.', v: { t: 'race', k: k } };
  });

  fam('sibling', 1, function (r) {
    if (r() < 0.6) {
      const a = pick(r, [4, 6, 8, 10]), N = pick(r, [30, 40, 50, 60, 70, 100]);
      return { q: 'When I was ' + a + ', my sister was half my age. I am ' + N + ' now. How old is she?', suf: 'years old', a: N - a / 2, baits: [N / 2], why: 'She was ' + (a / 2) + ' years younger then, and she still is. ' + N + ' − ' + (a / 2) + ' = ' + (N - a / 2) + '.', v: { t: 'sibling', mode: 'half', a: a, N: N } };
    }
    const a = pick(r, [5, 6, 8, 10]), N = pick(r, [20, 30, 40, 50]);
    return { q: 'When I was ' + a + ', my brother was twice my age. I am ' + N + ' now. How old is he?', suf: 'years old', a: N + a, baits: [2 * N], why: 'He was ' + a + ' years older then, and he still is. ' + N + ' + ' + a + ' = ' + (N + a) + '.', v: { t: 'sibling', mode: 'twice', a: a, N: N } };
  });

  fam('queue', 1, function (r) {
    const a = 5 + Math.floor(r() * 16);
    return { q: 'You are ' + ord(a) + ' from the front of a queue and ' + ord(a) + ' from the back. How many people are in it?', suf: 'people', a: 2 * a - 1, baits: [2 * a], why: 'Adding ' + a + ' and ' + a + ' counts you twice. Take one off.', v: { t: 'counting', mode: 'queue', a: a, b: a } };
  });

  fam('socks', 1, function (r) {
    const three = r() < 0.4;
    const A = pick(r, [6, 8, 10, 12]), B = pick(r, [6, 8, 10, 12]), C = pick(r, [6, 8, 10]);
    const counts = three ? [A, B, C] : [A, B];
    const list = three ? A + ' black, ' + B + ' white and ' + C + ' grey socks' : A + ' black socks and ' + B + ' white socks';
    return { q: 'A drawer has ' + list + '. In the dark, how many must you pull out to be sure of a matching pair?', suf: 'socks', a: counts.length + 1, baits: [2, Math.max.apply(null, counts) + 1], why: 'Your first ' + counts.length + ' could all be different colours. The next one has to match one of them.', v: { t: 'socks', mode: 'any', counts: counts } };
  });

  fam('corners', 1, function (r, turn) {
    const p = walk(r, turn, [['square table', 4], ['triangular road sign', 3], ['rectangular sheet of paper', 4], ['hexagonal tile', 6], ['five-sided badge', 5]]);
    return { q: 'A ' + p[0] + ' has ' + p[1] + ' corners. You cut one corner off. How many corners does it have now?', suf: 'corners', a: p[1] + 1, baits: [p[1] - 1], why: 'The cut removes one corner and leaves two new ones in its place.', v: { t: 'corners', n: p[1] } };
  });

  fam('hands', 1, function (r, turn) {
    const p = walk(r, turn, [['You have 10 fingers on 2 hands. How many fingers are on 10 hands?', 'fingers', 10], ['You have 10 toes on 2 feet. How many toes are on 10 feet?', 'toes', 10], ['You have 10 fingers on 2 hands. How many fingers are on 100 hands?', 'fingers', 100]]);
    return { q: p[0], suf: p[1], a: p[2] * 5, baits: [p[2] * 10], why: 'There are 5 on each one, not 10. ' + p[2] + ' × 5 = ' + (p[2] * 5) + '.', v: { t: 'hands', n: p[2] } };
  });

  fam('divhalf', 1, function (r) {
    if (r() < 0.6) {
      const a = pick(r, [6, 8, 10, 12, 20, 30, 50]);
      return { q: 'What is ' + a + ' divided by a half?', a: 2 * a, baits: [a / 2], why: 'Dividing by a half asks how many halves fit into ' + a + '. That is ' + (2 * a) + '. Halving it would be dividing by 2.', v: { t: 'divhalf', a: a, b: 0 } };
    }
    const a = pick(r, [10, 20, 30, 40]), b = pick(r, [5, 10]);
    return { q: 'Divide ' + a + ' by a half and add ' + b + '. What do you get?', a: 2 * a + b, baits: [a / 2 + b], why: 'Dividing by a half doubles it: ' + a + ' ÷ ½ = ' + (2 * a) + '. Then add ' + b + '.', v: { t: 'divhalf', a: a, b: b } };
  });

  fam('dry', 1, function (r, turn) {
    const p = walk(r, turn, [
      ['5 shirts take 5 hours to dry on a washing line. How many hours do 10 shirts take?', 'hours', 5, [10], 'They all dry at the same time. More shirts need more line, not more hours.'],
      ['An orchestra of 60 plays a symphony in 40 minutes. How many minutes does an orchestra of 120 take?', 'minutes', 40, [20, 80], 'The music is the same length however many people play it.'],
      ['It takes 6 minutes to boil 1 egg. How many minutes does it take to boil 4 eggs in the same pot?', 'minutes', 6, [24], 'They boil side by side, so 4 eggs take the same 6 minutes.'],
      ['One candle burns for 3 hours. How many hours do 4 candles last if you light them all together?', 'hours', 3, [12], 'Lit together, they all burn down over the same 3 hours.']
    ]);
    return { q: p[0], suf: p[1], a: p[2], baits: p[3], why: p[4], v: { t: 'dry', each: p[2] } };
  });

  fam('family', 1, function (r) {
    const s = pick(r, [3, 4, 5, 6, 7]), b = pick(r, [1, 1, 2]);
    return { q: 'A family has ' + s + ' sisters. Each sister has ' + b + ' ' + pl(b, 'brother', 'brothers') + '. How many children are in the family?', suf: 'children', a: s + b, baits: [s * (b + 1), s * b], why: 'The sisters all share the same ' + pl(b, 'brother', b + ' brothers') + '. ' + s + ' girls plus ' + b + ' ' + pl(b, 'boy', 'boys') + '.', v: { t: 'family', s: s, b: b } };
  });

  // Number riddles: nothing to work out, just a question most people do not quite hear.
  // The bar is "I should have caught that", never "how was I meant to know". So: no puns, no
  // trivia, and nothing that hangs on an assumption the question does not state.
  fam('listen', 1, function (r, turn) {
    const pickOne = walk(r, turn, ['sheep', 'apples', 'hole', 'stamps']);
    if (pickOne === 'sheep') {
      const p = pick(r, [[17, 9], [20, 8], [15, 6], [23, 9]]);
      return { q: 'A farmer has ' + p[0] + ' sheep. All but ' + p[1] + ' run away. How many does he have left?', suf: 'sheep', a: p[1], baits: [p[0] - p[1]], why: '“All but ' + p[1] + '” means ' + p[1] + ' stayed. Nothing to subtract.', v: { t: 'listen', id: 'sheep', n: p[0], k: p[1] } };
    }
    if (pickOne === 'apples') {
      const p = pick(r, [[6, 4], [5, 3], [8, 5], [7, 4]]);
      return { q: 'There are ' + p[0] + ' apples in a bowl. You take ' + p[1] + '. How many apples do you have?', suf: 'apples', a: p[1], baits: [p[0] - p[1]], why: 'You have the ' + p[1] + ' you took. The question never asked what was left in the bowl.', v: { t: 'listen', id: 'apples', n: p[0], k: p[1] } };
    }
    if (pickOne === 'hole') {
      const p = pick(r, [[2, 3, 1], [2, 2, 2], [3, 3, 1], [5, 2, 1]]);
      return { q: 'How many cubic metres of soil are in a hole ' + p[0] + ' m long, ' + p[1] + ' m wide and ' + p[2] + ' m deep?', suf: 'cubic metres', a: 0, baits: [p[0] * p[1] * p[2]], why: 'None. A hole is the part where the soil has been taken out.', v: { t: 'listen', id: 'hole' } };
    }
    const k = pick(r, [2, 3, 4, 6]);
    return { q: 'How many ' + k + '-cent stamps are there in a dozen?', suf: 'stamps', a: 12, baits: [12 / k], why: 'A dozen of anything is 12. The price is only there to make you divide.', v: { t: 'listen', id: 'stamps' } };
  });

  fam('picture', 1, function (r, turn) {
    const list = [
      { q: 'A square room has a cat in every corner. Each cat can see 3 cats. How many cats are in the room?', suf: 'cats', a: 4, baits: [12, 16], why: 'Four corners, four cats. Each one sees the other three.', v: { t: 'listen', id: 'cats' } },
      { q: 'Some months have 30 days and some have 31. How many months have 28 days?', suf: 'months', a: 12, baits: [1], why: 'All 12. Every month gets to its 28th day; February just stops there.', v: { t: 'listen', id: 'months' } },
      { q: 'Two fathers and two sons go fishing. Each catches one fish, and they bring home just 3 fish. How many people went fishing?', suf: 'people', a: 3, baits: [4], why: 'A grandfather, his son and his grandson. The man in the middle is both a father and a son.', v: { t: 'listen', id: 'fathers' } }
    ];
    return list[typeof turn === 'number' ? turn % list.length : Math.floor(r() * list.length)];
  });

  /* ---------- Level 2: the classic traps. ---------- */

  fam('rates', 2, function (r) {
    const mode = pick(r, ['time', 'workers', 'count']);
    if (mode === 'time') {
      const s = pick(r, [['machines', 'widgets'], ['bakers', 'loaves'], ['printers', 'posters']]);
      const n = pick(r, [3, 4, 5, 6]), M = pick(r, [50, 100, 200]);
      return { q: n + ' ' + s[0] + ' make ' + n + ' ' + s[1] + ' in ' + n + ' minutes. How many minutes do ' + M + ' ' + s[0] + ' take to make ' + M + ' ' + s[1] + '?', suf: 'minutes', a: n, baits: [M], why: 'Each one takes ' + n + ' minutes to make one. ' + M + ' working at once make ' + M + ' in the same ' + n + ' minutes.', v: { t: 'rates', mode: mode, n: n, M: M } };
    }
    if (mode === 'workers') {
      const n = pick(r, [2, 3, 4, 5]), M = n * pick(r, [10, 20]);
      return { q: n + ' cats catch ' + n + ' mice in ' + n + ' minutes. How many cats do you need to catch ' + M + ' mice in ' + M + ' minutes?', suf: 'cats', a: n, baits: [M], why: 'Each cat catches a mouse every ' + n + ' minutes, so ' + (M / n) + ' mice in ' + M + ' minutes. ' + n + ' cats catch ' + M + '.', v: { t: 'rates', mode: mode, n: n, M: M } };
    }
    const n = pick(r, [2, 3, 4]), k = pick(r, [2, 3, 4]);
    return { q: n + ' hens lay ' + n + ' eggs in ' + n + ' days. How many eggs do ' + (k * n) + ' hens lay in ' + (k * n) + ' days?', suf: 'eggs', a: k * k * n, baits: [k * n], why: 'One hen lays one egg every ' + n + ' days, so ' + k + ' eggs in ' + (k * n) + ' days. ' + (k * n) + ' hens lay ' + (k * n) + ' × ' + k + ' = ' + (k * k * n) + '.', v: { t: 'rates', mode: mode, n: n, k: k } };
  });

  fam('doubling', 2, function (r) {
    const s = pick(r, [['A patch of lily pads', 'pond', 'day', 'days', [20, 30, 48, 100]], ['A bloom of algae', 'lake', 'day', 'days', [20, 30, 48, 100]], ['A colony of bacteria', 'jar', 'minute', 'minutes', [60]]]);
    const D = pick(r, s[4]);
    const roll = r();
    if (roll < 0.2) return { q: s[0] + ' doubles in size every ' + s[2] + ' and fills the ' + s[1] + ' after ' + D + ' ' + s[3] + '. After how many ' + s[3] + ' was the ' + s[1] + ' a quarter full?', suf: s[3], a: D - 2, baits: [D / 4, D / 2], why: 'Work backwards. Half full one ' + s[2] + ' before the end, a quarter full the ' + s[2] + ' before that.', v: { t: 'doubling', mode: 'quarter', D: D } };
    if (roll < 0.7) return { q: s[0] + ' doubles in size every ' + s[2] + ' and fills the ' + s[1] + ' after ' + D + ' ' + s[3] + '. After how many ' + s[3] + ' was the ' + s[1] + ' half full?', suf: s[3], a: D - 1, baits: [D / 2], why: 'It doubles each ' + s[2] + ', so one ' + s[2] + ' before it was full, it was half full.', v: { t: 'doubling', mode: 'half', D: D } };
    return { q: s[0] + ' doubles in size every ' + s[2] + ' and fills the ' + s[1] + ' after ' + D + ' ' + s[3] + '. If you start with two of them, how many ' + s[3] + ' does it take?', suf: s[3], a: D - 1, baits: [D / 2], why: 'Starting with two is the same as starting one ' + s[2] + ' later. You save one ' + s[2] + ', not half the time.', v: { t: 'doubling', mode: 'two', D: D } };
  });

  fam('intervals', 2, function (r) {
    const mode = pick(r, ['log', 'clock', 'floors', 'pills', 'posts', 'circle', 'length']);
    if (mode === 'log') {
      const c = pick(r, [2, 3, 5]), p = pick(r, [[2, 4], [2, 6], [3, 6], [2, 8], [2, 10]]);
      const t = c * (p[0] - 1), ans = c * (p[1] - 1);
      return { q: 'Sawing a log into ' + p[0] + ' pieces takes ' + t + ' minutes. How many minutes does it take to saw it into ' + p[1] + ' pieces?', suf: 'minutes', a: ans, baits: [t * p[1] / p[0]], why: p[0] + ' pieces is ' + (p[0] - 1) + ' ' + pl(p[0] - 1, 'cut', 'cuts') + ', so each cut takes ' + c + ' minutes. ' + p[1] + ' pieces is ' + (p[1] - 1) + ' cuts.', v: { t: 'intervals', mode: 'log', a: p[0], b: p[1], time: t } };
    }
    if (mode === 'clock') {
      const g = pick(r, [1, 2]), p = pick(r, [[3, 6], [6, 12], [4, 8], [5, 10], [3, 9]]);
      const t = g * (p[0] - 1), ans = g * (p[1] - 1);
      return { q: 'A clock takes ' + t + ' seconds to strike ' + p[0] + " o'clock. How many seconds does it take to strike " + p[1] + " o'clock?", suf: 'seconds', a: ans, baits: [t * p[1] / p[0]], why: p[0] + ' strikes have ' + (p[0] - 1) + ' gaps between them. ' + p[1] + ' strikes have ' + (p[1] - 1) + ' gaps.', v: { t: 'intervals', mode: 'clock', a: p[0], b: p[1], time: t } };
    }
    if (mode === 'floors') {
      const s = pick(r, [10, 15, 20]), p = pick(r, [[3, 6], [4, 8], [5, 10], [2, 6]]);
      const t = s * (p[0] - 1), ans = s * (p[1] - 1);
      return { q: 'Walking from floor 1 to floor ' + p[0] + ' takes ' + t + ' seconds. How many seconds does it take from floor 1 to floor ' + p[1] + '?', suf: 'seconds', a: ans, baits: [t * p[1] / p[0]], why: 'Floor 1 to floor ' + p[0] + ' is ' + (p[0] - 1) + ' ' + pl(p[0] - 1, 'flight', 'flights') + ' of stairs. Floor 1 to floor ' + p[1] + ' is ' + (p[1] - 1) + '.', v: { t: 'intervals', mode: 'floors', a: p[0], b: p[1], time: t } };
    }
    if (mode === 'pills') {
      const n = pick(r, [3, 4, 5, 6]), m = pick(r, [20, 30]);
      return { q: 'A doctor gives you ' + n + ' tablets and says take one every ' + m + ' minutes, starting now. How many minutes until the last one?', suf: 'minutes', a: (n - 1) * m, baits: [n * m], why: 'The first one is at minute 0. ' + n + ' tablets have ' + (n - 1) + ' gaps between them.', v: { t: 'intervals', mode: 'pills', n: n, m: m } };
    }
    if (mode === 'posts') {
      const p = pick(r, [[100, 10], [60, 5], [120, 10], [50, 5]]);
      return { q: 'A ' + p[0] + ' m fence has a post every ' + p[1] + ' m, with one at each end. How many posts does it have?', suf: 'posts', a: p[0] / p[1] + 1, baits: [p[0] / p[1]], why: 'There are ' + (p[0] / p[1]) + ' gaps, and a row of gaps needs one more post than it has gaps.', v: { t: 'intervals', mode: 'posts', L: p[0], g: p[1] } };
    }
    if (mode === 'circle') {
      const n = pick(r, [8, 10, 12, 20]);
      return { q: 'You plant ' + n + ' trees evenly around a circular pond. How many gaps are there between the trees?', suf: 'gaps', a: n, baits: [n - 1], why: 'In a circle the last tree is next to the first, so there are as many gaps as trees.', v: { t: 'intervals', mode: 'circle', n: n } };
    }
    const n = pick(r, [10, 11, 20, 21]), g = pick(r, [2, 3, 5]);
    return { q: n + ' fence posts stand in a straight line, ' + g + ' m apart. How long is the fence?', suf: 'm', a: (n - 1) * g, baits: [n * g], why: n + ' posts have only ' + (n - 1) + ' gaps between them.', v: { t: 'intervals', mode: 'length', n: n, g: g } };
  });

  fam('downup', 2, function (r) {
    const p = pick(r, [50, 50, 20, 10]);
    const q = pick(r, ['A share price falls ' + p + '% on Monday and rises ' + p + '% on Tuesday. By what % is it now below where it started?', 'You lose ' + p + '% of your chips, then win ' + p + '% back on what is left. By what % are you still down?']);
    return { q: q, suf: '%', a: p * p / 100, baits: [0], why: '100 falls to ' + (100 - p) + '. A ' + p + '% rise on ' + (100 - p) + ' only adds ' + num(p * (100 - p) / 100) + ', so you end on ' + num(100 - p * p / 100) + '.', v: { t: 'downup', p: p, fallFirst: true } };
  });

  fam('reverse', 2, function (r) {
    if (r() < 0.55) {
      const p = pick(r, [[50, 100], [20, 25], [75, 300], [80, 400]]);
      return { q: pick(r, ['Your pay is cut by ' + p[0] + '%. What % raise gets you back to where you were?', 'A share falls ' + p[0] + '%. What % rise gets it back to where it started?']), suf: '%', a: p[1], baits: [p[0]], why: '100 drops to ' + (100 - p[0]) + '. To get back you need ' + p[0] + ' more, and ' + p[0] + ' is ' + p[1] + '% of ' + (100 - p[0]) + '.', v: { t: 'reverse', up: false, p: p[0] } };
    }
    const p = pick(r, [[100, 50], [25, 20], [300, 75]]);
    return { q: 'A shop raises a price by ' + p[0] + '%. What % discount brings it back to the old price?', suf: '%', a: p[1], baits: [p[0]], why: '100 rises to ' + (100 + p[0]) + '. Taking ' + p[0] + ' back off is ' + p[1] + '% of ' + (100 + p[0]) + '.', v: { t: 'reverse', up: true, p: p[0] } };
  });

  fam('selfref', 2, function (r) {
    if (r() < 0.5) {
      const A = pick(r, [1, 2, 3, 5]);
      return { q: 'A brick weighs ' + A + ' kg plus half a brick. How much does the brick weigh?', suf: 'kg', a: 2 * A, baits: [1.5 * A], why: 'If half a brick is part of the weight, the ' + A + ' kg must be the other half. Two halves: ' + (2 * A) + ' kg.', v: { t: 'selfref', A: A, n: 1, d: 2 } };
    }
    const A = pick(r, [4, 6, 10, 20]);
    return { q: 'A book costs ' + eur(A) + ' plus half its price. How much does the book cost?', pre: '€', a: 2 * A, baits: [1.5 * A], why: 'If half the price is part of the price, the ' + eur(A) + ' must be the other half. Two halves: ' + eur(2 * A) + '.', v: { t: 'selfref', A: A, n: 1, d: 2 } };
  });

  fam('snail', 2, function (r) {
    const p = pick(r, [[10, 3, 2], [20, 5, 4], [12, 4, 2], [15, 3, 2], [18, 4, 2], [30, 5, 3]]);
    const h = p[0], u = p[1], d = p[2];
    let day = 0, pos = 0;
    for (;;) { day++; pos += u; if (pos >= h) break; pos -= d; }
    return { q: 'A snail is at the bottom of a ' + h + ' m well. Each day it climbs ' + u + ' m, and each night it slips back ' + d + ' m. On which day does it get out?', pre: 'Day ', a: day, baits: [h / (u - d)], why: 'It gains ' + (u - d) + ' m a day, but on the last day it climbs out before it can slip. After ' + (day - 1) + ' days it is at ' + ((day - 1) * (u - d)) + ' m, and the next climb gets it out.', v: { t: 'snail', h: h, u: u, d: d } };
  });

  fam('matches', 2, function (r) {
    if (r() < 0.6) {
      const n = pick(r, [8, 16, 32, 64, 100, 128]);
      return { q: n + ' players enter a knockout tournament. How many matches are played to find the winner?', suf: 'matches', a: n - 1, baits: [n / 2, n], why: 'Every match knocks out one player, and ' + (n - 1) + ' players have to be knocked out.', v: { t: 'matches', mode: 'knockout', n: n } };
    }
    const n = pick(r, [4, 5, 6]);
    return { q: n + ' friends meet and everyone shakes hands with everyone else once. How many handshakes?', suf: 'handshakes', a: n * (n - 1) / 2, baits: [n * (n - 1), n * n], why: 'Each of the ' + n + ' shakes ' + (n - 1) + ' hands, but that counts every handshake twice. Halve it.', v: { t: 'matches', mode: 'shake', n: n } };
  });

  fam('scaling', 2, function (r) {
    if (r() < 0.55) {
      const p = pick(r, [[6, 2], [8, 2], [5, 3], [4, 3], [7, 2]]);
      return { q: 'How many ' + p[0] + '-inch pizzas make the same amount of pizza as one ' + (p[0] * p[1]) + '-inch pizza?', suf: 'pizzas', a: p[1] * p[1], baits: [p[1]], why: p[1] === 2 ? 'Twice as wide is also twice as long. That is 2 × 2 = 4 times the pizza.' : 'Three times as wide is also three times as long. That is 3 × 3 = 9 times the pizza.', v: { t: 'scaling', mode: 'pizza', k: p[1], s: p[0] } };
    }
    const k = pick(r, [2, 3, 10]);
    return { q: 'You make every side of a square field ' + (k === 2 ? 'twice' : k === 3 ? 'three times' : '10 times') + ' as long. How many of the old fields fit inside the new one?', suf: 'fields', a: k * k, baits: [k], why: 'It gets ' + k + ' times longer and ' + k + ' times wider: ' + k + ' × ' + k + ' = ' + (k * k) + '.', v: { t: 'scaling', mode: 'square', k: k } };
  });

  fam('coins', 2, function (r) {
    const s = pick(r, [['You roll two dice', 'they show the same number', 6], ['Two friends each pick a day of the week at random', 'they pick the same day', 7], ['Two people each pick a number from 1 to 10', 'they pick the same number', 10], ['Two people play rock, paper, scissors', 'they throw the same thing', 3]]);
    return { q: s[0] + '. The chance ' + s[1] + ' is 1 in what?', pre: '1 in ', a: s[2], baits: [s[2] * s[2]], why: 'Whatever the first one is, the second has a 1 in ' + s[2] + ' chance of matching it.', v: { t: 'coins', mode: 'match', n: s[2] } };
  });

  fam('pigeon', 2, function (r, turn) {
    if (typeof turn === 'number' ? turn % 5 === 4 : r() < 0.2) return { q: 'You flip a coin 3 times. What is the % chance that at least two of the flips match?', suf: '%', a: 100, baits: [50, 75, 25], why: 'There are only two faces. With three flips, two of them have to land the same way.', v: { t: 'pigeon', mode: 'coins' } };
    const p = walk(r, turn, [['were born in the same month', 12, 'a different month'], ['were born on the same day of the week', 7, 'a different day'], ['have the same star sign', 12, 'a different sign'], ['have a first name starting with the same letter', 26, 'a different letter']]);
    return { q: 'How many people do you need in a room to be certain that two of them ' + p[0] + '?', suf: 'people', a: p[1] + 1, baits: [p[1], 2], why: p[1] + ' people could each have ' + p[2] + '. Person ' + (p[1] + 1) + ' has to match somebody.', v: { t: 'pigeon', k: p[1] } };
  });

  fam('compound', 2, function (r) {
    const p = pick(r, [[50, 50], [20, 20], [10, 10], [50, 20]]);
    const left = (100 - p[0]) * (100 - p[1]) / 100;
    return { q: 'A coat is ' + p[0] + '% off. At the till you get a further ' + p[1] + '% off the sale price. What is the total % discount?', suf: '%', a: 100 - left, baits: [p[0] + p[1]], why: '€100 drops to €' + (100 - p[0]) + ', and ' + p[1] + '% off that leaves €' + num(left) + '. The second discount is taken off a smaller price.', v: { t: 'compound', mode: 'discount', p: p[0], q: p[1] } };
  });

  fam('digits', 3, function (r) {
    const d = 2 + Math.floor(r() * 8);
    return { q: 'How many times does the digit ' + d + ' appear in the numbers from 1 to 100?', suf: 'times', a: 20, baits: [10, 11, 19], why: 'Ten times at the end (' + d + ', 1' + d + ', 2' + d + '…) and ten times at the front (' + d + '0 to ' + d + '9). ' + d + d + ' has it twice.', v: { t: 'digits', mode: 'appear', N: 100, d: d } };
  });

  fam('punch', 2, function (r) {
    const n = pick(r, [3, 3, 4, 5]);
    return { q: 'You fold a sheet of paper in half ' + n + ' times, then punch one hole through it. How many holes are there when you unfold it?', suf: 'holes', a: Math.pow(2, n), baits: [n, 2 * n, n + 1], why: 'Every fold doubles the layers: ' + [2, 4, 8, 16, 32].slice(0, n).join(', ') + '. One punch goes through all ' + Math.pow(2, n) + '.', v: { t: 'paperfold', n: n } };
  });

  fam('cube', 2, function (r, turn) {
    const p = walk(r, turn, [[3, 0, 'no paint on them', [0, 9, 8, 3], 'Only the cube buried in the very middle is untouched. Every other one has a face on the outside.'], [3, 1, 'paint on exactly one side', [9, 1, 8, 12], 'Only the cube in the middle of each face has one painted side, and a cube has 6 faces.'], [4, 0, 'no paint on them', [0, 16, 4], 'Peel off the outer layer all round and a 2 × 2 × 2 block is left inside.']]);
    const n = p[0], k = p[1];
    return { q: 'A wooden cube is painted red, then cut into ' + (n * n * n) + ' small cubes. How many of them have ' + p[2] + '?', suf: 'cubes', a: k === 0 ? Math.pow(n - 2, 3) : 6 * (n - 2) * (n - 2), baits: p[3], why: p[4], v: { t: 'cube', n: n, k: k } };
  });

  fam('refill', 2, function (r) {
    const p = pick(r, [[3, 9], [4, 16], [2, 8], [3, 27], [5, 25]]);
    const k = p[0], n = p[1];
    let drunk = 0, full = n, empty = 0; const steps = [];
    while (full > 0) { drunk += full; steps.push(full); empty += full; full = Math.floor(empty / k); empty = empty % k; }
    return { q: 'A shop gives 1 free bottle for every ' + k + ' empties you bring back. You buy ' + n + ' bottles. How many can you drink in total?', suf: 'bottles', a: drunk, baits: [n + n / k, n], why: 'The free bottles become empties too, and you can trade those in again: ' + steps.join(' + ') + ' = ' + drunk + '.', v: { t: 'refill', k: k, n: n } };
  });

  /* ---------- Level 3: the one you tell people about. ---------- */

  fam('dilution', 3, function (r) {
    if (r() < 0.6) {
      const p = pick(r, [[100, 99, 98], [200, 99, 98], [100, 98, 96], [100, 95, 90], [100, 99, 90], [100, 99, 95]]);
      const N = p[0], P = p[1], Q = p[2], m = N * (100 - P) / 100, remain = m * 100 / (100 - Q);
      const s = pick(r, [['people are in a room', 'are right-handed', 'right-handers', 'room'], ['fans are in a stand', 'support the home team', 'home fans', 'crowd']]);
      return { q: N + ' ' + s[0] + ' and ' + P + '% ' + s[1] + '. How many ' + s[2] + ' must leave so that ' + Q + '% ' + s[1] + '?', suf: 'people', a: N - remain, baits: [N * (P - Q) / 100], why: 'The other ' + m + ' ' + pl(m, 'stays', 'stay') + '. For ' + m + ' to be ' + (100 - Q) + '% of the ' + s[3] + ', the ' + s[3] + ' must shrink to ' + remain + '.', v: { t: 'dilution', mode: 'leave', N: N, P: P, Q: Q } };
    }
    const p = pick(r, [[100, 99, 98], [200, 99, 98], [100, 98, 96], [50, 98, 96]]);
    const N = p[0], P = p[1], Q = p[2], m = N * (100 - P) / 100, remain = m * 100 / (100 - Q);
    const item = pick(r, ['tomatoes', 'mushrooms', 'grapes']);
    return { q: N + ' kg of ' + item + ' are ' + P + '% water. They dry until they are ' + Q + '% water. How much do they weigh now?', suf: 'kg', a: remain, baits: [N - N * (P - Q) / 100], why: 'The dry part is ' + m + ' kg and never changes. If that is now ' + (100 - Q) + '% of the weight, the total is ' + remain + ' kg.', v: { t: 'dilution', mode: 'weigh', N: N, P: P, Q: Q } };
  });

  fam('fly', 3, function (r) {
    const p = pick(r, [[100, 50, 75], [120, 30, 40], [200, 50, 80], [90, 45, 60], [60, 30, 50], [240, 60, 90]]);
    const d = p[0], v = p[1], f = p[2], hrs = d / (2 * v);
    return { q: 'Two trains ' + d + ' km apart head towards each other at ' + v + ' km/h each. A fly zips back and forth between them at ' + f + ' km/h until they meet. How far does the fly travel?', suf: 'km', a: f * hrs, baits: [d, d / 2], why: 'Ignore the zigzags. The trains meet after ' + hrs + ' ' + pl(hrs, 'hour', 'hours') + ', and the fly is flying at ' + f + ' km/h for all of it.', v: { t: 'fly', d: d, v: v, f: f } };
  });

  fam('clock', 3, function (r) {
    const kind = r();
    if (kind < 0.18) {
      const H = pick(r, [12, 24]);
      return { q: 'How many times do the hands of a clock point in exactly opposite directions in ' + H + ' hours?', suf: 'times', a: 11 * H / 12, baits: [H, H + 1], why: 'It happens a little less than once an hour: 11 times in 12 hours, not 12. Around 6 o\u2019clock the hour either side shares the one moment.', v: { t: 'clock', mode: 'opposite', H: H } };
    }
    if (kind < 0.42) {
      const H = pick(r, [12, 24]);
      return { q: 'How many times do the hands of a clock pass over each other in ' + H + ' hours?', suf: 'times', a: 11 * H / 12, baits: [H, H + 1], why: 'The minute hand catches the hour hand every 65 minutes or so, not every 60. That fits 11 times into 12 hours.', v: { t: 'clock', mode: 'overlap', H: H } };
    }
    const p = pick(r, [[3, 15], [6, 30], [9, 45], [12, 30], [2, 10], [4, 20]]);
    const h = p[0], m = p[1], base = (30 * h) % 360, hourA = base + m / 2, minA = 6 * m;
    const sm = function (x) { x = Math.abs(x) % 360; return Math.min(x, 360 - x); };
    return { q: 'What is the angle between the hands of a clock at ' + h + ':' + m + '?', suf: '°', a: sm(hourA - minA), baits: [sm(base - minA)], why: 'The hour hand does not wait on the ' + h + '. By ' + h + ':' + m + ' it has crept ' + num(m / 2) + '° past it.', v: { t: 'clock', h: h, m: m } };
  });

  fam('balance', 3, function (r, turn) {
    const p = walk(r, turn, [[9, 2, [3, 4]], [27, 3, [4, 5]], [8, 2, [3]], [3, 1, [2]]]);
    return { q: p[0] + ' coins look identical, but one is heavier. What is the fewest weighings on a balance scale that is sure to find it?', suf: pl(p[1], 'weighing', 'weighings'), a: p[1], baits: p[2], why: 'Split them into three groups, not two. If the two groups on the scale balance, the heavy coin is in the third.', v: { t: 'balance', n: p[0] } };
  });

  fam('till', 3, function (r) {
    const S = pick(r, [100, 50, 20]), G = pick(r, S === 100 ? [60, 70, 80] : S === 50 ? [20, 30, 35] : [8, 12, 15]);
    return { q: 'A thief steals a ' + eur(S) + ' note from a shop till. He then buys ' + eur(G) + ' of goods there with it and gets ' + eur(S - G) + ' change. How much is the shop down?', pre: '€', a: S, baits: [S + (S - G), S + G, 2 * S, G], why: 'The purchase is a fair swap, so ignore it. The shop is down the ' + eur(S) + ' he stole: ' + eur(G) + ' in goods and ' + eur(S - G) + ' in change.', v: { t: 'till', S: S, G: G } };
  });

  fam('buysell', 3, function (r) {
    const b = pick(r, [40, 50, 60, 100]), d = pick(r, [5, 10, 20]);
    const s = pick(r, ['a bike', 'a watch', 'a jersey']);
    return { q: 'You buy ' + s + ' for ' + eur(b) + ', sell it for ' + eur(b + d) + ', buy it back for ' + eur(b + 2 * d) + ' and sell it again for ' + eur(b + 3 * d) + '. How much profit did you make?', pre: '€', a: 2 * d, baits: [d, 3 * d, 0], why: 'It is two separate deals, and each one makes ' + eur(d) + '. Paying more to buy it back is not a loss.', v: { t: 'buysell', flows: [-b, b + d, -(b + 2 * d), b + 3 * d] } };
  });

  fam('speed', 3, function (r) {
    const p = pick(r, [[30, 60, 60], [10, 30, 30], [20, 30, 60], [40, 60, 120], [60, 120, 120], [20, 60, 60]]);
    const a = p[0], b = p[1], L = p[2], hrs = L / a + L / b, s = pick(r, [['drive to work', 'drive home'], ['cycle to the beach', 'cycle home']]);
    return { q: 'You ' + s[0] + ' at ' + a + ' km/h and ' + s[1] + ' the same way at ' + b + ' km/h. What is your average speed for the whole trip?', suf: 'km/h', a: 2 * L / hrs, baits: [(a + b) / 2], why: 'You spend longer on the slow leg, so it counts for more. Say it is ' + L + ' km each way: ' + (L / a) + ' ' + pl(L / a, 'hour', 'hours') + ' out, ' + (L / b) + ' back, ' + (2 * L) + ' km in ' + hrs + ' hours.', v: { t: 'speed', mode: 'avg', a: a, b: b } };
  });

  fam('lockers', 3, function (r) {
    const N = pick(r, [100, 100, 49, 64, 30]), open = Math.floor(Math.sqrt(N));
    return { q: N + ' lockers are closed. Person 1 flips every locker, person 2 every 2nd, person 3 every 3rd, and so on up to person ' + N + '. How many lockers end up open?', suf: 'lockers', a: open, baits: [N / 2, N, 0], why: 'A locker is flipped once for each number that divides it. Only square numbers have an odd count of those: 1, 4, 9 and so on. There are ' + open + ' up to ' + N + '.', v: { t: 'lockers', N: N } };
  });

  fam('baserate', 3, function (r) {
    const p = pick(r, [[9, 10], [4, 20], [19, 5]]);
    return { q: '1% of emails are scams. A filter catches every scam, but it also flags ' + p[0] + '% of honest emails. An email gets flagged. What is the % chance it is a scam? (nearest whole number)', suf: '%', a: p[1], tol: 0.5, baits: [100 - p[0], 99, 90], why: 'Take 100 emails: 1 scam, and it is flagged. But about ' + p[0] + ' of the 99 honest ones are flagged too. So only 1 flagged email in ' + (p[0] + 1) + ' is a scam.', v: { t: 'baserate', prior: 1, f: p[0] } };
  });

  fam('cuts', 3, function (r) {
    const n = pick(r, [3, 4, 4, 5]), parts = [1]; let total = 1;
    for (let k = 1; k <= n; k++) { total += k; parts.push(k); }
    return { q: 'What is the most pieces you can cut a pizza into with ' + n + ' straight cuts?', suf: 'pieces', a: total, baits: [2 * n, n + 1], why: 'Each new cut can cross every earlier one, so cut number ' + n + ' adds ' + n + ' pieces: ' + parts.join(' + ') + ' = ' + total + '.', v: { t: 'cuts', n: n } };
  });

  // One-off classics. Each appears once per pass through the list, in order.
  fam('classic', 3, function (r, turn) {
    const list = [
      { q: 'You roll a coin all the way round the edge of another coin of the same size. How many full turns does it make?', suf: 'turns', a: 2, baits: [1], why: 'It turns once from rolling along the edge, and once more from being carried round the circle.', v: { t: 'classic', id: 'coinroll' } },
      { q: 'Two 50 m poles hold up an 80 m cable. At its lowest point the cable is 10 m above the ground. How far apart are the poles?', suf: 'm', a: 0, baits: [], why: 'The cable drops 40 m and climbs 40 m, which uses all 80 m. It hangs straight down, so the poles are touching.', v: { t: 'classic', id: 'cable' } },
      { q: 'One of 3 doors hides a car. You pick one. The host, who knows where the car is, opens an empty door from the other two. What is your % chance if you switch?', suf: '%', a: 66.67, tol: 0.7, baits: [50, 33], why: 'Your first pick is right 1 time in 3. The other 2 times, the host has just shown you where the car is.', v: { t: 'classic', id: 'monty' } },
      { q: 'A family has two children and at least one is a boy. The chance that both are boys is 1 in what?', pre: '1 in ', a: 3, baits: [2, 4], why: 'Boy-boy, boy-girl and girl-boy are all equally likely. Only one of those three is two boys.', v: { t: 'classic', id: 'twokids' } },
      { q: 'One card is red on both sides, one is blue on both sides and one has a side of each. You draw a card and see a red side. What is the % chance the other side is red too?', suf: '%', a: 66.67, tol: 0.7, baits: [50, 33], why: 'There are three red sides you could be looking at, and two of them belong to the all-red card.', v: { t: 'classic', id: 'cards' } },
      { q: 'A rope fits snugly around the Earth. How many extra metres of rope do you need to lift it 1 metre off the ground all the way round? (nearest metre)', suf: 'metres', a: 6, tol: 0.3, baits: [], baitAbove: 100, why: 'The extra is 2 × π × 1 metre, about 6.3 metres. The size of the Earth makes no difference at all.', v: { t: 'classic', id: 'rope' } }
    ];
    return list[typeof turn === 'number' ? turn % list.length : Math.floor(r() * list.length)];
  });

  /* ---------- Sets ---------- */

  const BY = { 1: F.filter(function (f) { return f.level === 1; }), 2: F.filter(function (f) { return f.level === 2; }), 3: F.filter(function (f) { return f.level === 3; }) };

  // Each level runs in cycles: every family appears once per cycle, and never on
  // the last day of one cycle and the first day of the next.
  function cycleOrder(level, target) {
    const fams = BY[level], days = fams.length;
    let prev = null, sh = null;
    for (let c = 0; c <= target; c++) {
      sh = shuffle(rngFrom('v6-cycle-' + level + '-' + c), fams);
      if (prev && sh[0] === prev) sh = sh.slice(1).concat(sh[0]);
      prev = sh[days - 1];
    }
    return sh;
  }
  function make(f, seed, turn) {
    const q = f.gen(rngFrom(seed + '-' + f.id), turn);
    q.fam = f.id; q.level = f.level;
    q.kind = f.id + ((q.v && (q.v.mode || q.v.id)) || '');   // letters only: used as a counter name
    q.pre = q.pre || ''; q.suf = q.suf || '';
    q.a = Math.round(q.a * 1e6) / 1e6;
    q.baits = (q.baits || []).filter(function (b, i, arr) { return isFinite(b) && b >= 0 && Math.abs(b - q.a) > (q.tol || 0) + 0.006 && arr.indexOf(b) === i; });
    return q;
  }
  function buildDaily(day) {
    const i = Math.max(0, day - 1);
    return [1, 2, 3].map(function (level, n) {
      const days = BY[level].length, turn = Math.floor(i / days);
      return make(cycleOrder(level, turn)[i % days], 'v6-daily-' + day + '-' + n, turn);
    });
  }
  function buildTable(code, round) {
    const key = 'v6-table-' + code + '-' + round, r = rngFrom(key);
    return [pick(r, BY[1]), pick(r, BY[2]), pick(r, BY[3])].map(function (f, n) { return make(f, key + '-' + n); });
  }

  // A longer set for one phone passed round a group: easy first, hardest last, no family twice.
  function buildParty(seed, n) {
    const key = 'v6-party-' + seed, r = rngFrom(key);
    const plan = n <= 3 ? [1, 2, 3] : n <= 5 ? [1, 2, 2, 3, 3] : [1, 2, 2, 2, 3, 3, 3];
    const pool = { 1: shuffle(r, BY[1]), 2: shuffle(r, BY[2]), 3: shuffle(r, BY[3]) };
    return plan.map(function (level, i) { return make(pool[level].pop(), key + '-' + i); });
  }
  // Every kind of question the bank can produce, for reading the live counters back.
  function kinds() {
    const seen = {}, out = [];
    F.forEach(function (f) { for (let i = 0; i < 400; i++) { const q = make(f, 'kinds-' + i, i); if (!seen[q.kind]) { seen[q.kind] = 1; out.push({ kind: q.kind, level: q.level, eg: q.q }); } } });
    return out;
  }

  const EPOCH = Date.UTC(2026, 10, 16); // No. 1 was 16 November 2026, by the player's local date
  function dayNumber(date) { return Math.max(1, Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - EPOCH) / 86400000) + 1); }

  function judge(q, text) {
    const v = parseFloat(text);
    if (text === '' || text === '.' || !isFinite(v)) return 'bad';
    if (Math.abs(v - q.a) <= (q.tol || 0) + 0.006) return 'right';
    for (let i = 0; i < q.baits.length; i++) {
      const b = q.baits[i], tol = Math.abs(b - Math.round(b)) < 1e-9 ? 0.006 : 0.5;
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
    const suf = v === 1 ? q.suf.replace(/^([a-z]+)s\b/, '$1') : q.suf;   // 1 cube, not 1 cubes
    return q.pre + num(v) + (suf ? (tight ? '' : ' ') + suf : '');
  }

  const api = { families: F, buildDaily: buildDaily, buildTable: buildTable, buildParty: buildParty, kinds: kinds, dayNumber: dayNumber, judge: judge, hasBait: hasBait, show: show, num: num, ord: ord, rngFrom: rngFrom, make: make };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BaitEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
