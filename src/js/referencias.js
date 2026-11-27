/* Gerador de referências: ABNT NBR 6023:2025, APA 7, MLA 9 e Chicago 17 (bibliografia),
   com exportação em BibTeX, EndNote (.enw), Reference Manager (.ris) e RefWorks (formato etiquetado).
   A lógica é pura (testável em Node); a interface fica no final do arquivo. */

const MESES_ABNT = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const MESES_EXT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e", "di", "du", "van", "von", "del", "la", "le"]);
const SUFIXOS = new Set(["filho", "filha", "neto", "neta", "junior", "júnior", "jr.", "jr", "sobrinho", "segundo", "terceiro"]);
const ARTIGOS = new Set(["o", "a", "os", "as", "um", "uma", "uns", "umas", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "por", "para", "com", "e", "ao", "à"]);

const TIPOS = ["livro", "artigo", "capitulo", "site", "tese"];

/* ---------- utilidades de texto ---------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const txt = (h) => String(h).replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const it = (s) => (s ? `<i>${esc(s)}</i>` : "");
const neg = (s) => (s ? `<b>${esc(s)}</b>` : "");
const limpo = (s) => (s === undefined || s === null ? "" : String(s).replace(/\s+/g, " ").trim());
const unir = (partes, sep) => partes.filter((p) => p && txt(p).trim() !== "").join(sep);
const pontuar = (h) => {
  const t = txt(h).trim();
  if (!t) return "";
  return /[.?!]$/.test(t) ? h : h + ".";
};
const maiuscula1 = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Título digitado todo em maiúsculas vira "Frase normal".
function ajustarTitulo(s) {
  const t = limpo(s);
  const letras = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letras.length > 3 && t === t.toUpperCase()) return maiuscula1(t.toLowerCase());
  return t;
}

function normalizarDoi(d) {
  return limpo(d).replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/i, "");
}

function paginas(p, sep) {
  const t = limpo(p);
  if (!t) return { texto: "", rotulo: "" };
  const partes = t.split(/\s*[-–—]+\s*/).filter(Boolean);
  if (partes.length >= 2) return { texto: partes[0] + sep + partes[partes.length - 1], rotulo: "p." };
  return { texto: partes[0], rotulo: "p." };
}

function dataIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(limpo(iso));
  if (!m) return null;
  return { ano: +m[1], mes: +m[2], dia: +m[3] };
}

function edicaoNum(e) {
  const m = /^(\d+)\s*(ª|º|a|\.)?\s*(ed\.?|edição)?$/i.exec(limpo(e));
  return m ? +m[1] : null;
}

/* ---------- nomes ---------- */
function lerAutores(texto, inst) {
  return String(texto || "")
    .split(/\r?\n/)
    .map(limpo)
    .filter(Boolean)
    .map((l) => parseNome(l, inst));
}

function parseNome(linha, inst) {
  const l = limpo(linha);
  if (inst) return { inst: l };
  const i = l.indexOf(",");
  if (i > 0) return { familia: l.slice(0, i).trim(), dado: l.slice(i + 1).trim() };
  const t = l.split(" ");
  if (t.length === 1) return { familia: t[0], dado: "" };
  const n = SUFIXOS.has(t[t.length - 1].toLowerCase()) && t.length > 2 ? 2 : 1;
  return { familia: t.slice(-n).join(" "), dado: t.slice(0, -n).join(" ") };
}

function iniciais(dado) {
  return limpo(dado)
    .split(" ")
    .filter((tk) => tk && !(PARTICULAS.has(tk) && tk === tk.toLowerCase()))
    .map((tk) => tk.split("-").filter(Boolean).map((p) => p.charAt(0).toUpperCase() + ".").join("-"))
    .join(" ");
}

// "SILVA, Maria da" / "BRASIL. Ministério da Saúde"
function nomeAbnt(a) {
  if (a.inst) {
    const i = a.inst.indexOf(". ");
    return i > 0 ? a.inst.slice(0, i).toUpperCase() + a.inst.slice(i) : a.inst.toUpperCase();
  }
  return a.dado ? `${a.familia.toUpperCase()}, ${a.dado}` : a.familia.toUpperCase();
}
const nomeInvertido = (a) => (a.inst ? a.inst : a.dado ? `${a.familia}, ${a.dado}` : a.familia);
const nomeDireto = (a) => (a.inst ? a.inst : a.dado ? `${a.dado} ${a.familia}` : a.familia);
const nomeApa = (a) => (a.inst ? a.inst : a.dado ? `${a.familia}, ${iniciais(a.dado)}` : a.familia);
const nomeApaDireto = (a) => (a.inst ? a.inst : a.dado ? `${iniciais(a.dado)} ${a.familia}` : a.familia);

function listaAbnt(l, org) {
  if (!l.length) return "";
  let s = l.length > 3 ? nomeAbnt(l[0]) + " et al." : l.map(nomeAbnt).join("; ");
  if (org) s += l.length > 1 ? " (orgs.)" : " (org.)";
  return s;
}

function listaApa(l, org) {
  if (!l.length) return "";
  const n = l.map(nomeApa);
  let s;
  if (n.length === 1) s = n[0];
  else if (n.length <= 20) s = n.slice(0, -1).join(", ") + ", & " + n[n.length - 1];
  else s = n.slice(0, 19).join(", ") + ", . . . " + n[n.length - 1];
  if (org) s += l.length > 1 ? " (Orgs.)" : " (Org.)";
  return s;
}

function listaMla(l, org) {
  if (!l.length) return "";
  let s;
  if (l.length === 1) s = nomeInvertido(l[0]);
  else if (l.length === 2) s = `${nomeInvertido(l[0])}, e ${nomeDireto(l[1])}`;
  else s = `${nomeInvertido(l[0])}, et al.`;
  if (org) s += l.length > 1 ? ", orgs." : ", org.";
  return s;
}

