// Das Google-Tag im Einwilligungsmodus („Advanced Consent Mode").
//
// WAS SICH GEGENÜBER VORHER ÄNDERT: Bis zum 27.08.2026 entstand das Tag erst
// NACH der Zustimmung (lib/analytics.ts). Rechtlich war das die strengste
// Variante, sie hatte aber zwei Nachteile, die den Betrieb behindern: Googles
// Prüfer („Website testen", Tag Assistant, Einrichtungsassistent) rufen die
// Seite serverseitig ab, führen kein JavaScript aus und klicken keinen
// Cookie-Dialog — sie meldeten deshalb dauerhaft „kein Google-Tag gefunden",
// ohne dass etwas defekt war. Und in GA4 fehlten die Daten der Sitzungen, in
// denen die Zustimmung erst mitten im Besuch kam.
//
// Umgestellt auf Anweisung des Betreibers am 27.08.2026, nach Vorlage der
// Google-Anleitung „Einwilligungsmodus auf Websites einrichten"
// (developers.google.com/tag-platform/security/guides/consent?hl=de). Die dort
// vorgeschriebene Reihenfolge ist der ganze Sinn dieser Datei:
//
//   1. `dataLayer` und `gtag` definieren
//   2. `gtag('consent','default', …)` — ALLES auf `denied`
//   3. DANN das Tag laden, `js`, `config`
//   4. später `gtag('consent','update', …)` aus der Einwilligungsleiste
//
// Google schreibt dazu wörtlich: „Die Reihenfolge des Codes ist hier
// entscheidend. Wenn Ihr Einwilligungscode in der falschen Reihenfolge
// aufgerufen wird, funktionieren die Standardeinstellungen für die Einwilligung
// nicht." Genau deshalb stehen Schritt 1 und 2 in einem ROHEN `<script>` im
// `<head>` — nicht über `next/script`, das die Position nicht zusagt. Das
// `<head>` legt das Root-Layout ausdrücklich um diese Komponente; ohne es
// schiebt der Parser das Skript in den Body (siehe die beiden Begründungen
// unten an der Stelle selbst).
//
// WAS DAS FÜR DEN DATENSCHUTZ BEDEUTET — ehrlich benannt: Das Tag lädt jetzt
// ohne Zustimmung, und Google sendet in diesem Zustand „cookielose Pings"
// (Googles Wort). Es entsteht KEIN Cookie und KEINE dauerhafte Kennung, aber es
// geht eine Verbindung zu Google, und damit die IP-Adresse. Google empfiehlt
// diesen Weg für den EWR ausdrücklich; deutsche Aufsichtsbehörden bewerten ihn
// unterschiedlich. Die Entscheidung dafür hat der Betreiber getroffen, nicht
// diese Datei — wer sie zurückdreht, entfernt diese Komponente aus dem Layout
// und lässt lib/analytics.ts das Tag wieder erst nach der Zustimmung laden.
//
// Die vier Parameter stehen ALLE auf `denied`, auch die drei Werbe-Parameter:
// Consent Mode v2 verlangt sie, und `denied` ist die Aussage „keine
// Werbe-Einwilligung, auch nicht implizit". `lib/pixel.ts` hebt sie an, wenn
// jemand „Marketing" erlaubt; `lib/analytics.ts` hebt `analytics_storage` an.
import Script from "next/script";

import { GA_MEASUREMENT_ID } from "@/lib/config";

