# Channex-Support: Airbnb-OAuth unter White-Label

**Stand:** 04.08.2026 · **Konto:** AirSmil (White-Label-Plan aktiv, portal.channex.io)

## Das Problem in einem Satz

Der Airbnb-OAuth-Link, den `meta/airbnb/connection_link` erzeugt, trägt Channex'
eigene `client_id` und `redirect_uri` — nicht die unseres White-Label-Kontos.
Kein Kanal erhält nach der Autorisierung Tokens.

## Was live belegt ist

### 1. Die erzeugte OAuth-URL (aus unserem Aufruf-Log)

```
https://www.airbnb.com/oauth2/auth
  ?scope=property_management,messages_read,messages_write
  &state=6bf20c89-901c-40c1-8a4c-36f58f8fe4bf
  &client_id=ahg7ix98yoqjrhlflhpd50y8m
  &redirect_uri=https://app.channex.io/api/v1/meta/airbnb/auth_redirect
```

`client_id` und `redirect_uri` sind Channex-eigene Werte. Sie sind über die API
nicht setzbar — `connection_link` akzeptiert nur `group_id`, `channel_id`,
`properties`, `title`, `request_id`, `settings`.

### 2. Kein Kanal erhält Tokens

Alle vier AirBNB-Kanäle des Kontos, per `GET channels` gelesen:

| Kanal-ID | Titel | settings | tokens |
|---|---|---|---|
| 583d585e-f7bd-482c-bfc0-f7c1fecae21b | Airbnb | `[]` | nein |
| 6972558a-4b25-4950-84b6-c0271b2ca73d | Airbnb | `[]` | nein |
| c5983b00-09f6-41a9-b365-394ba0709f20 | Airbnb | `[]` | nein |
| e0a2cee3-2bbb-4eec-989a-a11517b11c66 | (Test) | `[]` | nein |

Im Airbnb-Konto des Kunden ist „Channex" unter *Verbundene Dienste* gelistet
(hinzugefügt 04.08.2026) — die Autorisierung hat also stattgefunden, die Tokens
sind aber an keinem Kanal angekommen.

### 3. `channel_events` antwortet 500

```
GET channel_events                                   → 500 internal_server_error
GET channel_events?filter[channel_id]=<id>           → 500
GET channel_events?pagination[limit]=20              → 500
```

Damit können wir nicht selbst nachsehen, was beim `auth_redirect` passiert ist.

### 4. Ein Kanal verschwand zwischenzeitlich

`GET channels/6972558a-...` lieferte um 14:19:11 noch 200, ab 14:19:16 dann 404,
ohne dass wir einen Lösch-Aufruf gemacht haben (unser vollständiges Aufruf-Log
für dieses Konto enthält ausschließlich `GET channels/*`, `POST channels`,
`POST auth/one_time_token`, `GET auth/exchange`, `POST
meta/airbnb/connection_link` — kein DELETE, kein PUT).

## Unsere Fragen

1. Wird für unseren White-Label-Plan eine eigene Airbnb-`client_id` /
   `redirect_uri` eingerichtet, oder läuft Airbnb-OAuth grundsätzlich über
   Channex' Airbnb-App? Falls eigene App möglich: was müssen wir liefern?
2. Warum erhält kein Kanal Tokens, obwohl Airbnb die Autorisierung bestätigt
   hat? Wo landet die Rückmeldung von `meta/airbnb/auth_redirect`?
3. Ist `channel_events` (500) ein bekannter Fehler?
4. Warum wurde Kanal `6972558a-...` um 14:19 nicht mehr gefunden?

## Was wir schon geprüft haben

- `request_id` ist eine eigene UUID (nicht die `channel_id`) — wie im Channex-Client
- `properties` enthält genau ein Channex-Property (ohne → 422 „should have at least 1 item(s)")
- `white_label/settings` liefert mit unserem API-Key `title: "Channex"`
- `admin/wl_partners` / `admin/wl_domains` → 403 mit dem API-Key
