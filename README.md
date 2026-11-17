# Not So Fast

A daily game: three trick questions, one guess each, and the obvious answer is the trap.

Live at https://playnotsofast.com

- `index.html` is the whole site. It is built from the files in `src/`.
- To rebuild after a change: `node src/build.js`
- To re-check every puzzle answer: `node src/test.js`
- `CNAME` tells GitHub Pages which domain to serve.
- `og.png` is the picture shown when the link is shared. `icon.png` is the home-screen icon.

## Questions

Every question in `src/engine.js` has to pass three tests: short enough to say to a friend,
no real calculation, and one illusion that clicks. The test file rejects any question over
190 characters.

## Typeface

The game embeds a subset of Barlow and Barlow Condensed by Jeremy Tribby, used under the
SIL Open Font License 1.1. The licence is in `src/fonts/OFL.txt`.
