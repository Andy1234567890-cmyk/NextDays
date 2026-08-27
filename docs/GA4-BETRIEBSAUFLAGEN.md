# Google Analytics 4 — was NICHT im Code steht

Der Einbau in `marketing/` (Einwilligung, Consent Mode v2, fail-closed) ist im
Repo vollständig und prüfbar: `bash scripts/diagnose/messung-einwilligung-pruefen.sh`.

Vier Zusicherungen der Rechtstexte hängen jedoch an Einstellungen **in der
GA4-Oberfläche**, nicht am Code. Sie sind damit genau die Klasse Fehler, die
still bleibt (vgl. Mail-Variablen-Drift api ↔ worker): der Text behauptet sie,
niemand merkt, wenn sie fehlen. Deshalb stehen sie hier — und müssen VOR dem
Scharfschalten in der Property gesetzt und danach nachgesehen werden.

## Pflicht-Einstellungen der Property

| Einstellung | Sollwert | Wo | Warum |
|---|---|---|---|
| Datenaufbewahrung (Ereignis- und Nutzerdaten) | **14 Monate** | Verwaltung → Property → Datenaufbewahrung | Der Rechtstext nennt 14 Monate. GA4 steht **standardmäßig auf 2 Monate** — ohne Umstellung ist die Angabe falsch (zu lang behauptet). Änderung greift erst nach 24 h. |
| Google-Signale | **aus** | Verwaltung → Datenerhebung | Der Rechtstext sagt „abgeschaltet". Der Code setzt `allow_google_signals: false`, aber die Property-Ebene schaltet zusätzlich — beide müssen aus sein. |
| Werbe-Personalisierung / Ads-Verknüpfung | **aus, keine Verknüpfung** | Verwaltung → Produktverknüpfungen | Der Rechtstext schließt Zielgruppen für Werbung aus. |
| Datenstandort / EU-Verarbeitung | EU | Verwaltung → Datenerhebung | Der Rechtstext sagt, die IP-Kürzung erfolge auf EU-Servern. |
| Auftragsverarbeitung (Art. 28) | angenommen | Verwaltung → Kontoeinstellungen → Datenverarbeitungsbedingungen | Ohne angenommene „Google Ads Data Processing Terms" ist der Einsatz rechtswidrig, und der Rechtstext beruft sich darauf. |

## Umgebungsvariablen (Coolify, App `marketing`)

`NEXT_PUBLIC_*` wird beim **Bauen** eingesetzt. Beide Werte müssen als
Build-Argument anliegen (`marketing/Dockerfile` deklariert die ARGs); ein nur
zur Laufzeit gesetzter Wert bleibt im Image leer.

| Variable | Wirkung, wenn leer |
|---|---|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Kein Analytics. Die Kategorie „Statistik“ erscheint dann gar nicht in der Leiste (`optionaleKategorien()`) — bewusst, damit keine Einwilligung für einen Dienst eingesammelt wird, den es nicht gibt. **Der Einleitungstext passt sich mit an** (`textSpamschutz` statt `textBeide`), damit er nicht „zwei Dinge“ sagt, während nur ein Schalter steht. Prüfen lässt sich das nur mit gesetzter Variable: `node scripts/diagnose/einwilligung-granular.mjs`. |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Fällt auf den einkompilierten Nachweis der Produktionsdomain zurück (`marketing/lib/site-verification.ts`). Nur setzen, wenn eine ANDERE Domain ihre eigene Search-Console-Property hat. |

## Getrennte Schaltbarkeit (Granularität)

Art. 4 Nr. 11 DSGVO verlangt eine Einwilligung „für einen bestimmten Fall“; die
EDSA-Leitlinie leitet daraus ab, dass je Zweck frei gewählt werden muss, und die
Aufsichtsbehörden verlangen, dass diese Wahl **ohne umständliches Untermenü**
erreichbar ist. Umgesetzt ist das so:

- Beide Kategorien stehen mit ihrem Schalter **offen auf der ersten Ebene**. Der
  frühere Klapp-Knopf „Auswahl anzeigen“ ist entfallen — er machte das Ablehnen
  einzelner Zwecke aufwendiger als das pauschale Annehmen.
- Jede Kategorie schaltet genau ihren Dienst: „nur Statistik“ lädt gtag und
  **kein** reCAPTCHA, „nur Spamschutz“ umgekehrt. Live nachgewiesen mit
  `scripts/diagnose/einwilligung-granular.mjs`.
