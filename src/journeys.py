"""Journey tests: what a real visitor can do to the game, and what must still work.

Run from the repo root, after `node src/build.js`:
    python3 -m http.server 8765 &        (serves index.html)
    python3 src/journeys.py [name ...]   (no names runs everything)

Needs Python Playwright with Chromium. Nothing here touches the live counters: every request
to the counter service is answered by this script.
"""
import asyncio, json, sys, re
from playwright.async_api import async_playwright

BASE = 'http://localhost:8765/'
KEY = 'nsf.v4'
TIKTOK = ('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) '
          'Mobile/15E148 musical_ly_35.1.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/IE BytedanceWebview/d8a21c6')
RESULTS = []

# A clock the test can move: Date runs `__shift` milliseconds ahead of the real one.
CLOCK = """(() => { const R = Date, shift = () => { try { return Number(localStorage.getItem('__shift') || 0); } catch (e) { return 0; } };
  class D extends R { constructor(...a) { if (a.length === 0) super(R.now() + shift()); else super(...a); } static now() { return R.now() + shift(); } }
  window.Date = D; })();"""
NO_STORAGE = """(() => { const boom = () => { throw new DOMException('denied', 'SecurityError'); };
  Object.defineProperty(window, 'localStorage', { get: boom }); Object.defineProperty(window, 'sessionStorage', { get: boom }); })();"""
NO_SHARE = """(() => { try { Object.defineProperty(navigator, 'share', { value: undefined }); } catch (e) {}
  try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('no')) } }); } catch (e) {} })();"""


def check(name, ok, detail=''):
    detail = re.sub(r'\s+', ' ', str(detail))
    RESULTS.append((name, bool(ok), detail))
    print(('  ok   ' if ok else '  FAIL ') + name + ((' :: ' + str(detail)[:230]) if (detail and not ok) else ''))


class Site:
    """One browser profile with its own storage and a fake counter service."""
    def __init__(self, browser, w=390, h=760, mobile=True, ua=None, counters='ok', init=(), calm=True):
        self.browser, self.w, self.h, self.mobile, self.ua, self.counters, self.init, self.calm = browser, w, h, mobile, ua, counters, init, calm
        self.hits, self.errors = [], []

    async def __aenter__(self):
        kw = dict(viewport={'width': self.w, 'height': self.h}, device_scale_factor=2, has_touch=self.mobile, is_mobile=self.mobile,
                  reduced_motion='reduce' if self.calm else 'no-preference')
        if self.ua: kw['user_agent'] = self.ua
        self.ctx = await self.browser.new_context(**kw)
        for s in self.init: await self.ctx.add_init_script(s)
        await self.ctx.route('**/abacus.jasoncameron.dev/**', self.counter)
        self.page = await self.tab()
        return self

    async def __aexit__(self, *a):
        await self.ctx.close()

    async def tab(self):
        p = await self.ctx.new_page()
        p.on('pageerror', lambda e: self.errors.append('pageerror: ' + str(e)))
        p.on('console', lambda m: self.errors.append('console: ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'net::' not in m.text else None)
        return p

    async def counter(self, route):
        url = route.request.url
        self.hits.append(url.split('.dev/')[1])
        mode = self.counters
        key = url.rsplit('/', 1)[1]
        val = 500 if key.endswith('n') else 200 if key.endswith('r') else 250 if key.endswith('t') else 40
        ok = lambda: route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body=json.dumps({'value': val}))
        if mode == 'ok': await ok()
        elif mode == 'down': await route.abort()
        elif mode == '429': await route.fulfill(status=429, headers={'access-control-allow-origin': '*'}, body='Too many requests')
        elif mode == 'junk': await route.fulfill(status=200, content_type='text/html', headers={'access-control-allow-origin': '*'}, body='<html>oops</html>')
        elif mode == 'huge': await route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body='{"value":"1e99"}')
        elif mode == 'mixed':   # the answered count arrives, everything else is rate limited
            if key.endswith('n'): await ok()
            else: await route.fulfill(status=429, headers={'access-control-allow-origin': '*'}, body='Too many requests')
        elif mode == 'slow':
            await asyncio.sleep(9)
            try: await ok()
            except Exception: pass

    async def open(self, hash='', page=None):
        p = page or self.page
        await p.goto(BASE + hash)
        await p.wait_for_timeout(250)

    async def seed(self, data):
        """Put a saved game in storage (so the cold open is skipped) and reload."""
        await self.page.goto(BASE)
        await self.page.evaluate("([k, d]) => localStorage.setItem(k, typeof d === 'string' ? d : JSON.stringify(d))", [KEY, data])
        await self.page.reload(); await self.page.wait_for_timeout(250)

    async def returning(self):
        await self.seed({'sound': False, 'demo': 1, 'stats': {'played': 0, 'perfect': 0, 'streak': 0, 'best': 0, 'lastDay': 0, 'dist': [0, 0, 0, 0]}, 'daily': None, 'names': [], 'rival': None})


async def store(p):
    return await p.evaluate("k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }", KEY)

async def screen(p):
    return await p.evaluate("""() => { const v = document.getElementById('view'), s = v.querySelector('section');
      const t = id => { const e = document.getElementById(id); return e ? e.textContent : null; };
      return { cls: s ? s.className : '', text: v.innerText, clock: t('clock'), typed: t('val'), entry: !!v.querySelector('[data-act=enter], .deskrow'),
               result: !!v.querySelector('.result'), q: (v.querySelector('.plate-q .q') || {}).textContent || '', sheet: !document.getElementById('veil').hidden,
               sheetText: document.getElementById('veil').innerText, btns: [...v.querySelectorAll('button')].map(b => b.textContent) }; }""")

async def today_set(p):
    return await p.evaluate("() => { const E = window.BaitEngine; return E.buildDaily(E.dayNumber(new Date())).map(q => ({ a: q.a, baits: q.baits, q: q.q })); }")

