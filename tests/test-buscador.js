// Testes da lógica do buscador acadêmico. Rode com: npm test
const assert = require("node:assert/strict");
const B = require("../src/js/buscador.js");

let ok = 0;
function teste(nome, fn) { fn(); ok++; console.log("ok -", nome); }

const OA = "https://api.openalex.org";
const CR = "https://api.crossref.org";
const base = (extra) => B.normalizarParametros({ q: "historiografia", ...extra });

// ---------- parâmetros ----------
teste("parâmetros padrão e saneamento", () => {
  const p = B.normalizarParametros({});
  assert.deepEqual(p, B.PADRAO);
  const q = B.normalizarParametros({ q: "  a   b  ", de: "2020", ate: "2010", tipo: "xyz", idioma: "klingon", pag: "-3", ord: "x", fonte: "google" });
  assert.equal(q.q, "a b");
  assert.equal(q.de, "2010");   // anos invertidos são trocados
  assert.equal(q.ate, "2020");
  assert.equal(q.tipo, "");
  assert.equal(q.idioma, "");
  assert.equal(q.pag, 1);
  assert.equal(q.ord, "relevancia");
  assert.equal(q.fonte, "openalex");
});
teste("anos fora do intervalo são descartados", () => {
  assert.equal(B.normalizarParametros({ de: "20", ate: "99999" }).de, "");
  assert.equal(B.normalizarParametros({ de: "20", ate: "99999" }).ate, "");
});
teste("página é limitada ao máximo da API", () => {
  assert.equal(B.normalizarParametros({ pag: "999999" }).pag, 400);
});
teste("ida e volta pela URL da página", () => {
  const p = base({ de: "2010", ate: "2020", tipo: "artigo", idioma: "pt", area: "sub:1202", oa: true, br: true, campo: "tudo", ord: "citacoes", pag: 3, fonte: "crossref" });
  const volta = B.lerDaUrl(B.paraUrl(p));
  assert.deepEqual(volta, p);
});
teste("URL da página omite valores padrão", () => {
  assert.equal(B.paraUrl(base({})), "?q=historiografia");
  assert.equal(B.paraUrl(B.normalizarParametros({})), "");
});
teste("entrada maliciosa na URL é neutralizada", () => {
  const p = B.lerDaUrl("?q=%3Cscript%3E&tipo=%3Cimg%3E&area=campo:99&idioma=pt%2Cen");
  assert.equal(p.tipo, "");
  assert.equal(p.area, "");
  assert.equal(p.idioma, "");
});

