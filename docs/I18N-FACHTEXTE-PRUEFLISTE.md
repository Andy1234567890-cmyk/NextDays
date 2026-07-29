# Prüfliste: fachlich heikle Übersetzungen

Diese Liste sammelt die Stellen, an denen die Übersetzung eines Steuer- oder
Rechtsbegriffs **nicht eindeutig** war. Sie ist bewusst kein Fehlerbericht: Die
Texte sind übersetzt und ausgeliefert. Aber wo ein Rechtsbegriff in der
Zielsprache kein exaktes Gegenstück hat, sollte jemand mit Ortskenntnis
drübersehen, bevor der Markt scharfgeschaltet wird.

Grundregel bei allen Läufen: Wo kein Gegenstück existierte, wurde **neutral und
beschreibend** übersetzt statt einen fremden Rechtsbegriff einzusetzen. Es wurde
nichts erfunden — keine Beträge, Fristen, Prozentsätze oder Behördennamen.

## Wiederkehrende Muster

Diese Fälle traten in fast jeder Sprache auf. Sie sind Eigenschaften des
deutschen Originals, nicht der Übersetzungen:

### Deutsche Kommunalabgaben ohne Gegenstück
`objektEditor.steuerartKurtaxe`, `steuerartUebernachtungssteuer`,
`steuerartBeherbergungssteuer`, `steuerartTourismusabgabe`,
`steuerartKulturfoerderabgabe`

Das Deutsche unterscheidet fünf Abgabenarten, die anderswo zusammenfallen oder
gar nicht existieren. Etablierte Entsprechungen gibt es nur für die Kurtaxe:
*taxe de séjour* (FR), *imposta di soggiorno* (IT), *toeristenbelasting* (NL),
*boravišna pristojba* (HR), *idegenforgalmi adó* (HU), *konaklama vergisi* (TR),
宿泊税 (JA), *visitor levy* (Schottland/Wales). Die übrigen vier wurden
beschreibend übersetzt und sind in der Zielsprache weniger trennscharf als im
Deutschen.

**Zu klären:** Brauchen wir wirklich fünf getrennte Steuerarten, oder ist das
eine deutsche Eigenheit, die die Auswahl in anderen Märkten unnötig verkompliziert?

### Registergericht
`konto.utFeldRegistergericht`

Ein *Gericht*, das Register führt, ist eine deutsche Besonderheit. Anderswo ist
es eine Kammer oder Behörde: *Camera di commercio* (IT), *Greffe du tribunal de
commerce* (FR), *Kamer van Koophandel* (NL), *Registering authority* (US).
Durchgehend als „zuständige Registerstelle" übersetzt.

### Handelsregisternummer-Beispiel
`steuern.handelsregisternummerHinweis` — im Deutschen „z. B. HRB 12345"

Ein HRB-Format ist außerhalb Deutschlands sinnlos. Die Läufe haben jeweils ein
landesübliches Formatmuster eingesetzt (SIRET in FR, REA in IT, tomo/folio/hoja
in ES). **Alternative wäre, das Beispiel ganz zu streichen** — dann bräuchte es
keine Landesvariante.

### Steuernummer vs. Steuer-ID
`steuern.steuernummer`, `steuern.steuerId`, `konto.utFeldUstId`

In Italien ist die *partita IVA* bei Unternehmen häufig **zugleich** die
USt-IdNr., während der *codice fiscale* die Personenkennung ist. Unsere zwei
getrennten Felder wirken dort wie eine Doppelung. Ähnlich in weiteren Ländern.

**Zu klären:** Sollte das Formular die Felder je nach Land zusammenlegen?

### Grundbuch / Kataster
`konto.oaTitel`, `konto.oaNummerLabel`

Die deutsche Trennung Grundbuch (Eigentum) / Kataster (Vermessung) gibt es so
in vielen Ländern nicht — Frankreich kennt nur die *référence cadastrale*, die
USA gar kein einheitliches System.

## Sprachspezifische Vorbehalte

### Arabisch (ar)
Es gibt **keine** einheitliche arabische Amtsterminologie — 22 Länder mit
eigenen Steuerbehörden und Rechtsordnungen. Der Lauf hat durchgehend neutrales
Hocharabisch gewählt (wie Airbnb/Booking), statt z. B. saudisches ZATCA-Vokabular
allen Nutzern überzustülpen. Betroffen: alle `steuern.*`-Keys, besonders
`steuern.idName.vat` (in Ländern ohne Mehrwertsteuer nur beschreibend
verständlich) und `steuern.gruppe.global.text` (CRS ohne die Abkürzung).

### Englisch (en / en-GB)
`steuern.steuernummer` wurde in **beiden** Varianten bewusst **neutral**
gehalten, obwohl es britische (UTR) und US-Entsprechungen (SSN/EIN) gäbe. Grund:
Der Dialog wird für *jedes* Land benutzt — ein UK-ansässiger Gastgeber kann
deutsche Steuerpflicht erklären. „UTR" wäre dort schlicht falsch. Das war laut
Lauf die folgenreichste Einzelentscheidung der englischen Dateien.

`steuerartUmsatzsteuer` → „Sales tax" (US) vs. „VAT" (UK). Sachlich sind das
verschiedene Steuerarten; der deutsche Begriff meint die VAT-Systematik.

### Spanisch (es)
Bewusst **kein** NIF, weil Mexiko (RFC/CURP), Argentinien (CUIT) und Chile (RUT)
eigene Systeme haben. Für ein rein spanisches Publikum wäre NIF präziser.

### Italienisch (it)
Siehe oben zu *partita IVA* / *codice fiscale*. Zusätzlich: Die Kriterien für
gewerbliche Vermietung (`konto.utArtKriterien`) sind im Original deutsch geprägt;
Italien grenzt anders ab (u. a. Schwelle von vier Wohneinheiten bei *locazione
turistica*). Der Text wurde generisch gehalten.

### Französisch (fr)
`konto.utFeldRegisternummer` → „numéro SIRET". Alternative wäre „numéro RCS",
das dem deutschen HRB begrifflich näher steht. SIRET wurde gewählt, weil es das
ist, was französische Vermieter tatsächlich angeben. **Falls das Feld die
Gesellschaftseintragung meint und nicht die Betriebsstätte, wäre RCS richtiger.**

## Was NICHT geprüft werden muss

- Platzhalter-Treue, Pluralformen, Vollständigkeit: maschinell geprüft über
  `scripts/i18n/pruefe-uebersetzungen.mjs`, alle Sprachen ✓.
- Beispieldaten (Telefonvorwahl, ISO-Ländercode, E-Mail-Muster): bewusst
  lokalisiert, keine echten Daten.
- Maßeinheiten: `en` nutzt Zoll (der Schlüsselname sagt `32Inches`, der deutsche
  Text hatte auf 81 cm metrisiert), `en-GB` bleibt metrisch. Beides beabsichtigt.
