/* Buscador acadêmico do Kit Pesquisador.
   Consulta o OpenAlex, o Crossref e o Semantic Scholar direto do navegador do visitante (sem servidor próprio).
   A lógica (montar URLs, normalizar respostas, formatar referências) é separada da interface
   para poder ser testada em Node (npm test). */

const POR_PAGINA = 25;
const MAX_REGISTROS = 10000; // limite de paginação do OpenAlex e do Crossref
const MAX_REGISTROS_S2 = 1000; // a busca por relevância do Semantic Scholar vai até offset + limit = 1000
const SELECT_OPENALEX =
  "id,doi,title,display_name,publication_year,type,language,cited_by_count,open_access,primary_location,authorships,biblio,abstract_inverted_index";
const SELECT_CROSSREF =
  "DOI,title,author,container-title,issued,type,volume,issue,page,URL,is-referenced-by-count,abstract";
const CAMPOS_S2 =
  "title,authors,year,venue,journal,externalIds,url,openAccessPdf,isOpenAccess,citationCount,abstract,publicationTypes";

const FONTES = [
  { valor: "openalex", rotulo: "OpenAlex", dica: "mais filtros" },
  { valor: "crossref", rotulo: "Crossref", dica: "registro de DOIs" },
  { valor: "semantic", rotulo: "Semantic Scholar", dica: "limite compartilhado" },
];
const NOMES_FONTE = Object.fromEntries(FONTES.map((f) => [f.valor, f.rotulo]));

const TIPOS = [
  { valor: "", rotulo: "Qualquer tipo", openalex: "", crossref: "", s2: "" },
  { valor: "artigo", rotulo: "Artigo", openalex: "article", crossref: "journal-article", s2: "JournalArticle" },
  { valor: "livro", rotulo: "Livro", openalex: "book", crossref: "monograph", s2: "Book" },
  { valor: "capitulo", rotulo: "Capítulo de livro", openalex: "book-chapter", crossref: "book-chapter", s2: "BookSection" },
  { valor: "tese", rotulo: "Tese ou dissertação", openalex: "dissertation", crossref: "dissertation", s2: "" },
  { valor: "preprint", rotulo: "Preprint", openalex: "preprint", crossref: "posted-content", s2: "" },
];

const IDIOMAS = [
  { valor: "", rotulo: "Qualquer idioma" },
  { valor: "pt", rotulo: "Português" },
  { valor: "en", rotulo: "Inglês" },
  { valor: "es", rotulo: "Espanhol" },
  { valor: "fr", rotulo: "Francês" },
  { valor: "de", rotulo: "Alemão" },
  { valor: "it", rotulo: "Italiano" },
];

// campo:N = campo (OpenAlex "field"); sub:N = subárea ("subfield"). IDs conferidos na API.
const AREAS = [
  { valor: "", rotulo: "Todas as áreas" },
  { valor: "campo:12", rotulo: "Artes e Humanidades (todas)" },
  { valor: "sub:1202", rotulo: "História" },
  { valor: "sub:1211", rotulo: "Filosofia" },
  { valor: "sub:1207", rotulo: "História e Filosofia da Ciência" },
  { valor: "sub:1208", rotulo: "Literatura e Teoria Literária" },
  { valor: "sub:1203", rotulo: "Língua e Linguística" },
  { valor: "sub:1212", rotulo: "Estudos Religiosos" },
  { valor: "sub:1204", rotulo: "Arqueologia" },
  { valor: "sub:1205", rotulo: "Clássicos" },
  { valor: "sub:1209", rotulo: "Museologia" },
  { valor: "sub:1213", rotulo: "Artes Visuais e Cênicas" },
  { valor: "campo:33", rotulo: "Ciências Sociais (todas)" },
  { valor: "sub:3304", rotulo: "Educação" },
  { valor: "sub:3314", rotulo: "Antropologia" },
  { valor: "sub:3312", rotulo: "Sociologia e Ciência Política" },
  { valor: "sub:3316", rotulo: "Estudos Culturais" },
  { valor: "sub:3309", rotulo: "Biblioteconomia e Ciência da Informação" },
  { valor: "sub:3308", rotulo: "Direito" },
];

// Áreas equivalentes no Semantic Scholar (fieldsOfStudy). Sem equivalente, o filtro é ignorado.
const AREAS_S2 = {
  "campo:12": "Art,History,Philosophy,Linguistics",
  "sub:1202": "History",
  "sub:1211": "Philosophy",
  "sub:1207": "History,Philosophy",
  "sub:1203": "Linguistics",
  "sub:1213": "Art",
  "campo:33": "Sociology,Political Science,Education,Law,Economics,Geography",
  "sub:3304": "Education",
  "sub:3312": "Sociology,Political Science",
  "sub:3308": "Law",
};

const ORDENS = [
  { valor: "relevancia", rotulo: "Mais relevantes" },
  { valor: "citacoes", rotulo: "Mais citados" },
  { valor: "recentes", rotulo: "Mais recentes" },
  { valor: "antigos", rotulo: "Mais antigos" },
];

const CAMPOS_BUSCA = [
  { valor: "ta", rotulo: "Título e resumo" },
  { valor: "tudo", rotulo: "Texto completo, quando disponível (mais resultados)" },
];

const ROTULOS_TIPO = {
  article: "Artigo",
  book: "Livro",
  "book-chapter": "Capítulo",
  dissertation: "Tese/Dissertação",
  preprint: "Preprint",
  review: "Revisão",
  report: "Relatório",
  "journal-article": "Artigo",
  monograph: "Livro",
  "edited-book": "Livro",
  "reference-book": "Livro",
  "posted-content": "Preprint",
  "proceedings-article": "Trabalho em evento",
};

const PADRAO = {
  q: "", fonte: "openalex", fontes: ["openalex"], de: "", ate: "", tipo: "", idioma: "", area: "",
  oa: false, br: false, campo: "ta", ord: "relevancia", pag: 1,
};

/* ---------- utilidades ---------- */

const enc = encodeURIComponent;
const dentro = (lista, v) => lista.some((x) => x.valor === v);