// ---------- URL do OpenAlex ----------
teste("OpenAlex: busca simples em título e resumo", () => {
  const u = B.urlOpenAlex(base({}), OA, "", "2026-11-26");
  assert.ok(u.startsWith(`${OA}/works?filter=title_and_abstract.search:historiografia&per_page=25&page=1&select=id,doi,`));
  assert.ok(!u.includes("api_key"));
  assert.ok(!u.includes("sort="));
});
teste("OpenAlex: texto completo usa search=", () => {
  const u = B.urlOpenAlex(base({ campo: "tudo" }), OA, "", "2026-11-26");
  assert.ok(u.startsWith(`${OA}/works?search=historiografia&per_page=25`));
  assert.ok(!u.includes("filter="));
});
teste("OpenAlex: todos os filtros, com vírgulas literais", () => {
  const p = base({ de: "2015", ate: "2024", tipo: "artigo", idioma: "pt", oa: true, br: true, area: "sub:1202", ord: "citacoes", pag: 2 });
  const u = B.urlOpenAlex(p, OA, "", "2026-11-26");
  const filtro = u.match(/filter=([^&]*)/)[1];
  assert.equal(filtro, "publication_year:2015-2024,type:article,language:pt,is_oa:true,authorships.institutions.country_code:BR,primary_topic.subfield.id:1202,title_and_abstract.search:historiografia");
  assert.ok(u.includes("sort=cited_by_count:desc"));
  assert.ok(u.includes("page=2"));
});
teste("OpenAlex: campo (field) e subárea", () => {
  assert.ok(B.urlOpenAlex(base({ area: "campo:12" }), OA, "", "").includes("primary_topic.field.id:12"));
  assert.ok(B.urlOpenAlex(base({ area: "sub:1211" }), OA, "", "").includes("primary_topic.subfield.id:1211"));
});
teste("OpenAlex: só ano inicial ou só final", () => {
  assert.ok(B.urlOpenAlex(base({ de: "2010" }), OA, "", "").includes("publication_year:>2009"));
  assert.ok(B.urlOpenAlex(base({ ate: "2010" }), OA, "", "").includes("publication_year:<2011"));
});
teste("OpenAlex: 'mais recentes' ignora datas futuras", () => {
  const u = B.urlOpenAlex(base({ ord: "recentes" }), OA, "", "2026-11-26");
  assert.ok(u.includes("to_publication_date:2026-11-26"));
  assert.ok(u.includes("sort=publication_date:desc"));
  assert.ok(B.urlOpenAlex(base({ ord: "antigos" }), OA, "", "2026-11-26").includes("sort=publication_date:asc"));
});
teste("OpenAlex: vírgula, barra e dois-pontos no termo não quebram o filtro", () => {
  const u = B.urlOpenAlex(base({ q: 'Popper, Kuhn | Lakatos: "método"' }), OA, "", "");
  const filtro = u.match(/filter=([^&]*)/)[1];
  assert.equal(filtro, `title_and_abstract.search:${encodeURIComponent('Popper Kuhn Lakatos "método"')}`);
  assert.ok(!filtro.includes("%2C"));
});
teste("OpenAlex: acentos e espaços são codificados; chave vai por último", () => {
  const u = B.urlOpenAlex(base({ q: "filosofia da ciência", campo: "tudo" }), OA + "/", "abc 123", "");
  assert.ok(u.includes("search=filosofia%20da%20ci%C3%AAncia"));
  assert.ok(u.endsWith("&api_key=abc%20123"));
  assert.ok(u.startsWith(`${OA}/works?`)); // sem barra dupla
});

// ---------- URL do Crossref ----------
teste("Crossref: busca com filtros e ordenação", () => {
  const p = base({ de: "2015", ate: "2024", tipo: "artigo", ord: "citacoes", pag: 3, fonte: "crossref" });
  const u = B.urlCrossref(p, CR, "2026-11-26");
  assert.ok(u.startsWith(`${CR}/works?query=historiografia&filter=from-pub-date:2015,until-pub-date:2024,type:journal-article&sort=is-referenced-by-count&order=desc&rows=25&offset=50&select=DOI,`));
  assert.ok(!u.includes("language"));
});
teste("Crossref: 'recentes' limita à data de hoje; livro vira monograph", () => {
  const u = B.urlCrossref(base({ ord: "recentes", tipo: "livro", fonte: "crossref" }), CR, "2026-11-26");
  assert.ok(u.includes("until-pub-date:2026-11-26"));
  assert.ok(u.includes("type:monograph"));
  assert.ok(u.includes("sort=published&order=desc"));
});
teste("Crossref: lista de filtros ignorados", () => {
  assert.deepEqual(B.filtrosIgnoradosCrossref(base({ idioma: "pt", oa: true, br: true, area: "sub:1202" })), ["idioma", "área", "acesso aberto", "instituição no Brasil"]);
  assert.deepEqual(B.filtrosIgnoradosCrossref(base({})), []);
});