async def wrong_for(p, q):
    """A number that is neither the answer nor a trap."""
    return await p.evaluate("""q => { const E = window.BaitEngine, d = E.buildDaily(E.dayNumber(new Date())).concat([]);
      for (let v = 987; v < 1100; v++) if (Math.abs(v - q.a) > 50 && !q.baits.some(b => Math.abs(b - v) < 1)) return v; return 9999; }""", q)

async def live_answer(p):
    """The answer to the question on screen in endless mode, a party or a private round, worked out from the saved seeds."""
    return await p.evaluate("""k => { const E = window.BaitEngine, s = JSON.parse(localStorage.getItem(k)), g = s && s.live && s.live.game; if (!g) return null;
      if (g.mode === 'run') return E.make(E.families.filter(f => f.id === g.fid)[0], g.seed + '-' + (g.n - 1)).a;
      if (g.mode === 'party') return E.buildParty(g.seed, g.count)[g.k].a;
      return E.buildTable(g.code, g.round)[g.st.idx].a; }""", KEY)

def keys_of(v):
    s = ('%f' % v).rstrip('0').rstrip('.') if isinstance(v, float) else str(v)
    return s

async def answer(p, v, wait=420):
    for ch in keys_of(v):
        await p.click('[data-act="key"][data-k="%s"]' % ch)
    await p.click('[data-act="enter"]')
    await p.wait_for_timeout(wait)

GO = 1150   # after a right answer the next thing arrives by itself: long enough to see it

async def press(p, act, wait=420):
    await p.click('[data-act="%s"]' % act)
    await p.wait_for_timeout(wait)

async def play_day(s, how=('right', 'bait', 'wrong'), p=None):
    """From home (or the cold open's result), play today's three."""
    p = p or s.page
    qs = await today_set(p)
    await press(p, 'daily')
    for i, q in enumerate(qs):
        h = how[i]
        v = q['a'] if h == 'right' else (q['baits'][0] if h == 'bait' and q['baits'] else await wrong_for(p, q))
        await answer(p, v)
        if h == 'right': await p.wait_for_timeout(GO)     # green means go: nothing to press
        else: await press(p, 'next')                      # red means stop: read why, then move on
    return qs


# ------------------------------------------------------------------ journeys

async def first_visit(b):
    print('first visit')
    async with Site(b) as s:
        await s.open()
        a = await screen(s.page)
        check('a brand-new visitor sees the goal and one Play button', 'home' in a['cls'] and 'three green lights' in a['text'].lower() and 'Three minutes' in a['text'] and a['btns'][0] == 'Play', (a['text'][:120], a['btns']))
        lights = await s.page.evaluate("() => [...document.querySelectorAll('#view .lights .lt')].map(e => e.className)")
        check('three unlit lights are on the front page', len(lights) == 3 and all('off' in c for c in lights), lights)
        await s.page.reload(); await s.page.wait_for_timeout(250)
        check('refreshing before playing stays on the front page', 'home' in (await screen(s.page))['cls'])
        await press(s.page, 'daily')
        q = await screen(s.page)
        lights = await s.page.evaluate("() => [...document.querySelectorAll('#view .lights .lt')].map(e => e.className)")
        check('Play goes straight to question one with a big clock', q['entry'] and q['clock'] in ('3:00', '2:59'), q['clock'])
        check('the screen says it is one clock for all three', 'One clock for all three questions' in q['text'], q['text'][:120])
        check('the first light is live and the others are off', len(lights) == 3 and 'now' in lights[0] and 'off' in lights[1] and 'off' in lights[2], lights)
        size = await s.page.evaluate("() => parseFloat(getComputedStyle(document.getElementById('clock')).fontSize)")
        check('the clock is large', size >= 38, size)
        yellow = await s.page.evaluate("() => [...document.querySelectorAll('#view button')].filter(b => getComputedStyle(b).backgroundImage.includes('255, 228, 92')).map(b => b.textContent)")
        check('there is exactly one yellow button on the question', len(yellow) == 1, yellow)
        check('no errors on a first visit', not s.errors, s.errors)


