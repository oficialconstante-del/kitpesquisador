/* Calculadora de média ponderada e "quanto preciso tirar".
   Lógica pura (testável em Node) + interface. */

// Aceita "7,5" e "7.5". Campo vazio ou inválido retorna NaN.
function lerNumero(valor) {
  if (valor === null || valor === undefined) return NaN;
  const s = String(valor).trim().replace(",", ".");
  if (s === "") return NaN;
  return Number(s);
}

// itens: [{ nota, peso }]. Linhas incompletas são ignoradas.
function mediaPonderada(itens) {
  let soma = 0;
  let pesos = 0;
  for (const it of itens) {
    if (Number.isNaN(it.nota) || Number.isNaN(it.peso) || it.peso <= 0) continue;
    soma += it.nota * it.peso;
    pesos += it.peso;
  }
  if (pesos === 0) return null;
  return { media: soma / pesos, somaPesos: pesos, somaPonderada: soma };
}

// Nota necessária na avaliação restante para atingir a média-alvo.
// Fórmula: (alvo * (pesosAtuais + pesoRestante) - somaPonderadaAtual) / pesoRestante
function notaNecessaria(itens, pesoRestante, alvo, notaMaxima = 10) {
  if (Number.isNaN(pesoRestante) || pesoRestante <= 0 || Number.isNaN(alvo)) return null;
  const atual = mediaPonderada(itens) || { somaPesos: 0, somaPonderada: 0 };
  const necessaria = (alvo * (atual.somaPesos + pesoRestante) - atual.somaPonderada) / pesoRestante;
  let situacao = "possivel";
  if (necessaria <= 0) situacao = "garantida";
  else if (necessaria > notaMaxima) situacao = "impossivel";
  return { necessaria, situacao };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { lerNumero, mediaPonderada, notaNecessaria };
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    const corpo = document.getElementById("linhas");
    if (!corpo) return;
    const $ = (id) => document.getElementById(id);
    const fmt = (n) => n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    function novaLinha(nota = "", peso = "1") {
      const tr = document.createElement("tr");
      const n = corpo.children.length + 1;
      tr.innerHTML = `
        <td>${n}</td>
        <td><input type="text" inputmode="decimal" class="nota" aria-label="Nota da avaliação ${n}" value="${nota}"></td>
        <td><input type="text" inputmode="decimal" class="peso" aria-label="Peso da avaliação ${n}" value="${peso}"></td>
        <td><button type="button" class="botao botao-secundario remover" aria-label="Remover avaliação ${n}">Remover</button></td>`;
      corpo.appendChild(tr);
    }

    function renumerar() {
      [...corpo.children].forEach((tr, i) => {
        const n = i + 1;
        tr.children[0].textContent = n;
        tr.querySelector(".nota").setAttribute("aria-label", `Nota da avaliação ${n}`);
        tr.querySelector(".peso").setAttribute("aria-label", `Peso da avaliação ${n}`);
        tr.querySelector(".remover").setAttribute("aria-label", `Remover avaliação ${n}`);
      });
    }

    function lerItens() {
      return [...corpo.children].map((tr) => ({
        nota: lerNumero(tr.querySelector(".nota").value),
        peso: lerNumero(tr.querySelector(".peso").value),
      }));
    }

    function calcular() {
      const itens = lerItens();
      const notaMax = lerNumero($("nota-maxima").value) || 10;
      const res = mediaPonderada(itens);
      $("r-media").textContent = res ? fmt(res.media) : "—";
      $("r-pesos").textContent = res ? fmt(res.somaPesos) : "—";

      const alvo = lerNumero($("media-alvo").value);
      const pesoRest = lerNumero($("peso-restante").value);
      const caixa = $("r-necessaria");
      caixa.className = "mensagem";
      const nec = notaNecessaria(itens, pesoRest, alvo, notaMax);
      if (!nec) {
        caixa.textContent = "Informe a média desejada e o peso da avaliação que falta para ver a nota necessária.";
        return;
      }
      if (nec.situacao === "garantida") {
        caixa.classList.add("ok");
        caixa.textContent = `Você já atingiu a média ${fmt(alvo)}: qualquer nota na avaliação restante mantém a aprovação.`;
      } else if (nec.situacao === "impossivel") {
        caixa.classList.add("erro");
        caixa.textContent = `Seria preciso tirar ${fmt(nec.necessaria)}, acima da nota máxima (${fmt(notaMax)}). Com essas notas, não é possível atingir a média ${fmt(alvo)}.`;
      } else {
        caixa.classList.add("alerta");
        caixa.textContent = `Você precisa de ${fmt(nec.necessaria)} na avaliação restante para chegar à média ${fmt(alvo)}.`;
      }
    }

    $("adicionar").addEventListener("click", () => { novaLinha(); calcular(); });
    corpo.addEventListener("click", (e) => {
      if (e.target.classList.contains("remover")) {
        e.target.closest("tr").remove();
        renumerar();
        calcular();
      }
    });
    document.querySelector(".ferramenta").addEventListener("input", calcular);

    novaLinha("", "1");
    novaLinha("", "1");
    calcular();
  });
}
