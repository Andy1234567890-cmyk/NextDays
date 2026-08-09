# Postfächer — mynextdays.dk

Die Postfächer auf dem Mailcow-Server (`mail.mynextdays.dk`). Alle auf der Domain
**`mynextdays.dk`**. Anlegen im Mailcow-Web-UI unter *Mail-Setup → Mailboxes*, oder
per Mailcow-API (siehe unten).

| Adresse | Zweck | Anzeigename (Vorschlag) |
|---|---|---|
| `info@mynextdays.dk` | Allgemeine Anfragen / zentrale Info-Adresse **und** SMTP-Login + sichtbarer Absender der App (`SMTP_USER` = `SMTP_FROM_ADDRESS`) | myNextDays Info |
| `support@mynextdays.dk` | Kundensupport / Ticket-Eingang | myNextDays Support |
| `verkauf@mynextdays.dk` | Vertrieb / Sales-Anfragen | myNextDays Verkauf |
| `torsten@mynextdays.dk` | Persönliches Postfach Torsten | Torsten |
| `jeanine@mynextdays.dk` | Persönliches Postfach Jeanine | Jeanine |
| `developer@mynextdays.dk` | Technisches Postfach (Monitoring, Zertifikats-/Blacklist-Benachrichtigungen). **Nicht** der SMTP-Login der App — der läuft über `info@` | myNextDays Developer |

## Angelegte Aliase (Pflicht + Standard) — alle → `info@mynextdays.dk`

Diese Aliase sind bereits angelegt (Ziel: Sammel-Postfach `info@`):

| Alias | Zweck | Pflicht? |
| --- | --- | --- |
| `abuse@mynextdays.dk` | **Beschwerde-/Missbrauchs-Kontakt** — hierüber erreichen Blacklist-Betreiber, andere Mailprovider und ggf. Behörden den Serverbetreiber. **RFC 2142 Pflicht.** Fehlt sie, verpuffen Beschwerden und man landet unbemerkt auf Blacklists. | ✅ Pflicht |
| `postmaster@mynextdays.dk` | RFC-Pflicht-Adresse + **Ziel der DMARC-Reports** (`rua`/`ruf`). | ✅ Pflicht |
| `hostmaster@mynextdays.dk` | RFC-2142-Standard (DNS-/Domain-Kontakt). | empfohlen |
| `noreply@mynextdays.dk` | Angelegt, aber **nicht** als Absender im Einsatz — Transaktionsmails gehen von `info@` (siehe [README.md](README.md), Abschnitt „Absenderadresse"). | optional |

> Ziel aller vier ist aktuell `info@`. Bei Bedarf kann `abuse@`/`postmaster@` auf ein
> überwachtes Support-Postfach umgeleitet werden — wichtig ist nur, dass die Mails
> tatsächlich **gelesen** werden (sonst ist der Alias wertlos).

## Hinweise
- **`info@`** ist der SMTP-Login der App (`SMTP_USER`) **und** der sichtbare
  Absender (`SMTP_FROM_ADDRESS`) — bewusst dieselbe Adresse, damit der
  Reputationsaufbau nicht auf zwei Identitäten zerfällt und Antworten in einem
  gelesenen Postfach landen. Für den Login ein App-Passwort mit **nur**
  SMTP-Recht verwenden (in Mailcow einzeln widerrufbar); NICHT das
  Admin-Passwort wiederverwenden. Die Domain muss DKIM-signiert sein.
- Jedes Postfach bekommt eine **Quota** (Speicherlimit) in der UI — großzügig, aber
  nicht unbegrenzt.
- Für Sammel-Adressen (`info`, `support`, `verkauf`) kann später eine
  **gemeinsame Ansicht** (SOGo-Delegation / Shared Mailbox) eingerichtet werden.

## Anlegen per Mailcow-API (optional, statt UI)
Voraussetzung: in der UI unter *Access → API* einen **API-Key** erzeugen und die
Server-IP freigeben.
```bash
curl -sk -X POST https://mail.mynextdays.dk/api/v1/add/mailbox \
  -H "X-API-Key: <API_KEY>" -H "Content-Type: application/json" \
  -d '{"local_part":"support","domain":"mynextdays.dk","name":"myNextDays Support",
       "password":"<pw>","password2":"<pw>","quota":"3072","active":"1"}'
```