async def refresh_daily(b):
    print('refreshing during the daily three')
    async with Site(b) as s:
        await s.returning()
        qs = await today_set(s.page)
        await press(s.page, 'daily')
        await s.page.click('[data-act="key"][data-k="7"]')
        await s.page.wait_for_timeout(2300)
        await s.page.reload(); await s.page.wait_for_timeout(300)
        a = await screen(s.page)
        check('refresh mid-question puts you back on the question', a['entry'] and a['q'] == qs[0]['q'], a['cls'] + ' | ' + a['text'][:100])
        check('refresh does not refill the clock', a['clock'] is not None and '2:50' <= a['clock'] <= '2:58', a['clock'])
        check('refresh clears the half-typed answer', a['typed'] is not None and '7' not in a['typed'], a['typed'])
        await s.page.wait_for_timeout(1000)
        await answer(s.page, qs[0]['a'])
        await s.page.wait_for_timeout(GO)
        q2 = await screen(s.page)
        lights = await s.page.evaluate("() => [...document.querySelectorAll('#view .lights .lt')].map(e => e.className)")
        check('a right answer turns the light green and goes straight to question two', q2['entry'] and q2['q'] == qs[1]['q'] and 'green' in lights[0] and 'now' in lights[1], (q2['cls'], lights))
        check('the clock carries on from where it was, it does not reset', q2['clock'] is not None and '2:40' <= q2['clock'] <= '2:57', q2['clock'])
        await answer(s.page, qs[1]['baits'][0] if qs[1]['baits'] else await wrong_for(s.page, qs[1]))
        r = await screen(s.page)
        check('a wrong answer stops on the verdict', r['result'] and ('not so fast' in r['text'].lower() or 'wrong' in r['text'].lower()) and 'Clock stopped' in r['text'], r['text'][:160])
        yellow = await s.page.evaluate("() => [...document.querySelectorAll('#view button')].filter(b => getComputedStyle(b).backgroundImage.includes('255, 228, 92')).map(b => b.textContent)")
        check('the only yellow button is Next question', yellow == ['Next question'], yellow)
        hits = len([h for h in s.hits if h.startswith('hit/')])
        await s.page.reload(); await s.page.wait_for_timeout(300)
        r2 = await screen(s.page)
        check('refresh on the verdict shows the verdict again', r2['result'] and r2['text'][:60] == r['text'][:60], r2['cls'] + ' | ' + r2['text'][:100])
        check('refresh does not count the answer twice', len([h for h in s.hits if h.startswith('hit/')]) == hits, (hits, len([h for h in s.hits if h.startswith('hit/')])))
        await s.page.wait_for_timeout(6000)
        await press(s.page, 'next')
        q3 = await screen(s.page)
        check('the clock did not run while the answer was on screen', q3['entry'] and q3['q'] == qs[2]['q'] and q3['clock'] >= '2:51', (q2['clock'], q3['clock']))
        await answer(s.page, await wrong_for(s.page, qs[2]))
        await press(s.page, 'next')
        e = await screen(s.page)
        check('the third answer leads to the score', 'end' in e['cls'] and '1 of 3' in e['text'], e['text'][:160])
        fits = await s.page.evaluate("() => document.scrollingElement.scrollHeight <= innerHeight + 1")
        check('the score is one complete screen, nothing to scroll', fits)
        st = await store(s.page)
        await s.page.reload(); await s.page.wait_for_timeout(300)
        h = await screen(s.page)
        check('refresh after finishing shows the score again, it is the home screen now', 'end' in h['cls'] and '1 of 3' in h['text'] and 'Next three in' in h['text'], h['text'][:160])
        await s.page.click('.wordmark'); await s.page.wait_for_timeout(450)
        h2 = await screen(s.page)
        st2 = await store(s.page)
        check('the logo keeps you on the finished day', 'end' in h2['cls'])
        check('the finished day is only counted once', st2['stats']['played'] == 1 and st['stats']['played'] == 1, st2['stats'])
        await press(s.page, 'answers')
        a3 = await screen(s.page)
        check('See the answers opens all three with their reasons', a3['sheet'] and all(q['q'] in a3['sheetText'] for q in qs), a3['sheetText'][:120])
        check('no errors across the daily three', not s.errors, s.errors)
    async with Site(b, calm=False) as s:   # with the real animations: refresh in the moment after a right answer
        await s.returning()
        qs = await today_set(s.page)
        await press(s.page, 'daily')
        await answer(s.page, qs[0]['a'], wait=500)
        await s.page.reload(); await s.page.wait_for_timeout(600)
        a = await screen(s.page)
        st = await store(s.page)
        check('refresh just after a right answer carries on to question two', a['entry'] and a['q'] == qs[1]['q'] and st['daily']['res'][0]['f'] == 'right', a['cls'] + ' | ' + a['text'][:120])
        check('no errors refreshing after a right answer', not s.errors, s.errors)
    async with Site(b, w=375, h=560) as s:   # a short phone: the finished day and a wrong answer must both sit on one screen
        await s.returning()
        qs = await today_set(s.page)
        await press(s.page, 'daily')
        await answer(s.page, await wrong_for(s.page, qs[0]))
        vis = await s.page.evaluate("() => { const r = document.querySelector('[data-act=next]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }")
        check('on a short phone Next question is on screen without scrolling', vis)
        await press(s.page, 'next'); await answer(s.page, 987654); await press(s.page, 'next'); await answer(s.page, 987654); await press(s.page, 'next')
        fits = await s.page.evaluate("() => document.scrollingElement.scrollHeight <= innerHeight + 1")
        check('on a short phone the score still fits one screen', fits, await s.page.evaluate("() => [document.scrollingElement.scrollHeight, innerHeight]"))
    async with Site(b, w=320, h=480) as s:
        await s.returning()
        qs = await today_set(s.page)
        await press(s.page, 'daily')
        await answer(s.page, await wrong_for(s.page, qs[0]))
        vis = await s.page.evaluate("() => { const r = document.querySelector('[data-act=next]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }")
        check('on a very small phone Next question is still on screen', vis)


async def out_of_fuel(b):
    print('running out of time while away')
    async with Site(b, init=(CLOCK,)) as s:
        await s.returning()
        await press(s.page, 'daily')
        await s.page.evaluate("localStorage.setItem('__shift', String(10 * 60 * 1000))")   # ten minutes pass
        await s.page.reload(); await s.page.wait_for_timeout(600)
        a = await screen(s.page)
        if not a['result'] and 'home' in a['cls']: await press(s.page, 'daily'); a = await screen(s.page)
        check('coming back late shows out of time', a['result'] and 'ran out of time' in a['text'] and 'The clock ran out' in a['text'] and 'NaN' not in a['text'], a['text'][:200])
        lights = await s.page.evaluate("() => [...document.querySelectorAll('#view .lights .lt')].map(e => e.className)")
        check('with the clock gone, all three lights are red', all('red' in c for c in lights), lights)
        await press(s.page, 'next')
        e = await screen(s.page)
        check('and the day ends there', 'end' in e['cls'] and '0 of 3' in e['text'] and 'in 3:00' in e['text'], e['text'][:160])
        await press(s.page, 'answers')
        a3 = await screen(s.page)
        check('questions the clock never reached are marked as such', a3['sheetText'].count('not reached') == 2, a3['sheetText'][:200])
        check('no errors', not s.errors, s.errors)


