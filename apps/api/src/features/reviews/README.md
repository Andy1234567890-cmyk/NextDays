# Slice: reviews

Bewertungs-Cockpit des Betriebs (myNextDays): **eine Liste über ALLE Kanäle**.
Zusammengeführt werden die eigenen Marktplatz-Bewertungen aus `public.reviews`
(myBestDays, Skala 1..5) und die Portal-Bewertungen aus `public.channex_review`
(Booking.com/Airbnb/Expedia, Skala 0..10). Die Gast-Seite des Marktplatzes liegt
im Slice `guest_reviews`.

- Router: `/api/v1/reviews` — Lesen `VIEW_REVIEWS`, jede Aktion `MANAGE_REVIEWS`.
  Eigentümer sehen nur Bewertungen ihrer Objekte (Liste **und** Detail, Wurzel 9)
  und sind read-only (§4.2).
- Tabellen: `reviews` (0006/0181/0186), `guest_reviews_by_host` (0186),
  `channex_review` (0262), `review_automation` + `review_automation_log` (0263),
  `guest_review_queue` (0267).

## Normalisierung

`UnifiedReview` hält die **Rohnote mitsamt ihrer Skala** (`score` + `scale`);
`score_5` ist die für Sterne umgerechnete Fassung. Fehlt eine Note, bleibt sie
`null` — die Oberfläche zeigt dann keine Sterne, nie eine 0 (Wurzel 4).
Kategorien behalten den Rohschlüssel des Kanals (`clean` ≠ `cleanliness`), damit
nichts zusammengelegt wird, was fachlich nicht dasselbe ist.

## Schreibpfade

Gelesen wird aus beiden Tabellen, **geschrieben quellenspezifisch**:

- `marketplace` → direkt in `reviews.host_reply`.
- `ota` → zuerst zum Portal (`channel_manager.reply_review`), erst nach Erfolg in
  den eigenen Bestand (Wurzel 1). Eine Antwort, die im Cockpit steht, aber beim
  Gast nie ankommt, wäre schlimmer als gar keine.

Eine Portal-Bewertung mit `is_replied` nimmt keine zweite Antwort (409, Wurzel
2); eine Antwort von Hand räumt den geplanten KI-Antwort-Entwurf ab (Wurzel 1).

Portal-Fehler werden NICHT roh durchgereicht: der channel_manager übersetzt sie
(4xx → „beim Portal nicht mehr verfügbar", sonst „Portal antwortet nicht") —
Provider-Sprache hat im Kundentext nichts zu suchen.

## Sichtbarkeit (Zwei-Wege, Airbnb-Modell)

`publication.py`: Gast→Objekt und Betrieb→Gast bleiben verdeckt
(`published_at IS NULL`), bis **beide** Seiten abgegeben haben oder die
14-Tage-Frist abläuft. Monoton — kein Rücksetzen. Von beiden Slices genutzt.

## Automatik (`automation.py`) und Warteschlange (`queue.py`)

Die Automatik **schickt nicht ab, sie plant**. Der Tick legt je fälligem Gast
einen Entwurf in `guest_review_queue` an (`status='geplant'`, mit `send_at` und
— wo bekannt — `expires_at`); die Oberfläche zeigt die Restfrist und bietet
Ändern · Überspringen · Sofort abschicken. Erst ein späterer Tick versendet, was
fällig und noch `geplant` ist. Vorher lief die Automatik blind: sie berechnete
die Fälligen und schickte im selben Atemzug ab — eine abgeschickte öffentliche
Bewertung lässt sich bei keinem Portal zurücknehmen.

