// Prueba local sin interceptación: página e2e-page.html (scripts locales) + broker propio.
const puppeteer = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server'] });
  const mk = async (tag) => {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    p.on('console', m => console.log(tag, 'console:', m.type(), m.text().slice(0, 220)));
    p.on('pageerror', e => console.log(tag, 'pageerror:', e.message));
    return p;
  };
  const PAGE = 'http://127.0.0.1:8901/e2e-page.html?localtest=1';
  const host = await mk('HOST');
  await host.goto(PAGE, { waitUntil: 'networkidle2' });
  await host.type('#inpName', 'Anfitrión Local');
  await host.click('#btnCreate');
  try { await host.waitForFunction(() => !document.getElementById('scrHost').classList.contains('hidden'), { timeout: 15000 }); }
  catch (e) { console.log('HOST no creó sala; estado:', await host.$eval('#homeStatus', el => el.textContent)); process.exit(1); }
  const code = (await host.$eval('#hostCode', el => el.textContent)).trim();
  console.log('SALA:', code);

  const guest = await mk('GUEST');
  await guest.goto(PAGE, { waitUntil: 'networkidle2' });
  await guest.type('#inpName', 'Invitado Local');
  await guest.type('#inpCode', code);
  await guest.click('#btnJoin');
  let ok = true;
  try { await guest.waitForFunction(() => !document.getElementById('scrGuest').classList.contains('hidden'), { timeout: 20000 }); }
  catch (e) { ok = false; }
  console.log('INVITADO ENTRO:', ok);
  if (!ok) { console.log('estado invitado:', await guest.$eval('#homeStatus', el => el.textContent)); }
  if (ok) {
    console.log('jugadores anfitrión:', await host.$eval('#hostPlayers', el => el.textContent.replace(/\s+/g, ' ')));
    console.log('jugadores invitado:', await guest.$eval('#guestPlayers', el => el.textContent.replace(/\s+/g, ' ')));
    await host.click('#btnDraw');
    await guest.waitForFunction(() => /¡[BINGO] — \d+/.test(document.getElementById('guestWord').textContent), { timeout: 20000 });
    console.log('BOLA INVITADO:', await guest.$eval('#guestWord', el => el.textContent));
    console.log('BOLA ANFITRION:', await host.$eval('#hostWord', el => el.textContent));
    console.log('TABLERO INVITADO:', await guest.$eval('#guestCount', el => el.textContent));
  }
  await browser.close();
})();