function listaChicago(l, org) {
  if (!l.length) return "";
  let nomes = l.map((a, i) => (i === 0 ? nomeInvertido(a) : nomeDireto(a)));
  let s;
  if (l.length > 10) s = nomes.slice(0, 7).join(", ") + ", et al.";
  else if (nomes.length === 1) s = nomes[0];
  else if (nomes.length === 2) s = `${nomes[0]} e ${nomes[1]}`;
  else s = nomes.slice(0, -1).join(", ") + ", e " + nomes[nomes.length - 1];
  if (org) s += l.length > 1 ? ", orgs." : ", org.";
  return s;
}

// Organizadores do livro, em ordem direta ("Maria Silva e João Souza").
function listaDireta(l, conj) {
  const n = l.map(nomeDireto);
  if (n.length <= 1) return n.join("");
  return n.slice(0, -1).join(", ") + ` ${conj} ` + n[n.length - 1];
}

/* ---------- preparação dos dados ---------- */
function tipoTrabalho(ref) {
  const [tipo, grau] = String(ref.tese || "Tese|Doutorado").split("|");
  return { tipo, grau };
}

// Campos que valem para cada tipo; o resto (esquecido no formulário) é ignorado.
const CAMPOS = {
  livro: "autores inst org titulo subtitulo edicao local editora ano doi url acesso",
  artigo: "autores inst titulo subtitulo periodico volume numero paginas local ano mes doi url acesso",
  capitulo: "autores inst titulo obra organizadores paginas edicao local editora ano doi url acesso",
  site: "autores inst titulo subtitulo site local ano mes dia doi url acesso",
  tese: "autores inst titulo subtitulo tese curso instituicao local ano doi url acesso"
};

const TODOS = [...new Set(Object.values(CAMPOS).join(" ").split(" "))];

function preparar(ref) {
  const validos = new Set((CAMPOS[ref.tipo] || CAMPOS.livro).split(" "));
  const r = { tipo: ref.tipo };
  for (const k of TODOS) r[k] = validos.has(k) && ref[k] !== undefined ? ref[k] : (k === "inst" || k === "org" ? false : "");
  ref = r;
  for (const k of Object.keys(r)) if (typeof r[k] === "string" && k !== "autores" && k !== "organizadores") r[k] = limpo(r[k]);
  r.titulo = ajustarTitulo(r.titulo);
  r.subtitulo = ajustarTitulo(r.subtitulo);
  r.doi = normalizarDoi(r.doi);
  r.autores = lerAutores(ref.autores, !!ref.inst);
  r.orgs = lerAutores(ref.organizadores, false);
  r.mesN = +r.mes || 0;
  r.diaN = +r.dia || 0;
  r.acessoD = dataIso(r.acesso);
  return r;
}

// Primeira palavra em caixa alta (entrada pelo título, quando não há autor).
function entradaPorTitulo(titulo) {
  const p = titulo.split(" ");
  let n = 1;
  if (p.length > 1 && (ARTIGOS.has(p[0].toLowerCase()) || p[0].length === 1)) n = 2;
  return p.slice(0, n).join(" ").toUpperCase() + (p.length > n ? " " + p.slice(n).join(" ") : "");
}

function urlEfetiva(r) {
  return r.url || (r.doi ? "https://doi.org/" + r.doi : "");
}

/* ---------- ABNT NBR 6023:2025 ---------- */
function dataAbnt(r, completa) {
  const ano = r.ano || "[s. d.]";
  if (!r.ano) return ano;
  const partes = [];
  if (completa && r.diaN && r.mesN) partes.push(String(r.diaN));
  if (r.mesN) partes.push(MESES_ABNT[r.mesN - 1]);
  partes.push(r.ano);
  return partes.join(" ");
}

function abntOnline(r) {
  const url = urlEfetiva(r);
  const out = [];
  if (url) out.push(`Disponível em: ${esc(url)}.`);
  if (r.url && r.doi && !r.url.includes(r.doi)) out.push(`DOI: ${esc(r.doi)}.`);
  if (url && r.acessoD) out.push(`Acesso em: ${r.acessoD.dia} ${MESES_ABNT[r.acessoD.mes - 1]} ${r.acessoD.ano}.`);
  return out.join(" ");
}

function edAbnt(e) {
  const n = edicaoNum(e);
  return n ? `${n}. ed.` : e ? pontuar(esc(e)) : "";
}

