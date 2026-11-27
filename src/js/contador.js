/* Contador acadêmico de palavras e caracteres.
   A lógica (contar, avaliarLimite) é separada da interface para poder ser testada em Node. */

const VELOCIDADE_LEITURA = 200; // palavras por minuto (média de leitura silenciosa, valor de referência)

function contar(texto) {
  const t = String(texto || "");
  // Palavra = sequência separada por espaço que contenha ao menos uma letra ou número
  const palavras = t.split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;
  const caracteres = Array.from(t).length;
  const caracteresSemEspacos = Array.from(t.replace(/\s/g, "")).length;
  const paragrafos = t.split(/\n\s*\n/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;
  const frases = t
    .split(/[.!?…]+/)
    .filter((f) => /[\p{L}\p{N}]/u.test(f)).length;
  const minutosLeitura = palavras === 0 ? 0 : Math.max(1, Math.round(palavras / VELOCIDADE_LEITURA));
  return { palavras, caracteres, caracteresSemEspacos, paragrafos, frases, minutosLeitura };
}

// Compara o valor atual com um intervalo [min, max]. min e max podem ser null (sem limite).
function avaliarLimite(valor, min, max) {
  const temMin = typeof min === "number" && !Number.isNaN(min);
  const temMax = typeof max === "number" && !Number.isNaN(max);
  if (!temMin && !temMax) return { estado: "semlimite" };
  if (temMax && valor > max) return { estado: "acima", excesso: valor - max };
  if (temMin && valor < min) return { estado: "abaixo", falta: min - valor };
  return { estado: "dentro" };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { contar, avaliarLimite };
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    const $ = (id) => document.getElementById(id);
    const texto = $("texto");
    if (!texto) return;

    const campos = {
      palavras: $("r-palavras"),
      caracteres: $("r-caracteres"),
      semEspacos: $("r-sem-espacos"),
      paragrafos: $("r-paragrafos"),
      frases: $("r-frases"),
      leitura: $("r-leitura"),
    };
    const nf = new Intl.NumberFormat("pt-BR");

    const preset = $("preset");
    const unidade = $("limite-unidade");
    const inputMin = $("limite-min");
    const inputMax = $("limite-max");
    const msg = $("limite-msg");
    const barra = $("barra");
    const barraInterna = barra.firstElementChild;

    function lerNumero(el) {
      const v = el.value.trim();
      return v === "" ? null : Number(v);
    }

    function atualizar() {
      const r = contar(texto.value);
      campos.palavras.textContent = nf.format(r.palavras);
      campos.caracteres.textContent = nf.format(r.caracteres);
      campos.semEspacos.textContent = nf.format(r.caracteresSemEspacos);
      campos.paragrafos.textContent = nf.format(r.paragrafos);
      campos.frases.textContent = nf.format(r.frases);
      campos.leitura.textContent = r.minutosLeitura + " min";

      const valor = unidade.value === "caracteres" ? r.caracteres : r.palavras;
      const rotulo = unidade.value === "caracteres" ? "caracteres" : "palavras";
      const min = lerNumero(inputMin);
      const max = lerNumero(inputMax);
      const av = avaliarLimite(valor, min, max);

      msg.className = "mensagem";
      barra.classList.remove("estourou");
      if (av.estado === "semlimite") {
        msg.hidden = true;
        barra.hidden = true;
        return;
      }
      msg.hidden = false;
      barra.hidden = false;
      const alvo = max !== null ? max : min;
      barraInterna.style.width = Math.min(100, (valor / alvo) * 100) + "%";
      if (av.estado === "acima") {
        msg.classList.add("erro");
        barra.classList.add("estourou");
        msg.textContent = `Acima do limite: ${nf.format(av.excesso)} ${rotulo} a mais (máximo ${nf.format(max)}).`;
      } else if (av.estado === "abaixo") {
        msg.classList.add("alerta");
        msg.textContent = `Abaixo do mínimo: faltam ${nf.format(av.falta)} ${rotulo} (mínimo ${nf.format(min)}).`;
      } else {
        msg.classList.add("ok");
        msg.textContent = `Dentro do limite (${nf.format(valor)} ${rotulo}).`;
      }
    }

    preset.addEventListener("change", () => {
      const opt = preset.selectedOptions[0];
      if (opt.dataset.unidade) {
        unidade.value = opt.dataset.unidade;
        inputMin.value = opt.dataset.min || "";
        inputMax.value = opt.dataset.max || "";
      } else if (opt.value === "nenhum") {
        inputMin.value = "";
        inputMax.value = "";
      }
      atualizar();
    });

    [texto, unidade, inputMin, inputMax].forEach((el) => el.addEventListener("input", atualizar));

    $("limpar").addEventListener("click", () => {
      texto.value = "";
      texto.focus();
      atualizar();
    });

    $("copiar").addEventListener("click", async () => {
      const r = contar(texto.value);
      const resumo = `Palavras: ${r.palavras} | Caracteres: ${r.caracteres} | Sem espaços: ${r.caracteresSemEspacos} | Parágrafos: ${r.paragrafos}`;
      try {
        await navigator.clipboard.writeText(resumo);
        $("copiar").textContent = "Copiado!";
        setTimeout(() => ($("copiar").textContent = "Copiar contagem"), 1500);
      } catch (e) {
        $("copiar").textContent = "Não foi possível copiar";
      }
    });

    atualizar();
  });
}
