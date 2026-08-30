// SCHWESTERDATEI: die gleichnamige Datei der Schwester-App — byte-identisch halten.
//
// EINE Stelle, an der ein Absturz protokolliert wird.
//
// WARUM ES DIESE DATEI GIBT
// =========================
// Vor dem 28.08.2026 gab es KEINE: kein Crashlytics, kein Sentry, keine
// Fehlergrenze, keinen globalen Handler. Jeder unbehandelte Fehler war damit
// ein stiller Prozessabbruch — Samsungs Geraetewartung meldete „myNextDays
// stuerzt haeufig ab", und es existierte nirgends ein Stacktrace, aus dem sich
// die Ursache haette ablesen lassen. Ein Fehler ohne Spur ist derselbe Fehler
// wie ein verschluckter Exception (Wurzel 5).
//
// WAS DER KUNDE DAVON MITBEKOMMT: NICHTS.
// =======================================
// Das ist keine Absicht, sondern hier erzwungen:
//   - Diese Datei zeigt NIE etwas an. Sie hat keine UI, kein Alert, kein Toast.
//     Was der Kunde sieht, entscheidet ausschliesslich `Fehlergrenze.tsx` —
//     dort eine ruhige Meldung mit Knopf, ohne Stacktrace, ohne Kennung.
//   - `console.error`/`console.warn` schreiben in `adb logcat`, nicht auf den
//     Bildschirm. Ein Release-Build hat keinen roten Schirm und keine
//     LogBox — beide sind an `__DEV__` gebunden und im Release nicht gebaut.
//   - Die ausfuehrliche Ausgabe steht zusaetzlich hinter `__DEV__`, damit im
//     Release nicht einmal das Protokoll eines fremden Geraets die
//     Komponentenkette traegt.
//
// SEIT 30.08.2026 WIRD GESENDET — und warum das noetig wurde:
// ===========================================================
// Das Protokoll geht nach `adb logcat`. Auf dem Geraet eines Beta-Testers ist
// das dasselbe wie gar nichts: es liest nur, wer ein USB-Kabel und die
// Android-Werkzeuge hat. Der reale Verlauf (28.–30.08.2026): die App stuerzte
// beim Oeffnen ab, die Testerin sagte zu Recht „ich bin kein Entwickler und
// kann Dir diese Dinge nicht liefern" — und die eingebaute Diagnose konnte
// trotzdem nichts beitragen, weil niemand an sie herankam. Eine Diagnose, die
// nur mit Kabel lesbar ist, ist im Beta-Betrieb keine.
//
// Gesendet wird an `POST /diagnostics/startabsturz` — OHNE Anmeldung. Das ist
// der Kern: der regulaere Weg `/diagnostics/events` verlangt ein Token, und
// genau die gesuchten Abstuerze passieren, BEVOR eines existiert („Die geht
// kurz an und verschwindet augenblicklich sofort wieder"). Ein Meldeweg mit
// Token-Zwang bekommt diese Klasse Fehler per Konstruktion nie zu sehen.
//
// Streng best-effort: kein `await` im Absturzpfad, keine Wiederholung, jeder
// Fehler beim Senden wird verschluckt. Was hier wirft, waere ein Absturz
// WAEHREND der Absturzbehandlung.

/**
 * Zeitpunkt des Modul-Ladens ≈ Prozessstart.
 *
 * MUSS vor jeder Verwendung stehen: `const` wird nicht hochgezogen, ein
 * Zugriff davor waere ein ReferenceError — im Absturzpfad also ein zweiter
 * Absturz. `index.js` laedt dieses Modul als erstes, der Wert liegt damit
 * dicht am echten Prozessstart.
 */
const PROZESS_START = Date.now();

