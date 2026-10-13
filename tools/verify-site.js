/* Post-reorganisation check.
   Serves the folder the way Netlify does, then loads every page in Edge and
   reports anything that fails to load, any JS error, and any horizontal
   overflow. Run:  cd tools && node verify-site.js            */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 8801;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain', '.toml': 'text/plain',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(path.join(ROOT, '404.html')).pipe(res);
  }
});

const PAGES = ['/', '/about.html', '/design-system.html', '/work/', '/work/seamfix.html',
  '/work/sprout.html', '/work/groovia.html', '/work/craveau.html', '/nope-404-test'];

// Images Victor has not exported yet — expected to be missing, not a regression.
const EXPECTED_MISSING = /(seamfix|craveau)-(persona|[1-4])\.png/;

let pass = 0, fail = 0;
const log = (ok, m) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + m); ok ? pass++ : fail++; };

server.listen(PORT, async () => {
  const browser = await chromium.launch({ executablePath: EDGE });
  // One browser, reused across pages — this machine has 4 CPUs and 8GB.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  for (const pg of PAGES) {
    const page = await ctx.newPage();
    const missing = [], errs = [];
    page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/nope-404-test')) missing.push(r.status() + ' ' + r.url().replace('http://localhost:' + PORT, '')); });
    page.on('requestfailed', r => missing.push('failed ' + r.url().replace('http://localhost:' + PORT, '')));
    page.on('pageerror', e => errs.push(e.message));

    await page.goto('http://localhost:' + PORT + pg, { waitUntil: 'load' });
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
        window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);

    const unexpected = missing.filter(m => !EXPECTED_MISSING.test(m));
    const expected = missing.filter(m => EXPECTED_MISSING.test(m));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

    console.log('\n[' + pg + ']');
    log(unexpected.length === 0, 'all assets load' + (unexpected.length ? ' -> ' + unexpected.join(', ') : ''));
    log(errs.length === 0, 'no JS errors' + (errs.length ? ' -> ' + errs.join(' | ') : ''));
    log(overflow <= 1, 'no horizontal overflow (' + overflow + 'px)');
    if (expected.length) console.log('  note    ' + expected.length + ' not-yet-exported image(s), expected');
    await page.close();
  }

  // the CV link must resolve from both pages that offer it
  console.log('\n[CV download]');
  const page = await ctx.newPage();
  for (const from of ['/about.html', '/']) {
    await page.goto('http://localhost:' + PORT + from, { waitUntil: 'load' });
    const href = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a[href]')].find(x => /CV|\.pdf/i.test(x.getAttribute('href')));
      return a ? a.href : null;
    });
    if (!href) { log(true, from + ' — no CV link on this page'); continue; }
    const r = await page.request.get(href);
    log(r.status() === 200, from + ' -> ' + href.replace('http://localhost:' + PORT, '') + '  (' + r.status() + ')');
  }
  await page.close();

  await ctx.close();
  await browser.close();
  server.close();
  console.log('\n=============================');
  console.log('PASS ' + pass + '   FAIL ' + fail);
  process.exit(fail ? 1 : 0);
});
