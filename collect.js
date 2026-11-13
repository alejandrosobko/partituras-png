// Se ejecuta dentro de la pestaña de MuseScore (vía chrome.scripting).
// Debe ser autocontenida: Chrome la serializa y la inyecta en la página.
// eslint-disable-next-line no-unused-vars
async function collectScorePages() {
  // score_3.svg / score_3.png, pero no miniaturas tipo score_0.png@280
  const PAGE_RE = /score_(\d+)\.(svg|png)(?![@\w])/;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pages = new Map();

  const grab = () => {
    const urls = [
      ...performance.getEntriesByType('resource').map((entry) => entry.name),
      ...Array.from(document.images, (img) => img.currentSrc || img.src),
    ];
    for (const url of urls) {
      const match = url.match(PAGE_RE);
      if (!match) continue;
      const n = Number(match[1]);
      const ext = match[2];
      const prev = pages.get(n);
      // Preferimos SVG (vectorial) sobre PNG; entre iguales, la URL más nueva (firma vigente).
      if (prev && prev.ext === 'svg' && ext === 'png') continue;
      pages.set(n, { url, ext });
    }
  };

  const findScroller = () => {
    const firstPage = Array.from(document.images).find((img) => PAGE_RE.test(img.currentSrc || img.src));
    for (let el = firstPage?.parentElement; el; el = el.parentElement) {
      const overflow = getComputedStyle(el).overflowY;
      if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight + 10) return el;
    }
    return document.scrollingElement;
  };

  grab();

  // El visor carga las páginas a medida que aparecen: recorremos la partitura para que se carguen todas.
  const scroller = findScroller();
  const startTop = scroller.scrollTop;
  const step = Math.max(300, scroller.clientHeight * 0.7);
  for (let i = 0; i < 200; i++) {
    const before = scroller.scrollTop;
    scroller.scrollTop = before + step;
    await sleep(350);
    grab();
    if (scroller.scrollTop === before) break;
  }
  await sleep(1200);
  grab();
  scroller.scrollTop = startTop;

  const title = document.querySelector('meta[property="og:title"]')?.content || document.title || 'partitura';
  return {
    title,
    pages: [...pages.entries()].sort((a, b) => a[0] - b[0]).map(([n, page]) => ({ n, ...page })),
  };
}
