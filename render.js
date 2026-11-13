// Convierte una página (SVG o PNG) a imagen del ancho pedido.
// El SVG se re-dimensiona antes de rasterizar: el navegador lo dibuja directo a ese tamaño
// (en vez de achicar una imagen gigante, que es lo que lo dejaba feo).

// MuseScore exporta los SVG a 360 px por pulgada (Carta = 3060 px de ancho).
const MUSESCORE_SVG_DPI = 360;

function parseSvg(svgText) {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svg = doc.documentElement;
  if (svg.nodeName !== 'svg') throw new Error('El archivo no es un SVG válido');

  let viewBox = svg.getAttribute('viewBox');
  if (!viewBox) {
    const w = parseFloat(svg.getAttribute('width'));
    const h = parseFloat(svg.getAttribute('height'));
    if (!w || !h) throw new Error('El SVG no tiene tamaño');
    viewBox = `0 0 ${w} ${h}`;
    svg.setAttribute('viewBox', viewBox);
  }
  const [, , vbWidth, vbHeight] = viewBox.trim().split(/[\s,]+/).map(Number);
  return { svg, vbWidth, vbHeight };
}

// Tamaño natural de la página (en px de origen).
function pageNaturalSize(source) {
  if (source.ext === 'svg') {
    const { vbWidth, vbHeight } = parseSvg(source.text);
    return { width: vbWidth, height: vbHeight, dpi: MUSESCORE_SVG_DPI };
  }
  return { width: source.naturalWidth, height: source.naturalHeight, dpi: null };
}

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo dibujar la imagen'));
    };
    img.src = url;
  });
}

// source: { ext: 'svg', text } | { ext: 'png', blob, naturalWidth, naturalHeight }
async function renderPageCanvas(source, width) {
  let blob;
  let height;
  if (source.ext === 'svg') {
    const { svg, vbWidth, vbHeight } = parseSvg(source.text);
    height = Math.round((width * vbHeight) / vbWidth);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
  } else {
    blob = source.blob;
  }

  const { img, url } = await loadImage(blob);
  try {
    if (!height) height = Math.round((width * img.naturalHeight) / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function renderPagePng(source, width) {
  const canvas = await renderPageCanvas(source, width);
  const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return { blob: png, width: canvas.width, height: canvas.height };
}