// ---------- normalização ----------
const FIX_OA = {
  id: "https://openalex.org/W2907439057",
  doi: "https://doi.org/10.1590/s0104-59702018000500008",
  title: "Gênero, história e medicalização do parto: a exposição “Mulheres e práticas de saúde”",
  publication_year: 2018, type: "article", language: "pt", cited_by_count: 276,
  open_access: { is_oa: true, oa_url: "http://www.scielo.br/pdf/hcsm/v25n4/0104-5970-hcsm-25-04-1039.pdf" },
  primary_location: { landing_page_url: "https://doi.org/10.1590/s0104-59702018000500008", pdf_url: null, source: { display_name: "História Ciências Saúde-Manguinhos" } },
  authorships: [
    { author: { display_name: "Luciana Aparecida Palharini" } },
    { author: { display_name: "Sílvia Fernanda de Mendonça Figueirôa" } },
  ],
  biblio: { volume: "25", issue: "4", first_page: "1039", last_page: "1061" },
  abstract_inverted_index: { With: [0], the: [1, 4], institutionalization: [2], of: [3], medicine: [5] },
};
const FIX_CR = {
  issue: "87", DOI: "10.1590/1806-93472021v42n87-03", type: "journal-article", page: "13-36", "is-referenced-by-count": 23,
  title: ["NEGACIONISMO: HISTÓRIA, HISTORIOGRAFIA E PERSPECTIVAS DE PESQUISA"], volume: "42",
  author: [{ given: "Patrícia", family: "Valim" }, { given: "Alexandre de Sá", family: "Avelar" }, { given: "Berber", family: "Bevernage" }],
  "container-title": ["Revista Brasileira de História"], issued: { "date-parts": [[2021, 4]] },
  abstract: "<jats:title>Abstract</jats:title><jats:p>Este artigo &amp; aquele.</jats:p>",
};

teste("reconstruir resumo a partir do índice invertido", () => {
  assert.equal(B.reconstruirResumo(FIX_OA.abstract_inverted_index), "With the institutionalization of the medicine");
  assert.equal(B.reconstruirResumo(null), "");
  assert.equal(B.reconstruirResumo({ a: [1], b: [3] }), "a b"); // posições faltando não geram "undefined"
});
teste("OpenAlex normalizado", () => {
  const r = B.normalizarOpenAlex(FIX_OA);
  assert.equal(r.doi, "10.1590/s0104-59702018000500008");
  assert.equal(r.titulo.startsWith("Gênero, história"), true);
  assert.equal(r.autores.length, 2);
  assert.equal(r.fonte, "História Ciências Saúde-Manguinhos");
  assert.equal(r.ano, 2018);
  assert.equal(r.tipo, "Artigo");
  assert.equal(r.aberto, true);
  assert.equal(r.urlAberta.startsWith("http://www.scielo.br"), true);
  assert.equal(r.paginas, "1039-1061");
  assert.equal(r.citacoes, 276);
  assert.equal(r.url, "https://doi.org/10.1590/s0104-59702018000500008");
});
teste("OpenAlex: registro mínimo não quebra", () => {
  const r = B.normalizarOpenAlex({ id: "https://openalex.org/W1" });
  assert.equal(r.titulo, "(sem título)");
  assert.deepEqual(r.autores, []);
  assert.equal(r.ano, null);
  assert.equal(r.citacoes, 0);
  assert.equal(r.url, "https://openalex.org/W1");
});
teste("Crossref normalizado", () => {
  const r = B.normalizarCrossref(FIX_CR);
  assert.equal(r.doi, "10.1590/1806-93472021v42n87-03");
  assert.equal(r.ano, 2021);
  assert.equal(r.fonte, "Revista Brasileira de História");
  assert.equal(r.autores[1].sobrenome, "Avelar");
  assert.equal(r.resumo, "Este artigo & aquele.");
  assert.equal(r.url, "https://doi.org/10.1590/1806-93472021v42n87-03");
  assert.equal(r.tipo, "Artigo");
});
teste("Crossref: registro mínimo não quebra", () => {
  const r = B.normalizarCrossref({});
  assert.equal(r.titulo, "(sem título)");
  assert.equal(r.url, "");
  assert.equal(r.ano, null);
});
teste("limpeza de resumo JATS", () => {
  assert.equal(B.limparJats("<jats:p>Resumo: texto  <b>forte</b>.</jats:p>"), "texto forte .");
  assert.equal(B.limparJats(undefined), "");
});
teste("somente URLs http(s) são aceitas como link", () => {
  assert.equal(B.urlSegura("javascript:alert(1)"), "");
  assert.equal(B.urlSegura("data:text/html,x"), "");
  assert.equal(B.urlSegura(" https://exemplo.org/a "), "https://exemplo.org/a");
  assert.equal(B.normalizarOpenAlex({ id: "x", primary_location: { landing_page_url: "javascript:alert(1)" } }).url, "");
});

