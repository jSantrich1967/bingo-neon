// Smoke test Bingo Neón: funciones puras + ids + handlers
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
let fail = 0;
const ok = (cond, msg) => { console.log((cond ? 'OK  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

// 1) Extraer el script principal (el último <script> sin src)
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const main = scripts[scripts.length - 1];
ok(!!main, 'script principal encontrado');

// 2) Evaluar solo la parte de utilidades puras (hasta el fin de checkWin/speak)
const cut = main.indexOf('function speak');
const pureSrc = main.slice(0, cut).replace('"use strict";', '');
const sandbox = {};
require('vm').createContext(sandbox);
require('vm').runInContext(pureSrc + '\nthis.__t = {numWord, genCard, checkWin, letterOf};', sandbox);
const { numWord, genCard, checkWin, letterOf } = sandbox.__t;

// numWord
const words = {1:'uno',9:'nueve',15:'quince',16:'dieciséis',19:'diecinueve',20:'veinte',22:'veintidós',30:'treinta',31:'treinta y uno',45:'cuarenta y cinco',60:'sesenta',71:'setenta y uno',75:'setenta y cinco'};
for (const [n, w] of Object.entries(words)) ok(numWord(+n) === w, `numWord(${n}) = "${numWord(+n)}"`);

// letterOf
ok(letterOf(1)==='B' && letterOf(15)==='B' && letterOf(16)==='I' && letterOf(30)==='I' && letterOf(31)==='N' && letterOf(45)==='N' && letterOf(46)==='G' && letterOf(60)==='G' && letterOf(61)==='O' && letterOf(75)==='O', 'letterOf en los bordes de cada letra');

// genCard: rangos, unicidad, centro libre
for (let t = 0; t < 300; t++) {
  const c = genCard();
  const seen = new Set(); let good = c.length === 5;
  for (let col = 0; col < 5 && good; col++) {
    if (c[col].length !== 5) good = false;
    c[col].forEach((v, r) => {
      if (col === 2 && r === 2) { if (v !== 0) good = false; return; }
      if (v < col*15+1 || v > col*15+15 || seen.has(v)) good = false;
      seen.add(v);
    });
  }
  if (!good) { ok(false, 'genCard produjo un cartón inválido'); break; }
  if (t === 299) ok(true, 'genCard: 300 cartones válidos (rangos, sin repetir, centro libre)');
}

// checkWin: fila, columna, diagonal, cartón lleno, sin gane
(function(){
  const card = genCard();
  const drawnFila = new Set(card.map(col => col[0])); // fila r=0: card[c][0] para c=0..4
  ok(checkWin(card, drawnFila).lines.length >= 1 && !checkWin(card, drawnFila).full, 'checkWin detecta línea por fila');
  const drawnCol = new Set(card[0]);
  ok(checkWin(card, drawnCol).lines.length >= 1, 'checkWin detecta línea por columna');
  const diag = new Set([card[0][0], card[1][1], card[3][3], card[4][4]]); // centro libre cuenta solo
  ok(checkWin(card, diag).lines.length >= 1, 'checkWin detecta diagonal con centro libre');
  const all = new Set(card.flat().filter(v => v !== 0));
  const full = checkWin(card, all);
  ok(full.full && full.lines.length >= 5, 'checkWin detecta cartón lleno');
  ok(checkWin(card, new Set([card[0][0]])).lines.length === 0, 'checkWin no inventa ganes con 1 bola');
})();

// 3) Todos los ids usados en JS existen en el HTML
const idsUsed = new Set([...main.matchAll(/\$\("([A-Za-z0-9]+)"\)/g)].map(m => m[1]));
const idsHtml = new Set([...html.matchAll(/id="([A-Za-z0-9]+)"/g)].map(m => m[1]));
const missing = [...idsUsed].filter(id => !idsHtml.has(id));
ok(missing.length === 0, 'todos los ids del JS existen en el HTML' + (missing.length ? ' — faltan: ' + missing.join(',') : ''));

// 4) Handlers principales asignados
for (const h of ['btnCreate','btnJoin','btnDraw','btnReset','btnClose','btnLeave','btnBingo'])
  ok(main.includes(`$("${h}").onclick`), `handler asignado: ${h}`);

// 5) Mensajes clave del protocolo P2P presentes en host y guest
for (const t of ['welcome','join','spin','draw','bingo','bingoInvalid','winner','reset','closed','players'])
  ok(main.includes(`"${t}"`) || main.includes(`'${t}'`) || main.includes(`${t}:`) || main.includes(`type:"${t}"`) || main.includes(`type: "${t}"`), `tipo de mensaje en el código: ${t}`);

console.log(fail === 0 ? '\nTODO OK' : `\n${fail} FALLOS`);
process.exit(fail ? 1 : 0);