function abnt(ref) {
  const r = preparar(ref);
  const ent = listaAbnt(r.autores, r.org && r.tipo === "livro");
  const semAutor = !ent;
  const sub = r.subtitulo ? ": " + esc(r.subtitulo) : "";
  const cabeca = (tituloRender) => (ent ? pontuar(esc(ent)) + " " : "") + tituloRender;
  const tituloEntrada = (t) => (semAutor ? entradaPorTitulo(t) : t);
  const local = r.local || "[S. l.]";
  const editora = r.editora || "[s. n.]";
  let h = "";

  if (r.tipo === "livro") {
    const t = pontuar(`<b>${esc(tituloEntrada(r.titulo))}</b>${sub}`);
    h = unir([cabeca(t), edAbnt(r.edicao), `${esc(local)}: ${esc(editora)}, ${esc(r.ano || "[s. d.]")}.`, abntOnline(r)], " ");
  } else if (r.tipo === "capitulo") {
    const t = pontuar(esc(tituloEntrada(r.titulo)));
    const orgs = r.orgs.length ? listaAbnt(r.orgs, true) : listaAbnt(r.autores, false);
    const obra = pontuar(`<b>${esc(r.obra)}</b>`);
    const pg = paginas(r.paginas, "-");
    h = unir([cabeca(t), `In: ${pontuar(esc(orgs))}`, obra, edAbnt(r.edicao), `${esc(local)}: ${esc(editora)}, ${esc(r.ano || "[s. d.]")}.`, pg.texto ? `${pg.rotulo} ${esc(pg.texto)}.` : "", abntOnline(r)], " ");
  } else if (r.tipo === "artigo") {
    const t = pontuar(esc(tituloEntrada(r.titulo) + (r.subtitulo ? ": " + r.subtitulo : "")));
    const pg = paginas(r.paginas, "-");
    const miolo = unir([
      neg(r.periodico), esc(r.local),
      r.volume ? `v. ${esc(r.volume)}` : "", r.numero ? `n. ${esc(r.numero)}` : "",
      pg.texto ? `${pg.rotulo} ${esc(pg.texto)}` : "",
      esc(r.mesN ? `${MESES_ABNT[r.mesN - 1]} ${r.ano || "[s. d.]"}` : r.ano || "[s. d.]")
    ], ", ");
    h = unir([cabeca(t), pontuar(miolo), abntOnline(r)], " ");
  } else if (r.tipo === "site") {
    const t = pontuar(esc(tituloEntrada(r.titulo) + (r.subtitulo ? ": " + r.subtitulo : "")));
    const miolo = unir([neg(r.site), esc(r.local), esc(dataAbnt(r, true))], ", ");
    h = unir([cabeca(t), pontuar(miolo), abntOnline(r)], " ");
  } else if (r.tipo === "tese") {
    const { tipo, grau } = tipoTrabalho(r);
    const t = pontuar(`<b>${esc(tituloEntrada(r.titulo))}</b>${sub}`);
    const grauTxt = `${tipo} (${grau}${r.curso ? " em " + r.curso : ""})`;
    const fim = unir([esc(grauTxt) + (r.instituicao ? " – " + esc(r.instituicao) : ""), esc(r.local), esc(r.ano || "[s. d.]")], ", ");
    h = unir([cabeca(t), esc(r.ano || "[s. d.]") + ".", pontuar(fim), abntOnline(r)], " ");
  }
  return h;
}

/* ---------- APA 7 ---------- */
function apaData(r, completa) {
  if (!r.ano) return "s.d.";
  if (completa && r.mesN) return `${r.ano}, ${r.diaN ? r.diaN + " de " : ""}${MESES_EXT[r.mesN - 1]}`;
  return r.ano;
}
function edApa(e) {
  const n = edicaoNum(e);
  return n ? `${n}ª ed.` : limpo(e);
}

function apa(ref) {
  const r = preparar(ref);
  const aut = listaApa(r.autores, r.org && r.tipo === "livro");
  const titulo = r.titulo + (r.subtitulo ? ": " + r.subtitulo : "");
  const link = r.doi ? "https://doi.org/" + r.doi : r.url;
  const lk = link ? esc(link) : "";
  const quando = (completa) => `(${esc(apaData(r, completa))}).`;
  const pg = paginas(r.paginas, "–");
  let h = "";

  if (r.tipo === "livro") {
    const ed = r.edicao ? ` (${esc(edApa(r.edicao))})` : "";
    h = aut
      ? unir([pontuar(esc(aut)), quando(false), `<i>${esc(titulo)}</i>${ed}.`, pontuar(esc(r.editora)), lk], " ")
      : unir([`<i>${esc(titulo)}</i>${ed}.`, quando(false), pontuar(esc(r.editora)), lk], " ");
  } else if (r.tipo === "capitulo") {
    const orgs = r.orgs.length ? r.orgs : r.autores;
    const ed = unir([r.edicao ? esc(edApa(r.edicao)) : "", pg.texto ? `pp. ${esc(pg.texto)}` : ""], ", ");
    const lista = orgs.map(nomeApaDireto);
    const orgTxt = lista.length > 1 ? lista.slice(0, -1).join(", ") + " & " + lista[lista.length - 1] : lista.join("");
    const rot = r.orgs.length ? (r.orgs.length > 1 ? " (Orgs.)" : " (Org.)") : "";
    const em = r.obra ? `In ${esc(orgTxt)}${rot}, <i>${esc(r.obra)}</i>${ed ? ` (${ed})` : ""}.` : "";
    h = unir([aut ? pontuar(esc(aut)) : "", quando(false), pontuar(esc(r.titulo + (r.subtitulo ? ": " + r.subtitulo : ""))), em, pontuar(esc(r.editora)), lk], " ");
  } else if (r.tipo === "artigo") {
    const vol = r.volume ? `, <i>${esc(r.volume)}</i>` + (r.numero ? `(${esc(r.numero)})` : "") : r.numero ? `, (${esc(r.numero)})` : "";
    const miolo = `<i>${esc(r.periodico)}</i>${vol}${pg.texto ? ", " + esc(pg.texto) : ""}.`;
    h = unir([aut ? pontuar(esc(aut)) : "", quando(false), pontuar(esc(titulo)), r.periodico ? miolo : "", lk], " ");
  } else if (r.tipo === "site") {
    const igual = aut && r.site && txt(aut).toLowerCase() === r.site.toLowerCase();
    h = aut
      ? unir([pontuar(esc(aut)), quando(true), pontuar(`<i>${esc(titulo)}</i>`), igual ? "" : pontuar(esc(r.site)), lk], " ")
      : unir([pontuar(`<i>${esc(titulo)}</i>`), quando(true), pontuar(esc(r.site)), lk], " ");
  } else if (r.tipo === "tese") {
    const { tipo, grau } = tipoTrabalho(r);
    const colch = `[${esc(tipo)} de ${esc(grau.toLowerCase())}${r.instituicao ? ", " + esc(r.instituicao) : ""}]`;
    h = unir([aut ? pontuar(esc(aut)) : "", quando(false), `<i>${esc(titulo)}</i> ${colch}.`, lk], " ");
  }
  return h;
}

