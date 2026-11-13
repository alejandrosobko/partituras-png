importScripts('collect.js');

const MUSESCORE_RE = /^https:\/\/(www\.)?musescore\.com\//;

async function openResults(data) {
  const key = crypto.randomUUID();
  await chrome.storage.session.set({ [key]: data });
  await chrome.tabs.create({ url: `results.html?k=${key}` });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!MUSESCORE_RE.test(tab.url || '')) {
    await openResults({ error: 'Abrí una partitura de musescore.com y tocá el botón de la extensión desde esa pestaña.' });
    return;
  }

  await chrome.action.setBadgeText({ tabId: tab.id, text: '…' });
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: collectScorePages,
    });
    await openResults({ ...result, sourceUrl: tab.url });
  } catch (error) {
    await openResults({ error: `No pude leer la página: ${error.message}` });
  } finally {
    await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
  }
});
