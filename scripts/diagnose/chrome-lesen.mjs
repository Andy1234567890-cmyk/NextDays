#!/usr/bin/env node
// Eine Seite im laufenden Chrome auslesen — ohne Playwright, ohne AppleScript.
//
// WARUM ES DAS GIBT (28.08.2026)
// ==============================
// Playwright ist verboten, und der AppleScript-Weg
// (`tell application "Google Chrome" to execute ... javascript`) ist eine
// Sackgasse: er verlangt das Haekchen „Darstellung → Entwickler → JavaScript
// von Apple Events erlauben", und das laesst sich NICHT per Skript setzen —
// gemessen: `defaults write AllowJavaScriptAppleEvents 1` wird ignoriert, und
// ein Menue-Klick per System Events kommt zwar an, das Haekchen bleibt aber
// aus (AXMenuItemMarkChar vorher wie nachher `missing value`). macOS schuetzt
// diesen Schalter bewusst gegen Automatisierung.
//
// Der Weg, der funktioniert, ist das Chrome-DevTools-Protokoll ueber einen
// rohen WebSocket. Kein Paket noetig: Node bringt `WebSocket` seit 22 mit.
//
// EINMALIG: Chrome mit offenem Debug-Port starten
// -----------------------------------------------
//   nohup "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
//     --remote-debugging-port=9222 \
//     --user-data-dir="$HOME/.cache/claude-chrome-debug" \
//     > /tmp/chrome-dbg.log 2>&1 &
//
// Eigenes `--user-data-dir`, damit der normale Chrome des Nutzers
// unangetastet weiterlaeuft (seine Tabs, seine Anmeldungen). Der Debug-Chrome
// hat ein eigenes Profil — dort muss man sich einmal anmelden.
//
// BENUTZUNG
// ---------
//   node scripts/diagnose/chrome-lesen.mjs --oeffnen "https://…"
//   node scripts/diagnose/chrome-lesen.mjs --tabs
//   node scripts/diagnose/chrome-lesen.mjs "document.title"
//   node scripts/diagnose/chrome-lesen.mjs --tab <ID> "document.body.innerText"
//
// Ohne `--tab` wird der zuletzt geoeffnete Seiten-Tab genommen.
const PORT = process.env.CHROME_DEBUG_PORT ?? '9222';
const BASIS = `http://127.0.0.1:${PORT}`;

async function tabs() {
  const r = await fetch(`${BASIS}/json/list`);
  return (await r.json()).filter((t) => t.type === 'page');
}

async function auswerten(tabId, ausdruck) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/devtools/page/${tabId}`);
  let id = 0;
  const senden = (method, params = {}) =>
    new Promise((res, rej) => {
      const mid = ++id;
      const h = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id !== mid) return;
        ws.removeEventListener('message', h);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      };
      ws.addEventListener('message', h);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('kein WebSocket')), { once: true });
  });
  try {
    // `awaitPromise`, damit auch `await`-Ausdruecke funktionieren.
    const r = await senden('Runtime.evaluate', {
      expression: ausdruck,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result?.value;
  } finally {
    ws.close();
  }
}

const argv = process.argv.slice(2);

try {
  await fetch(`${BASIS}/json/version`);
} catch {
  console.error(
    `Kein Chrome auf ${BASIS}. Starte ihn mit --remote-debugging-port=${PORT} (siehe Kopf dieser Datei).`,
  );
  process.exit(1);
}

if (argv[0] === '--tabs') {
  for (const t of await tabs()) console.log(`${t.id}  ${t.title?.slice(0, 60)}  ${t.url?.slice(0, 90)}`);
  process.exit(0);
}

if (argv[0] === '--oeffnen') {
  const url = argv[1];
  if (!url) { console.error('URL fehlt.'); process.exit(1); }
  const r = await fetch(`${BASIS}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const t = await r.json();
  console.log(`${t.id}  ${t.url}`);
  process.exit(0);
}

let tabId = null;
let rest = argv;
if (argv[0] === '--tab') { tabId = argv[1]; rest = argv.slice(2); }
if (!tabId) {
  const liste = await tabs();
  if (!liste.length) { console.error('Kein offener Tab.'); process.exit(1); }
  tabId = liste[0].id;
}

const ausdruck = rest.join(' ');
if (!ausdruck) { console.error('Kein Ausdruck angegeben.'); process.exit(1); }

const wert = await auswerten(tabId, ausdruck);
console.log(typeof wert === 'string' ? wert : JSON.stringify(wert, null, 2));
