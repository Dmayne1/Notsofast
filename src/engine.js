/* Not So Fast question engine. No DOM in this file.
   Every question must pass three tests:
   1. Sayable: short enough to ask a friend from memory.
   2. No real calculation: once you see it, the sum is one easy step.
   3. One illusion: a single obvious answer that is wrong, and a click when you see why.
   And one rule of fairness: a minute of thinking must be able to reach the answer. No trivia.

   Every kind of question has a grade from 1 to 5, judged against a running clock:
   1. a giveaway   2. easy, but with a real trap   3. tricky   4. hard   5. most people miss it.
   A day climbs 2, 3, 4: it starts with something that can catch you and ends with something a
   minute of thought can still reach. Grades 1 and 5 never appear in the daily three; they are for
   endless mode. The grades are estimates until the live counters say otherwise: each question
   carries a `kind` so real results can be read back and the grades re-sorted (see GRADE below). */
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

  // Number riddles: nothing to work out, just a question most people do not quite hear.
  // The bar is "I should have caught that", never "how was I meant to know". So: no puns, no
  // trivia, and nothing that hangs on an assumption the question does not state.
  fam('listen', 1, function (r, turn) {
    const pickOne = walk(r, turn, ['sheep', 'stamps']);
    if (pickOne === 'sheep') {
      const p = pick(r, [[17, 9], [20, 8], [15, 6], [23, 9]]);
      return { q: 'A farmer has ' + p[0] + ' sheep. All but ' + p[1] + ' run away. How many does he have left?', suf: 'sheep', a: p[1], baits: [p[0] - p[1]], why: '“All but ' + p[1] + '” means ' + p[1] + ' stayed. Nothing to subtract.', v: { t: 'listen', id: 'sheep', n: p[0], k: p[1] } };
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
    return { q: s[0] + ' doubles in size every ' + s[2] + ' and fills the ' + s[1] + ' after ' + D + ' ' + s[3] + '. If it starts out twice as big, how many ' + s[3] + ' does it take to fill the ' + s[1] + '?', suf: s[3], a: D - 1, baits: [D / 2], why: 'Starting twice as big is the same as skipping the first ' + s[2] + '. You save one ' + s[2] + ', not half the time.', v: { t: 'doubling', mode: 'two', D: D } };
  });

  fam('intervals', 2, function (r) {
    const mode = pick(r, ['log', 'clock', 'floors', 'pills', 'posts', 'circle', 'monday']);
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
    const p = pick(r, [['Monday', 3], ['Friday', 4], ['Sunday', 3], ['Tuesday', 4], ['Saturday', 3]]), date = 1 + 7 * (p[1] - 1);
    return { q: 'The 1st of the month is a ' + p[0] + '. What date is the ' + ord(p[1]) + ' ' + p[0] + ' of that month?', ordinal: true, a: date, baits: [7 * p[1]], why: 'The 1st is already the first ' + p[0] + ', so the ' + ord(p[1]) + ' is only ' + (p[1] - 1) + ' weeks later: 1 + ' + (7 * (p[1] - 1)) + ' = ' + date + '.', v: { t: 'intervals', mode: 'monday', k: p[1] } };
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
      return { q: 'On a set of scales, one brick balances a ' + A + ' kg weight plus half a brick. How much does a whole brick weigh?', suf: 'kg', a: 2 * A, baits: [1.5 * A], why: 'Take half a brick off each side. Half a brick now balances the ' + A + ' kg weight, so a whole brick is ' + (2 * A) + ' kg.', v: { t: 'selfref', A: A, n: 1, d: 2 } };
    }
    const A = pick(r, [4, 6, 10, 20]);
    return { q: 'The price of a book is ' + eur(A) + ' more than half its price. How much does the book cost?', pre: '€', a: 2 * A, baits: [1.5 * A], why: 'The price is half of itself plus ' + eur(A) + ', so the ' + eur(A) + ' must be the other half. Two halves: ' + eur(2 * A) + '.', v: { t: 'selfref', A: A, n: 1, d: 2 } };
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
    if (r() < 0.45) {
      const b = pick(r, [[4, 6], [3, 5], [4, 5], [5, 6]]), sq = b[0] * b[1];
      return { q: 'A chocolate bar is ' + b[0] + ' squares by ' + b[1] + '. You snap it along the lines, one piece at a time. How many snaps does it take to break it into all ' + sq + ' squares?', suf: 'snaps', a: sq - 1, baits: [b[0] + b[1] - 2, sq], why: 'Every snap turns one piece into two, so each snap adds exactly one piece. ' + sq + ' pieces need ' + (sq - 1) + ' snaps, whatever order you do them in.', v: { t: 'matches', mode: 'snap', a: b[0], b: b[1] } };
    }
    const n = pick(r, [4, 5, 6]);
    return { q: n + ' friends meet and everyone shakes hands with everyone else once. How many handshakes?', suf: 'handshakes', a: n * (n - 1) / 2, baits: [n * (n - 1), n * n], why: 'Each of the ' + n + ' shakes ' + (n - 1) + ' hands, but that counts every handshake twice. Halve it.', v: { t: 'matches', mode: 'shake', n: n } };
  });

  fam('scaling', 2, function (r) {
    const m = pick(r, ['pizza', 'square', 'units', 'cube']);
    if (m === 'pizza') {
      const p = pick(r, [[6, 2], [8, 2], [5, 3], [4, 3], [7, 2]]);
      return { q: 'How many ' + p[0] + '-inch pizzas make the same amount of pizza as one ' + (p[0] * p[1]) + '-inch pizza?', suf: 'pizzas', a: p[1] * p[1], baits: [p[1]], why: p[1] === 2 ? 'Twice as wide is also twice as long. That is 2 × 2 = 4 times the pizza.' : 'Three times as wide is also three times as long. That is 3 × 3 = 9 times the pizza.', v: { t: 'scaling', mode: 'pizza', k: p[1], s: p[0] } };
    }
    if (m === 'units') {
      const u = pick(r, [['How many square centimetres are there in one square metre?', 100, 'A metre is 100 cm, so a square metre is 100 cm long and 100 cm wide'], ['How many 10 cm tiles does it take to cover a floor 1 m by 1 m?', 10, 'Ten tiles fit along each side, so it takes 10 rows of 10'], ['How many square millimetres are there in one square centimetre?', 10, 'A centimetre is 10 mm, so the square is 10 mm long and 10 mm wide']]);
      return { q: u[0], a: u[1] * u[1], baits: [u[1]], why: u[2] + ': ' + u[1] + ' × ' + u[1] + ' = ' + num(u[1] * u[1]) + '.', v: { t: 'scaling', mode: 'units', k: u[1] } };
    }
    if (m === 'cube') {
      const k = pick(r, [2, 2, 3]);
      return { q: 'A cube-shaped tank 1 m wide holds 1,000 litres. How many litres does a cube-shaped tank ' + k + ' m wide hold?', suf: 'litres', a: 1000 * k * k * k, baits: [1000 * k, 1000 * k * k], why: 'It is ' + k + ' times as long, ' + k + ' times as wide and ' + k + ' times as deep: ' + k + ' × ' + k + ' × ' + k + ' = ' + (k * k * k) + ' times the water.', v: { t: 'scaling', mode: 'cube', k: k, V: 1000 } };
    }
    const k = pick(r, [2, 3, 10]);
    return { q: 'You make every side of a square field ' + (k === 2 ? 'twice' : k === 3 ? 'three times' : '10 times') + ' as long. How many of the old fields fit inside the new one?', suf: 'fields', a: k * k, baits: [k], why: 'It gets ' + k + ' times longer and ' + k + ' times wider: ' + k + ' × ' + k + ' = ' + (k * k) + '.', v: { t: 'scaling', mode: 'square', k: k } };
  });

  fam('coins', 2, function (r) {
    const s = pick(r, [['You roll two dice', 'they show the same number', 6], ['Two friends each pick a day of the week at random', 'they pick the same day', 7], ['Two people each pick a number from 1 to 10 at random', 'they pick the same number', 10], ['Two people play rock, paper, scissors, each throwing at random', 'they throw the same thing', 3]]);
    return { q: s[0] + '. The chance ' + s[1] + ' is 1 in what?', pre: '1 in ', a: s[2], baits: [s[2] * s[2]], why: 'Whatever the first one is, the second has a 1 in ' + s[2] + ' chance of matching it.', v: { t: 'coins', mode: 'match', n: s[2] } };
  });

  fam('pigeon', 2, function (r, turn) {
    if (typeof turn === 'number' ? turn % 5 === 4 : r() < 0.2) return { q: 'You flip a coin 3 times. What is the % chance that at least two of the flips match?', suf: '%', a: 100, baits: [50, 75, 25], why: 'There are only two faces. With three flips, two of them have to land the same way.', v: { t: 'pigeon', mode: 'coins' } };
    const p = walk(r, turn, [['were born in the same month', 12, 'a different month'], ['were born on the same day of the week', 7, 'a different day'], ['have the same star sign', 12, 'a different sign'], ['have a first name starting with the same letter', 26, 'a different letter']]);
    return { q: 'How many people do you need in a room to be certain that two of them ' + p[0] + '?', suf: 'people', a: p[1] + 1, baits: [p[1], 2], why: p[1] + ' people could each have ' + p[2] + '. Person ' + (p[1] + 1) + ' has to match somebody.', v: { t: 'pigeon', k: p[1] } };
  });

  fam('compound', 2, function (r) {
    if (r() < 0.4) {
      const g = pick(r, [10, 20, 50]), s = pick(r, ['A town grows by ' + g + '% one year and by ' + g + '% again the next. By what % has it grown over the two years?', 'A rent goes up ' + g + '% this year and another ' + g + '% next year. By what % has it gone up in total?']);
      return { q: s, suf: '%', a: (100 + g) * (100 + g) / 100 - 100, baits: [2 * g], why: '100 becomes ' + (100 + g) + ', and the second ' + g + '% is taken on that bigger number: ' + num((100 + g) * (100 + g) / 100) + '.', v: { t: 'compound', mode: 'growth', p: g } };
    }
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
    const p = pick(r, [[150, 50, 80], [120, 30, 40], [200, 50, 80], [180, 45, 60], [90, 30, 50], [240, 60, 90]]);
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
    return { q: 'A thief steals a ' + eur(S) + ' note from a shop till. He then buys ' + eur(G) + ' of goods there with it and gets ' + eur(S - G) + ' change. How much is the shop down?', pre: '€', a: S, baits: [S + (S - G), S + G, 2 * S, G, S - G], why: 'The purchase is a fair swap, so ignore it. The shop is down the ' + eur(S) + ' he stole: ' + eur(G) + ' in goods and ' + eur(S - G) + ' in change.', v: { t: 'till', S: S, G: G } };
  });

  fam('speed', 3, function (r) {
    const p = pick(r, [[30, 60, 60], [10, 30, 30], [20, 30, 60], [40, 60, 120], [60, 120, 120], [20, 60, 60]]);
    const a = p[0], b = p[1], L = p[2], hrs = L / a + L / b, s = pick(r, b <= 30 ? [['cycle to the beach', 'cycle home'], ['cycle to school', 'cycle home']] : [['drive to work', 'drive home'], ['drive to the coast', 'drive home']]);
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

  /* ---------- The second bank: each one its own kind of trap ---------- */

  fam('addup', 1, function (r, turn) {
    const p = walk(r, turn, [[1000, 40, 1000, 30, 1000, 20, 1000, 10], [1000, 20, 1000, 30, 1000, 40, 1000, 10], [1000, 50, 1000, 30, 1000, 20], [2000, 40, 1000, 30, 1000, 20, 1000, 10]]);
    let sum = 0; p.forEach(function (x) { sum += x; });
    const last = p[p.length - 1], bait = Math.ceil(sum / 1000) * 1000;
    return { q: 'Add these up in your head, in order: ' + p.map(num).join(' + ') + '.', a: sum, baits: [bait], why: 'Before the last step you are on ' + num(sum - last) + '. Adding ' + last + ' tips the tens over into a new hundred, not a new thousand: ' + num(sum) + '.', v: { t: 'addup', parts: p } };
  });

  fam('bidmas', 1, function (r, turn) {
    const p = walk(r, turn, [[2, 2, 2], [3, 3, 3], [5, 5, 5], [1, 2, 3], [4, 4, 4], [2, 3, 4]]);
    const a = p[0] + p[1] * p[2];
    return { q: 'What is ' + p[0] + ' + ' + p[1] + ' × ' + p[2] + '?', a: a, baits: [(p[0] + p[1]) * p[2]], why: 'Multiplying comes before adding. ' + p[1] + ' × ' + p[2] + ' = ' + (p[1] * p[2]) + ', then ' + p[0] + ' + ' + (p[1] * p[2]) + ' = ' + a + '.', v: { t: 'bidmas', a: p[0], b: p[1], c: p[2] } };
  });

  fam('count', 1, function (r, turn) {
    const m = walk(r, turn, ['two', 'odd', 'three']);
    if (m === 'two') return { q: 'How many two-digit numbers are there?', a: 90, baits: [99, 100, 89, 91], why: 'They run from 10 to 99. That is all 99 numbers up to 99, less the 9 with one digit.', v: { t: 'count', mode: 'two', lo: 10, hi: 99 } };
    if (m === 'three') return { q: 'How many three-digit numbers are there?', a: 900, baits: [999, 1000, 899, 901], why: 'They run from 100 to 999. That is all 999 numbers up to 999, less the 99 that are shorter.', v: { t: 'count', mode: 'three', lo: 100, hi: 999 } };
    const N = pick(r, [99, 199, 999]);
    return { q: 'How many odd numbers are there from 1 to ' + N + '?', a: (N + 1) / 2, baits: [(N - 1) / 2], why: 'The list starts and ends on an odd number, so the odds win by one: ' + ((N + 1) / 2) + ' odd and ' + ((N - 1) / 2) + ' even.', v: { t: 'count', mode: 'odd', lo: 1, hi: N, odd: 1 } };
  });

  fam('tunnel', 1, function (r, turn) {
    const p = walk(r, turn, [[1, 1], [1, 2], [2, 2], [1, 3]]), L = p[0], T = p[1];
    return { q: 'A train ' + L + ' km long drives into a tunnel ' + T + ' km long at 1 km a minute. How many minutes until the whole train is out the other side?', suf: 'minutes', a: L + T, baits: [T], why: 'After ' + T + ' ' + pl(T, 'minute', 'minutes') + ' only the front is out. The back still has the train’s own ' + L + ' km to go.', v: { t: 'tunnel', L: L, T: T } };
  });

  fam('bogof', 1, function (r, turn) {
    const p = walk(r, turn, [50, 20, 40, 60]);
    return { q: 'A shop offers “buy one, get the second ' + (p === 50 ? 'half price' : p + '% off') + '”. What % do you save on the pair?', suf: '%', a: p / 2, baits: [p], why: 'Only one of the two is cheaper. Two €10 items cost ' + eur(20 - p / 10) + ' instead of €20, and ' + eur(p / 10) + ' off €20 is ' + (p / 2) + '%.', v: { t: 'offers', got: 2, paid: 2 - p / 100 } };
  });

  fam('eleven', 1, function (r, turn) {
    const p = walk(r, turn, [['eleven', 11], ['twelve', 12], ['thirteen', 13]]), n = p[1];
    return { q: 'Write this as a number: ' + p[0] + ' thousand, ' + p[0] + ' hundred and ' + p[0] + '.', a: n * 1000 + n * 100 + n, baits: [n * 1000 + (n % 10) * 100 + n, n * 10000 + n * 100 + n], why: p[0].charAt(0).toUpperCase() + p[0].slice(1) + ' hundred is ' + num(n * 100) + ', which spills into the thousands: ' + num(n * 1000) + ' + ' + num(n * 100) + ' + ' + n + ' = ' + num(n * 1000 + n * 100 + n) + '.', v: { t: 'eleven', n: n } };
  });

  fam('agesum', 1, function (r, turn) {
    const p = walk(r, turn, [['Two brothers’ ages', 2, 11, 5], ['Three sisters’ ages', 3, 20, 4], ['A mother’s and her son’s ages', 2, 40, 10], ['Two twins’ ages', 2, 12, 6]]);
    return { q: p[0] + ' add up to ' + p[2] + '. What will they add up to in ' + p[3] + ' years?', a: p[2] + p[1] * p[3], baits: [p[2] + p[3]], why: 'Each of the ' + p[1] + ' gets ' + p[3] + ' years older, so the total grows by ' + (p[1] * p[3]) + ', not ' + p[3] + '.', v: { t: 'agesum', n: p[1], sum: p[2], y: p[3] } };
  });

  fam('glue', 1, function (r, turn) {
    const n = walk(r, turn, [2, 3, 2, 4]);
    return { q: n === 2 ? 'You glue two dice together, face to face. How many faces are left showing?' : 'You glue ' + n + ' dice together in a row, face to face. How many faces are left showing?', suf: 'faces', a: 6 * n - 2 * (n - 1), baits: [6 * n, 6 * n - (n - 1)], why: 'Every join hides two faces, one on each dice. ' + (6 * n) + ' − ' + (2 * (n - 1)) + ' = ' + (6 * n - 2 * (n - 1)) + '.', v: { t: 'glue', n: n } };
  });

  fam('string', 1, function (r, turn) {
    const n = walk(r, turn, [1, 2, 1, 3]), strands = Math.pow(2, n);
    return { q: 'You fold a piece of string in half' + (n === 1 ? '' : n === 2 ? ', then in half again,' : ' three times over') + ' and cut straight through all the strands. How many pieces of string do you have?', suf: 'pieces', a: strands + 1, baits: [strands, 2 * strands], why: 'The cut goes through ' + strands + ' strands, so the string is cut in ' + strands + ' places. ' + strands + ' cuts make ' + (strands + 1) + ' pieces.', v: { t: 'string', n: n } };
  });

  fam('jar', 2, function (r, turn) {
    const p = walk(r, turn, [[1000, 600], [900, 500], [800, 500], [1200, 700]]), half = p[0] - p[1], jar = p[0] - 2 * half;
    return { q: 'A jar full of honey weighs ' + num(p[0]) + ' g. Half full, it weighs ' + p[1] + ' g. How much does the empty jar weigh?', suf: 'g', a: jar, baits: [half], why: 'The ' + half + ' g that went missing is half the honey. All the honey is ' + (2 * half) + ' g, which leaves ' + jar + ' g for the jar.', v: { t: 'jar', full: p[0], half: p[1] } };
  });

  fam('grid', 2, function (r, turn) {
    const n = walk(r, turn, [3, 4]);
    const w = pick(r, ['A ' + n + ' by ' + n + ' grid is made of ' + (n * n) + ' small squares. Counting squares of every size, how many squares are in it?', 'A window has ' + (n * n) + ' small square panes, ' + n + ' across and ' + n + ' down. Counting squares of every size, how many squares can you find in it?', 'A chocolate bar is ' + n + ' squares by ' + n + '. Counting squares of every size, big ones included, how many squares are on it?']);
    return { q: w, suf: 'squares', a: n === 3 ? 14 : 30, baits: n === 3 ? [9, 10] : [16, 17], why: n === 3 ? '9 small ones, 4 that are 2 by 2, and the whole thing: 9 + 4 + 1 = 14.' : '16 small ones, 9 that are 2 by 2, 4 that are 3 by 3, and the whole thing: 16 + 9 + 4 + 1 = 30.', v: { t: 'squares', mode: n === 3 ? 'three' : 'four', n: n } };
  });

  fam('workrate', 2, function (r, turn) {
    const p = walk(r, turn, [[6, 3], [12, 4], [12, 6], [20, 5], [30, 6]]), a = p[0], b = p[1], t = a * b / (a + b);
    const s = pick(r, [['One hose fills a pool in ' + a + ' hours. A bigger hose fills it in ' + b + '. How many hours do they take together?', 'pool', 'pools'], ['Ann paints a fence in ' + a + ' hours. Ben paints it in ' + b + '. How many hours do they take working together?', 'fence', 'fences']]);
    return { q: s[0], suf: 'hours', a: t, baits: [(a + b) / 2, a + b], why: 'In ' + a + ' hours the slow one does 1 ' + s[1] + ' and the fast one ' + (a / b) + '. That is ' + (a / b + 1) + ' ' + s[2] + ' in ' + a + ' hours, so ' + t + ' hours for one.', v: { t: 'workrate', x: a, y: b } };
  });

  fam('wavg', 2, function (r, turn) {
    const p = walk(r, turn, [[10, 60, 30, 80], [20, 50, 60, 70], [10, 40, 40, 90], [25, 60, 75, 80]]), tot = p[0] * p[1] + p[2] * p[3], N = p[0] + p[2];
    return { q: 'A class of ' + p[0] + ' averages ' + p[1] + ' in a test. A class of ' + p[2] + ' averages ' + p[3] + '. What is the average across all ' + N + ' pupils?', a: tot / N, baits: [(p[1] + p[3]) / 2], why: 'The bigger class counts for more. All the marks together: ' + p[0] + ' × ' + p[1] + ' + ' + p[2] + ' × ' + p[3] + ' = ' + num(tot) + ', and ' + num(tot) + ' ÷ ' + N + ' = ' + (tot / N) + '.', v: { t: 'weighted', n1: p[0], a1: p[1], n2: p[2], a2: p[3] } };
  });

  fam('liftavg', 2, function (r, turn) {
    const p = walk(r, turn, [[4, 80, 90], [3, 70, 80], [4, 60, 70], [9, 50, 55]]), n = p[0], need = p[2] * (n + 1) - p[1] * n;
    return { q: 'After ' + n + ' rounds of darts you average ' + p[1] + ' a round. What must you score in the next round to lift your average to ' + p[2] + '?', a: need, baits: [2 * p[2] - p[1], p[2]], why: (n + 1) + ' rounds averaging ' + p[2] + ' is ' + (p[2] * (n + 1)) + ' in all. You have ' + (p[1] * n) + ', so you need ' + need + '. One round has to lift all ' + n + ' old ones.', v: { t: 'liftavg', n: n, avg: p[1], target: p[2] } };
  });

  fam('around', 2, function (r, turn) {
    if (typeof turn === 'number' ? turn % 2 === 0 : r() < 0.5) {
      const s = pick(r, [10, 20, 8, 12]);
      return { q: 'A square lawn ' + s + ' m by ' + s + ' m has a path 1 m wide all the way round the outside. What is the area of the path?', suf: 'm²', a: 4 * s + 4, baits: [4 * s], why: 'Four strips of ' + s + ' m² make ' + (4 * s) + ', and each of the 4 corners adds 1 m² more. Check: ' + (s + 2) + ' × ' + (s + 2) + ' − ' + s + ' × ' + s + ' = ' + (4 * s + 4) + '.', v: { t: 'around', mode: 'path', s: s } };
    }
    const n = pick(r, [10, 5, 8, 12, 20]);
    return { q: 'A square pen has ' + n + ' fence posts along each side, counting the post at each corner. How many posts does it have in all?', suf: 'posts', a: 4 * n - 4, baits: [4 * n], why: '4 × ' + n + ' = ' + (4 * n) + ' counts each corner post twice, once for each side it is on. Take 4 off: ' + (4 * n - 4) + '.', v: { t: 'around', mode: 'posts', n: n } };
  });

  fam('presale', 2, function (r, turn) {
    const p = walk(r, turn, [[80, 20], [60, 25], [90, 10], [30, 50], [120, 20]]), was = p[0] * 100 / (100 - p[1]);
    return { q: 'A jacket costs ' + eur(p[0]) + ' in a ' + p[1] + '% off sale. What was the price before the sale?', pre: '€', a: was, baits: [p[0] * (100 + p[1]) / 100], why: eur(p[0]) + ' is ' + (100 - p[1]) + '% of the old price, so the old price was ' + eur(was) + '. Adding ' + p[1] + '% back onto ' + eur(p[0]) + ' falls short, because ' + p[1] + '% of the sale price is smaller.', v: { t: 'presale', after: p[0], p: p[1] } };
  });

  fam('pctpoints', 2, function (r, turn) {
    const p = walk(r, turn, [['A bank lifts its interest rate from 2% to 3%. By what % has the rate gone up?', 2, 3], ['A party’s support climbs from 10% to 15% in the polls. By what % has its support grown?', 10, 15], ['A tax goes from 4% to 5%. By what % has the tax gone up?', 4, 5], ['A team’s win rate rises from 20% to 30%. By what % has it improved?', 20, 30]]);
    const d = p[2] - p[1], up = d / p[1] * 100;
    return { q: p[0], suf: '%', a: up, baits: [d], why: 'It rose by ' + d + ' percentage ' + pl(d, 'point', 'points') + ', but ' + d + ' is ' + up + '% of ' + p[1] + '. Points and percent are different things.', v: { t: 'pctpoints', f: p[1], to: p[2] } };
  });

  fam('ladder', 2, function (r, turn) {
    const p = walk(r, turn, [[4, 30, 3], [3, 25, 4], [5, 20, 2]]);
    return { q: 'A ladder hangs from a ship with its bottom ' + p[0] + ' rungs under water. The rungs are ' + p[1] + ' cm apart and the tide rises ' + p[1] + ' cm an hour. How many rungs are under water after ' + p[2] + ' hours?', suf: 'rungs', a: p[0], baits: [p[0] + p[2]], why: 'Still ' + p[0] + '. The ship floats, so the ladder rises with the tide.', v: { t: 'ladder', k: p[0], g: p[1], h: p[2] } };
  });

  fam('weekend', 2, function (r, turn) {
    const s = walk(r, turn, [['Saturday and Sunday each have a 50% chance of rain, and one day does not affect the other. What is the % chance it rains at some point over the weekend?', 'It stays dry only if both days are dry: half of a half, 25%. So rain at some point is 75%.'], ['You flip two coins. What is the % chance that at least one lands heads?', 'Only one of the four outcomes has no head: tails and tails. The other three do, and 3 in 4 is 75%.'], ['A striker scores in half of his games, whatever happened in the last one. He plays twice this week. What is the % chance he scores in at least one of them?', 'He draws a blank in both only a quarter of the time: half of a half. So he scores in at least one 75% of the time.']]);
    return { q: s[0], suf: '%', a: 75, baits: [100, 50], why: s[1], v: { t: 'weekend' } };
  });

  fam('chain', 3, function (r, turn) {
    const p = walk(r, turn, [[5, 3], [4, 2], [6, 4]]), n = p[0], m = p[1];
    return { q: 'A jeweller has ' + n + ' pieces of chain, each ' + m + ' links long. What is the fewest links she must cut open to join them into one long chain?', suf: 'links', a: n - 2, baits: [n - 1, n], why: 'Open ' + (m === 2 ? 'both' : 'all ' + m) + ' links of one piece and use them to join the other ' + (n - 1) + ' pieces. Joining the pieces end to end the obvious way takes ' + (n - 1) + ' cuts.', v: { t: 'chain', n: n, m: m } };
  });

  fam('triangle', 3, function (r, turn) {
    const p = walk(r, turn, [[3, 4, 7, 6], [5, 12, 17, 30], [6, 8, 14, 24], [2, 3, 5, 3]]);
    return { q: 'A triangle has sides of ' + p[0] + ' cm, ' + p[1] + ' cm and ' + p[2] + ' cm. What is its area?', suf: 'cm²', a: 0, baits: [p[3]], baitAbove: 0, why: p[0] + ' + ' + p[1] + ' = ' + p[2] + ', so the two short sides only just reach along the long one. It is a flat line, with no area at all.', v: { t: 'triangle', a: p[0], b: p[1], c: p[2] } };
  });

  fam('slowclock', 3, function (r, turn) {
    const L = walk(r, turn, [10, 12, 20, 15]), real = 3600 / (60 - L);
    return { q: 'A clock loses ' + L + ' minutes every hour. You set it right at noon. When it shows 1:00, how many minutes past 1 is it really?', suf: 'minutes', a: real - 60, baits: [L], why: 'It only moves ' + (60 - L) + ' minutes in a real hour, so showing 60 takes ' + real + ' real minutes. It keeps losing time during the extra minutes too.', v: { t: 'slowclock', L: L } };
  });

  fam('zeros', 3, function (r, turn) {
    const p = walk(r, turn, [[10, 2, [1], 'two 5s, in 5 and 10'], [20, 4, [2], 'four 5s, in 5, 10, 15 and 20'], [25, 6, [5, 2], 'six 5s, because 25 is 5 × 5 and counts twice'], [15, 3, [1], 'three 5s, in 5, 10 and 15']]);
    return { q: 'How many zeros are at the end of 1 × 2 × 3 × … × ' + p[0] + '?', suf: 'zeros', a: p[1], baits: p[2], why: 'Every zero at the end needs a 2 and a 5. There are plenty of 2s but only ' + p[3] + '.', v: { t: 'zeros', n: p[0] } };
  });

  fam('boxes', 3, function (r, turn) {
    const s = walk(r, turn, [['Apples, Oranges and Mixed', 'fruits', 'fruit'], ['Black socks, White socks and Mixed', 'socks', 'sock'], ['Gold coins, Silver coins and Mixed', 'coins', 'coin']]);
    return { q: 'Three boxes are labelled ' + s[0] + ', and every label is wrong. What is the fewest ' + s[1] + ' you must take out to know what is in all three?', suf: s[1], a: 1, baits: [2, 3], why: 'Take one ' + s[2] + ' from the box labelled Mixed. That box cannot be mixed, so the ' + s[2] + ' names it, and the other two labels can then only go one way.', v: { t: 'boxes' } };
  });

  fam('brothers', 3, function (r, turn) {
    const k = walk(r, turn, [2, 3]), g = k === 2 ? 4 : 3, b = g - 1;
    return { q: 'A girl has as many brothers as sisters. Each of her brothers has ' + (k === 2 ? 'twice' : 'three times') + ' as many sisters as brothers. How many children are in the family?', suf: 'children', a: g + b, baits: [g + b - 1], why: g + ' girls and ' + b + ' boys. A girl has ' + (g - 1) + ' sisters and ' + b + ' brothers. A boy has ' + g + ' sisters and ' + (b - 1) + ' ' + pl(b - 1, 'brother', 'brothers') + '.', v: { t: 'brothers', k: k } };
  });

  fam('tyres', 3, function (r, turn) {
    const D = walk(r, turn, [20000, 10000, 50000, 30000]);
    return { q: 'A car has 5 tyres: 4 on the road and 1 spare. They are swapped round so each is used equally. After ' + num(D) + ' km, how far has each tyre travelled?', suf: 'km', a: D * 4 / 5, baits: [D / 5, D, D / 4], why: 'Four tyres are on the road at any time, so they share 4 × ' + num(D) + ' = ' + num(4 * D) + ' km between the five of them: ' + num(D * 4 / 5) + ' km each.', v: { t: 'tyres', D: D } };
  });

  fam('piles', 3, function (r, turn) {
    const k = walk(r, turn, [10, 9, 15, 11, 8]);
    return { q: 'You split a shuffled pack of 52 cards into two piles of 26. Your pile has ' + k + ' red cards. How many black cards are in the other pile?', suf: 'cards', a: k, baits: [26 - k], why: 'The pack has 26 reds, so the other pile holds ' + (26 - k) + ' of them. The rest of its 26 cards are black: ' + k + ', always the same as your reds.', v: { t: 'piles', k: k } };
  });

  fam('bridge', 3, function (r) {
    const t = pick(r, [[1, 2, 5, 10, 17, 19], [1, 2, 7, 10, 17, 21], [1, 3, 6, 8, 18, 19]]);
    return { q: 'Four friends cross a bridge at night sharing one torch, two at a time at the slower one’s pace. They take ' + t[0] + ', ' + t[1] + ', ' + t[2] + ' and ' + t[3] + ' minutes. What is the fastest all four can cross?', suf: 'minutes', a: t[4], baits: [t[5]], why: 'Send the two slowest over together, so the slow walk happens once, and let the two fastest ferry the torch back.', v: { t: 'bridge', times: t.slice(0, 4) } };
  });

  /* ---------- Third batch: thirteen more ideas, so an idea takes longer to come round ---------- */

  fam('magnify', 1, function (r, turn) {
    const p = walk(r, turn, [[30, 3], [20, 2], [15, 10], [45, 2], [25, 4]]);
    return { q: 'A magnifying glass makes everything look ' + p[1] + ' times bigger. Through it, how big does a ' + p[0] + '° angle look?', suf: '°', a: p[0], baits: [p[0] * p[1]], why: 'The lines look longer, but the corner between them opens no wider. An angle is the same at any size.', v: { t: 'magnify', deg: p[0], k: p[1] } };
  });

  fam('triple', 1, function (r, turn) {
    const p = walk(r, turn, [['A price triples', 3, 'has it gone up'], ['A queue grows to 4 times its length', 4, 'has it grown'], ['A town doubles in size', 2, 'has it grown'], ['A video’s views grow to 5 times what they were', 5, 'have they grown'], ['A crowd triples', 3, 'has it grown']]);
    return { q: p[0] + '. By what % ' + p[2] + '?', suf: '%', a: (p[1] - 1) * 100, baits: [p[1] * 100], why: p[1] + ' times as much is ' + (p[1] * 100) + '% of what it was. The rise is only the part on top of the original 100%: ' + ((p[1] - 1) * 100) + '%.', v: { t: 'triple', k: p[1] } };
  });

  fam('hourhand', 1, function (r, turn) {
    const p = walk(r, turn, [['a day', 24, [24, 1, 12]], ['a week', 168, [7, 168]], ['two days', 48, [2, 48]]]);
    return { q: 'How many times does the hour hand of a clock go all the way round in ' + p[0] + '?', suf: 'times', a: p[1] / 12, baits: p[2], why: 'The hour hand takes 12 hours to go round once, not 24, so it goes round twice a day' + (p[1] > 24 ? ': ' + (p[1] / 12) + ' times in ' + p[0] : '') + '.', v: { t: 'hourhand', hours: p[1] } };
  });

  fam('decimaltime', 1, function (r, turn) {
    const p = walk(r, turn, [['A train journey takes', 1, 20], ['A film runs for', 2, 10], ['A flight takes', 1, 40], ['Your timesheet says you worked', 1, 25], ['A marathon runner finishes in', 2, 20]]);
    const whole = p[1], frac = p[2], hrs = whole + '.' + (frac % 10 === 0 ? frac / 10 : frac), mins = frac * 60 / 100;
    return { q: p[0] + ' ' + hrs + ' hours. How many minutes is that?', suf: 'minutes', a: whole * 60 + mins, baits: [whole * 60 + frac, whole * 100 + frac], why: 'The part after the point is a fraction of an hour, not minutes: 0.' + (frac % 10 === 0 ? frac / 10 : frac) + ' of 60 minutes is ' + mins + '. So ' + (whole * 60) + ' + ' + mins + ' = ' + (whole * 60 + mins) + ', not ' + whole + ' ' + pl(whole, 'hour', 'hours') + ' ' + frac + '.', v: { t: 'decimaltime', h: hrs } };
  });

  fam('combos', 2, function (r, turn) {
    if (walk(r, turn, ['dials', 'scores']) === 'dials') {
      const p = pick(r, [['A bike lock', 3], ['A suitcase lock', 3], ['A safe', 4], ['A cash box', 2]]), n = p[1], all = Math.pow(10, n);
      return { q: p[0] + ' has ' + n + ' dials, each numbered 0 to 9. How many different codes can it be set to?', suf: 'codes', a: all, baits: [10 * n, all - 1, Math.pow(9, n)], why: 'Every setting of one dial can go with every setting of the others, so you multiply: ' + new Array(n).fill('10').join(' × ') + ' = ' + num(all) + '. That is every number from ' + new Array(n).fill('0').join('') + ' to ' + new Array(n).fill('9').join('') + '.', v: { t: 'combos', mode: 'dials', n: n } };
    }
    const p = pick(r, [[3, 2], [2, 1], [4, 1], [3, 3], [2, 2]]), a = p[0], b = p[1];
    const list = function (k) { const out = []; for (let i = 0; i <= k; i++) out.push(i); return out.length > 2 ? out.slice(0, -1).join(', ') + ' or ' + k : out.join(' or '); };
    return { q: 'A football match ends ' + a + '–' + b + '. How many different half-time scores were possible?', suf: 'scores', a: (a + 1) * (b + 1), baits: [a * b, a + b, (a + 1) * (b + 1) - 1], why: 'One side could have had ' + list(a) + ' at half-time, and the other ' + list(b) + '. Any pairing is possible: ' + (a + 1) + ' × ' + (b + 1) + ' = ' + ((a + 1) * (b + 1)) + '. That includes 0–0.', v: { t: 'combos', mode: 'scores', a: a, b: b } };
  });

  fam('step', 2, function (r, turn) {
    if (walk(r, turn, ['carpet', 'notch']) === 'carpet') {
      const p = pick(r, [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 6, 10]]), up = p[0], along = p[1];
      return { q: 'A carpet runs up a staircase, covering the top and the front of every step. From end to end the staircase goes ' + along + ' m along and ' + up + ' m up. How many metres of carpet does it take?', suf: 'm', a: up + along, baits: [p[2]], why: 'Add up the tops of all the steps and you get the ' + along + ' m along. Add up the fronts and you get the ' + up + ' m up. That is ' + (up + along) + ' m, however many steps there are. The ' + p[2] + ' m slope is a shortcut the carpet does not take.', v: { t: 'step', mode: 'carpet', up: up, along: along } };
    }
    const p = pick(r, [[10, 3], [12, 4], [20, 5], [8, 2]]), S = p[0], c = p[1];
    return { q: 'A square garden is ' + S + ' m by ' + S + ' m. A ' + c + ' m by ' + c + ' m square is cut out of one corner for a pond. How long is the fence round what is left?', suf: 'm', a: 4 * S, baits: [4 * S - 2 * c, 4 * S - 4 * c], why: 'The cut takes ' + c + ' m off each of two sides, but its own two edges put the same ' + c + ' m and ' + c + ' m back. The fence is still 4 × ' + S + ' = ' + (4 * S) + ' m.', v: { t: 'step', mode: 'notch', S: S, c: c } };
  });

  fam('cake', 2, function (r, turn) {
    const s = walk(r, turn, ['a round cake', 'a block of cheese', 'a watermelon', 'a square cake']);
    return { q: 'What is the fewest straight cuts that will divide ' + s + ' into 8 equal pieces?', suf: 'cuts', a: 3, baits: [4, 7, 8], why: 'Two cuts from above make 4 pieces. One more, flat through the middle from the side, turns the 4 into 8. Nobody said every cut had to come from above.', v: { t: 'cake', n: 8 } };
  });

  fam('eitheror', 2, function (r, turn) {
    if (walk(r, turn, ['cards', 'numbers']) === 'cards') {
      const p = pick(r, [['a heart', 'an ace', 13, 4, 1, '13 hearts and 4 aces', 'the ace of hearts is', 'H', 'A'], ['a spade', 'a king', 13, 4, 1, '13 spades and 4 kings', 'the king of spades is', 'S', 'K'], ['red', 'a queen', 26, 4, 2, '26 red cards and 4 queens', 'the two red queens are', 'red', 'Q'], ['a diamond', 'a jack, queen or king', 13, 12, 3, '13 diamonds and 12 jacks, queens and kings', 'the three in diamonds are', 'D', 'pic']]);
      return { q: 'In a pack of 52 playing cards, how many are ' + p[0] + ' or ' + p[1] + '?', suf: 'cards', a: p[2] + p[3] - p[4], baits: [p[2] + p[3]], why: 'There are ' + p[5] + ', but ' + p[6] + ' in both lists. Count ' + (p[4] === 1 ? 'it' : 'them') + ' once: ' + p[2] + ' + ' + p[3] + ' − ' + p[4] + ' = ' + (p[2] + p[3] - p[4]) + '.', v: { t: 'eitheror', mode: 'cards', suit: p[7], rank: p[8] } };
    }
    const p = pick(r, [[2, 5, 100], [5, 10, 100], [2, 3, 30], [3, 5, 30], [2, 10, 100]]), x = p[0], y = p[1], N = p[2];
    const nx = Math.floor(N / x), ny = Math.floor(N / y), lcm = y % x === 0 ? y : x * y, both = Math.floor(N / lcm);
    return { q: 'How many of the numbers from 1 to ' + N + ' divide exactly by ' + x + ' or by ' + y + '?', a: nx + ny - both, baits: [nx + ny], why: nx + ' of them divide by ' + x + ' and ' + ny + ' by ' + y + ', but ' + both + ' divide by both and are in each list. Count those once: ' + nx + ' + ' + ny + ' − ' + both + ' = ' + (nx + ny - both) + '.', v: { t: 'eitheror', mode: 'numbers', x: x, y: y, N: N } };
  });

  fam('headstart', 3, function (r, turn) {
    const p = walk(r, turn, [[100, 10], [100, 20], [200, 20], [50, 10]]), L = p[0], d = p[1], gap = d * d / L;
    return { q: 'You beat a friend by ' + d + ' m in a ' + L + ' m race. In the rematch you start ' + d + ' m behind the start line, and you both run exactly as fast as before. How many metres ahead are you when you finish?', suf: 'm', a: gap, baits: [0, d], why: 'It is not a dead heat. You draw level ' + d + ' m from the finish, because that is where you both were when you won the first race. You are still the faster runner over those last ' + d + ' m, so you finish ' + num(gap) + ' m clear.', v: { t: 'headstart', L: L, d: d } };
  });

  fam('dicestack', 3, function (r, turn) {
    const n = walk(r, turn, [3, 2, 4, 3]), top = 1 + Math.floor(r() * 6), word = ['Two', 'Three', 'Four'][n - 2];
    return { q: 'Opposite faces of a dice add up to 7. ' + word + ' dice are stacked in a tower with a ' + top + ' on top. What do the ' + (2 * n - 1) + ' faces hidden between and under the dice add up to?', a: 7 * n - top, baits: [7 * n, 7 * (n - 1)], why: 'The top and bottom of each dice add up to 7, so the ' + word.toLowerCase() + ' pairs make ' + (7 * n) + '. The only one of those faces you can see is the ' + top + ' on top: ' + (7 * n) + ' − ' + top + ' = ' + (7 * n - top) + '.', v: { t: 'dicestack', n: n, top: top } };
  });

  fam('hat', 3, function (r, turn) {
    const m = walk(r, turn, [10, 20, 15, 5]);
    return { q: 'Rowing up a river, you drop your hat in the water. You notice ' + m + ' minutes later, turn round at once and row after it just as hard. How many minutes until you reach the hat?', suf: 'minutes', a: m, baits: [m / 2, 2 * m], why: 'Watch from the water, not the bank. The hat floats where it fell while you row away from it for ' + m + ' minutes, so rowing back takes the same ' + m + '. The current carries you and the hat along equally.', v: { t: 'hat', m: m } };
  });

  fam('bags', 3, function (r, turn) {
    const p = walk(r, turn, [[10, 'bags'], [5, 'purses'], [8, 'sacks']]), n = p[0];
    return { q: n + ' ' + p[1] + ' hold ' + n + ' coins each. A coin weighs 10 g, but in one of the ' + p[1] + ' every coin weighs 11 g. With a scale that shows the weight in grams, what is the fewest weighings sure to find it?', suf: 'weighings', a: 1, baits: [n, n - 1, 4, 3, 2], why: 'Take 1 coin from the first, 2 from the second, 3 from the third and so on, and weigh them all together. The number of grams over tells you which one: 3 g over means the third.', v: { t: 'bags', n: n } };
  });

  fam('loaves', 3, function (r, turn) {
    const p = walk(r, turn, [[5, 3], [7, 5], [3, 2], [4, 2]]), a = p[0], b = p[1], ga = 2 * a - b, gb = 2 * b - a;
    return { q: 'One shepherd has ' + a + ' loaves, another has ' + b + '. A traveller joins them, the three share the bread equally, and he pays ' + (a + b) + ' coins for his share. How many coins should the shepherd with ' + a + ' loaves get?', suf: 'coins', a: ga, baits: [a, (a + b) / 2], why: 'Cut every loaf in three. Each person eats ' + (a + b) + ' thirds. The first shepherd had ' + (3 * a) + ' thirds and gave the traveller ' + ga + '; the other had ' + (3 * b) + ' and gave ' + gb + '. So the coins split ' + ga + ' and ' + gb + ', not ' + a + ' and ' + b + '.', v: { t: 'loaves', a: a, b: b } };
  });

  fam('untilaboy', 3, function (r, turn) {
    const p = walk(r, turn, [['a boy', 'boys'], ['a girl', 'girls']]);
    return { q: 'In one country every couple keeps having children until they have ' + p[0] + ', then stops. Boys and girls are equally likely at every birth. What % of the children are ' + p[1] + '?', suf: '%', a: 50, baits: [33, 25, 67, 75, 100], baitBelow: 50, baitAbove: 50, why: 'Every birth is still a coin flip, whatever rule the parents follow. Half of all first-borns are ' + p[1] + ', half of all second-borns, and so on: 50% overall.', v: { t: 'untilaboy' } };
  });

  fam('stick', 3, function (r, turn) {
    const p = walk(r, turn, [['1 m stick', 100, 'shorter'], ['60 cm breadstick', 60, 'shorter'], ['1 m stick', 100, 'longer'], ['2 m plank', 200, 'shorter']]), L = p[1], short = p[2] === 'shorter';
    return { q: 'A ' + p[0] + ' is snapped in two at a random point. On average, how many cm long is the ' + p[2] + ' piece?', suf: 'cm', a: short ? L / 4 : 3 * L / 4, baits: [L / 2], why: 'The ' + p[2] + ' piece can be anything from ' + (short ? 0 : L / 2) + ' to ' + (short ? L / 2 : L) + ' cm, and every length in that range is equally likely. Its average is the middle of the range: ' + (short ? L / 4 : 3 * L / 4) + ' cm.', v: { t: 'stick', L: L, which: p[2] } };
  });


  /* ---------- Grades and sets ---------- */


  // How hard each kind is, 1 (an opener) to 5 (most people miss it). To move a kind, change its number here.
  const GRADE = {
    // 1: openers. Endless mode only.
    hands: 1, race: 1, dry: 1, listensheep: 1, listenstamps: 1, picturecats: 1, picturefathers: 1, picturemonths: 1, intervalsposts: 1, intervalscircle: 1,
    // 2: the first question of the day. One line, and the obvious answer is wrong.
    sumdiff: 2, siblinghalf: 2, siblingtwice: 2, corners: 2, divhalf: 2, doublinghalf: 2, queuequeue: 2, ratestime: 2, socksany: 2, till: 2,
    intervalsfloors: 2, intervalspills: 2, intervalsmonday: 2, scalingsquare: 2, scalingunits: 2,
    addup: 2, bidmas: 2, counttwo: 2, countthree: 2, countodd: 2, tunnel: 2, bogof: 2, eleven: 2, agesum: 2, glue: 2, string: 2,
    magnify: 2, triple: 2, hourhand: 2, decimaltime: 2, combosdials: 2,
    // 3: the second. Needs a second look.
    coinsmatch: 3, compounddiscount: 3, compoundgrowth: 3, cube: 3, doublingquarter: 3, doublingtwo: 3, downup: 3, intervalslog: 3,
    matchesknockout: 3, matchessnap: 3, matchesshake: 3, pigeon: 3, pigeoncoins: 3, punch: 3, scalingpizza: 3, scalingcube: 3, selfref: 3,
    jar: 3, gridthree: 3, workrate: 3, wavg: 3, liftavg: 3, aroundpath: 3, aroundposts: 3, presale: 3, ladder: 3, weekend: 3, pctpoints: 3,
    combosscores: 3, stepcarpet: 3, stepnotch: 3, cake: 3, eitherorcards: 3, eitherornumbers: 3,
    // 4: the third. Hard, but a minute of thought gets there.
    balance: 4, clock: 4, digitsappear: 4, fly: 4, intervalsclock: 4, ratescount: 4, ratesworkers: 4, refill: 4, reverse: 4, snail: 4, speedavg: 4, cuts: 4,
    chain: 4, triangle: 4, slowclock: 4, zeros: 4, gridfour: 4, boxes: 4, brothers: 4, tyres: 4, piles: 4,
    headstart: 4, dicestack: 4, hat: 4, bags: 4, loaves: 4, untilaboy: 4, stick: 4,
    // 5: most people miss these, or they need real working out. Endless mode only.
    baserate: 5, classiccable: 5, classiccards: 5, classiccoinroll: 5, classicmonty: 5, classicrope: 5, classictwokids: 5, clockopposite: 5, clockoverlap: 5,
    dilutionleave: 5, dilutionweigh: 5, lockers: 5, bridge: 5
  };
  // The family that makes a kind: the longest family id the kind's name starts with.
  function famOf(kind) {
    let best = null;
    F.forEach(function (f) { if (kind.indexOf(f.id) === 0 && (!best || f.id.length > best.id.length)) best = f; });
    return best;
  }
  function kindsAt(grade) { return Object.keys(GRADE).filter(function (k) { return GRADE[k] === grade; }); }

  // The idea behind a kind: the one trick it turns on. Two kinds with the same idea are the same
  // question in different clothes, so the calendar treats them as one and keeps them far apart.
  const IDEA = {
    pigeon: 'pigeonhole', pigeoncoins: 'pigeonhole', socksany: 'pigeonhole', reverse: 'pctbase', presale: 'pctbase',
    matchesknockout: 'minusone', matchessnap: 'minusone', matchesshake: 'handshake', punch: 'fold', string: 'fold',
    picturecats: 'cats', picturefathers: 'fathers', picturemonths: 'months',
    classiccable: 'cable', classiccoinroll: 'coinroll', classicrope: 'rope', classiccards: 'conditional', classicmonty: 'conditional', classictwokids: 'conditional',
    clock: 'clockangle', clockopposite: 'clockhands', clockoverlap: 'clockhands',
    cake: 'cuts', bags: 'balance'   // near enough in feel to share a slot: fewest cuts, fewest weighings
  };
  function ideaOf(kind) { return IDEA[kind] || (IDEA[kind] = famOf(kind).id); }
  // The corner of maths an idea lives in. A day never takes two from the same corner.
  const CORNER = {
    percent: ['downup', 'pctbase', 'compound', 'bogof', 'pctpoints', 'dilution', 'baserate', 'triple'],
    chance: ['coins', 'weekend', 'conditional', 'pigeonhole', 'untilaboy', 'stick'],
    average: ['wavg', 'liftavg', 'speed'],
    rate: ['rates', 'workrate', 'dry', 'tunnel', 'fly', 'slowclock', 'doubling', 'snail', 'tyres', 'headstart', 'hat'],
    gaps: ['intervals', 'count', 'around', 'minusone', 'queue', 'handshake', 'eitheror', 'combos'],
    shape: ['scaling', 'cube', 'grid', 'corners', 'triangle', 'cuts', 'fold', 'glue', 'coinroll', 'rope', 'cable', 'magnify', 'step', 'dicestack'],
    halves: ['sumdiff', 'selfref', 'jar', 'divhalf', 'sibling', 'agesum', 'brothers', 'loaves']
  };
  const DOMAIN = {};
  Object.keys(CORNER).forEach(function (c) { CORNER[c].forEach(function (id) { DOMAIN[id] = c; }); });
  function domainOf(kind) { return DOMAIN[ideaOf(kind)] || ''; }
  // What a question looks like on the surface. Two different tricks about a clock still feel alike
  // on consecutive days, so the calendar keeps kinds with the same look a week apart when it can.
  const LOOKS = {
    clock: ['hourhand', 'clock', 'slowclock', 'intervalsclock'], dice: ['glue', 'dicestack'], cards: ['piles', 'eitherorcards'],
    train: ['tunnel', 'fly'], age: ['siblinghalf', 'siblingtwice', 'agesum'], sale: ['bogof', 'compounddiscount', 'presale'],
    coin: ['pigeoncoins', 'balance', 'bags']
  };
  const LOOK = {}, LOOK_GAP = 7, JITTER = 3, APART = 5;
  Object.keys(LOOKS).forEach(function (l) { LOOKS[l].forEach(function (k) { LOOK[k] = l; }); });

  // The calendar. Each day takes one kind from grades 2, 3 and 4. For each slot it takes the kind
  // whose idea has been away longest, then the kind that has itself been away longest, so an idea
  // comes round as rarely as the bank allows and in different clothes each time.
  const TIERS = [2, 3, 4];
  // Days that have already been played, exactly as they were served: [kind, seed, turn] for each slot.
  // A day in this table can never change, whatever is added to the bank later. Before changing the
  // bank, run `node src/freeze.js` and paste in the days it prints, so nothing already live moves.
  const SERVED = {
    1: [['socksany', 'v7-daily-1-0', 0], ['downup', 'v7-daily-1-1', 0], ['clock', 'v7-daily-1-2', 0]],
    2: [['sumdiff', 'v7-daily-2-0', 0], ['pigeon', 'v7-daily-2-1', 0], ['digitsappear', 'v7-daily-2-2', 0]],
    3: [['till', 'v8-daily-3-0-0', 0], ['selfref', 'v8-daily-3-1-0', 0], ['slowclock', 'v8-daily-3-2-0', 0]],
    4: [['divhalf', 'v8-daily-4-0-0', 0], ['gridthree', 'v8-daily-4-1-0', 0], ['speedavg', 'v8-daily-4-2-0', 0]],
    5: [['doublinghalf', 'v8-daily-5-0-0', 0], ['coinsmatch', 'v8-daily-5-1-0', 0], ['refill', 'v8-daily-5-2-0', 0]],
    6: [['countodd', 'v8-daily-6-0-0', 0], ['jar', 'v8-daily-6-1-0', 0], ['ratescount', 'v8-daily-6-2-0', 0]],
    7: [['intervalsmonday', 'v8-daily-7-0-0', 0], ['pctpoints', 'v8-daily-7-1-0', 0], ['snail', 'v8-daily-7-2-0', 0]],
    8: [['tunnel', 'v8-daily-8-0-0', 0], ['compoundgrowth', 'v8-daily-8-1-0', 0], ['chain', 'v8-daily-8-2-0', 0]],
    9: [['string', 'v8-daily-9-0-0', 0], ['aroundposts', 'v8-daily-9-1-0', 0], ['tyres', 'v8-daily-9-2-0', 0]],
    10: [['scalingsquare', 'v8-daily-10-0-0', 0], ['workrate', 'v8-daily-10-1-0', 0], ['boxes', 'v8-daily-10-2-0', 0]]
  };
  const SEEN = { 3: ['pctbase'] };   // an idea some players met on day 3, before that day's set was replaced
  const plan = { days: [], lastIdea: {}, lastKind: {}, lastLook: {}, uses: {}, said: {} };
  function planDay(day) {
    while (plan.days.length < day) {
      const d = plan.days.length + 1, r = rngFrom('v8-day-' + d), ideas = {}, corners = {}, partners = {}, nudge = {}, set = [];
      if (SERVED[d]) {   // already played: keep it as it was, and remember it so the calendar steers clear
        (SEEN[d] || []).forEach(function (id) { plan.lastIdea[id] = d; });
        plan.days.push(SERVED[d].map(function (s) {
          const k = s[0];
          plan.lastIdea[ideaOf(k)] = d; plan.lastKind[k] = d; plan.uses[k] = (plan.uses[k] || 0) + 1;
          if (LOOK[k]) plan.lastLook[LOOK[k]] = d;
          (plan.said[k] = plan.said[k] || []).push(makeKind(k, s[1], s[2]).q);
          return s.slice();
        }));
        continue;
      }
      (SEEN[d] || []).forEach(function (id) { ideas[id] = 1; plan.lastIdea[id] = d; });
      TIERS.forEach(function (grade) {
        let best = null, top = -1, alike = null, alikeTop = -1, spare = null, spareTop = -1;
        kindsAt(grade).forEach(function (k) {
          const idea = ideaOf(k), c = DOMAIN[idea], look = LOOK[k];
          // Days since the idea was last out, nudged by up to JITTER days so the order is not the same
          // every time round the bank, then days since this very kind.
          // An idea that was last out on the same day as one already picked today waits APART days longer,
          // so three questions that once shared a day are split up the next time round.
          const was = plan.lastIdea[idea] || -999, together = was > 0 && partners[was] ? APART : 0;
          if (nudge[idea] === undefined) nudge[idea] = r() * JITTER;   // one nudge per idea, so among its kinds the stalest still wins
          const score = (Math.min(d - was, 400) + nudge[idea] - together) * 1000 + Math.min(d - (plan.lastKind[k] || -999), 900);
          if (ideas[idea]) return;
          if (score > spareTop) { spareTop = score; spare = k; }
          if (c && corners[c]) return;
          if (score > alikeTop) { alikeTop = score; alike = k; }
          if (look && d - (plan.lastLook[look] || -999) < LOOK_GAP) return;
          if (score > top) { top = score; best = k; }
        });
        const k = best || alike || spare, idea = ideaOf(k);
        ideas[idea] = 1; if (DOMAIN[idea]) corners[DOMAIN[idea]] = 1;
        if (plan.lastIdea[idea]) partners[plan.lastIdea[idea]] = 1;
        plan.lastIdea[idea] = d; plan.lastKind[k] = d; if (LOOK[k]) plan.lastLook[LOOK[k]] = d;
        // Word it differently from this kind's last outings: take the first wording not used lately, or else the stalest one.
        const turn = plan.uses[k] = (plan.uses[k] || 0) + 1, said = plan.said[k] || (plan.said[k] = []);
        let pickSalt = 0, stalest = Infinity;
        for (let salt = 0; salt < 12; salt++) {
          const at = said.lastIndexOf(makeKind(k, 'v8-daily-' + d + '-' + set.length + '-' + salt, turn - 1 + salt).q);
          if (at < stalest) { stalest = at; pickSalt = salt; }
          if (at < 0) break;
        }
        said.push(makeKind(k, 'v8-daily-' + d + '-' + set.length + '-' + pickSalt, turn - 1 + pickSalt).q); if (said.length > 10) said.shift();
        set.push([k, 'v8-daily-' + d + '-' + set.length + '-' + pickSalt, turn - 1 + pickSalt]);
      });
      plan.days.push(set);
    }
    return plan.days[day - 1];
  }

  function make(f, seed, turn) {
    const q = f.gen(rngFrom(seed + '-' + f.id), turn);
    q.fam = f.id;
    q.kind = f.id + ((q.v && (q.v.mode || q.v.id)) || '');   // letters only: used as a counter name
    q.grade = GRADE[q.kind] || (f.level === 1 ? 2 : f.level === 2 ? 3 : 4);
    q.level = q.grade <= 2 ? 1 : q.grade === 3 ? 2 : 3;      // the label a player sees: easy, tricky, hard
    q.pre = q.pre || ''; q.suf = q.suf || '';
    q.a = Math.round(q.a * 1e6) / 1e6;
    q.baits = (q.baits || []).filter(function (b, i, arr) { return isFinite(b) && b >= 0 && Math.abs(b - q.a) > (q.tol || 0) + 0.006 && arr.indexOf(b) === i; });
    return q;
  }
  // One question of an exact kind. A family picks its own variant, so this asks again until the kind comes up.
  function makeKind(kind, seed, base) {
    const f = famOf(kind); let q = null;
    for (let k = 0; k < 400; k++) { q = make(f, seed + '~' + k, (base || 0) + k); if (q.kind === kind) return q; }
    return q;
  }
  // A day is one question from each of grades 2, 3 and 4, in that order. The count of earlier
  // outings picks the variant, so a kind that returns brings its next story, not the last one.
  function buildDaily(day) {
    return planDay(Math.max(1, day)).map(function (s) { return makeKind(s[0], s[1], s[2]); });
  }
  // A drawn set, for private rounds and party games: one kind per grade asked for, no idea twice,
  // no two from one corner of maths while there is a choice. An idea with many skins gets no extra chances.
  function drawSet(key, grades) {
    const r = rngFrom(key), ideas = {}, corners = {};
    return grades.map(function (grade, n) {
      const free = kindsAt(grade).filter(function (k) { return !ideas[ideaOf(k)]; });
      const apart = free.filter(function (k) { const c = domainOf(k); return !c || !corners[c]; }), pool = apart.length ? apart : free;
      const names = pool.map(ideaOf).filter(function (id, i, arr) { return arr.indexOf(id) === i; }), idea = pick(r, names);
      const k = pick(r, pool.filter(function (x) { return ideaOf(x) === idea; }));
      ideas[idea] = 1; if (DOMAIN[idea]) corners[DOMAIN[idea]] = 1;
      return makeKind(k, key + '-' + n, Math.floor(r() * 1000));
    });
  }
  function buildTable(code, round) { return drawSet('v8-table-' + code + '-' + round, [2, 3, 4]); }
  // A longer set for one phone passed round a group: easy first, hardest last.
  function buildParty(seed, n) { return drawSet('v8-party-' + seed, n <= 3 ? [2, 3, 4] : n <= 5 ? [2, 3, 3, 4, 4] : [2, 2, 3, 3, 3, 4, 4]); }
  // Endless mode: of the kinds at this grade, the one whose idea this player met longest ago.
  // `recent` is the kinds they have been shown, oldest first.
  function nextKind(grade, recent, rnd) {
    const ideaAt = {}, kindAt = {};
    (recent || []).forEach(function (k, i) { if (GRADE[k]) { ideaAt[ideaOf(k)] = i + 1; kindAt[k] = i + 1; } });
    let best = null, low = Infinity;
    kindsAt(grade).forEach(function (k) {
      const s = (ideaAt[ideaOf(k)] || 0) * 1000 + (kindAt[k] || 0) + (rnd ? rnd() : 0) * 0.9;
      if (s < low) { low = s; best = k; }
    });
    return best;
  }
  // Every kind of question the bank can produce, for reading the live counters back.
  function kinds() {
    return Object.keys(GRADE).map(function (k) { const q = makeKind(k, 'kinds', 0); return { kind: k, grade: q.grade, level: q.level, eg: q.q }; });
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

  const api = { planDay: planDay, served: SERVED, families: F, GRADE: GRADE, kindsAt: kindsAt, makeKind: makeKind, buildDaily: buildDaily, buildTable: buildTable, buildParty: buildParty, ideaOf: ideaOf, domainOf: domainOf, nextKind: nextKind, kinds: kinds, dayNumber: dayNumber, judge: judge, hasBait: hasBait, show: show, num: num, ord: ord, rngFrom: rngFrom, make: make };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BaitEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
