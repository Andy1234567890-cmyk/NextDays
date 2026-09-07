#!/usr/bin/env node
// Eine Seite im laufenden Chrome BEDIENEN — klicken, ueberfahren, lesen.
//
// Schwester von `chrome-lesen.mjs` (das nur liest). Gleicher Weg: rohes
// Chrome-DevTools-Protokoll ueber WebSocket, kein Playwright, kein AppleScript.
//
// WARUM ES DAS GIBT (28.08.2026)
// ==============================
// Das Framer-CMS liegt vollstaendig in einem FREMD-Origin-iframe
// (`*.framercanvas.com`). Aus dem aeusseren Dokument ist es unerreichbar
// (`contentDocument` ist null) — wer nur `document.querySelectorAll` im
// Top-Frame macht, sieht ein leeres Dokument und meldet faelschlich „nichts da".
// Deshalb zwei Verbindungen:
//   * LESEN/SUCHEN im iframe-Target selbst (eigene Target-ID in /json/list,
//     Typ `iframe`) — dort ist der DOM vollstaendig.
//   * KLICKEN auf dem SEITEN-Target, weil `Input.dispatchMouseEvent` nur dort
//     echte, vertrauenswuerdige Eingaben erzeugt; Chrome trifft das iframe per
//     Hit-Test selbst. Synthetische `new MouseEvent(...)` reichen nicht, viele
//     Menues oeffnen darauf nicht.
// Koordinaten sind Viewport-Koordinaten der SEITE. Liegt das iframe nicht bei
// 0,0, wird sein Versatz mit `--versatz x,y` angegeben.
//
// BENUTZUNG
// ---------
//   node scripts/diagnose/chrome-steuern.mjs --ziele
//   node scripts/diagnose/chrome-steuern.mjs --auf framer.com 'text:' 'bild:/tmp/a.png'
//   node scripts/diagnose/chrome-steuern.mjs --seite <id> --rahmen <id> \
//        'js:document.title' 'klickauf:button[title="Filter"]' 'warte:400'
//
// `--auf <urlteil>` sucht Seiten- und Rahmenziel selbst — der Normalfall.
//
// Befehle (in dieser Reihenfolge abgearbeitet, Ergebnis je Zeile):
//   js:<ausdruck>        JavaScript IM RAHMEN auswerten (await erlaubt)
//   jsseite:<ausdruck>   JavaScript im Top-Frame auswerten
//   klick:<x>,<y>        echter Linksklick auf Seiten-Koordinate
//   dklick:<x>,<y>       Doppelklick
//   rklick:<x>,<y>       Rechtsklick (Kontextmenue)
//   hover:<x>,<y>        Mauszeiger bewegen (ohne Klick)
//   klickauf:<css>       Element im Rahmen suchen, Mittelpunkt klicken
//   rklickauf:<css>      dasselbe als Rechtsklick
//   hoverauf:<css>       dasselbe als Ueberfahren
//   tippe:<text>         Text tippen (Zeichen fuer Zeichen)
//   taste:<name>         eine Taste (Enter, Tab, ArrowDown, …). NIE Escape im CMS.
//   scrolle:<x>,<y>,<dy> echtes Mausrad (laedt virtualisierte Listen nach)
//   warte:<ms>           feste Pause (nur wenn nichts anderes geht)
//   text:                sichtbarer Text des Rahmens
//   baum:<css>           Elementbaum ab Selektor (Tag, Text, Rolle, Rect)
//   stil:<css>           berechnete Kernwerte des ersten Treffers
//   scrolle:<x>,<y>,<dy> echtes Mausrad (laedt virtualisierte Listen nach)
//   karte:               ALLES Bedienbare finden + im Bild markieren
//   karte:alle           auch, was ausserhalb des sichtbaren Bereichs liegt
//   erkunde:[<tiefe>|<max>]  4 Sonden je Stelle (Klick, Rechtsklick, Hover,
//                        Feldprobe), rekursiv in Untermenues. Vorgabe Tiefe 2,
//                        keine Kappung. Beispiel: erkunde:2|30
//   hoverkarte:[<schritt>] Raster ueberfahren: was erscheint nur bei Hover?
//   karteweg:            Markierungen entfernen
//   --markieren          Kaesten+Nummern ins Bild (Vorgabe: aus)
//   --sauber             alle Anzeigen aus ALLEN Tabs entfernen
//   wartetext:<text>|<ms> auf Text warten statt feste Pause (Vorgabe 5000 ms)
//   ersetze:<text>      Feld leeren und neu tippen (tippe: haengt an!)
//   --unsichtbar        ohne Zeiger/Rahmen (schneller)
//   bild:<pfad>          Bildschirmfoto der SEITE als PNG
const PORT = process.env.CHROME_DEBUG_PORT ?? '9222';
const BASIS = `http://127.0.0.1:${PORT}`;

async function ziele() {
  const r = await fetch(`${BASIS}/json/list`);
  return await r.json();
}

