/* Reproduces VS Code Live Server: serves the PROJECT FOLDER at "/" with no
   base path, which is how Victor previews locally. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const ROOT = path.resolve(__dirname, '..');
const PORT = 8805;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.pdf': 'application/pdf',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, p);
  if (!path.extname(p)) {
    const asDir = path.join(ROOT, p, 'index.html');
    if (fs.existsSync(asDir)) file = asDir;
  }
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404');
  }
});

server.listen(PORT, '127.0.0.1', async () => {
  const b = await chromium.launch({ executablePath: EDGE });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const missing = [];
  p.on('response', r => { if (r.status() >= 400) missing.push(r.url().replace('http://127.0.0.1:' + PORT, '')); });

  await p.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await p.waitForTimeout(1200);

  const state = await p.evaluate(() => ({
    bg: getComputedStyle(document.body).backgroundColor,
    styled: getComputedStyle(document.body).backgroundColor === 'rgb(13, 13, 11)',
    sheets: document.styleSheets.length,
    firstLink: (document.querySelector('a[href^="/"]') || {}).getAttribute
      ? document.querySelector('a[href^="/"]').getAttribute('href') : null,
  }));

  console.log('As VS Code Live Server would serve it (project folder at "/"):\n');
  console.log('  body background : ' + state.bg + (state.styled ? '   (styled)' : '   <-- UNSTYLED, stylesheet never loaded'));
  console.log('  stylesheets     : ' + state.sheets);
  console.log('  a sample link   : ' + state.firstLink);
  console.log('\n  failed requests : ' + missing.length);
  [...new Set(missing)].slice(0, 8).forEach(m => console.log('     404  ' + m));

  await b.close();
  server.close();
  process.exit(0);
});
