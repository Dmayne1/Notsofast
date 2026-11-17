# Not So Fast

A daily game: three trick questions, one guess each, and the obvious answer is the trap.

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

## Scoring

The score is a distance. A right answer moves your snail 100 m, plus a metre for every second
left on the clock (two minutes on your own, one minute when a phone is passed round). The trap,
a wrong answer or running out of time moves it nowhere. A perfect day is 660 m.

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
