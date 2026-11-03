const puppeteer=require('puppeteer');
const jsQR=require('jsqr'); const {PNG}=require('pngjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-dev-shm-usage','--no-proxy-server']});
 const p=await browser.newPage();
 await p.setRequestInterception(true);
 p.on('request',req=>{ if(req.url().includes('ntfy.sh')) req.respond({status:200,contentType:'application/json',body:'{}'}); else req.continue(); });
 await p.goto('http://127.0.0.1:8901/index.html',{waitUntil:'networkidle2'});
 await p.type('#inpName','QR Scan'); await p.click('#btnCreate'); await sleep(600);
 const dataUrl=await p.evaluate(()=>{ const cv=document.querySelector('#qr canvas'); return cv? cv.toDataURL('image/png') : null; });
 const link=await p.evaluate(()=>document.getElementById('hostLink').textContent);
 if(!dataUrl){ console.log('SIN CANVAS'); process.exit(1); }
 const png=PNG.sync.read(Buffer.from(dataUrl.split(',')[1],'base64'));
 const code=jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
 console.log('tamaño QR:', png.width+'x'+png.height);
 console.log('decodificado:', code? code.data : 'NO SE PUDO DECODIFICAR');
 console.log('enlace real :', link);
 console.log('coinciden:', !!(code && code.data===link));
 await browser.close();
})();
