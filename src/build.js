// Builds ../index.html from template.html, engine.js, app.js and the three embedded font files.
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const font = (file, family, weight) => '@font-face{font-family:"' + family + '";font-weight:' + weight + ';font-style:normal;font-display:block;src:url(data:font/woff;base64,' + fs.readFileSync(path.join(__dirname, 'fonts', file)).toString('base64') + ') format("woff")}';
const fonts = [font('Barlow-Medium.woff', 'Barlow', 500), font('Barlow-Bold.woff', 'Barlow', 700), font('BarlowCondensed-ExtraBold.woff', 'Barlow Condensed', 800)].join('\n');
// Analytics settings live in analytics.json (the project key is public by design). NSF_PH_KEY / NSF_PH_HOST override it.
let ph = {};
try { ph = JSON.parse(read('analytics.json')); } catch (e) {}
const phKey = process.env.NSF_PH_KEY != null ? process.env.NSF_PH_KEY : (ph.key || '');
const phHost = process.env.NSF_PH_HOST || ph.host || '';
if (!/^[A-Za-z0-9_]*$/.test(phKey) || !/^(https:\/\/[a-z0-9.-]+)?$/.test(phHost)) throw new Error('analytics.json: key or host looks wrong');
const app = read('app.js').replace("'/*PH_KEY*/'", () => JSON.stringify(phKey)).replace("'/*PH_HOST*/'", () => JSON.stringify(phHost));
if (app.indexOf('/*PH_') >= 0) throw new Error('analytics placeholders were not filled in');
const html = read('template.html').replace('/*FONTS*/', () => fonts).replace('/*ENGINE*/', () => read('engine.js')).replace('/*APP*/', () => app);
fs.writeFileSync(path.join(__dirname, '..', 'index.html'), html);
console.log('index.html', Math.round(html.length / 1024) + ' KB', phKey ? '(analytics on: ' + phHost + ')' : '(analytics off)');