function verbinden(id) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/devtools/page/${id}`);
  let lfd = 0;
  const senden = (method, params = {}) =>
    new Promise((res, rej) => {
      const mid = ++lfd;
      const h = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id !== mid) return;
        ws.removeEventListener('message', h);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      };
      ws.addEventListener('message', h);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  const bereit = new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error(`kein WebSocket zu ${id}`)), { once: true });
  });
  return { ws, senden, bereit };
}

async function auswerten(v, ausdruck) {
  const r = await v.senden('Runtime.evaluate', {
    expression: ausdruck,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? ''));
  return r.result?.value;
}

const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------- Sichtbare Rueckmeldung
// CDP-Klicks gehen DIREKT in die Seite; der Mauszeiger des Betriebssystems
// bewegt sich dabei nicht. Wer zusieht, sieht nichts passieren und haelt das
// Werkzeug fuer kaputt — genau diese Meldung kam vom Nutzer (28.08.2026).
// Deshalb malt die Seite selbst mit: ein Zeiger an der Klickstelle und ein
// Rahmen um das getroffene Element. Reine Anzeige, `pointer-events:none`, sie
// faengt also keinen Klick ab und veraendert die Seite inhaltlich nicht.
// Abschaltbar mit --unsichtbar (schneller, z. B. fuer reines Auslesen).
const SICHTBAR = !process.argv.includes('--unsichtbar');
const AUFRAEUMEN = process.argv.includes('--aufraeumen');
// Kaesten und Nummern im Bild sind AUS, solange man sie nicht anfordert. Sie
// bleiben nach dem Lauf liegen und legen sich ueber die Beschriftungen — der
// Nutzer arbeitet danach in einer zugepflasterten Oberflaeche (28.08.2026:
// „mach die zahlen und die umrandungen weg das das iretiert"). Wer sie sehen
// will: --markieren.
const MARKIEREN = process.argv.includes('--markieren');

// Der Zeiger BLEIBT stehen, wo zuletzt geklickt wurde, und traegt daneben ein
// Schild mit der Aktion („Klick auf · button.speichern"). Er verschwand vorher
// nach der Sitzung, und selbst waehrenddessen sah man nur einen anonymen Punkt:
// wo er steht, war sichtbar, WAS dort passiert nicht. Zusaetzlich zieht eine
// kurze Spur vom vorigen zum neuen Ort — damit ist die Reihenfolge der Klicks
// nachvollziehbar, nicht nur der letzte.
const ZEIGER_JS = (x, y, art, was) => `(() => {
  const ID = '__claude_zeiger__';
  const SP = '__claude_spur__';
  let z = document.getElementById(ID);
  const neu = !z;
  if (!z) {
    z = document.createElement('div');
    z.id = ID;
    const s = document.createElement('div');
    s.id = ID + '_schild';
    z.appendChild(s);
    document.documentElement.appendChild(z);
  }
  const rechts = ${x} < window.innerWidth - 260;
  z.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;' +
    'width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;' +
    'border:2px solid ' + (${JSON.stringify(art)} === 'rechts' ? '#0a84ff' : '#ff2d55') + ';' +
    'background:' + (${JSON.stringify(art)} === 'rechts' ? 'rgba(10,132,255,.25)' : 'rgba(255,45,85,.25)') + ';' +
    'box-shadow:0 0 0 2px #fff, 0 0 14px rgba(255,45,85,.85);' +
    'left:${x}px;top:${y}px;' +
    'transition:left .22s ease-out, top .22s ease-out;';

  const s = document.getElementById(ID + '_schild');
  if (s) {
    s.textContent = ${JSON.stringify(was || '')};
    s.style.cssText = 'position:absolute;top:50%;transform:translateY(-50%);' +
      (rechts ? 'left:34px;' : 'right:34px;') +
      'background:rgba(20,20,22,.92);color:#fff;font:600 11px/1.5 system-ui,sans-serif;' +
      'padding:3px 9px;border-radius:5px;white-space:nowrap;max-width:240px;' +
      'overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,.35);' +
      (${JSON.stringify(was || '')} ? '' : 'display:none;');
  }

  // Spur vom vorigen Ort: nur ein verblassender Punkt, damit die Reihenfolge
  // sichtbar wird, ohne die Seite zuzukleistern.
  if (!neu) {
    const alt = document.createElement('div');
    alt.className = SP;
    alt.style.cssText = 'position:fixed;z-index:2147483644;pointer-events:none;' +
      'width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;' +
      'background:rgba(255,45,85,.5);left:' + (z.__lx ?? ${x}) + 'px;top:' + (z.__ly ?? ${y}) + 'px;' +
      'transition:opacity 3s linear;';
    document.documentElement.appendChild(alt);
    requestAnimationFrame(() => { alt.style.opacity = '0'; });
    setTimeout(() => alt.remove(), 3200);
  }
  z.__lx = ${x}; z.__ly = ${y};

  if (${JSON.stringify(art)} !== 'hover') {
    z.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(2.1)' }, { transform: 'scale(1)' }],
      { duration: 320, easing: 'ease-out' },
    );
  }
  return true;
})()`;

const RAHMEN_JS = (r) => `(() => {
  const ID = '__claude_rahmen__';
  let k = document.getElementById(ID);
  if (!k) {
    k = document.createElement('div');
    k.id = ID;
    k.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;' +
      'border:2px solid #ff2d55;border-radius:3px;background:rgba(255,45,85,.10);' +
      'transition:all .18s ease-out;';
    document.documentElement.appendChild(k);
  }
  k.style.left = ${r.l} + 'px';
  k.style.top = ${r.t} + 'px';
  k.style.width = ${r.w} + 'px';
  k.style.height = ${r.h} + 'px';
  return true;
})()`;

// Rahmen um das GANZE Fenster, solange die Sitzung laeuft. Der Element-Rahmen
// zeigt, WO gerade geklickt wird; dieser zeigt, DASS die Seite ferngesteuert
// ist — auch in den Sekunden zwischen zwei Klicks, in denen sonst nichts zu
// sehen ist. Er haengt an `position:fixed` und deckt damit den sichtbaren
// Bereich unabhaengig von der Scrollposition ab.
const SITZUNG_JS = (beschriftung) => `(() => {
  const ID = '__claude_sitzung__';
  let r = document.getElementById(ID);
  if (!r) {
    r = document.createElement('div');
    r.id = ID;
    const s = document.createElement('div');
    s.id = ID + '_schild';
    s.style.cssText = 'position:absolute;top:0;left:50%;transform:translateX(-50%);' +
      'background:rgba(255,45,85,.72);color:#fff;font:600 11px/1.6 system-ui,sans-serif;' +
      'padding:3px 14px;border-radius:0 0 8px 8px;letter-spacing:.03em;white-space:nowrap;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.25);';
    r.appendChild(s);
    document.documentElement.appendChild(r);
  }
  // Formatierung IMMER neu setzen, nicht nur beim Anlegen: ein Rahmen aus einem
  // frueheren Lauf traegt sonst dauerhaft den alten Stil (gemessen: 3px, obwohl
  // 2px im Code stand — die Aenderung wirkte erst nach einem Neuladen).
  r.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:none;' +
    'border:2px solid rgba(255,45,85,.38);box-shadow:inset 0 0 6px rgba(255,45,85,.06);';
  const s = document.getElementById(ID + '_schild');
  if (s) s.textContent = ${JSON.stringify(beschriftung)};

  // Selbstheilung. Eine SPA (Framer, jedes React-Dashboard) raeumt beim
  // Ansichtswechsel den Baum ab, und ZWISCHEN zwei Sitzungen ist niemand da,
  // der den Rahmen neu setzt — er waere beim naechsten Hinsehen einfach weg,
  // ohne Meldung. Der Beobachter haengt ihn wieder ein; er lauscht nur auf
  // Kind-Aenderungen des Wurzelelements, kostet also praktisch nichts.
  // Der Beobachter wird AM ELEMENT abgelegt, nicht anonym gestartet: sonst
  // laesst er sich nicht mehr stoppen, und jedes Aufraeumen wird von ihm
  // rueckgaengig gemacht (--sauber meldete dann Erfolg ohne Wirkung).
  if (!r.__claudeWache) {
    const w = new MutationObserver(() => {
      if (!document.getElementById(ID) && document.documentElement) {
        document.documentElement.appendChild(r);
      }
    });
    w.observe(document.documentElement, { childList: true });
    r.__claudeWache = w;
  }
  return true;
})()`;

// Nur die punktuellen Anzeigen. Der Seitenrahmen ist NICHT dabei.
const AUFRAEUMEN_JS = `(() => {
  document.getElementById('__claude_rahmen__')?.remove();
  for (const e of document.querySelectorAll('.__claude_spur__')) e.remove();
  return true;
})()`;

// Nach der Sitzung: Beschriftung des stehengebliebenen Zeigers.
const ZEIGER_LETZTER_JS = `(() => {
  const s = document.getElementById('__claude_zeiger___schild');
  if (s && s.textContent) s.textContent = 'zuletzt: ' + s.textContent;
  return true;
})()`;

// Alles inklusive Seitenrahmen — nur auf ausdrueckliches --aufraeumen.
const ALLES_WEG_JS = `(() => {
  for (const id of ['__claude_sitzung__', '__claude_zeiger__', '__claude_rahmen__']) {
    document.getElementById(id)?.remove();
  }
  for (const e of document.querySelectorAll('.__claude_spur__')) e.remove();
  return true;
})()`;

/** Best-effort: eine Seite mit strenger CSP darf den Hauptpfad nicht kippen —
 *  dann fehlt nur die Anzeige, geklickt wird trotzdem. */
async function anzeigen(v, js) {
  if (!SICHTBAR) return;
  try { await auswerten(v, js); } catch { /* nur Anzeige */ }
}

/**
 * Setzt den Sitzungsrahmen und PRUEFT, ob er danach wirklich im Dokument steht.
 *
 * Nicht setzen-und-hoffen: jede Navigation baut das Dokument neu auf, und das
 * eingefuegte Element ist dann spurlos weg — der Rahmen verschwindet mitten in
 * der Sitzung, ohne dass irgendwo etwas gemeldet wuerde. Genau diese Klasse
 * stiller Fehler ist hier Wurzel 5. Der Rueckgabewert sagt, ob die Anzeige
 * steht; `false` wird oben laut gemeldet, nicht verschluckt.
 */
async function rahmenSichern(v, beschriftung) {
  if (!SICHTBAR) return true;
  try {
    await auswerten(v, SITZUNG_JS(beschriftung));
    const steht = await auswerten(v, `(() => {
      const r = document.getElementById('__claude_sitzung__');
      if (!r) return 'FEHLT';
      const c = getComputedStyle(r);
      if (c.display === 'none' || c.visibility === 'hidden') return 'VERSTECKT';
      const b = r.getBoundingClientRect();
      if (b.width < 50 || b.height < 50) return 'ZU_KLEIN';
      return 'OK';
    })()`);
    return steht === 'OK' ? true : String(steht);
  } catch (e) {
    return `NICHT MOEGLICH (${String(e?.message ?? e).split('\n')[0].slice(0, 60)})`;
  }
}

async function maus(seite, x, y, art, klicks = 1, was = '') {
  const knopf = art === 'rechts' ? 'right' : 'left';
  const buttons = art === 'rechts' ? 2 : 1;
  await anzeigen(seite, ZEIGER_JS(Math.round(x), Math.round(y), art, was));
  // Ohne Pause ist die Anzeige weg, bevor ein Auge sie erfasst. Der Aufschlag
  // ist der Sinn der Sache, nicht ein Verlust an Tempo.
  if (SICHTBAR) await schlaf(420);
  await seite.senden('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 });
  await schlaf(60);
  if (art === 'hover') return;
  await seite.senden('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: knopf, buttons, clickCount: klicks });
  await schlaf(40);
  await seite.senden('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: knopf, buttons: 0, clickCount: klicks });
}

// Sichtbaren Text sammeln. NICHT `body.innerText`: das liefert den Inhalt von
// `<script type="importmap">` und `<style>` gleich mit — bei Framer stehen so
// mehrere hundert Zeilen Modulpfade VOR dem ersten Bedienelement, und wer die
// Ausgabe abschneidet, sieht von der Oberflaeche nichts und meldet „leer".
// Deshalb ueber einen TreeWalker nur echte Textknoten, deren Eltern sichtbar
// sind und kein Skript/Stil.
const TEXT_JS = `(() => {
  const raus = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const t = n.nodeValue && n.nodeValue.trim();
      if (!t) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TITLE)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
      const r = p.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return NodeFilter.FILTER_REJECT;
      const s = getComputedStyle(p);
      if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = w.nextNode(); n; n = w.nextNode()) raus.push(n.nodeValue.trim());
  return raus.join('\\n');
})()`;

// ------------------------------------------------------------------ Inventar
// ALLES Bedienbare einer Ansicht in einem Zug: Eingaben, Knoepfe, Auswahlfelder,
// Links, Reiter, Schalter, Menue-Ausloeser, Rahmen. Vorher musste jedes Element
// einzeln per Selektor gesucht werden — wer den Selektor nicht kannte, fand
// nichts und schloss faelschlich „da ist nichts" (mehrfach passiert).
//
// Erkannt wird NICHT nur ueber Tag-Namen: moderne Oberflaechen bauen ihre
// Knoepfe aus <div> mit `role`, `tabindex` oder `onclick`. Framer, Notion und
// jedes React-Dashboard haben kaum ein echtes <button>.
const KARTE_JS = (nurSichtbar) => `(() => {
  const AUS = ['__claude_sitzung__', '__claude_zeiger__', '__claude_rahmen__'];
  const funde = [];
  const gesehen = new Set();

  const istEigen = (el) => {
    for (let n = el; n; n = n.parentElement) {
      if (AUS.includes(n.id) || n.className === '__claude_spur__') return true;
    }
    return false;
  };

  const sichtbar = (el, r) => {
    if (r.width === 0 || r.height === 0) return false;
    const c = getComputedStyle(el);
    if (c.display === 'none' || c.visibility === 'hidden') return false;
    // opacity:0 heisst NICHT „gibt es nicht": genau so werden Zeilen-Aktionen
    // versteckt, die erst beim Ueberfahren erscheinen. Sie werden markiert
    // statt verworfen — sonst fehlt jedes Hover-Icon in der Karte.
    if (c.opacity === '0') return 'unsichtbar';
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return 'ausserhalb';
    return true;
  };

  const beschriftung = (el) => {
    // Icon-Knoepfe bestehen regelmaessig aus DREI ineinanderliegenden div:
    // aussen role=button OHNE Label, in der Mitte das aria-label, innen leer.
    // Wer nur das Element selbst befragt, bekommt bei zwei von drei nichts —
    // und das Entruempeln behaelt ausgerechnet das leerste. Gemessen an Framers
    // Werkzeugleiste: Sync/Manage/Sorting/Filter/Search/Show Columns standen
    // alle als „—" in der Karte, obwohl jedes ein aria-label trug.
    const ausUmgebung = () => {
      // erst nach INNEN (SVG-title, beschriftetes Kind)
      const k = el.querySelector('[aria-label],[title],svg title,img[alt]');
      if (k) {
        const v = k.getAttribute?.('aria-label') || k.getAttribute?.('title') ||
          k.getAttribute?.('alt') || k.textContent;
        if (v && v.trim()) return v.trim();
      }
      // dann nach AUSSEN, aber nur solange der Vorfahr dieselbe Flaeche hat —
      // sonst erbt ein Knopf die Beschriftung seines Containers.
      const r = el.getBoundingClientRect();
      for (let n = el.parentElement, t = 0; n && t < 4; n = n.parentElement, t++) {
        const rn = n.getBoundingClientRect();
        if (Math.abs(rn.width - r.width) > 12 || Math.abs(rn.height - r.height) > 12) break;
        const v = n.getAttribute('aria-label') || n.getAttribute('title');
        if (v && v.trim()) return v.trim();
      }
      return '';
    };

    const kandidaten = [
      el.getAttribute('aria-label'),
      el.getAttribute('placeholder'),
      el.getAttribute('title'),
      el.getAttribute('data-framer-name'),
      el.getAttribute('name'),
      el.value && el.tagName !== 'INPUT' ? null : el.value,
      (el.innerText || '').trim().split('\\n')[0],
      el.getAttribute('alt'),
    ];
    for (const k of kandidaten) if (k && String(k).trim()) return String(k).trim().slice(0, 70);
    // Beschriftendes <label> ueber for= oder Umschliessung.
    if (el.id) {
      const l = document.querySelector('label[for=' + JSON.stringify(el.id) + ']');
      if (l && l.innerText.trim()) return l.innerText.trim().slice(0, 70);
    }
    const l2 = el.closest('label');
    if (l2 && l2.innerText.trim()) return l2.innerText.trim().slice(0, 70);
    const u = ausUmgebung();
    if (u) return u.slice(0, 70);
    return '';
  };

  // Ein stabiler Selektor, mit dem sich das Element spaeter wieder anklicken
  // laesst — ohne ihn ist die Karte eine Aufzaehlung ohne Handhabe.
  const selektor = (el) => {
    if (el.id && !/^[0-9]/.test(el.id)) return '#' + CSS.escape(el.id);
    const t = el.tagName.toLowerCase();
    for (const a of ['data-testid', 'name', 'aria-label', 'placeholder', 'title', 'data-framer-name']) {
      const v = el.getAttribute(a);
      if (v) {
        const sel = t + '[' + a + '=' + JSON.stringify(v) + ']';
        try { if (document.querySelectorAll(sel).length === 1) return sel; } catch (e) {}
      }
    }
    // Letzter Ausweg: Position unter den Geschwistern gleichen Typs.
    const p = el.parentElement;
    if (!p) return t;
    const gl = [...p.children].filter((k) => k.tagName === el.tagName);
    const i = gl.indexOf(el) + 1;
    const eltern = p.id ? '#' + CSS.escape(p.id) + ' > ' : '';
    return eltern + t + (gl.length > 1 ? ':nth-of-type(' + i + ')' : '');
  };

  const artVon = (el) => {
    const t = el.tagName.toLowerCase();
    const rolle = (el.getAttribute('role') || '').toLowerCase();
    if (t === 'select') return 'Auswahlfeld';
    if (t === 'textarea') return 'Textbereich';
    if (t === 'input') {
      const ty = (el.type || 'text').toLowerCase();
      if (ty === 'checkbox') return 'Kaestchen';
      if (ty === 'radio') return 'Optionsfeld';
      if (ty === 'file') return 'Dateiwahl';
      if (ty === 'range') return 'Schieber';
      if (ty === 'color') return 'Farbwahl';
      if (['submit', 'button', 'reset', 'image'].includes(ty)) return 'Knopf';
      return 'Eingabe(' + ty + ')';
    }
    if (t === 'button') return 'Knopf';
    if (t === 'a') return 'Link';
    if (t === 'summary') return 'Aufklapper';
    if (t === 'iframe' || t === 'frame') return 'RAHMEN';
    if (el.isContentEditable) return 'Freitext';
    if (rolle) {
      const k = {
        button: 'Knopf', link: 'Link', tab: 'Reiter', menuitem: 'Menueeintrag',
        menuitemcheckbox: 'Menue-Kaestchen', menuitemradio: 'Menue-Option',
        checkbox: 'Kaestchen', radio: 'Optionsfeld', switch: 'Schalter',
        combobox: 'Auswahlfeld', listbox: 'Liste', option: 'Option',
        textbox: 'Eingabe', slider: 'Schieber', spinbutton: 'Zahlenfeld',
        searchbox: 'Suchfeld', treeitem: 'Baumeintrag', dialog: 'Dialog',
        menu: 'Menue', tablist: 'Reiterleiste', toolbar: 'Werkzeugleiste',
      }[rolle];
      if (k) return k;
      return 'role=' + rolle;
    }
    return 'klickbar';
  };

  // Kandidaten: echte Bedienelemente PLUS alles, was sich wie eines verhaelt.
  const feste = 'input,select,textarea,button,a[href],summary,iframe,frame,' +
    '[role],[tabindex],[contenteditable=""],[contenteditable="true"],' +
    '[onclick],[aria-haspopup],[aria-expanded],[data-state]';
  // Tief suchen: querySelectorAll durchdringt KEINEN Shadow-Root. Jede
  // Web-Component (auch die von Frameworks erzeugten) war damit unsichtbar —
  // die Karte meldete „nichts gefunden", obwohl die Oberflaeche voll war.
  const alleWurzeln = [document];
  const shadowSuchen = (wurzel) => {
    for (const el of wurzel.querySelectorAll('*')) {
      if (el.shadowRoot) { alleWurzeln.push(el.shadowRoot); shadowSuchen(el.shadowRoot); }
    }
  };
  shadowSuchen(document);

  const roh = [];
  for (const w of alleWurzeln) {
    for (const el of w.querySelectorAll(feste)) if (!roh.includes(el)) roh.push(el);
    // Zusaetzlich: <div>/<span>, die per CSS als klickbar ausgewiesen sind.
    for (const el of w.querySelectorAll('div,span,li,td,svg')) {
      if (roh.includes(el)) continue;
      const c = getComputedStyle(el);
      if (c.cursor === 'pointer' && el.getBoundingClientRect().width > 0) roh.push(el);
    }
  }

  for (const el of roh) {
    if (istEigen(el)) continue;
    if (gesehen.has(el)) continue;
    gesehen.add(el);
    const r = el.getBoundingClientRect();
    const sicht = sichtbar(el, r);
    if (!sicht) continue;
    if (${nurSichtbar} && sicht === 'ausserhalb') continue;
    const durchsichtig = sicht === 'unsichtbar';

    // Struktur-Rollen sind Geruest, kein Bedienelement: Framers Tabelle liefert
    // 42 gridcell-Kaesten, die im Bild alles ueberdecken. Aussortiert wird ein
    // solcher Kasten nur, wenn er auch NICHTS Eigenes traegt — eine Zelle mit
    // Text ist eine Zelle, die man anklicken kann.
    const GERUEST = ['presentation', 'none', 'gridcell', 'row', 'rowgroup', 'grid',
      'table', 'cell', 'columnheader', 'rowheader', 'group', 'generic'];
    const rolleRoh = (el.getAttribute('role') || '').toLowerCase();
    if (GERUEST.includes(rolleRoh)) {
      const eigenText = [...el.childNodes].filter((n) => n.nodeType === 3)
        .map((n) => n.nodeValue.trim()).join('').trim();
      if (!eigenText) continue; // reiner Rahmen ohne eigenen Inhalt
    }

    const art = artVon(el);

    const eintrag = {
      art,
      text: beschriftung(el),
      sel: selektor(el),
      x: Math.round(r.x + r.width / 2),
      y: Math.round(r.y + r.height / 2),
      b: Math.round(r.width),
      h: Math.round(r.height),
      ausserhalb: sicht === 'ausserhalb' ? 1 : 0,
      versteckt: durchsichtig ? 1 : 0,
    };
    // Zustaende, die fuer einen Nachbau zaehlen.
    if (el.disabled) eintrag.gesperrt = 1;
    if (el.checked) eintrag.angehakt = 1;
    if (el.required) eintrag.pflicht = 1;
    if (el.readOnly) eintrag.nurLesen = 1;
    if (el === document.activeElement) eintrag.fokus = 1;
    const exp = el.getAttribute('aria-expanded');
    if (exp !== null) eintrag.aufgeklappt = exp === 'true' ? 1 : 0;
    if (el.getAttribute('aria-haspopup')) eintrag.oeffnetMenue = 1;
    if (el.tagName === 'A' && el.href) eintrag.ziel = el.getAttribute('href').slice(0, 80);
    if (el.tagName === 'IFRAME') eintrag.quelle = (el.src || '').slice(0, 80);
    if (el.tagName === 'SELECT') {
      eintrag.optionen = [...el.options].map((o) => o.text.trim()).slice(0, 40);
    }
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      eintrag.wert = String(el.value ?? '').slice(0, 60);
    }
    funde.push(eintrag);
  }

  // Entruempeln. Ohne das liefert eine React-Oberflaeche fuenf Eintraege je
  // Karte — Wrapper, Kachel, Link, Titel-Div, Titel-Span —, alle uebereinander.
  // Gemessen an Framers Projektliste: 59 Funde, davon ~35 Duplikate; die
  // Bildmarkierung war dadurch ein Kastenbrei statt einer Auskunft.
  const flaeche = (f) => f.b * f.h;
  const deckt = (a, b) => {  // b liegt (fast) vollstaendig in a
    const al = a.x - a.b / 2, ar = a.x + a.b / 2, ao = a.y - a.h / 2, au = a.y + a.h / 2;
    const bl = b.x - b.b / 2, br = b.x + b.b / 2, bo = b.y - b.h / 2, bu = b.y + b.h / 2;
    return bl >= al - 3 && br <= ar + 3 && bo >= ao - 3 && bu <= au + 3;
  };
  // Je unspezifischer die Art, desto eher faellt der Eintrag weg.
  // Rang entscheidet, welcher von mehreren Eintraegen derselben Stelle bleibt.
  // Eine Beschriftung wiegt schwerer als eine praezise Art: ein namenloser
  // „Knopf" ist fuer einen Nachbau wertlos, „Knopf Search" nicht.
  const rang = (f) => (f.text ? 4 : 0) + (f.art === 'klickbar' ? 0 : f.art.startsWith('role=') ? 1 : 2);

  const raus = funde.filter((f) => funde.every((g) => {
    if (g === f) return true;
    // Ein anderer Fund beschreibt DIESELBE Stelle, wenn einer den anderen deckt
    // und beide dieselbe Beschriftung tragen.
    // Gleiche Stelle = einer deckt den anderen UND sie widersprechen sich nicht.
    // Vorher musste die Beschriftung identisch sein — bei Icon-Knoepfen trug
    // die aeussere Huelle aber gar keine, also galten sie als verschieden und
    // blieben beide stehen (drei Kaesten uebereinander, einer davon namenlos).
    const beide = (g.text || '') && (f.text || '');
    const gleicheStelle = (deckt(f, g) || deckt(g, f)) &&
      (!beide || g.text === f.text);
    if (!gleicheStelle) return true;
    if (rang(g) !== rang(f)) return rang(g) < rang(f);       // spezifischere Art gewinnt
    if (flaeche(g) !== flaeche(f)) return flaeche(g) > flaeche(f); // sonst der kleinere
    return funde.indexOf(g) > funde.indexOf(f);              // sonst der erste
  }));

  raus.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  return JSON.stringify(raus);
})()`;

// Alles Gefundene IM BILD markieren: jeder Fund bekommt einen farbigen Kasten
// mit Nummer, die Farbe steht fuer die Art. Damit ist auf einen Blick zu sehen,
// was das Werkzeug erkannt hat — und vor allem, was es NICHT erkannt hat.
const MARKIEREN_JS = (funde) => `(() => {
  const ID = '__claude_karte__';
  document.getElementById(ID)?.remove();
  const lage = document.createElement('div');
  lage.id = ID;
  lage.style.cssText = 'position:fixed;inset:0;z-index:2147483643;pointer-events:none;';
  const FARBE = {
    'Eingabe': '#0a84ff', 'Textbereich': '#0a84ff', 'Suchfeld': '#0a84ff',
    'Freitext': '#0a84ff', 'Zahlenfeld': '#0a84ff',
    'Knopf': '#ff2d55', 'Link': '#af52de', 'RAHMEN': '#ff9500',
    'Auswahlfeld': '#34c759', 'Liste': '#34c759', 'Option': '#34c759',
    'Kaestchen': '#00c7be', 'Optionsfeld': '#00c7be', 'Schalter': '#00c7be',
    'Reiter': '#ffcc00', 'Menueeintrag': '#ffcc00', 'Menue': '#ffcc00',
  };
  const farbe = (a) => {
    for (const k of Object.keys(FARBE)) if (a.startsWith(k)) return FARBE[k];
    return '#8e8e93';
  };
  const funde = ${JSON.stringify(funde)};
  funde.forEach((f, i) => {
    const c = farbe(f.art);
    const k = document.createElement('div');
    k.style.cssText = 'position:absolute;left:' + (f.x - f.b / 2) + 'px;top:' + (f.y - f.h / 2) + 'px;' +
      'width:' + f.b + 'px;height:' + f.h + 'px;border:1.5px solid ' + c + ';' +
      'border-radius:3px;background:' + c + '14;box-sizing:border-box;';
    const n = document.createElement('div');
    n.textContent = i + 1;
    // Die Nummer nach INNEN legen, wenn ueber dem Element kein Platz ist —
    // sonst verdeckt sie die Beschriftung des Nachbarn darueber.
    const oben = f.y - f.h / 2;
    const innen = oben < 15 || f.h > 26;
    n.style.cssText = 'position:absolute;left:' + (f.x - f.b / 2) + 'px;' +
      'top:' + (innen ? oben + 1 : oben - 13) + 'px;' +
      'background:' + c + ';color:#fff;font:700 9px/13px system-ui,sans-serif;' +
      'padding:0 4px;border-radius:' + (innen ? '3px 0 3px 0' : '3px 3px 0 0') + ';' +
      'white-space:nowrap;opacity:.9;';
    lage.appendChild(k);
    lage.appendChild(n);
  });
  document.documentElement.appendChild(lage);
  return funde.length;
})()`;

const KARTE_WEG_JS = "(() => { document.getElementById('__claude_karte__')?.remove(); return true; })()";

const BAUM_JS = (sel) => `(() => {
  const w = document.querySelector(${JSON.stringify(sel)});
  if (!w) return 'NICHT GEFUNDEN: ' + ${JSON.stringify(sel)};
  const zeilen = [];
  const lauf = (el, t) => {
    if (t > 20) return;
    const r = el.getBoundingClientRect();
    // NICHT abbrechen, wenn das Element selbst 0x0 misst: Anwendungen legen
    // ihre Oberflaeche regelmaessig in einen Wrapper ohne eigene Ausdehnung
    // (absolut positionierte Kinder, display:contents). Framers #root
    // meldet 0 Hoehe und traegt darunter das komplette CMS — wer hier
    // abbricht, sieht drei Zeilen und meldet faelschlich „leer".
    // Uebersprungen wird nur, was WIRKLICH unsichtbar ist.
    const cs = getComputedStyle(el);
    const versteckt = cs.display === 'none' || cs.visibility === 'hidden';
    if (versteckt) return;
    const leer = r.width === 0 && r.height === 0;
    const eigen = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue.trim()).join(' ').trim();
    const marke = [el.tagName.toLowerCase(),
      el.id ? '#' + el.id : '',
      el.getAttribute('role') ? '[role=' + el.getAttribute('role') + ']' : '',
      el.getAttribute('title') ? '[title=' + el.getAttribute('title') + ']' : '',
      el.getAttribute('aria-label') ? '[aria=' + el.getAttribute('aria-label') + ']' : '',
      el.getAttribute('data-framer-name') ? '[fn=' + el.getAttribute('data-framer-name') + ']' : ''].join('');
    if (!leer) zeilen.push('  '.repeat(t) + marke + ' (' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ')' + (eigen ? '  «' + eigen.slice(0, 90) + '»' : ''));
    for (const k of el.children) lauf(k, leer ? t : t + 1);
  };
  lauf(w, 0);
  return zeilen.join('\\n');
})()`;

const STIL_JS = (sel) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return 'NICHT GEFUNDEN: ' + ${JSON.stringify(sel)};
  const s = getComputedStyle(el); const r = el.getBoundingClientRect();
  const f = ['backgroundColor','color','fontSize','fontWeight','fontFamily','borderRadius','padding','margin','height','width','border','boxShadow','opacity','textTransform','letterSpacing','lineHeight','gap'];
  const o = {rect: {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)}};
  for (const k of f) o[k] = s[k];
  return JSON.stringify(o, null, 1);
})()`;

