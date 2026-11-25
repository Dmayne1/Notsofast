# Not So Fast

A daily game: three trick questions, three minutes, three green lights.

Live at https://playnotsofast.com

- `index.html` is the whole site. It is built from the files in `src/`.
- To rebuild after a change: `node src/build.js`
- To re-check every puzzle answer: `node src/test.js`
- `CNAME` tells GitHub Pages which domain to serve.
- `og.png` is the picture shown when the link is shared. `icon.png` is the home-screen icon.

## Ways to play

- The daily three, the same for everyone. A shared score carries a link, so a friend who plays the same three sees who won.
- One phone passed round a group: everyone answers in secret, then the results are revealed together.
- A private three on your own phones, by code or by link.
- Endless mode: once today's three are done, questions keep coming until three reds.

Sound is off until the player turns it on. A computer gets the same keypad as a phone, which can
be clicked, and the keyboard works too.

## The one idea

Three lights and one clock. A right answer turns a light green; the trap, a wrong answer or
running out of time turns it red. The goal is three greens.

- **Green means go.** The light changes and the next question arrives by itself. Nothing to press.
- **Red means stop.** The clock stops and the screen shows the answer and one line on why, with
  one button to carry on.
- **One clock for all three.** Three minutes, running only while a question is on screen. If it
  runs out, the question on screen and any not yet reached turn red; greens already won stay.

The clock's consequence is shown, not written. The top of the screen is one instrument: the
lights on the left, the clock on the right, and between them a fuse that burns from the clock
towards the lights, with a spark at the burning end. In the last fifteen seconds the fuse turns
red and every light still to be won flashes red. When the spark arrives, those lights turn red
one after another. On a stop screen the clock keeps its place, greyed, with a pause mark.

The score is how many greens, with total time to break a tie. Party and endless mode keep a
clock per question (a minute each), because there the questions belong to different players or
never end.

Every screen is built around that:

- The front page says the goal, shows the three lights and has one yellow button.
- A question shows the lights, the fuse and the time in large digits on one line. The question never moves. The answer field has a yellow ring and a
  blinking caret, so it is plain where the number goes.
- The stop screen ends on its one button, pinned to the bottom of the screen where the Lock in
  key was, so it is in view on any phone.
- The last question never ends on a button. Right or wrong, the score comes up by itself; if the
  last answer was missed, its answer and the reason sit at the top of the score screen.
- The score is one complete screen that never needs scrolling: the three lights, one number, the
  streak, how the player did against everyone else today, one button that shares the result and
  challenges a friend, and a reason to come back tomorrow with the time until the next three. Once today is done it is also the home screen, so
  there is nowhere to go back to. The answers are one tap away.

Yellow always means the thing to act on: the live light, the answer field, the one primary button.

The night road behind is only a backdrop. It moves on a stretch each time a light turns green,
from street lamps in town out to open country, so three greens end under a full sky.

## What a refresh does

Every answer is saved the moment it is locked in, and the page reopens where it was left:

- mid-question, back on the question with the time that is left (a refresh buys neither time nor a
  second guess);
- on a red light, the stop screen again; just after a green, the next question;
- after the third, the score, which is the home screen for the rest of the day;
- endless mode, a pass-the-phone party and a private round are saved step by step and resume;
- two tabs share one game: an answer given in one shows in the other, and counts once.

Saved data is rebuilt and checked every time it is read, so a damaged or hand-edited save cannot
break the page. The counters are optional: if the service is down, slow or refusing, the game
carries on and shows no numbers rather than wrong ones, and leaves the service alone for a minute.
An unexpected error shows a bar with a Reload button and is counted on the `#numbers` page.

**How a result is placed against the day.** The score screen says "You did better than 85% of
players today" and, on a screen tall enough, draws the day's players by greens with your row lit
(short phones get the chart under Your record instead). Better means more greens, or the same
greens in less time. It works on counters alone: every finisher adds one to their greens count,
to a 30-second time band and to a 5-second band inside it, then reads the bands faster than their
own. So times are compared to the nearest 5 seconds, and two players in the same 5 seconds are
level. Three greens with nobody quicker gets "Fastest three greens so far today." It is always
"so far": the line is fixed when you finish and is not re-read later. Times have been counted
since day 11 (`PLACE_DAY`); earlier days compare greens only. The counter service allows 30
requests in 10 seconds from one address, so the placing waits for room rather than risk losing
the numbers; a whole class on one wifi can still hit that limit, and then the line just does not
show. A counter nobody has hit yet reads as 404, which the game treats as a true zero.
Inside TikTok, Instagram, Snapchat or Facebook the score screen explains that the streak is kept
in that app's own browser. `404.html` sends a mistyped address to the game.

