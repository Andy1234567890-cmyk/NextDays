// Meta-Pixel-Prüfung, die IM BROWSER läuft — kein Playwright.
//
// So wird sie ausgeführt — ausschließlich über den echten Browser, KEIN
// Playwright (ausdrückliche Anweisung vom 27.08.2026):
//
//   · Claude Chrome:  Seite öffnen, im Cookie-Dialog „Marketing-Cookies“
//     zustimmen, dann den Inhalt dieser Datei ab `(() => {` per
//     `javascript_tool` ausführen. Der Rückgabewert ist das Ergebnis; für die
//     Ausgabe im Werkzeug lohnt ein abschließendes `JSON.stringify(…)`, weil
//     `console.table` dort nicht sichtbar ist.
//   · DevTools:  ganze Datei in die Konsole einfügen — dort erscheint die
//     Tabelle direkt.
//
// Erwartung nach Zustimmung zu „Marketing-Cookies“: alles OK, `fehler: []`.
// Ohne Zustimmung läuft automatisch die Nullprobe (nichts darf existieren).
//
// Gegen den Live-Stand vom 27.08.2026 (vor dem Deploy der Behebung) meldete
// sie genau drei Fehler: „GENAU ein PageView“ (2 Treffer, 2789 ms und
// 3036 ms), „kein noscript-Zählbild“ und „fbq.push === fbq“. So sieht ein
// gefundener Fehler aus; so wurde diese Prüfung selbst validiert.
//
// WARUM IM BROWSER UND NICHT MIT EINEM TREIBER: Der Beweis für einen
// abgesetzten Treffer ist nur in der Seite selbst verlässlich zu holen.
// Playwright sieht den Beacon beim Verlassen der Seite nicht
// (microsoft/playwright#26660), und der Netzwerkmonitor einer
// Chrome-Erweiterung erfand am 27.08.2026 reproduzierbar HTTP-Fehler, die es
// nicht gab. Diese Prüfung liest deshalb ausschließlich, was der Browser selbst
// protokolliert hat: `performance.getEntriesByType("resource")` — das erfasst
// auch Treffer, die als BILD hinausgehen (Metas Treffer sind GET-Requests,
// `rqm=GET`, die kein fetch/XHR-Hook sieht).
//
// WAS SIE FINDET — drei Fehler, die live standen und alle drei stumm waren
// (27.08.2026, alle behoben):
//
//  1. DOPPELZÄHLUNG. lib/pixel.ts legte neben dem regulären Treffer ein
//     `<noscript>`-Zählbild per JavaScript an. Jeder Seitenaufruf sendete ZWEI
//     `ev=PageView` an dieselbe Pixel-ID (gemessen: Bild nach 1427 ms, echter
//     Treffer nach 2331 ms). Meta zählte jede Seite doppelt, und weil der
//     Bild-Treffer nur IP und User-Agent trug, führte Meta ihn als
//     „Selbstdefinierte Event“ statt als Standard-PageView. → Prüfung
//     „genau ein PageView“ und „kein noscript-Treffer“.
//
//  2. KONTOSEITIGE SPERRE. Der Pixel feuerte gar nicht, weil die
//     Datensatzkategorie im Ereignismanager zwei SENSIBLE Merkmale deklarierte
//     („Geschlecht oder Geschlechtsidentität, Nationalität“). Meta sperrt dann
//     die Verarbeitung — sichtbar AUSSCHLIESSLICH hier als
//     `fbq.instance.locks._locks.prohibited_pixels_<id>`. Metas Diagnose
//     schweigt, die Übersicht sagt nur „noch keine Aktivitäten“.
//     → Prüfung „kein prohibited_pixels-Lock“.
//
//  3. STUB MIT ARRAY STATT `arguments`. Derselbe Fehler wie zweimal bei gtag.
//     Bei Meta war er latent (fbevents.js arbeitet die Warteschlange mit
//     `apply` ab, das nimmt beides) — latent heißt: er wird wirksam, sobald
//     Meta die Bibliothek umbaut. → Prüfung „kein [object Array]“.
//
// GRENZE: Die Conversion-Events (Lead, Contact, CompleteRegistration) löst
// diese Prüfung NICHT aus — dafür müsste sie echte Voranmeldungen, echte
// Kontaktmails und echte Double-Opt-in-Bestätigungen erzeugen. Ihre
// Verdrahtung prüft `meta-pixel-verdrahtung-pruefen.mjs` am Quelltext.

