// E2E Bingo Neón: anfitrión crea sala, invitado entra, anfitrión gira, invitado recibe la bola.
const puppeteer = require('puppeteer');
const URL = process.argv[2] || 'https://jsantrich1967.github.io/bingo-neon/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const proxy = process.env.BINGO_PROXY || 'http://hatch-egress-proxy:3128';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-fake-ui-for-media-stream', '--proxy-server=' + proxy] });
  const results = [];
  const check = (ok, msg) => { results.push([ok, msg]); console.log((ok ? 'OK  ' : 'FAIL') + ' ' + msg); };

  try {
    // --- ANFITRIÓN ---
    const hostCtx = await browser.createBrowserContext();
    const host = await hostCtx.newPage();
    host.on('pageerror', e => console.log('HOST pageerror:', e.message));
    await host.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await host.type('#inpName', 'Anfitrión E2E');
    await host.click('#btnCreate');
    await host.waitForFunction(() => !document.getElementById('scrHost').classList.contains('hidden'), { timeout: 30000 });
    const code = (await host.$eval('#hostCode', el => el.textContent)).trim();
    check(/^[A-Z0-9]{6}$/.test(code), 'sala creada, código: ' + code);
    const qr = await host.$('#qr canvas');
    check(!!qr, 'QR visible en la sala del anfitrión');
    const hostCardNums = await host.$$eval('#hostCard .cell', els => els.map(e => e.textContent.trim()));
    check(hostCardNums.length === 25, 'cartón del anfitrión con 25 celdas');

    // --- INVITADO ---
    const guestCtx = await browser.createBrowserContext();
    const guest = await guestCtx.newPage();
    guest.on('pageerror', e => console.log('GUEST pageerror:', e.message));
    await guest.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await guest.type('#inpName', 'Invitado E2E');
    await guest.type('#inpCode', code);
    await guest.click('#btnJoin');
    let joined = true;
    try {
      await guest.waitForFunction(() => !document.getElementById('scrGuest').classList.contains('hidden'), { timeout: 30000 });
    } catch (e) { joined = false; }
    check(joined, 'el invitado entró a la sala');
    if (!joined) {
      const st = await guest.$eval('#homeStatus', el => el.textContent).catch(() => '(sin estado)');
      console.log('Estado del invitado:', st);
      throw new Error('join falló');
    }
    const guestCardNums = await guest.$$eval('#guestCard .cell', els => els.map(e => e.textContent.trim()));
    check(guestCardNums.length === 25, 'cartón del invitado con 25 celdas');
    check(JSON.stringify(guestCardNums) !== JSON.stringify(hostCardNums), 'el cartón del invitado es distinto al del anfitrión');
    const guestPlayers = await guest.$eval('#guestPlayers', el => el.textContent);
    check(guestPlayers.includes('Anfitrión E2E') && guestPlayers.includes('Invitado E2E'), 'el invitado ve a ambos jugadores');
    await sleep(500);
    const hostPlayers = await host.$eval('#hostPlayers', el => el.textContent);
    check(hostPlayers.includes('Invitado E2E'), 'el anfitrión ve entrar al invitado');

    // --- GIRO SINCRONIZADO ---
    await host.click('#btnDraw');
    await sleep(500);
    const guestWordSpin = await guest.$eval('#guestWord', el => el.textContent);
    check(/girando/i.test(guestWordSpin), 'el invitado ve el biombo girando: "' + guestWordSpin + '"');
    await guest.waitForFunction(() => {
      const w = document.getElementById('guestWord').textContent;
      return /¡[BINGO] — \d+/.test(w);
    }, { timeout: 20000 });
    const guestWord = await guest.$eval('#guestWord', el => el.textContent);
    const hostWord = await host.$eval('#hostWord', el => el.textContent);
    check(guestWord === hostWord, 'misma bola cantada en ambos: anfitrión "' + hostWord + '" = invitado "' + guestWord + '"');
    const m = guestWord.match(/— (\d+),/);
    const ball = m ? +m[1] : null;
    const guestBoard = await guest.$eval('#guestCount', el => el.textContent);
    check(guestBoard.startsWith('1/75'), 'tablero del invitado marca 1/75');
    const guestHit = await guest.$$eval('#guestCard .cell.hit', els => els.map(e => +e.textContent));
    if (ball && guestCardNums.includes(String(ball))) check(guestHit.includes(ball), 'la bola quedó automarcada en el cartón del invitado');
    else console.log('OK   (la bola ' + ball + ' no estaba en el cartón del invitado; automarcado no aplica)');

    // --- SEGUNDA BOLA ---
    await host.click('#btnDraw');
    await guest.waitForFunction(prev => document.getElementById('guestCount').textContent !== prev, { timeout: 20000 }, guestBoard);
    const guestBoard2 = await guest.$eval('#guestCount', el => el.textContent);
    check(guestBoard2.startsWith('2/75'), 'segunda bola también sincronizada (2/75)');

    // --- BINGO INVÁLIDO (verificación) ---
    await guest.click('#btnBingo');
    await guest.waitForFunction(() => document.getElementById('bingoMsg').textContent.includes('Todavía no'), { timeout: 15000 });
    check(true, 'el ¡BINGO! sin línea fue rechazado con aviso al jugador');
  } catch (e) {
    check(false, 'excepción: ' + e.message);
  } finally {
    await browser.close();
  }
  const fails = results.filter(r => !r[0]).length;
  console.log(fails === 0 ? '\nE2E TODO OK' : '\nE2E CON ' + fails + ' FALLOS');
  process.exit(fails ? 1 : 0);
})();