function urlSegura(u) {
  return typeof u === "string" && /^https?:\/\//i.test(u.trim()) ? u.trim() : "";
}

function limparDoi(d) {
  if (!d) return "";
  return String(d).trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
}

function anoValido(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 1000 && n <= 2100 ? String(n) : "";
}

function rotuloTipo(t) {
  return ROTULOS_TIPO[t] || (t ? String(t) : "");
}

/* ---------- parâmetros e URL da página ---------- */

function normalizarParametros(entrada) {
  const e = entrada || {};
  const p = { ...PADRAO };
  p.q = String(e.q || "").replace(/\s+/g, " ").trim().slice(0, 300);
  // Várias fontes: array em e.fontes ou texto "openalex,crossref" em e.fonte. p.fonte = a primeira.
  const pedidas = Array.isArray(e.fontes) ? e.fontes : String(e.fonte || "").split(",");
  p.fontes = FONTES.map((f) => f.valor).filter((v) => pedidas.map((x) => String(x).trim()).includes(v));
  if (!p.fontes.length) p.fontes = [PADRAO.fonte];
  p.fonte = p.fontes[0];
  p.de = anoValido(e.de);
  p.ate = anoValido(e.ate);
  if (p.de && p.ate && Number(p.de) > Number(p.ate)) [p.de, p.ate] = [p.ate, p.de];
  p.tipo = dentro(TIPOS, e.tipo) ? e.tipo : "";
  p.idioma = dentro(IDIOMAS, e.idioma) ? e.idioma : "";
  p.area = dentro(AREAS, e.area) ? e.area : "";
  p.oa = e.oa === true || e.oa === "1";
  p.br = e.br === true || e.br === "1";
  p.campo = dentro(CAMPOS_BUSCA, e.campo) ? e.campo : PADRAO.campo;
  p.ord = dentro(ORDENS, e.ord) ? e.ord : PADRAO.ord;
  const pag = parseInt(e.pag, 10);
  p.pag = Number.isFinite(pag) && pag >= 1 ? Math.min(pag, Math.ceil(maxRegistrosFontes(p.fontes) / POR_PAGINA)) : 1;
  return p;
}

function lerDaUrl(search) {
  const u = new URLSearchParams(search || "");
  return normalizarParametros({
    q: u.get("q"), fonte: u.get("fonte"), de: u.get("de"), ate: u.get("ate"), tipo: u.get("tipo"),
    idioma: u.get("idioma"), area: u.get("area"), oa: u.get("aberto"), br: u.get("br"),
    campo: u.get("campo"), ord: u.get("ord"), pag: u.get("p"),
  });
}

function paraUrl(p) {
  const u = new URLSearchParams();
  if (p.q) u.set("q", p.q);
  const fontes = (p.fontes || [p.fonte]).join(",");
  if (fontes !== PADRAO.fonte) u.set("fonte", fontes);
  if (p.de) u.set("de", p.de);
  if (p.ate) u.set("ate", p.ate);
  if (p.tipo) u.set("tipo", p.tipo);
  if (p.idioma) u.set("idioma", p.idioma);
  if (p.area) u.set("area", p.area);
  if (p.oa) u.set("aberto", "1");
  if (p.br) u.set("br", "1");
  if (p.campo !== PADRAO.campo) u.set("campo", p.campo);
  if (p.ord !== PADRAO.ord) u.set("ord", p.ord);
  if (p.pag > 1) u.set("p", String(p.pag));
  const s = u.toString();
  return s ? "?" + s : "";
}

/* ---------- montagem das URLs das APIs ---------- */

// Vírgula, barra vertical e dois-pontos têm função na sintaxe de filtros do OpenAlex.
const paraFiltro = (txt) => String(txt).replace(/[,|:]/g, " ").replace(/\s+/g, " ").trim();

function urlOpenAlex(p, base, chave, hoje) {
  const filtros = [];
  const de = p.de ? Number(p.de) : null;
  const ate = p.ate ? Number(p.ate) : null;
  if (de && ate) filtros.push(`publication_year:${de}-${ate}`);
  else if (de) filtros.push(`publication_year:>${de - 1}`);
  else if (ate) filtros.push(`publication_year:<${ate + 1}`);
  const tipo = TIPOS.find((t) => t.valor === p.tipo);
  if (tipo && tipo.openalex) filtros.push(`type:${tipo.openalex}`);
  if (p.idioma) filtros.push(`language:${p.idioma}`);
  if (p.oa) filtros.push("is_oa:true");
  if (p.br) filtros.push("authorships.institutions.country_code:BR");
  if (p.area) {
    const [nivel, id] = p.area.split(":");
    filtros.push(nivel === "campo" ? `primary_topic.field.id:${id}` : `primary_topic.subfield.id:${id}`);
  }
  if (p.ord === "recentes" && hoje) filtros.push(`to_publication_date:${hoje}`);
  const partes = [];
  if (p.campo === "ta") filtros.push(`title_and_abstract.search:${enc(paraFiltro(p.q))}`);
  else partes.push(`search=${enc(p.q)}`);
  if (filtros.length) partes.push(`filter=${filtros.join(",")}`);
  const sort = { citacoes: "cited_by_count:desc", recentes: "publication_date:desc", antigos: "publication_date:asc" }[p.ord];
  if (sort) partes.push(`sort=${sort}`);
  partes.push(`per_page=${POR_PAGINA}`, `page=${p.pag}`, `select=${SELECT_OPENALEX}`);
  if (chave) partes.push(`api_key=${enc(chave)}`);
  return `${base.replace(/\/$/, "")}/works?${partes.join("&")}`;
}

// Filtros que o Crossref não oferece e que, por isso, são ignorados nessa fonte.
function filtrosIgnoradosCrossref(p) {
  const lista = [];
  if (p.idioma) lista.push("idioma");
  if (p.area) lista.push("área");
  if (p.oa) lista.push("acesso aberto");
  if (p.br) lista.push("instituição no Brasil");
  return lista;
}

