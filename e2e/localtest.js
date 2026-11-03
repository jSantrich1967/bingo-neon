const puppeteer = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-dev-shm-usage','--no-proxy-server'] });
  const fs = require('fs');
  const peerjsCode = fs.readFileSync(__dirname + '/peerjs.min.js', 'utf8');
  const mk = async (tag) => {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setRequestInterception(true);
    p.on('request', req => {
      const u = req.url();
      if (u.includes('peerjs')) req.respond({ status: 200, contentType: 'application/javascript', body: peerjsCode });
      else if (u.includes('qrcode')) req.respond({ status: 200, contentType: 'application/javascript', body: 'window.QRCode={toCanvas:function(c,t,o,cb){if(cb)cb();}};' });
      else req.continue();
    });
    p.on('console', m => console.log(tag, 'console:', m.type(), m.text().slice(0,200)));
    p.on('pageerror', e => console.log(tag, 'pageerror:', e.message));
    return p;
  };
  const host = await mk('HOST');
  await host.goto('http://127.0.0.1:8901/?localtest=1', { waitUntil: 'networkidle2' });
  await host.type('#inpName', 'Anfitrión Local');
  await host.click('#btnCreate');
  try { await host.waitForFunction(() => !document.getElementById('scrHost').classList.contains('hidden'), { timeout: 15000 }); }
  catch(e){ console.log('HOST no creó sala'); process.exit(1); }
  const code = (await host.$eval('#hostCode', el => el.textContent)).trim();
  console.log('SALA:', code);

  const guest = await mk('GUEST');
  await guest.goto('http://127.0.0.1:8901/?localtest=1', { waitUntil: 'networkidle2' });
  await guest.type('#inpName', 'Invitado Local');
  await guest.type('#inpCode', code);
  await guest.click('#btnJoin');
  let ok = true;
  try { await guest.waitForFunction(() => !document.getElementById('scrGuest').classList.contains('hidden'), { timeout: 20000 }); }
  catch(e){ ok = false; }
  console.log('INVITADO ENTRO:', ok);
  if (!ok) console.log('estado invitado:', await guest.$eval('#homeStatus', el => el.textContent));
  if (ok) {
    await host.click('#btnDraw');
    await guest.waitForFunction(() => /¡[BINGO] — \d+/.test(document.getElementById('guestWord').textContent), { timeout: 20000 });
    console.log('BOLA EN INVITADO:', await guest.$eval('#guestWord', el => el.textContent));
    console.log('BOLA EN ANFITRION:', await host.$eval('#hostWord', el => el.textContent));
  }
  await browser.close();
})();
