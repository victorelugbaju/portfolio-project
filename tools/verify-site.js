/* Site check — run:  cd tools && node verify-site.js
   Serves the folder the way GitHub Pages does (clean URLs resolve to a
   folder's index.html; unknown paths get 404.html), then loads every page
   in Edge and checks assets, errors, overflow and metadata.            */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const HOST = 'https://victorelugbaju.github.io/portfolio-project';
const BASE = '/portfolio-project';
const PORT = 8802;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === BASE) p = BASE + '/';
  if (p.startsWith(BASE)) p = p.slice(BASE.length) || '/'; else p = '/__outside__';
  let file = path.join(ROOT, p);
  // GitHub Pages: /about -> /about/index.html
  if (!path.extname(p)) {
    const asDir = path.join(ROOT, p, 'index.html');
    if (fs.existsSync(asDir)) file = asDir;
  }
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(path.join(ROOT, '404.html')).pipe(res);
  }
});

const PAGES = [
  ['/portfolio-project/', 'Home'], ['/portfolio-project/about/', 'About'], ['/portfolio-project/design-system/', 'Design system'],
  ['/portfolio-project/work/', 'Work index'], ['/portfolio-project/work/settle/', 'Settle'], ['/portfolio-project/work/seamfix/', 'Seamfix'], ['/portfolio-project/work/sprout/', 'Sprout'],
  ['/portfolio-project/work/groovia/', 'Groovia'], ['/portfolio-project/work/craveau/', 'Craveau'],
  ['/portfolio-project/deliberately-missing', '404'],
];

const EXPECTED_MISSING = /(seamfix|craveau)-(persona|[1-4])\.png/;

let pass = 0, fail = 0;
const log = (ok, m) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + m); ok ? pass++ : fail++; };

server.listen(PORT, async () => {
  const browser = await chromium.launch({ executablePath: EDGE });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const seenCanon = [];

  for (const [url, label] of PAGES) {
    const page = await ctx.newPage();
    const missing = [], errs = [];
    page.on('response', r => {
      if (r.status() >= 400 && !r.url().endsWith('/deliberately-missing')) {
        missing.push(r.status() + ' ' + r.url().replace('http://localhost:' + PORT, ''));
      }
    });
    page.on('requestfailed', r => missing.push('failed ' + r.url().replace('http://localhost:' + PORT, '')));
    page.on('pageerror', e => errs.push(e.message));

    await page.goto('http://localhost:' + PORT + url, { waitUntil: 'load' });
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
        window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(350);

    const unexpected = missing.filter(m => !EXPECTED_MISSING.test(m));
    const d = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      canonical: (document.querySelector('link[rel=canonical]') || {}).href || null,
      ogUrl: (document.querySelector('meta[property="og:url"]') || {}).content || null,
      icon: (document.querySelector('link[rel=icon]') || {}).getAttribute
        ? document.querySelector('link[rel=icon]').getAttribute('href') : null,
      // any link still pointing at an old .html page
      stale: [...document.querySelectorAll('a[href]')]
        .map(a => a.getAttribute('href'))
        .filter(h => /(about|design-system|seamfix|sprout|groovia|craveau|index)\.html/.test(h)),
    }));

    console.log('\n[' + label + '  ' + url + ']');
    log(unexpected.length === 0, 'all assets load' + (unexpected.length ? ' -> ' + unexpected.join(', ') : ''));
    log(errs.length === 0, 'no JS errors' + (errs.length ? ' -> ' + errs.join(' | ') : ''));
    log(d.overflow <= 1, 'no horizontal overflow (' + d.overflow + 'px)');
    log(d.stale.length === 0, 'no leftover .html links' + (d.stale.length ? ' -> ' + d.stale.join(', ') : ''));
    if (label !== '404') {
      log(!!d.canonical && d.canonical.startsWith(HOST), 'canonical on new host: ' + d.canonical);
      log(d.ogUrl === d.canonical, 'og:url matches canonical');
      log(!!d.icon && d.icon.startsWith('/portfolio-project/img/brand/'), 'favicon from /img/brand/ (' + d.icon + ')');
      seenCanon.push(d.canonical);
    }
    await page.close();
  }

  console.log('\n[site-wide]');
  log(new Set(seenCanon).size === seenCanon.length, 'all canonical URLs unique');

  const page = await ctx.newPage();
  // every sitemap URL must resolve
  const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  console.log('\n[sitemap — ' + locs.length + ' urls]');
  for (const loc of locs) {
    const local = loc.replace('https://victorelugbaju.github.io', 'http://localhost:' + PORT);
    const r = await page.request.get(local);
    log(r.status() === 200, loc.replace('https://victorelugbaju.github.io', '') + '  -> ' + r.status());
  }

  // the CV
  console.log('\n[CV]');
  const r = await page.request.get('http://localhost:' + PORT + '/portfolio-project/docs/Victor_Elugbaju_CV.pdf');
  log(r.status() === 200, '/docs/Victor_Elugbaju_CV.pdf -> ' + r.status());
  await page.close();

  await ctx.close();
  await browser.close();
  server.close();
  console.log('\n=============================');
  console.log('PASS ' + pass + '   FAIL ' + fail);
  process.exit(fail ? 1 : 0);
});