async def two_tabs(b):
    print('two tabs at once')
    async with Site(b) as s:
        await s.returning()
        qs = await today_set(s.page)
        await press(s.page, 'daily')                      # tab A is on question one
        t2 = await s.tab()
        await s.open(page=t2)
        a = await screen(t2)
        if 'home' in a['cls']: await press(t2, 'daily')
        await answer(t2, await wrong_for(t2, qs[0]))      # tab B answers wrong
        await s.page.wait_for_timeout(300)
        r = await screen(s.page)
        st = await store(s.page)
        check('the first tab shows the answer given in the second', r['result'] and not r['entry'] and 'correct' not in r['text'].lower() and st['daily']['res'][0]['f'] == 'wrong', (r['cls'], r['text'][:80]))
        check('the answer is counted once', len([h for h in s.hits if h.startswith('hit/') and h.endswith('q1n')]) == 1)
    async with Site(b) as s:                              # the same, when this tab never hears about the other one
        await s.returning()
        qs = await today_set(s.page)
        await press(s.page, 'daily')
        await s.page.evaluate("""k => { const d = JSON.parse(localStorage.getItem(k)); d.daily.res = [{ t: '987', f: 'wrong', secs: 3, m: 0 }]; localStorage.setItem(k, JSON.stringify(d)); }""", KEY)
        await answer(s.page, qs[0]['a'])
        r = await screen(s.page)
        st = await store(s.page)
        check('a second tab cannot buy a second guess', st['daily']['res'][0]['f'] == 'wrong' and 'correct' not in r['text'].lower() and r['result'], (st['daily']['res'][0], r['text'][:80]))
        check('and the second try is not counted', not [h for h in s.hits if h.startswith('hit/')], s.hits)
        # an idle front page in another tab catches up
        t3 = await s.tab(); await s.open(page=t3)
        check('no errors with two tabs', not s.errors, s.errors)
    async with Site(b) as s:
        await s.returning()
        t2 = await s.tab(); await s.open(page=t2)         # both tabs idle on the front page
        await play_day(s, p=t2)
        await s.page.bring_to_front(); await s.page.wait_for_timeout(400)
        h = await screen(s.page)
        check('an idle tab notices the day was finished elsewhere', 'end' in h['cls'] and 'of 3' in h['text'], h['text'][:160])
        check('no errors', not s.errors, s.errors)


async def no_storage(b):
    print('storage switched off or corrupt')
    async with Site(b, init=(NO_STORAGE,)) as s:
        await s.open()
        a = await screen(s.page)
        check('the game opens with storage blocked', 'home' in a['cls'], a['text'][:100])
        qs = await play_day(s)
        e = await screen(s.page)
        check('a whole day can be played with storage blocked', 'end' in e['cls'], e['text'][:120])
        check('no errors with storage blocked', not s.errors, s.errors)
    day = None
    bad = {
        'not json': 'garbage{{',
        'empty object': {},
        'null': 'null',
        'array': '[1,2,3]',
        'stats wrong shape': {'stats': {'dist': 'x'}, 'demo': 1},
        'finished day with no answers': lambda d: {'demo': 1, 'stats': {'played': 1, 'perfect': 0, 'streak': 1, 'best': 1, 'lastDay': d, 'dist': [0, 1, 0, 0]}, 'daily': {'v': 'v8', 'day': d, 'idx': 2, 'res': [], 'done': True}},
        'answers are junk': lambda d: {'demo': 1, 'stats': {'played': 0, 'perfect': 0, 'streak': 0, 'best': 0, 'lastDay': 0, 'dist': [0, 0, 0, 0]}, 'daily': {'v': 'v8', 'day': d, 'idx': 9, 'res': 'x', 'qStart': 'y', 'done': False}},
        'answer with unknown verdict': lambda d: {'demo': 1, 'stats': {'played': 0, 'perfect': 0, 'streak': 0, 'best': 0, 'lastDay': 0, 'dist': [0, 0, 0, 0]}, 'daily': {'v': 'v8', 'day': d, 'idx': 0, 'res': [{'f': 'zzz', 't': '<b>', 'secs': 'a', 'm': 'q'}], 'qStart': 0, 'done': False}},
        'hostile friend and names': {'demo': 1, 'stats': {'played': 0, 'perfect': 0, 'streak': 0, 'best': 0, 'lastDay': 0, 'dist': [0, 0, 0, 0]}, 'rival': {'key': 'tAB-1', 'code': '<img src=x onerror=alert(1)>', 'round': 'x', 'n': 9, 's': '<i>'}, 'names': 'bob', 'seen': 7, 'live': 'x'},
        'stats are strings': {'demo': 1, 'stats': {'played': 'lots', 'perfect': None, 'streak': -4, 'best': {}, 'lastDay': 'x', 'dist': [0, 'a', None], 'far': 99999, 'metres': 'm'}},
        'broken live game': lambda d: {'demo': 1, 'stats': {'played': 0, 'perfect': 0, 'streak': 0, 'best': 0, 'lastDay': 0, 'dist': [0, 0, 0, 0]}, 'live': {'v': 'v8', 'at': 9e15, 'game': {'mode': 'party', 'players': 'x', 'set': [], 'k': 4}}},
    }
    for name, data in bad.items():
        async with Site(b) as s:
            await s.page.goto(BASE)
            d = await s.page.evaluate("() => window.BaitEngine.dayNumber(new Date())")
            await s.seed(data(d) if callable(data) else data)
            a = await screen(s.page)
            alive = ('home' in a['cls'] or a['entry'] or a['result'] or 'end' in a['cls']) and 'NaN' not in a['text'] and 'undefined' not in a['text']
            ok2 = True
            if alive:
                try:
                    if 'home' in a['cls']: await press(s.page, 'daily')
                    c = await screen(s.page)
                    ok2 = (c['entry'] or c['result'] or 'end' in c['cls']) and 'NaN' not in c['text'] and 'undefined' not in c['text']
                    await press(s.page, 'stats'); c2 = await screen(s.page)
                    ok2 = ok2 and 'NaN' not in c2['sheetText'] and 'undefined' not in c2['sheetText']
                except Exception as ex:
                    ok2 = False; s.errors.append(str(ex)[:200])
            check('survives saved data that is ' + name, alive and ok2 and not s.errors, (a['cls'], a['text'][:80], s.errors))


