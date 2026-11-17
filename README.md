# Not So Fast

A daily game: three trick questions, one guess each. Get three green lights.

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

Sound is off until the player turns it on, and on a laptop the answer is typed, because this is
meant to be playable in a lecture.

## The one idea

Three lights. A right answer turns a light green; the trap, a wrong answer or running out of
time turns it red. The goal is three greens, and the score is how many you got, with total time
to break a tie (two minutes a question on your own, one minute when a phone is passed round).

Every screen is built around that:

- The front page says the goal, shows the three lights and has one yellow button.
- A question shows the lights on the left, the time in large digits on the right and a bar under
  both that runs down. The question never moves.
- After an answer the same screen stays. The light changes, the verdict takes the clock's place,
  and under the question sit the answer, one line on why, and one yellow button.
- The score is the same three lights, large, and one number.

Yellow always means the thing to act on: the live light, and the single primary button.

The night road behind is only a backdrop. It moves on a stretch each time a light turns green,
from street lamps in town out to open country, so three greens end under a full sky. Nothing on
it carries a number, and no animation ever holds up the next question.

## What a refresh does

Every answer is saved the moment it is locked in, and the page reopens where it was left:

- mid-question, back on the question with the time that is left (a refresh buys neither time nor a
  second guess);
- on a verdict, the verdict again;
- endless mode, a pass-the-phone party and a private round are saved step by step and resume;
- two tabs share one game: an answer given in one shows in the other, and counts once.

Saved data is rebuilt and checked every time it is read, so a damaged or hand-edited save cannot
break the page. The counters are optional: if the service is down, slow or refusing, the game
carries on and shows no numbers rather than wrong ones, and leaves the service alone for a minute.
An unexpected error shows a bar with a Reload button and is counted on the `#numbers` page.
Inside TikTok, Instagram, Snapchat or Facebook the score screen explains that the streak is kept
in that app's own browser. `404.html` sends a mistyped address to the game.

`python3 src/journeys.py` plays all of this in a real browser; the top of that file says how.

A first-time visitor starts on the front page like everyone else. Every question shows which of
the three it is and whether it is the easy, tricky or hard one.

## Questions

Every question in `src/engine.js` has to pass three tests: short enough to say to a friend,
no real calculation, and one illusion that clicks. The test file rejects any question over
190 characters. A day runs opener, coin flip, closer, aimed at roughly 70%, 50% and 30% of
players getting each one right.

Those targets are estimates. The game keeps an anonymous lifetime tally for each kind of
question; open the site with `#numbers` on the end of the address to read real difficulty
back, then move kinds between levels in `src/engine.js`.

## Typeface

The game embeds a subset of Barlow and Barlow Condensed by Jeremy Tribby, used under the
SIL Open Font License 1.1. The licence is in `src/fonts/OFL.txt`.