function urlCrossref(p, base, hoje) {
  const filtros = [];
  if (p.de) filtros.push(`from-pub-date:${p.de}`);
  if (p.ate) filtros.push(`until-pub-date:${p.ate}`);
  else if (p.ord === "recentes" && hoje) filtros.push(`until-pub-date:${hoje}`);
  const tipo = TIPOS.find((t) => t.valor === p.tipo);
  if (tipo && tipo.crossref) filtros.push(`type:${tipo.crossref}`);
  const partes = [`query=${enc(p.q)}`];
  if (filtros.length) partes.push(`filter=${filtros.join(",")}`);
  const ordem = {
    relevancia: "sort=relevance&order=desc",
    citacoes: "sort=is-referenced-by-count&order=desc",
    recentes: "sort=published&order=desc",
    antigos: "sort=published&order=asc",
  }[p.ord];
  partes.push(ordem);
  partes.push(`rows=${POR_PAGINA}`, `offset=${(p.pag - 1) * POR_PAGINA}`, `select=${SELECT_CROSSREF}`);
  return `${base.replace(/\/$/, "")}/works?${partes.join("&")}`;
}

// Filtros que o Semantic Scholar não oferece (ou que não têm equivalente) e são ignorados.
function filtrosIgnoradosS2(p) {
  const lista = [];
  if (p.idioma) lista.push("idioma");
  if (p.br) lista.push("instituição no Brasil");
  const tipo = TIPOS.find((t) => t.valor === p.tipo);
  if (tipo && tipo.valor && !tipo.s2) lista.push("tipo");
  if (p.area && !AREAS_S2[p.area]) lista.push("área");
  if (p.ord !== "relevancia") lista.push("ordenação");
  return lista;
}

function filtrosIgnorados(p) {
  if (p.fonte === "crossref") return filtrosIgnoradosCrossref(p);
  if (p.fonte === "semantic") return filtrosIgnoradosS2(p);
  return [];
}

function maxRegistros(fonte) {
  return fonte === "semantic" ? MAX_REGISTROS_S2 : MAX_REGISTROS;
}

function maxRegistrosFontes(fontes) {
  return Math.max(...(fontes && fontes.length ? fontes : [PADRAO.fonte]).map(maxRegistros));
}

/* ---------- busca combinada ---------- */

// Mesmo DOI = mesma obra; sem DOI, compara título (sem acentos e pontuação) e ano.
function chaveResultado(r) {
  if (r.doi) return "doi:" + String(r.doi).toLowerCase();
  const t = String(r.titulo || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `t:${t}|${r.ano || ""}`;
}

const COMPLEMENTOS = ["resumo", "urlAberta", "urlS2", "volume", "numero", "paginas", "fonte", "idioma", "tipo"];

// Junta as listas das fontes alternando as posições (1º de cada, 2º de cada…), para respeitar a
// relevância de cada base, sem repetir obras. Campos vazios são completados pelas outras fontes.
function mesclarResultados(listas, ord) {
  const mapa = new Map();
  const saida = [];
  const maior = Math.max(0, ...listas.map((l) => l.resultados.length));
  for (let i = 0; i < maior; i++) {
    for (const l of listas) {
      const r = l.resultados[i];
      if (!r) continue;
      const k = chaveResultado(r);
      const ja = mapa.get(k);
      if (!ja) {
        const novo = { ...r, fontes: [l.fonte] };
        mapa.set(k, novo);
        saida.push(novo);
        continue;
      }
      if (!ja.fontes.includes(l.fonte)) ja.fontes.push(l.fonte);
      for (const c of COMPLEMENTOS) if (!ja[c] && r[c]) ja[c] = r[c];
      if (r.aberto) ja.aberto = true;
      if (!ja.autores.length && r.autores.length) ja.autores = r.autores;
    }
  }
  const ano = (r) => Number(r.ano) || 0;
  if (ord === "citacoes") saida.sort((a, b) => (b.citacoes || 0) - (a.citacoes || 0));
  else if (ord === "recentes") saida.sort((a, b) => ano(b) - ano(a));
  else if (ord === "antigos") saida.sort((a, b) => (ano(a) || 9999) - (ano(b) || 9999));
  return saida;
}

// "a", "a e b", "a, b e c"
function juntarNomes(l) {
  return l.length <= 1 ? l.join("") : l.slice(0, -1).join(", ") + " e " + l[l.length - 1];
}

function urlSemantic(p, base) {
  const partes = [`query=${enc(p.q)}`];
  if (p.de || p.ate) partes.push(`year=${p.de || ""}-${p.ate || ""}`);
  const tipo = TIPOS.find((t) => t.valor === p.tipo);
  if (tipo && tipo.s2) partes.push(`publicationTypes=${tipo.s2}`);
  if (AREAS_S2[p.area]) partes.push(`fieldsOfStudy=${enc(AREAS_S2[p.area])}`);
  if (p.oa) partes.push("openAccessPdf");
  const offset = (p.pag - 1) * POR_PAGINA;
  partes.push(`offset=${offset}`, `limit=${Math.min(POR_PAGINA, MAX_REGISTROS_S2 - offset)}`, `fields=${CAMPOS_S2}`);
  return `${base.replace(/\/$/, "")}/graph/v1/paper/search?${partes.join("&")}`;
}

/* ---------- normalização das respostas ---------- */

function reconstruirResumo(indice) {
  if (!indice || typeof indice !== "object") return "";
  const palavras = [];
  for (const [palavra, posicoes] of Object.entries(indice)) {
    if (!Array.isArray(posicoes)) continue;
    for (const i of posicoes) palavras[i] = palavra;
  }
  return palavras.filter((x) => x !== undefined).join(" ");
}

function limparJats(txt) {
  if (!txt) return "";
  return String(txt)
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(abstract|resumo|resumen|résumé)\s*[:.]?\s+/i, "");
}

