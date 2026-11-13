// Arma un PDF con una página por imagen, sin librerías.
// Cada página es una imagen en escala de grises comprimida sin pérdida (FlateDecode).

const PDF_DPI = 300;
const DEFAULT_PAGE_WIDTH_PT = 612; // Carta, para páginas que no vienen de SVG

async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function canvasToGray(canvas) {
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
    gray[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }
  return gray;
}

// Texto para el diccionario /Info: UTF-16BE en hex, así soporta acentos.
function pdfTextString(text) {
  let hex = 'FEFF';
  for (const ch of text) {
    const code = ch.codePointAt(0);
    const units = code > 0xffff
      ? [0xd800 + ((code - 0x10000) >> 10), 0xdc00 + ((code - 0x10000) & 0x3ff)]
      : [code];
    for (const unit of units) hex += unit.toString(16).padStart(4, '0').toUpperCase();
  }
  return `<${hex}>`;
}

// pages: [{ widthPt, heightPt, widthPx, heightPx, data }] (data = gris deflateado)
function buildPdf(pages, title) {
  const encoder = new TextEncoder();
  const parts = [];
  const offsets = [];
  let length = 0;
  const write = (chunk) => {
    const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (n, ...chunks) => {
    offsets[n] = length;
    write(`${n} 0 obj\n`);
    chunks.forEach(write);
    write('\nendobj\n');
  };
  const num = (x) => Number(x.toFixed(2)).toString();

  write('%PDF-1.4\n');
  write(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // marca de archivo binario

  // 1 = catálogo, 2 = árbol de páginas, 3 = info; luego 3 objetos por página.
  const pageObj = (i) => 4 + i * 3;
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  object(3, `<< /Title ${pdfTextString(title)} /Producer (Partituras a PNG) >>`);

  pages.forEach((page, i) => {
    const [p, c, img] = [pageObj(i), pageObj(i) + 1, pageObj(i) + 2];
    const w = num(page.widthPt);
    const h = num(page.heightPt);
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    object(p, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${c} 0 R >>`);
    object(c, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    object(
      img,
      `<< /Type /XObject /Subtype /Image /Width ${page.widthPx} /Height ${page.heightPx} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${page.data.length} >>\nstream\n`,
      page.data,
      '\nendstream',
    );
  });

  const xrefOffset = length;
  const count = offsets.length;
  write(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) write(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  write(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(parts, { type: 'application/pdf' });
}

// sources: [{ ext, text | blob, naturalWidth, naturalHeight }] en orden.
async function renderPdf(sources, title, onProgress = () => {}) {
  const pages = [];
  for (const [i, source] of sources.entries()) {
    onProgress(i + 1, sources.length);
    const natural = pageNaturalSize(source);
    const widthPt = natural.dpi ? (natural.width * 72) / natural.dpi : DEFAULT_PAGE_WIDTH_PT;
    const heightPt = (widthPt * natural.height) / natural.width;
    const canvas = await renderPageCanvas(source, Math.round((widthPt / 72) * PDF_DPI));
    pages.push({
      widthPt,
      heightPt,
      widthPx: canvas.width,
      heightPx: canvas.height,
      data: await deflate(canvasToGray(canvas)),
    });
  }
  return buildPdf(pages, title);
}
