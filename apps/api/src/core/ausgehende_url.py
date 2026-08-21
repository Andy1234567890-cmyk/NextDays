"""Prüfung ausgehender, NUTZERGELIEFERTER URLs — eine Wahrheit für alle Aufrufer.

Immer wenn unser Server eine Adresse abruft, die ein Kunde oder ein Partner
angegeben hat, ist das ein SSRF-Vektor (OWASP API Security Top 10:2023, API7 —
und die OWASP-Beschreibung nennt Webhooks und URL-Abrufe ausdrücklich als
typische Einfallstore). Der Angreifer braucht keinen Exploit: er trägt
`http://169.254.169.254/latest/meta-data/` ein und lässt unseren Server die
Cloud-Zugangsdaten holen.

Diese Datei ist das gemeinsame Fundament dafür. Es gab sie vorher zweimal —
einmal in `features/external_calendar/service.py` (iCal-Feeds), einmal in
`features/mcp/oauth_service.py` (CIMD-Dokumente). Zwei Kopien einer
Sicherheitsprüfung sind eine Kopie zu viel: eine Lücke, die in der einen
geschlossen wird, bleibt in der anderen offen, und niemand merkt es. Mit dem
Webhook-Versand der Open API wäre es die dritte geworden. Beide Aufrufer
delegieren jetzt hierher.

Was geprüft wird, und warum jede Einzelprüfung nötig ist:

* **Schema** — nur `http`/`https` (bzw. nur `https`, wo verlangt). Sonst wären
  `file://`, `gopher://` und `ftp://` offen.
* **Host auflösbar** — ein nicht auflösbarer Name ist ein Eingabefehler des
  Nutzers (422), kein Serverfehler.
* **JEDE aufgelöste Adresse** muss öffentlich sein. Nicht nur die erste: ein
  Name mit zwei A-Records (einer öffentlich, einer intern) würde sonst
  durchgehen, je nachdem welchen die Auflösung zuerst nennt.
* **`is_private` allein genügt nicht.** CGNAT (`100.64.0.0/10`, RFC 6598) ist
  formal nicht privat, führt aber ins Providernetz. `169.254.0.0/16` ist der
  Cloud-Metadaten-Dienst — die lohnendste Adresse im ganzen Netz.
* **IPv4-mapped IPv6 auspacken.** `::ffff:169.254.169.254` umgeht sonst jede
  v4-Prüfung, weil das Objekt eine IPv6-Adresse ist und keine der v4-Regeln
  greift.
* **Auf die geprüfte IP pinnen.** Zwischen Prüfung und Verbindungsaufbau kann
  der DNS-Eintrag umbiegen (DNS-Rebinding, ein klassisches TOCTOU). Deshalb
  gibt `oeffentliche_ips` die geprüften Adressen zurück, und der Aufrufer
  verbindet mit `host_pinnen` auf genau eine davon — Host-Header und SNI
  bleiben der echte Name, damit TLS weiter korrekt validiert.

Fail-closed (Wurzel 5): im Zweifel ablehnen. Eine URL, die wir nicht sicher als
öffentlich erkennen, wird nicht abgerufen.
"""
# SCHWESTERDATEI — byte-identisch in beiden Bäumen halten:
#     apps/api/src/core/ausgehende_url.py
#     apps/public-api/src/core/ausgehende_url.py
# Die öffentliche API ist ein EIGENER Service (apps/public-api/README.md) und
# importiert nichts aus apps/api. Diese Datei liegt dort deshalb als bewusste
# Kopie (Muster ADR-0019). Der CI-Job `public-api-konsistenz` prüft die
# Byte-Gleichheit — und genau das ist der Punkt, den der Docstring oben schon
# festhält: eine Sicherheitsprüfung, die in zwei Fassungen existiert, wird in
# einer davon geflickt und bleibt in der anderen offen.
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

# CGNAT (RFC 6598) — von `is_private` NICHT erfasst, aber intern erreichbar.
_CGNAT = ipaddress.ip_network("100.64.0.0/10")


class UnsichereUrl(Exception):
    """Die URL darf nicht abgerufen werden.

    Trägt einen für Endnutzer zumutbaren Grund. Bewusst grob gehalten: eine
    Meldung wie „zeigt auf 10.0.0.5" wäre ein Netzwerk-Scanner für den
    Angreifer — er könnte über die Fehlermeldungen unser internes Netz
    kartieren.
    """

    def __init__(self, grund: str) -> None:
        super().__init__(grund)
        self.grund = grund


