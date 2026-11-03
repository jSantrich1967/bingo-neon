// Control: RTCPeerConnection directo entre dos páginas, SDP/ICE intercambiados a mano.
const puppeteer = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server'] });
  const mk = async () => {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setContent('<html><body>rtc</body></html>');
    return p;
  };
  const a = await mk(), b = await mk();
  await a.evaluate(() => {
    window.pc = new RTCPeerConnection();
    window.dc = pc.createDataChannel('x');
    window.log = [];
    dc.onopen = () => { log.push('dc open'); dc.send('hola desde A'); };
    dc.onmessage = e => log.push('msg:' + e.data);
    pc.onicecandidate = e => { if (e.candidate) window.__ice = window.__ice || [], window.__ice.push(e.candidate.toJSON()); };
    pc.onconnectionstatechange = () => log.push('state:' + pc.connectionState);
    pc.oniceconnectionstatechange = () => log.push('ice:' + pc.iceConnectionState);
  });
  await b.evaluate(() => {
    window.pc = new RTCPeerConnection();
    window.log = [];
    pc.ondatachannel = e => { window.dc = e.channel; dc.onopen = () => log.push('dc open'); dc.onmessage = ev => { log.push('msg:' + ev.data); dc.send('respuesta de B'); }; };
    pc.onicecandidate = e => { if (e.candidate) window.__ice = window.__ice || [], window.__ice.push(e.candidate.toJSON()); };
    pc.onconnectionstatechange = () => log.push('state:' + pc.connectionState);
    pc.oniceconnectionstatechange = () => log.push('ice:' + pc.iceConnectionState);
  });
  const offer = await a.evaluate(async () => { const o = await pc.createOffer(); await pc.setLocalDescription(o); return pc.localDescription.toJSON(); });
  const answer = await b.evaluate(async (o) => { await pc.setRemoteDescription(o); const an = await pc.createAnswer(); await pc.setLocalDescription(an); return pc.localDescription.toJSON(); }, offer);
  await a.evaluate(async (an) => { await pc.setRemoteDescription(an); }, answer);
  for (let i = 0; i < 10; i++) {
    await sleep(700);
    const iceA = await a.evaluate(() => { const v = window.__ice || []; window.__ice = []; return v; });
    const iceB = await b.evaluate(() => { const v = window.__ice || []; window.__ice = []; return v; });
    for (const c of iceB) await a.evaluate(async (c) => { try { await pc.addIceCandidate(c); } catch (e) {} }, c);
    for (const c of iceA) await b.evaluate(async (c) => { try { await pc.addIceCandidate(c); } catch (e) {} }, c);
  }
  console.log('A:', await a.evaluate(() => window.log));
  console.log('B:', await b.evaluate(() => window.log));
  await browser.close();
})();
