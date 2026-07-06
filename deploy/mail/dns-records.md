# DNS-Records für `mynextdays.dk`

## ✅ ERLEDIGT (2026-07-06): DNS läuft über Cloudflare

Die Domain `mynextdays.dk` wurde von den DanDomain-Nameservern auf **Cloudflare**
umgestellt (Nameserver `devin.ns.cloudflare.com` + `yolanda.ns.cloudflare.com`),
Zone-Status **active**. Alle Records unten sind bereits **live gesetzt** (per
Cloudflare-API). Cloudflare-Zone-ID + API-Token liegen in der Coolify-Env der
`nextdays-supabase`-App (`CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN`).

Gesetzte Records: A/AAAA `mail`, MX, SPF, DKIM, DMARC, CNAME autodiscover/autoconfig.
Verifiziert: `mail.mynextdays.dk` → 62.238.4.193, MX → mail.mynextdays.dk,
Webmailer (SOGo) unter `https://mail.mynextdays.dk/SOGo/` erreichbar (HTTP 200).

**Noch offen:** PTR/Reverse-DNS in der Hetzner-Konsole (kein DNS-Record, separater
Schritt) + Port 25/465-Freischaltung (ab ~20.07.).

---

## Referenz: die gesetzten Records (falls Neuaufbau/Kontrolle)

Ohne sie (besonders PTR + SPF + DKIM) landen ausgehende Mails im Spam oder werden
abgelehnt.

Server: `mail.mynextdays.dk` · IPv4 `62.238.4.193` · IPv6 `2a01:4f9:c014:7997::1`

---

## Pflicht-Records

### A / AAAA — der Mailserver-Host
| Typ | Name | Wert | TTL |
|---|---|---|---|
| A | `mail` (= `mail.mynextdays.dk`) | `62.238.4.193` | 3600 |
| AAAA | `mail` | `2a01:4f9:c014:7997::1` | 3600 |

### MX — wohin Mail für @mynextdays.dk geht
| Typ | Name | Priorität | Wert | TTL |
|---|---|---|---|---|
| MX | `@` (= `mynextdays.dk`) | `10` | `mail.mynextdays.dk.` | 3600 |

### SPF — wer für die Domain senden darf (TXT)
| Typ | Name | Wert |
|---|---|---|
| TXT | `@` | `v=spf1 mx a:mail.mynextdays.dk -all` |

> `-all` = hard fail (nur unser MX/Host darf senden). Falls später ein externer
> Dienst (z.B. Newsletter) mitsenden soll, dessen `include:` ergänzen.

### DKIM — Signatur-Schlüssel (TXT) — Selector `dkim`
| Typ | Name | Wert |
|---|---|---|
| TXT | `dkim._domainkey` | *(siehe unten — ein langer Wert)* |

**DKIM-TXT-Wert** (Selector `dkim`, 2048 bit) — als **einen** TXT-Record eintragen
(viele DNS-Panels teilen lange Werte automatisch in 255-Zeichen-Chunks; das ist ok):

```
v=DKIM1;k=rsa;t=s;s=email;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkpV+ctgLFxsxSg7xvXhK/ioNd+59nKVrjM/v9z9bG9geUiT7NsyK+aE/ctHUINYvyoe1NMoDbuCE9nnYA1S7TLenGkdAYkoN36FZDZd8GFkpNmkKoIHlDUKxAwyBHmiB0tFNIfMaENgacWV59EcgO6oo35HUDNI5VslM254D/8FXBP8thnQKNzl3HGscn1OQjWHlr2ByBmeWyDTf+mg2AaQetkcPTZeWOyFMeoRFNwd3Adb2KUWNTuZak2/zj6FH/kPgvBjUrg72bC38XGGX+MSpZL8sn8yc92hz8Gg8Ks7AUXnWhxOQ8FJjxSeppC5ZoGgC0V0huAVV/YfNCBL0owIDAQAB
```

> **Hinweis:** Dieser Key gehört zu DIESEM Server. Wird der Mailserver neu
> aufgesetzt oder der DKIM-Key rotiert, ändert sich der Wert — dann hier UND im DNS
> aktualisieren. Aktuellen Wert jederzeit in der Mailcow-UI unter
> *Konfiguration → ARC/DKIM* ablesen.

### DMARC — Richtlinie bei SPF/DKIM-Fehler (TXT)
| Typ | Name | Wert |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:postmaster@mynextdays.dk; ruf=mailto:postmaster@mynextdays.dk; fo=1` |

> Start mit `p=quarantine` (verdächtige Mails in Spam). Wenn nach ein paar Wochen
> die DMARC-Reports sauber sind → auf `p=reject` verschärfen.

### PTR / Reverse-DNS — NICHT im DNS-Panel, sondern in der Hetzner-Konsole
| IP | PTR-Ziel |
|---|---|
| `62.238.4.193` | `mail.mynextdays.dk` |
| `2a01:4f9:c014:7997::1` | `mail.mynextdays.dk` |

Hetzner Cloud Console → Server → **Netzwerk → Reverse DNS**. Pflicht für Zustellbarkeit.

---

## Optional (Komfort / Autoconfig)

| Typ | Name | Wert | Zweck |
|---|---|---|---|
| CNAME | `autodiscover` | `mail.mynextdays.dk.` | Outlook-Autoconfig |
| CNAME | `autoconfig` | `mail.mynextdays.dk.` | Thunderbird-Autoconfig |
| SRV | `_autodiscover._tcp` | `0 0 443 mail.mynextdays.dk.` | Autodiscover |
| SRV | `_submission._tcp` | `0 0 587 mail.mynextdays.dk.` | Submission-Discovery |
| SRV | `_imaps._tcp` | `0 0 993 mail.mynextdays.dk.` | IMAPS-Discovery |
| TLSA / MTA-STS / TLS-RPT | — | — | später für maximale Zustell-Härtung |

---

## Verifikation (nach dem Setzen, DNS-Propagation abwarten)
```bash
dig +short A mail.mynextdays.dk
dig +short MX mynextdays.dk
dig +short TXT mynextdays.dk                     # SPF
dig +short TXT dkim._domainkey.mynextdays.dk     # DKIM
dig +short TXT _dmarc.mynextdays.dk              # DMARC
dig +short -x 62.238.4.193                       # PTR
```
Zusätzlich: In der **Mailcow-UI** zeigt *E-Mail → Konfiguration → Domain-Details*
einen grün/rot-Abgleich zwischen Soll-DNS und Ist-DNS — dort prüfen, dass alles ✓.
Extern gegenprüfen: <https://www.mail-tester.com> (Score 10/10 anstreben).