const RECT_JS = (sel) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return 'UNSICHTBAR';
  return JSON.stringify({x: r.x + r.width / 2, y: r.y + r.height / 2, l: r.x, t: r.y, w: r.width, h: r.height});
})()`;

// ---------------------------------------------------------------- Hauptlauf
const argv = process.argv.slice(2);

// Debug-Chrome bei Bedarf SELBST starten. Vorher stand hier nur ein Verweis auf
// eine andere Datei — wer den Port zu hatte, las „Kein Chrome" und war fertig.
// Ein Werkzeug, dessen einzige Voraussetzung es nicht selbst herstellt, ist aus
// Nutzersicht kaputt, auch wenn jede Zeile darin stimmt.
const PROFIL = `${process.env.HOME}/.cache/claude-chrome-debug`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function chromeDa() {
  try {
    // Kurzer Timeout: ein sterbender Chrome laesst den Socket sonst haengen.
    await fetch(`${BASIS}/json/version`, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch { return false; }
}

if (!(await chromeDa())) {
  const { spawn } = await import('node:child_process');
  const { existsSync } = await import('node:fs');
  if (!existsSync(CHROME)) {
    console.error(`Chrome nicht gefunden: ${CHROME}`);
    process.exit(1);
  }
  console.log(`# Kein Chrome auf ${BASIS} — starte einen (eigenes Profil ${PROFIL}).`);
  // Eigenes --user-data-dir: der normale Chrome des Nutzers samt seinen Tabs
  // bleibt unangetastet. NIE seinen Chrome neu starten (live passiert 28.08.2026).
  spawn(CHROME, [
    `--remote-debugging-port=${PORT}`,
    `--remote-allow-origins=http://127.0.0.1:${PORT}`,
    `--user-data-dir=${PROFIL}`,
    '--no-first-run',
    '--no-default-browser-check',
  ], { detached: true, stdio: 'ignore' }).unref();

  // Auf den Port warten statt fest zu schlafen — feste Wartezeiten messen
  // Startlatenz mit und flattern (dieselbe Lehre wie beim GA4-Gate).
  const bis = Date.now() + 20000;
  let da = false;
  while (Date.now() < bis) {
    await new Promise((r) => setTimeout(r, 250));
    if (await chromeDa()) { da = true; break; }
  }
  if (!da) {
    console.error(`Chrome gestartet, aber ${BASIS} antwortet binnen 20 s nicht.`);
    process.exit(1);
  }
  console.log('# Chrome bereit.');
}