(() => {
  const ergebnis = [];
  const fehler = [];
  const pruefe = (name, bedingung, zusatz = "") => {
    ergebnis.push({ pruefung: name, stand: bedingung ? "OK" : "FEHL", zusatz });
    if (!bedingung) fehler.push(name);
  };

  // --- Einwilligungsstand, damit die Erwartung überhaupt gilt --------------
  let auswahl = null;
  try {
    auswahl = JSON.parse(localStorage.getItem("nd_consent") ?? "null")?.auswahl ?? null;
  } catch {
    // Gesperrter Speicher zählt wie „nicht entschieden“ (lib/einwilligung.ts).
  }
  const marketing = auswahl?.marketing === true;

  // --- Treffer, die der Browser wirklich abgesetzt hat ---------------------
  const treffer = performance
    .getEntriesByType("resource")
    .filter((e) => e.name.includes("facebook.com/tr"))
    .map((e) => {
      const p = new URL(e.name).searchParams;
      return {
        ereignis: p.get("ev"),
        noscript: p.get("noscript") === "1",
        fbp: p.get("fbp"),
        pixel: p.get("id"),
        ms: Math.round(e.startTime),
      };
    });
  const seitenaufrufe = treffer.filter((t) => t.ereignis === "PageView");

  // --- Zustand von fbevents.js -------------------------------------------
  const f = window.fbq;
  const i = f?.instance;
  const zustand = {
    vorhanden: Boolean(f),
    geladen: Boolean(f?.loaded),
    warteschlange: f?.queue?.length ?? null,
    formen: (f?.queue ?? []).map((e) => Object.prototype.toString.call(e)),
    pushIstFbq: f?.push === f,
    ereignisZahl: f?.getState?.().pixels?.[0]?.eventCount ?? null,
    pixelIds: (f?.getState?.().pixels ?? []).map((p) => p.id),
    locks: i?.locks?._locks ? Object.keys(i.locks._locks) : [],
    ersteAnfrageFehlt: i?.pendingConfigs ?? null,
  };
  const fbpWert = (document.cookie.match(/_fbp=([^;]+)/) ?? [])[1] ?? null;

  if (!marketing) {
    // Der Gegentest: OHNE Einwilligung darf nichts davon existieren.
    console.log("Einwilligung „marketing“ ist NICHT erteilt — es gilt die Nullprobe.");
    pruefe("kein fbq-Objekt", !zustand.vorhanden);
    pruefe("kein /tr-Treffer", treffer.length === 0, `${treffer.length} Treffer`);
    pruefe("kein _fbp-Cookie", fbpWert === null, fbpWert ?? "");
    console.table(ergebnis);
    return { modus: "ohne Einwilligung", ok: fehler.length === 0, fehler, treffer };
  }

  // --- Erwartung MIT Einwilligung ----------------------------------------
  pruefe("fbq vorhanden", zustand.vorhanden);
  pruefe("fbevents.js geladen", zustand.geladen);
  pruefe("mindestens ein PageView", seitenaufrufe.length > 0);
  pruefe(
    "GENAU ein PageView (keine Doppelzählung)",
    seitenaufrufe.length === 1,
    `${seitenaufrufe.length} Treffer: ${seitenaufrufe.map((t) => t.ms + "ms").join(", ")}`,
  );
  pruefe(
    "kein noscript-Zählbild",
    !treffer.some((t) => t.noscript),
    treffer.some((t) => t.noscript) ? "Zählbild ist zurück" : "",
  );
  pruefe(
    "Treffer trägt fbp-Parameter",
    seitenaufrufe.some((t) => t.fbp),
    seitenaufrufe.map((t) => t.fbp ?? "—").join(", "),
  );
  pruefe("_fbp-Cookie gesetzt", fbpWert !== null);
  pruefe(
    "_fbp hat Metas Form fb.1.<ms>.<zahl>",
    /^fb\.1\.\d{13}\.\d+$/.test(fbpWert ?? ""),
    fbpWert ?? "kein Wert",
  );
  pruefe(
    "Warteschlange abgearbeitet",
    zustand.warteschlange === 0,
    `${zustand.warteschlange} offen`,
  );
  pruefe(
    "mindestens ein Event verarbeitet",
    (zustand.ereignisZahl ?? 0) >= 1,
    `eventCount ${zustand.ereignisZahl}`,
  );
  const gesperrt = zustand.locks.filter((n) => n.startsWith("prohibited_pixels"));
  pruefe(
    "kein prohibited_pixels-Lock",
    gesperrt.length === 0,
    gesperrt.join(", ") || "keine Locks",
  );
  pruefe(
    "kein Warteschlangen-Eintrag ist [object Array]",
    !zustand.formen.includes("[object Array]"),
    zustand.formen.join(", ") || "Warteschlange leer",
  );
  pruefe("fbq.push === fbq (Metas Vorlage)", zustand.pushIstFbq);

  console.table(ergebnis);
  if (gesperrt.length) {
    console.warn(
      "Meta SPERRT diesen Pixel. Ereignismanager → Einstellungen →\n" +
        "„Kategorien für Datensätze“ → Bearbeiten: jede SENSIBLE Kategorie\n" +
        "entfernen (richtig ist hier „Keine“). Wirkt mit Verzögerung, weil\n" +
        "Meta die Signals-Config zwischenspeichert.",
    );
  }

  return {
    modus: "mit Einwilligung marketing",
    ok: fehler.length === 0,
    fehler,
    treffer,
    zustand,
    fbpWert,
  };
})();