function normalizarOpenAlex(w) {
  const loc = w.primary_location || {};
  const fonte = loc.source || {};
  const oa = w.open_access || {};
  const biblio = w.biblio || {};
  const doi = limparDoi(w.doi);
  const primeira = biblio.first_page || "";
  const ultima = biblio.last_page || "";
  return {
    id: w.id || "",
    titulo: w.title || w.display_name || "(sem título)",
    autores: (w.authorships || [])
      .map((a) => ({ nome: (a.author && a.author.display_name) || a.raw_author_name || "" }))
      .filter((a) => a.nome),
    fonte: fonte.display_name || "",
    ano: w.publication_year || null,
    tipo: rotuloTipo(w.type),
    idioma: w.language || "",
    doi,
    url: urlSegura(loc.landing_page_url) || (doi ? `https://doi.org/${doi}` : urlSegura(w.id)),
    urlAberta: urlSegura(oa.oa_url) || urlSegura(loc.pdf_url),
    aberto: !!oa.is_oa,
    citacoes: w.cited_by_count || 0,
    resumo: reconstruirResumo(w.abstract_inverted_index),
    volume: biblio.volume || "",
    numero: biblio.issue || "",
    paginas: primeira && ultima && primeira !== ultima ? `${primeira}-${ultima}` : primeira,
  };
}

function normalizarCrossref(it) {
  const doi = (it.DOI || "").trim();
  const partesData = it.issued && it.issued["date-parts"] && it.issued["date-parts"][0];
  return {
    id: doi,
    titulo: (it.title && it.title[0]) || "(sem título)",
    autores: (it.author || [])
      .map((a) =>
        a.name
          ? { nome: a.name, entidade: true }
          : { nome: [a.given, a.family].filter(Boolean).join(" "), dado: a.given || "", sobrenome: a.family || "" }
      )
      .filter((a) => a.nome),
    fonte: (it["container-title"] && it["container-title"][0]) || "",
    ano: (partesData && partesData[0]) || null,
    tipo: rotuloTipo(it.type),
    idioma: "",
    doi,
    url: doi ? `https://doi.org/${doi}` : urlSegura(it.URL),
    urlAberta: "",
    aberto: false,
    citacoes: it["is-referenced-by-count"] || 0,
    resumo: limparJats(it.abstract),
    volume: it.volume || "",
    numero: it.issue || "",
    paginas: it.page || "",
  };
}

const TIPOS_S2 = [
  ["BookSection", "Capítulo"], ["Book", "Livro"], ["Conference", "Trabalho em evento"],
  ["Review", "Revisão"], ["JournalArticle", "Artigo"],
];

// Os termos da API pedem um link de volta ao Semantic Scholar com utm_source=api.
function urlComUtm(u) {
  const s = urlSegura(u);
  if (!s) return "";
  return s + (s.includes("?") ? "&" : "?") + "utm_source=api";
}

function normalizarSemantic(it) {
  const j = it.journal || {};
  const doi = limparDoi(it.externalIds && it.externalIds.DOI);
  const tipos = Array.isArray(it.publicationTypes) ? it.publicationTypes : [];
  const achado = TIPOS_S2.find(([k]) => tipos.includes(k));
  // "volume" às vezes vem com o número junto ("11 2").
  let volume = String(j.volume || "").trim();
  let numero = "";
  const vn = /^(\S+)\s+(\S+)$/.exec(volume);
  if (vn) { volume = vn[1]; numero = vn[2]; }
  const paginaS2 = urlComUtm(it.url);
  const pdf = it.openAccessPdf && urlSegura(it.openAccessPdf.url);
  return {
    id: it.paperId || doi,
    titulo: it.title || "(sem título)",
    autores: (it.authors || []).map((a) => ({ nome: (a && a.name) || "" })).filter((a) => a.nome),
    fonte: String(j.name || it.venue || "").trim(),
    ano: it.year || null,
    tipo: achado ? achado[1] : "",
    idioma: "",
    doi,
    url: doi ? `https://doi.org/${doi}` : paginaS2,
    urlS2: paginaS2,
    urlAberta: pdf || "",
    aberto: !!(it.isOpenAccess || pdf),
    citacoes: it.citationCount || 0,
    resumo: limparJats(it.abstract),
    volume,
    numero,
    paginas: String(j.pages || "").replace(/\s+/g, "").replace(/[–—]/g, "-"),
  };
}

/* ---------- referência ABNT (rascunho) ---------- */

const SUFIXOS_NOME = ["junior", "júnior", "filho", "neto", "sobrinho"];

function formatarNomeAbnt(a) {
  if (a.entidade) return a.nome.toUpperCase();
  let sobrenome = a.sobrenome;
  let dado = a.dado || "";
  if (!sobrenome) {
    const partes = a.nome.trim().split(/\s+/);
    if (partes.length === 1) return partes[0].toUpperCase();
    const ultimo = partes[partes.length - 1].toLowerCase();
    const n = SUFIXOS_NOME.includes(ultimo) && partes.length > 2 ? 2 : 1;
    sobrenome = partes.slice(-n).join(" ");
    dado = partes.slice(0, -n).join(" ");
  }
  return sobrenome.toUpperCase() + (dado ? `, ${dado}` : "");
}

// Título todo em maiúsculas vira "Frase normal" (a ABNT não usa caixa alta no título).
function ajustarCaixaTitulo(t) {
  if (t.length > 3 && t === t.toUpperCase() && t !== t.toLowerCase()) {
    const m = t.toLowerCase();
    return m.charAt(0).toUpperCase() + m.slice(1);
  }
  return t;
}

function referenciaAbnt(r) {
  const nomes = r.autores.map(formatarNomeAbnt);
  const titulo = ajustarCaixaTitulo(r.titulo.trim()).replace(/[.\s]+$/, "");
  let inicio;
  if (nomes.length === 0) {
    const [primeira, ...resto] = titulo.split(" ");
    inicio = [primeira.toUpperCase(), ...resto].join(" ") + ".";
  } else {
    const autoria = nomes.length > 3 ? `${nomes[0]} et al.` : nomes.join("; ");
    inicio = `${autoria.replace(/\.$/, "")}. ${titulo}.`;
  }
  const detalhes = [];
  if (r.fonte) detalhes.push(r.fonte);
  if (r.tipo === "Artigo") {
    if (r.volume) detalhes.push(`v. ${r.volume}`);
    if (r.numero) detalhes.push(`n. ${r.numero}`);
    if (r.paginas) detalhes.push(`p. ${r.paginas}`);
  }
  if (r.ano) detalhes.push(String(r.ano));
  const meio = detalhes.length ? ` ${detalhes.join(", ")}.` : "";
  const fim = r.doi ? ` DOI: ${r.doi}.` : r.url ? ` Disponível em: ${r.url}.` : "";
  return `${inicio}${meio}${fim}`;
}

