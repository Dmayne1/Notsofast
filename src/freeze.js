// Prints every day up to today as the calendar serves it now, ready to paste into SERVED in
// engine.js. Run this BEFORE changing the question bank, so days already played can never move.
const E = require('./engine.js');
const today = E.dayNumber(new Date());
const lines = [];
for (let d = 1; d <= today; d++) lines.push('    ' + d + ': ' + JSON.stringify(E.planDay(d)).replace(/"/g, "'").replace(/,/g, ', '));
console.log('  const SERVED = {\n' + lines.join(',\n') + '\n  };');
