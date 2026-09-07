# Framer-Editor — Veröffentlichen, Vorschau, Site-Einstellungen, Zusammenarbeit,
# Verlauf, Plugins, KI: vollständige Recherche (05.09.2026)

Auftrag: Framer als UI/Feature-Referenz für den eigenen Website-Baukasten
recherchieren, Bereich Veröffentlichen/Vorschau/Site-Einstellungen/
Zusammenarbeit/Verlauf/Plugins/KI. Ergänzt die zwei bestehenden Dokumente
`FRAMER-CANVAS-FUNKTIONEN.md` (Fläche) und `FRAMER-STYLE-INSPEKTOR-FUNKTIONEN.md`
(rechte Leiste). Diese beiden Dateien nummerieren rein numerisch (1.x–18.x,
kein Buchstaben-Präfix) — es gibt daher keine Kollision mit den hier neu
vergebenen Präfixen V/P/D/S/Z/KI/PL.

Quellen: ausschließlich `framer.com/help/*`, `framer.com/updates/*`,
`framer.com/dictionary/*`, `framer.com/academy/*`, `framer.com/blog/*` und
deren direkte Fundstellen aus WebSearch/WebFetch. Wo eine Funktion nur aus
Drittquellen (Community-Foren, Blogs Dritter) belegt ist, ist das in der
Quellenspalte vermerkt und NICHT als offizielle Framer-Doku ausgegeben. Wo
etwas nicht belegbar war, wurde es weggelassen statt erfunden.

Spalten je Tabelle: `Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder`.

---

## V — Veröffentlichen (Publish-Dialog)

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| V1.1 | Publish-Knopf oben rechts im Editor | Editor-Kopfzeile | framer.com/help/articles/publishing-your-framer-website/ | Ein Klick veröffentlicht das Projekt; erzeugt beim ersten Mal automatisch eine `*.framer.app`/`*.framer.website`-Domain |
| V1.2 | View Changes vor dem Publish | Publish-Dialog | framer.com/help/articles/publishing-your-framer-website/ | Liste der Änderungen seit der letzten Veröffentlichung samt Profilbildern der Bearbeiter, die sie vorgenommen haben |
| V1.3 | Optimierungs-Statusanzeige „Optimized" | Publish-Dialog | framer.com/help/articles/publishing-your-framer-website/ | Textanzeige blau/lila = optimiert, rot = Handlungsbedarf; anklickbare Warnungen führen zur betroffenen Stelle (z. B. verschachtelte Links, Code-Fehler) |
| V1.4 | Jede Veröffentlichung erzeugt eine neue Version | Staging & Versions (Projekt-Einstellungen) | framer.com/help/articles/staging-and-versions/ | „When you click 'Publish' in Framer, a new version is created" |
| V1.5 | Versionierte Links | Staging & Versions | framer.com/help/articles/staging-and-versions/ | Klick auf eine Versions-ID öffnet sie in neuem Tab mit Status, Veröffentlicher und Zeitstempel; „these versioned links are static and remain tied to a specific version, unaffected by future publishes" |
| V1.6 | Staging-Tab (Pro-Plan+) | Staging & Versions | framer.com/help/articles/staging-and-versions/ | Nur verfügbar mit verbundener Custom Domain; „Enable Staging" weist der Custom Domain eine bestimmte Version zu, während die Basis-Domain (`*.framer.app`) an die jeweils neueste Version gebunden bleibt — Testen „in a real-world setting before it goes live" |
| V1.7 | Production-Tab | Staging & Versions | framer.com/help/articles/staging-and-versions/, framer.com/help/articles/publishing-your-framer-website/ | „Deploy Latest"-Knopf veröffentlicht die neueste Version direkt live, ohne den Umweg über Settings |
| V1.8 | Deploy einer bestimmten Version | Staging & Versions | framer.com/help/articles/staging-and-versions/ | „Deploy" neben einer Version schiebt genau diese auf die Custom Domain |
| V1.9 | Rollback | Staging & Versions | framer.com/help/articles/staging-and-versions/ | Jederzeit Rückkehr zu einer früheren Version möglich, „allowing you to refine changes before redeployment" |
| V1.10 | Passwortschutz der gesamten Site | Site Settings → General | framer.com/help/articles/how-to-update-page-titles-descriptions-and-social-images/ (Umfeld), Community/Academy: framer.com/academy/lessons/password-protection | Im „General"-Bereich der Site Settings gibt es einen „Password Protection"-Abschnitt mit Umschalter; schützt die komplette Site mit einem Passwort. **Hinweis:** Passwortschutz einzelner Seiten ist NICHT nativ vorhanden — dafür ausschließlich Marketplace-Plugins/-Komponenten (z. B. „Password Protect", „PageLock") oder ein selbst eingefügtes Passwort-Component; als Feature-Wunsch der Community offen (framer.community/c/requests/password-protection-of-individual-pages) |
| V1.11 | Unpublish | vermutlich Site Settings/Publish-Menü | Community: framer.community/c/support/unpublishing-of-website; Framer Help erwähnt es im Kontext Projekt-Löschung (framer.com/help/articles/deleting-a-project-in-framer/) | „Unpublish" nimmt die Site aus der öffentlichen Sicht, das Projekt bleibt erhalten und ist jederzeit erneut veröffentlichbar; beim vollständigen Löschen eines Projekts wird die zugehörige Website automatisch unpublished. Der exakte UI-Pfad für den reinen Unpublish-Knopf ist in der offiziellen Doku nicht eindeutig dokumentiert — als unsicher markiert |
| V1.12 | Custom Headers / Multi-Site Rewrites (Advanced Hosting) | Site Settings → Hosting | framer.com/help/articles/how-to-connect-a-custom-domain/ | Erweiterte Hosting-Optionen, erfordern eine verbundene Custom Domain |

