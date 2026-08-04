# Channex: Staging → Produktion (Go-Live)

Stand 04.08.2026. Live-Konto: Organisation/Billing-Account
`1528b0e4-6dba-49b7-b8c6-dfb34de315c9`.

## Was Staging von Produktion trennt

Es gibt **zwei getrennte Channex-Installationen** mit getrennten Konten, Objekten,
Kanälen, Webhooks und API-Schlüsseln. Nichts davon wandert mit; ein
Staging-Schlüssel gibt auf Produktion 401 (live gemessen).

| | Staging | Produktion |
|---|---|---|
| API | `https://staging.channex.io/api/v1` | `https://app.channex.io/api/v1` |
| Oberfläche | `staging.channex.io` | `app.channex.io` |
| API-Schlüssel | Organisation → API Keys (Staging) | Organisation → API Keys (Prod) |

`secure.channex.io` brauchen wir **nicht**: wir lesen aus `guarantee` nur
`is_virtual`/`payment_collect`, nie Kartendaten (`bookings_sync.py:1201`).

Der Prod-Schlüssel setzt ein **aktives Abo** voraus und wird vom Inhaber des
Billing-Accounts erzeugt. Er wird **genau einmal** angezeigt — danach nur noch
neu erzeugen. Zertifizierung ist der Partner-Weg, keine Voraussetzung für den
Schlüssel.

## Der Umschalter im Code

Genau eine Stelle liest die Basis-URL:
`channex_client.py:193` → `settings.channex_base_url`. Alles andere (Client,
Worker, Webhook-Registrierung) hängt daran. Es gibt keinen zweiten Pfad und
keinen Fallback auf Staging (Wurzel 4).

## Reihenfolge (Live starten LEER)

Wir migrieren nicht. Demo-/Testbestand kommt nicht mit; der Betreiber baut seine
Objekte und Kanäle selbst auf.

1. **DB räumen** — Demo-Tenants löschen und **alle Staging-Channex-Kennungen**
   entfernen (`channex_property_map`, `channex_channel_connection`,
   `channex_tax_map`, `channex_tax_set_map`, `channex_group_map`,
   `channex_ari_shadow`, `ari_outbox`, `ari_restriction_outbox`).
   Warum zwingend: existiert eine `channex_property_map`-Zeile, macht
   `content_sync._upsert_channex_property` ein **PUT auf die alte ID**
   (`content_sync.py:575`) — auf Produktion gibt es die nicht → 404, und das
   Veröffentlichen scheitert, statt neu anzulegen.
   Zweites Risiko: Demo-Maps standen auf `sync_enabled=true`, und ein
   Logo-Upload löst `resync_all_content` über alle Objekte des Tenants aus →
   kostenpflichtige Objekte im Live-Konto.
   Vorher `pg_dump`, danach zählen (`tenants`, `properties`, `reservations`,
   `channex_property_map`, `channex_channel_connection`, `auth.users`).
2. **Env umstellen** — in Coolify für **api UND worker**, je Variable „Update",
   danach **Redeploy** (ein Redeploy allein ändert nichts):
   * `CHANNEX_BASE_URL=https://app.channex.io/api/v1`
   * `CHANNEX_API_KEY=<Prod-Schlüssel>`
   * `CHANNEX_SANDBOX_PORTALS=false`
   * `PUBLIC_API_URL=https://api.mynextdays.com`
   Coolify verschlüsselt Env-Werte mit dem `APP_KEY` in seiner eigenen DB;
   `docker exec … export` ist **nicht** persistent.
3. **Globalen Webhook registrieren** — `POST /channel-manager/webhooks/register`
   mit `https://api.mynextdays.com/api/v1/channel-manager/webhook`.
   Einer je Konto (`is_global=true`, `property_id=null`), 20 Events. Die
   Registrierung ist destruktiv (löscht die gleiche Callback-URL und legt sie
   mit UNSEREM Secret neu an), deshalb der Guard
   `_guard_secret_ueberschreibt_aktive_registrierung`: liegt dort schon ein
   aktiver Webhook mit ANDEREM Secret, bricht sie mit 409 ab statt alle Events
   in 401 laufen zu lassen. `CHANNEX_WEBHOOK_SECRET` muss in api, worker und der
   lokalen `.env` identisch sein.
4. **Verifizieren** gegen `app.channex.io`: `GET /properties` (leer),
   `GET /webhooks` (genau einer, `is_active`), `GET /channels` (leer).
   Objekte und Kanäle legt danach der Betreiber selbst an.

## Grenzen, die vertraglich binden (Acceptable Use Policy)

* **ARI-Rate-Limit**: 20 ARI-Anfragen/Minute je Konto, davon je Property
  10 Restrictions&Prices/Minute **und** 10 Availability/Minute — zwei getrennte
  Töpfe, nicht ein gemeinsamer. Im Worker abgebildet als drei eigene
  Token-Buckets (`CHANNEX_ARI_ACCOUNT_BUDGET`, `CHANNEX_AVAILABILITY_BUDGET`,
  `CHANNEX_RATES_BUDGET`; `jobs/channex_budget.py`). `CHANNEX_ACCOUNT_BUDGET`/
  `CHANNEX_PROPERTY_BUDGET` gelten nur noch für Nicht-ARI-Calls (Content-Sync);
  die zählt Channex nicht gegen das ARI-Limit.
* **Objektgröße**: Ferienobjekt 50 Room-Types, 10 Rate-Plans je Room-Type;
  Hotel 20 Room-Types, 200 Rate-Plans. Darüber fallen Zusatzgebühren an.
* **Aufbewahrung/Löschung durch Channex**: Objekt ohne Kanal nach **90 Tagen**
  entfernt, Kanal nach **1 Monat** deaktiviert, Buchungen 3 Monate nach
  Check-out, Kartendaten 7 Tage, Kontodaten 30 Tage nach Kündigung.
  Konsequenz für uns: eine gespeicherte `channex_property_id` kann jederzeit
  serverseitig verschwinden — ein PUT darauf ist dann 404 und muss zu einem
  Neuanlegen führen, nicht zu einem Fehler. Erledigt in
  `content_sync._put_property_oder_heilen`: bei 404 werden Map-Zeile(n),
  Room-Types, Rate-Plans und der ARI-Schatten der betroffenen Objekte abgeräumt,
  danach läuft der Neu-Anlege-Pfad. Nur 404 heilt — jeder andere Fehler wird
  weitergeworfen.
* **White-Label**: erlaubt und von uns genutzt (kein iFrame, kein
  Channex-Branding). Der Kundenvertrag verbietet, Channex in ein an Dritte
  weiterverkauftes Produkt einzubauen (§12) und verlangt die Nennung
  („Powered by Channex", §6.2) — im Kundentext nennen wir Channex nicht, dort
  heißt es „Portale"; die Nennung gehört an die Stelle, die der Vertrag
  vorsieht, nicht in die Bedienoberfläche. Kündigung 30 Tage (§17),
  Haftungsdeckel (§19), Nennung als Referenz (§22), GDPR-Sub-Processor (§28).