async def counters(b):
    print('the counter service misbehaving')
    for mode in ('down', '429', 'junk', 'huge', 'mixed', 'slow'):
        async with Site(b, counters=mode) as s:
            await s.returning()
            h = await screen(s.page)
            await play_day(s, how=('right', 'right', 'bait'))
            e = await screen(s.page)
            await s.page.wait_for_timeout(600)
            e = await screen(s.page)
            text = h['text'] + ' ' + e['text']
            lies = re.search(r'\b0% |NaN|Infinity|undefined|e\+\d', text)
            check('counters ' + mode + ': the day still plays', 'end' in e['cls'] and not s.errors, (e['cls'], s.errors))
            check('counters ' + mode + ': nothing false is shown', not lies, lies and text[max(0, lies.start() - 60):lies.end() + 40])
    async with Site(b, counters='429') as s:      # a whole class behind one address: stop asking once refused
        await s.returning()
        await play_day(s)
        n = len(s.hits)
        check('after a refusal the game stops hammering the service', n <= 12, n)
    async with Site(b, counters='ok') as s:
        await s.returning()
        for i in range(4):
            await press(s.page, 'help'); await press(s.page, 'close'); await s.page.reload(); await s.page.wait_for_timeout(200)
        n = len([h for h in s.hits if h.startswith('get/')])
        check('reloading the front page does not re-read the field every time', n <= 18, n)
        await play_day(s, how=('right', 'bait', 'wrong'))
        e = await screen(s.page)
        check('with counters up, the crowd lines appear', 'players' in e['text'], e['text'][:200])


async def links(b):
    print('links people send each other')
    async with Site(b) as s:
        await s.returning()
        d = await s.page.evaluate("() => window.BaitEngine.dayNumber(new Date())")
        await s.open('#d%d-2-400' % d); await s.page.reload(); await s.page.wait_for_timeout(250)
    async with Site(b) as s:                      # a brand-new visitor arriving on a friend's link
        await s.page.goto(BASE + '#d%d-2-400' % d); await s.page.wait_for_timeout(300)
        a = await screen(s.page)
        check('a friend link shows their score', '2 of 3 in 6:40' in a['text'], a['text'][:200])
        check('the link is cleaned out of the address bar', '#' not in s.page.url, s.page.url)
        await play_day(s, how=('right', 'right', 'right'))
        e = await screen(s.page)
        check('finishing shows who won', 'You beat your friend' in e['text'] or 'Your friend wins' in e['text'], e['text'][:200])
        check('no errors', not s.errors, s.errors)
    for h, name in (('#d1-3-9999', 'an old day'), ('#d99999-3-100', 'a future day'), ('#%3Cscript%3Ealert(1)%3C/script%3E', 'script junk'), ('#t-1-1', 'a broken code'),
                    ('#d2-9-100', 'an impossible score'), ('#' + 'A' * 3000, 'a huge hash'), ('?utm_source=tiktok&_r=1#d1-2-3', 'tracking tags')):
        async with Site(b) as s:
            await s.page.goto(BASE + h); await s.page.wait_for_timeout(300)
            a = await screen(s.page)
            check('survives a link with ' + name, (a['entry'] or 'home' in a['cls']) and not s.errors and '9999' not in a['text'], (a['cls'], s.errors))
    async with Site(b) as s:
        await s.page.goto(BASE + '#tPARTY-2-2-300'); await s.page.wait_for_timeout(300)
        a = await screen(s.page)
        check('a private-round link offers the round', 'Play their three' in a['text'], a['text'][:200])
        await press(s.page, 'rivalround')
        st = await store(s.page)
        check('a private round is saved as you go', bool(st and st.get('live')) and st['live']['game']['mode'] == 'table')
        for i in range(3):
            if i == 1:
                await answer(s.page, await live_answer(s.page)); await s.page.wait_for_timeout(GO); continue
            await answer(s.page, 987654)
            if i == 0:
                await s.page.reload(); await s.page.wait_for_timeout(300)
                r = await screen(s.page)
                check('refresh in a private round keeps your place', r['result'] and 'wrong' in r['text'].lower(), r['cls'] + ' | ' + r['text'][:80])
            await press(s.page, 'next')
        e = await screen(s.page)
        check('the private round ends with the duel', 'end' in e['cls'] and ('Your friend' in e['text'] or 'your friend' in e['text']), e['text'][:200])
        await press(s.page, 'home')
        h = await screen(s.page)
        check('a played challenge is not offered again', 'Play their three' not in h['text'], h['text'][:200])
        check('no errors', not s.errors, s.errors)
    async with Site(b) as s:                      # the link is pasted into a tab that is already open
        await s.returning()
        d = await s.page.evaluate("() => window.BaitEngine.dayNumber(new Date())")
        await s.page.evaluate("d => { location.hash = '#d' + d + '-1-150'; }", d)
        await s.page.wait_for_timeout(300)
        a = await screen(s.page)
        check('a link opened in an already-open tab is read', '1 of 3 in 2:30' in a['text'], a['text'][:200])
    async with Site(b) as s:
        await s.page.goto(BASE + '#numbers'); await s.page.wait_for_timeout(400)
        a = await screen(s.page)
        check('the numbers page opens', 'numbers' in a['cls'] and not s.errors, s.errors)