- Jeder Eintrag trägt seine **Zustellart** (`zustellart`, 0566):
  `automatisch` geht zur Fälligkeit von selbst raus (Vorlagen-Automatik, KI
  bei „Automatisch senden"), `entwurf` wartet auf „Abschicken" durch einen
  Menschen. `send_due` nimmt NUR `automatisch`. Anlass (05.09.2026): sieben
  KI-Entwürfe mit `send_at=jetzt` gingen im Tick ihrer Entstehung öffentlich
  an Booking.com — die Zustellart stand nur in den Einstellungen.
- Gastbewertung und öffentliche Antwort hängen an DERSELBEN Airbnb-Bewertung;
  eindeutig ist deshalb `(review_id, richtung)` (0566), nicht `review_id`.
  `erledigt_durch_handarbeit` räumt gezielt je Richtung ab.
- Der Status wird VOR dem Versand beansprucht (Wurzel 2); ein zweiter Worker
  oder ein Retry reicht nichts doppelt ein. Scheitert der Versand an einem
  Fremdfehler (kein `ReviewError`), geht die Zeile zurück auf `fehler` und das
  Signal wird weitergereicht; `send_due` isoliert je Eintrag, nur
  `ChannexBudgetExhausted` beendet den Lauf.
- Ein Fehlschlag landet als `fehler` samt Grund in derselben Zeile (Wurzel 5) —
  sie taucht in der Oberfläche auf, statt still zu verschwinden.
- Ein übersprungener Eintrag BLEIBT stehen, sonst legte ihn der nächste Tick neu
  an und der Betrieb überspränge in Endlosschleife.
- Portal-Entwürfe nur für **Airbnb**: Booking.com und Expedia kennen keine
  Bewertung des Gasts, und Channex nimmt sie nur zu einer bestehenden Review
  entgegen. Kein Entwurf, dessen Fenster schon zu ist.
- Rückblickfenster 21 Tage: ein frisch eingeschalteter Betrieb soll nicht
  rückwirkend jede Altbuchung in die Schlange stellen.

Die **Erinnerungsmail** an den Gast geht dagegen direkt raus und wird in
`review_automation_log` beansprucht (`UNIQUE(reservation_id, kind)`). Ohne
`MARKETPLACE_BASE_URL` wird sie nicht verschickt (sichtbar geloggt statt still
übersprungen).

## Qualitäts-Dashboard

`GET /reviews/quality` liefert Ø, 5-Sterne-Quote, Antwortquote,
Kategorie-Durchschnitte, den Tagesverlauf und die Rangliste der Objekte
(schwächstes zuerst — dort ist etwas zu tun) über einen Zeitraum von höchstens
366 Tagen (Wurzel 8). Beide Skalen sind auf 5 Sterne normalisiert; Tage ohne
Bewertung bleiben OHNE Wert, statt als Nullpunkt einen Einbruch vorzutäuschen.

Ausgeführt vom Worker-Tick (`REVIEWS_TICK_SECONDS`, stündlich), der zugleich den
Fristablauf veröffentlicht und die Portal-Bewertungen spiegelt; derselbe Lauf
hängt als `POST /reviews/tick` hinter dem internen Cron-Secret.

## KI live — Diagnose und Realtime-Signal (0568)

`GET /reviews/ki/diagnose` nennt je offener Portal-Bewertung GENAU EINEN Grund
(`KiDiagnoseStufe`, `ki_diagnose.py`), in der Prüfreihenfolge des Laufs:
Warteschlangen-Eintrag (gesendet / Entwurf wartet / geplant / Fehler /
übersprungen / verfallen) → Protokoll ohne Eintrag (KI hat abgelehnt) →
Bewertungsmerkmal (verdeckt, Frist vorbei, älter als der Rückblick) →
Betriebseinstellung (KI aus, Katalog leer) → „wartet auf Lauf". Dazu der
Rahmen: letzter/nächster Lauf, letzter Schritt, Zustellart.

Realtime: `channex_review`, `guest_review_queue` und `review_ki_protokoll`
sind für den Client gesperrt (Wurzel 6). Das Signal ist `review_ki_stand` —
eine Zeile je Betrieb ohne Nutzdaten, die `KiStore.stand_setzen` bei jedem
Schritt des Laufs (`ki_lauf.py`) und bei jedem KI-Versand (`queue.py`)
fortschreibt. Die Oberfläche (`web/components/bewertungen/ki-live-panel.tsx`)
hört darauf und holt die Diagnose neu.

`POST /reviews/ki/lauf` fährt den Lauf sofort und NUR für den eigenen Betrieb
(`run(only_tenant=…)`, `send_due(only_tenant=…)`) — der Worker-Tick bleibt
stündlich (`ki_lauf.TAKT_SEKUNDEN` = `worker.REVIEWS_TICK_SECONDS`, per Test
deckungsgleich). Eigener Rate-Limit-Eimer (`/reviews/ki/lauf`).

## Abgrenzung

Portal-Bewertungen sind **intern**. Öffentlich — myBestDays-Marktplatz, Website
des Betriebs — erscheinen ausschließlich eigene, verifizierte
myBestDays-Bewertungen: Booking.com und Airbnb erlauben das Weiterveröffentlichen
ihrer Bewertungen nur eingeschränkt.

Frontend: `/bewertungen` mit vier Flächen — Alle Bewertungen · Geplant ·
Qualität · Automatik (`web/app/(dashboard)/bewertungen/layout.tsx`) —
und `web/lib/reviews.ts`;
`gastgeber/app/(dashboard)/bewertungen`; `mobile-nextdays/screens/HostReviews.tsx`.
Portal-Spiegel: `channel_manager/reviews_sync.py`.
