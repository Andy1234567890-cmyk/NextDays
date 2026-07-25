# Konzept „Andy" v2.1 — Der digitale Mitarbeiter von myNextDays

**Status:** Abgestimmtes Zukunftskonzept, KEIN Bauauftrag. v1 vom 24.07.2026, v2 nach
Drei-Agenten-Review (Internet-Recherche · Codebase-Prüfung · adversarialer Skeptiker) am selben Tag.
v2.1: Stufe C (Gesicht) von „stilisiert entschieden" auf ZWEI Optionen geöffnet — 3DGS-On-Device-
Rendering (Spatius-Klasse) macht fotoreal wirkende Avatare ohne Server-GPU-Streaming bezahlbar
und entkräftet das Kostenargument gegen Fotorealismus teilweise.
**Wesentliche Änderungen in v2:** Beweis-Vorstufe als Pflicht-Gate, Stufenreihenfolge gedreht
(Gehirn → Stimme → Gesicht), Wirtschaftlichkeits-Skizze, Vollbuchung anonym degradiert,
Zahlen-nie-aus-RAG-Regel, harter Autonomie-Deckel, Latenzziele realistisch differenziert,
Wettbewerbsabschnitt, indirekte Prompt-Injection, Streaming-Transport als eigener Posten.

**Zweck:** Grundsatzentscheidungen festhalten, die beim späteren Bau gelten. Werkzeugentscheidungen
fallen ERST beim Startschuss mit dann aktuellen Marktdaten. Markt-/Preisangaben sind Snapshots
von Juli 2026 und beim Start neu zu erheben.

---

## 0. Pflicht-Vorstufe: Der 2-Wochen-Beweis (Gate vor jedem Bau-Euro)

Das Konzept beschließt eine Sparte — aber es existiert noch kein Nachfrage-Beleg. Andy v1 läuft
im Dashboard, seine Nutzung wurde nie gemessen. Bevor irgendeine Ausbaustufe startet:

1. **v1 instrumentieren** (Metriken aus Abschnitt 8 auf die bestehende v1 bauen: Aufrufe,
   erkannte Intents, Fallback-Rate, Wiederkehr) und **4–8 Wochen messen**.
2. **Text-Chat mit echtem Tool-Calling** für die 5 aktivsten Tenants — validiert das „Gehirn"
   (Stufe A) textbasiert, ohne einen Cent in Stimme oder Gesicht.
3. **Fake-Door-Preistest:** „Andy Premium — 39 €/Monat, jetzt vormerken" im Dashboard.
   Die Klickrate ist die einzige Nachfragezahl, die zählt. Ergänzend 10–15 strukturierte
   Tenant-Interviews mit Preisanker.

**Kill-/Go-Kriterium (beim Start der Vorstufe konkret beziffern):** Ohne messbare
Wiederkehr-Nutzung UND eine definierte Mindestzahl zahlungsbereiter Vormerkungen wird
Stufe B (Stimme) nicht gestartet. Fällt der Beweis negativ aus, hat das Konzept fast nichts
gekostet. Fällt er positiv aus, hat die Sparte ihre Gründungszahl.

**Sequenzierungs-Klausel:** Startschuss für die Ausbaustufen frühestens nach Abschluss der
Mobile-Integration (P9) und der offenen Security-Gate-Rückstände. Während des Baus kein
paralleles Großpaket — das Team hat sonst vier Fronten und drei halbfertige Produkte.

---

## 1. Vision und Sparte

Der Avatar ist der sichtbare, sprechende Mitarbeiter von myNextDays: eine animierte Figur, die
Gäste, Kunden und Betreiber durch das System führt — beraten, navigieren, Workflows ausführen.

**Positionierung:** Nicht „wir bauen Avatar-Technologie", sondern **„der digitale Mitarbeiter
für das Gastgewerbe"** — gebaut auf zugekauften/offenen Basiskomponenten, differenziert durch
Domänenwissen, die bestehende Plattform und den Betreiber-Stamm.

