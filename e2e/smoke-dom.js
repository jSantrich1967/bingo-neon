// Smoke conductual con jsdom: dos "teléfonos" (dos jsdom) hablando por un relevo falso en memoria.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');

const buses = new Map();
function bus(topic) { if (!buses.has(topic)) buses.set(topic, new Set()); return buses.get(topic); }
class FakeWS {
  constructor(url) {
    this.topic = decodeURIComponent(url.replace('wss://ntfy.sh/', '').replace(/\/ws$/, ''));
    bus(this.topic).add(this);
    setTimeout(() => this.onopen && this.onopen(), 0);
  }
  close() { bus(this.topic).delete(this); this.onclose && this.onclose(); }
}
function fakeFetch(url, opts) {
  const topic = decodeURIComponent(url.replace('https://ntfy.sh/', ''));
  const body = opts && opts.body;
  const data = JSON.stringify({ event: 'message', message: body });
  bus(topic).forEach(ws => { if (ws.onmessage) ws.onmessage({ data }); });
  return Promise.resolve({ ok: true });
}
function makePhone() {
  const dom = new JSDOM(html, { url: 'https://jsantrich1967.github.io/bingo-neon/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window;
  w.WebSocket = FakeWS;
  w.fetch = fakeFetch;
  w.speechSynthesis = { getVoices: () => [], speak: () => {} };
  w.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  w.scrollTo = () => {};
  return w;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const results = [];
  const check = (ok, msg) => { results.push(ok); console.log((ok ? 'OK  ' : 'FAIL') + ' ' + msg); };

  const host = makePhone();
  await sleep(300);
  host.document.getElementById('inpName').value = 'Anfitrión Test';
  host.document.getElementById('btnCreate').click();
  await sleep(300);
  check(!host.document.getElementById('scrHost').classList.contains('hidden'), 'anfitrión crea sala y ve su pantalla');
  const code = host.document.getElementById('hostCode').textContent.trim();
  check(/^[A-Z0-9]{6}$/.test(code), 'código de sala: ' + code);
  check(host.document.getElementById('hostPCount').textContent === '1', 'anfitrión se cuenta como 1 jugador');
  const qrImg = host.document.querySelector('#qr img');
  check(!!qrImg && qrImg.src.includes('api.qrserver.com'), 'QR visible como imagen');

  const guest = makePhone();
  await sleep(300);
  guest.document.getElementById('inpName').value = 'Invitado Test';
  guest.document.getElementById('inpCode').value = code;
  guest.document.getElementById('btnJoin').click();
  await sleep(1200);
  const guestIn = !guest.document.getElementById('scrGuest').classList.contains('hidden');
  check(guestIn, 'EL INVITADO ENTRA a la sala');
  if (!guestIn) console.log('   estado invitado:', guest.document.getElementById('homeStatus').textContent);
  check(guest.document.querySelectorAll('#guestCard .cell').length === 25, 'cartón del invitado con 25 celdas');
  const hostCardTxt = [...host.document.querySelectorAll('#hostCard .cell')].map(e => e.textContent).join(',');
  const guestCardTxt = [...guest.document.querySelectorAll('#guestCard .cell')].map(e => e.textContent).join(',');
  check(hostCardTxt !== guestCardTxt, 'el cartón del invitado es distinto al del anfitrión');
  check(host.document.getElementById('hostPCount').textContent === '2', 'anfitrión ve 2 jugadores');
  check(guest.document.getElementById('guestPCount').textContent === '2', 'invitado ve 2 jugadores');

  host.document.getElementById('btnDraw').click();
  await sleep(300);
  check(host.document.getElementById('cageHost').classList.contains('spin'), 'biombo del anfitrión girando');
  check(guest.document.getElementById('cageGuest').classList.contains('spin'), 'biombo del INVITADO girando (llegó el giro)');
  await sleep(2600);
  const hw = host.document.getElementById('hostWord').textContent;
  const gw = guest.document.getElementById('guestWord').textContent;
  check(/¡[BINGO] — \d+/.test(hw), 'bola en anfitrión: "' + hw + '"');
  check(hw === gw, 'MISMA bola en el invitado: "' + gw + '"');
  check(guest.document.getElementById('guestCount').textContent === '1/75', 'tablero del invitado 1/75');

  guest.document.getElementById('btnBingo').click();
  await sleep(300);
  check(guest.document.getElementById('bingoMsg').textContent.includes('Todavía no'), 'bingo sin línea rechazado al instante en el propio teléfono');


  // --- Formas de ganar: el anfitrión cambia a Cuatro esquinas ---
  const sel = host.document.getElementById('selPattern');
  sel.value = 'esquinas';
  sel.dispatchEvent(new host.window.Event('change'));
  await sleep(900);
  check(guest.document.getElementById('guestPatternName').textContent === 'Cuatro esquinas', 'el invitado ve la nueva forma: Cuatro esquinas');
  const patOn = guest.document.querySelectorAll('#guestPatternGrid .patcell.on').length;
  check(patOn === 4, 'el diagrama del invitado marca las 4 esquinas (' + patOn + ')');
  const patHost = host.document.querySelectorAll('#hostPatternGrid .patcell.on').length;
  check(patHost === 4, 'el diagrama del anfitrión marca las 4 esquinas');
  check(guest.document.getElementById('guestCount').textContent === '0/75', 'cambiar la forma reinicia la partida del invitado');
  const patCellsOnCard = guest.document.querySelectorAll('#guestCard .cell.pat').length;
  check(patCellsOnCard === 4, 'las 4 esquinas se bordean en dorado en el cartón del invitado (' + patCellsOnCard + ')');


  // --- Modo automático: gira solo dos veces y se detiene al pasar a manual ---
  host.document.getElementById('selSpeed').value = '4000';
  host.document.getElementById('selSpeed').dispatchEvent(new host.window.Event('change'));
  host.document.getElementById('btnModeAuto').click();
  await sleep(11500); // 1,2s arranque + giro 2,3s + espera 4s + giro 2,3s ≈ 2 bolas
  check(guest.document.getElementById('guestCount').textContent === '2/75', 'AUTOMÁTICO: el invitado recibió 2 bolas sin tocar nada (va ' + guest.document.getElementById('guestCount').textContent + ')');
  host.document.getElementById('btnModeManual').click();
  await sleep(9000);
  check(guest.document.getElementById('guestCount').textContent === '2/75', 'al pasar a MANUAL el automático se detiene (sigue ' + guest.document.getElementById('guestCount').textContent + ')');

  const fails = results.filter(r => !r).length;
  console.log(fails === 0 ? '\nSMOKE TODO OK' : '\nSMOKE CON ' + fails + ' FALLOS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('EXCEPCION:', e); process.exit(1); });
