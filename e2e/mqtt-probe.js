// Sonda MQTT cruda contra los brokers públicos, con el MISMO paquete CONNECT de la app
const WebSocket = require('ws');
function probe(url){
  return new Promise(resolve => {
    const to = setTimeout(() => { resolve(url + ' -> TIMEOUT sin CONNACK'); try{ws.terminate()}catch(e){} }, 12000);
    let ws;
    try { ws = new WebSocket(url, ['mqtt']); } catch(e){ clearTimeout(to); return resolve(url + ' -> ERROR ctor ' + e.message); }
    ws.on('open', () => {
      const enc = s => { const b = Buffer.from(s, 'utf8'); return Buffer.concat([Buffer.from([0, b.length]), b]); };
      const vh = Buffer.concat([enc('MQTT'), Buffer.from([4, 2, 0, 60])]);
      const payload = Buffer.concat([vh, enc('bnv1-probe-' + Math.random().toString(36).slice(2,8))]);
      let rem = payload.length; const lenBytes = [];
      do { let b = rem % 128; rem = Math.floor(rem/128); if (rem>0) b |= 128; lenBytes.push(b); } while (rem>0);
      ws.send(Buffer.concat([Buffer.from([0x10, ...lenBytes]), payload]));
    });
    ws.on('message', d => { clearTimeout(to); resolve(url + ' -> respuesta tipo 0x' + (d[0]&0xF0).toString(16) + ' rc=' + (d.length>=4? d[3] : '?')); try{ws.close()}catch(e){} });
    ws.on('error', e => { clearTimeout(to); resolve(url + ' -> ERROR ' + e.message); });
  });
}
(async () => {
  console.log(await probe('wss://broker.emqx.io:8084/mqtt'));
  console.log(await probe('wss://broker.hivemq.com:8884/mqtt'));
  console.log(await probe('wss://test.mosquitto.org:8081/mqtt'));
})();