def ist_oeffentliche_ip(roh: str) -> bool:
    """Zeigt diese Adresse ins öffentliche Netz?"""
    try:
        adresse = ipaddress.ip_address(roh)
    except ValueError:
        return False
    # IPv4-mapped IPv6 (::ffff:10.0.0.1) auspacken, sonst rutscht eine interne
    # Adresse in dieser Schreibweise durch alle v4-Prüfungen.
    mapped = getattr(adresse, "ipv4_mapped", None)
    if mapped is not None:
        adresse = mapped
    unerlaubt = (
        adresse.is_private,
        adresse.is_loopback,
        adresse.is_link_local,   # 169.254.x — Cloud-Metadaten
        adresse.is_reserved,
        adresse.is_multicast,
        adresse.is_unspecified,
        adresse.version == 4 and adresse in _CGNAT,
    )
    return not any(unerlaubt)


def oeffentliche_ips(url: str, *, nur_https: bool = False) -> list[str]:
    """URL prüfen und die geprüften Ziel-IPs zurückgeben.

    Die Rückgabe ist der Grund, warum diese Funktion nicht `bool` liefert: der
    Aufrufer MUSS sich auf eine geprüfte IP pinnen, sonst war die Prüfung
    wertlos (der Host würde beim Verbindungsaufbau neu aufgelöst).

    Wirft `UnsichereUrl` bei Schema-Verstoß, fehlendem/nicht auflösbarem Host
    oder wenn irgendeine aufgelöste Adresse nicht öffentlich ist.
    """
    teile = urlparse(url)
    erlaubte_schemata = ("https",) if nur_https else ("http", "https")
    if teile.scheme not in erlaubte_schemata:
        erwartet = " oder ".join(erlaubte_schemata)
        raise UnsichereUrl(f"Nur {erwartet} erlaubt.")
    host = teile.hostname
    if not host:
        raise UnsichereUrl("Ungültige URL (kein Host).")
    try:
        infos = socket.getaddrinfo(host, teile.port, proto=socket.IPPROTO_TCP)
    except OSError as exc:
        raise UnsichereUrl("URL-Host nicht auflösbar.") from exc
    ips = [info[4][0] for info in infos]
    if not ips:
        raise UnsichereUrl("URL-Host nicht auflösbar.")
    for ip in ips:
        if not ist_oeffentliche_ip(ip):
            raise UnsichereUrl("URL zeigt auf eine nicht-öffentliche Adresse.")
    return ips


def ist_oeffentliche_url(url: str, *, nur_https: bool = True) -> bool:
    """Bequeme Ja/Nein-Fassung für Aufrufer, die nur validieren (nicht abrufen).

    Wer die URL danach WIRKLICH abruft, nimmt `oeffentliche_ips` und pinnt —
    diese Fassung schützt nicht gegen Rebinding, weil sie das Ergebnis der
    Auflösung wegwirft.
    """
    try:
        oeffentliche_ips(url, nur_https=nur_https)
    except UnsichereUrl:
        return False
    return True


def host_pinnen(netloc: str, ip: str) -> str:
    """Host im `netloc` durch die geprüfte IP ersetzen, Port/Userinfo erhalten.

    IPv6-Adressen kommen in eckige Klammern. Der Aufrufer setzt zusätzlich den
    `Host`-Header und `sni_hostname` auf den echten Namen — nur so bleibt die
    Zertifikatsprüfung intakt, während die Verbindung zur geprüften Adresse geht.
    """
    literal = f"[{ip}]" if ":" in ip else ip
    # netloc kann userinfo@host:port enthalten; nur den Host-Teil tauschen.
    at = netloc.rfind("@")
    prefix = netloc[: at + 1] if at != -1 else ""
    hostport = netloc[at + 1 :]
    port = ""
    if hostport.startswith("["):
        ende = hostport.find("]")
        port = hostport[ende + 1 :]
    elif ":" in hostport:
        port = ":" + hostport.rsplit(":", 1)[1]
    return f"{prefix}{literal}{port}"


def host_header(url: str) -> str:
    """`Host`-Wert für eine gepinnte Verbindung: Host(+Port), OHNE userinfo.

    Die Zielseite erwartet ihren Namen, nicht `user:pass@host` — und ein
    mitgeschickter Userinfo-Teil im Host-Header landet in deren Logs.
    """
    teile = urlparse(url)
    host = teile.hostname or ""
    return host if teile.port is None else f"{host}:{teile.port}"