async def taps(b):
    print('double taps and held keys')
    async with Site(b, calm=False) as s:
        await s.returning()
        qs = await today_set(s.page)
        await press(s.page, 'daily')
        await answer(s.page, await wrong_for(s.page, qs[0]), wait=2600)
        box = await s.page.locator('[data-act="next"]').bounding_box()
        x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        await s.page.touchscreen.tap(x, y); await s.page.touchscreen.tap(x, y); await s.page.touchscreen.tap(x, y)
        await s.page.wait_for_timeout(500)
        a = await screen(s.page)
        check('a double tap on Next question does not type into the next question', a['entry'] and a['typed'] == 'Type your answer', a['typed'])
        st = await store(s.page)
        check('a double tap does not skip a question', st['daily']['idx'] == 1 and len(st['daily']['res']) == 1, st['daily'])
        check('no errors', not s.errors, s.errors)
    async with Site(b, w=1280, h=800, mobile=False) as s:
        await s.returning()
        qs = await today_set(s.page)
        await press(s.page, 'daily')
        pad = await s.page.evaluate("() => { const p = document.querySelector('#view .pad'); return !!p && p.getBoundingClientRect().height > 100; }")
        ring = await s.page.evaluate("() => getComputedStyle(document.getElementById('read')).boxShadow.includes('255, 210, 31')")
        check('a computer gets the keypad too, and the answer field is visibly live', pad and ring, (pad, ring))
        await s.page.click('[data-act="key"][data-k="4"]')
        await s.page.keyboard.type('2')
        t = await screen(s.page)
        check('on a computer you can click the keys or type, and both land in the same field', (t['typed'] or '').startswith('42'), t['typed'])
        await s.page.keyboard.press('Backspace'); await s.page.keyboard.press('Backspace')
        await s.page.keyboard.type(str(await wrong_for(s.page, qs[0])))
        await s.page.keyboard.down('Enter')
        for i in range(12):
            await s.page.keyboard.down('Enter'); await s.page.wait_for_timeout(60)   # the key repeats while held
        await s.page.keyboard.up('Enter'); await s.page.wait_for_timeout(300)
        a = await screen(s.page)
        check('holding Enter does not skip past the verdict', a['result'] and 'wrong' in a['text'].lower(), a['cls'] + ' | ' + a['text'][:80])
        check('no errors on a laptop', not s.errors, s.errors)


async def long_road(b):
    print('endless mode')
    async with Site(b) as s:
        await s.returning()
        await play_day(s)
        await press(s.page, 'run')
        st = await store(s.page)
        live = st.get('live')
        check('endless mode is saved as you go', bool(live) and live['game']['mode'] == 'run')
        if not live: return
        await answer(s.page, await live_answer(s.page))
        await s.page.wait_for_timeout(GO)
        before = await screen(s.page)
        check('endless mode: a right answer goes straight on', before['entry'] and 'Question 2' in before['text'] and '1 green' in before['text'], before['text'][:80])
        await s.page.reload(); await s.page.wait_for_timeout(300)
        a = await screen(s.page)
        check('refresh in endless mode keeps the run', a['entry'] and 'Question 2' in a['text'] and a['q'] == before['q'], a['cls'] + ' | ' + a['text'][:100])
        for i in range(3):
            await answer(s.page, 987654); await press(s.page, 'next')
        e = await screen(s.page)
        check('three reds end the run', 'end' in e['cls'] and 'Endless mode' in e['text'] and 'before three reds' in e['text'], e['text'][:160])
        st = await store(s.page)
        check('the best run is kept', st['stats'].get('runTop', 0) == 1, st['stats'])
        await s.page.reload(); await s.page.wait_for_timeout(300)
        e2 = await screen(s.page)
        check('refresh on the endless score is sensible', ('end' in e2['cls'] or 'home' in e2['cls']) and 'NaN' not in e2['text'], e2['cls'])
        await press(s.page, 'home') if 'end' in e2['cls'] else None
        await s.page.reload(); await s.page.wait_for_timeout(300)
        h = await screen(s.page)
        st = await store(s.page)
        check('going home ends the saved run and shows the finished day', not st.get('live') and 'of 3' in h['text'] and 'Next three in' in h['text'], h['text'][:100])
        check('no errors in endless mode', not s.errors, s.errors)


async def party(b):
    print('one phone passed round')
    async with Site(b) as s:
        await s.returning()
        await press(s.page, 'friends'); await press(s.page, 'party')
        ins = s.page.locator('.names input')
        await ins.nth(0).fill('<b>Ann</b>'); await ins.nth(1).fill('Bob')
        await press(s.page, 'pq-'); await press(s.page, 'pstart')
        a = await screen(s.page)
        check('names are shown as typed, never run as code', '<B>ANN</B>' in a['text'].upper() or '<b>Ann</b>' in a['text'], a['text'][:160])
        await s.page.reload(); await s.page.wait_for_timeout(300)
        a = await screen(s.page)
        check('refresh on the hand-over screen keeps the party', 'pass' in a['cls'] and 'Question 1 of 3' in a['text'], a['cls'] + ' | ' + a['text'][:100])
        if 'pass' not in a['cls']: return
        await press(s.page, 'pgo')
        q1 = await screen(s.page)
        await s.page.wait_for_timeout(2200)
        await s.page.reload(); await s.page.wait_for_timeout(300)
        q1b = await screen(s.page)
        check('refresh on a party question keeps the question and the clock', q1b['entry'] and q1b['q'] == q1['q'] and q1b['clock'] <= '0:58', (q1b['cls'], q1b['clock']))
        await answer(s.page, await live_answer(s.page))
        await press(s.page, 'pgo'); await answer(s.page, 987654)
        await press(s.page, 'preveal')
        await s.page.reload(); await s.page.wait_for_timeout(300)
        await s.page.reload(); await s.page.wait_for_timeout(300)
        r = await screen(s.page)
        g = (await store(s.page))['live']['game']
        check('refresh on the reveal does not score twice', 'rev' in r['cls'] and g['players'][0]['right'] == 1 and g['players'][1]['right'] == 0, (r['cls'], [p['right'] for p in g['players']]))
        for k in (1, 2):
            await press(s.page, 'pnext')
            for pl in range(2):
                await press(s.page, 'pgo'); await answer(s.page, 987654)
            await press(s.page, 'preveal')
        await press(s.page, 'pnext')
        f = await screen(s.page)
        check('the party reaches a winner', 'wins' in f['text'].lower() or 'dead heat' in f['text'].lower(), f['text'][:160])
        await s.page.reload(); await s.page.wait_for_timeout(300)
        f2 = await screen(s.page)
        check('refresh on the final table keeps the table', 'wins' in f2['text'].lower() or 'dead heat' in f2['text'].lower(), f2['cls'] + ' | ' + f2['text'][:100])
        check('no errors in a party', not s.errors, s.errors)


