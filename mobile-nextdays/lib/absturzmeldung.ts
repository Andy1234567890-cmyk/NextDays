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
// KEIN Absenden an einen Dienst: solange kein Crash-Reporting eingerichtet ist,
// waere jeder Netzaufruf von hier eine Erfindung. Diese Datei ist die EINE
// Stelle, an der ein solcher Aufruf spaeter hinzukommt (Crashlytics) — dann an
// genau einer Stelle statt an dreissig.

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
  // `dumpsys dropbox` landet und die einzige Spur bleibt, solange kein
  // Crash-Reporting laeuft. Fuer den Kunden unsichtbar.
  console.error("[absturz]", kurz(fehler));
  if (__DEV__) {
    if (fehler instanceof Error && fehler.stack) console.error(fehler.stack);
    if (komponentenkette) console.error(komponentenkette);
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