export function GoogleTag() {
  // Ohne Mess-ID kein Tag. Kein Platzhalter (Wurzel 4): eine erfundene Kennung
  // würde Daten an eine fremde Property schicken.
  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      {/* Schritt 1+2: die Vorgabe — als ROHES script-Tag, nicht über
          `next/script`.

          WARUM NICHT `next/script` MIT `beforeInteractive`: genau so stand es
          zuerst hier, und die Reihenfolge kippte. Gemessen am 27.08.2026 im
          ausgelieferten HTML: `gtag/js` landete an Byte 3872, die Vorgabe erst
          an Byte 9155 — das Tag lud also VOR seiner eigenen Vorgabe. Next
          sammelt `beforeInteractive`-Skripte und platziert sie nach eigener
          Logik; auf die Position relativ zu einem anderen `next/script` kann
          man sich nicht verlassen. Google schreibt dazu: „Wenn Ihr
          Einwilligungscode in der falschen Reihenfolge aufgerufen wird,
          funktionieren die Standardeinstellungen für die Einwilligung nicht."

          WAS „ROH" ALLEIN NICHT LEISTET (gemessen am 29.08.2026 live auf
          mynextdays.com): Hier stand bis dahin, ein rohes `<script>` stehe
          „dort, wo es geschrieben ist". Der Browser hielt das nicht ein. Diese
          Komponente hing im Root-Layout als direktes Kind von `<html>`, also
          zwischen `</head>` und `<body>` — und der HTML-Parser verschiebt, was
          er dort findet, in den Body. In Produktion ergab
          `document.getElementById('nd-consent-default').parentElement.tagName`
          folglich `"BODY"` und `Array.from(document.head.children).indexOf(s)`
          den Wert `-1`; keines der 31 Kopf-Kinder war dieses Skript. Dass die
          Reihenfolge trotzdem stimmte, war Glück: `gtag/js` läuft erst nach der
          Hydration. React meldete dieselbe Ursache als Fehler — „In HTML,
          <script> cannot be a child of <html>. This will cause a hydration
          error." —, und ein verworfener Baum an der Wurzel hätte die
          Einwilligungsleiste und die Zählkomponente mitgerissen.
          Verlässlich ist die Position also erst, seit das Root-Layout ein
          ausdrückliches `<head>` um diese Komponente legt (app/layout.tsx).
          Wer sie dort herausnimmt, holt beides zurück: den Hydrations-Fehler
          und ein Skript im Body.

          `dangerouslySetInnerHTML` ist hier kein Risiko: der Inhalt ist eine
          Konstante aus dem eigenen Code, kein Fremdeingabewert. Die Mess-ID
          wird trotzdem escaped, weil sie aus der Umgebung kommen kann.

          `dataLayer.push(arguments)` — NICHT ein Array. gtag.js prüft den Typ;
          ein echtes Array landet in seinem Legacy-Zweig und wird in einem
          leeren try/catch verworfen, es kommt KEIN Befehl an. Dieser Fehler
          stand am 27.08.2026 in lib/analytics.ts und kostete Stunden, weil die
          dataLayer dabei vollständig aussieht. */}
      <script
        id="nd-consent-default"
        dangerouslySetInnerHTML={{
          __html:
            "window.dataLayer=window.dataLayer||[];" +
            "function gtag(){dataLayer.push(arguments);}" +
            "gtag('consent','default',{" +
            "'ad_storage':'denied','ad_user_data':'denied'," +
            "'ad_personalization':'denied','analytics_storage':'denied'," +
            // Die Einwilligung kommt asynchron aus dem localStorage, gelesen
            // von einer Client-Komponente. Genau dafuer sieht Google
            // `wait_for_update` vor: gtag.js wartet diese Millisekunden auf ein
            // `consent update`, bevor es mit der Vorgabe sendet. HIER trifft die
            // Voraussetzung zu — anders als in der vorigen Bauform, wo das Tag
            // erst nach der Zustimmung entstand und die Wartezeit sinnlos war.
            "'wait_for_update':500});" +
            // Anzeigendaten unkenntlich machen, solange `ad_storage` verweigert
            // ist; wirkt laut Google nur in diesem Zustand.
            "gtag('set','ads_data_redaction',true);" +
            // Keine Kennungen ueber URL-Parameter — das wuerde die Ablehnung
            // des Besuchers aushebeln.
            "gtag('set','url_passthrough',false);",
        }}
      />

      {/* Schritt 3: das Tag selbst. `afterInteractive` — es darf das erste
          Rendern nicht blockieren, und die Vorgabe oben steht ohnehin schon in
          der Warteschlange. Next fügt dieses Skript erst nach der Hydration
          ein und legt vorher nur einen `<link rel="preload">` ins HTML; der
          lädt die Datei herunter, FÜHRT SIE ABER NICHT AUS. Die Vorgabe kommt
          damit immer zuerst zur Ausführung. (Ein Byte-Vergleich im HTML ist
          deshalb kein Reihenfolgen-Nachweis — der Preload-Hinweis steht weiter
          vorn und ist trotzdem harmlos. Gemessen wird im Browser an der
          dataLayer.)

          `send_page_view: false` hat hier eine ZWEITE Wirkung, die über die
          Vermeidung von Doppelzählung hinausgeht und ausdrücklich gewollt ist:
          Google beschreibt für diesen Modus „cookielose Pings" ohne
          Zustimmung — ein Treffer ohne Kennung, der trotzdem Daten überträgt.
          Weil gtag.js von sich aus nichts sendet und unser Zähler
          (`seitenaufrufMelden`) die Einwilligung prüft, entsteht ohne
          Zustimmung KEIN einziger Treffer. Nachgemessen am 27.08.2026: null
          Requests, null Cookies. Das ist strenger als Googles Standard und die
          rechtlich richtige Seite; wer diese Zeile entfernt, schaltet die
          Übertragung ohne Einwilligung ein.

          WAS HIER AM 03.09.2026 ENTFERNT WURDE — und warum es nicht
          zurückgehört: Bis dahin standen im `config` zusätzlich
          `allow_google_signals: false` und
          `allow_ad_personalization_signals: false`. Beide waren als
          Datenschutz-Sicherung gedacht, waren aber die FALSCHE Stelle dafür:
          sie wirken pauschal und blind gegenüber der Einwilligung, nehmen also
          auch dem Besucher etwas weg, der „Marketing" gerade ausdrücklich
          erlaubt hat. Die Einwilligung ist der Schalter, nicht eine zweite
          feste Bremse dahinter.

          Dazu kam ein Sachfehler, den erst die Messung zeigte: Google hat die
          Zuständigkeit zum 15.06.2026 umgebaut. Seither entscheidet allein
          `ad_storage` aus dem Einwilligungsmodus über den Werbedatenfluss zu
          Google Ads; Google Signals steuert NUR NOCH die angereicherten
          Berichte innerhalb von GA4 (Demografie/Interessen angemeldeter
          Nutzer). `allow_google_signals: false` blockierte also längst nicht
          mehr, was der Kommentar hier behauptete — es kostete nur die
          Berichte. Wirksam blieb allein das zweite Flag, sichtbar als `npa=1`
          im Treffer (live abgefangen am 03.09.2026 auf mynextdays.com, im
          selben Treffer mit `gcs=G111`, also voller Zustimmung).

          Rechtlich braucht es die Flags nicht: § 25 Abs. 1 TDDDG verlangt für
          Retargeting und Werbe-Pixel die vorherige Einwilligung — und mehr
          nicht. Genau die holt die Leiste ein und meldet sie als `consent
          update` (lib/pixel.ts für die drei Werbe-Parameter,
          lib/analytics.ts für `analytics_storage`). Ohne Zustimmung steht
          weiterhin ALLES auf `denied`, oben in Schritt 2; daran ändert das
          Entfernen nichts. Wer die Flags wieder einsetzt, dreht keine
          Datenschutzlücke zu, sondern schaltet eine erteilte Einwilligung
          wirkungslos — und tut das unsichtbar, weil GA4 die Treffer trotzdem
          zählt. */}
      <Script
        id="nd-gtag-js"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`}
      />
      <Script id="nd-gtag-config" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}',{'send_page_view':false});`}
      </Script>
    </>
  );
}
