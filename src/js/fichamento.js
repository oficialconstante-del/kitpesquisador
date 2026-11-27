/* Gerador de fichamentos — Kit Pesquisador.
   Tudo roda no navegador; os fichamentos ficam no localStorage ("kp_fichas").
   Usa abnt() e preparar() de referencias.js para a referência e as chamadas de citação. */
(function (raiz) {
  "use strict";

  const R = typeof module !== "undefined" && module.exports ? require("./referencias.js") : raiz;

  /* ======================= utilidades ======================= */

  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const des = (h) => String(h).replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const linha = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  // Mantém quebras de parágrafo; limpa espaços dentro das linhas.
  const bloco = (s) => String(s == null ? "" : s).replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const linhas = (s) => bloco(s).split("\n").map((l) => l.replace(/^[-•*]\s+|^\d+[.)]\s+/, "").trim()).filter(Boolean);

  const MODELOS = {
    completo: { nome: "Fichamento completo", desc: "Todas as seções: síntese, estrutura do argumento, citações, conceitos e análise crítica." },
    citacoes: { nome: "Fichamento de citações", desc: "Trechos transcritos fielmente, com a página e a chamada de citação (ABNT NBR 10520:2023)." },
    resumo: { nome: "Fichamento de resumo", desc: "Síntese das ideias da obra com as suas palavras, sem juízo de valor." },
    comentario: { nome: "Fichamento de comentário", desc: "Síntese, estrutura do argumento e sua análise crítica da obra." },
  };

  const SECOES = {
    sintese: ["completo", "resumo", "comentario"],
    argumento: ["completo", "comentario"],
    citacoes: ["completo", "citacoes", "resumo", "comentario"],
    conceitos: ["completo", "citacoes", "resumo", "comentario"],
    critica: ["completo", "comentario"],
  };

  const CAMPOS_SINTESE = [
    ["resumo", "Resumo"],
    ["objetivo", "Objetivo da obra"],
    ["problema", "Problema ou pergunta central"],
    ["tese", "Tese central"],
    ["ideias", "Ideias principais"],
    ["metodo", "Método, fontes e corpus"],
    ["conclusoes", "Conclusões do autor"],
  ];
  const CAMPOS_CRITICA = [
    ["avaliacao", "Avaliação geral"],
    ["contribuicoes", "Contribuições"],
    ["limitacoes", "Limitações e objeções"],
    ["relacao", "Relação com a minha pesquisa"],
  ];
  const TIPOS_ARG = {
    "": "",
    dedutivo: "Dedutivo",
    indutivo: "Indutivo",
    abdutivo: "Abdutivo (inferência à melhor explicação)",
    analogico: "Por analogia",
    autoridade: "Por autoridade ou testemunho",
    misto: "Misto",
  };
  const TIPOS_ENTRADA = { direta: "Citação direta", parafrase: "Paráfrase (citação indireta)", comentario: "Comentário" };

  const TEXTO = ["modelo", "tema", "palavras", "refModo", "refManual", "autorCitacao", "anoCitacao", "dataLeitura", "paginasLidas", "localizacao", "leitor",
    "resumo", "objetivo", "problema", "tese", "ideias", "metodo", "conclusoes",
    "premissas", "conclusaoArg", "tipoArg", "obsArg", "conceitos",
    "avaliacao", "contribuicoes", "limitacoes", "relacao", "leituras"];

  function novoId() {
    return "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function novaFicha(modelo) {
    const f = { id: novoId(), criado: new Date().toISOString(), atualizado: new Date().toISOString(), ref: null, entradas: [] };
    for (const k of TEXTO) f[k] = "";
    f.modelo = MODELOS[modelo] ? modelo : "completo";
    f.refModo = "lista";
    return f;
  }

  // Aceita qualquer objeto (por exemplo, de um backup importado) e devolve uma ficha válida.
  function normalizarFicha(o) {
    const f = novaFicha();
    if (!o || typeof o !== "object") return f;
    for (const k of TEXTO) if (o[k] !== undefined && o[k] !== null) f[k] = String(o[k]);
    if (!MODELOS[f.modelo]) f.modelo = "completo";
    if (f.refModo !== "manual") f.refModo = "lista";
    if (!(f.tipoArg in TIPOS_ARG)) f.tipoArg = "";
    if (typeof o.id === "string" && o.id) f.id = o.id.slice(0, 40);
    if (typeof o.criado === "string") f.criado = o.criado;
    if (typeof o.atualizado === "string") f.atualizado = o.atualizado;
    f.ref = o.ref && typeof o.ref === "object" && !Array.isArray(o.ref) ? { ...o.ref } : null;
    f.entradas = (Array.isArray(o.entradas) ? o.entradas : []).filter((e) => e && typeof e === "object").map((e) => ({
      tipo: TIPOS_ENTRADA[e.tipo] ? e.tipo : "direta",
      pagina: String(e.pagina == null ? "" : e.pagina),
      texto: String(e.texto == null ? "" : e.texto),
      nota: String(e.nota == null ? "" : e.nota),
    }));
    return f;
  }

  // Lê um backup: lista, objeto {fichamentos: [...]} ou uma ficha só.
  function lerBackup(dados) {
    let lista = dados;
    if (dados && !Array.isArray(dados) && Array.isArray(dados.fichamentos)) lista = dados.fichamentos;
    if (!Array.isArray(lista)) lista = dados && typeof dados === "object" ? [dados] : [];
    return lista.filter((x) => x && typeof x === "object").map(normalizarFicha);
  }

  /* ======================= citação (ABNT NBR 10520:2023) ======================= */

  const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e", "di", "du", "van", "von", "del", "la", "le", "y"]);
  const ARTIGOS = new Set(["o", "a", "os", "as", "um", "uma", "uns", "umas"]);

  // A NBR 10520:2023 usa só a inicial maiúscula na chamada: (Silva, 2020). "SILVA" vira "Silva".
  function sobrenomeCitacao(s) {
    s = linha(s);
    if (!s || s !== s.toUpperCase() || s === s.toLowerCase()) return s;
    return s.toLowerCase().split(" ").map((p, i) =>
      i > 0 && PARTICULAS.has(p) ? p : p.split("-").map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join("-")
    ).join(" ");
  }

  // Sem autor: primeira palavra do título (com o artigo, se houver) seguida de [...].
  function tituloCitacao(t) {
    const p = linha(t).split(" ").filter(Boolean);
    if (!p.length) return "";
    const n = p.length > 1 && (ARTIGOS.has(p[0].toLowerCase()) || p[0].length === 1) ? 2 : 1;
    return p.slice(0, n).join(" ") + (p.length > n ? " [...]" : "");
  }

  // Dados para a chamada, a partir da referência da lista ou dos campos manuais.
  function baseCitacao(f) {
    if (f.refModo === "manual") {
      const nomes = linha(f.autorCitacao).split(/\s*;\s*/).map(sobrenomeCitacao).filter(Boolean);
      return { nomes, ano: linha(f.anoCitacao), titulo: nomes.length ? "" : linha(f.refManual) };
    }
    if (!f.ref) return { nomes: [], ano: "", titulo: "" };
    const r = R.preparar(f.ref);
    const nomes = r.autores.map((a) => (a.inst ? linha(a.inst) : sobrenomeCitacao(a.familia))).filter(Boolean);
    return { nomes, ano: r.ano, titulo: r.titulo };
  }

  function localizador(p) {
    p = linha(p);
    if (!p) return "";
    if (/^\d/.test(p)) return "p. " + p.replace(/\s*[-–—]\s*/g, "-");
    return p;
  }

  function chamada(base, pagina) {
    let quem;
    if (base.nomes.length === 0) {
      quem = tituloCitacao(base.titulo);
      if (!quem) return "";
    } else if (base.nomes.length > 3) {
      quem = base.nomes[0] + " et al.";
    } else {
      quem = base.nomes.join("; ");
    }
    const partes = [quem, base.ano || "[s. d.]"];
    const pg = localizador(pagina);
    if (pg) partes.push(pg);
    return "(" + partes.join(", ") + ")";
  }

  // Mais de três linhas (≈ 260 caracteres em A4, Times 12) = citação longa: recuo de 4 cm, sem aspas.
  const LIMITE_LONGA = 260;
  function citacaoLonga(texto) {
    return linha(texto).length > LIMITE_LONGA;
  }

  const semPontoFinal = (t) => t.replace(/\s*\.$/, "").replace(/\s+$/, "");

  // Devolve { longa, html } — html já escapado, sem a marcação de bloco.
  function formatarEntrada(e, base) {
    const ch = chamada(base, e.pagina);
    const t = bloco(e.texto);
    if (!t) return { longa: false, html: "", chamada: ch };
    if (e.tipo === "comentario") return { longa: false, html: esc(t), chamada: "" };
    if (e.tipo === "direta" && citacaoLonga(t)) {
      const corpo = semPontoFinal(t.replace(/^["“”]+|["“”]+$/g, ""));
      return { longa: true, html: esc(corpo) + (ch ? " " + esc(ch) : "") + ".", chamada: ch };
    }
    if (e.tipo === "direta") {
      // Aspas duplas no texto viram simples (aspas dentro de aspas).
      const corpo = semPontoFinal(linha(t).replace(/^["“”]+|["“”]+$/g, "")).replace(/["“”]/g, (c) => (c === "”" ? "’" : "‘")).replace(/‘(?=[\s,.;:!?)]|$)/g, "’");
      return { longa: false, html: "“" + esc(corpo) + "”" + (ch ? " " + esc(ch) : "") + ".", chamada: ch };
    }
    return { longa: false, html: esc(semPontoFinal(t)) + (ch ? " " + esc(ch) : "") + ".", chamada: ch };
  }

  /* ======================= documento ======================= */

  function dataBr(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(linha(iso));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : linha(iso);
  }

  function referenciaHtml(f) {
    if (f.refModo === "manual") return esc(linha(f.refManual));
    if (!f.ref || !linha(f.ref.titulo)) return "";
    return R.abnt(f.ref);
  }

  function tituloFicha(f) {
    if (linha(f.tema)) return linha(f.tema);
    if (f.refModo === "manual") return linha(f.refManual).slice(0, 80);
    return f.ref ? linha(f.ref.titulo) : "";
  }

  // Gera a ficha como uma lista de blocos neutros; HTML, Markdown e texto saem daqui.
  function blocosFicha(f) {
    const b = [];
    const secao = (id) => SECOES[id].includes(f.modelo);
    const paragrafos = (texto) => bloco(texto).split(/\n\s*\n/).filter(Boolean).forEach((p) => b.push({ k: "p", h: esc(p) }));

    if (linha(f.tema)) b.push({ k: "tema", h: esc(linha(f.tema)) });
    b.push({ k: "titulo", h: esc(MODELOS[f.modelo].nome) });
    const ref = referenciaHtml(f);
    if (ref) b.push({ k: "campo", rotulo: "Referência", h: ref });
    const palavras = linha(f.palavras).split(/\s*[;,]\s*/).filter(Boolean);
    if (palavras.length) b.push({ k: "campo", rotulo: "Palavras-chave", h: esc(palavras.join("; ")) + "." });
    const leitura = [dataBr(f.dataLeitura), linha(f.paginasLidas) && "páginas lidas: " + linha(f.paginasLidas), linha(f.localizacao) && "localização: " + linha(f.localizacao), linha(f.leitor) && "fichado por " + linha(f.leitor)].filter(Boolean);
    if (leitura.length) b.push({ k: "campo", rotulo: "Leitura", h: esc(leitura.join(" · ")) });

    if (secao("sintese")) {
      const cheios = CAMPOS_SINTESE.filter(([k]) => bloco(f[k]));
      if (cheios.length) {
        b.push({ k: "h2", h: "Síntese da obra" });
        for (const [k, rot] of cheios) { b.push({ k: "h3", h: esc(rot) }); paragrafos(f[k]); }
      }
    }

    if (secao("argumento")) {
      const prem = linhas(f.premissas);
      const conc = bloco(f.conclusaoArg);
      if (prem.length || conc || bloco(f.obsArg) || f.tipoArg) {
        b.push({ k: "h2", h: "Estrutura do argumento" });
        if (f.tipoArg) b.push({ k: "campo", rotulo: "Tipo de argumento", h: esc(TIPOS_ARG[f.tipoArg]) });
        if (prem.length) b.push({ k: "premissas", itens: prem.map(esc) });
        if (conc) b.push({ k: "conclusao", h: esc(conc) });
        if (bloco(f.obsArg)) { b.push({ k: "h3", h: "Validade e solidez" }); paragrafos(f.obsArg); }
      }
    }

    if (secao("citacoes")) {
      const base = baseCitacao(f);
      const validas = f.entradas.filter((e) => bloco(e.texto) || bloco(e.nota));
      if (validas.length) {
        b.push({ k: "h2", h: f.modelo === "citacoes" ? "Citações" : "Citações, paráfrases e comentários" });
        validas.forEach((e, i) => {
          const pg = localizador(e.pagina);
          b.push({ k: "h3", h: `${i + 1}. ${esc(TIPOS_ENTRADA[e.tipo].replace(/ \(.*\)$/, ""))}${pg && e.tipo === "comentario" ? " · " + esc(pg) : ""}` });
          const fe = formatarEntrada(e, base);
          if (fe.html) b.push({ k: fe.longa ? "citacao" : "p", h: fe.html });
          if (bloco(e.nota)) b.push({ k: "nota", h: esc(bloco(e.nota)) });
        });
      }
    }

    if (secao("conceitos")) {
      const defs = linhas(f.conceitos).map((l) => {
        const m = /^(.+?)\s*(?::|—|–| - )\s*(.+)$/.exec(l);
        return m ? [esc(m[1]), esc(m[2])] : [esc(l), ""];
      });
      if (defs.length) { b.push({ k: "h2", h: "Conceitos-chave" }); b.push({ k: "defs", itens: defs }); }
    }

    if (secao("critica")) {
      const cheios = CAMPOS_CRITICA.filter(([k]) => bloco(f[k]));
      const leituras = linhas(f.leituras);
      if (cheios.length || leituras.length) {
        b.push({ k: "h2", h: "Análise crítica" });
        for (const [k, rot] of cheios) { b.push({ k: "h3", h: esc(rot) }); paragrafos(f[k]); }
        if (leituras.length) { b.push({ k: "h3", h: "Leituras indicadas a partir da obra" }); b.push({ k: "lista", itens: leituras.map(esc) }); }
      }
    }
    return b;
  }

  const br = (h) => h.replace(/\n/g, "<br>");

  function htmlDeBlocos(blocos) {
    return blocos.map((x) => {
      switch (x.k) {
        case "tema": return `<p class="ficha-tema">${x.h}</p>`;
        case "titulo": return `<h1>${x.h}</h1>`;
        case "campo": return `<p class="ficha-campo"><strong>${esc(x.rotulo)}:</strong> ${x.h}</p>`;
        case "h2": return `<h2>${x.h}</h2>`;
        case "h3": return `<h3>${x.h}</h3>`;
        case "p": return `<p>${br(x.h)}</p>`;
        case "citacao": return `<blockquote class="citacao-longa"><p>${br(x.h)}</p></blockquote>`;
        case "nota": return `<p class="ficha-nota"><em>Comentário:</em> ${br(x.h)}</p>`;
        case "premissas": return `<ol class="premissas">${x.itens.map((h, i) => `<li><strong>P${i + 1}.</strong> ${h}</li>`).join("")}</ol>`;
        case "conclusao": return `<p class="conclusao-arg"><strong>C.</strong> ${br(x.h)}</p>`;
        case "lista": return `<ul>${x.itens.map((h) => `<li>${h}</li>`).join("")}</ul>`;
        case "defs": return `<dl>${x.itens.map(([t, d]) => `<dt>${t}</dt>${d ? `<dd>${d}</dd>` : ""}`).join("")}</dl>`;
        default: return "";
      }
    }).join("\n");
  }

  const md = (h) => des(h.replace(/<\/?(b|strong)>/g, "**").replace(/<\/?(i|em)>/g, "*")).replace(/\n/g, "  \n");

  function mdDeBlocos(blocos) {
    return blocos.map((x) => {
      switch (x.k) {
        case "tema": return `**${md(x.h).toUpperCase()}**`;
        case "titulo": return `# ${md(x.h)}`;
        case "campo": return `**${x.rotulo}:** ${md(x.h)}`;
        case "h2": return `## ${md(x.h)}`;
        case "h3": return `### ${md(x.h)}`;
        case "p": return md(x.h);
        case "citacao": return "> " + md(x.h).replace(/ {2}\n/g, "  \n> ");
        case "nota": return `*Comentário:* ${md(x.h)}`;
        case "premissas": return x.itens.map((h, i) => `- **P${i + 1}.** ${md(h)}`).join("\n");
        case "conclusao": return `- **C.** ${md(x.h)}`;
        case "lista": return x.itens.map((h) => `- ${md(h)}`).join("\n");
        case "defs": return x.itens.map(([t, d]) => `- **${md(t)}**${d ? `: ${md(d)}` : ""}`).join("\n");
        default: return "";
      }
    }).join("\n\n") + "\n";
  }

  function txtDeBlocos(blocos) {
    const t = (h) => des(h);
    return blocos.map((x) => {
      switch (x.k) {
        case "tema": return t(x.h).toUpperCase();
        case "titulo": { const s = t(x.h).toUpperCase(); return s + "\n" + "=".repeat(s.length); }
        case "campo": return `${x.rotulo}: ${t(x.h)}`;
        case "h2": { const s = t(x.h).toUpperCase(); return s + "\n" + "-".repeat(s.length); }
        case "h3": return t(x.h);
        case "p": return t(x.h);
        case "citacao": return t(x.h).split("\n").map((l) => "        " + l).join("\n");
        case "nota": return `Comentário: ${t(x.h)}`;
        case "premissas": return x.itens.map((h, i) => `P${i + 1}. ${t(h)}`).join("\n");
        case "conclusao": return `C.  ${t(x.h)}`;
        case "lista": return x.itens.map((h) => `- ${t(h)}`).join("\n");
        case "defs": return x.itens.map(([a, d]) => `${t(a)}${d ? " — " + t(d) : ""}`).join("\n");
        default: return "";
      }
    }).join("\n\n") + "\n";
  }

  const ESTILO_DOC = `@page { size: A4; margin: 3cm 2cm 2cm 3cm; }
body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.5; color: #000; }
h1 { font-size: 12pt; text-transform: uppercase; text-align: center; margin: 0 0 12pt; }
h2 { font-size: 12pt; text-transform: uppercase; margin: 18pt 0 6pt; }
h3 { font-size: 12pt; margin: 12pt 0 4pt; }
p { margin: 0 0 6pt; text-align: justify; }
.ficha-tema { text-align: right; font-weight: bold; text-transform: uppercase; }
.ficha-campo { text-align: left; }
blockquote.citacao-longa { margin: 6pt 0 6pt 4cm; }
blockquote.citacao-longa p { font-size: 10pt; line-height: 1; }
.ficha-nota { margin-left: 1.25cm; }
ol.premissas { list-style: none; padding-left: 0; }
dt { font-weight: bold; } dd { margin: 0 0 6pt 1.25cm; }`;

  // Word abre HTML com extensão .doc; os estilos seguem o padrão ABNT de trabalhos acadêmicos.
  function documentoWord(f) {
    const corpo = htmlDeBlocos(blocosFicha(f));
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(tituloFicha(f) || "Fichamento")}</title><style>${ESTILO_DOC}</style></head>
<body>
${corpo}
</body></html>`;
  }

  function fichaVazia(f) {
    return !f.ref && !f.entradas.length && blocosFicha(f).length <= 1;
  }

  function nomeArquivo(f, ext) {
    const base = (tituloFicha(f) || "sem-titulo").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "sem-titulo";
    return `fichamento-${base}.${ext}`;
  }

  const api = {
    MODELOS, SECOES, TIPOS_ARG, TIPOS_ENTRADA, LIMITE_LONGA,
    novaFicha, normalizarFicha, lerBackup, sobrenomeCitacao, tituloCitacao, baseCitacao, localizador, chamada,
    citacaoLonga, formatarEntrada, blocosFicha, htmlDeBlocos, mdDeBlocos, txtDeBlocos, documentoWord, nomeArquivo, tituloFicha, dataBr, fichaVazia,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  /* ======================= interface ======================= */

  if (typeof document === "undefined") return;

  document.addEventListener("DOMContentLoaded", () => {
    const $ = (id) => document.getElementById(id);
    const form = $("fi-form");
    if (!form) return;
    const CHAVE = "kp_fichas";
    const CHAVE_ATUAL = "kp_ficha_atual";
    const campos = Array.from(form.querySelectorAll("[data-campo]"));

    const ler = (k, padrao) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? padrao : v; } catch (e) { return padrao; } };
    let fichas = lerBackup(ler(CHAVE, []));
    let refs = ler("kp_refs", []);
    if (!Array.isArray(refs)) refs = [];
    let atual = fichas.find((f) => f.id === ler(CHAVE_ATUAL, "")) || fichas[fichas.length - 1];
    if (!atual) { atual = novaFicha(); fichas.push(atual); }

    let timer = null;
    function salvar(imediato) {
      clearTimeout(timer);
      const gravar = () => {
        try {
          localStorage.setItem(CHAVE, JSON.stringify(fichas));
          localStorage.setItem(CHAVE_ATUAL, JSON.stringify(atual.id));
          $("fi-salvo").textContent = "Salvo neste navegador às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + ".";
        } catch (e) {
          $("fi-salvo").textContent = "Não foi possível salvar neste navegador (armazenamento cheio ou bloqueado). Baixe um backup.";
        }
      };
      if (imediato) gravar(); else timer = setTimeout(gravar, 400);
    }

    function aviso(msg, tipo) {
      const el = $("fi-estado");
      el.textContent = msg;
      el.className = "mensagem" + (tipo ? " " + tipo : "");
      el.hidden = !msg;
      if (msg) setTimeout(() => { if (el.textContent === msg) el.hidden = true; }, 5000);
    }

    /* ----- formulário <-> ficha ----- */

    function escreverForm() {
      campos.forEach((el) => { el.value = atual[el.dataset.campo] || ""; });
      desenharRefs();
      desenharEntradas();
      aplicarModelo();
    }

    function lerForm() {
      campos.forEach((el) => { atual[el.dataset.campo] = el.value; });
      atual.atualizado = new Date().toISOString();
    }

    function aplicarModelo() {
      const m = atual.modelo;
      $("fi-modelo-desc").textContent = MODELOS[m].desc;
      form.querySelectorAll("[data-secao]").forEach((s) => { s.hidden = !SECOES[s.dataset.secao].includes(m); });
    }

    /* ----- referência ----- */

    function rotuloRef(r) {
      try { return des(R.abnt(r)); } catch (e) { return linha(r.titulo) || "(sem título)"; }
    }

    function desenharRefs() {
      const sel = $("fi-ref-sel");
      sel.innerHTML = "";
      const opc = (v, t) => { const o = document.createElement("option"); o.value = v; o.textContent = t.length > 140 ? t.slice(0, 137) + "…" : t; sel.appendChild(o); };
      opc("", refs.length ? "— Escolha uma obra da sua lista de referências —" : "— Sua lista de referências está vazia —");
      if (atual.ref) opc("salva", "Neste fichamento: " + rotuloRef(atual.ref));
      refs.forEach((r, i) => opc("l:" + i, rotuloRef(r)));
      opc("manual", "Digitar a referência manualmente");
      sel.value = atual.refModo === "manual" ? "manual" : atual.ref ? "salva" : "";
      $("fi-ref-manual").hidden = atual.refModo !== "manual";
      const h = referenciaHtml(atual);
      $("fi-ref-previa").innerHTML = h ? "<strong>Referência (ABNT):</strong> " + h : "";
      $("fi-ref-previa").hidden = !h;
    }

    $("fi-ref-sel").addEventListener("change", (ev) => {
      const v = ev.target.value;
      if (v === "manual") atual.refModo = "manual";
      else if (v.startsWith("l:")) { atual.refModo = "lista"; atual.ref = { ...refs[+v.slice(2)] }; }
      else if (v === "") { atual.refModo = "lista"; atual.ref = null; }
      else atual.refModo = "lista";
      atual.atualizado = new Date().toISOString();
      desenharRefs();
      atualizar();
    });

    /* ----- entradas (citações, paráfrases, comentários) ----- */

    const caixaEntradas = $("fi-entradas");

    function desenharEntradas() {
      caixaEntradas.innerHTML = "";
      $("fi-sem-entradas").hidden = atual.entradas.length > 0;
      atual.entradas.forEach((e, i) => {
        const d = document.createElement("div");
        d.className = "entrada";
        d.dataset.i = i;
        d.innerHTML = `<div class="entrada-topo">
            <span class="entrada-num">${i + 1}</span>
            <select class="e-tipo" aria-label="Tipo do trecho ${i + 1}">${Object.entries(TIPOS_ENTRADA).map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("")}</select>
            <input class="e-pagina" type="text" placeholder="Página (ex.: 15 ou 15-16)" aria-label="Página do trecho ${i + 1}">
            <span class="entrada-botoes">
              <button type="button" class="botao botao-secundario botao-pequeno" data-acao="subir" aria-label="Mover o trecho ${i + 1} para cima" ${i === 0 ? "disabled" : ""}>↑</button>
              <button type="button" class="botao botao-secundario botao-pequeno" data-acao="descer" aria-label="Mover o trecho ${i + 1} para baixo" ${i === atual.entradas.length - 1 ? "disabled" : ""}>↓</button>
              <button type="button" class="botao botao-secundario botao-pequeno" data-acao="remover" aria-label="Remover o trecho ${i + 1}">Remover</button>
            </span>
          </div>
          <label for="e-texto-${i}">Texto</label>
          <textarea id="e-texto-${i}" class="e-texto curta" rows="4"></textarea>
          <label for="e-nota-${i}">Seu comentário sobre o trecho (opcional)</label>
          <textarea id="e-nota-${i}" class="e-nota curta" rows="2"></textarea>
          <p class="e-info"></p>`;
        d.querySelector(".e-tipo").value = e.tipo;
        d.querySelector(".e-pagina").value = e.pagina;
        d.querySelector(".e-texto").value = e.texto;
        d.querySelector(".e-nota").value = e.nota;
        caixaEntradas.appendChild(d);
      });
      infoEntradas();
    }

    function infoEntradas() {
      const base = baseCitacao(atual);
      caixaEntradas.querySelectorAll(".entrada").forEach((d) => {
        const e = atual.entradas[+d.dataset.i];
        const info = d.querySelector(".e-info");
        if (e.tipo === "comentario") { info.textContent = "Comentário seu: entra no fichamento sem chamada de citação."; return; }
        const ch = chamada(base, e.pagina);
        const partes = [];
        partes.push(ch ? "Chamada: " + ch : "Escolha a referência (ou informe autor e ano) para gerar a chamada.");
        if (e.tipo === "direta") {
          if (!linha(e.pagina)) partes.push("Na citação direta, a página é obrigatória.");
          if (bloco(e.texto)) partes.push(citacaoLonga(e.texto) ? "Citação longa (mais de 3 linhas): recuo de 4 cm, fonte menor e sem aspas." : "Citação curta: entre aspas, no corpo do texto.");
        }
        info.textContent = partes.join(" ");
      });
    }

    caixaEntradas.addEventListener("input", (ev) => {
      const d = ev.target.closest(".entrada");
      if (!d) return;
      const e = atual.entradas[+d.dataset.i];
      const cls = ev.target.classList;
      if (cls.contains("e-tipo")) e.tipo = ev.target.value;
      else if (cls.contains("e-pagina")) e.pagina = ev.target.value;
      else if (cls.contains("e-texto")) e.texto = ev.target.value;
      else if (cls.contains("e-nota")) e.nota = ev.target.value;
      atual.atualizado = new Date().toISOString();
      infoEntradas();
      atualizar();
    });
    caixaEntradas.addEventListener("change", (ev) => {
      if (ev.target.classList.contains("e-tipo")) caixaEntradas.dispatchEvent(new Event("input", { bubbles: true }));
    });
    caixaEntradas.addEventListener("click", (ev) => {
      const bt = ev.target.closest("[data-acao]");
      if (!bt) return;
      const i = +bt.closest(".entrada").dataset.i;
      const l = atual.entradas;
      if (bt.dataset.acao === "subir" && i > 0) [l[i - 1], l[i]] = [l[i], l[i - 1]];
      else if (bt.dataset.acao === "descer" && i < l.length - 1) [l[i + 1], l[i]] = [l[i], l[i + 1]];
      else if (bt.dataset.acao === "remover") {
        if (bt.dataset.confirmar !== "1" && (bloco(l[i].texto) || bloco(l[i].nota))) {
          bt.dataset.confirmar = "1"; bt.textContent = "Confirmar remoção";
          setTimeout(() => { bt.dataset.confirmar = ""; bt.textContent = "Remover"; }, 3000);
          return;
        }
        l.splice(i, 1);
      }
      desenharEntradas();
      atualizar();
    });

    document.querySelectorAll("[data-nova-entrada]").forEach((b) => b.addEventListener("click", () => {
      atual.entradas.push({ tipo: b.dataset.novaEntrada, pagina: "", texto: "", nota: "" });
      desenharEntradas();
      atualizar();
      const ult = caixaEntradas.lastElementChild;
      if (ult) ult.querySelector(".e-texto").focus();
    }));

    /* ----- prévia e lista de fichamentos ----- */

    function atualizar() {
      $("fi-previa").innerHTML = htmlDeBlocos(blocosFicha(atual));
      desenharLista();
      salvar();
    }

    function desenharLista() {
      const ul = $("fi-lista");
      ul.innerHTML = "";
      const ordenadas = [...fichas].sort((a, b) => String(b.atualizado).localeCompare(String(a.atualizado)));
      for (const f of ordenadas) {
        const li = document.createElement("li");
        if (f.id === atual.id) li.className = "atual";
        const quando = new Date(f.atualizado);
        const t = tituloFicha(f) || "Fichamento sem título";
        li.innerHTML = `<span class="fl-titulo">${esc(t)}</span>
          <span class="fl-meta">${esc(MODELOS[f.modelo].nome)} · ${isNaN(quando) ? "" : esc(quando.toLocaleDateString("pt-BR"))}${f.id === atual.id ? " · <strong>aberto</strong>" : ""}</span>
          <span class="fl-botoes">
            ${f.id === atual.id ? "" : `<button type="button" class="botao botao-secundario botao-pequeno" data-abrir="${esc(f.id)}">Abrir</button>`}
            <button type="button" class="botao botao-secundario botao-pequeno" data-duplicar="${esc(f.id)}">Duplicar</button>
            <button type="button" class="botao botao-secundario botao-pequeno" data-excluir="${esc(f.id)}">Excluir</button>
          </span>`;
        ul.appendChild(li);
      }
      $("fi-contagem").textContent = fichas.length === 1 ? "1 fichamento" : `${fichas.length} fichamentos`;
    }

    $("fi-lista").addEventListener("click", (ev) => {
      const b = ev.target.closest("button");
      if (!b) return;
      if (b.dataset.abrir) {
        const anterior = atual;
        atual = fichas.find((f) => f.id === b.dataset.abrir) || atual;
        if (anterior !== atual && fichaVazia(anterior)) fichas = fichas.filter((f) => f !== anterior);
        escreverForm(); atualizar(); salvar(true);
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (b.dataset.duplicar) {
        const orig = fichas.find((f) => f.id === b.dataset.duplicar);
        const copia = normalizarFicha(JSON.parse(JSON.stringify(orig)));
        copia.id = novoId(); copia.criado = copia.atualizado = new Date().toISOString();
        copia.tema = linha(orig.tema) ? orig.tema + " (cópia)" : "";
        fichas.push(copia); atual = copia;
        escreverForm(); atualizar(); salvar(true);
        aviso("Fichamento duplicado. Você está editando a cópia.", "ok");
      } else if (b.dataset.excluir) {
        if (b.dataset.confirmar !== "1") {
          b.dataset.confirmar = "1"; b.textContent = "Confirmar exclusão";
          setTimeout(() => { b.dataset.confirmar = ""; b.textContent = "Excluir"; }, 3000);
          return;
        }
        fichas = fichas.filter((f) => f.id !== b.dataset.excluir);
        if (!fichas.length) fichas.push(novaFicha());
        if (!fichas.includes(atual)) atual = fichas[fichas.length - 1];
        escreverForm(); atualizar(); salvar(true);
        aviso("Fichamento excluído.", "ok");
      }
    });

    $("fi-novo").addEventListener("click", () => {
      atual = novaFicha(atual.modelo);
      fichas.push(atual);
      escreverForm(); atualizar(); salvar(true);
      $("fi-tema").focus();
      aviso("Novo fichamento criado.", "ok");
    });

    form.addEventListener("input", (ev) => {
      if (!ev.target.dataset.campo) return;
      lerForm();
      if (ev.target.dataset.campo === "modelo") aplicarModelo();
      if (["refManual", "autorCitacao", "anoCitacao"].includes(ev.target.dataset.campo)) { desenharRefs(); infoEntradas(); }
      atualizar();
    });
    form.addEventListener("change", (ev) => {
      if (ev.target.tagName === "SELECT" && ev.target.dataset.campo) form.dispatchEvent(new Event("input", { bubbles: true }));
    });
    form.addEventListener("submit", (ev) => ev.preventDefault());

    /* ----- exportações ----- */

    function baixar(nome, conteudo, tipo) {
      const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
      const a = document.createElement("a");
      a.href = url; a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    function vazia() {
      const b = blocosFicha(atual);
      if (b.length <= 1) { aviso("O fichamento está vazio. Preencha ao menos um campo.", "alerta"); return true; }
      return false;
    }

    $("fi-copiar").addEventListener("click", async () => {
      if (vazia()) return;
      const b = blocosFicha(atual);
      const html = htmlDeBlocos(b), texto = txtDeBlocos(b);
      let ok = false;
      try {
        if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
          await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([texto], { type: "text/plain" }) })]);
          ok = true;
        } else if (navigator.clipboard) { await navigator.clipboard.writeText(texto); ok = true; }
      } catch (e) { ok = false; }
      aviso(ok ? "Fichamento copiado. Cole no Word ou no Google Docs (a formatação é mantida)." : "Não foi possível copiar. Use o download em Word ou em texto.", ok ? "ok" : "erro");
    });
    $("fi-word").addEventListener("click", () => { if (!vazia()) baixar(nomeArquivo(atual, "doc"), "﻿" + documentoWord(atual), "application/msword"); });
    $("fi-md").addEventListener("click", () => { if (!vazia()) baixar(nomeArquivo(atual, "md"), mdDeBlocos(blocosFicha(atual)), "text/markdown;charset=utf-8"); });
    $("fi-txt").addEventListener("click", () => { if (!vazia()) baixar(nomeArquivo(atual, "txt"), "﻿" + txtDeBlocos(blocosFicha(atual)), "text/plain;charset=utf-8"); });
    $("fi-imprimir").addEventListener("click", () => {
      if (vazia()) return;
      const fr = document.createElement("iframe");
      fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
      fr.setAttribute("aria-hidden", "true");
      document.body.appendChild(fr);
      const d = fr.contentDocument;
      d.open(); d.write(documentoWord(atual)); d.close();
      setTimeout(() => { fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(() => fr.remove(), 1000); }, 250);
    });
    $("fi-backup").addEventListener("click", () => {
      const dados = { app: "Kit Pesquisador — fichamentos", versao: 1, exportado: new Date().toISOString(), fichamentos: fichas };
      baixar("fichamentos-kit-pesquisador.json", JSON.stringify(dados, null, 2), "application/json");
    });
    $("fi-importar").addEventListener("change", async (ev) => {
      const arq = ev.target.files && ev.target.files[0];
      ev.target.value = "";
      if (!arq) return;
      try {
        const novas = lerBackup(JSON.parse(await arq.text()));
        if (!novas.length) throw new Error("vazio");
        let n = 0;
        for (const f of novas) {
          const i = fichas.findIndex((x) => x.id === f.id);
          if (i >= 0) { if (String(f.atualizado) > String(fichas[i].atualizado)) { fichas[i] = f; n++; } }
          else { fichas.push(f); n++; }
        }
        // O fichamento em branco aberto antes da importação é descartado.
        if (fichaVazia(atual) && fichas.length > 1) fichas = fichas.filter((f) => f !== atual);
        atual = fichas.find((f) => f.id === atual.id) || fichas[fichas.length - 1];
        escreverForm(); atualizar(); salvar(true);
        aviso(n ? `${n} fichamento(s) importado(s).` : "Nada novo: os fichamentos do arquivo já estavam aqui.", "ok");
      } catch (e) {
        aviso("Arquivo inválido. Use um backup .json baixado nesta página.", "erro");
      }
    });

    // Lista de referências alterada em outra aba.
    window.addEventListener("storage", (ev) => {
      if (ev.key === "kp_refs") { refs = ler("kp_refs", []); if (!Array.isArray(refs)) refs = []; desenharRefs(); }
    });

    escreverForm();
    atualizar();
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
