// Prueba de resiliencia: WebSocket ROTO y SSE ROTO a propósito -> debe entrar por sondeo HTTP
const puppeteer = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const store = new Map(); // topic -> [{time, event, message}]
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server'] });
  async function newPhone(name) {
    const p = await browser.newPage();
    await p.evaluateOnNewDocument(() => {
      window.WebSocket = class { constructor(){ setTimeout(() => this.onerror && this.onerror(new Error('ws bloqueado')), 50); } close(){} };
      window.EventSource = class { constructor(){ throw new Error('sse bloqueado'); } };
    });
    await p.setRequestInterception(true);
    p.on('request', req => {
      const u = req.url();
      if (!u.includes('ntfy.sh')) return req.continue();
      const topic = u.split('ntfy.sh/')[1].split(/[\/?]/)[0];
      if (req.method() === 'POST') {
        const arr = store.get(topic) || [];
        arr.push({ time: Math.floor(Date.now() / 1000), event: 'message', message: req.postData() });
        store.set(topic, arr);
        return req.respond({ status: 200, contentType: 'application/json', body: '{}' });
      }
      const since = parseInt((u.match(/since=(\d+)/) || [])[1] || '0', 10);
      const lines = (store.get(topic) || []).filter(m => m.time >= since - 1).map(m => JSON.stringify(m)).join('\n');
      return req.respond({ status: 200, contentType: 'application/x-ndjson', headers: { 'Access-Control-Allow-Origin': '*' }, body: lines });
    });
    await p.goto('http://127.0.0.1:8901/index.html', { waitUntil: 'networkidle2' });
    await p.type('#inpName', name);
    return p;
  }
  const host = await newPhone('Anfitrión Fallback');
  await host.click('#btnCreate'); await sleep(700);
  const code = await host.evaluate(() => document.getElementById('hostCode').textContent);
  const link = await host.evaluate(() => document.getElementById('hostLink').textContent);
  console.log('sala:', code);
  const guest = await newPhone('Invitado Fallback');
  await guest.goto(link, { waitUntil: 'networkidle2' });
  await guest.type('#inpName', 'Invitado Fallback');
  await guest.click('#btnJoin');
  let joined = false;
  for (let i = 0; i < 14; i++) {
    await sleep(2500);
    const st = await guest.evaluate(() => ({ scr: !document.getElementById('scrGuest').classList.contains('hidden'), host: document.getElementById('guestHost').textContent }));
    if (st.scr) { joined = true; console.log('invitado DENTRO, anfitrión:', st.host); break; }
  }
  const gst = await guest.evaluate(() => ({ home: document.getElementById('homeStatus').textContent, conn: (document.getElementById('connGuest')||{}).textContent }));
  const hst = await host.evaluate(() => ({ players: document.getElementById('hostPCount').textContent, conn: (document.getElementById('connHost')||{}).textContent }));
  console.log('invitado:', JSON.stringify(gst));
  console.log('anfitrión:', JSON.stringify(hst));
  console.log('temas en el relevo falso:', [...store.keys()].map(k => k + ' (' + store.get(k).length + ' msjs)').join(' | '));
  console.log(joined ? 'FALLBACK OK: entró sin WebSocket ni SSE, solo sondeo HTTP' : 'FALLBACK FALLÓ');
  await browser.close();
  process.exit(joined ? 0 : 1);
})();