async def screens(b):
    print('small, sideways and large screens')
    sizes = [(320, 450, True, 'a very small phone'), (320, 568, True, 'an old small phone'), (360, 520, True, 'a small phone inside an app'), (375, 500, True, 'iPhone SE inside an app'),
             (667, 375, True, 'a phone on its side'), (844, 390, True, 'a big phone on its side'), (820, 1180, True, 'a tablet'), (1920, 1080, False, 'a big monitor'), (1024, 600, False, 'a small laptop')]
    for w, h, mob, name in sizes:
        async with Site(b, w=w, h=h, mobile=mob) as s:
            await s.returning()
            qs = await today_set(s.page)
            await press(s.page, 'daily')
            m = await s.page.evaluate("""() => { const de = document.scrollingElement, out = { wide: de.scrollWidth - innerWidth, need: [] };
              document.querySelectorAll('#view [data-act], #view input, #view .q, #clock').forEach(el => { const r = el.getBoundingClientRect();
                if (!r.width) return; if (r.bottom + scrollY > de.scrollHeight + 1 || r.right > innerWidth + 1 || r.left < -1) out.need.push(el.textContent.slice(0, 12)); });
              const q = document.querySelector('#view .q').getBoundingClientRect(); out.qcut = q.bottom > de.scrollHeight; return out; }""")
            check('question fits or scrolls on ' + name, m['wide'] <= 0 and not m['need'], m)
            bad = await wrong_for(s.page, qs[0])
            if mob: await answer(s.page, bad)
            else: await s.page.keyboard.type(str(bad)); await s.page.keyboard.press('Enter'); await s.page.wait_for_timeout(250)
            m2 = await s.page.evaluate("""() => { const de = document.scrollingElement, b = document.querySelector('[data-act=next]'); if (!b) return { ok: false };
              const r = b.getBoundingClientRect(); return { ok: r.bottom + scrollY <= de.scrollHeight + 1 && r.right <= innerWidth + 1 && r.width > 40, wide: de.scrollWidth - innerWidth }; }""")
            check('Next question is reachable on ' + name, m2['ok'] and m2['wide'] <= 0 and not s.errors, (m2, s.errors))


async def in_app(b):
    print("inside TikTok's browser")
    async with Site(b, ua=TIKTOK, init=(NO_SHARE,), w=390, h=660) as s:
        await s.open()
        a = await screen(s.page)
        check('opens inside TikTok', 'home' in a['cls'] and a['btns'][0] == 'Play', a['text'][:80])
        await play_day(s)
        e = await screen(s.page)
        check('the score screen offers a way to keep a streak when inside an app', 'Keep your streak' in e['text'], e['text'][:300])
        fits = await s.page.evaluate("() => document.scrollingElement.scrollHeight <= innerHeight + 1")
        check('and still fits one screen inside TikTok', fits, await s.page.evaluate("() => [document.scrollingElement.scrollHeight, innerHeight]"))
        await press(s.page, 'inapp')
        sh = await screen(s.page)
        check('which explains that the streak lives inside TikTok', sh['sheet'] and 'TikTok' in sh['sheetText'] and 'Safari' in sh['sheetText'], sh['sheetText'][:160])
        await press(s.page, 'close')
        await press(s.page, 'copy')
        sh = await screen(s.page)
        check('sharing falls back to text you can copy', sh['sheet'] and 'playnotsofast.com' in sh['sheetText'], sh['sheetText'][:120])
        check('no errors inside TikTok', not s.errors, s.errors)
    async with Site(b) as s:
        await s.returning()
        await play_day(s)
        e = await screen(s.page)
        check('no in-app note in a normal browser', 'Keep your streak' not in e['text'])


async def midnight(b):
    print('midnight and wrong clocks')
    DAY = 24 * 3600 * 1000
    async with Site(b, init=(CLOCK,)) as s:
        await s.returning()
        d = await s.page.evaluate("() => window.BaitEngine.dayNumber(new Date())")
        await play_day(s, how=('right', 'right', 'right'))
        await s.page.evaluate("d => localStorage.setItem('__shift', String(d))", DAY)
        await s.page.wait_for_timeout(1500)
        h = await screen(s.page)
        check('the score screen rolls over to the new day at midnight', 'home' in h['cls'] and h['btns'][0] == 'Play' and ('No. %d' % (d + 1)) in h['text'], h['text'][:200])
        await play_day(s, how=('right', 'wrong', 'wrong'))
        st = await store(s.page)
        check('playing the next day makes a two-day streak', st['stats']['streak'] == 2 and st['stats']['played'] == 2, st['stats'])
        await s.page.evaluate("d => localStorage.setItem('__shift', String(d))", 3 * DAY)
        await s.page.reload(); await s.page.wait_for_timeout(300)
        h = await screen(s.page)
        check('a missed day ends the streak on the front page', 'streak' not in h['text'], h['text'][:200])
        check('no errors over midnight', not s.errors, s.errors)
    async with Site(b, init=(CLOCK,)) as s:      # the front page left open overnight
        await s.returning()
        await play_day(s)
        await press(s.page, 'home')
        await s.page.evaluate("d => localStorage.setItem('__shift', String(d))", DAY)
        t2 = await s.tab(); await t2.goto('about:blank'); await s.page.bring_to_front(); await s.page.wait_for_timeout(400)
        await s.page.evaluate("() => document.dispatchEvent(new Event('visibilitychange'))"); await s.page.wait_for_timeout(300)
        h = await screen(s.page)
        check('a front page left open overnight offers the new day', h['btns'][0] == 'Play', h['btns'])
    async with Site(b, init=(CLOCK,)) as s:      # a game started a few seconds before midnight and finished after it
        await s.page.goto(BASE)
        await s.page.evaluate("() => { const n = new Date(), mid = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); localStorage.setItem('__shift', String(mid - n - 5000)); }")
        await s.returning()
        d0 = await s.page.evaluate("() => window.BaitEngine.dayNumber(new Date())")
        qs = await today_set(s.page)
        await press(s.page, 'daily')
        await answer(s.page, qs[0]['a']); await s.page.wait_for_timeout(5500)      # midnight passes while question two is on screen
        d1 = await s.page.evaluate("() => window.BaitEngine.dayNumber(new Date())")
        await answer(s.page, qs[1]['a']); await s.page.wait_for_timeout(GO)
        await answer(s.page, 987654); await press(s.page, 'next')
        e = await screen(s.page)
        check('a game that crosses midnight finishes as the day it began', d1 == d0 + 1 and 'end' in e['cls'] and ('No. %d' % d0) in e['text'] and '2 of 3' in e['text'] and not s.errors, (d0, d1, e['text'][:80], s.errors))
    async with Site(b, init=(CLOCK,)) as s:      # a phone whose clock says 2019
        await s.page.goto(BASE); await s.page.evaluate("localStorage.setItem('__shift', String(-7 * 365 * 24 * 3600 * 1000))")
        await s.returning(); await play_day(s)
        e = await screen(s.page)
        check('a phone with the wrong year can still play', 'end' in e['cls'] and 'No. 1' in e['text'] and not s.errors, (e['text'][:60], s.errors))