// `--sauber` raeumt JEDEN Tab auf, nicht nur den gewaehlten. Anlass
// (28.08.2026): Anzeigen lagen in mehreren Tabs, das Aufraeumen lief auf einem,
// und der Nutzer sah sie weiterhin. Der MutationObserver der Selbstheilung wird
// dabei ausdruecklich abgeschaltet — sonst haengt er den Rahmen sofort wieder
// ein und das Aufraeumen meldet Erfolg, ohne dass etwas verschwindet.
if (argv[0] === '--sauber') {
  const WEG = `(() => {
    const r = document.getElementById('__claude_sitzung__');
    if (r && r.__claudeWache) r.__claudeWache.disconnect();
    let n = 0;
    for (const id of ['__claude_sitzung__', '__claude_zeiger__', '__claude_rahmen__', '__claude_karte__']) {
      const e = document.getElementById(id); if (e) { e.remove(); n++; }
    }
    for (const e of document.querySelectorAll('.__claude_spur__')) { e.remove(); n++; }
    const rest = ['__claude_sitzung__', '__claude_zeiger__', '__claude_rahmen__', '__claude_karte__']
      .filter((id) => document.getElementById(id));
    return JSON.stringify({ n, rest });
  })()`;
  let gesamt = 0;
  for (const t of await ziele()) {
    if (!['page', 'iframe'].includes(t.type)) continue;
    try {
      const v = verbinden(t.id);
      await v.bereit;
      const d = JSON.parse(await auswerten(v, WEG));
      v.ws.close();
      gesamt += d.n;
      if (d.n || d.rest.length) {
        console.log(`  ${d.n} entfernt${d.rest.length ? ' — UEBRIG: ' + d.rest.join(', ') : ''}  ${t.url.slice(0, 62)}`);
      }
    } catch { /* Tab nicht ansprechbar (geschlossen, chrome://) */ }
  }
  console.log(gesamt ? `${gesamt} Anzeige(n) aus allen Tabs entfernt.` : 'Nichts gefunden — alle Tabs sind sauber.');
  process.exit(0);
}