`python3 src/journeys.py` plays all of this in a real browser; the top of that file says how.

A first-time visitor starts on the front page like everyone else. Every question shows which of
the three it is and whether it is the easy, tricky or hard one.

## Questions

Every question in `src/engine.js` has to pass three tests: short enough to say to a friend,
no real calculation, and one illusion that clicks. The test file rejects any question over
190 characters.

Each kind of question has a grade from 1 to 5, set in the `GRADE` table in `src/engine.js`:

1. a giveaway
2. easy, but with a real trap
3. tricky
4. hard, though a minute of thought gets there
5. most people miss it, or it needs real working out

A day climbs 2, 3, 4, aimed at roughly 60%, 45% and 30% of players getting each one right. So the
day starts with something that can catch you and ends with something reachable. Grades 1 and 5
never appear in the daily three, a private round or a party; endless mode uses all five.

**Ideas, not kinds, are what must not repeat.** Two kinds that turn on the same trick (the gaps
between fence posts, floors or clock strikes) are one idea in different clothes. `IDEA` in
`src/engine.js` maps each kind to its idea, and `CORNER` groups ideas by the corner of maths they
live in (percent, chance, rates and so on). The calendar is built day by day:

- each slot takes the kind whose idea has been away longest, then the kind that has itself been
  away longest;
- a day never uses one idea twice, or two ideas from the same corner;
- questions that look alike on the surface (two about clocks, two about dice, two about trains)
  are kept a week apart, even when the tricks differ (`LOOKS`);
- three questions that shared a day are split up the next time round, so a set never comes back
  as a set;
- a kind that returns is worded differently from its last outings.

With 66 ideas in the daily bank an idea returns about every 22 days (never sooner than 17), and
the very same wording not for five weeks. `node src/test.js` prints these numbers and fails if they
drop. The only way to push them out is to add new ideas, so a new question should be a new trick,
not a new costume. Endless mode remembers the kinds a device has been shown and always serves the
one whose idea was met longest ago.

**A day that has been played never changes.** `SERVED` in `src/engine.js` lists every day already
live, slot by slot, and the calendar hands those back untouched. Before changing the bank (a new
kind, a new grade, anything in the calendar rules), run `node src/freeze.js` and paste its output
over `SERVED`, so today and every earlier day are locked first. The test file checks the lock.
Rewording a family changes its text on any day, locked or not, so leave today's three families
alone until tomorrow.

Those grades are estimates. The PostHog dashboard's "Share right by question type" tile shows
how each kind really plays; change the kind's number in `GRADE` to match, and cut any kind that
nearly everyone gets right.

## Analytics

The game reports to PostHog (EU cloud) so the owner can see visits, where they
came from and how players do. The project key and host live in
`src/analytics.json` and `build.js` bakes them in (the key is public by design;
an empty key switches analytics off). It only ever runs on playnotsofast.com.

It runs in PostHog's cookieless mode: no cookie, nothing in storage, no person
profiles, no session recording, no autocapture. Visitors are counted by a hash
that PostHog rotates daily, so nobody can be followed from one day to the next.
"Enable cookieless tracking" must be on in the PostHog project's web analytics
settings or the events are dropped.

| Event | Sent when | Carries |
| --- | --- | --- |
| `$pageview`, `$pageleave` | a visit starts and ends | PostHog's own page fields |
| `game_start` | a game begins | `mode`, `game_day`, `returning` (this device has finished a day before), party `players`/`questions` |
| `question_answered` | every answer | `mode`, `slot`, `kind`, `grade`, `level` (Easy, Tricky, Hard), `verdict` (right, trap, wrong, time), `typed` (the number they gave), `question` (its text), `answer`, `secs`, `clock_left` |
| `game_finish` | a game ends | `mode`, `greens`, `secs`, `timed_out`, `vs_friend`, `streak` (a band such as "2 to 3 days", never the exact count), `returning` |
| `share` | a result or challenge is copied or sent | `what` |
| `challenge_arrived` | someone opens a friend's link | `mode` |
| `answers_opened`, `help_opened` | those sheets open | |
| `game_error` | the Reload bar shows | `message` (the error text, 120 characters at most) |

Every event also carries `src` (utm_source, else the app or site the visit came
from, else `direct`), `creator` (from a `?c=name` link), `in_app` and `keypad`.
Give each creator their own link, `playnotsofast.com/?c=name`, to see what they send.

`python3 src/journeys.py analytics` checks all of this against a stand-in library.

## Typeface

The game embeds a subset of Barlow and Barlow Condensed by Jeremy Tribby, used under the
SIL Open Font License 1.1. The licence is in `src/fonts/OFL.txt`.
