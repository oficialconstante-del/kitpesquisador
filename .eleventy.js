module.exports = function (eleventyConfig) {
  // Arquivos copiados como estão para o site final
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy({ "src/static": "/" }); // robots.txt, favicon, CNAME, ads.txt

  // Data atual (usada no rodapé e na política de privacidade)
  eleventyConfig.addFilter("ano", () => new Date().getFullYear());

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
