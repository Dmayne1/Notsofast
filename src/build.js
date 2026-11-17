// Builds ../index.html from template.html, engine.js, app.js and the three embedded font files.
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const font = (file, family, weight) => '@font-face{font-family:"' + family + '";font-weight:' + weight + ';font-style:normal;font-display:block;src:url(data:font/woff;base64,' + fs.readFileSync(path.join(__dirname, 'fonts', file)).toString('base64') + ') format("woff")}';
const fonts = [font('Barlow-Medium.woff', 'Barlow', 500), font('Barlow-Bold.woff', 'Barlow', 700), font('BarlowCondensed-ExtraBold.woff', 'Barlow Condensed', 800)].join('\n');
const html = read('template.html').replace('/*FONTS*/', () => fonts).replace('/*ENGINE*/', () => read('engine.js')).replace('/*APP*/', () => read('app.js'));
fs.writeFileSync(path.join(__dirname, '..', 'index.html'), html);
console.log('index.html', Math.round(html.length / 1024) + ' KB');
