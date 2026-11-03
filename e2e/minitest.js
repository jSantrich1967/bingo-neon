// Prueba mínima PeerJS: ¿pueden dos páginas conectarse en este Chromium con broker local?
const puppeteer = require('puppeteer');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const peerjsCode = fs.readFileSync(__dirname + '/peerjs.min.js', 'utf8');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server'] });
  const mk = async (tag) => {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setContent('<html><body>test</body></html>');
    await p.addScriptTag({ content: peerjsCode });
    p.on('console', m => console.log(tag, m.text().slice(0, 200)));
    p.on('pageerror', e => console.log(tag, 'pageerror:', e.message));
    return p;
  };
  const OPTS = { host: '127.0.0.1', port: 9000, path: '/', secure: false, debug: 2 };

  const host = await mk('HOST');
  await host.evaluate((opts) => {
    window.log = [];
    window.peer = new Peer('testroom-abc', opts);
    peer.on('open', id => window.log.push('open:' + id));
    peer.on('connection', c => {
      window.log.push('connection de ' + c.peer);
      c.on('open', () => { window.log.push('conn open'); c.send({ t: 'hola' }); });
      c.on('data', d => window.log.push('data:' + JSON.stringify(d)));
      c.on('error', e => window.log.push('conn error:' + e.type + ' ' + e.message));
      c.on('iceStateChanged', s => window.log.push('ice:' + s));
    });
    peer.on('error', e => window.log.push('peer error:' + e.type + ' ' + e.message));
  }, OPTS);
  await sleep(1500);
  console.log('HOST log:', await host.evaluate(() => window.log));

  const guest = await mk('GUEST');
  await guest.evaluate((opts) => {
    window.log = [];
    window.peer = new Peer(opts);
    peer.on('open', id => {
      window.log.push('open:' + id);
      const c = peer.connect('testroom-abc', { reliable: true });
      window.conn = c;
      c.on('open', () => { window.log.push('conn open'); c.send({ t: 'join' }); });
      c.on('data', d => window.log.push('data:' + JSON.stringify(d)));
      c.on('error', e => window.log.push('conn error:' + e.type + ' ' + e.message));
      c.on('iceStateChanged', s => window.log.push('ice:' + s));
    });
    peer.on('error', e => window.log.push('peer error:' + e.type + ' ' + e.message));
  }, OPTS);
  await sleep(8000);
  console.log('HOST log:', await host.evaluate(() => window.log));
  console.log('GUEST log:', await guest.evaluate(() => window.log));
  await browser.close();
})();