/* ---------- outras bases (somente links, sem consulta automática) ---------- */

function urlsOutrasBases(p) {
  const q = enc(p.q);
  let scholar = `https://scholar.google.com/scholar?hl=pt-BR&q=${q}`;
  if (p.de) scholar += `&as_ylo=${p.de}`;
  if (p.ate) scholar += `&as_yhi=${p.ate}`;
  if (p.idioma) scholar += `&lr=lang_${p.idioma}`;
  return [
    { nome: "Google Acadêmico", url: scholar, nota: "aplica anos e idioma" },
    { nome: "SciELO", url: `https://search.scielo.org/?lang=pt&q=${q}`, nota: "periódicos ibero-americanos" },
    { nome: "BDTD", url: `https://bdtd.ibict.br/vufind/Search/Results?lookfor=${q}&type=AllFields`, nota: "teses e dissertações brasileiras" },
    { nome: "PhilPapers", url: `https://philpapers.org/s/${q}`, nota: "filosofia" },
    { nome: "JSTOR", url: `https://www.jstor.org/action/doBasicSearch?Query=${q}`, nota: "parte do acervo exige acesso institucional" },
    { nome: "Semantic Scholar", url: `https://www.semanticscholar.org/search?q=${q}`, nota: "" },
    { nome: "CORE", url: `https://core.ac.uk/search?q=${q}`, nota: "repositórios de acesso aberto" },
    { nome: "Internet Archive Scholar", url: `https://scholar.archive.org/search?q=${q}`, nota: "" },
  ];
}

/* ---------- ponte para o gerador de referências ---------- */

const CHAVE_REFS = "kp_refs";

// Converte um resultado normalizado no objeto `ref` usado pelo gerador de referências.
function resultadoParaRef(r) {
  const tipoRotulo = r.tipo || "";
  let tipo = "artigo";
  if (tipoRotulo === "Livro") tipo = "livro";
  else if (tipoRotulo === "Capítulo") tipo = "capitulo";
  else if (tipoRotulo === "Tese/Dissertação") tipo = "tese";
  const autores = r.autores || [];
  const unicaEntidade = autores.length === 1 && autores[0].entidade;
  const linhas = autores.map((a) => (a.sobrenome ? `${a.sobrenome}, ${a.dado || ""}`.replace(/,\s*$/, "") : a.nome));
  const ref = {
    tipo,
    autores: linhas.join("\n"),
    inst: !!unicaEntidade,
    titulo: ajustarCaixaTitulo(String(r.titulo || "").trim()),
    ano: r.ano ? String(r.ano) : "",
    doi: r.doi || "",
    url: r.doi ? "" : r.url || "",
  };
  const fonte = r.fonte || "";
  if (tipo === "artigo") {
    Object.assign(ref, { periodico: fonte, volume: r.volume || "", numero: r.numero || "", paginas: r.paginas || "" });
  } else if (tipo === "livro") {
    ref.editora = fonte;
  } else if (tipo === "capitulo") {
    Object.assign(ref, { obra: fonte, paginas: r.paginas || "" });
  } else {
    Object.assign(ref, { tese: "Tese|Doutorado", instituicao: fonte });
  }
  return ref;
}

const normalizaChave = (t) => String(t || "").toLowerCase().replace(/\s+/g, " ").trim();

// Acrescenta `ref` à lista, sem duplicar (mesmo DOI ou mesmo título e ano).
function adicionarRef(lista, ref) {
  const base = Array.isArray(lista) ? lista : [];
  const igual = (x) =>
    (ref.doi && x.doi && normalizaChave(x.doi) === normalizaChave(ref.doi)) ||
    (normalizaChave(x.titulo) === normalizaChave(ref.titulo) && String(x.ano || "") === String(ref.ano || ""));
  if (base.some(igual)) return { lista: base, novo: false };
  return { lista: [...base, ref], novo: true };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    POR_PAGINA, MAX_REGISTROS, PADRAO, TIPOS, AREAS, IDIOMAS, ORDENS,
    normalizarParametros, lerDaUrl, paraUrl, urlOpenAlex, urlCrossref, filtrosIgnoradosCrossref,
    urlSemantic, filtrosIgnoradosS2, filtrosIgnorados, maxRegistros, normalizarSemantic, AREAS_S2, MAX_REGISTROS_S2,
    maxRegistrosFontes, chaveResultado, mesclarResultados, juntarNomes, NOMES_FONTE, FONTES,
    reconstruirResumo, limparJats, normalizarOpenAlex, normalizarCrossref,
    formatarNomeAbnt, ajustarCaixaTitulo, referenciaAbnt, resultadoParaRef, adicionarRef, urlsOutrasBases, urlSegura, limparDoi,
  };
}

