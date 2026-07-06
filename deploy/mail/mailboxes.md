# Postfächer — mynextdays.dk

Die Postfächer auf dem Mailcow-Server (`mail.mynextdays.dk`). Alle auf der Domain
**`mynextdays.dk`**. Anlegen im Mailcow-Web-UI unter *Mail-Setup → Mailboxes*, oder
per Mailcow-API (siehe unten).

| Adresse | Zweck | Anzeigename (Vorschlag) |
|---|---|---|
| `info@mynextdays.dk` | Allgemeine Anfragen / zentrale Info-Adresse | myNextDays Info |
| `support@mynextdays.dk` | Kundensupport / Ticket-Eingang | myNextDays Support |
| `verkauf@mynextdays.dk` | Vertrieb / Sales-Anfragen | myNextDays Verkauf |
| `torsten@mynextdays.dk` | Persönliches Postfach Torsten | Torsten |
| `jeanine@mynextdays.dk` | Persönliches Postfach Jeanine | Jeanine |
| `developer@mynextdays.dk` | Technik / System-Absender für die App (SMTP-Login) | myNextDays Developer |

## Empfohlene Zusatz-Adressen
- `noreply@mynextdays.dk` — sichtbarer Absender für automatische Transaktions-Mails
  (Rechnungen/Belege). Als **Alias** auf `info@` oder eigenes Postfach.
- `postmaster@mynextdays.dk` — Pflicht-Adresse laut RFC (DMARC-`rua`-Ziel). Mailcow
  legt sie i.d.R. automatisch an; sonst als Alias auf `info@`.

## Hinweise
- **`developer@`** ist der SMTP-Login der App (`SMTP_USER`). Ein starkes, eigenes
  Passwort setzen; NICHT das Admin-Passwort wiederverwenden. Der sichtbare Absender
  (`SMTP_FROM_ADDRESS`) kann davon abweichen (z.B. `noreply@`), solange die Domain
  DKIM-signiert wird.
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