if (argv[0] === '--ziele') {
  for (const t of await ziele()) {
    if (!['page', 'iframe'].includes(t.type)) continue;
    console.log(`${t.type.padEnd(6)} ${t.id}  ${(t.title || '').slice(0, 45).padEnd(45)} ${t.url.slice(0, 80)}`);
  }
  process.exit(0);
}

let seiteId = null, rahmenId = null, versatz = { x: 0, y: 0 }, auf = null;
const befehle = [];
for (let i = 0; i < argv.length; i++) {
  if (['--unsichtbar', '--aufraeumen', '--markieren'].includes(argv[i])) continue; // oben schon ausgewertet
  if (argv[i] === '--seite') { seiteId = argv[++i]; continue; }
  if (argv[i] === '--rahmen') { rahmenId = argv[++i]; continue; }
  if (argv[i] === '--auf') { auf = argv[++i]; continue; }
  if (argv[i] === '--versatz') { const [x, y] = argv[++i].split(','); versatz = { x: +x, y: +y }; continue; }
  befehle.push(argv[i]);
}

// `--auf <urlteil>`: Ziele selbst finden statt zwei IDs von Hand abzuschreiben.
// Das war die eigentliche Huerde im Alltag — wer erst `--ziele` liest, zwei IDs
// kopiert und dann klickt, gibt nach dem dritten Mal auf und liest die Seite
// wieder nur mit `document.querySelectorAll` (und sieht das iframe nicht).
//
// Der GROESSTE sichtbare iframe wird automatisch zum Rahmen: genau so liegen
// Editor-Oberflaechen (Framer-Canvas, eingebettete Konsolen). Gibt es keinen,
// ist der Rahmen die Seite selbst — dann verhaelt sich alles wie bei einer
// gewoehnlichen Website.
if (auf) {
  let alle = await ziele();
  let treffer = alle.filter((t) => t.type === 'page' && t.url.includes(auf));

  // Kein passender Tab? Wenn `--auf` eine vollstaendige URL ist, wird sie
  // GEOEFFNET statt abgebrochen. Vorher endete der haeufigste Fall — frischer
  // Chrome, Seite noch nicht offen — in einer Fehlermeldung, obwohl das Werkzeug
  // die Seite selbst holen kann.
  if (!treffer.length && /^https?:\/\//.test(auf)) {
    console.log(`# Kein Tab mit „${auf}" — oeffne ihn.`);
    await fetch(`${BASIS}/json/new?${encodeURIComponent(auf)}`, { method: 'PUT' });
    // Auf ein bedienbares Dokument warten, nicht auf eine feste Zeit: der Tab
    // taucht sofort in /json/list auf, traegt aber sekundenlang noch `about:blank`.
    const bis = Date.now() + 25000;
    while (Date.now() < bis) {
      await schlaf(300);
      alle = await ziele();
      treffer = alle.filter((t) => t.type === 'page' && t.url.includes(auf));
      if (treffer.length) {
        try {
          const v = verbinden(treffer[0].id); await v.bereit;
          // NICHT nur readyState: der frisch geoeffnete Tab meldet
          // „interactive", wenn das Zieldokument noch gar nicht angekommen ist
          // — dann liefert `text:` nichts und jeder Selektor geht ins Leere,
          // obwohl der Titel schon stimmt. Auf sichtbaren INHALT warten.
          const fertig = await auswerten(v, 'document.readyState');
          const inhalt = await auswerten(v, 'document.body ? document.body.innerText.trim().length : 0');
          v.ws.close();
          if ((fertig === 'interactive' || fertig === 'complete') && Number(inhalt) > 0) break;
        } catch { /* Tab noch nicht ansprechbar — weiter warten */ }
      }
    }
  }

  if (!treffer.length) {
    console.error(`Kein offener Tab mit „${auf}" in der URL. Vorhanden:`);
    for (const t of alle.filter((x) => x.type === 'page')) console.error(`  ${t.url.slice(0, 100)}`);
    console.error('Tipp: `--auf` mit vollstaendiger https-URL uebergeben, dann wird der Tab geoeffnet.');
    process.exit(1);
  }

  seiteId = treffer[0].id;

  if (!rahmenId) {
    // NUR Rahmen DIESES Tabs. Chrome listet alle iframes aller Tabs flach in
    // /json/list; ohne die Abstammung ueber `parentId` gewinnt der textreichste
    // Rahmen irgendeines anderen Fensters. Live passiert (28.08.2026): geklickt
    // wurde in example.com, gelesen der Google-Rahmen des Neuer-Tab-Fensters —
    // Text und Klick betrafen verschiedene Seiten, ohne jede Fehlermeldung.
    const eigene = new Set([seiteId]);
    for (let gewachsen = true; gewachsen; ) {
      gewachsen = false;
      for (const t of alle) {
        if (t.type === 'iframe' && t.parentId && eigene.has(t.parentId) && !eigene.has(t.id)) {
          eigene.add(t.id);
          gewachsen = true; // verschachtelte Rahmen brauchen einen zweiten Durchlauf
        }
      }
    }
    const kandidaten = alle.filter(
      (t) => t.type === 'iframe' && eigene.has(t.id) &&
        !/about:blank|doubleclick|googletag|analytics|recaptcha|gtm\.js/.test(t.url),
    );
    // Nach INHALT waehlen, nicht nach URL: bei Framer heissen zwei iframes fast
    // gleich (…/s/app.<hash>…), aber nur EINES traegt die Oberflaeche — das
    // andere ist der Modul-Lader. Die URL-Laenge entscheidet das nicht; die
    // Menge sichtbaren Textes schon.
    const textmenge = async (id) => {
      try {
        const v = verbinden(id);
        await v.bereit;
        const t = await auswerten(v, TEXT_JS);
        v.ws.close();
        return typeof t === 'string' ? t.length : 0;
      } catch {
        return -1; // antwortet nicht → faellt aus der Wahl
      }
    };

    // Die SEITE ist Mitbewerber, nicht nur Rueckfallebene. Vorher verglich die
    // Wahl die Rahmen ausschliesslich untereinander und nahm den besten von
    // ihnen — auf example.com, das keinen sichtbaren iframe hat, landete so ein
    // unsichtbarer Rest-Rahmen als Ziel und `text:` gab nichts zurueck, obwohl
    // die Seite 462 Zeichen trug. Ein Rahmen gewinnt nur, wenn er WIRKLICH mehr
    // Oberflaeche traegt als das Hauptdokument.
    let bester = null;
    const seiteText = await textmenge(seiteId);
    let meiste = seiteText;
    for (const k of kandidaten) {
      const n = await textmenge(k.id);
      if (n > meiste) { meiste = n; bester = k.id; }
    }
    // Ein Rahmen muss DEUTLICH mehr tragen als das Hauptdokument, nicht nur
    // eine Handvoll Zeichen. Sonst kippt die Wahl zwischen zwei Laeufen hin und
    // her (gemessen an Framer: mal das CMS mit 5.644 Zeichen, mal der
    // Vorschau-Rahmen mit 13 Elementen) und die Ergebnisse widersprechen sich,
    // ohne dass sich an der Seite etwas geaendert haette.
    if (bester && meiste < seiteText * 1.5) {
      console.log(`# Rahmen verworfen: ${meiste} Zeichen gegen ${seiteText} der Seite — zu knapp.`);
      bester = null;
    }
    if (bester) rahmenId = bester;
  }
  console.log(`# Seite ${seiteId} ${treffer[0].url.slice(0, 90)}`);
  console.log(`# Rahmen ${rahmenId ?? '(keiner — Seite selbst)'}`);
}
if (!seiteId) { console.error('--auf <urlteil> oder --seite <id> fehlt (siehe --ziele).'); process.exit(1); }

