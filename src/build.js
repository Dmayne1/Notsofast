// Builds ../index.html from the three source files. Run: node src/build.js
const fs = require('fs'), path = require('path');
const here = f => path.join(__dirname, f);
const t = fs.readFileSync(here('template.html'), 'utf8');
const out = t.replace('/*ENGINE*/', () => fs.readFileSync(here('engine.js'), 'utf8')).replace('/*APP*/', () => fs.readFileSync(here('app.js'), 'utf8'));
fs.writeFileSync(path.join(__dirname, '..', 'index.html'), out);
console.log('index.html', (out.length / 1024).toFixed(1) + ' KB');