## P — Preview (Vorschau)

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| P1.1 | Play-Knopf startet Preview | Editor, oben links | framer.com/help/articles/how-to-preview-your-site/ | Klick auf „Play" oder Kürzel ⌘P (macOS) / Ctrl+P (Windows) öffnet den Preview-Modus |
| P1.2 | Preview-Modus interaktiv | Preview | framer.com/help/articles/how-to-preview-your-site/ | Site ist im Preview klickbar/scrollbar wie live; Verhalten kann getestet werden |
| P1.3 | Responsive-Test durch Fenstergröße | Preview | framer.com/help/articles/how-to-preview-your-site/ | Viewport in der Größe verändern, um zu sehen, wie sich die Site an unterschiedliche Bildschirmgrößen anpasst |
| P1.4 | Breakpoint-gebundene Vorschau | Canvas → Preview | framer.com/help/articles/how-to-preview-your-site/ | Breakpoint auf dem Canvas auswählen, danach startet Preview in der Breite dieses Breakpoints |
| P1.5 | Preview verlassen | Preview | framer.com/help/articles/how-to-preview-your-site/ | „Close"-Knopf oder Taste `Esc` |
| P1.6 | Projekt-Link teilen (ohne Framer-Konto ansehbar) | Tab-Leiste / Browser-Adressleiste | framer.com/help/articles/how-can-i-get-the-project-link/ | Rechtsklick auf den Projektnamen in der Tab-Leiste → „Copy Project Link"; im Browser genügt das Kopieren der URL aus der Adresszeile, solange man im Projekt ist |
| P1.7 | Zusätzliche Preview-Kürzel laut Kürzelübersicht | Preview-Bereich | framer.com/shortcuts (bereits vollständig in `FRAMER-KUERZEL-VOLLSTAENDIG.md` erfasst, Bereich „Preview" mit 8 Einträgen, u. a. ⌘P, ⇧⌘F, Z, ⇧⌘H, ⌘I, ⌘R, ⌘., ⌘,) | Nicht erneut einzeln aufgeführt, siehe Referenzdatei `FRAMER-CANVAS-FUNKTIONEN.md` §7.1/§11 — hier nur als Verweis, keine Dopplung |
| P1.8 | Kommentare im Preview/auf geteilten Links | — | nicht belegt | In der offiziellen Doku wurde KEIN Beleg gefunden, dass Betrachter eines geteilten Preview-Links (ohne Framer-Konto) dort Kommentare hinterlassen können. Das Kommentar-Werkzeug (siehe Z3.x) ist an den Editor-Canvas gebunden, nicht an den öffentlichen Preview-Link. Als unsicher/nicht bestätigt markiert — nicht ausgegeben als Tatsache |

## D — Domains

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| D1.1 | Kostenlose Framer-Subdomain | Site Settings → Hosting → Domains | framer.com/help/articles/how-to-connect-a-custom-domain/ | Auswahl aus `framer.app`, `framer.website`, `framer.photos`, `framer.media`, `framer.wiki`; DNS automatisch konfiguriert |
| D1.2 | Custom Domain verbinden | Site Settings → Hosting → Domains → „Connect a domain you own" | framer.com/help/articles/how-to-connect-a-custom-domain/ | Domainname eingeben, danach DNS-Einträge beim Registrar setzen |
| D1.3 | Apex-/Nacktdomain (z. B. example.com) | DNS beim Registrar | framer.com/help/articles/how-to-connect-a-custom-domain/ | Zwei A-Records: `31.43.160.6` und `31.43.161.6`; zusätzlich CNAME `www` → `sites.framer.app`; Warnung: keine anderen A-/AAAA-Records für die Domain |
| D1.4 | Subdomain (z. B. sub.example.com) | DNS beim Registrar | framer.com/help/articles/how-to-connect-a-custom-domain/ | Ein CNAME-Record `sub.example.com` → `sites.framer.app`; manche Provider verlangen einen abschließenden Punkt |
| D1.5 | www vs. non-www als Primärdomain | Site Settings → Hosting → Domains | Community/Blog-Quellen zu SSL/DNS (launchnow.design, brixtemplates.com) — kein direkter offizieller Framer-Help-Fund mit exaktem UI-Pfad, aber Verhalten stimmt mit `how-to-connect-a-custom-domain` überein | Beim Verbinden wird festgelegt, welche Version (mit/ohne `www`) die primäre ist; die jeweils andere wird automatisch dorthin weitergeleitet |
| D1.6 | SSL automatisch | Site Settings → Hosting → Domains | framer.com/help/articles/do-i-have-to-setup-ssl-when-adding-a-custom-domain-to-a-framer-project/ | Framer generiert automatisch ein SSL-Zertifikat für die Custom Domain; kein separater Kauf/Installation nötig |
| D1.7 | AAAA-Records vermeiden | DNS beim Registrar | framer.com/help/articles/troubleshooting-custom-domain-issues/ (über Suchergebnis zu SSL-Troubleshooting) | Gesetzte AAAA-Records können die SSL-Zertifikatsausstellung verhindern und HTTPS brechen — sollten entfernt werden |
| D1.8 | DNS-Propagation | Site Settings → Hosting → Domains | framer.com/help/articles/how-to-connect-a-custom-domain/ | Änderungen können bis zu 48 Stunden dauern, meist schneller |
| D1.9 | Integration neben bestehender Seite (Subdomain-Strategie) | Site Settings → Hosting → Domains | framer.com/help/articles/how-to-integrate-with-your-current-site/ | Einfachster Weg, Framer neben einer bestehenden Website zu betreiben: eigene Subdomain im Framer-Projekt setzen und per DNS dorthin zeigen |
| D1.10 | Redirects (Weiterleitungen) | Site Settings → Hosting → Redirects | framer.com/help/articles/how-to-setup-redirects-to-maintain-seo-ranking/, framer.com/updates/redirects | Altes/neues URL-Paar; Wildcard `*` matcht beliebige Pfadsegmente (`/blog/*`); Referenzierung von Capture-Groups im Ziel über `:1`, `:2`; `:slug` matcht ein einzelnes Segment zwischen Slashes; Regeln per Drag&Drop priorisierbar, Bearbeiten/Löschen über „…"-Menü; NUR Sub-Pfade innerhalb der eigenen Domain redirectbar, keine Redirects auf fremde Domains (dafür Hosting-seitige Einrichtung an der ALTEN Domain nötig); manuelle Slug-Änderungen aus Canvas/CMS aktualisieren bestehende Redirect-Regeln NICHT automatisch |

## S — Site Settings (je Reiter)

### S1 — General

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| S1.1 | Default Language | Site Settings → General | framer.com/help/articles/default-language-settings/ | Fallback-Sprache, falls auf einzelnen Seiten nichts Abweichendes gesetzt ist |
| S1.2 | Reduced Motion | Site Settings → General | framer.com/help/articles/reduced-motion-settings/ | Deaktiviert Parallax-, Transform- und Layout-Animationen für Besucher mit Systempräferenz „reduzierte Bewegung" |
| S1.3 | Password Protection (ganze Site) | Site Settings → General | s. V1.10 | Umschalter im General-Bereich |
| S1.4 | Custom Code global | Site Settings → General | framer.com/developers/custom-code | Vier Injektionspunkte: `headStart`, `headEnd`, `bodyStart`, `bodyEnd`; beliebiges HTML inkl. `<script>`/`<style>` |
| S1.5 | Site Images (Favicon, Social Image) | Site Settings → General | Suchergebnis-Zusammenfassung aus offiziellen Framer-Quellen (clicks-supply-Community-Zusammenfassung als Sekundärquelle, konsistent mit `how-to-update-page-titles-descriptions-and-social-images`) | Favicon-Upload und globales Social-Preview-Bild |
| S1.6 | Sitewide Title/Description | Site Settings → General | framer.com/help/articles/how-to-update-page-titles-descriptions-and-social-images/ | „Enter a Site title" / „Enter a Site description" als Fallback für alle Seiten ohne eigene Angabe |

### S2 — Domains

Siehe Abschnitt **D** oben — bei Framer liegt „Domains" als eigener Unterpunkt unter „Hosting" in den Site Settings (`Site Settings → Hosting → Domains`).

### S3 — SEO

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| S3.1 | Site-Titel/-Beschreibung | Site Settings → SEO (bzw. General, s. o.) | framer.com/help/articles/how-to-update-page-titles-descriptions-and-social-images/ | Sitewide Fallback-Metadaten |
| S3.2 | Page Settings — SEO-Sektion | Page Settings (linkes Panel, je Seite) | framer.com/help/articles/how-to-update-page-titles-descriptions-and-social-images/ | Pro Seite ein SEO-Abschnitt mit „drei Feldern, einem Umschalter und dem OG-Bild": Title, Page Description, OG-Bild, „Show page in search engines"-Umschalter |
| S3.3 | Individueller Title/Description je Seite | Page Settings → SEO | framer.com/help/articles/how-to-update-page-titles-descriptions-and-social-images/ | Überschreibt die Sitewide-Fallbacks für diese eine Seite |
| S3.4 | OG-/Social-Preview-Bild je Seite | Page Settings → SEO → „Page images" | framer.com/help/articles/how-to-update-page-titles-descriptions-and-social-images/ | Bestimmt die Darstellung beim Teilen auf LinkedIn, Twitter/X, Facebook, Slack; bei CMS-Seiten per „CMS Variables" dynamisch aus einem Bildfeld befüllbar |
| S3.5 | Suchsichtbarkeit / Indexierung je Seite | Page Settings → SEO → „Show page in search engines" | framer.com/help/articles/how-do-i-prevent-specific-pages-from-getting-indexed-by-search-engines/, framer.com/dictionary/index-toggle | Standardmäßig aktiv (Seite crawlbar); Deaktivieren setzt automatisch `noindex` im Robots-Meta-Tag UND sperrt den Zugriff für diese Seite in `robots.txt` — bewusst über `noindex`-Meta statt nur `robots.txt`, weil `robots.txt` allein nur das Crawlen blockiert, nicht die Entfernung aus dem Index garantiert |
| S3.6 | robots.txt automatisch generiert & abrufbar | `<domain>/robots.txt` | framer.com/help/articles/how-can-i-access-the-robots-txt-file/, framer.com/dictionary/robots-txt | Framer-Sites erzeugen automatisch eine `robots.txt` |
| S3.7 | sitemap.xml automatisch generiert | `<domain>/sitemap.xml` | framer.com/help/articles/guide-to-seo-features-and-tools/ | Wird automatisch mitgeliefert, „SEO-optimiert out of the box" |
| S3.8 | Canonical-URLs | Seiten-URL als Canonical | framer.com/help/articles/guide-to-seo-features-and-tools/ (allgemeiner Beleg), genaue UI-Feldbezeichnung für manuelles Überschreiben NICHT eindeutig belegt | Framer nutzt standardmäßig die Seiten-URL als Canonical-Tag; ein eigenes UI-Feld zum manuellen Überschreiben ist in den gefundenen offiziellen Quellen nicht mit exaktem Label dokumentiert — als teilweise unsicher markiert |
| S3.9 | JSON-LD / strukturierte Daten | Custom Code (je Seite oder global) | framer.com/help/articles/guide-to-seo-features-and-tools/ | Wird über Custom-Code-Injektion umgesetzt, kein dediziertes strukturiertes UI-Formular dafür belegt |
| S3.10 | Alt-Text für Bilder | Bild-Element → Accessibility-Feld | framer.com/help/articles/guide-to-seo-features-and-tools/, framer.com/help/accessibility/ | Alt-Text hilft Suchmaschinen und Screenreadern, wird angezeigt, wenn das Bild nicht lädt |
| S3.11 | Video-Poster/Thumbnails | Video-Element | framer.com/help/articles/guide-to-seo-features-and-tools/ | Setzt ein Vorschaubild für Videos, SEO-relevant |
| S3.12 | Redirects als SEO-Werkzeug | Site Settings → Hosting → Redirects | framer.com/help/articles/how-to-setup-redirects-to-maintain-seo-ranking/ | Empfohlen beim Umstrukturieren von URLs, um Ranking zu erhalten (s. D1.10) |
| S3.13 | `data-nosnippet`-Direktive | Accessibility-Einstellungen (laut SEO-Guide erwähnt) | framer.com/help/articles/guide-to-seo-features-and-tools/ | Im SEO-Guide unter „verfügbar in Accessibility-Einstellungen" genannt, kein separates UI-Detail gefunden |

### S4 — Redirects

Siehe **D1.10** — vollständig unter Domains/Hosting behandelt, nicht doppelt aufgeführt.

### S5 — Cookies/Consent

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| S5.1 | Cookie Banner Component (nativ) | Insert-Panel → Components/CMS, dann auf Seite platziert | framer.com/updates/cookie-banner-component, framer.com/academy/lessons/cookie-banner-component | Eigene Komponente „Cookie Banner"; fragt Besucher automatisch nach Zustimmung, bleibt zwischen Seiten offen, unterstützt regionsspezifische Cookie-Policy-Links, Standard-Einwilligungen, eigene Enter-/Exit-Animationen |
| S5.2 | Backdrop-Option | Cookie Banner Component | framer.com/updates/cookie-banner-component | Deaktiviert den Seiteninhalt, solange der Banner aktiv ist |
| S5.3 | Google Tag Manager-Integration für Consent | Custom Code / GTM-Setup | framer.com/help/articles/gdpr-and-cookies/ | Ermöglicht Einwilligungssteuerung über GTM, inkl. regionsspezifischer Links zur Cookie-Policy |
| S5.4 | Framer Analytics ohne Cookies | Site Settings → Analytics | framer.com/help/articles/gdpr-and-cookies/ | Framers eigenes Analytics-Feature „does not use cookies and does not generate any persistent identifiers" — dadurch ohne Cookie-Consent nutzbar |
| S5.5 | Drittanbieter-Consent-Tools (Cookiebot, Osano, CookieYes) | Custom Code | framer.com/help/articles/gdpr-and-cookies/ | Einbindung per Embed-Script in die Site-Settings-Custom-Code, als Alternative zur nativen Komponente |
| S5.6 | GDPR-Compliance-Anforderungen (Leitfaden, kein Feature) | Doku-Empfehlung | framer.com/help/articles/gdpr-and-cookies/ | Empfehlung: Accept-/Deny-Knöpfe, automatisches Blockieren von Cookies bis zur Zustimmung, granulare Einwilligungsoptionen, Link zur Cookie-Policy |

### S6 — Analytics

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| S6.1 | Framer Analytics (nativ) | Site Settings → Analytics / eigener Analytics-Modus im Editor | framer.com/help/articles/gdpr-and-cookies/, framer.com/help/integrations/ | Cookie-loses, datenschutzkonformes Analytics-Feature von Framer selbst |
| S6.2 | Google Analytics Measurement ID (natives Feld) | Site Settings → General | framer.com/help/articles/how-to-set-up-google-analytics/ | Eigenes Feld „Google Analytics Measurement ID"; GA4-Property-ID direkt einfügen, kein Custom Code nötig |
| S6.3 | Meta Pixel per Custom Code | Site Settings → Custom Code (`<head>`) | framer.com/help/articles/how-to-install-meta-pixel/ | Meta-Basiscode aus dem Events-Manager an den Start des `<head>`-Tags einfügen; ausschließlich dort, nicht in andere Custom-Code-Slots (sonst doppelte Events/kaputtes Tracking) |
| S6.4 | Meta Pixel Troubleshooting | Site Settings → Custom Code | framer.com/help/articles/troubleshooting-meta-pixel-on-your-site/ | Eigener Hilfe-Artikel zur Fehlersuche |
| S6.5 | Beliebige weitere Tracking-Tools | Site Settings → Custom Code | framer.com/help/articles/how-to-install-meta-pixel/ (Umfeld), framer.com/help/integrations/ | Alle nicht-nativen Tools (z. B. GTM, Plausible, PostHog) über Custom Code, empfohlen in `head end` |

### S7 — Code (Head/Body Injection, Custom Code je Seite)

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| S7.1 | Vier Injektionspunkte global | Site Settings → General → Custom Code | framer.com/developers/custom-code | `headStart`, `headEnd`, `bodyStart`, `bodyEnd` — je ein Textfeld für beliebiges HTML/`<script>`/`<style>` |
| S7.2 | Custom Code je Seite | Page Settings → Custom Code | framer.com/developers/custom-code (Konzept „location property"); Seiten-Ebene aus Kontext der Page-Settings-Struktur (S3.2) plausibel, aber ohne eigenen expliziten Beleg für ein UI-Feld „Page Custom Code" gefunden — **als teilweise unsicher markiert** | Seitenspezifischer Code zusätzlich zum globalen; exakter UI-Pfad nicht mit eigenem Zitat belegt |
| S7.3 | Empfohlene Platzierung nach Zweck | Site Settings → Custom Code | framer.com/developers/custom-code (Sekundärquelle mit Praxisbeispielen, Kern-API-Fakt offiziell) | Analytics-Skripte (GA4, PostHog, Plausible) in `head end`; Chat-Widgets (Intercom, Crisp) in `body end`, damit sie nach dem übrigen Seiteninhalt laden; Font-Preload-Links in `head start` |
| S7.4 | Code Components / Code Overrides (Entwickler) | Menü „Code" im Editor | Referenzdatei `FRAMER-CANVAS-FUNKTIONEN.md` §5.7/§12 (bereits erfasst: „Create Code Component…", „Create Code Override…", „API Documentation") | Nicht erneut im Detail behandelt, siehe Referenzdatei — hier nur Verweis |

### S8 — Fonts

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| S8.1 | Custom Fonts hochladen (Projektebene) | Typografie-Panel → „Custom"-Tab → „Upload Fonts" | framer.com/help/articles/how-to-add-custom-fonts/ | Font-Datei vom Rechner auswählen, danach auf beliebige Textebene im Projekt anwendbar |
| S8.2 | Empfohlenes Dateiformat | Font-Upload | framer.com/help/articles/how-to-add-custom-fonts/ | `.woff2` für beste Performance empfohlen |
| S8.3 | Font-Lizenz-Hinweise | Doku | framer.com/help/articles/how-to-choose-the-right-font-license-for-framer/ | Eigener Hilfe-Artikel zur Lizenzwahl |
| S8.4 | Font Loading Setting | Site Settings → Performance → Font Loading | framer.com/help/articles/how-are-fonts-optimized-in-framer/ | Modus „Auto" (Standard): `font-display: swap` nur, wenn Systemschrift dem Ziel nahekommt und der Swap nicht störend auffällt |
| S8.5 | Workspace-weiter Font-Upload | Team Settings im Framer-Dashboard | framer.com/help/articles/how-to-add-custom-fonts/ | WOFF/WOFF2 auf Workspace-Ebene hochladen, wird nach Neuladen offener Projekte dort verfügbar |

### S9 — Localization

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| S9.1 | Localization-Modus im Editor | Menü oben links → „Localization"-Ansicht | framer.com/help/articles/adding-a-new-locale/, framer.com/help/localization/ | Eigener Modus neben Canvas/CMS/Analytics/Settings (s. Referenzdatei §1.17) |
| S9.2 | Add Locale | Localization-Ansicht → „Add Locale" | framer.com/help/articles/adding-a-new-locale/ | Sprache auswählen, optional Region festlegen |
| S9.3 | Unterstützte Sprachen/Regionsvarianten | Localization | framer.com/help/articles/supported-languages-for-localization/ | 238 Sprachen/Regionsvarianten, u. a. Chinesisch Vereinfacht (`zh-Hans`)/Traditionell (`zh-Hant`), Aserbaidschanisch Kyrillisch (`az-Cyrl`), Serbisch Lateinisch (`sr-Latn`) |
| S9.4 | Fallback-Sprache je Locale | Localization → Locale-Einstellungen | framer.com/help/articles/adding-a-new-locale/ | Wird angezeigt, wenn für einen Locale eine Übersetzung fehlt |
| S9.5 | Manuelle Übersetzung | Canvas/CMS je Locale | framer.com/help/articles/adding-a-new-locale/ | Eigene Übersetzung direkt eintragen, auch direkt auf dem Canvas editierbar |
| S9.6 | AI Translation | Localization | framer.com/help/articles/adding-a-new-locale/, framer.com/updates/localization | Teilweise oder vollständige automatische Übersetzung des gesamten Inhalts |
| S9.7 | Auto Translate (laufende Synchronisation) | Localization | framer.com/help/articles/auto-translate-for-localization/ | Hält Inhalte über alle Locales automatisch synchron; bei Änderungen auf Canvas oder in der CMS werden Übersetzungen sofort neu generiert |
| S9.8 | Locale-Umschalter zur Vorschau | Canvas, untere Navigationsleiste | framer.com/help/articles/adding-a-new-locale/ | Locale-Symbol in der unteren Leiste wechselt die Sprachvorschau auf dem Canvas |
| S9.9 | Automatic Locale (Besucher-Weiterleitung) | Site Settings → Localization | framer.com/help/articles/how-does-automatic-locale-work/ | Eigener Hilfe-Artikel; erkennt Besuchersprache/-region und leitet automatisch zum passenden Locale weiter |
| S9.10 | Default Language (sitewide Fallback) | Site Settings → General | framer.com/help/articles/default-language-settings/ | Siehe S1.1 — Fallback, falls auf Seiten nichts Abweichendes gesetzt ist |
| S9.11 | Locale-spezifische Slugs / Language-Picker-Komponente | — | Konzept aus Localization-Feature plausibel (Slugs pro Locale sind bei mehrsprachigen Site-Buildern Branchenstandard), aber in den gefundenen offiziellen Framer-Quellen NICHT mit eigenem Zitat für ein UI-Feld „Slug je Locale" oder eine Komponente „Language Picker" belegt | Als unsicher markiert — nicht als bestätigtes Framer-Feature ausgegeben |

### S10 — Accessibility

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| S10.1 | Accessibility-Panel am Element | Element-Inspektor → Accessibility-Abschnitt | framer.com/help/articles/guide-to-web-accessibility-in-framer/, framer.com/help/accessibility/ | Bereits in Referenzdatei `FRAMER-STYLE-INSPEKTOR-FUNKTIONEN.md` §13.2 erfasst (Tag/Aria Label/Tab Index/Google Bot) — hier ergänzend Site-weite Aspekte |
| S10.2 | Alt-Text für Bilder | Bild-Element → Accessibility | framer.com/help/articles/guide-to-web-accessibility-in-framer/ | Hilft Suchmaschinen/Screenreadern, wird bei Ladefehler angezeigt |
| S10.3 | Custom Tab Order | Accessibility-Panel am Element | framer.com/help/articles/guide-to-web-accessibility-in-framer/ | Eigene Tab-Reihenfolge festlegen, z. B. um zuerst auf primäre CTAs zu lenken |
| S10.4 | Reduced Motion (Site-Einstellung) | Site Settings → General | framer.com/help/articles/reduced-motion-settings/ | Deaktiviert Parallax-/Transform-/Layout-Animationen für Nutzer mit Systempräferenz — bereits in S1.2 |
| S10.5 | Semantische Tags automatisch + überschreibbar | Text-Stile / Accessibility-Panel | framer.com/help/articles/guide-to-web-accessibility-in-framer/ | Text-Styles erhalten automatisch `h1`–`h6`/`p`; pro Instanz im Accessibility-Panel überschreibbar |
| S10.6 | ARIA-Labels | Accessibility-Panel am Element | framer.com/help/articles/improving-accessibility-with-aria-labels/ | `aria-label`-Attribut setzbar, besonders bei Elementen ohne sichtbaren Text |

### S11 — Performance / Image Optimization

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| S11.1 | Automatische Bildgrößen-Generierung | Bild-Upload (automatisch) | framer.com/help/articles/how-are-images-optimized-in-framer/ | Framer generiert automatisch mehrere Größenvarianten jedes hochgeladenen JPEG/PNG/WebP/GIF, damit Browser die passende Version je Bildschirmgröße/Auflösung laden |
| S11.2 | Verlustbehaftete Kompression | Bild-Optimierung (automatisch) | framer.com/help/articles/how-are-images-optimized-in-framer/ | Reduziert Dateigröße deutlich bei kaum sichtbarem Qualitätsverlust |
| S11.3 | Auto-Auflösung / WebP-Konvertierung | Fill → Image → Resolution „Auto" | framer.com/help/articles/how-are-images-optimized-in-framer/ | Bilder unverändert hochladen und Auflösung auf „Auto" stellen — Framer übernimmt WebP-Konvertierung und Resizing; bei Problemen „Auto (Lossless)" testen |
| S11.4 | Font Loading Performance-Einstellung | Site Settings → Performance → Font Loading | framer.com/help/articles/how-are-fonts-optimized-in-framer/ | Siehe S8.4 |
| S11.5 | Allgemeine Site-Optimierung / Speed-Guide | eigener Hilfe-Artikel | framer.com/help/articles/site-optimization/ | Übergreifender Leitfaden zu Geschwindigkeits-/Performance-Optimierung |

### S12 — Forms Inbox

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| S12.1 | Formular einfügen | Insert-Menü → Forms | framer.com/forms/, framer.com/help/articles/how-can-i-add-a-contact-form-to-my-framer-website/ | Formular-Komponente per Drag auf die Seite ziehen, Felder/Styling/Submission-Einstellungen anpassbar |
| S12.2 | „Send To"-Einstellung | Formular-Element → rechtes Panel → Send To | framer.com/help/articles/how-can-i-add-a-contact-form-to-my-framer-website/ (Konzept), Community-Bestätigung: framer.community/c/support/how-do-i-access-my-form-submissions-on-framer | Ohne gesetztes Ziel sendet ein Formular standardmäßig NICHTS; Ziel wählbar: E-Mail, Google Sheet, Custom Webhook |
| S12.3 | E-Mail-Ziel mit anpassbarem Inhalt | Formular-Einstellungen | framer.com/forms/ | Eigener Betreff und Absendername für die Benachrichtigungs-Mail konfigurierbar |
| S12.4 | Google-Sheets-Ziel | Formular-Einstellungen | framer.com/forms/ | Google-Konto verbinden, Submissions landen automatisch in einem Sheet |
| S12.5 | Webhook-Ziel / Zapier-Anbindung | Formular-Einstellungen | framer.com/forms/ | Weiterleitung an beliebige Dienste, z. B. via Zapier |
| S12.6 | Integrationen (Formspark, HubSpot, Typeform) | Formular-Einstellungen | framer.com/forms/ | Direkt im Projekt konfigurierbare Lead-Workflows |
| S12.7 | Spam-Schutz, Rate Limiting, Fallback-E-Mail | Formular (nativ, ohne Zusatzkonfiguration) | framer.com/forms/ | Eingebaute Sicherheitsmerkmale von Framer Forms |
| S12.8 | Unlimited Submissions auf allen Plänen (Stand 2026) | Pricing/Forms | framer.com/forms/ | Formulare kostenlos mit unbegrenzten Submissions auf allen Plänen nutzbar |
| S12.9 | Eigenes „Forms Inbox"-Dashboard innerhalb Framers | — | NICHT belegt als natives Framer-Feature; existiert nur als Drittanbieter-Plugin „Proofly Forms Inbox" (framer.com/marketplace/plugins/proofly-forms-inbox/) | Framer selbst bündelt Submissions nicht in einem eigenen Inbox-Dashboard — dafür Drittanbieter-Plugin nötig; als klar getrennt von nativen Features markiert |

### S13 — Members/Staff/Roles/Permissions

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| S13.1 | Workspace-Rolle Admin | Workspace-Settings → Members | framer.com/help/articles/member-roles-and-permissions/ | „Can manage workspace settings, members, billing, and projects" — kostenpflichtiger Sitz |
| S13.2 | Workspace-Rolle Editor | Workspace-Settings → Members | framer.com/help/articles/member-roles-and-permissions/ | „Can create and edit projects across the workspace. Can invite other editors" — kostenpflichtig |
| S13.3 | Workspace-Rolle Content Editor | Workspace-Settings → Members | framer.com/help/articles/member-roles-and-permissions/ | „Can manage CMS content, localization, and on-page editing across the workspace" — kostenpflichtig; eigener günstigerer Sitz-Typ (laut Pricing-Quellen ab Mai 2026 eingeführt, $10/Monat) |
| S13.4 | Workspace-Rolle Viewer | Workspace-Settings → Members | framer.com/help/articles/member-roles-and-permissions/ | „Has read-only access to all projects in the workspace. Cannot create projects or invite members" — kostenlos |
| S13.5 | Projekt-Rolle Owner | Projekt-Settings → Members | framer.com/help/articles/member-roles-and-permissions/ | Kann Projekt verwalten, Eigentum übertragen, Einstellungen verwalten, Inhalte bearbeiten |
| S13.6 | Projekt-Rolle Editor | Projekt-Settings → Members | framer.com/help/articles/member-roles-and-permissions/ | Bearbeitung gemäß zugewiesenen Rechten |
| S13.7 | Projekt-Rolle Viewer | Projekt-Settings → Members | framer.com/help/articles/member-roles-and-permissions/ | Nur-Lese-Zugriff auf das Projekt |
| S13.8 | Granulare Projekt-Berechtigungen (Design/Content/Deploy) | Projekt-Settings → Members (fortgeschrittene Pläne) | framer.com/help/articles/member-roles-and-permissions/ | Design = Layouts/Seiten/Komponenten/Design-Elemente erstellen/ändern; Content = CMS-Inhalte/Lokalisierung/inhaltliche Änderungen verwalten; Deploy = Site-Veröffentlichungen verwalten. Nur wer „Deploy" hat, darf auf den Live-Stand befördern (abhängig von Staging-Konfiguration) |
| S13.9 | Organisationen, Workspaces, Folders | Konto-Ebene | framer.com/help/articles/organizations-workspaces-and-folders/ | Struktur oberhalb von Projekten: Organisation → Workspace(s) → Folder → Projekte |
| S13.10 | Mitglieder einladen | Workspace/Projekt-Settings → Invite | framer.com/help/articles/inviting-members-to-a-workspace-or-project/ | Einladung auf Workspace- oder Projekt-Ebene möglich; Projekt-Mitglieder sehen NUR das eingeladene Projekt, Workspace-Mitglieder sehen alle Workspace-Projekte |
| S13.11 | Mitglieder herabstufen/entfernen | Workspace-Settings → Members | framer.com/help/articles/downgrading-or-removing-members/ | Eigener Hilfe-Artikel zum Downgrade/Entfernen |
| S13.12 | Live-Zusammenarbeit als Teil der Mitgliedschaft | Editor (alle Mitglieder mit Zugriff) | framer.com/help/articles/live-collaboration-in-framer/ | Siehe Z4 (Multiplayer) |

### S14 — Billing/Plans

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| S14.1 | Free-Plan | Pricing | Sekundärquellen zu framer.com/pricing (brixtemplates.com, jjgerrish.com, buildinframer.com — konsistent über mehrere unabhängige Quellen, kein direkter WebFetch auf framer.com/pricing gelungen) | Kostenloser Einstieg, u. a. 500 AI-Credits/Tag ohne Rollover |
| S14.2 | Basic-Plan | Pricing | s. o. | Rund $10/Monat (jährlich abgerechnet); u. a. 2 CMS-Collections, 50 GB Bandbreite, 30 Seiten, max. 2 Editoren, 1.000 AI-Credits/Monat |
| S14.3 | Pro-Plan | Pricing | s. o. | Rund $30/Monat; 10 CMS-Collections, 100 GB Bandbreite, 150 Seiten, Redirects, Staging und Branching mit Previews, bis zu 10 Editoren, 3.000 AI-Credits/Monat |
| S14.4 | Scale-Plan | Pricing | s. o. | Ab rund $100/Monat, für größere Teams/Sites |
| S14.5 | Enterprise-Plan | Pricing | s. o. | Individuelle Preisgestaltung, inkl. individuellem Onboarding, Training, Reaktionszeit-SLAs (framer.com/help/articles/support-explained/) |
| S14.6 | Editor-Sitzpreis | Pricing | s. o. | Zusätzliche Editor-Sitze $20/Monat je Plan |
| S14.7 | Content-Editor-Sitz (neu Mai 2026) | Pricing | s. o. | $10/Monat, eingeführt für Teams, die nur CMS-Zugriff benötigen |
| S14.8 | AI-Credit-System (planübergreifend) | Pricing / Site Settings | framer.com/help/articles/how-ai-credits-and-agents-pricing-work/, framer.com/blog/ai-credits-simpler-plans-and-lower-prices/ | Jeder Plan erhält eine monatliche Credit-Zuteilung statt separater Abrechnung je KI-Feature; zusätzliche Credits käuflich |
| S14.9 | AI-Credit-Verbrauch: was zählt, was nicht | s. o. | framer.com/help/articles/how-ai-credits-and-agents-pricing-work/ | Verbraucht Credits: Agent-Chat, Workshop-Chat, AI-Übersetzungen. Verbraucht KEINE Credits: automatisches Ebenen-Umbenennen, Tracking-ID-Vorschläge und andere „lightweight editor enhancements" |
| S14.10 | AI-Credit-Rollover | s. o. | framer.com/help/articles/how-ai-credits-and-agents-pricing-work/ | „Unused credits do not carry into the next billing cycle" — Erneuerung zum jeweiligen Abrechnungsdatum |
| S14.11 | AI-Credit-Zukauf | Workspace-Settings (Admin) | framer.com/help/articles/how-ai-credits-and-agents-pricing-work/ | Admins können ein „AI Credits"-Add-on für dauerhaft höhere monatliche Zuteilung kaufen; einmalige „Top-up credits" verfallen am Ende des Kalendermonats, in dem sie gekauft wurden |
| S14.12 | Verhalten bei erreichtem Credit-Limit | Editor | framer.com/help/articles/how-ai-credits-and-agents-pricing-work/ | Bei 100 % Nutzung pausieren credit-nutzende Funktionen; bereits laufende Anfragen werden noch fertiggestellt |
| S14.13 | Effizienzsteigerung der Agents (2026) | Update | framer.com/updates/agent-credit-usage | Agents nutzen bei größeren Multi-Step-Builds deutlich weniger Credits; OpenAI-Modelle ca. 25 % weniger Credits bei Multi-Step-Builds, alle Modelle 15–30 % weniger Schritte, 30–40 % weniger Tokens, weitere 10–15 % Ersparnis durch besseres Caching |

## Z — Zusammenarbeit & Verlauf

### Z1 — Version History

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| Z1.1 | Zugriff auf Version History | Framer-Logo → File → Version History | framer.com/help/articles/how-can-i-revert-to-a-previous-working-version-of-my-file/ | Kürzel ⇧⌘H (Mac) / ⇧Ctrl H (Windows) |
| Z1.2 | Snapshot-Frequenz | Version History | framer.com/help/articles/how-can-i-revert-to-a-previous-working-version-of-my-file/ | Alle 5 Minuten innerhalb der letzten 4 Stunden, stündlich innerhalb der letzten 24 Stunden, danach täglich |
| Z1.3 | Ältere Versionen sind nur ansehbar (view-only) | Version History | framer.com/help/articles/how-can-i-revert-to-a-previous-working-version-of-my-file/ | Elemente können aus einer alten Version kopiert und in die aktuelle Version eingefügt werden |
| Z1.4 | Vollständige Wiederherstellung | Version History → „Restore this version" | framer.com/help/articles/how-can-i-revert-to-a-previous-working-version-of-my-file/ | Rollt das komplette Projekt auf den gewählten Stand zurück |
| Z1.5 | Breakpoints werden beim Kopieren automatisch mitgezogen (2026-Update) | Version History | framer.com/updates/version-history-update | Beim Kopieren einer Sektion aus der Version History importiert Framer automatisch deren Breakpoints; bei Abweichung von den bestehenden werden diese automatisch aktualisiert |
| Z1.6 | Versionierte Links aus Staging & Versions | Staging & Versions | framer.com/help/articles/staging-and-versions/ | s. V1.5 — eigener, von Version History unabhängiger Mechanismus für veröffentlichte Versionen |

### Z2 — Branching

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| Z2.1 | Branch erstellen | Editor, Branch-Knopf „main" | framer.com/help/articles/how-to-use-branches-in-framer/, framer.com/blog/framer-3/ | Erstellt eine separate Kopie des Projekts zum gefahrlosen Experimentieren, ohne die Produktion zu beeinflussen |
| Z2.2 | Auto-Rebase auf main | Branch | x.com/benjaminnathan/status/2069093239110397975 (Praxisbeleg, kein offizieller Framer-Help-Artikel, aber im Einklang mit dem offiziellen Branching-Artikel) | Branches werden automatisch auf den aktuellen Stand von `main` rebased |
| Z2.3 | Merge per Drag&Drop | Branch → main | s. o. | Beliebigen Branch auf den eigenen ziehen, um zu mergen |
| Z2.4 | Review vor Merge | Branch | framer.com/help/articles/how-to-use-branches-in-framer/ | Änderungen werden reviewt, Freigabe eingeholt, dann gemergt; Produktion bleibt bis dahin unverändert |
| Z2.5 | Sub-Branches (Branch aus Branch) | Branch | framer.com/help/articles/how-to-use-branches-in-framer/ | Ein Branch kann von einem anderen Branch abgezweigt werden, um unabhängig an Features zu arbeiten, bevor alles zusammen auf `main` gepusht wird |
| Z2.6 | Konfliktbehandlung | Merge | framer.com/help/articles/how-to-use-branches-in-framer/ | Bei Änderungen am gleichen Inhalt in zwei Branches: manuelle Prüfung/Entscheidung nötig |
| Z2.7 | Branch-Preview-URL veröffentlichen | Branch → Publish | framer.com/help/articles/how-to-use-branches-in-framer/ | Ein Branch kann eine eigene Vorschau-URL erzeugen und geteilt werden, ohne `main`/die Live-Site zu beeinflussen |
| Z2.8 | Live-Übernahme nur über main | Branch → main → Publish | framer.com/help/articles/how-to-use-branches-in-framer/ | Um Änderungen live zu schalten: zuerst auf `main` anwenden, dann `main` veröffentlichen |
| Z2.9 | Agent kann Branches erstellen/mergen/veröffentlichen | Branching + Agent | framer.com/blog/framer-3/ | Im Rahmen von Framer 3.0: Agents können selbstständig Branches anlegen, mergen und publizieren |
| Z2.10 | Verfügbarkeit ab Pro-Plan | Pricing | s. S14.3 | Branching mit Previews ist Bestandteil des Pro-Plans (und höher) |

### Z3 — Comments/Feedback

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| Z3.1 | Comment-Werkzeug in der unteren Canvas-Leiste | Canvas, untere Leiste | framer.com/help/articles/how-to-use-the-canvas/ | Bereits in Referenzdatei `FRAMER-CANVAS-FUNKTIONEN.md` §7.2 erfasst (Kürzel `C`) — hier nur ergänzend |
| Z3.2 | Pins auf beliebigem Element | Canvas | framer.com/collaborate/ | „Pin feedback to any element" |
| Z3.3 | Thread-Antworten | Kommentar-Pin | framer.com/collaborate/ | „Reply in threads" |
| Z3.4 | Auflösen (Resolve) | Kommentar-Thread | framer.com/collaborate/ | „Resolve notes as changes are made" |
| Z3.5 | Kollaborationsumfang: intern, nicht extern auf Live-Site | Canvas (nur im Editor) | framer.com/collaborate/ | Kommentare/Live-Co-Editing/Version History sind für Team-Mitglieder INNERHALB des Editors gedacht, nicht für externes Kunden-Feedback auf der veröffentlichten Site |

### Z4 — Multiplayer/Live Cursors

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| Z4.1 | Live-Cursor anderer Betrachter | Canvas | framer.com/help/articles/live-collaboration-in-framer/ | „When multiple people are viewing the same page, their cursors appear on the canvas" |
| Z4.2 | Presence-Anzeige (Profilbilder) | Editor, oben rechts | framer.com/help/articles/live-collaboration-in-framer/ | Profilbilder aller mit Zugriff; farbig = aktiv anwesend, ausgegraut = zuvor zugegriffen |
| Z4.3 | Cursor Chat | Canvas | framer.com/help/articles/live-collaboration-in-framer/ | Taste `/` startet eine Nachricht neben dem eigenen Cursor; bleibt für Mitarbeiter sichtbar, solange der Cursor in deren Sichtfeld ist |
| Z4.4 | Follow-Modus (Auge-Symbol) | Presence-Leiste | framer.com/help/articles/live-collaboration-in-framer/ | Hover über Profilbild eines Mitarbeiters zeigt Auge-Symbol; Klick springt direkt zu dessen Ansichtsbereich |
| Z4.5 | Letzter Zugriffszeitpunkt | Presence-Leiste (Hover) | framer.com/help/articles/live-collaboration-in-framer/ | Hover zeigt, wann die Person zuletzt auf das Projekt zugegriffen hat |
| Z4.6 | Gleichzeitige Bearbeitung mehrerer Personen | Canvas | framer.com/help/articles/live-collaboration-in-framer/ | „Multiple people to work on the same project simultaneously" |

### Z5 — Notifications

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| Z5.1 | Toast-Benachrichtigung bei Komponenten-Update | Editor | framer.com/help/articles/how-to-update-your-components-in-framer/ | Meldung „Component has been updated" nach einem Component-Update |
| Z5.2 | Activity-Benachrichtigungen mit @-Erwähnungen | Framer Community/Account | framer.com/updates (August-2026-Eintrag) | Verbesserte Activity-Notifications rendern `@`-Erwähnungen und Links korrekt |
| Z5.3 | Likes-Tab im Profil | Framer Community | framer.com/updates (August-2026-Eintrag) | Neuer Tab, um geliketen Community-Content wiederzufinden — eher Community- als Editor-Feature, hier der Vollständigkeit halber erfasst |
| Z5.4 | `notify`-Funktion für Plugin-Entwickler | Plugin-SDK | framer.com/developers/reference/plugins-notify | Entwickler-API: `notify()` löst eine Toast-Benachrichtigung im Editor aus, konfigurierbar über `variant` und `durationMs` |

## PL — Plugins

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| PL1.1 | Plugins-Menü im Editor | Editor-Toolbar | framer.com/help/articles/how-plugins-work/ | Browse featured Plugins, Recent Plugins, Suche nach einem bestimmten Werkzeug |
| PL1.2 | Kein Installationsschritt nötig | Plugins-Menü | framer.com/help/articles/how-plugins-work/ | Plugins lassen sich sofort öffnen, ohne separate Installation |
| PL1.3 | Browse / Run Recent / Development Plugin / Developer Tools | Editor-Menü (bereits in Referenzdatei erfasst) | Referenzdatei `FRAMER-CANVAS-FUNKTIONEN.md` §4.13 (⌥⌘P · ⌥⌘L) | Nur Verweis, nicht dupliziert |
| PL1.4 | Developer Tools aktivieren | Main Menu → Plugin-Untermenü | framer.com/developers/plugins-quick-start | Schaltet den Entwicklermodus für eigene Plugins frei |
| PL1.5 | Development Plugin ausführen | Plugin-Menü → „Open Development Plugin" | framer.com/developers/plugins-quick-start | Führt das lokal in Entwicklung befindliche Plugin im Editor aus |
| PL1.6 | Lokale Entwicklung mit `npm run dev` | Terminal, Plugin-Projektordner | framer.com/developers/plugins-quick-start, github.com/framer/plugins | Nach `cd your-plugin` startet `npm run dev` den lokalen Entwicklungsserver für das Plugin |
| PL1.7 | Framer-Marktplatz für Plugins | framer.com/marketplace/plugins/ | framer.com/marketplace/plugins/, framer.com/plugins/ | Hunderte Plugins, teils mit einem Klick installierbar/verbindbar |
| PL1.8 | Kategorien im Marktplatz (u. a. E-Commerce) | Marktplatz | framer.com/community/marketplace/plugins/categories/ecommerce/ | Beispiel einer Kategorie-Seite; Marktplatz ist nach Themen/Kategorien gegliedert |
| PL1.9 | Beispielhafte populäre Plugins: Unsplash | Marktplatz | Sekundärquelle (framer.com/plugins/-Umfeld, aggregiert in Suchergebnis) | Zugriff auf hochwertige Bilder direkt im Editor |
| PL1.10 | Beispielhafte populäre Plugins: Figma-Sync | Marktplatz | s. o. | Bewegt Designs zwischen Figma und Framer |
| PL1.11 | Beispielhafte populäre Plugins: Tidy Up | Marktplatz | s. o. | Räumt den Canvas auf/strukturiert Ebenen |
| PL1.12 | Beispielhaftes Plugin: Frameshop (E-Commerce) | Marktplatz | framer.com/marketplace/plugins/frameshop/ | Verwandelt ein Framer-Projekt in einen vollständigen Online-Shop mit anpassbaren Komponenten |
| PL1.13 | Beispielhaftes Plugin: Rive (Animationen) | Marktplatz | Sekundärquelle (Suchergebnis-Zusammenfassung) | Interaktive Animationen einbinden |
| PL1.14 | Passwortschutz-Plugins (einzelne Seiten) | Marktplatz | framer.com/marketplace/plugins/password-protect/, framer.com/community/marketplace/plugins/pagelock/ | „Password Protect" (Adheeb) sichert Seiten in Sekunden, Passwörter ohne Code verwaltbar; „PageLock" sorgt dafür, dass gesperrter Inhalt den Browser gar nicht erst erreicht |
| PL1.15 | Umfang laut Drittanbieter-Verzeichnis (nicht offiziell Framer) | frameplugins.com (Drittquelle) | frameplugins.com/ | Kuratiertes Verzeichnis nennt „130+ Best Framer Plugins 2026"; NICHT die offizielle Framer-Zählung, nur als Anhaltspunkt für die Größenordnung |
| PL1.16 | Plugin-Entwickler-Dokumentation | framer.com/developers/* | framer.com/developers/plugins-introduction, framer.com/developers/plugins-quick-start | Einstieg/Quick-Start für eigene Plugin-Entwicklung |

## KI — Framer AI / Agent / Wireframer / Workshop

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| KI1.1 | Framer Agent auf dem Canvas | Editor, rechte Leiste „Agent"-Reiter | framer.com/ai/, framer.com/agents/, framer.com/blog/framer-3/ | Mit Framer 3.0 (16.06.2026) direkt auf dem Canvas verankert; entwirft Seiten, schreibt Code-Komponenten, verwaltet die CMS, prüft die Site |
| KI1.2 | Seiten aus Prompt oder Screenshot entwerfen | Agent-Chat | framer.com/blog/framer-3/ | Agents entwerfen Seiten von Grund auf oder aus einem Screenshot, inkl. responsiver Breakpoints |
| KI1.3 | Code-Komponenten schreiben | Agent-Chat | framer.com/blog/framer-3/ | Eigene Code-Komponenten per Prompt erzeugen |
| KI1.4 | CMS-Collections verwalten | Agent-Chat | framer.com/blog/framer-3/ | Agents können CMS-Collections umstrukturieren |
| KI1.5 | SEO-Metadaten generieren | Agent-Chat | framer.com/blog/framer-3/ | Automatisches Erzeugen von SEO-Metadaten |
| KI1.6 | Site-Audit (defekte Links, Barrierefreiheit, Stil-Inkonsistenzen) | Agent-Chat | framer.com/blog/framer-3/ | Prüft die Site auf defekte Links, Accessibility-Probleme und uneinheitliche Styles |
| KI1.7 | Wireframer | Insert/Agent-Umfeld | Sekundärquellen konsistent zueinander: superdesign.dev/blog/framer-ai-review, oma-kase.com/blog/framer-ai-features (kein direkter framer.com/help-Fund mit exaktem UI-Pfad) | Erzeugt schnelle, mehrseitige, responsive Entwürfe aus einem Prompt — „kills the blank canvas" |
| KI1.8 | Workshop | Editor (eigener Modus/Bereich) | s. o. (Sekundärquellen) | Für „Vibe Coding" komplexer Komponenten aus einer Beschreibung heraus; alles bleibt im selben Editor, iterativ verfeinerbar, bis das Ergebnis passt |
| KI1.9 | External Agents / Framer CLI (Claude Code, Cursor) | Framer CLI | framer.com/blog/framer-3/ | Externe KI-Agenten (z. B. Claude Code, Cursor) können über die Framer-CLI angebunden werden |
| KI1.10 | Modellwahl im Agent-Chat | Agent-Chat, Modell-Auswahl | Suchergebnis-Zusammenfassung mit Bezug auf framer.com/help/ai/ (Modellnamen aus Sekundärquelle, Grundfunktion „Modellwahl" durch die Zusammenfassung des offiziellen Hilfeartikels bestätigt) | Wahl zwischen mehreren Modellen (u. a. Claude Sonnet/Opus und ChatGPT/GPT) je nach Aufgabe; konkrete Modellversionsnummern schwanken je nach Quelle und Zeitpunkt — Namen NICHT 1:1 aus einem einzelnen offiziellen Snapshot zitierbar, daher als Bereich statt Einzelversion behandelt |
| KI1.11 | Neuer Chat je Aufgabe | Agent-Chat | Suchergebnis-Zusammenfassung (framer.com/help/ai/-Umfeld) | Empfehlung/Möglichkeit, für jede Aufgabe einen neuen Chat zu starten, um den Agent fokussiert zu halten |
| KI1.12 | `@`-Referenzen im Chat | Agent-Chat | Suchergebnis-Zusammenfassung (framer.com/help/ai/-Umfeld) | Mit `@` lassen sich Seiten, CMS-Collections, Styles oder Assets referenzieren |
| KI1.13 | Site-weiter Einsatz vs. Element-Ebene | Custom Code vs. Agent-Kontext | framer.com/help/articles/how-to-install-meta-pixel/ (Analogie site-weiter Code), framer.com/blog/framer-3/ (Agent kann sowohl einzelne Elemente als auch ganze Seiten/die Site ändern) | Der Agent kann sowohl an einem einzelnen ausgewählten Element arbeiten als auch site-weite Änderungen vornehmen (z. B. Audits, Struktur-Refactorings); site-weiter Code (z. B. Tracking-Snippets) wird dagegen technisch getrennt über Custom Code injiziert, nicht über den Agent |
| KI1.14 | AI-Credits als Abrechnungseinheit für den Agent | s. S14.8–S14.13 | framer.com/help/articles/how-ai-credits-and-agents-pricing-work/ | Siehe Abschnitt S14 — Agent-Chat, Workshop-Chat und AI-Übersetzungen verbrauchen Credits, leichte Editor-Hilfen nicht |
| KI1.15 | Branching-Integration des Agents | Branching + Agent | framer.com/blog/framer-3/, x.com/benjaminnathan/status/2069093239110397975 | Agent kann selbstständig Branches erstellen, mergen und veröffentlichen (s. Z2.9) |
| KI1.16 | Free-Plan-Kontingent für KI | Pricing | s. S14.1 | 500 AI-Credits/Tag im Free-Plan, ohne Rollover |
| KI1.17 | Rebranding/Einordnung: „Agents" statt einzelnem „AI"-Feature | Produktnaming ab Framer 3.0 | framer.com/blog/framer-3/ | Framer bezeichnet das Gesamtfeature seit 3.0 konsistent als „Agents" (Plural, mehrere spezialisierte Agenten), nicht mehr als einzelnes „Framer AI" |

---

## Nicht auflösbare/unsichere Punkte (bewusst nicht als Tatsache ausgegeben)

- **V1.11 Unpublish**: exakter UI-Pfad (Menü/Knopf-Bezeichnung) nicht mit einem offiziellen `framer.com/help`-Zitat belegt, nur über Community-Threads und die Nebenerwähnung bei Projekt-Löschung.
- **P1.8 Kommentare auf geteilten Preview-Links ohne Framer-Konto**: kein Beleg gefunden.
- **S3.8 Canonical-URL manuell überschreibbar**: Grundverhalten (Seiten-URL als Canonical) belegt, ein dediziertes UI-Feld zum manuellen Setzen eines abweichenden Canonical-Tags nicht mit eigenem Zitat gefunden.
- **S7.2 Custom Code je einzelner Seite** (zusätzlich zum globalen Custom Code): plausibel aus der Page-Settings-Struktur, aber kein eigenes Zitat mit exaktem Feldnamen gefunden.
- **S9.11 Locale-spezifische Slugs / eigene „Language Picker"-Komponente**: nicht mit einem offiziellen Zitat belegt.
- **S12.9 Natives „Forms Inbox"-Dashboard**: existiert NICHT nativ, nur als Drittanbieter-Plugin — bewusst als Negativ-Befund aufgenommen, damit es nicht fälschlich als vorhandenes Framer-Feature gilt.
- **KI1.7/KI1.8 Wireframer/Workshop**: Existenz und Grundfunktion aus mehreren unabhängigen Sekundärquellen konsistent bestätigt, aber ohne direkten Treffer auf einen offiziellen `framer.com/help`-Artikel mit exaktem UI-Pfad.
- **KI1.10 Modellnamen im Agent-Chat**: Modellwahl als Funktion bestätigt, exakte Versionsbezeichnungen der Modelle schwanken je nach Quelle/Zeitpunkt und wurden daher nicht als feste Liste übernommen.

---

## Zählung

| Präfix | Bereich | Anzahl Zeilen |
|---|---|---|
| V | Veröffentlichen (Publish) | 12 |
| P | Preview | 8 |
| D | Domains | 10 |
| S1 | Site Settings — General | 6 |
| S3 | Site Settings — SEO | 13 |
| S5 | Site Settings — Cookies/Consent | 6 |
| S6 | Site Settings — Analytics | 5 |
| S7 | Site Settings — Code | 4 |
| S8 | Site Settings — Fonts | 5 |
| S9 | Site Settings — Localization | 11 |
| S10 | Site Settings — Accessibility | 6 |
| S11 | Site Settings — Performance/Image | 5 |
| S12 | Site Settings — Forms Inbox | 9 |
| S13 | Site Settings — Members/Roles | 12 |
| S14 | Site Settings — Billing/Plans | 13 |
| Z1 | Version History | 6 |
| Z2 | Branching | 10 |
| Z3 | Comments/Feedback | 5 |
| Z4 | Multiplayer/Live Cursors | 6 |
| Z5 | Notifications | 4 |
| PL | Plugins | 16 |
| KI | Framer AI/Agent/Wireframer/Workshop | 17 |
| **Summe** | | **189** |

(Redirects sind unter D1.10 geführt und nicht separat als S4 gezählt, um Doppelzählung zu vermeiden; S2 Domains verweist ebenso auf D statt eigene Zeilen zu führen. Keyboard-Shortcuts und Help/Onboarding sind bereits vollständig in `FRAMER-CANVAS-FUNKTIONEN.md` §11 bzw. summarisch oben unter „Get started"/Academy-Fundstellen referenziert und wurden hier nicht als eigenes Nummernpräfix dupliziert, da für Shortcuts bereits eine vollständige 132-Einträge-Liste existiert und für Help/Onboarding keine über die Referenzdatei hinausgehende strukturierte Funktionsliste mit belastbaren Einzel-UI-Feldern auffindbar war.)
