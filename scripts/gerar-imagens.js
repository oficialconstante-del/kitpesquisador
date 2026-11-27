// Gera favicons e a imagem de compartilhamento (og-image) a partir da logo em fonte/.
// Roda automaticamente depois do build do Eleventy (veja .eleventy.js).
// Se algo falhar (por exemplo, sem a logo), o site continua sendo publicado sem essas imagens.
const fs = require("node:fs");
const path = require("node:path");

const PASTA_FONTE = path.join(__dirname, "..", "fonte");

function acharLogo() {
  if (!fs.existsSync(PASTA_FONTE)) return null;
  const arq = fs.readdirSync(PASTA_FONTE).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort()[0];
  return arq ? path.join(PASTA_FONTE, arq) : null;
}

// Um arquivo .ico pode conter PNG: cabeçalho de 22 bytes + a imagem.
function icoComPng(png, lado) {
  const h = Buffer.alloc(22);
  h.writeUInt16LE(0, 0); h.writeUInt16LE(1, 2); h.writeUInt16LE(1, 4);
  h.writeUInt8(lado >= 256 ? 0 : lado, 6); h.writeUInt8(lado >= 256 ? 0 : lado, 7);
  h.writeUInt8(0, 8); h.writeUInt8(0, 9);
  h.writeUInt16LE(1, 10); h.writeUInt16LE(32, 12);
  h.writeUInt32LE(png.length, 14); h.writeUInt32LE(22, 18);
  return Buffer.concat([h, png]);
}

async function gerar(pastaSaida) {
  const logo = acharLogo();
  if (!logo) { console.warn("[imagens] Nenhuma logo em fonte/; pulando."); return; }
  const sharp = require("sharp");

  const base = sharp(logo);
  const meta = await base.metadata();
  const { data: cantos } = await sharp(logo).extract({ left: 0, top: 0, width: 4, height: 4 }).raw().toBuffer({ resolveWithObject: true });
  const fundo = { r: cantos[0], g: cantos[1], b: cantos[2] };

  // Ícone (livro + lupa + capelo): recorta a parte à direita de "Kit", acima de "Pesquisador",
  // tira as margens e centraliza num quadrado.
  const esq = Math.round(meta.width * 0.455);
  const faixa = await sharp(logo)
    .extract({ left: esq, top: 0, width: meta.width - esq, height: Math.round(meta.height * 0.6) })
    .toBuffer();
  const parteIcone = await sharp(faixa).trim({ background: fundo, threshold: 25 }).toBuffer();
  const mi = await sharp(parteIcone).metadata();
  const lado = Math.round(Math.max(mi.width, mi.height) * 1.12);
  const icone = await sharp(parteIcone)
    .extend({
      top: Math.floor((lado - mi.height) / 2), bottom: Math.ceil((lado - mi.height) / 2),
      left: Math.floor((lado - mi.width) / 2), right: Math.ceil((lado - mi.width) / 2),
      background: fundo
    })
    .flatten({ background: fundo })
    .toBuffer();

  const png = (lado2) => sharp(icone).resize(lado2, lado2, { fit: "cover" }).png({ compressionLevel: 9 }).toBuffer();
  fs.mkdirSync(pastaSaida, { recursive: true });
  const f32 = await png(32), f48 = await png(48), f180 = await png(180), f192 = await png(192), f512 = await png(512);
  fs.writeFileSync(path.join(pastaSaida, "favicon-32.png"), f32);
  fs.writeFileSync(path.join(pastaSaida, "favicon.ico"), icoComPng(f48, 48));
  fs.writeFileSync(path.join(pastaSaida, "apple-touch-icon.png"), f180);
  fs.writeFileSync(path.join(pastaSaida, "icon-192.png"), f192);
  fs.writeFileSync(path.join(pastaSaida, "icon-512.png"), f512);

  // Imagem de compartilhamento 1200x630: a logo inteira, sem as margens, centralizada.
  const recorte = await sharp(logo).trim({ background: fundo, threshold: 25 }).toBuffer();
  const logoMeio = await sharp(recorte).resize({ width: 980, height: 470, fit: "inside" }).toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: fundo } })
    .composite([{ input: logoMeio, gravity: "centre" }])
    .png({ palette: true, quality: 85 })
    .toFile(path.join(pastaSaida, "og-image.png"));

  console.log("[imagens] favicons e og-image gerados.");
}

module.exports = { gerar, icoComPng };

if (require.main === module) {
  gerar(process.argv[2] || path.join(__dirname, "..", "_site")).catch((e) => { console.error(e); process.exit(1); });
}