// ---------- ABNT ----------
teste("nome ABNT", () => {
  assert.equal(B.formatarNomeAbnt({ nome: "Luciana Aparecida Palharini" }), "PALHARINI, Luciana Aparecida");
  assert.equal(B.formatarNomeAbnt({ nome: "João Silva Júnior" }), "SILVA JÚNIOR, João");
  assert.equal(B.formatarNomeAbnt({ nome: "Platão" }), "PLATÃO");
  assert.equal(B.formatarNomeAbnt({ nome: "Ministério da Educação", entidade: true }), "MINISTÉRIO DA EDUCAÇÃO");
  assert.equal(B.formatarNomeAbnt({ nome: "Alexandre de Sá Avelar", dado: "Alexandre de Sá", sobrenome: "Avelar" }), "AVELAR, Alexandre de Sá");
});
teste("referência ABNT de artigo com 2 autores", () => {
  const ref = B.referenciaAbnt(B.normalizarOpenAlex(FIX_OA));
  assert.equal(ref, "PALHARINI, Luciana Aparecida; FIGUEIRÔA, Sílvia Fernanda de Mendonça. Gênero, história e medicalização do parto: a exposição “Mulheres e práticas de saúde”. História Ciências Saúde-Manguinhos, v. 25, n. 4, p. 1039-1061, 2018. DOI: 10.1590/s0104-59702018000500008.");
});
teste("referência ABNT: mais de três autores usa et al.; título em caixa alta é ajustado", () => {
  const ref = B.referenciaAbnt(B.normalizarCrossref({ ...FIX_CR, author: [...FIX_CR.author, { given: "Ana", family: "Souza" }] }));
  assert.ok(ref.startsWith("VALIM, Patrícia et al. Negacionismo: história, historiografia e perspectivas de pesquisa. Revista Brasileira de História, v. 42, n. 87, p. 13-36, 2021."));
});
teste("referência ABNT sem autor começa pela primeira palavra do título em maiúsculas", () => {
  const ref = B.referenciaAbnt({ titulo: "Anais do congresso.", autores: [], fonte: "", ano: 2020, tipo: "Livro", doi: "", url: "https://exemplo.org/x", volume: "", numero: "", paginas: "" });
  assert.equal(ref, "ANAIS do congresso. 2020. Disponível em: https://exemplo.org/x.");
});
teste("referência ABNT de livro não leva volume/páginas", () => {
  const ref = B.referenciaAbnt({ titulo: "A estrutura das revoluções científicas", autores: [{ nome: "Thomas Kuhn" }], fonte: "Perspectiva", ano: 1962, tipo: "Livro", doi: "", url: "", volume: "1", numero: "2", paginas: "10" });
  assert.equal(ref, "KUHN, Thomas. A estrutura das revoluções científicas. Perspectiva, 1962.");
});

// ---------- outras bases ----------
teste("links para outras bases", () => {
  const bases = B.urlsOutrasBases(base({ q: "filosofia da ciência", de: "2000", ate: "2020", idioma: "pt" }));
  const por = Object.fromEntries(bases.map((b) => [b.nome, b.url]));
  assert.equal(por["Google Acadêmico"], "https://scholar.google.com/scholar?hl=pt-BR&q=filosofia%20da%20ci%C3%AAncia&as_ylo=2000&as_yhi=2020&lr=lang_pt");
  assert.equal(por["PhilPapers"], "https://philpapers.org/s/filosofia%20da%20ci%C3%AAncia");
  assert.ok(por["SciELO"].includes("q=filosofia%20da%20ci%C3%AAncia"));
  assert.ok(por["BDTD"].includes("lookfor=filosofia%20da%20ci%C3%AAncia"));
  assert.equal(bases.length, 8);
  for (const b of bases) assert.ok(b.url.startsWith("https://"));
});

console.log(`\n${ok} testes do buscador passaram.`);
