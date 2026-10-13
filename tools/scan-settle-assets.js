/* One-off: measure Settle's imagery so the right crops go into the portfolio.
   The case-study frames are 3:2 landscape; most of Settle's photography is
   portrait, so this finds what actually fits. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const SRC = 'C:/Users/HP/Desktop/furniture-landing/assets';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!['fonts'].includes(e.name)) walk(p); }
    else if (/\.(webp|jpg|png)$/i.test(e.name) && !/^_sheet|swatch|icon/i.test(e.name)) files.push(p);
  }
})(SRC);

(async () => {
  const b = await chromium.launch({ executablePath: EDGE });
  const p = await (await b.newContext()).newPage();
  await p.goto('file:///C:/Users/HP/Desktop/furniture-landing/index.html');

  const out = [];
  for (const f of files) {
    const url = 'file:///' + f.split(path.sep).join('/');
    const d = await p.evaluate(async (src) => {
      const i = new Image();
      await new Promise(r => { i.onload = r; i.onerror = r; i.src = src; });
      return [i.naturalWidth, i.naturalHeight];
    }, url);
    if (d[0] && d[1]) {
      out.push({
        f: path.relative(SRC, f).split(path.sep).join('/'),
        w: d[0], h: d[1], r: d[0] / d[1], kb: fs.statSync(f).size / 1024,
      });
    }
  }
  await b.close();

  const land = out.filter(o => o.r > 1.2).sort((a, b) => b.w - a.w);
  console.log('LANDSCAPE (ratio > 1.2) — fits the 3:2 card and shot frames:');
  if (!land.length) console.log('  (none)');
  land.slice(0, 14).forEach(o => console.log(
    '  ' + o.f.padEnd(46) + String(o.w).padStart(5) + 'x' + String(o.h).padEnd(6) +
    'r=' + o.r.toFixed(2) + '  ' + o.kb.toFixed(0) + 'KB'));

  const sq = out.filter(o => o.r >= 0.95 && o.r <= 1.2).sort((a, b) => b.w - a.w);
  console.log('\nNEAR-SQUARE (0.95–1.2):');
  if (!sq.length) console.log('  (none)');
  sq.slice(0, 8).forEach(o => console.log(
    '  ' + o.f.padEnd(46) + String(o.w).padStart(5) + 'x' + String(o.h).padEnd(6) + 'r=' + o.r.toFixed(2)));

  console.log('\nscanned ' + out.length + ' images — landscape ' + land.length +
    ', near-square ' + sq.length + ', portrait ' + (out.length - land.length - sq.length));
})();