/* ---------- MLA 9 ---------- */
function mlaData(r, completa) {
  if (!r.ano) return "";
  if (completa && r.mesN) return unir([r.diaN ? String(r.diaN) : "", MESES_ABNT[r.mesN - 1], r.ano], " ");
  return r.ano;
}
const aspas = (t) => (/[.?!,]$/.test(t) ? `“${esc(t)}”` : `“${esc(t)}.”`);

function mla(ref) {
  const r = preparar(ref);
  const aut = listaMla(r.autores, r.org && r.tipo === "livro");
  const titulo = r.titulo + (r.subtitulo ? ": " + r.subtitulo : "");
  const link = urlEfetiva(r);
  const lk = link ? pontuar(esc(link)) : "";
  const pg = paginas(r.paginas, "-");
  const ed = r.edicao ? (edicaoNum(r.edicao) ? `${edicaoNum(r.edicao)}ª ed.` : limpo(r.edicao)) : "";
  const acesso = link && r.acessoD ? `Acesso em ${r.acessoD.dia} ${MESES_ABNT[r.acessoD.mes - 1]} ${r.acessoD.ano}.` : "";
  const a = aut ? pontuar(esc(aut)) : "";
  let h = "";

  if (r.tipo === "livro") {
    h = unir([a, pontuar(`<i>${esc(titulo)}</i>`), pontuar(unir([esc(ed), esc(r.editora), esc(r.ano)], ", ")), lk], " ");
  } else if (r.tipo === "capitulo") {
    const org = r.orgs.length ? `organizado por ${esc(listaDireta(r.orgs, "e"))}` : "";
    h = unir([a, aspas(titulo), pontuar(unir([`<i>${esc(r.obra)}</i>`, org, esc(r.editora), esc(r.ano), pg.texto ? `p. ${esc(pg.texto)}` : ""], ", ")), lk], " ");
  } else if (r.tipo === "artigo") {
    const miolo = unir([`<i>${esc(r.periodico)}</i>`, r.volume ? `v. ${esc(r.volume)}` : "", r.numero ? `n. ${esc(r.numero)}` : "", esc(r.ano), pg.texto ? `p. ${esc(pg.texto)}` : ""], ", ");
    h = unir([a, aspas(titulo), pontuar(miolo), lk], " ");
  } else if (r.tipo === "site") {
    h = unir([a, aspas(titulo), pontuar(unir([`<i>${esc(r.site)}</i>`, esc(mlaData(r, true)), esc(link)], ", ")), acesso], " ");
  } else if (r.tipo === "tese") {
    const { tipo, grau } = tipoTrabalho(r);
    h = unir([a, pontuar(`<i>${esc(titulo)}</i>`), esc(r.ano) ? esc(r.ano) + "." : "", pontuar(unir([esc(r.instituicao), `${esc(tipo)} de ${esc(grau)}`], ", ")), lk], " ");
  }
  return h;
}

/* ---------- Chicago 17 (bibliografia) ---------- */
function chicagoData(r) {
  if (!r.ano) return "";
  if (r.mesN) return `${r.diaN ? r.diaN + " de " : ""}${MESES_EXT[r.mesN - 1]} de ${r.ano}`;
  return r.ano;
}

function chicago(ref) {
  const r = preparar(ref);
  const aut = listaChicago(r.autores, r.org && r.tipo === "livro");
  const titulo = r.titulo + (r.subtitulo ? ": " + r.subtitulo : "");
  const link = urlEfetiva(r);
  const lk = link ? pontuar(esc(link)) : "";
  const pg = paginas(r.paginas, "–");
  const ed = r.edicao ? (edicaoNum(r.edicao) ? `${edicaoNum(r.edicao)}ª ed.` : limpo(r.edicao)) : "";
  const pub = () => {
    const lp = unir([esc(r.local), esc(r.editora)], ": ");
    return pontuar(unir([lp, esc(r.ano)], ", "));
  };
  const a = aut ? pontuar(esc(aut)) : "";
  let h = "";

  if (r.tipo === "livro") {
    h = unir([a, pontuar(`<i>${esc(titulo)}</i>`), ed ? pontuar(esc(ed)) : "", pub(), lk], " ");
  } else if (r.tipo === "capitulo") {
    const org = r.orgs.length ? `organizado por ${esc(listaDireta(r.orgs, "e"))}` : "";
    const em = pontuar(unir([`In <i>${esc(r.obra)}</i>`, org, pg.texto ? esc(pg.texto) : ""], ", "));
    h = unir([a, aspas(titulo), em, pub(), lk], " ");
  } else if (r.tipo === "artigo") {
    const vn = unir([esc(r.volume), r.numero ? `n. ${esc(r.numero)}` : ""], ", ");
    let miolo = `<i>${esc(r.periodico)}</i>` + (vn ? " " + vn : "") + (r.ano ? ` (${esc(r.ano)})` : "") + (pg.texto ? `: ${esc(pg.texto)}` : "");
    h = unir([a, aspas(titulo), pontuar(miolo), lk], " ");
  } else if (r.tipo === "site") {
    h = unir([a, aspas(titulo), pontuar(esc(r.site)), chicagoData(r) ? pontuar(esc(chicagoData(r))) : "", lk], " ");
  } else if (r.tipo === "tese") {
    const { tipo, grau } = tipoTrabalho(r);
    h = unir([a, aspas(titulo), pontuar(unir([`${esc(tipo)} de ${esc(grau.toLowerCase())}`, esc(r.instituicao), esc(r.ano)], ", ")), lk], " ");
  }
  return h;
}

