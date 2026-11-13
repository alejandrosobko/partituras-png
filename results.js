const $ = (id) => document.getElementById(id);
const pages = []; // { n, ext, source, png, previewUrl, card }
let title = 'partitura';

function safeName(text) {
  return text.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'partitura';
}

function setStatus(text, isError = false) {
  $('status').textContent = text;
  $('status').className = isError ? 'error' : 'muted';
}

async function fetchSource(page) {
  const response = await fetch(page.url);
  if (!response.ok) {
    throw new Error(response.status === 403
      ? 'el link venció; volvé a tocar el botón en la partitura'
      : `error ${response.status}`);
  }
  if (page.ext === 'svg') return { ext: 'svg', text: await response.text() };
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const source = { ext: 'png', blob, naturalWidth: bitmap.width, naturalHeight: bitmap.height };
  bitmap.close();
  return source;
}

function buildCard(page) {
  const card = document.createElement('div');
  card.className = 'page';
  card.innerHTML = '<img alt=""><div class="row"><span class="muted"></span><button class="secondary">Descargar</button></div>';
  card.querySelector('span').textContent = `Página ${page.n + 1}`;
  card.querySelector('button').addEventListener('click', () => download(page));
  $('grid').appendChild(card);
  return card;
}

async function renderAll() {
  const width = Math.round(Number($('width').value));
  if (!width || width < 200 || width > 6000) return;
  for (const page of pages) {
    if (!page.source) continue;
    try {
      page.png = await renderPagePng(page.source, width);
      if (page.previewUrl) URL.revokeObjectURL(page.previewUrl);
      page.previewUrl = URL.createObjectURL(page.png.blob);
      page.card.querySelector('img').src = page.previewUrl;
      page.card.querySelector('span').textContent =
        `Página ${page.n + 1} · ${page.png.width}×${page.png.height}${page.ext === 'png' ? ' (de PNG)' : ''}`;
    } catch (error) {
      page.card.querySelector('span').textContent = `Página ${page.n + 1}: ${error.message}`;
    }
  }
}

async function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({ url, filename });
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function download(page) {
  if (!page.png) return;
  const name = safeName(title);
  await saveBlob(page.png.blob, `${name}/${name} - p${page.n + 1}.png`);
}

async function downloadPdf() {
  const button = $('downloadPdf');
  const ready = pages.filter((p) => p.source);
  if (!ready.length) return;
  button.disabled = true;
  try {
    const pdf = await renderPdf(ready.map((p) => p.source), title, (i, total) => {
      button.textContent = `Generando PDF ${i}/${total}…`;
    });
    await saveBlob(pdf, `${safeName(title)}.pdf`);
  } catch (error) {
    setStatus(`No pude generar el PDF: ${error.message}`, true);
  } finally {
    button.textContent = 'Descargar PDF';
    button.disabled = false;
  }
}

async function init() {
  const key = new URLSearchParams(location.search).get('k');
  const stored = key ? (await chrome.storage.session.get(key))[key] : null;
  if (!stored) return setStatus('No hay datos. Abrí una partitura y tocá el botón de la extensión.', true);
  if (stored.error) return setStatus(stored.error, true);

  title = stored.title;
  $('title').textContent = title;
  document.title = `${title} · PNG`;
  if (!stored.pages.length) {
    return setStatus('No encontré páginas de la partitura. Esperá a que cargue, scrolleala una vez y volvé a tocar el botón.', true);
  }

  // Bajamos todo de inmediato: los links firmados de MuseScore vencen a los 5 minutos.
  setStatus(`Bajando ${stored.pages.length} página(s)…`);
  for (const p of stored.pages) {
    const page = { ...p };
    page.card = buildCard(page);
    pages.push(page);
  }
  await Promise.all(pages.map(async (page) => {
    try {
      page.source = await fetchSource(page);
    } catch (error) {
      page.card.querySelector('span').textContent = `Página ${page.n + 1}: ${error.message}`;
    }
  }));

  const missing = [];
  const last = pages[pages.length - 1].n;
  for (let n = 0; n <= last; n++) if (!pages.some((p) => p.n === n)) missing.push(n + 1);
  const ok = pages.filter((p) => p.source).length;
  setStatus(`${ok} página(s) listas.` + (missing.length
    ? ` Faltan las páginas ${missing.join(', ')}: scrolleá la partitura entera y volvé a tocar el botón.`
    : ' Si la partitura tiene más páginas, scrolleala hasta el final y volvé a tocar el botón.'));

  $('bar').hidden = false;
  await renderAll();
}

$('width').addEventListener('change', renderAll);
$('downloadPdf').addEventListener('click', downloadPdf);

init();