async def recovery(b):
    print('when something breaks anyway')
    async with Site(b) as s:
        await s.returning()
        await s.page.evaluate("() => window.dispatchEvent(new ErrorEvent('error', { message: 'boom from a test', filename: location.href }))")
        await s.page.wait_for_timeout(400)
        t = await s.page.evaluate("() => document.body.innerText")
        check('an unexpected error offers a way out', 'Reload' in t, t[-200:])
    async with Site(b) as s:
        await s.returning()
        await s.page.goto('about:blank'); await s.page.go_back(); await s.page.wait_for_timeout(400)
        a = await screen(s.page)
        check('coming back with the back button works', 'home' in a['cls'] and not s.errors, (a['cls'], s.errors))
    async with Site(b) as s:
        r = await s.page.goto(BASE + '404.html'); await s.page.wait_for_timeout(600)
        check('a mistyped address is sent to the game', s.page.url.rstrip('/') == BASE.rstrip('/') or 'Not So Fast' in await s.page.title(), s.page.url)
        html = await (await s.ctx.request.get(BASE)).text()
        check('there is a message for browsers with scripts off', '<noscript>' in html)


async def leaving(b):
    print('leaving a game by the logo')
    async with Site(b) as s:
        await s.returning()
        await press(s.page, 'friends'); await press(s.page, 'party'); await press(s.page, 'pstart')
        await s.page.click('.wordmark'); await s.page.wait_for_timeout(420)
        a = await screen(s.page)
        check('tapping the logo mid-party asks first', a['sheet'] and 'leave this game?' in a['sheetText'].lower(), a['sheetText'][:80])
        await press(s.page, 'close')
        a = await screen(s.page)
        check('Keep playing keeps the party', 'pass' in a['cls'] and not a['sheet'], a['cls'])
        await s.page.click('.wordmark'); await s.page.wait_for_timeout(420)
        await s.page.click('[data-act="home"][data-sure]'); await s.page.wait_for_timeout(420)
        a = await screen(s.page); st = await store(s.page)
        check('Leave goes home and forgets the party', 'home' in a['cls'] and not st.get('live'), a['cls'])
        await press(s.page, 'daily'); await s.page.click('.wordmark'); await s.page.wait_for_timeout(420)
        a = await screen(s.page)
        check('the logo mid-question goes to the front page, which offers the way back', 'home' in a['cls'] and a['btns'][0] == 'Carry on', a['btns'])
        check('no errors leaving', not s.errors, s.errors)

async def https(b):
    print('plain http addresses')
    import os
    html = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'index.html'), encoding='utf-8').read()
    for host in ('playnotsofast.com', 'www.playnotsofast.com'):
        seen = []
        async with Site(b) as s:
            async def serve(route):
                seen.append(route.request.url)
                await route.fulfill(status=200, content_type='text/html', body=html)
            await s.ctx.route(re.compile(r'^https?://(www\.)?playnotsofast\.com/'), serve)
            await s.page.goto('http://' + host + '/?utm_source=tiktok#tABC-1-2-300'); await s.page.wait_for_timeout(700)
            a = await screen(s.page)
            check('a plain http visit to ' + host + ' is moved to https', s.page.url.startswith('https://' + host + '/') and any(u.startswith('http://') for u in seen), (s.page.url, seen))
            check('and keeps its tracking tag and the friend link on ' + host, 'utm_source=tiktok' in s.page.url and 'Play their three' in a['text'] and not s.errors, (s.page.url, a['text'][:120], s.errors))
    async with Site(b) as s:
        await s.open()
        check('other addresses (tests, the preview copy) are left alone', s.page.url.startswith('http://localhost'), s.page.url)

ALL = [https, leaving, first_visit, refresh_daily, out_of_fuel, two_tabs, no_storage, counters, links, taps, long_road, party, screens, in_app, midnight, recovery]

async def main():
    want = sys.argv[1:]
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for fn in ALL:
            if want and fn.__name__ not in want: continue
            try:
                await fn(b)
            except Exception as ex:
                check(fn.__name__ + ' ran to the end', False, repr(ex)[:300])
        await b.close()
    bad = [r for r in RESULTS if not r[1]]
    print('\n%d checks, %d failed' % (len(RESULTS), len(bad)))
    for n, _, d in bad: print(' FAIL', n, '::', str(d)[:200])
    sys.exit(1 if bad else 0)

asyncio.run(main())
