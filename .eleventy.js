module.exports = function (eleventyConfig) {
  // Arquivos copiados como estão para o site final
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy({ "src/static": "/" }); // robots.txt, favicon, CNAME, ads.txt

  // Data atual (usada no rodapé e na política de privacidade)
  eleventyConfig.addFilter("ano", () => new Date().getFullYear());

  // Depois do build: gera favicons e a imagem de compartilhamento a partir de fonte/ (scripts/gerar-imagens.js).
  // Se falhar, o site é publicado do mesmo jeito, só sem essas imagens.
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    try {
      await require("./scripts/gerar-imagens.js").gerar(dir.output);
    } catch (e) {
      console.warn("[imagens] não foi possível gerar:", e.message);
    }
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