**Die echte Marktlücke (aus dem Wettbewerbs-Review):** Hotel-Voice-/Chat-KI ist 2026 eine
etablierte Kategorie — aber fast alle Anbieter bedienen nur Telefon/Chat, kaum einer kann
Ferienwohnungs-PMS, und keiner hat ein Avatar-Gesicht. myNextDays' Differenzierung ist die
**tiefe PMS-Integration (FeWo + Hotel)**, nicht das Gesicht allein.

**Entschieden: Vertriebsweg** — erst Premium-Feature für eigene Tenants (mit Referenzen),
Öffnung nach außen später als bewusste Einzelentscheidung.

**Die Kanal-Frage (v2-Ergänzung, beim Beweis mit zu validieren):** Gäste kommunizieren heute
primär über WhatsApp/OTA-Inbox/E-Mail — Kanäle, die myNextDays bereits besitzt. Dasselbe
„Gehirn" (Stufe A) spart dort sofort messbar Arbeit (KI-Antwortentwürfe existieren im Posteingang
bereits ansatzweise). Der Website-Avatar ist die Vision; die Inbox ist der kürzeste Weg zum
bezahlten Nutzen. Die Vorstufe (Text-Tool-Calling) bedient bewusst beide Pfade — die Ergebnisse
entscheiden, welcher Kanal zuerst ausgebaut wird.

---

## 2. Wettbewerb (Snapshot Juli 2026 — beim Startschuss aktualisieren)

- **DACH:** DialogShift (Berlin) — Chat/Phone/E-Mail-KI für Hotels, ab ~200 €/Monat, Phone-KI
  ~2 €/Zimmer; Aikosmo (DE); Viqal.
- **International:** Canary AI Voice, HiJiffy Digital Concierge, myma.ai, HelloShift,
  SendSquared (~$2.000–10.000+/Monat, einer der wenigen mit FeWo-PMS-Integrationen).
- **Befund:** „Digitaler Rezeptionist" allein ist KEIN Alleinstellungsmerkmal mehr. Lücken:
  FeWo-PMS-Tiefe, Avatar-Präsenz, deutschsprachiger SMB-Preispunkt.

---

## 3. Nutzerkontexte und Oberflächen

Drei Berechtigungskontexte — dieselbe Figur, unterschiedliche Rechte und Wissensbasen:

| Kontext | Wissensbasis | Ziel |
|---|---|---|
| **Anonymer Besucher** | Nur öffentliches Wissen + öffentliche Buchungs-APIs | Beraten, zur Buchung führen |
| **Eingeloggter Gast/Kunde** | Zusätzlich eigene Buchungen/Daten (Token-Scope) | Self-Service, Workflows |
| **Betreiber (nach Rolle)** | API + RAG im Rollen-Scope, inkl. Schreibaktionen | Arbeit abnehmen |

**Entschieden: Einsatzorte (langfristig):** 1. Tenant-Webseiten (Baukasten) · 2. Plattform-
Marktplatz · 3. Marketing-Seite. Rollout: **Betreiber zuerst** (kontrollierte, eingeloggte
Gruppe; Referenzen), dann Tenant-Webseiten, dann Marktplatz, dann Marketing.

**Geändert in v2 — Anonym-Scope:** Vollbuchung per Stimme bleibt **Zielbild**, startet aber
degradiert: **Suche + Vorauswahl + Beratung per Stimme, Abschluss im UI.** Vollbuchung per
Gespräch wird erst freigeschaltet, wenn kumulativ gelöst: (a) Zahlungs-Autorisierung VOR der
Reservierung (die Karte hält die Nacht, nicht das Gespräch — sonst sperren Fake-Buchungen echte
Nächte, die per Channex zu Booking/Airbnb als belegt syncen: realer Umsatzschaden beim Tenant),
(b) Missbrauchsschutz vor Session-Start (Turnstile/Proof-of-Work), (c) Kosten-Budget pro
anonymer Session (harter Cut). 