const seite = verbinden(seiteId);
await seite.bereit;
const rahmen = rahmenId ? verbinden(rahmenId) : seite;
if (rahmenId) await rahmen.bereit;

let fehler = 0;
// Der Sitzungsrahmen wird auf BEIDE Dokumente gelegt: liegt die Oberflaeche in
// einem iframe, deckt der Rahmen des Top-Frames zwar das Fenster ab, ein Rahmen
// nur im iframe aber nicht die Raender daneben.
let rahmenStand = null; // letzter gemeldeter Zustand — nur Wechsel werden gedruckt

try {
  for (const b of befehle) {
    const trenn = b.indexOf(':');
    const art = trenn < 0 ? b : b.slice(0, trenn);
    const arg = trenn < 0 ? '' : b.slice(trenn + 1);
    console.log(`\n### ${art}${arg ? ' ' + arg.slice(0, 120) : ''}`);
    // Der Rahmen sagt laufend, WELCHER Schritt gerade dran ist. Ohne das ist
    // eine lange Sitzung fuer den Zuschauer eine Folge stummer Zuckungen.
    // Klartext statt Werkzeugbefehl: „bild /tmp/r1.png" sagt einem Zuschauer
    // nichts. Dazu der Fortschritt, damit erkennbar ist, ob die Sitzung laeuft
    // oder haengt.
    const WORT = {
      klick: 'Klick', dklick: 'Doppelklick', rklick: 'Rechtsklick', hover: 'Zeiger auf',
      klickauf: 'Klick auf', dklickauf: 'Doppelklick auf', rklickauf: 'Rechtsklick auf',
      hoverauf: 'Zeiger auf', tippe: 'Tippen', ersetze: 'Feld ersetzen', taste: 'Taste',
      scrolle: 'Scrollen', warte: 'Warten', wartetext: 'Warten auf', text: 'Text lesen',
      baum: 'Baum lesen', karte: 'Alles erfassen', erkunde: 'Menues oeffnen', hoverkarte: 'Hover-Elemente suchen', karteweg: 'Markierung weg', stil: 'Stil lesen', bild: 'Bildschirmfoto', js: 'JavaScript',
      jsseite: 'JavaScript (Seite)',
    };
    const nr = befehle.indexOf(b) + 1;
    const schild = `${nr}/${befehle.length}  ${WORT[art] ?? art}${arg ? ' · ' + arg.slice(0, 48) : ''}`;

    // Vor JEDEM Befehl neu setzen und nachsehen, ob er steht. Eine Navigation
    // baut das Dokument neu auf und raeumt die Anzeige weg; ohne diese Pruefung
    // laeuft die Sitzung ab da unsichtbar weiter und niemand erfaehrt es.
    const stand = await rahmenSichern(seite, schild);
    if (rahmenId) await rahmenSichern(rahmen, schild);
    if (stand !== rahmenStand) {
      if (stand !== true) console.log(`# Sichtanzeige: ${stand} — die Seite laeuft ohne sichtbaren Rahmen weiter.`);
      else if (rahmenStand !== null) console.log('# Sichtanzeige wieder da.');
      rahmenStand = stand;
    }
    // Ein fehlgeschlagener Befehl darf die SITZUNG nicht abbrechen. Vorher warf
    // ein ungueltiger Selektor einen Stack-Trace und riss alle folgenden
    // Schritte mit — bei einer Auslese ueber zwanzig Schritte war damit ein
    // Tippfehler das Ende. Der Fehler wird benannt und es geht weiter; nur
    // Verbindungsabbrueche (kein WebSocket) beenden noch alles.
    try {
    if (art === 'warte') { await schlaf(+arg); continue; }
    if (art === 'js') { const w = await auswerten(rahmen, arg); console.log(typeof w === 'string' ? w : JSON.stringify(w, null, 1)); continue; }
    if (art === 'jsseite') { const w = await auswerten(seite, arg); console.log(typeof w === 'string' ? w : JSON.stringify(w, null, 1)); continue; }
    if (art === 'text') { console.log(await auswerten(rahmen, TEXT_JS)); continue; }
    if (art === 'baum') { console.log(await auswerten(rahmen, BAUM_JS(arg || 'body'))); continue; }
    if (art === 'karte') {
      // Vollstaendiges Inventar der Ansicht — und zwar aus ALLEN Dokumenten
      // dieses Tabs, nicht nur aus dem gewaehlten Rahmen. Die Rahmenwahl ist
      // eine Heuristik; ein Bedienelement im jeweils anderen Dokument fehlte
      // sonst in der Karte, ohne dass irgendwo etwas gemeldet wuerde.
      const nurSichtbar = arg !== 'alle';
      const teile = [];
      const sammeln = async (v, herkunft) => {
        try {
          const roh = await auswerten(v, KARTE_JS(nurSichtbar));
          const liste = JSON.parse(roh);
          for (const f of liste) f.wo = herkunft;
          teile.push(...liste);
        } catch (e) {
          console.log(`# Karte aus ${herkunft} nicht lesbar: ${String(e?.message ?? e).split('\n')[0].slice(0, 70)}`);
        }
      };
      await sammeln(seite, 'Seite');
      if (rahmenId) await sammeln(rahmen, 'Rahmen');

      if (!teile.length) { console.log('nichts Bedienbares gefunden.'); continue; }

      // Im Bild markieren — nur auf ausdrueckliches --markieren.
      if (SICHTBAR && MARKIEREN) {
        await anzeigen(seite, MARKIEREN_JS(teile.filter((f) => f.wo === 'Seite')));
        if (rahmenId) await anzeigen(rahmen, MARKIEREN_JS(teile.filter((f) => f.wo === 'Rahmen')));
      }

      const nachArt = {};
      for (const f of teile) nachArt[f.art] = (nachArt[f.art] ?? 0) + 1;
      console.log(`${teile.length} Element(e): ` +
        Object.entries(nachArt).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '));
      console.log('');
      teile.forEach((f, i) => {
        const merk = [
          f.gesperrt && 'gesperrt', f.angehakt && 'angehakt', f.pflicht && 'Pflicht',
          f.nurLesen && 'nur lesen', f.fokus && 'Fokus',
          f.aufgeklappt === 1 && 'aufgeklappt', f.aufgeklappt === 0 && 'zugeklappt',
          f.oeffnetMenue && 'oeffnet Menue', f.ausserhalb && 'ausserhalb des Bildes',
          f.versteckt && 'NUR BEI HOVER (opacity:0)',
        ].filter(Boolean).join(', ');
        console.log(
          `${String(i + 1).padStart(3)}  ${f.art.padEnd(16)} ${(f.text || '—').padEnd(34)}` +
          `  ${String(f.x).padStart(5)},${String(f.y).padEnd(5)} ${f.b}x${f.h}  ${f.sel}` +
          (f.wert ? `  wert=„${f.wert}"` : '') +
          (f.ziel ? `  → ${f.ziel}` : '') +
          (f.quelle ? `  src=${f.quelle}` : '') +
          (merk ? `  [${merk}]` : ''),
        );
        if (f.optionen) console.log(`     Optionen: ${f.optionen.join(' | ')}`);
      });
      continue;
    }
    if (art === 'erkunde') {
      // Alles finden, was erst durch eine HANDLUNG entsteht. Die statische
      // Karte liest den DOM, wie er gerade ist — eine Oberflaeche mit Menues,
      // Kontextmenues und Zellen, die erst beim Klick zu Feldern werden, ist
      // damit zu neun Zehnteln unsichtbar.
      //
      // Vier Sonden je Element, weil jede etwas anderes aufdeckt:
      //   Linksklick  → Menues, Dropdowns, Dialoge, Reiterinhalte
      //   Rechtsklick → Kontextmenues (in keiner anderen Sonde sichtbar)
      //   Hover       → Menues, die nur beim Ueberfahren aufgehen
      //   Feldprobe   → Text, der beim Klick zum Eingabefeld wird
      //
      // Und REKURSIV: was ein Menue oeffnet, kann selbst Untermenues haben
      // (Framers `Reference ›`). Ohne das endet die Erkundung auf Ebene eins.
      const [tiefeRoh, maxRoh] = arg.split('|');
      const maxTiefe = Number(tiefeRoh || 2);
      const grenze = Number(maxRoh || 0); // 0 = keine Kappung

      const schluessel = (f) => f.art + '|' + f.text + '|' + Math.round(f.x / 8) + ',' + Math.round(f.y / 8);
      const karte = async () => JSON.parse(await auswerten(rahmen, KARTE_JS(true)));

      const leerStelle = async () => auswerten(rahmen, `(() => {
        for (let y = 80; y < Math.min(innerHeight - 60, 900); y += 40) {
          for (let x = 40; x < innerWidth - 40; x += 60) {
            const e = document.elementFromPoint(x, y);
            if (!e) continue;
            if (e.closest('button,a,input,select,textarea,[role=button],[role=menuitem],[role=tab],[role=option]')) continue;
            return x + ',' + y;
          }
        }
        return '';
      })()`);

      const roh = await leerStelle();
      const [lx, ly] = String(roh || '').split(',').map(Number);
      const zu = async () => {
        // NIE Escape: das verlaesst in Editor-Oberflaechen die ganze Ansicht
        // (im Framer-CMS landet man im Canvas). Klick auf eine leere Stelle.
        if (Number.isFinite(lx)) { await maus(seite, lx, ly, 'links', 1, 'schliessen'); await schlaf(220); }
      };

      const basis = await karte();
      const bekannt = new Set(basis.map(schluessel));
      const ergebnis = [];
      let sonden = 0;

      // Eine Stelle mit allen vier Sonden pruefen. Gibt zurueck, was neu war.
      const pruefe = async (f, pfad, tiefe) => {
        const vx = f.x + (rahmenId ? versatz.x : 0);
        const vy = f.y + (rahmenId ? versatz.y : 0);
        const gefunden = [];

        const sonde = async (welche, tun) => {
          sonden += 1;
          try {
            await tun();
            await schlaf(welche === 'Hover' ? 550 : 420);
            const jetzt = await karte();
            const neu = jetzt.filter((g) => !bekannt.has(schluessel(g)));
            for (const g of neu) { bekannt.add(schluessel(g)); g.durch = welche; g.pfad = pfad; }
            if (neu.length) {
              console.log(`${'  '.repeat(tiefe)}▸ ${welche} auf ${f.art} „${f.text || f.sel}" → ${neu.length}`);
              for (const g of neu) {
                console.log(`${'  '.repeat(tiefe)}    ${g.art.padEnd(15)} ${(g.text || '—').padEnd(36)} ${String(g.x).padStart(5)},${String(g.y).padEnd(5)} ${g.sel}` +
                  (g.wert ? `  wert=„${g.wert}"` : '') +
                  (g.oeffnetMenue ? '  [oeffnet Menue]' : '') +
                  (g.optionen ? `  [${g.optionen.join(' | ')}]` : ''));
              }
              gefunden.push(...neu);
            }
            return neu;
          } catch (e) {
            console.log(`${'  '.repeat(tiefe)}  (${welche} auf „${f.text || f.sel}": ${String(e?.message ?? e).split('\n')[0].slice(0, 55)})`);
            return [];
          }
        };

        const nachKlick = await sonde('Klick', () => maus(seite, vx, vy, 'links', 1, `${pfad} · Klick`));

        // Rekursion: was gerade aufging, kann selbst Untermenues haben.
        // Nur was danach aussieht, sonst explodiert die Zahl der Sonden.
        if (tiefe < maxTiefe) {
          const weiter = nachKlick.filter((g) =>
            g.oeffnetMenue || g.aufgeklappt === 0 ||
            ['Menueeintrag', 'Reiter', 'Auswahlfeld', 'Aufklapper'].includes(g.art));
          for (const g of weiter) await pruefe(g, `${pfad} › ${g.text || g.sel}`, tiefe + 1);
        }
        await zu();

        await sonde('Rechtsklick', () => maus(seite, vx, vy, 'rechts', 1, `${pfad} · Rechtsklick`));
        await zu();

        await sonde('Hover', () => maus(seite, vx, vy, 'hover', 1, `${pfad} · Hover`));
        await zu();

        // Feldprobe ORTSGENAU: nicht „hat irgendwas den Fokus", sondern „ist an
        // GENAU DIESER Stelle jetzt etwas Beschreibbares". Die frueher gebaute
        // Fokus-Abfrage meldete das Vorschau-Breitenfeld als Treffer fuer eine
        // Tabellenzelle am anderen Ende der Seite — ein Fund, der nichts mit
        // der geprueften Stelle zu tun hatte.
        if (f.text && f.b > 30) {
          sonden += 1;
          try {
            await maus(seite, vx, vy, 'links', 1, `${pfad} · Feldprobe`);
            await schlaf(300);
            const w = await auswerten(rahmen, `(() => {
              const e = document.elementFromPoint(${f.x}, ${f.y});
              if (!e) return '';
              const k = e.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"]');
              if (!k) return '';
              const r = k.getBoundingClientRect();
              return JSON.stringify({
                tag: k.tagName.toLowerCase(),
                typ: k.type || (k.isContentEditable ? 'contenteditable' : ''),
                wert: String(k.value ?? k.textContent ?? '').slice(0, 60),
                platzhalter: k.placeholder || '',
                fokus: k === document.activeElement ? 1 : 0,
                x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
              });
            })()`);
            if (w) {
              const d = JSON.parse(w);
              console.log(`${'  '.repeat(tiefe)}  ✎ „${f.text}" ist bei Klick <${d.tag}${d.typ ? ' ' + d.typ : ''}>` +
                (d.wert ? `  wert=„${d.wert}"` : '') +
                (d.platzhalter ? `  platzhalter=„${d.platzhalter}"` : '') +
                (d.fokus ? '  [hat Fokus]' : '  [ohne Fokus]'));
              gefunden.push({ ...f, art: 'Feld-bei-Klick', durch: 'Feldprobe', pfad });
            }
            await zu();
          } catch { /* Stelle antwortet nicht */ }
        }

        return gefunden;
      };

      // Geprueft wird ALLES, was eine Handlung tragen koennte — nicht nur eine
      // Auswahl. Reine Beschriftungen (kein Text, winzig) fallen weg.
      let ziele = basis.filter((f) => f.b >= 8 && f.h >= 8 && !['RAHMEN'].includes(f.art));
      if (grenze > 0 && ziele.length > grenze) {
        console.log(`# ${ziele.length} Ziele, gekappt auf ${grenze} (Angabe im Befehl). Der Rest bleibt UNGEPRUEFT.`);
        ziele = ziele.slice(0, grenze);
      }
      console.log(`${ziele.length} Stellen × 4 Sonden, Tiefe bis ${maxTiefe}. Ausgangslage: ${basis.length} Elemente.\n`);

      for (const f of ziele) {
        const g = await pruefe(f, f.text || f.sel, 0);
        ergebnis.push(...g);
      }

      const nachArt = {};
      for (const g of ergebnis) nachArt[g.art] = (nachArt[g.art] ?? 0) + 1;
      const nachSonde = {};
      for (const g of ergebnis) nachSonde[g.durch] = (nachSonde[g.durch] ?? 0) + 1;
      console.log(`\n${ergebnis.length} Element(e) gefunden, die ohne Handlung unsichtbar sind — aus ${sonden} Sonden.`);
      if (ergebnis.length) {
        console.log(`  nach Art:   ${Object.entries(nachArt).sort((x, y) => y[1] - x[1]).map(([k, n]) => k + ' ' + n).join(', ')}`);
        console.log(`  nach Sonde: ${Object.entries(nachSonde).sort((x, y) => y[1] - x[1]).map(([k, n]) => k + ' ' + n).join(', ')}`);
      }
      if (!Number.isFinite(lx)) console.log('# Keine leere Stelle zum Schliessen gefunden — Menues blieben moeglicherweise offen.');
      continue;
    }
    if (art === 'hoverkarte') {
      // Elemente, die es nur beim Ueberfahren gibt: Zeilen-Aktionsicons
      // (Loeschen, Duplizieren, Griff zum Verschieben), Werkzeugleisten an
      // Karten, Tooltip-Knoepfe. Sie stehen mit `opacity:0` oder gar nicht im
      // DOM, solange die Maus woanders ist — `karte:` sieht sie deshalb nie.
      //
      // Abgefahren wird ein RASTER, nicht eine Elementliste: das Icon gehoert
      // oft zu einer Zeile, die selbst kein erkanntes Bedienelement ist.
      const schritt = Number(arg || 40);
      const vorher = JSON.parse(await auswerten(rahmen, KARTE_JS(true)));
      const schluessel = (f) => f.art + '|' + f.text + '|' + Math.round(f.x / 6) + ',' + Math.round(f.y / 6);
      const bekannt = new Set(vorher.map(schluessel));

      const masse = JSON.parse(await auswerten(rahmen,
        '(() => JSON.stringify({b: innerWidth, h: innerHeight}))()'));
      const punkte = [];
      for (let y = 30; y < masse.h - 20; y += schritt) {
        for (let x = 30; x < masse.b - 20; x += Math.max(schritt * 3, 120)) punkte.push([x, y]);
      }

      console.log(`${punkte.length} Rasterpunkte ueberfahren (Schritt ${schritt} px). Ausgangslage: ${vorher.length} Elemente.\n`);

      const gefunden = [];
      for (const [x, y] of punkte) {
        try {
          // Nur bewegen, nicht klicken — ein Klick wuerde die Seite veraendern.
          await seite.senden('Input.dispatchMouseEvent', {
            type: 'mouseMoved', x: x + (rahmenId ? versatz.x : 0), y: y + (rahmenId ? versatz.y : 0),
            button: 'none', buttons: 0,
          });
          await schlaf(120);
          const jetzt = JSON.parse(await auswerten(rahmen, KARTE_JS(true)));
          const neu = jetzt.filter((f) => !bekannt.has(schluessel(f)) && !f.versteckt);
          for (const f of neu) {
            bekannt.add(schluessel(f));
            f.beiHover = `${x},${y}`;
            gefunden.push(f);
            console.log(`  ▸ bei ${String(x).padStart(4)},${String(y).padEnd(4)} erscheint  ${f.art.padEnd(14)} ${(f.text || '—').padEnd(30)} ${f.x},${f.y}  ${f.sel}`);
          }
        } catch (e) {
          console.log(`  (${x},${y}: ${String(e?.message ?? e).split('\n')[0].slice(0, 50)})`);
        }
      }

      // Zusaetzlich: was schon in der Karte stand, aber als NUR-BEI-HOVER
      // markiert ist. Das sind die mit opacity:0 — sie sind im DOM, aber
      // unsichtbar, bis die Maus die Zeile trifft.
      const stumme = vorher.filter((f) => f.versteckt);
      if (stumme.length) {
        console.log(`\n${stumme.length} Element(e) stehen mit opacity:0 im DOM (erscheinen bei Hover):`);
        for (const f of stumme) {
          console.log(`     ${f.art.padEnd(14)} ${(f.text || '—').padEnd(30)} ${f.x},${f.y}  ${f.sel}`);
        }
      }

      console.log(`\n${gefunden.length} Element(e) erscheinen erst beim Ueberfahren, ${stumme.length} liegen unsichtbar bereit.`);
      if (SICHTBAR && MARKIEREN && (gefunden.length || stumme.length)) {
        await anzeigen(rahmen, MARKIEREN_JS([...gefunden, ...stumme]));
      }
      continue;
    }
    if (art === 'karteweg') {
      await auswerten(seite, KARTE_WEG_JS);
      if (rahmenId) await auswerten(rahmen, KARTE_WEG_JS);
      console.log('Markierungen entfernt.');
      continue;
    }
    if (art === 'stil') { console.log(await auswerten(rahmen, STIL_JS(arg))); continue; }
    if (art === 'bild') {
      const r = await seite.senden('Page.captureScreenshot', { format: 'png' });
      const fs = await import('node:fs/promises');
      await fs.writeFile(arg, Buffer.from(r.data, 'base64'));
      console.log(`gespeichert: ${arg}`);
      continue;
    }
    if (art === 'ersetze') {
      // Feld leeren und neu tippen. `tippe:` haengt an — wer damit zweimal in
      // dasselbe Feld schreibt, bekommt „hotelhotel" und merkt es nur im Bild.
      // Geleert wird ueber echte Tastendruecke (Cmd+A, Backspace), nicht ueber
      // `el.value = ''`: gesetzte Werte loesen kein `input`-Ereignis aus, React
      // und jede Vorschlagsliste bekommen davon nichts mit.
      // modifiers: 8 = Meta (Cmd). Auf macOS ist Ctrl+A NICHT „alles markieren",
      // sondern „Zeilenanfang" — mit modifiers:4 blieb der Text stehen und der
      // neue wurde davorgehaengt. Der Unterschied faellt nur im Bild auf.
      const META = process.platform === 'darwin' ? 8 : 2;
      await seite.senden('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers: META, windowsVirtualKeyCode: 65, key: 'a', code: 'KeyA', commands: process.platform === 'darwin' ? ['selectAll'] : undefined });
      await seite.senden('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: META, windowsVirtualKeyCode: 65, key: 'a', code: 'KeyA' });
      await schlaf(80);
      await seite.senden('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 8, key: 'Backspace' });
      await seite.senden('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 8, key: 'Backspace' });
      await schlaf(80);
      for (const c of arg) {
        await seite.senden('Input.dispatchKeyEvent', { type: 'keyDown', text: c });
        await seite.senden('Input.dispatchKeyEvent', { type: 'keyUp', text: c });
        await schlaf(25);
      }
      console.log(`ersetzt durch: ${arg}`);
      continue;
    }
    if (art === 'tippe') {
      for (const c of arg) {
        await seite.senden('Input.dispatchKeyEvent', { type: 'keyDown', text: c });
        await seite.senden('Input.dispatchKeyEvent', { type: 'keyUp', text: c });
        await schlaf(25);
      }
      console.log('getippt');
      continue;
    }
    if (art === 'taste') {
      // Mit Modifiern: `taste:Meta+z` (Rückgängig), `taste:Shift+Alt+ArrowUp`.
      // CDP-Bits: Alt 1, Ctrl 2, Meta 4, Shift 8. Gebraucht am 05.09.2026, um
      // einen versehentlichen Klick auf Framers „Layout +" (löscht das Stack-
      // Layout!) per ⌘Z zurückzunehmen — ohne Modifier gab es keinen Rückweg.
      const teile = arg.split('+');
      const taste = teile.pop();
      const bits = { Alt: 1, Ctrl: 2, Control: 2, Meta: 4, Cmd: 4, Shift: 8 };
      const modifiers = teile.reduce((m, t) => m | (bits[t] ?? 0), 0);
      const karte = { Enter: 13, Tab: 9, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Backspace: 8, Space: 32, Delete: 46 };
      const code = karte[taste] ?? (taste.length === 1 ? taste.toUpperCase().charCodeAt(0) : 0);
      const codeName = taste.length === 1 ? 'Key' + taste.toUpperCase() : taste;
      await seite.senden('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers, windowsVirtualKeyCode: code, key: taste, code: codeName });
      await seite.senden('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, windowsVirtualKeyCode: code, key: taste, code: codeName });
      console.log('Taste ' + arg);
      continue;
    }
    if (art === 'scrolle') {
      // Echtes Mausrad statt `scrollTop=`: virtualisierte Listen (Framer-CMS,
      // jede lange Tabelle) laden beim Rad nach, beim gesetzten Wert nicht.
      const [x, y, dy] = arg.split(',').map(Number);
      await seite.senden('Input.dispatchMouseEvent', {
        type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy ?? 400,
      });
      console.log(`gescrollt ${dy ?? 400} bei ${x},${y}`);
      continue;
    }
    if (art === 'wartetext') {
      // Auf einen Text warten statt auf eine feste Zeit. Feste Wartezeiten
      // messen Renderlatenz mit und flattern (dieselbe Lehre wie beim
      // GA4-Gate: auf das Ereignis warten, nicht auf die Uhr).
      const [text, maxRoh] = arg.split('|');
      const max = Number(maxRoh ?? 5000);
      const bis = Date.now() + max;
      let da = false;
      while (Date.now() < bis) {
        const t = await auswerten(rahmen, TEXT_JS);
        if (typeof t === 'string' && t.includes(text)) { da = true; break; }
        await schlaf(150);
      }
      console.log(da ? `da: „${text}"` : `NICHT ERSCHIENEN binnen ${max} ms: „${text}"`);
      continue;
    }
    if (['klick', 'dklick', 'rklick', 'hover'].includes(art)) {
      const [x, y] = arg.split(',').map(Number);
      await maus(seite, x, y, art === 'rklick' ? 'rechts' : art === 'hover' ? 'hover' : 'links', art === 'dklick' ? 2 : 1, WORT[art] ?? art);
      console.log(`${art} bei ${x},${y}`);
      continue;
    }
    if (['klickauf', 'rklickauf', 'hoverauf', 'dklickauf'].includes(art)) {
      // In BEIDEN Dokumenten suchen. Die Rahmenwahl ist eine Heuristik und
      // greift regelmaessig daneben (ein Cookie-Banner-iframe traegt mehr Text
      // als die Startseite dahinter) — dann fand `klickauf` nichts, obwohl das
      // Element vor der Nase lag. Der Klick geht ohnehin an die SEITE, ein
      // Treffer im Rahmen ist also kein Sonderfall, sondern nur eine zweite
      // Quelle fuer dasselbe Rechteck.
      let roh = await auswerten(rahmen, RECT_JS(arg));
      let quelle = 'Rahmen';
      if ((!roh || roh === 'UNSICHTBAR') && rahmenId) {
        const zweit = await auswerten(seite, RECT_JS(arg));
        if (zweit && zweit !== 'UNSICHTBAR') { roh = zweit; quelle = 'Seite'; }
      }
      if (!roh || roh === 'UNSICHTBAR') { console.log(`NICHT KLICKBAR (${roh ?? 'nicht gefunden'}): ${arg}`); continue; }
      const p = JSON.parse(roh);
      const v = quelle === 'Rahmen' ? versatz : { x: 0, y: 0 };
      const x = p.x + v.x, y = p.y + v.y;
      await anzeigen(quelle === 'Rahmen' ? rahmen : seite, RAHMEN_JS({ l: Math.round(p.l), t: Math.round(p.t), w: Math.round(p.w), h: Math.round(p.h) }));
      await maus(seite, x, y, art === 'rklickauf' ? 'rechts' : art === 'hoverauf' ? 'hover' : 'links', art === 'dklickauf' ? 2 : 1, `${WORT[art] ?? art} · ${arg.slice(0, 40)}`);
      console.log(`${art} bei ${Math.round(x)},${Math.round(y)}  → ${arg}  [${quelle}]`);
      continue;
    }
    console.log(`unbekannter Befehl: ${art}`);
    } catch (e) {
      if (/kein WebSocket|WebSocket geschlossen/.test(String(e?.message))) throw e;
      console.log(`FEHLGESCHLAGEN (${art}): ${String(e?.message ?? e).split('\n')[0]}`);
      fehler += 1;
    }
  }
} finally {
  // Der SEITENRAHMEN bleibt stehen, solange der Tab offen ist — er ist die
  // Kennzeichnung „dieser Tab wird ferngesteuert", nicht eine Animation zum
  // Lauf. Vorher loeschte dieser Block ihn beim Beenden: waehrend der Sitzung
  // war er in jedem Bildschirmfoto zu sehen, danach weg, und ich meldete
  // trotzdem „steht" (28.08.2026, vom Nutzer widerlegt).
  //
  // Entfernt werden nur die punktuellen Anzeigen — Zeigerpunkt und
  // Element-Rahmen —, die ohne laufende Sitzung auf eine Stelle zeigen, an der
  // gerade nichts passiert. Zum vollstaendigen Entfernen: --aufraeumen.
  if (SICHTBAR) {
    try {
      await auswerten(seite, AUFRAEUMEN_JS);
      await auswerten(seite, KARTE_WEG_JS);
      await auswerten(seite, SITZUNG_JS('bereit'));
      // Der Zeiger bleibt an der letzten Klickstelle stehen und sagt das auch —
      // ein anonymer Punkt ohne Sitzung wirkt sonst wie ein Rest.
      await auswerten(seite, ZEIGER_LETZTER_JS);
    } catch { /* Tab schon zu */ }
    if (rahmenId) {
      try {
        await auswerten(rahmen, AUFRAEUMEN_JS);
        await auswerten(rahmen, KARTE_WEG_JS);
        await auswerten(rahmen, SITZUNG_JS('bereit'));
      } catch { /* dito */ }
    }
  }
  if (AUFRAEUMEN) {
    try { await auswerten(seite, ALLES_WEG_JS); } catch { /* Tab schon zu */ }
    if (rahmenId) { try { await auswerten(rahmen, ALLES_WEG_JS); } catch { /* dito */ } }
    console.log('# Alle Anzeigen entfernt.');
  }
  if (fehler) console.log(`\n# ${fehler} Befehl(e) fehlgeschlagen — siehe FEHLGESCHLAGEN oben.`);
  seite.ws.close();
  if (rahmenId) rahmen.ws.close();
}