const ESTILOS = {
  abnt: { nome: "ABNT NBR 6023:2025", fn: abnt },
  apa: { nome: "APA 7ª edição", fn: apa },
  mla: { nome: "MLA 9ª edição", fn: mla },
  chicago: { nome: "Chicago 17ª edição (bibliografia)", fn: chicago }
};

function formatar(ref, estilo) {
  const html = ESTILOS[estilo].fn(ref);
  return { html, texto: txt(html) };
}

// O que falta para a referência ficar completa (avisos, não bloqueios).
function pendencias(ref) {
  const r = preparar(ref);
  const f = [];
  if (!r.titulo) f.push("título");
  if (!r.autores.length && r.tipo !== "site") f.push("autor");
  if (!r.ano) f.push("ano");
  if (r.tipo === "livro" && !r.editora) f.push("editora");
  if (r.tipo === "livro" && !r.local) f.push("local");
  if (r.tipo === "artigo" && !r.periodico) f.push("periódico");
  if (r.tipo === "capitulo" && !r.obra) f.push("título do livro");
  if (r.tipo === "site" && !urlEfetiva(r)) f.push("endereço (URL)");
  if (r.tipo === "tese" && !r.instituicao) f.push("instituição");
  return f;
}

/* ---------- exportação ---------- */
function semAcento(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function chaveBib(r, i) {
  const a = r.autores[0];
  const base = a ? (a.familia || a.inst) : r.titulo.split(" ")[0] || "ref";
  const palavra = r.titulo.split(" ").find((p) => p.length > 3) || "";
  const k = semAcento(base + (r.ano || "") + palavra).toLowerCase().replace(/[^a-z0-9]/g, "");
  return k || "ref" + (i + 1);
}

const bibEsc = (s) => String(s).replace(/([&%_#$])/g, "\\$1");
const bibNome = (a) => (a.inst ? `{${bibEsc(a.inst)}}` : a.dado ? `${bibEsc(a.familia)}, ${bibEsc(a.dado)}` : bibEsc(a.familia));

function bibtex(refs) {
  const usadas = new Set();
  return refs.map((ref, i) => {
    const r = preparar(ref);
    let chave = chaveBib(r, i);
    while (usadas.has(chave)) chave += "a";
    usadas.add(chave);
    const { tipo, grau } = tipoTrabalho(r);
    const tipoBib = { livro: "book", artigo: "article", capitulo: "incollection", site: "misc", tese: grau === "Doutorado" ? "phdthesis" : "mastersthesis" }[r.tipo];
    const campos = [];
    const add = (k, v, bruto) => { if (v) campos.push(`  ${k} = {${bruto ? v : bibEsc(v)}}`); };
    if (r.autores.length) add("author", r.autores.map(bibNome).join(" and "), true);
    if (r.orgs.length && r.tipo === "capitulo") add("editor", r.orgs.map(bibNome).join(" and "), true);
    if (r.org && r.tipo === "livro" && r.autores.length) { campos.shift(); add("editor", r.autores.map(bibNome).join(" and "), true); }
    const titulo = r.titulo + (r.subtitulo ? ": " + r.subtitulo : "");
    if (titulo) campos.push(`  title = {{${bibEsc(titulo)}}}`);
    if (r.tipo === "artigo") { add("journal", r.periodico); add("volume", r.volume); add("number", r.numero); }
    if (r.tipo === "capitulo") add("booktitle", r.obra);
    if (r.tipo === "livro" || r.tipo === "capitulo") { add("edition", r.edicao); add("publisher", r.editora); add("address", r.local); }
    if (r.tipo === "artigo") add("address", r.local);
    if (r.tipo === "tese") { add("school", r.instituicao); add("address", r.local); add("type", `${tipo} (${grau}${r.curso ? " em " + r.curso : ""})`); }
    if (r.tipo === "site") { add("howpublished", r.site); }
    add("year", r.ano);
    if (r.mesN) campos.push(`  month = {${MESES_EXT[r.mesN - 1].slice(0, 3)}}`);
    if (r.paginas) add("pages", limpo(r.paginas).replace(/\s*[-–—]+\s*/, "--"));
    add("doi", r.doi);
    add("url", r.url || (r.tipo === "site" ? "" : ""), true);
    if (r.acessoD) campos.push(`  urldate = {${r.acesso}}`);
    return `@${tipoBib}{${chave},\n${campos.join(",\n")}\n}`;
  }).join("\n\n") + "\n";
}

function pagInicioFim(p) {
  const partes = limpo(p).split(/\s*[-–—]+\s*/).filter(Boolean);
  return { sp: partes[0] || "", ep: partes.length > 1 ? partes[partes.length - 1] : "" };
}

function ris(refs) {
  return refs.map((ref) => {
    const r = preparar(ref);
    const { tipo, grau } = tipoTrabalho(r);
    const L = [];
    const add = (tag, v) => { if (v) L.push(`${tag}  - ${v}`); };
    add("TY", { livro: "BOOK", artigo: "JOUR", capitulo: "CHAP", site: "ELEC", tese: "THES" }[r.tipo]);
    const ehEditor = r.org && r.tipo === "livro";
    r.autores.forEach((a) => add(ehEditor ? "A2" : "AU", a.inst ? a.inst : a.dado ? `${a.familia}, ${a.dado}` : a.familia));
    if (r.tipo === "capitulo") r.orgs.forEach((a) => add("A2", a.dado ? `${a.familia}, ${a.dado}` : a.familia));
    add("TI", r.titulo + (r.subtitulo ? ": " + r.subtitulo : ""));
    if (r.tipo === "artigo") add("JO", r.periodico);
    if (r.tipo === "capitulo") add("T2", r.obra);
    if (r.tipo === "site") add("T2", r.site);
    add("PY", r.ano);
    if (r.ano && r.mesN) add("DA", `${r.ano}/${String(r.mesN).padStart(2, "0")}/${r.diaN ? String(r.diaN).padStart(2, "0") : ""}/`);
    add("VL", r.volume);
    add("IS", r.numero);
    const pg = pagInicioFim(r.paginas);
    add("SP", pg.sp);
    add("EP", pg.ep);
    add("PB", r.tipo === "tese" ? r.instituicao : r.editora);
    add("CY", r.local);
    add("ET", r.edicao);
    if (r.tipo === "tese") add("M3", `${tipo} (${grau}${r.curso ? " em " + r.curso : ""})`);
    add("DO", r.doi);
    add("UR", r.url || (r.doi ? "https://doi.org/" + r.doi : ""));
    if (r.acessoD) add("Y2", r.acesso.replace(/-/g, "/") + "/");
    L.push("ER  - ");
    return L.join("\n");
  }).join("\n\n") + "\n";
}

function endnote(refs) {
  return refs.map((ref) => {
    const r = preparar(ref);
    const { tipo, grau } = tipoTrabalho(r);
    const L = [];
    const add = (tag, v) => { if (v) L.push(`%${tag} ${v}`); };
    add("0", { livro: "Book", artigo: "Journal Article", capitulo: "Book Section", site: "Web Page", tese: "Thesis" }[r.tipo]);
    const ehEditor = r.org && r.tipo === "livro";
    r.autores.forEach((a) => add(ehEditor ? "E" : "A", a.inst ? a.inst : a.dado ? `${a.familia}, ${a.dado}` : a.familia));
    if (r.tipo === "capitulo") r.orgs.forEach((a) => add("E", a.dado ? `${a.familia}, ${a.dado}` : a.familia));
    add("T", r.titulo + (r.subtitulo ? ": " + r.subtitulo : ""));
    if (r.tipo === "artigo") add("J", r.periodico);
    if (r.tipo === "capitulo") add("B", r.obra);
    if (r.tipo === "site") add("B", r.site);
    add("D", r.ano);
    if (r.mesN) add("8", `${r.diaN ? r.diaN + " " : ""}${MESES_EXT[r.mesN - 1]}`);
    add("V", r.volume);
    add("N", r.numero);
    add("P", limpo(r.paginas).replace(/\s*[-–—]+\s*/, "-"));
    add("I", r.tipo === "tese" ? r.instituicao : r.editora);
    add("C", r.local);
    add("7", r.edicao);
    if (r.tipo === "tese") add("9", `${tipo} (${grau}${r.curso ? " em " + r.curso : ""})`);
    add("R", r.doi);
    add("U", r.url || (r.doi ? "https://doi.org/" + r.doi : ""));
    return L.join("\n");
  }).join("\n\n") + "\n";
}

// Formato etiquetado do RefWorks ("RefWorks Tagged Format"); o RefWorks também importa .ris.
function refworks(refs) {
  return refs.map((ref, i) => {
    const r = preparar(ref);
    const { tipo, grau } = tipoTrabalho(r);
    const L = [];
    const add = (tag, v) => { if (v) L.push(`${tag} ${v}`); };
    add("RT", { livro: "Book, Whole", artigo: "Journal Article", capitulo: "Book, Section", site: "Web Page", tese: "Dissertation/Thesis" }[r.tipo]);
    add("SR", r.url || r.doi ? "Electronic(1)" : "Print(0)");
    add("ID", String(i + 1));
    const ehEditor = r.org && r.tipo === "livro";
    r.autores.forEach((a) => add(ehEditor ? "A2" : "A1", a.inst ? a.inst : a.dado ? `${a.familia}, ${a.dado}` : a.familia));
    if (r.tipo === "capitulo") r.orgs.forEach((a) => add("A2", a.dado ? `${a.familia}, ${a.dado}` : a.familia));
    add("T1", r.titulo + (r.subtitulo ? ": " + r.subtitulo : ""));
    if (r.tipo === "artigo") add("JF", r.periodico);
    if (r.tipo === "capitulo") add("T2", r.obra);
    if (r.tipo === "site") add("T2", r.site);
    add("YR", r.ano);
    if (r.mesN) add("FD", `${r.diaN ? r.diaN + " " : ""}${MESES_EXT[r.mesN - 1]}`);
    add("VO", r.volume);
    add("IS", r.numero);
    const pg = pagInicioFim(r.paginas);
    add("SP", pg.sp);
    add("OP", pg.ep);
    add("PB", r.tipo === "tese" ? r.instituicao : r.editora);
    add("PP", r.local);
    add("ED", r.edicao);
    if (r.tipo === "tese") add("DS", `${tipo} (${grau}${r.curso ? " em " + r.curso : ""})`);
    add("DO", r.doi);
    add("LK", r.url || (r.doi ? "https://doi.org/" + r.doi : ""));
    return L.join("\n");
  }).join("\n\n") + "\n";
}

const EXPORTACOES = {
  bibtex: { nome: "BibTeX", ext: "bib", mime: "application/x-bibtex", fn: bibtex },
  endnote: { nome: "EndNote", ext: "enw", mime: "application/x-endnote-refer", fn: endnote },
  refman: { nome: "Reference Manager", ext: "ris", mime: "application/x-research-info-systems", fn: ris },
  refworks: { nome: "RefWorks", ext: "txt", mime: "text/plain", fn: refworks }
};

/* ---------- preenchimento por DOI (Crossref) ---------- */
function doiParaRef(m) {
  const primeiro = (v) => (Array.isArray(v) ? v[0] || "" : v || "");
  const semTags = (s) => limpo(String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
  const tipoCr = m.type || "";
  let tipo = "artigo";
  if (/^(book|monograph|edited-book|reference-book)$/.test(tipoCr)) tipo = "livro";
  else if (/^(book-chapter|book-section|reference-entry)$/.test(tipoCr)) tipo = "capitulo";
  else if (tipoCr === "dissertation") tipo = "tese";
  else if (tipoCr !== "journal-article" && !primeiro(m["container-title"])) tipo = "livro";

  const nomes = (lista) => (lista || []).map((a) => (a.family ? (a.given ? `${a.family}, ${a.given}` : a.family) : a.name || "")).filter(Boolean);
  const aut = m.author || [];
  const inst = aut.length > 0 && aut.every((a) => !a.family && a.name);
  const dp = ((m.issued || m["published-print"] || m["published-online"] || {})["date-parts"] || [[]])[0] || [];
  const container = semTags(primeiro(m["container-title"]));

  const ref = {
    tipo, autores: nomes(aut).join("\n"), inst,
    titulo: semTags(primeiro(m.title)), subtitulo: semTags(primeiro(m.subtitle)),
    ano: dp[0] ? String(dp[0]) : "", mes: tipo === "artigo" && dp[1] ? String(dp[1]) : "",
    editora: semTags(m.publisher), local: semTags(m["publisher-location"]),
    periodico: tipo === "artigo" ? container : "", obra: tipo === "capitulo" ? container : "",
    volume: semTags(m.volume), numero: semTags(m.issue), paginas: semTags(m.page),
    edicao: semTags(m["edition-number"]), organizadores: nomes(m.editor).join("\n"),
    doi: normalizarDoi(m.DOI || ""), url: m.URL || "", org: false
  };
  if (tipo === "tese") {
    ref.instituicao = semTags((m.institution && m.institution[0] && m.institution[0].name) || m.publisher);
    ref.editora = "";
  }
  return ref;
}

/* ---------- exports para Node ---------- */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    formatar, abnt, apa, mla, chicago, pendencias, bibtex, ris, endnote, refworks, doiParaRef,
    parseNome, iniciais, lerAutores, preparar, ajustarTitulo, normalizarDoi, entradaPorTitulo, txt, ESTILOS, EXPORTACOES, TIPOS
  };
}

/* ---------- interface ---------- */
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    const $ = (id) => document.getElementById(id);
    if (!$("f-tipo")) return; // página sem o formulário do gerador (ex.: fichamentos)
    const CHAVE = "kp_refs";
    const campos = Array.from(document.querySelectorAll("[data-campo]"));
    let lista = [];
    let editando = -1;

    try { lista = JSON.parse(localStorage.getItem(CHAVE) || "[]"); if (!Array.isArray(lista)) lista = []; } catch (e) { lista = []; }

    function ler() {
      const ref = {};
      campos.forEach((el) => { ref[el.dataset.campo] = el.type === "checkbox" ? el.checked : el.value; });
      return ref;
    }
    function escrever(ref) {
      campos.forEach((el) => {
        const v = ref[el.dataset.campo];
        if (el.type === "checkbox") el.checked = !!v; else el.value = v === undefined ? "" : v;
      });
      mostrarCampos();
      atualizar();
    }
    function mostrarCampos() {
      const tipo = $("f-tipo").value;
      document.querySelectorAll("[data-tipos]").forEach((el) => {
        el.hidden = !el.dataset.tipos.split(" ").includes(tipo);
      });
    }
    function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(lista)); } catch (e) { /* sem armazenamento */ } }

    async function copiar(html, texto) {
      try {
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([texto], { type: "text/plain" })
          })]);
          return true;
        }
      } catch (e) { /* tenta o próximo método */ }
      try { await navigator.clipboard.writeText(texto); return true; } catch (e) { /* tenta o próximo */ }
      const ta = document.createElement("textarea");
      ta.value = texto; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      ta.remove();
      return ok;
    }

    function aviso(msg, tipo) {
      const el = $("estado");
      el.textContent = msg;
      el.className = "mensagem" + (tipo ? " " + tipo : "");
      el.hidden = !msg;
    }

    // ----- cartões de estilo -----
    const cartoes = $("estilos");
    Object.keys(ESTILOS).forEach((k) => {
      const c = document.createElement("div");
      c.className = "ref-card";
      c.innerHTML = `<h3>${esc(ESTILOS[k].nome)}</h3>
        <button type="button" class="ref-copiavel" id="ref-${k}" aria-describedby="dica-copiar"></button>
        <span class="ref-status" id="st-${k}" role="status" aria-live="polite"></span>`;
      cartoes.appendChild(c);
      c.querySelector("button").addEventListener("click", async () => {
        const ref = ler();
        if (!limpo(ref.titulo)) { aviso("Preencha ao menos o título para gerar a referência.", "alerta"); return; }
        const f = formatar(ref, k);
        const ok = await copiar(f.html, f.texto);
        const st = $("st-" + k);
        st.textContent = ok ? "Copiada! Cole no seu texto (o itálico e o negrito são mantidos)." : "Não foi possível copiar automaticamente. Selecione o texto e use Ctrl+C.";
        c.classList.toggle("copiado", ok);
        setTimeout(() => { st.textContent = ""; c.classList.remove("copiado"); }, 3500);
      });
    });

    function atualizar() {
      const ref = ler();
      const tem = !!limpo(ref.titulo);
      Object.keys(ESTILOS).forEach((k) => {
        const el = $("ref-" + k);
        if (tem) el.innerHTML = formatar(ref, k).html;
        else el.textContent = "Preencha o formulário para ver a referência aqui.";
        el.disabled = !tem;
      });
      const falta = tem ? pendencias(ref) : [];
      $("pendencias").textContent = falta.length ? `Campos que ajudam a completar a referência: ${falta.join(", ")}.` : "";
      $("adicionar").disabled = !tem;
      atualizarExportar();
    }

    // ----- minha lista -----
    function textoAbnt(r) { return formatar(r, "abnt").texto; }
    function ordenada() {
      return lista.map((r, i) => ({ r, i })).sort((a, b) => textoAbnt(a.r).localeCompare(textoAbnt(b.r), "pt-BR", { sensitivity: "base" }));
    }
    function desenharLista() {
      const estilo = $("estilo-lista").value;
      const ol = $("lista");
      ol.innerHTML = "";
      $("lista-vazia").hidden = lista.length > 0;
      $("lista-acoes").hidden = lista.length === 0;
      ordenada().forEach(({ r, i }) => {
        const li = document.createElement("li");
        li.innerHTML = `<span class="ref-texto">${formatar(r, estilo).html}</span>
          <span class="ref-botoes"><button type="button" class="botao botao-secundario" data-acao="copiar" data-i="${i}">Copiar</button>
          <button type="button" class="botao botao-secundario" data-acao="editar" data-i="${i}">Editar</button>
          <button type="button" class="botao botao-secundario" data-acao="remover" data-i="${i}">Remover</button></span>`;
        ol.appendChild(li);
      });
      atualizarExportar();
    }

    $("adicionar").addEventListener("click", () => {
      const ref = ler();
      if (!limpo(ref.titulo)) return;
      if (editando >= 0) { lista[editando] = ref; editando = -1; $("adicionar").textContent = "Adicionar à minha lista"; }
      else lista.push(ref);
      salvar(); desenharLista();
      aviso("Referência salva na lista.", "ok");
    });

    $("lista").addEventListener("click", async (e) => {
      const b = e.target.closest("button[data-acao]");
      if (!b) return;
      const i = +b.dataset.i;
      if (b.dataset.acao === "remover") { lista.splice(i, 1); if (editando === i) editando = -1; salvar(); desenharLista(); }
      else if (b.dataset.acao === "editar") {
        editando = i; escrever(lista[i]);
        $("adicionar").textContent = "Salvar alterações";
        window.scrollTo({ top: $("formulario").offsetTop - 20, behavior: "smooth" });
      } else {
        const f = formatar(lista[i], $("estilo-lista").value);
        aviso((await copiar(f.html, f.texto)) ? "Referência copiada." : "Não foi possível copiar automaticamente.", "ok");
      }
    });

    $("estilo-lista").addEventListener("change", desenharLista);
    $("copiar-lista").addEventListener("click", async () => {
      const estilo = $("estilo-lista").value;
      const itens = ordenada().map(({ r }) => formatar(r, estilo));
      const html = itens.map((f) => `<p>${f.html}</p>`).join("");
      const ok = await copiar(html, itens.map((f) => f.texto).join("\n\n"));
      aviso(ok ? "Lista copiada, em ordem alfabética." : "Não foi possível copiar automaticamente.", ok ? "ok" : "alerta");
    });
    $("limpar-lista").addEventListener("click", () => {
      if (!lista.length || !confirm("Apagar todas as referências da lista?")) return;
      lista = []; editando = -1; salvar(); desenharLista();
    });
    $("limpar-form").addEventListener("click", () => {
      editando = -1; $("adicionar").textContent = "Adicionar à minha lista";
      const tipo = $("f-tipo").value;
      escrever({ tipo, tese: "Tese|Doutorado" });
      aviso("");
    });

    // ----- exportação -----
    function fonteExport() {
      if (lista.length) return { refs: ordenada().map((x) => x.r), origem: "lista" };
      const ref = ler();
      return limpo(ref.titulo) ? { refs: [ref], origem: "atual" } : { refs: [], origem: "" };
    }
    function atualizarExportar() {
      const f = fonteExport();
      document.querySelectorAll("[data-exportar]").forEach((b) => { b.disabled = f.refs.length === 0; });
      $("export-info").textContent = f.refs.length
        ? (f.origem === "lista" ? `Serão exportadas as ${f.refs.length} referência(s) da lista.` : "Será exportada a referência que está no formulário.")
        : "Preencha o título de uma referência para habilitar os downloads.";
    }
    document.querySelectorAll("[data-exportar]").forEach((b) => {
      b.addEventListener("click", () => {
        const ex = EXPORTACOES[b.dataset.exportar];
        const f = fonteExport();
        if (!f.refs.length) return;
        const blob = new Blob([ex.fn(f.refs)], { type: ex.mime + ";charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `referencias-${b.dataset.exportar}.${ex.ext}`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        aviso(`Arquivo ${ex.nome} (.${ex.ext}) gerado.`, "ok");
      });
    });

    // ----- DOI -----
    $("buscar-doi").addEventListener("click", async () => {
      const doi = normalizarDoi($("f-doi-busca").value);
      if (!/^10\.\d{4,9}\/\S+$/.test(doi)) { aviso("Digite um DOI válido, como 10.1590/S0102-3098.2020.", "alerta"); return; }
      aviso("Consultando o Crossref…");
      try {
        const resp = await fetch("https://api.crossref.org/works/" + encodeURIComponent(doi).replace(/%2F/g, "/"));
        if (!resp.ok) throw new Error(resp.status === 404 ? "DOI não encontrado no Crossref." : "Erro " + resp.status);
        const dados = (await resp.json()).message;
        const ref = doiParaRef(dados);
        ref.tese = "Tese|Doutorado";
        $("f-tipo").value = ref.tipo;
        escrever(ref);
        aviso("Dados preenchidos pelo Crossref. Confira cada campo e complete o que faltar (por exemplo, o local de publicação).", "ok");
      } catch (e) {
        aviso(`${e.message || "Falha na consulta."} Preencha o formulário manualmente.`, "erro");
      }
    });

    $("f-tipo").addEventListener("change", () => { mostrarCampos(); atualizar(); });
    $("formulario").addEventListener("input", atualizar);
    $("formulario").addEventListener("submit", (e) => e.preventDefault());

    mostrarCampos();
    atualizar();
    desenharLista();
  });
}
