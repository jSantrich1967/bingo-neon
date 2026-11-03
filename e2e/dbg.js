const puppeteer = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server'] });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('PAGEERROR:', e.message));
  p.on('console', m => console.log('console:', m.text().slice(0, 120)));
  await p.evaluateOnNewDocument(() => {
    window.__esCalls = 0;
    window.WebSocket = class { constructor(){ setTimeout(() => this.onerror && this.onerror(new Error('ws bloqueado')), 50); } close(){} };
    window.EventSource = class { constructor(){ window.__esCalls++; throw new Error('sse bloqueado'); } };
  });
  await p.setRequestInterception(true);
  p.on('request', req => {
    const u = req.url();
    if (!u.includes('ntfy.sh')) return req.continue();
    console.log('REQ', req.method(), u.slice(0, 90));
    if (req.method() === 'POST') return req.respond({ status: 200, contentType: 'application/json', body: '{}' });
    return req.respond({ status: 200, contentType: 'application/x-ndjson', body: '' });
  });
  await p.goto('http://127.0.0.1:8901/index.html', { waitUntil: 'networkidle2' });
  await p.type('#inpName', 'Dbg'); await p.click('#btnCreate');
  await sleep(9000);
  console.log('llamadas a EventSource:', await p.evaluate(() => window.__esCalls));
  console.log('connHost:', await p.evaluate(() => document.getElementById('connHost').textContent));
  await browser.close();
})();