/** Kurzform fuer das Protokoll: Meldung ohne Stacktrace, auf 200 Zeichen. */
function kurz(fehler: unknown): string {
  const text =
    fehler instanceof Error
      ? (fehler.message ?? String(fehler))
      : String(fehler);
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

/**
 * Einen Absturz protokollieren.
 *
 * @param fehler Der geworfene Wert — nicht zwingend ein `Error`.
 * @param komponentenkette Optionale React-Kette aus `componentDidCatch`.
 */
export function protokolliereAbsturz(
  fehler: unknown,
  komponentenkette?: string,
): void {
  // Immer, auch im Release: das ist die Zeile, die in `adb logcat` und in
  // `dumpsys dropbox` landet. Fuer den Kunden unsichtbar.
  console.error("[absturz]", kurz(fehler));
  if (__DEV__) {
    if (fehler instanceof Error && fehler.stack) console.error(fehler.stack);
    if (komponentenkette) console.error(komponentenkette);
  }
  absturzSenden(fehler, komponentenkette);
}

/**
 * Wie oft diese Sitzung schon gesendet hat.
 *
 * Ein Absturz kommt selten allein: reisst der Baum, feuern Fehlergrenze und
 * globaler Handler nacheinander, und eine kaputte Render-Schleife kann
 * dutzende Male werfen. Ohne Deckel waere das ein Sturm gegen die eigene API —
 * ausgerechnet aus einer App, die gerade abstuerzt. Fuenf reichen: die ERSTE
 * Meldung traegt die Ursache, alles danach ist Folgeschaden.
 */
let gesendet = 0;
const MAX_MELDUNGEN = 5;

/**
 * Den Absturz an die eigene API melden — ohne Anmeldung, ohne `await`.
 *
 * BEWUSST OHNE `lib/api.ts`: dieses Modul haengt an Konfiguration, Token und
 * Schluesselbund. Beim Startabsturz ist womoeglich genau das kaputt, was den
 * Absturz verursacht hat — der Meldeweg darf nicht dieselben Teile brauchen
 * wie der Weg, ueber den gestolpert wurde. Deshalb nacktes `fetch`.
 *
 * Auch bewusst: KEIN Token, keine Konto-Kennung. Was hier ankommt, ist
 * anonym; die Zuordnung geschieht ueber Zeitpunkt und Geraet. Ein Token, das
 * beim Startabsturz vielleicht gar nicht existiert, waere kein Gewinn.
 */
function absturzSenden(fehler: unknown, komponentenkette?: string): void {
  if (gesendet >= MAX_MELDUNGEN) return;
  gesendet += 1;
  try {
    // `require` statt Top-Level-Import: `lib/config` zieht die gitignorierte
    // `config.secrets` nach. Fehlt sie auf einem Arbeitsplatz, waere ein
    // Top-Level-Import ein Wurf beim LADEN dieser Datei — also ein Absturz in
    // genau dem Modul, das Abstuerze melden soll.
    const { CONFIG } = require("@/lib/config") as {
      CONFIG: { apiUrl: string };
    };
    const { Platform } = require("react-native") as {
      Platform: { OS: string; Version: string | number };
    };
    fetch(`${CONFIG.apiUrl}/api/v1/diagnostics/startabsturz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: [
          {
            app: "mobile",
            kind: "error",
            message: kurz(fehler),
            context: {
              // Der Stacktrace ist der eigentliche Wert der Meldung — ohne ihn
              // weiss man DASS es kracht, nicht WO. Er geht an unseren eigenen
              // Server, nicht auf den Bildschirm des Kunden.
              stack:
                fehler instanceof Error && fehler.stack
                  ? fehler.stack.slice(0, 4000)
                  : null,
              komponentenkette: komponentenkette?.slice(0, 2000) ?? null,
              plattform: Platform.OS,
              android: String(Platform.Version),
              // Trennt den Startabsturz vom Fehler mitten im Betrieb: die
              // ersten Sekunden nach dem Prozessstart sind genau das Fenster,
              // aus dem uns bisher jede Meldung fehlte.
              ms_seit_start: Date.now() - PROZESS_START,
            },
          },
        ],
      }),
    }).catch(() => {
      // Best-effort. Kein Netz, kein Server, keine Wiederholung — die App
      // stuerzt gerade ab, ein Fehler HIER waere der zweite Absturz.
    });
  } catch {
    // Ebenso: was beim Zusammenbauen der Meldung wirft, darf den
    // Absturzpfad nicht zusaetzlich kippen.
  }
}


/**
 * Die Absturz-Diagnose SELBST pruefen — auf einem echten Geraet.
 *
 * Warum es das gibt: dass protokolliert wird, laesst sich in Jest zeigen. Dass
 * es AUF DEM GERAET ankommt, nicht — dort haengt es an Dingen, die kein Test
 * kennt: ob `ErrorUtils` existiert, ob `console.error` wirklich in `adb
 * logcat` landet, und ob im Release-Build der Stacktrace tatsaechlich
 * wegbleibt. Genau diese Kette war am 28.08.2026 die Ursache dafuer, dass
 * niemand sagen konnte, warum die App abstuerzt.
 *
 * Loest KEINEN echten Absturz aus: die Fehler werden hier erzeugt und sofort
 * protokolliert, nicht geworfen. Die App laeuft weiter.
 *
 * Aufruf von aussen, ohne Codeaenderung und ohne Knopf in der Oberflaeche:
 *
 *     adb shell am broadcast -a com.mynextdays.PRUEFE_ABSTURZ
 *
 * Zu finden im Protokoll unter `[absturz]`.
 */
export function absturzDiagnosePruefen(): void {
  console.warn("[absturz-probe] Start");
  // 1) Gewoehnlicher Fehler mit Stacktrace.
  protokolliereAbsturz(new Error("Probe 1: gewoehnlicher Fehler"));
  // 2) Mit Komponentenkette — der Weg der Fehlergrenze.
  protokolliereAbsturz(new Error("Probe 2: mit Kette"), "<Root> <Probe>");
  // 3) Etwas, das kein `Error` ist (kommt aus fremden Modulen vor).
  protokolliereAbsturz("Probe 3: nur ein String");
  // 4) Ueberlange Meldung — muss gekuerzt ankommen.
  protokolliereAbsturz(new Error(`Probe 4: ${"x".repeat(400)}`));
  console.warn(
    `[absturz-probe] Fertig. __DEV__=${__DEV__} — im Release darf oben KEIN Stacktrace stehen.`,
  );
}

/**
 * Den globalen Handler setzen — das Netz UNTER der Fehlergrenze.
 *
 * Die Fehlergrenze faengt nur, was beim Rendern eines Kindes wirft. Sie faengt
 * NICHT: Fehler in Ereignis-Handlern, in `setTimeout`, in async-Funktionen und
 * unbehandelte Promise-Rejections. Genau diese Klasse brachte die App um
 * (`pushEinrichten` bei jedem Kaltstart). `ErrorUtils` ist die einzige Stelle,
 * an der man sie sieht.
 *
 * `fatal` bleibt fatal: ein echter Fehler soll die App weiterhin beenden, statt
 * sie in einem halb kaputten Zustand weiterlaufen zu lassen (Wurzel 5,
 * fail-closed). Neu ist nur, dass er vorher PROTOKOLLIERT wird.
 */
export function absturzHandlerSetzen(): void {
  // `ErrorUtils` ist ein React-Native-Global ohne Typdeklaration.
  const eu = (
    globalThis as unknown as {
      ErrorUtils?: {
        getGlobalHandler: () => (fehler: unknown, fatal?: boolean) => void;
        setGlobalHandler: (h: (fehler: unknown, fatal?: boolean) => void) => void;
      };
    }
  ).ErrorUtils;
  if (!eu) return;
  const vorher = eu.getGlobalHandler();
  eu.setGlobalHandler((fehler: unknown, fatal?: boolean) => {
    protokolliereAbsturz(fehler);
    // Den vorherigen Handler weiterrufen: im Debug-Build ist das der rote
    // Schirm. Ihn zu ersetzen hiesse, die Entwicklungsanzeige zu verlieren.
    vorher?.(fehler, fatal);
  });
  probeEmpfaengerSetzen();
}

/**
 * Die Probe von aussen ausloesbar machen.
 *
 * Ueber die Deep-Link-Kennung `mynextdays://absturz-probe` — sie braucht keinen
 * eigenen nativen Empfaenger und funktioniert auf jedem Geraet, auch beim
 * Beta-Tester:
 *
 *     adb shell am start -a android.intent.action.VIEW -d "mynextdays://absturz-probe"
 *
 * KEIN Knopf in der Oberflaeche: eine Absturz-Probe ist Werkzeug des Betriebs,
 * nicht des Kunden. Und kein Autostart: sie laeuft nur, wenn jemand sie ruft.
 */
function probeEmpfaengerSetzen(): void {
  const Linking = (
    require("react-native") as { Linking?: {
      addEventListener: (t: string, h: (e: { url: string }) => void) => void;
      getInitialURL: () => Promise<string | null>;
    } }
  ).Linking;
  if (!Linking) return;
  const pruefen = (url: string | null) => {
    if (url && url.includes("absturz-probe")) absturzDiagnosePruefen();
  };
  Linking.addEventListener("url", (e) => pruefen(e?.url ?? null));
  Linking.getInitialURL()
    .then(pruefen)
    .catch(() => {
      // Best-effort: die Probe ist Diagnose, kein Hauptpfad.
    });
}