/* ======================= interface ======================= */

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("busca");
    if (!form) return;
    const $ = (id) => document.getElementById(id);
    const nf = new Intl.NumberFormat("pt-BR");

    const raiz = document.getElementById("buscador-config") || form;
    const baseOpenAlex = raiz.dataset.openalex || "https://api.openalex.org";
    const baseCrossref = raiz.dataset.crossref || "https://api.crossref.org";
    const baseSemantic = raiz.dataset.semantic || "https://api.semanticscholar.org";
    const CHAVE_LS = "kp_openalex_key";

    const campos = {
      q: $("q"), de: $("de"), ate: $("ate"), tipo: $("tipo"),
      idioma: $("idioma"), area: $("area"), oa: $("oa"), br: $("br"), campo: $("campo"), ord: $("ord"),
    };
    const status = $("status");
    const lista = $("resultados");
    const paginacao = $("paginacao");
    const nota = $("nota-fonte");
    const outras = $("outras-bases");
    const chaveInput = $("chave");

    function preencher(select, itens) {
      select.textContent = "";
      for (const it of itens) {
        const o = document.createElement("option");
        o.value = it.valor;
        o.textContent = it.rotulo;
        select.appendChild(o);
      }
    }
    const caixaFontes = $("fontes");
    for (const f of FONTES) {
      const l = document.createElement("label");
      l.className = "marcador";
      const i = document.createElement("input");
      i.type = "checkbox"; i.name = "fonte"; i.value = f.valor;
      const dica = document.createElement("span");
      dica.className = "dica-fonte";
      dica.textContent = `(${f.dica})`;
      l.append(i, ` ${f.rotulo} `, dica);
      caixaFontes.appendChild(l);
    }
    const fontesMarcadas = () => Array.from(caixaFontes.querySelectorAll("input:checked")).map((i) => i.value);
    function marcarFontes(lista) {
      caixaFontes.querySelectorAll("input").forEach((i) => { i.checked = lista.includes(i.value); });
    }
    preencher(campos.tipo, TIPOS);
    preencher(campos.idioma, IDIOMAS);
    preencher(campos.area, AREAS);
    preencher(campos.ord, ORDENS);
    preencher(campos.campo, CAMPOS_BUSCA);

    try { chaveInput.value = localStorage.getItem(CHAVE_LS) || ""; } catch (e) { /* sem armazenamento */ }
    chaveInput.addEventListener("change", () => {
      try {
        const v = chaveInput.value.trim();
        if (v) localStorage.setItem(CHAVE_LS, v); else localStorage.removeItem(CHAVE_LS);
      } catch (e) { /* ignora */ }
    });

    function lerFormulario() {
      return normalizarParametros({
        q: campos.q.value, fontes: fontesMarcadas(), de: campos.de.value, ate: campos.ate.value,
        tipo: campos.tipo.value, idioma: campos.idioma.value, area: campos.area.value,
        oa: campos.oa.checked, br: campos.br.checked, campo: campos.campo.value, ord: campos.ord.value, pag: 1,
      });
    }

    function escreverFormulario(p) {
      campos.q.value = p.q; marcarFontes(p.fontes); campos.de.value = p.de; campos.ate.value = p.ate;
      campos.tipo.value = p.tipo; campos.idioma.value = p.idioma; campos.area.value = p.area;
      campos.oa.checked = p.oa; campos.br.checked = p.br; campos.campo.value = p.campo; campos.ord.value = p.ord;
      atualizarFonte();
    }

    // Filtros que cada fonte aceita (ano e tipo valem para todas).
    const SUPORTE = { openalex: ["idioma", "area", "oa", "br", "campo", "ord"], crossref: ["ord"], semantic: ["area", "oa"] };

    function atualizarFonte() {
      const fs = fontesMarcadas();
      for (const k of ["idioma", "area", "oa", "br", "campo", "ord"]) {
        // Na busca combinada a ordenação é aplicada ao conjunto, então vale sempre.
        campos[k].disabled = !(fs.some((f) => SUPORTE[f].includes(k)) || (k === "ord" && fs.length > 1));
      }
      const textos = {
        crossref: "No Crossref não há filtro de idioma, área, acesso aberto nem instituição, e a busca é feita em todos os campos do registro. Use o OpenAlex para esses filtros.",
        semantic: "No Semantic Scholar os resultados vêm sempre por relevância, sem filtro de idioma nem de instituição, e a paginação vai até 1.000 resultados. A área usa as categorias dele (nem todas têm equivalente). O limite gratuito é dividido entre todos os usuários da internet: se a busca falhar, espere alguns segundos e tente de novo.",
      };
      const partes = fs.map((f) => textos[f]).filter(Boolean);
      if (fs.length > 1) {
        partes.unshift(`Busca combinada em ${juntarNomes(fs.map((f) => NOMES_FONTE[f]))}: cada página traz até ${POR_PAGINA} resultados de cada fonte, sem repetir a mesma obra (mesmo DOI ou mesmo título e ano). Cada filtro vale nas fontes que o oferecem.`);
      }
      nota.hidden = !partes.length;
      nota.textContent = partes.join(" ");
    }

    function atualizarOutrasBases() {
      const q = campos.q.value.trim();
      outras.textContent = "";
      if (!q) {
        const li = document.createElement("li");
        li.textContent = "Digite um termo de busca para gerar os links.";
        outras.appendChild(li);
        return;
      }
      for (const b of urlsOutrasBases(lerFormulario())) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = b.url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = b.nome;
        li.appendChild(a);
        if (b.nota) li.appendChild(document.createTextNode(` — ${b.nota}`));
        outras.appendChild(li);
      }
    }

    function el(tag, classe, texto) {
      const e = document.createElement(tag);
      if (classe) e.className = classe;
      if (texto !== undefined) e.textContent = texto;
      return e;
    }

    function botaoLista(r) {
      const rotulo = "Adicionar à lista de referências";
      const caixa = el("span", "acao-lista");
      const b = el("button", "botao botao-secundario botao-pequeno", rotulo);
      b.type = "button";
      b.addEventListener("click", () => {
        let atual = [];
        try {
          const lido = JSON.parse(localStorage.getItem(CHAVE_REFS) || "[]");
          if (Array.isArray(lido)) atual = lido;
        } catch (e) { /* lista ilegível: recomeça */ }
        const { lista, novo } = adicionarRef(atual, resultadoParaRef(r));
        try {
          localStorage.setItem(CHAVE_REFS, JSON.stringify(lista));
        } catch (e) {
          b.textContent = "Não foi possível salvar";
          setTimeout(() => (b.textContent = rotulo), 2000);
          return;
        }
        b.textContent = novo ? "Adicionada!" : "Já está na lista";
        if (!caixa.querySelector("a")) {
          const a = el("a", "", `Ver lista (${lista.length})`);
          a.href = "/ferramentas/gerador-de-referencias/";
          caixa.appendChild(document.createTextNode(" "));
          caixa.appendChild(a);
        } else {
          caixa.querySelector("a").textContent = `Ver lista (${lista.length})`;
        }
        setTimeout(() => (b.textContent = rotulo), 2000);
      });
      caixa.appendChild(b);
      return caixa;
    }

    function botaoCopiar(rotulo, obterTexto) {
      const b = el("button", "botao botao-secundario botao-pequeno", rotulo);
      b.type = "button";
      b.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(obterTexto());
          b.textContent = "Copiado!";
        } catch (e) {
          b.textContent = "Não foi possível copiar";
        }
        setTimeout(() => (b.textContent = rotulo), 1600);
      });
      return b;
    }

    function cartao(r) {
      const li = el("li", "resultado cartao");
      const h = el("h3");
      if (r.url) {
        const a = el("a", "", r.titulo);
        a.href = r.url; a.target = "_blank"; a.rel = "noopener noreferrer";
        h.appendChild(a);
      } else h.textContent = r.titulo;
      li.appendChild(h);

      const nomes = r.autores.slice(0, 6).map((a) => a.nome);
      const autoria = nomes.join("; ") + (r.autores.length > 6 ? " et al." : "");
      const meta = [autoria, r.fonte, r.ano].filter(Boolean).join(" · ");
      if (meta) li.appendChild(el("p", "meta", meta));

      const selos = el("p", "selos");
      if (r.fontes) selos.appendChild(el("span", "selo selo-fonte", r.fontes.map((f) => NOMES_FONTE[f]).join(" + ")));
      if (r.tipo) selos.appendChild(el("span", "selo", r.tipo));
      if (r.idioma) selos.appendChild(el("span", "selo", r.idioma.toUpperCase()));
      selos.appendChild(el("span", "selo", `${nf.format(r.citacoes)} citações`));
      if (r.aberto) {
        if (r.urlAberta) {
          const a = el("a", "selo selo-aberto", "Acesso aberto");
          a.href = r.urlAberta; a.target = "_blank"; a.rel = "noopener noreferrer";
          selos.appendChild(a);
        } else selos.appendChild(el("span", "selo selo-aberto", "Acesso aberto"));
      }
      li.appendChild(selos);

      if (r.resumo) {
        const d = el("details", "resumo");
        const s = el("summary", "", "Resumo");
        d.appendChild(s);
        d.appendChild(el("p", "", r.resumo));
        li.appendChild(d);
      }

      const acoes = el("div", "acoes");
      acoes.appendChild(botaoCopiar("Copiar referência (ABNT, rascunho)", () => referenciaAbnt(r)));
      if (r.doi) acoes.appendChild(botaoCopiar("Copiar DOI", () => r.doi));
      acoes.appendChild(botaoLista(r));
      if (r.urlS2) {
        const a = el("a", "botao botao-secundario botao-pequeno", "Ver no Semantic Scholar");
        a.href = r.urlS2; a.target = "_blank"; a.rel = "noopener noreferrer";
        acoes.appendChild(a);
      }
      li.appendChild(acoes);
      return li;
    }

    function mostrarMensagem(texto, tipo) {
      status.className = "mensagem" + (tipo ? " " + tipo : "");
      status.textContent = texto;
      status.hidden = !texto;
    }

    function desenharPaginacao(p, total) {
      paginacao.textContent = "";
      const maxPag = Math.min(Math.ceil(total / POR_PAGINA), Math.ceil(maxRegistrosFontes(p.fontes) / POR_PAGINA));
      if (maxPag <= 1) return;
      const ir = (pag) => { const novo = { ...p, pag }; history.pushState(null, "", paraUrl(novo)); executar(novo); window.scrollTo({ top: form.offsetTop, behavior: "smooth" }); };
      const ant = el("button", "botao botao-secundario", "‹ Anterior");
      ant.type = "button"; ant.disabled = p.pag <= 1; ant.addEventListener("click", () => ir(p.pag - 1));
      const prox = el("button", "botao botao-secundario", "Próxima ›");
      prox.type = "button"; prox.disabled = p.pag >= maxPag; prox.addEventListener("click", () => ir(p.pag + 1));
      paginacao.append(ant, el("span", "pagina-atual", `Página ${nf.format(p.pag)} de ${nf.format(maxPag)}`), prox);
    }

    let controle = null;

    const esperar = (ms, ctl) => new Promise((ok, falha) => {
      const t = setTimeout(ok, ms);
      ctl.signal.addEventListener("abort", () => { clearTimeout(t); falha(new DOMException("abortado", "AbortError")); }, { once: true });
    });

    // A resposta 429 do Semantic Scholar não traz cabeçalho CORS, então o navegador a vê como
    // falha de rede. Por isso tanto o 429 quanto o TypeError contam como "tente de novo".
    async function buscarSemantic(url, ctl, silencioso) {
      const pausas = [1500, 3500];
      for (let tentativa = 0; ; tentativa++) {
        let erro;
        try {
          const r = await fetch(url, { signal: ctl.signal });
          if (r.ok) return await r.json();
          erro = new Error("http"); erro.status = r.status;
          if (r.status !== 429 && r.status < 500) throw erro;
        } catch (e) {
          if (e.name === "AbortError" || (e.status && e.status !== 429 && e.status < 500)) throw e;
          erro = e;
        }
        if (tentativa >= pausas.length) throw erro;
        if (!silencioso) mostrarMensagem(`O Semantic Scholar está ocupado. Tentando de novo (${tentativa + 2} de ${pausas.length + 1})…`, "");
        await esperar(pausas[tentativa], ctl);
      }
    }

    async function executar(p) {
      if (controle) controle.abort();
      lista.textContent = "";
      paginacao.textContent = "";
      if (!p.q) { mostrarMensagem(""); return; }
      controle = new AbortController();
      const meu = controle;
      mostrarMensagem("Buscando…", "");
      const hoje = new Date().toISOString().slice(0, 10);
      let chave = "";
      try { chave = localStorage.getItem(CHAVE_LS) || ""; } catch (e) { /* ok */ }
      if (p.fontes.length > 1) { await executarCombinada(p, meu, hoje, chave); return; }
      try {
        const { total, totalReal, resultados } = await consultar(p.fonte, p, meu, hoje, chave, false);
        if (!resultados.length) {
          mostrarMensagem("Nenhum resultado. Tente menos filtros, outros termos ou outra fonte.", "alerta");
          return;
        }
        const ini = (p.pag - 1) * POR_PAGINA + 1;
        const ignorados = filtrosIgnorados(p);
        let msg = `${nf.format(totalReal)} resultados no ${NOMES_FONTE[p.fonte]}. Mostrando ${nf.format(ini)}–${nf.format(ini + resultados.length - 1)}.`;
        if (totalReal > total) msg += ` O Semantic Scholar só pagina os ${nf.format(MAX_REGISTROS_S2)} primeiros; refine a busca para ver outros.`;
        if (ignorados.length) msg += ` Filtros ignorados nesta fonte: ${ignorados.join(", ")}.`;
        mostrarMensagem(msg, "");
        for (const r of resultados) lista.appendChild(cartao(r));
        desenharPaginacao(p, total);
      } catch (e) {
        if (e.name === "AbortError") return;
        mostrarMensagem(mensagemErro(p.fonte, e), "erro");
      }
    }

    // Consulta uma fonte e devolve { total (paginável), totalReal, resultados normalizados }.
    async function consultar(fonte, p, ctl, hoje, chave, silencioso) {
      const q = { ...p, fonte };
      if (fonte === "semantic") {
        const d = await buscarSemantic(urlSemantic(q, baseSemantic), ctl, silencioso);
        return { total: Math.min(d.total || 0, MAX_REGISTROS_S2), totalReal: d.total || 0, resultados: (d.data || []).map(normalizarSemantic) };
      }
      const url = fonte === "crossref" ? urlCrossref(q, baseCrossref, hoje) : urlOpenAlex(q, baseOpenAlex, chave, hoje);
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) { const e = new Error("http"); e.status = r.status; throw e; }
      const d = await r.json();
      if (fonte === "crossref") {
        const t = d.message["total-results"] || 0;
        return { total: Math.min(t, MAX_REGISTROS), totalReal: t, resultados: (d.message.items || []).map(normalizarCrossref) };
      }
      const t = (d.meta && d.meta.count) || 0;
      return { total: Math.min(t, MAX_REGISTROS), totalReal: t, resultados: (d.results || []).map(normalizarOpenAlex) };
    }

    function mensagemErro(fonte, e) {
      if (fonte === "semantic" && (e.status === 429 || !e.status)) {
        return "O Semantic Scholar recusou a consulta agora: o limite gratuito é dividido entre todos os usuários da internet e estava esgotado (ou a conexão falhou). Espere alguns segundos e busque de novo, ou use outra fonte.";
      }
      if (fonte === "openalex" && (e.status === 429 || e.status === 403)) {
        return "O limite gratuito diário do OpenAlex para a sua rede foi atingido. Você pode tentar o Crossref, voltar amanhã ou colocar uma chave gratuita do OpenAlex em \"Opções avançadas\".";
      }
      if (e.status) return `O ${NOMES_FONTE[fonte]} respondeu com erro (código ${e.status}). Tente novamente em instantes ou use outra fonte.`;
      return `Não foi possível consultar o ${NOMES_FONTE[fonte]} agora. Verifique sua conexão ou tente outra fonte.`;
    }

    async function executarCombinada(p, ctl, hoje, chave) {
      mostrarMensagem(`Buscando em ${juntarNomes(p.fontes.map((f) => NOMES_FONTE[f]))}…`, "");
      const res = await Promise.allSettled(p.fontes.map((f) => consultar(f, p, ctl, hoje, chave, true)));
      if (ctl.signal.aborted) return;
      const ok = [];
      const falhas = [];
      res.forEach((r, i) => {
        if (r.status === "fulfilled") ok.push({ fonte: p.fontes[i], ...r.value });
        else falhas.push({ fonte: p.fontes[i], erro: r.reason || {} });
      });
      if (!ok.length) {
        mostrarMensagem(falhas.map((f) => mensagemErro(f.fonte, f.erro)).join(" "), "erro");
        return;
      }
      const mescla = mesclarResultados(ok.map((o) => ({ fonte: o.fonte, resultados: o.resultados })), p.ord);
      const avisoFalhas = falhas.map((f) =>
        `O ${NOMES_FONTE[f.fonte]} não respondeu${f.fonte === "semantic" ? " (limite compartilhado; tente de novo em alguns segundos)" : ""}.`
      ).join(" ");
      if (!mescla.length) {
        mostrarMensagem(("Nenhum resultado. Tente menos filtros ou outros termos. " + avisoFalhas).trim(), "alerta");
        return;
      }
      const contagens = ok.map((o) => `${NOMES_FONTE[o.fonte]} (${nf.format(o.totalReal)})`);
      let msg = `Busca combinada em ${juntarNomes(contagens)}. Página ${nf.format(p.pag)}: ${nf.format(mescla.length)} obras, sem repetições.`;
      const ign = ok.map((o) => o.fonte)
        .map((f) => { const x = filtrosIgnorados({ ...p, fonte: f }); return x.length ? `no ${NOMES_FONTE[f]}, ${x.join(", ")}` : ""; })
        .filter(Boolean);
      if (ign.length) msg += ` Filtros ignorados: ${ign.join("; ")}.`;
      if (avisoFalhas) msg += " " + avisoFalhas;
      mostrarMensagem(msg, falhas.length ? "alerta" : "");
      for (const r of mescla) lista.appendChild(cartao(r));
      desenharPaginacao(p, Math.max(...ok.map((o) => o.total)));
    }

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const p = lerFormulario();
      history.pushState(null, "", paraUrl(p) || location.pathname);
      executar(p);
      atualizarOutrasBases();
    });
    caixaFontes.addEventListener("change", (ev) => {
      if (!fontesMarcadas().length) ev.target.checked = true; // pelo menos uma fonte
      atualizarFonte();
    });
    form.addEventListener("input", atualizarOutrasBases);
    window.addEventListener("popstate", () => {
      const p = lerDaUrl(location.search);
      escreverFormulario(p);
      executar(p);
      atualizarOutrasBases();
    });

    const inicial = lerDaUrl(location.search);
    escreverFormulario(inicial);
    atualizarOutrasBases();
    executar(inicial);
  });
}
