// Testes da lógica das ferramentas. Rode com: npm test
const assert = require("node:assert/strict");
const { contar, avaliarLimite } = require("../src/js/contador.js");
const { lerNumero, mediaPonderada, notaNecessaria } = require("../src/js/media.js");

const perto = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
let ok = 0;
function teste(nome, fn) { fn(); ok++; console.log("ok -", nome); }

// ---------- contador ----------
teste("texto vazio", () => {
  const r = contar("");
  assert.equal(r.palavras, 0);
  assert.equal(r.caracteres, 0);
  assert.equal(r.paragrafos, 0);
  assert.equal(r.minutosLeitura, 0);
});
teste("palavras simples e espaços múltiplos", () => {
  assert.equal(contar("Olá   mundo\nnovo  texto").palavras, 4);
});
teste("palavras com hífen, apóstrofo e acentos contam como uma", () => {
  assert.equal(contar("guarda-chuva d'água coração").palavras, 3);
});
teste("pontuação solta não conta como palavra", () => {
  assert.equal(contar("Olá — mundo ... !").palavras, 2);
});
teste("números contam como palavra", () => {
  assert.equal(contar("Em 1789 ocorreu").palavras, 3);
});
teste("caracteres com e sem espaços", () => {
  const r = contar("a b\nc");
  assert.equal(r.caracteres, 5);
  assert.equal(r.caracteresSemEspacos, 3);
});
teste("caracteres astrais (emoji) contam como um", () => {
  assert.equal(contar("a😀").caracteres, 2);
});
teste("parágrafos separados por linha em branco", () => {
  assert.equal(contar("Um.\n\nDois.\n\n\nTrês.").paragrafos, 3);
});
teste("frases", () => {
  assert.equal(contar("Primeira. Segunda? Terceira!").frases, 3);
});
teste("tempo de leitura mínimo de 1 minuto quando há texto", () => {
  assert.equal(contar("uma palavra").minutosLeitura, 1);
  assert.equal(contar(Array(400).fill("p").join(" ")).minutosLeitura, 2);
});
teste("limites", () => {
  assert.equal(avaliarLimite(100, 150, 500).estado, "abaixo");
  assert.equal(avaliarLimite(100, 150, 500).falta, 50);
  assert.equal(avaliarLimite(600, 150, 500).estado, "acima");
  assert.equal(avaliarLimite(600, 150, 500).excesso, 100);
  assert.equal(avaliarLimite(300, 150, 500).estado, "dentro");
  assert.equal(avaliarLimite(300, null, null).estado, "semlimite");
  assert.equal(avaliarLimite(300, null, 300).estado, "dentro");
});

// ---------- calculadora ----------
teste("lerNumero aceita vírgula e rejeita vazio", () => {
  assert.equal(lerNumero("7,5"), 7.5);
  assert.equal(lerNumero("7.5"), 7.5);
  assert.ok(Number.isNaN(lerNumero("")));
  assert.ok(Number.isNaN(lerNumero("abc")));
});
teste("média ponderada", () => {
  const r = mediaPonderada([{ nota: 8, peso: 2 }, { nota: 6, peso: 3 }]);
  perto(r.media, (16 + 18) / 5);
  perto(r.somaPesos, 5);
});
teste("média ignora linhas incompletas e peso zero", () => {
  const r = mediaPonderada([{ nota: 8, peso: 1 }, { nota: NaN, peso: 1 }, { nota: 5, peso: 0 }]);
  perto(r.media, 8);
});
teste("sem dados retorna null", () => {
  assert.equal(mediaPonderada([]), null);
});
teste("nota necessária: exemplo clássico", () => {
  // notas 6 e 5 (pesos 1 e 1), falta prova de peso 2, alvo 7 → (7*4 - 11)/2 = 8,5
  const r = notaNecessaria([{ nota: 6, peso: 1 }, { nota: 5, peso: 1 }], 2, 7);
  perto(r.necessaria, 8.5);
  assert.equal(r.situacao, "possivel");
});
teste("nota necessária: impossível", () => {
  const r = notaNecessaria([{ nota: 2, peso: 3 }], 1, 7);
  // (7*4 - 6)/1 = 22
  perto(r.necessaria, 22);
  assert.equal(r.situacao, "impossivel");
});
teste("nota necessária: já garantida", () => {
  const r = notaNecessaria([{ nota: 10, peso: 3 }], 1, 7);
  // (7*4 - 30)/1 = -2
  assert.equal(r.situacao, "garantida");
});
teste("nota necessária sem notas anteriores", () => {
  const r = notaNecessaria([], 1, 7);
  perto(r.necessaria, 7);
});
teste("nota necessária com parâmetros inválidos", () => {
  assert.equal(notaNecessaria([], NaN, 7), null);
  assert.equal(notaNecessaria([], 0, 7), null);
  assert.equal(notaNecessaria([], 1, NaN), null);
});
teste("nota máxima configurável (escala 0–100)", () => {
  const r = notaNecessaria([{ nota: 60, peso: 1 }], 1, 70, 100);
  perto(r.necessaria, 80);
  assert.equal(r.situacao, "possivel");
});

console.log(`\n${ok} testes passaram.`);
