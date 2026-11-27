/* Alternância entre modo claro e escuro. A preferência fica só neste navegador. */
(function () {
  "use strict";
  var CHAVE = "kp_tema";
  var raiz = document.documentElement;
  var botao = document.getElementById("botao-tema");
  if (!botao) return;

  function escuroAtivo() { return raiz.getAttribute("data-tema") === "escuro"; }

  function atualizarBotao() {
    var escuro = escuroAtivo();
    botao.textContent = escuro ? "Modo claro" : "Modo escuro";
    botao.setAttribute("aria-pressed", escuro ? "true" : "false");
    botao.setAttribute("aria-label", escuro ? "Mudar para o modo claro" : "Mudar para o modo escuro");
  }

  botao.addEventListener("click", function () {
    var novo = escuroAtivo() ? "claro" : "escuro";
    if (novo === "escuro") raiz.setAttribute("data-tema", "escuro");
    else raiz.removeAttribute("data-tema");
    try { localStorage.setItem(CHAVE, novo); } catch (e) { /* armazenamento indisponível */ }
    atualizarBotao();
  });

  botao.hidden = false;
  atualizarBotao();
})();
