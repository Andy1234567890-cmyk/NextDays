# Claude-Code-Prompt: `apps/web` — 22 Sprachen gegen `de.json` vervollständigen

**Zweck:** Diesen Prompt in Claude Code (im Repo-Root `NextDays/`) ausführen. Er
vervollständigt und übersetzt die Locale-Dateien der Web-App, ohne Code, Keys
oder Struktur zu verändern.

**Geltungsbereich:** AUSSCHLIESSLICH `apps/web/messages/*.json`. Keine andere App,
kein Code, keine Config. `marketing/`, `plattform/`, `mobile-bestdays/`, `mobile-nextdays/`, `builder/`
haben kein i18n — die sind hier bewusst NICHT enthalten.

---

## Der Prompt (ab hier kopieren)

Du arbeitest im Repo `NextDays`. Deine Aufgabe: die Übersetzungsdateien der Web-App
`apps/web/messages/` so vervollständigen, dass jede der 22 Zielsprachen exakt die
Key-Struktur der deutschen Quelldatei hat und alle Werte korrekt übersetzt sind.

### Quelle der Wahrheit

- `apps/web/messages/de.json` = **Quelle** (Deutsch, maßgeblich). NUR LESEN, nie ändern.
- `apps/web/messages/en.json` = vollständige englische Brücke. NUR LESEN, als
  Referenz für Terminologie/Bedeutung, wenn Deutsch mehrdeutig ist.

### Zieldateien (22) — diese vervollständigen und übersetzen

`apps/web/messages/{bg,cs,da,el,es,et,fi,fr,ga,hr,hu,it,lt,lv,mt,nl,pl,pt,ro,sk,sl,sv}.json`

### Vorgehen — strikt sprachweise, eine Datei komplett abschließen, dann die nächste

1. Lies `de.json` vollständig ein und bilde die **komplette Key-Menge** (alle
   verschachtelten Leaf-Keys, dot-notation) als Soll.
2. Für die aktuelle Zielsprache: berechne den **Diff** gegen `de.json`.
   Erwartet fehlen mindestens die Sektionen `fotos`, `owners`, `ownerStatements`,
   `portal`, `dossier` — aber verlasse dich nicht auf diese Liste, sondern
   diffe tatsächlich, es können weitere einzelne Keys fehlen.
3. Ergänze alle fehlenden Sektionen/Keys an der **strukturell korrekten Stelle**
   (gleiche Verschachtelung wie `de.json`) und übersetze deren Werte.
4. Prüfe alle bereits vorhandenen Sektionen auf fehlende nested Keys und ergänze sie.
5. Schreibe die Datei als valides JSON, UTF-8, mit derselben Einrückung wie `de.json`.
6. Verifiziere die Datei (siehe Abschnitt Verifikation), erst dann zur nächsten Sprache.

### Absolute Regeln — Verstoß macht die App kaputt

1. **Nur Werte übersetzen.** Key-Namen, Objektstruktur, Verschachtelung und
   Reihenfolge bleiben identisch zu `de.json`. Keine Keys umbenennen, hinzufügen
   (außer die aus `de.json` fehlenden) oder entfernen.
2. **ICU-Platzhalter unverändert lassen.** Alles in geschweiften Klammern ist Code,
   kein Text: `{count}`, `{n}`, `{name}`, `{currency}`, `{scheme}`, `{adults}`,
   `{nights}`, `{created}`, `{failed}` usw. Nie übersetzen, nie umbenennen, nie
   Leerzeichen darin einfügen.
3. **ICU-Plurale korrekt behandeln.** Syntax `{x, plural, ... }` und das `#`-Symbol
   bleiben erhalten. Übersetze nur den Text INNERHALB der Kategorien-Klammern.
   Wichtig: Deutsch hat nur `one`/`other`. Sprachen mit mehr CLDR-Pluralkategorien
   MÜSSEN die zusätzlichen Kategorien ergänzen, sonst sind Zahlen grammatikalisch
   falsch:
   - `few`/`many` u.a. bei: `pl`, `cs`, `sk`, `lt`, `hr`, `ro`, `mt`, `sl` (`sl` hat
     zusätzlich `two`).
   - Nur `one`/`other`: `da`, `nl`, `sv`, `et`, `fi`, `es`, `it`, `pt`, `el`, `hu`, `bg`, `ga`.
   Wende die offiziellen CLDR-Pluralregeln der jeweiligen Sprache an. Beispiel de:
   `"{count, plural, one {# Foto hochgeladen} other {# Fotos hochgeladen}}"`.
