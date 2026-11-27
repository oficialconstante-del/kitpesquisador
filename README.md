# Kit Pesquisador (kitpesquisador.com.br)

Site estático (Eleventy) com buscador acadêmico e ferramentas gratuitas para estudantes e pesquisadores. Tudo roda no navegador, sem backend.

## Buscador acadêmico (página inicial)

- Consulta OpenAlex e Crossref direto do navegador, com filtros de ano, tipo, idioma, área, acesso aberto e país.
- Google Acadêmico, SciELO, BDTD, PhilPapers, JSTOR e outras bases abrem em nova aba com a busca preenchida (não têm API pública).
- OpenAlex exige chave de API desde fev/2026; sem chave, o limite diário compartilhado é baixo. O visitante pode colar a própria chave (fica só no navegador dele). Nunca coloque uma chave pessoal no repositório.
- AdSense está desativado por enquanto (`adsenseClient` vazio em `src/_data/site.json`).

## Ferramentas

- Contador de palavras e caracteres
- Calculadora de média ponderada e nota necessária

A lógica fica em `src/js/` e é testada com `npm test` (51 testes).

## Rodar no computador

```bash
npm install
npm start        # http://localhost:8080
npm test
npm run build    # gera a pasta _site
```

## Estrutura

- `src/_includes/base.njk`: layout comum de todas as páginas (cabeçalho e rodapé em arquivos próprios)
- `src/css/estilo.css`: único estilo; cores e formas em `:root`
- `src/js/`: um arquivo por ferramenta
- `src/_data/site.json`: nome, URL, e-mail, AdSense
- `.github/workflows/pages.yml`: publica no GitHub Pages a cada push na `main`

## Domínio próprio

1. Settings → Pages → Custom domain: `kitpesquisador.com.br` (o arquivo `src/static/CNAME` já existe).
2. No registro.br, crie registros A apontando para os IPs do GitHub Pages (veja a documentação "Managing a custom domain for your GitHub Pages site") e um CNAME de `www` para `SEU-USUARIO.github.io`.
3. Aguarde a verificação do DNS e marque Enforce HTTPS.

## Antes de pedir o AdSense

- [ ] Reescrever Sobre (formação e Lattes).
- [ ] Revisar Privacidade e Termos (rascunhos).
- [ ] Trocar e-mail e nome em site.json.
- [ ] Publicar artigos de apoio e remover semindexar de src/artigos/index.njk.
- [ ] Banner de consentimento de cookies (LGPD).
- [ ] Preencher adsenseClient e os slots dos anúncios.
