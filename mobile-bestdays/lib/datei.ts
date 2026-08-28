// SCHWESTERDATEI: die gleichnamige Datei der Schwester-App — byte-identisch halten.
//
// Eine Datei aus dem System-Dateiwaehler holen — die EINE Stelle, an der diese
// App den Dokumentenwaehler anspricht. Das Gegenstueck zu `lib/foto.ts`, das
// dasselbe fuer Kamera und Galerie tut.
//
// WARUM ES DIESE DATEI GIBT
// =========================
// Bis 28.08.2026 hatte die App keinen Dateiwaehler. Die Anhang-Ansicht des
// Posteingangs sagte deshalb woertlich „Hochladen geht derzeit nur im Dashboard
// — der App fehlt die Dateiauswahl". Der Bildwaehler allein reichte nicht: der
// Server nimmt FUENF Typen an (JPG, PNG, WebP, GIF und PDF), und gerade das PDF
// ist im Betrieb der haeufigste Anhang — Rechnung, Grundriss, Anfahrtsskizze.
//
// WAS HIER NICHT PASSIERT
// =======================
// Keine Typpruefung anhand des vom System gemeldeten MIME-Typs. Der ist frei
// waehlbar und damit kein Schutz (Wurzel 8); entschieden wird serverseitig ueber
// die Magic-Bytes (`_dateityp` in `apps/api/.../inbox/anhaenge.py`). Die
// `type`-Angabe unten ist deshalb ein HINWEIS an den Waehler, keine Zusicherung.
//
// Die Groessenpruefung dagegen passiert hier: der Server antwortet sonst mit 413,
// nachdem das Geraet die Datei bereits vollstaendig hochgeladen hat — im
// Mobilfunknetz sind das Minuten fuer eine Absage, die vorher feststand.
//
// WARUM `require` STATT `import`
// ==============================
// `@react-native-documents/picker` greift schon beim LADEN des Moduls auf die
// native Seite zu (`TurboModuleRegistry.getEnforcing('RNDocumentPicker')` in
// seiner `NativeDocumentPicker.ts`). Ein Top-Level-`import` zieht das in jede
// Datei, die `lib/datei` irgendwo in ihrer Kette hat — hier ueber
// `AntwortWerkzeuge` → `HostInbox` → `HostTabs` → `App`, also in den GESAMTEN
// Baum, obwohl eine Dateiauswahl zu diesem Zeitpunkt niemand braucht.
//
// Das ist nicht bloss unsauber, es ist ein Absturz: laeuft die App auf einem
// Build, in dem das native Modul (noch) nicht steckt, wirft dieser Zugriff
// beim Start — vor jedem Bildschirm. Beim Einbau brachen daran sofort zwei
// Test-Suiten, darunter `App.test.tsx`, das mit Dateiauswahl nichts zu tun
// hat: dieselbe Wurzel, die am 28.08.2026 `getMessaging()` in `index.js`
// hatte. Dasselbe Muster wie `fcm()` in `lib/push.ts`.
type PickerModul = typeof import("@react-native-documents/picker");

function picker(): PickerModul {
  return require("@react-native-documents/picker");
}

/** Wie React Native eine Datei fuer `FormData` erwartet: kein `Blob`, kein
 *  `File`, sondern genau dieses Objekt. Gleiche Form wie `Bilddatei` in
 *  `lib/tasks.ts` — bewusst nicht wiederverwendet, damit `lib/datei.ts` ohne
 *  den Aufgaben-Slice steht. */
export type Anhangdatei = { uri: string; name: string; type: string };

export type DateiErgebnis =
  | { art: "datei"; datei: Anhangdatei }
  | { art: "abgebrochen" }
  | { art: "fehler"; text: string };

/** Die Grenze des Servers (`_ANHANG_MAX_BYTES`), hier gespiegelt. Aendert sie
 *  sich dort, muss sie hier mit — sonst laeuft der Nutzer in einen 413. */
const MAX_BYTES = 10 * 1024 * 1024;


/**
 * Eine Datei waehlen lassen.
 *
 * Vier Ausgaenge, die alle unterschiedlich behandelt werden muessen — genau wie
 * beim Bildwaehler: Datei da, Nutzer hat abgebrochen, Datei zu gross,
 * technischer Fehler. Ein Aufrufer, der das inline macht, verwechselt
 * „abgebrochen" mit „fehlgeschlagen" und zeigt eine Fehlermeldung, wo der
 * Nutzer bloss zurueckgetippt hat.
 */
export async function dateiWaehlen(): Promise<DateiErgebnis> {
  let antwort;
  let p: PickerModul | null = null;
  try {
    p = picker();
    // Genau das, was der Anhang-Endpunkt annimmt. Nicht `allFiles`: ein
    // Waehler, der alles anbietet und dann 422 sagt, ist eine Falle.
    antwort = await p.pick({
      type: [p.types.images, p.types.pdf],
      allowMultiSelection: false,
    });
  } catch (e) {
    // `p` ist `null`, wenn der `require` SELBST warf — dann fehlt das native
    // Modul im Build, und das ist kein Abbruch durch den Nutzer.
    if (p && p.isErrorWithCode(e)) {
      // Abbrechen ist KEIN Fehler: dieses Modul wirft dafuer, andere geben
      // einen Wert zurueck. Hier wird daraus der regulaere Ausgang.
      if (e.code === p.errorCodes.OPERATION_CANCELED) {
        return { art: "abgebrochen" };
      }
      // Doppeltipp auf den Knopf: der erste Waehler laeuft noch.
      if (e.code === p.errorCodes.IN_PROGRESS) {
        return { art: "abgebrochen" };
      }
    }
    return { art: "fehler", text: "Die Dateiauswahl ließ sich nicht öffnen." };
  }

  const [d] = antwort;
  // Der Waehler kann eine Auswahl OHNE Datei zurueckgeben (Nutzer tippt
  // „Fertig" ohne Auswahl auf manchen Android-Oberflaechen).
  if (!d) return { art: "abgebrochen" };
  if (d.error) {
    return { art: "fehler", text: "Die Datei ließ sich nicht lesen." };
  }
  if (typeof d.size === "number" && d.size > MAX_BYTES) {
    // Vor dem Upload, nicht danach: der Server antwortet sonst 413, nachdem
    // das Geraet alles hochgeladen hat.
    const mb = Math.round(d.size / (1024 * 1024));
    return {
      art: "fehler",
      text: `Die Datei ist zu groß (${mb} MB, erlaubt sind 10 MB).`,
    };
  }
  return {
    art: "datei",
    datei: {
      uri: d.uri,
      // `name` kann laut Typ `null` sein. Kein erfundener Name (Wurzel 4):
      // der Server saeubert und ergaenzt die Endung selbst, wenn nichts kommt.
      name: d.name ?? "anhang",
      // Der MIME-Typ ist ein Hinweis; der Server entscheidet ueber die Bytes.
      type: d.type ?? "application/octet-stream",
    },
  };
}
