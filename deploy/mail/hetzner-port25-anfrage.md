# Hetzner-Anfrage: Port 25 + 465 ausgehend freischalten

Hetzner blockt ausgehenden SMTP-Traffic (Port 25 und 465) auf neuen Cloud-Servern
standardmäßig. Damit unser Mailserver Mails nach außen zustellen kann, muss die
Freischaltung beantragt werden.

## ✅ RICHTIGER WEG (von Hetzner bestätigt, 2026-07-06): Limits-Formular

**NICHT per E-Mail/Support-Ticket** — Hetzner verweist auf das Self-Service-Formular:

1. **https://console.hetzner.com/limits** öffnen
2. **„Änderung anfragen"** → **„Ports freigeben"**
3. Server **`#148398616`** (`62.238.4.193`) wählen
4. Ports **25 und 465**
5. Anwendungsfall/Begründung:
   *„Eigener Mailserver (Mailcow) für transaktionale E-Mails unseres SaaS-Produkts
   (Rechnungen, Benachrichtigungen, Support). Kein Massenversand/Spam. PTR, SPF,
   DKIM, DMARC sind konfiguriert bzw. werden vollständig gesetzt."*

> **Bedingung (Hetzner):** Entsperrung nur für Konten **älter als 1 Monat** und nur
> für Ports, die noch tatsächlich gesperrt sind. Meldet das Formular „Konto zu
> jung", bis zum Erreichen der 1-Monats-Grenze (ab **Konto-Registrierung**, nicht
> Server-Erstellung) warten.

---

## (Veraltet) E-Mail-Text — nur falls das Formular nicht verfügbar ist

Hetzner bevorzugt das Formular oben. Der folgende Text ist nur Fallback.

**Absender:** ein Postfach, das zum Hetzner-Konto passt (Jeanine).

---

## Betreff
```
Freischaltung Port 25 und 465 (ausgehend) – Cloud Server #148398616
```

## Text (Deutsch)
```
Sehr geehrtes Hetzner-Support-Team,

wir betreiben auf unserem Cloud-Server einen eigenen Mailserver für unser
SaaS-Produkt und möchten den ausgehenden SMTP-Versand freischalten lassen.

Server:        Cloud Server #148398616
Hostname:      mail.mynextdays.dk
IPv4:          62.238.4.193
IPv6:          2a01:4f9:c014:7997::1

Wir bitten um die Freischaltung des ausgehenden Traffics auf Port 25 und 465.

Es handelt sich um einen legitimen Mailserver (Mailcow) ausschließlich für
transaktionale und geschäftliche E-Mails unseres eigenen Produkts (z. B.
Rechnungen, Benachrichtigungen, Support-Korrespondenz). Kein Massenversand,
kein Marketing-Spam. Reverse-DNS (PTR), SPF, DKIM und DMARC sind eingerichtet
bzw. werden vollständig konfiguriert.

Vielen Dank für die Bearbeitung.

Mit freundlichen Grüßen
Jeanine
myNextDays
```

## Text (English, falls nötig)
```
Dear Hetzner Support Team,

we operate our own mail server on our Cloud Server for our SaaS product and
would like to request the unblocking of outbound SMTP.

Server:        Cloud Server #148398616
Hostname:      mail.mynextdays.dk
IPv4:          62.238.4.193
IPv6:          2a01:4f9:c014:7997::1

Please unblock outbound traffic on ports 25 and 465.

This is a legitimate mail server (Mailcow) used exclusively for transactional
and business email of our own product (e.g. invoices, notifications, support
correspondence). No bulk mailing, no marketing spam. Reverse DNS (PTR), SPF,
DKIM and DMARC are configured / being fully configured.

Thank you for your assistance.

Best regards
Jeanine
myNextDays
```

---

> **Hinweis:** Nach der Freischaltung zusätzlich in der Hetzner-Konsole den
> **PTR/Reverse-DNS** auf `mail.mynextdays.dk` setzen (IPv4 + IPv6) — sonst
> landen Mails trotz Freischaltung im Spam.