**Unverändert nicht verhandelbar:** **Zahlungsdaten werden NIEMALS gesprochen.** Kartennummern
per Stimme landen in Transkripten, Logs, LLM-Kontext und sind mithörbar (PCI-DSS/DSGVO). Im
Zahlungsmoment blendet der Avatar das sichere Zahlungselement ein (Stripe-Widget/Apple Pay) —
die öffentliche API dafür existiert bereits (`POST /payments/booking/{id}/intent`).

---

## 4. Rechte-Modell (nicht verhandelbar)

**Grundsatz: Der Avatar erbt die Rechte des eingeloggten Menschen. Er hat nie eigene.**

- Grenzen werden **serverseitig** erzwungen: dieselben Endpoints wie die UI, Session-Token,
  tenant-scoped (RLS). Das LLM entscheidet NIE selbst über Datenzugriff (Prompt-Injection).
  **v2-Hinweis aus dem Code-Review:** Der heutige Voice-Endpoint bekommt seinen Daten-Kontext
  als Snapshot VOM CLIENT geschickt — beim Umbau auf Tool-Calling wird auf serverseitige
  Datenladung mit AuthContext umgestellt (Muster existiert in allen anderen Slices).
- RAG pro Kontext gefiltert (öffentlich / Token / Rolle). „Zugriff auf alles" existiert nicht.
- Rollen-Datensplit gilt (staff/cleaner sehen keine Finanzen); Gast-Masking bleibt
  (maskierte Felder als „—" sprechen, nie erfinden).
- **Neu in v2 — Zahlenregel:** Preise, Verfügbarkeit, Gebühren kommen **AUSSCHLIESSLICH aus
  Live-API-Antworten desselben Gesprächszugs — NIEMALS aus RAG.** Ein Index ist ein zweiter,
  veralteter Datenbestand (verstößt gegen Wurzel 1 / Single-Source-Pricing). Technisch
  erzwingen (Antwort-Validierung: genannte Zahlen müssen aus einem Tool-Ergebnis stammen),
  nicht per Prompt erbitten. Eine falsch GESPROCHENE Preiszusage („vom Mitarbeiter gehört")
  ist rechtlich schwerer als ein Webseiten-Tippfehler.
- **Neu in v2 — indirekte Prompt-Injection:** Payloads in Gäste-Notizen, Buchungsdaten,
  OTA-Nachrichten, RAG-Dokumenten, die der Avatar beim Abruf „mitspricht" (Analogie:
  CLAUDE.md Wurzel 8, zweite Ordnung). Gegenmaßnahmen als Bau-Pflicht: Kontextdaten als
  untrusted markieren, Output-Prüfung vor TTS, Multi-Turn-Red-Teaming vor jedem Rollout.
- Anonyme Voice-/KI-Endpoints: **eigener strenger Rate-Limit-Bucket** (Wurzel 8). Die
  Limiter-Infrastruktur existiert (Redis/Lua, Bucket-Middleware) — der Voice-Bucket fehlt
  heute und ist Pflicht VOR jedem anonymen Endpoint.

**Gestufte Autonomie im Betreiber-Kontext — geändert in v2:**

| Stufe | Beispiele | Verhalten |
|---|---|---|
| Routine | Navigation, Entwurf, Vorlesen, Statusfragen | sofort ausführen |
| Datenänderung | Reservierung ändern, Preis anpassen, Nachricht senden | gesprochene Rückfrage |
| Geld/Extern | Storno, Auszahlung, OTA-Sync-Änderung | sichtbare UI-Bestätigung (Klick) — **HARTER DECKEL: per Tenant-Einstellung NICHT auf „nur Stimme" absenkbar** |

Stufen Routine/Datenänderung bleiben pro Tenant einstellbar. Zuordnung jeder Aktion zu einer
Stufe als eine gepflegte Tabelle (Single Source).

**Neu in v2 — Pflichtbestandteile der Schreibfähigkeit:**
- **Audit-Log** jeder Avatar-Aktion: Transkript-Ausschnitt, verstandener Intent, Wortlaut der
  Rückfrage, Tool-Call, Ergebnis — als EIN reproduzierbares Log-Objekt (Support-Fähigkeit).
- **1-Klick-Undo** für Datenänderungen, wo fachlich möglich.
- STT-Fehlhören ist eine eigene Fehlerklasse („storniere Meier" vs. „sortiere Meier") —
  kritische Aktionen wiederholen den verstandenen Kern in der Rückfrage.
- **Haftung/AGB:** eigener Absatz in den Nutzungsbedingungen, bevor Schreibaktionen live gehen
  — gleiche Verbindlichkeit wie die PCI-Grenze.

---

## 5. Ist-Stand als Fundament (Juli 2026, code-verifiziert)

„Andy" v1 (bestätigt durch Codebase-Review):
- `web/components/dashboard/voice-assistant.tsx` (1.939 Z.): Wake-Word, Consent-Gate,
  Follow-up-Fenster; STT/TTS = Browser-APIs (Hauptschwäche: Qualität; auf iOS-Safari praktisch
  nicht verfügbar — siehe Latenz/Plattform-Ziele).
- `web/lib/voice-commands.ts`: 20 NAV_TARGETS, 2 DATA_SKILLS, UI-Aktionen, 1 Schreibaktion
  mit Rückfrage-Muster → **1:1-Vorlage für die Tool-Registry der Stufe A**.
- Backend `POST /api/v1/dashboard/voice` → Groq, Text rein/raus; kein Tool-Calling, kein RAG.

**Tragfähig laut Code-Review:** öffentliche Buchungs-API inkl. Verfügbarkeit/Preis-Resolver/
Reservierung/Zahlungs-Intent; Builder mit sauberem Widget-Einbettungspunkt (Tenant-Kontext via
Middleware); Rate-Limit-Basis; AuthContext/Rollen; next-intl mit 24 Sprachdateien; Realtime.

**Ehrliche Lücken (Aufwandstreiber):**
- **RAG: grüne Wiese (GROSS)** — kein pgvector, keine Embeddings; Migrationen mit RLS+revoke
  (Wurzel 6), Ingestion, Kontext-Filter.
- **Streaming-Transport (MITTEL–GROSS)** — API ist rein Request/Response; WebSocket/SSE inkl.
  Socket-Auth ist ein eigener Infrastruktur-Posten für Stufe B.
- **Anonymer Voice-Endpoint (MITTEL)** — existiert nicht; Muster booking_engine + strenger Bucket.
- **Tool-Calling-Schicht (MITTEL)** — GroqClient kann keine Tools; Registry + Autonomie-Tabelle
  + serverseitige Ausführung: Neubau auf klarer Vorlage.
- **LLM-Kapselung (KLEIN)** — GroqClient liegt im inbox-Slice und wird quer importiert; nach
  core/ bzw. eigenes Modul ziehen (Schnittstellen-Prinzip Abschnitt 7).
- **Messung (KLEIN)** — keine Feedback-/Telemetrie-Tabellen; Teil der Pflicht-Vorstufe.

---

## 6. Ausbaustufen — Reihenfolge geändert in v2: Gehirn → Stimme → Gesicht

Begründung der Drehung: Tool-Calling ist textbasiert billig validierbar (Vorstufe!), liefert
den eigentlichen Nutzwert und funktioniert notfalls mit mittelmäßiger Stimme — umgekehrt
poliert eine teure Stimme nur den Kanal, bevor es etwas zu sagen gibt.

### Stufe A — Gehirn (vormals Stufe 2)
LLM-Tool-Calling: NAV_TARGETS/DATA_SKILLS/Aktionen als Tool-Registry mit Autonomie-Stufen;
serverseitige Ausführung mit AuthContext (ersetzt Client-Snapshot); RAG pro Kontext für
Wissen außerhalb der APIs (Zahlenregel!); definierte Frontend-Aktions-Schnittstelle
(Navigieren, Vorbefüllen, UI-Trigger) als eigenes Arbeitspaket. Läuft zuerst als Text-Chat
(= Vorstufe), dann hinter der Stimme.

### Stufe B — Stimme (vormals Stufe 1)
Browser-STT/TTS ersetzen. **Architektur-Entscheidung beim Startschuss ist dreigleisig
(v2-Ergänzung):** (1) Kaskade STT→LLM→TTS — 2026 der sichere Default für tool-lastige Agents,
Kosten flach (~$0,15/min Referenz), volle Anbieter-Austauschbarkeit; (2) **Realtime-Speech-to-
Speech** — produktionsreif und teils deutlich billiger (Gemini Live ~$0,023/min, Nova Sonic
~$0,017/min; OpenAI Realtime teuer durch Kontext-Akkumulation: Kosten steigen mit
Gesprächslänge!), Tool-Calling dort noch rauer; (3) gemanagte Voice-Agent-Plattformen (Vapi,
Retell u. ä.) — schnell, aber Lock-in: im Zweifel wegen Austauschbarkeits-Prinzip verwerfen.
Orchestrierung (Turn-Detection, Barge-in, VAD, Transport) NICHT selbst erfinden — offene
Frameworks (Pipecat, LiveKit Agents) sind Stand der Technik und provider-agnostisch.

**Latenzziele — realistisch differenziert (v2):** < 1,5 s bis Antwortbeginn bei reinen
Antworten; **< 3 s bei Tool-Calls**, überbrückt durch hörbares/sichtbares Denk-Feedback der
Figur. **iOS-Safari ist Referenzplattform Nr. 1** für den Gast-Kontext (Wake-Word-Muster der
v1 existiert dort nicht — Interaktionsmodell pro Plattform festlegen). STT-Abnahme mit
Dialekt-/Akzent-Testset (bairisch/schwäbisch, NL/FR-Akzent, Code-Switching), nicht mit
Demo-Hochdeutsch.

### Stufe C — Gesicht (vormals Stufe 3) — geändert in v2.1: ZWEI Optionen
Die Kostenlage hat sich geändert: **3D Gaussian Splatting (3DGS) mit On-Device-Rendering**
(Spatius-Klasse, Playground geprüft 24.07.2026) liefert fotoreal wirkende Avatare OHNE
Server-GPU-Videostream für ~$0,006–0,007/min (nur Avatar-Schicht). Das alte K.-o.-Argument
gegen Fotorealismus (Streaming-Kosten skalieren mit Neugier) gilt für diese Klasse nicht mehr.
Entscheidung beim Startschuss zwischen:

**Option C1 — eigene stilisierte/hochwertige 3D-Figur, browser-gerendert:**
volle Kontrolle und Markenbesitz, null Fremdkosten pro Minute, kein Lock-in, kein
Uncanny-Valley-Risiko. OSS-Basis reif (met4citizen/TalkingHead: 3D-Browser-Avatare mit
deutschem Echtzeit-Lip-Sync; Rive + Viseme-Mapping für 2D). Professioneller
Charakterdesigner/3D-Artist erforderlich (menschlich wirkende Figur, ~12 Viseme, Blinzeln,
Blickfolgen — deutlich über Studienblatt-Niveau).

**Option C2 — 3DGS-Fotoreal (Spatius-Klasse, rendering-only):**
„sieht aus wie ein Mensch" zu marginalen Kosten. Abnahmekriterien VOR der Wahl:
(a) Uncanny-Test bestanden — überzeugt auch nach 3+ Minuten Gespräch, nicht nur im ersten
Eindruck; (b) DSGVO geklärt — wohin fließen Audio/Sitzungsdaten, AVV/EU-Hosting;
(c) Lock-in bewertet — Avatare leben in Anbieter-Format/Infrastruktur, Exit-Pfad benennen;
(d) Kostenkappe greift auch hier (Session-Budget). NICHT in Frage kommt, die 3DGS-Technik
selbst zu entwickeln (Capture, Splat-Training, Echtzeit-Animation = Forschungsniveau,
gleiche Kategorie wie „eigenes Foundation-Model").

**Beiden gemeinsam (unverändert):** Zustände idle/zuhören/denken/sprechen; „denken" ist die
Latenz-Brücke aus Stufe B. Das Gesicht bleibt austauschbare Präsentationsschicht hinter
eigener Schnittstelle — Gehirn (A) und Stimme (B) sind von der Wahl unberührt; ein späterer
Wechsel C1↔C2 tauscht das Gesicht, nicht das System.

**Figur-Branding (entschieden):** Figur-Familie mit myNextDays-Basis — Betreiber wählt Name,
Look-Variante, Stimme; dezentes „powered by myNextDays". **v2-Schranke gegen Kombinatorik:**
Konfigurierbarkeit kommt NICHT in der ersten Ausbaustufe — erst EINE Konfiguration im
Betreiber-Kontext, Figur-Familie erst mit dem Tenant-Webseiten-Rollout und erst nach
positivem Beweis. Jede Konfigurationsachse ist ein Support- und Testfall.

**Sprachen (entschieden):** DE + EN zuerst, Architektur mehrsprachig ausgelegt (next-intl-
Fundament mit 24 Sprachen existiert); weitere Sprachen nach Tenant-Bedarf.

---

## 7. Build-Strategie

**Selbst erfinden nur, wo die Differenzierung liegt** (Orchestrierung der Domäne, Tool-Registry,
Figur, UX). Basiskomponenten (LLM, STT, TTS, Voice-Orchestrierung) mieten ODER offene Modelle/
Frameworks selbst hosten — nie von Grund auf entwickeln.

**Austauschbarkeit als Architekturprinzip (ab dem ersten Commit):** LLM, STT, TTS,
Avatar-Rendering je hinter eigener schmaler Schnittstelle. Erster konkreter Schritt: GroqClient
aus dem inbox-Slice in ein zentrales Modul ziehen.

**Ersetzen später — pro Schicht, nach Zahlen:** (1) Stückkosten fressen Marge, (2) Komponente
wird Differenzierung, (3) Anbieter-Risiko real. Sonst nicht ersetzen.

**Wirtschaftlichkeit (v2 — Skizze, beim Startschuss mit echten Angeboten präzisieren):**
Referenzrechnung Kaskade, mittlerer Tenant, 300 Gespräche/Monat à 3 min (900 min):
STT ~5 $ + hochwertiges DE-TTS ~30–40 $ + LLM/Tools/RAG ~20–30 $ ≈ **55–75 $/Monat Kosten** —
gegen realistisch 19–49 € Premium-Preis: Marge null bis negativ. Konsequenzen (verbindlich):
- **Kostenkappe pro Tenant/Monat** (harter Cut oder minutengenaue Abrechnung statt Flat).
- S2S-Pfad (~$0,02/min-Klasse) beim Startschuss ernsthaft gegen die Kaskade rechnen —
  die Kostenrangfolge hat sich 2026 gedreht; Achtung Kontext-Akkumulations-Falle bei OpenAI.
- Deckungsbeitrag pro Kontext VOR jedem Rollout rechnen; anonymer Kontext nur mit
  Session-Budget + Missbrauchsschutz (Abschnitt 3).

**Datenschutz — von Checkliste zu Architekturbedingung (v2):** Voice-Datenflüsse (Transkripte
= personenbezogene Daten; Dauerlauschen im Betreiber-Büro = Mithören Dritter) gestalten die
Anbieterwahl (EU-Hosting/AVV/Drittland) MIT, nicht nachträglich. Consent-Modell pro Kontext;
legal-pages beim Rollout nachziehen.

---

## 8. Erfolgsmessung

Explizites Feedback allein ist zu schwach (niedrige Quote, Negativ-Bias). Beides:

**Implizit (automatisch, pro Tenant):** Aufgaben-Abschlussrate · Fallback-Rate ·
Korrektur-Rate · Wiederkehr (Woche 4+ = ehrlichster Indikator).
**Explizit:** Daumen + optionales Kommentarfeld pro Antwort, gespeichert pro Tenant und
Anfrage-Typ. Technisch klein (Tabelle mit RLS+revoke, Endpoint, zwei Buttons).

**v2:** Diese Messung ist Teil der **Pflicht-Vorstufe** (auf v1 bauen), nicht des späteren
Baus. Zielwerte werden nach der Baseline-Messung beziffert; das Go/Kill-Kriterium aus
Abschnitt 0 hängt daran.

---

## 9. Markt-Snapshot Juli 2026 (beim Startschuss NEU erheben)

- Fotoreal-Video gebündelt: ~$0,11–0,37/min (Anam, Tavus, BeyondPresence) · Rendering-only
  ~$0,006–0,02/min (Simli, Spatius) — bestätigt aktuell (Review 24.07.2026).
- 3DGS-On-Device (Spatius): fotoreal wirkend, Rendering auf dem Endgerät, ~$0,0056–0,007/min
  Avatar-Schicht; LLM/STT/TTS liefert man selbst → Grundlage der C1/C2-Öffnung in v2.1.
- S2S-Audio: Gemini Live ~$0,023/min · Nova Sonic ~$0,017/min · OpenAI Realtime ~$0,30/min
  steigend mit Gesprächslänge · Kaskaden-Referenz ~$0,15/min flach.
- STT: Deepgram Nova-3/Flux ~$0,005–0,008/min · selbst hostbar: NVIDIA Parakeet (DE, ~6 % WER).
- TTS mit Deutsch: Cartesia Sonic (~40 ms TTFA) · ElevenLabs Flash (~75 ms) · OpenAI
  gpt-4o-mini-tts (~$0,015/min) · Open Source: Chatterbox (MIT, DE, Streaming) — die populären
  Kokoro/Orpheus können KEIN Deutsch.
- Unabhängige Bewertung Fotoreal-Avatare: „very easy to distinguish from real humans".

---

## 10. Startschuss-Checkliste (Entscheidungen für später)

0. **Gate:** Vorstufe (Abschnitt 0) positiv abgeschlossen; P9 + Security-Rückstände fertig.
1. Architektur Stimme: Kaskade vs. S2S vs. Hybrid — mit frischen Preisen/Benchmarks, inkl.
   Kontext-Akkumulations-Kosten und Tool-Calling-Zuverlässigkeit; Orchestrierungs-Framework
   wählen (Pipecat/LiveKit-Klasse), nicht selbst bauen.
2. STT/TTS-Shortlist + Selbst-Hosting-Option: Qualität DE/EN mit Dialekt-Testset,
   Streaming-Latenz, EU-Hosting/AVV.
3. LLM-Wahl für Tool-Calling + Kostenrechnung pro Gespräch; Kostenkappen-Mechanik.
4. RAG-Stack, Index-Strategie pro Kontext, Ingestion; Zahlenregel technisch erzwingen.
5. Streaming-Transport (WebSocket/SSE) inkl. Socket-Auth — eigenes Arbeitspaket.
6. Frontend-Aktions-Schnittstelle spezifizieren; iOS-Safari-Interaktionsmodell.
7. Gesicht: C1 vs. C2 entscheiden — C1: Figur-Design mit Profi-Artist auf OSS-Basis
   (TalkingHead/Rive), Lip-Sync DE; C2: Spatius-Klasse gegen die vier Abnahmekriterien
   testen (Uncanny 3+ min, DSGVO/AVV, Exit-Pfad, Session-Budget); Anbieterlage neu erheben.
8. Autonomie-Tabelle initial befüllen; Audit-Log + Undo; AGB/Haftungs-Absatz.
9. Anonymer Voice-Endpoint: Bucket, Turnstile/PoW, Session-Budget.
10. Zielwerte der Erfolgsmetriken aus der Vorstufen-Baseline; Datenschutz-Paket
    (AVV, Drittland, Datenschutzerklärung, Consent pro Kontext).

---

*Alle Festlegungen folgen CLAUDE.md (Wurzeln 1–9, Datenmodell, Vertriebskanäle). Besonders:
Rechte serverseitig (W3/6), Rate-Limits für teure Endpunkte (W8), Injection zweiter Ordnung
(W8), Item-Scope (W9), Gegenzustände bei Storno/Sync (W1), Idempotenz bei Buchung/Zahlung (W2),
keine erfundenen Werte — maskiert wird „—" gesprochen (W4).*
