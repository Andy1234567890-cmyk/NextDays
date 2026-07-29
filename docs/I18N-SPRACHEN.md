# Sprachen und Übersetzungen

## Wo welcher Stand gilt

| Frontend | Sprachen | Quelle der Liste |
|---|---|---|
| `gastgeber/` | **45** (weltweit) | Schnittmenge Airbnb ∩ Booking.com, belegt Juli 2026 |
| `web/` | 24 (EU-Amtssprachen) | EU-Fokus, älterer Stand |
| `plattform/`, `builder/`, `admin/`, `mobile/` | — | noch nicht auf next-intl |

Die Listen sind **bewusst verschieden**. `web/` ist auf die EU ausgerichtet,
`gastgeber/` auf den weltweiten Verkauf. Wer `gastgeber/i18n/locales.ts` ändert,
muss `web/i18n/locales.ts` nicht mitziehen.

## Warum genau diese 45

Grundlage ist, was Airbnb und Booking.com tatsächlich ausliefern (geprüft durch
Locale-Proben gegen beide Anbieter, Juli 2026), nicht eine Wunschliste:

- **Airbnb**: ~51 Sprachen nachgewiesen (Eigenangabe „über 60", nicht verifizierbar)
- **Booking.com**: 45 Locales, vollständig aus deren `hreflang`-Angaben
- **Schnittmenge**: ~46 Locales

Zusätzlich behalten: **Irisch (ga)** und **Maltesisch (mt)** — beide führt kein
OTA, aber sie sind EU-Amtssprachen und in `web/` bereits übersetzt. Streichen
wäre ein Rückschritt hinter den vorhandenen Stand.

Bewusst **nicht** aufgenommen: Persisch (fa) und Urdu (ur). Beide sind RTL,
aber weder Airbnb noch Booking führen sie — wir tragen keine Sprache, für die
wir keine Pflege haben.

## Rechts-nach-links (RTL)

Genau zwei Sprachen: **Arabisch (ar)** und **Hebräisch (he)** — dieselben, die
auch Airbnb und Booking mit `dir="rtl"` ausliefern.

Technisch gelöst über **logische CSS-Eigenschaften** statt einer gespiegelten
Zweitdatei:

| statt | benutzen |
|---|---|
| `ml-2` / `mr-2` | `ms-2` / `me-2` |
| `pl-3` / `pr-3` | `ps-3` / `pe-3` |
| `text-left` / `text-right` | `text-start` / `text-end` |
| `border-l` / `border-r` | `border-s` / `border-e` |
| `left-0` / `right-0` | `start-0` / `end-0` |

Tailwind übersetzt diese in `padding-inline-start`, `inset-inline-end` usw.
Die spiegeln bei `dir="rtl"` von selbst. `app/layout.tsx` setzt `dir` aus
`textrichtung(locale)`.

**Ausgenommen und weiterhin richtungsfest:**
- `left-1/2 -translate-x-1/2` — das ist Zentrierung, keine Leserichtung
- `rotate-6` an den gefächerten Kärtchen der Topnav — dekorativ, Spiegeln
  zerstörte den Effekt

**Neuer Code**: Immer die logische Variante nehmen. Ein `pl-4` in einer neuen
Komponente ist auf Arabisch schlicht falsch.

## Arbeitsablauf

### Neuen Text hinzufügen
1. Key in `gastgeber/messages/de.json` anlegen (nur Deutsch — das ist die Quelle)
2. Im Code `t("keyname")` benutzen, nie deutschen Klartext
3. Übersetzen lassen (siehe unten)

### Übersetzen
Auftragsvorlage: `docs/i18n-translation-prompt.md`. Ein Lauf je Sprache — bei
1536 Keys sind das rund 26k Token pro Sprache.

### Prüfen (Pflicht vor dem Ausliefern)
```
scripts/i18n/gate.sh gastgeber
```
Läuft alle vier Prüfungen und bricht beim ersten Fehler ab:

1. **Locale-Deckung** — steht in `LOCALES` eine Sprache ohne Datei? Gibt es eine
   Datei ohne Eintrag? Fehlt ein Label? (`pruefe-locales-vollstaendig.mjs`)
2. **Vollständigkeit** — fehlende/überzählige Keys, kaputte Platzhalter, Texte
   die unübersetzt auf Englisch geblieben sind (`pruefe-uebersetzungen.mjs`)
3. **TypeScript**
4. **Produktionsbuild**

Die Einzelprüfungen lassen sich auch für sich aufrufen, etwa während eine
Übersetzung noch läuft.

### Zusammenführen paralleler Läufe
Mehrere Läufe dürfen **nicht** gleichzeitig in `de.json` schreiben. Jeder legt
eine flache Key-Datei ab, danach:
```
node scripts/i18n/merge-keys.mjs gastgeber <verzeichnis>
```
Bricht bei Konflikten ab, statt still zu überschreiben.

## Fallstricke

**Pluralformen sind Grammatik, keine Kopie.** Deutsch hat zwei Kategorien,
Arabisch sechs (`zero/one/two/few/many/other`), Polnisch vier, Japanisch eine.
Lettisch wählt `zero` bei 0 **und bei 11**. Eine Übersetzung, die die deutschen
zwei Formen übernimmt, ist in diesen Sprachen falsch.

**Platzhalternamen sind unveränderlich.** `{pct}` bleibt `{pct}`. Die Position
im Satz darf wandern, der Name nicht.

**Der Merge in `i18n/request.ts` ist tief, nicht flach.** Ein flaches
`{ ...basis, ...zielsprache }` ersetzt ganze Bereiche (`konto`, `objektEditor`)
und verliert dabei Keys, die es nur im Deutschen gibt — die erscheinen dann als
roher Key-Name in der Oberfläche.

**Datum und Zahlen** gehören über `lib/formatierung.ts` (`useFormatierung()`),
nie über `toLocaleDateString("de-DE")`. Sonst ist die Oberfläche übersetzt und
die Daten stehen weiter auf Deutsch.

**Sprachnamen im Umschalter stehen im Endonym** — „日本語", nicht „Japanisch".
So findet ein Japaner seine Sprache auch, wenn die Oberfläche gerade bulgarisch
ist. `Intl.DisplayNames` taugt dafür nicht: Es liefert den Namen in der
*aktiven* Sprache.

**Seiten-Metadaten und Server Components nicht vergessen.** `<html lang>` kann
korrekt gesetzt sein und die Seite trotzdem deutschen Text zeigen — genau das
war bei der Anmeldeseite der Fall. In Server Components heißt der Aufruf
`getTranslations` (await), nicht `useTranslations`; für `metadata` braucht es
`generateMetadata` statt des statischen Objekts.

**Beim Live-Test den Server neu starten.** `next start` bedient weiter den alten
Build. Ein Test gegen den laufenden Prozess zeigt sonst den Stand von vorher —
und sieht aus, als hätte die Übersetzung nicht gegriffen.

## Fachlich heikle Texte

Steuer- und Rechtsbegriffe wurden übersetzt und die Zweifelsfälle markiert:
**`docs/I18N-FACHTEXTE-PRUEFLISTE.md`**. Dort stehen auch drei Produktfragen,
die die Übersetzungen aufgeworfen haben — etwa ob wir wirklich fünf getrennte
Steuerarten brauchen, wo andere Länder nur eine kennen.