4. **Rich-Text-Tags sind Tags, kein HTML.** Konstrukte wie `<agb>…</agb>`,
   `<stripe>…</stripe>` unverändert als Tags belassen; nur den Text zwischen den
   Tags übersetzen. Tags nie entfernen, umbenennen oder in echtes HTML wandeln.
5. **Vollständigkeit ist Pflicht (kritisch).** `apps/web/i18n/request.ts` merged nur
   auf Top-Level. Fehlt ein einzelner nested Key in einer sonst vorhandenen Sektion,
   gibt es KEINEN Fallback auf Deutsch → next-intl wirft einen Fehler zur Laufzeit.
   Jede Zielsprache MUSS daher exakt dieselbe Leaf-Key-Menge wie `de.json` haben.
6. **Keine Lücken, keine Platzhalter.** Kein Wert bleibt leer, kein `"TODO"`, kein
   zurückkopiertes Deutsch (außer bei Eigennamen/Marken, die unübersetzt bleiben).
7. **Terminologie konsistent und domänengerecht.** Es geht um Ferienvermietung
   (Gastgeber, Objekte/Unterkünfte, Reservierungen, Owner-Statements, Kanäle/OTA,
   Reinigung). Nutze bereits vorhandene, korrekte Übersetzungen in der jeweiligen
   Datei als Terminologie-Anker und bleibe innerhalb einer Sprache konsistent.
   Vorhandene, korrekte Übersetzungen NICHT überschreiben.

### NICHT anfassen

`de.json`, `en.json` (nur lesen); `apps/web/i18n/locales.ts`, `i18n/request.ts`,
`i18n/actions.ts`, `next.config.ts`; jede Datei außerhalb `apps/web/messages/`.

### Verifikation — nach JEDER Sprache ausführen, am Ende für alle

1. **JSON valide:** jede geänderte Datei parst fehlerfrei.
2. **Key-Parität:** die Leaf-Key-Menge jeder Zieldatei ist identisch zu `de.json`
   (keine fehlenden, keine überzähligen Keys). Nutze dafür z.B.:
   ```bash
   node -e '
     const fs=require("fs"),d="apps/web/messages/";
     const flat=(o,p="")=>Object.entries(o).flatMap(([k,v])=>
       v&&typeof v==="object"&&!Array.isArray(v)?flat(v,p+k+"."):[p+k]);
     const base=new Set(flat(JSON.parse(fs.readFileSync(d+"de.json","utf8"))));
     for(const f of fs.readdirSync(d).filter(f=>f.endsWith(".json")&&f!=="de.json")){
       const keys=new Set(flat(JSON.parse(fs.readFileSync(d+f,"utf8"))));
       const missing=[...base].filter(k=>!keys.has(k));
       const extra=[...keys].filter(k=>!base.has(k));
       if(missing.length||extra.length)
         console.log(f,"FEHLT:",missing.length,"ÜBERZÄHLIG:",extra.length,
           missing.slice(0,5), extra.slice(0,5));
     }
     console.log("key-parity check done");'
   ```
   Ausgabe muss ohne `FEHLT/ÜBERZÄHLIG`-Zeilen enden.
3. **Platzhalter-Parität:** für jeden Key enthält die Übersetzung dieselbe Menge an
   `{…}`-Platzhaltern wie `de.json` (Reihenfolge egal, Menge nicht). Keine
   Platzhalter verloren oder erfunden.
4. **Build:** `cd apps/web && npx tsc --noEmit` läuft ohne Fehler (Regel aus
   `CLAUDE.md`: `tsc --noEmit` in apps/web ohne Fehler).

### Umfang / Kosten-Hinweis

22 Sprachen × (~360 fehlende Keys + Lückenprüfung über ~1000 vorhandene). Arbeite
sprachweise und committe/prüfe pro Sprache, statt alles in einem Rutsch — das hält
die Verifikation überschaubar und Fehler lokal. Nichts committen/pushen ohne
ausdrückliche Freigabe (CLAUDE.md).