- Beim Abwählen wird der Gegenzustand gepflegt: `_ga`/`_ga_*` bzw.
  `_GRECAPTCHA` werden gelöscht, ein Rückstand landet laut in der Konsole.
- „Alle ablehnen“ und „Alle annehmen“ sind gemessen gleichrangig (gleiche Größe,
  Schriftstärke, Farbe; Ablehnen steht zuerst) — `einwilligung-e2e.mjs` prüft das
  mit `getBoundingClientRect`, nicht mit Augenmaß.
- Jede Angabe je Dienst (Anbieter, Speicherdauer, Cookies, Drittland) steht als
  Struktur in `marketing/lib/einwilligung-angaben.ts`, nicht als Prosa. Ein neuer
  Dienst muss dort eintragen — eine fehlende Angabe fällt dabei auf.

## Was der Code garantiert (und was nicht)

Garantiert, im Repo nachlesbar und per Skript prüfbar:
- Ohne Einwilligung kein Skript, kein Cookie, kein Request an Google
  (`marketing/lib/analytics.ts`, fail-closed über `istErlaubt("statistik")`).
- Consent Mode v2 in der vorgeschriebenen Reihenfolge, Werbe-Parameter
  dauerhaft `denied`.
- Widerruf wirkt ohne Neuladen und löscht `_ga`/`_ga_*`; bleibt ein Cookie
  stehen, wird das in der Konsole gemeldet statt verschwiegen.
- Genau ein `page_view` je Seite (`send_page_view: false` + eine Melde-Stelle).

Nicht garantiert, weil außerhalb unseres Zugriffs:
- Was Google intern mit den übermittelten Daten tut. Die Wirksamkeit des
  Widerrufs beruht darauf, dass gtag.js `consent: denied` beachtet.
- Ein Zugriff von US-Behörden nach Section 702 FISA ist nicht auszuschließen;
  die Datenschutzerklärung sagt das ausdrücklich.

## Nebenfund vom 26.08.2026: `_GRECAPTCHA` fehlte

Die Cookie-Richtlinie nannte in keiner Sprache das Cookie `_GRECAPTCHA`, das
reCAPTCHA Enterprise für seine Risikobewertung setzt — obwohl der Spamschutz
schon vorher einwilligungsbasiert lud. Aufgefallen ist es erst, weil für die
neue Angaben-Tabelle im Einwilligungsdialog eine Cookie-Liste je Dienst
gebraucht wurde: dort stand zuerst „keine", was Googles eigener Beschreibung
widerspricht („reCAPTCHA sets a necessary cookie … for the purpose of providing
its risk analysis").

Lehre: solange die Cookie-Angaben nur Prosa in 24 Rechtstexten waren, war das
fehlende Cookie unsichtbar. Als Struktur (`marketing/lib/einwilligung-angaben.ts`)
ist jeder Dienst gezwungen, seine Liste zu nennen — eine Lücke fällt beim
Eintragen auf. Neuer Dienst im Browser → dort eintragen UND in die
Cookie-Richtlinie, sonst ist die Angabe unvollständig.

Die Laufzeit von `_GRECAPTCHA` gibt Google nicht verbindlich an (Quellen nennen
sechs Monate, 179 Tage und ein Jahr). Der Dialog sagt deshalb „von Google
festgelegt, bis zu sechs Monate" statt einer erfundenen exakten Zahl.

## Übersetzungen der Rechtstexte

Die 22 nicht-deutschen/englischen Fassungen von Datenschutzerklärung und
Cookie-Richtlinie wurden am 26.08.2026 maschinell übersetzt
(`scripts/i18n/uebersetzen.py`, Gemini). Das Werkzeug ist für Oberflächentexte
gedacht und nennt Rechtstexte ausdrücklich als Grenze.

Die Alternative wäre gewesen, 22 Sprachfassungen weiter „kein Google Analytics"
sagen zu lassen, während GA4 lädt — eine aktive Falschaussage in einem
Rechtstext und damit die schlechtere Wahl. Der maschinelle Stand ist also
besser als der vorige, aber **kein Ersatz für eine juristische Durchsicht**:
Vor dem Scharfschalten sollte ein Muttersprachler oder eine Kanzlei die
Fassungen der Hauptmärkte (dänisch, deutsch, englisch) gegenlesen. Deutsch und
Englisch sind von Hand geschrieben.
