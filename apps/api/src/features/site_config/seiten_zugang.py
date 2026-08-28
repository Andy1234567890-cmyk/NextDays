"""Passwortschutz einzelner Seiten (0442).

Hostaway nennt es „Set Access". Wichtig ist, was es NICHT ist — und Hostaway
schreibt das selbst in seine Doku: *„Password-protected pages should not be
confused with user logins or account management."* Es gibt ein Passwort JE
SEITE, nicht je Person. Wer es kennt, kommt hinein; es gibt keine Rollen, keine
Sperrung einzelner Zugänge und keine Historie, wer wann da war.

Daraus folgt die ganze Bauart:

* Kein Benutzerkonto, keine Sitzung im Backend. Der Gast bekommt ein SIGNIERTES
  Ticket (HMAC über Seiten-ID und Ablauf), das er im Browser behält. Der Server
  merkt sich nichts über ihn — es gibt nichts zu merken.
* Trotzdem ein echter Passwort-Hash. Die Zeile liegt in jedem Backup und jedem
  Datenbank-Auszug; ein Klartext-Passwort dort wäre in einem Monat an einem
  Dutzend Stellen.
* Kein bcrypt/argon2: das wäre eine neue Abhängigkeit für einen Schutz, der
  ausdrücklich kein Login ist. PBKDF2-HMAC-SHA256 steht in der
  Standardbibliothek und ist für diesen Zweck ausreichend.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time
from datetime import UTC, datetime

from supabase import Client

from src.core.logging import get_logger

from .fehler import SiteConfigError

log = get_logger("nextdays.site_config.seiten_zugang")

# Iterationen für PBKDF2.
#
# 210 000 ist die Zahl, die OWASP für PBKDF2-HMAC-SHA256 nennt. Sie steht hier
# als Konstante und WANDERT MIT dem Hash (`pbkdf2$<iter>$…`): wird sie später
# erhöht, bleiben bestehende Passwörter prüfbar, weil jeder Hash seine eigene
# Zahl trägt. Ohne diese Mitgabe wäre jede Erhöhung ein Bruch aller
# gespeicherten Passwörter.
ITERATIONEN = 210_000

#: Höchstlänge eines Seitenpassworts. Dieselbe Grenze wie bei Hostaway.
MAX_LAENGE = 100

#: Wie lange ein Ticket gilt. Ein Tag, nicht „für immer": das Passwort ist der
#: Zugang zu einem Inhalt, nicht zu einem Konto, und ein Ticket, das nie
#: abläuft, ist eine dauerhafte Umgehung des Passworts, sobald jemand es weiter-
#: gibt. Hostaway hat hier gar keine Grenze — dort meldet man sich nur ab, indem
#: man den Cache leert, was den wenigsten einfällt.
TICKET_SEKUNDEN = 24 * 60 * 60


def hash_erzeugen(passwort: str) -> str:
    """Ein Passwort in die gespeicherte Form bringen.

    Format: ``pbkdf2$<iterationen>$<salt_b64>$<hash_b64>``. Der Salt ist je
    Seite neu — zwei Seiten mit demselben Passwort bekommen verschiedene Hashes,
    und ein Blick in die Tabelle verrät nicht, dass sie gleich sind.
    """
    wert = (passwort or "").strip()
    if not wert:
        raise SiteConfigError("Das Passwort darf nicht leer sein.", status_code=422)
    if len(wert) > MAX_LAENGE:
        raise SiteConfigError(
            f"Das Passwort darf höchstens {MAX_LAENGE} Zeichen haben.",
            status_code=422,
        )
    salt = secrets.token_bytes(16)
    roh = hashlib.pbkdf2_hmac("sha256", wert.encode(), salt, ITERATIONEN)
    return (
        f"pbkdf2${ITERATIONEN}"
        f"${base64.b64encode(salt).decode()}"
        f"${base64.b64encode(roh).decode()}"
    )


def passt(passwort: str, gespeichert: str | None) -> bool:
    """Stimmt das eingegebene Passwort?

    Vergleich über ``hmac.compare_digest`` und nicht mit ``==``: der Vergleich
    zweier Byte-Folgen bricht bei ``==`` beim ersten Unterschied ab, und aus der
    Laufzeit lässt sich ableiten, wie viele Zeichen stimmten. Bei einem
    Seitenpasswort ist das ein theoretischer Angriff — aber der richtige
    Vergleich kostet nichts.

    Ein kaputter oder fehlender Hash gibt ``False`` und nicht etwa ``True``
    (fail-closed, Wurzel 5): eine Seite, deren Hash unlesbar ist, öffnet sich
    nicht für alle.
    """
    if not gespeichert:
        return False
    try:
        marke, iterationen, salt_b64, hash_b64 = gespeichert.split("$")
        if marke != "pbkdf2":
            return False
        roh = hashlib.pbkdf2_hmac(
            "sha256",
            (passwort or "").strip().encode(),
            base64.b64decode(salt_b64),
            int(iterationen),
        )
        return hmac.compare_digest(roh, base64.b64decode(hash_b64))
    except (ValueError, TypeError):
        return False


def ticket_erzeugen(geheimnis: bytes, page_id: str, jetzt: int | None = None) -> str:
    """Ein signiertes Ticket für eine geöffnete Seite.

    ``<ablauf>.<signatur>`` — dieselbe Bauart wie der Entwurfs-Token des
    Editors (0426). Der Gast behält es im Browser; der Server prüft nur die
    Signatur und muss sich nichts merken.
    """
    ablauf = int(jetzt or time.time()) + TICKET_SEKUNDEN
    nachricht = f"{page_id}.{ablauf}".encode()
    signatur = hmac.new(geheimnis, nachricht, hashlib.sha256).hexdigest()
    return f"{ablauf}.{signatur}"


def ticket_gilt(
    geheimnis: bytes, page_id: str, ticket: str | None, jetzt: int | None = None
) -> bool:
    """Ist das Ticket echt und noch gültig?

    Erst die Zeit, dann die Signatur — und beides fail-closed. Ein Ticket für
    eine ANDERE Seite scheitert an der Signatur, weil die Seiten-ID darin
    steckt: sonst öffnete ein Ticket für die harmlose Seite auch die geschützte.
    """
    if not ticket:
        return False
    try:
        ablauf_text, signatur = ticket.split(".", 1)
        ablauf = int(ablauf_text)
    except (ValueError, AttributeError):
        return False
    if ablauf < int(jetzt or time.time()):
        return False
    erwartet = hmac.new(
        geheimnis, f"{page_id}.{ablauf}".encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(erwartet, signatur)


# === Aktionen des Dashboards (0442/0443) ==================================
#
# Als Funktionen und nicht als Methoden am Service: der stand bei 1615 Zeilen
# und damit ueber der Grenze, die `pylint` hier setzt (1500). Der Schnitt ist
# aber nicht bloss Buchhaltung — Passwort, Entwurf und Einzelveroeffentlichung
# gehoeren thematisch hierher, nicht zwischen die Block-Verwaltung.
#
# Den Tenant-Scope erledigt der Aufrufer, bevor er hier hereinkommt: er hat die
# Zeile bereits per `(id, tenant_id)` geladen (Wurzel 3). Diese Funktionen
# schreiben trotzdem ebenfalls gescoped — zwei Riegel kosten hier nichts.


def zugang_setzen(
    db: Client, tenant_id: str, page_id: str, passwort: str | None
) -> None:
    """Ein Seitenpasswort setzen oder entfernen.

    ``None`` oder leer entfernt den Schutz — bewusst DIESELBE Aktion und kein
    eigener Endpunkt: „offen fuer alle" ist bei Hostaway ebenfalls nur die
    andere Stellung desselben Schalters, und zwei Endpunkte fuer einen Zustand
    sind zwei Stellen, an denen er auseinanderlaufen kann.

    Was hier NICHT passiert: bestehende Tickets ungueltig machen. Wer das
    Passwort kannte, kommt bis zum Ablauf seines Tickets weiter hinein —
    hoechstens 24 Stunden. Derselbe Handel wie bei Hostaway, wo ein einmal
    eingegebenes Passwort bis zum Leeren des Caches gilt, nur mit einem Ende.
    """
    hash_wert = (
        hash_erzeugen(passwort) if passwort and passwort.strip() else None
    )
    (
        db.table("site_pages")
        .update({"access_password_hash": hash_wert})
        .eq("id", page_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    log.info(
        "site_page_zugang",
        tenant_id=tenant_id,
        page_id=page_id,
        geschuetzt=bool(hash_wert),
    )


def entwurf_setzen(
    db: Client, tenant_id: str, page_id: str, seite: dict, entwurf: bool
) -> None:
    """Eine Seite als Entwurf markieren — oder wieder freigeben (0443).

    Ein Entwurf wird beim Veroeffentlichen der Website UEBERSPRUNGEN. Das ist
    der einzige Unterschied zu „gerade nicht live", und er ist der wichtige:
    ohne ihn nimmt der Knopf „Veroeffentlichen" jede halbfertige Seite mit.

    Beim Markieren geht die Seite zugleich OFFLINE. Ein Entwurf, der live steht,
    waere ein Widerspruch — und die Datenbank laesst ihn nicht zu (CHECK aus
    0443). Ihn hier stillschweigend zu erzeugen wuerde einen 23514 werfen statt
    eines Satzes.
    """
    if entwurf:
        if seite.get("is_home"):
            raise SiteConfigError(
                "Die Startseite kann kein Entwurf sein.", status_code=422
            )
        if seite.get("page_type") in ("external", "folder"):
            raise SiteConfigError(
                "Externe Menuepunkte und Ordner haben keinen Inhalt, den man "
                "als Entwurf halten koennte.",
                status_code=422,
            )
    (
        db.table("site_pages")
        .update(
            {"is_draft": entwurf, "is_published": False}
            if entwurf
            else {"is_draft": False}
        )
        .eq("id", page_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )


def einzeln_veroeffentlichen(db: Client, tenant_id: str, page_id: str) -> None:
    """Eine einzelne Seite veroeffentlichen (0442).

    Bei Hostaway ist das eine eigene Mechanik, weil dort statische Dateien
    gebaut werden und eine Einzelveroeffentlichung nur diese eine Datei
    ersetzt — mit der Folge, dass Theme-Aenderungen NICHT mitgehen und
    URL-Aenderungen den vollen Publish brauchen.

    Bei uns entsteht dieser Unterschied nicht: der Renderer holt Seite und Theme
    bei jedem Aufruf frisch. Was bleibt, ist die ABSICHT — „nur diese eine Seite
    soll jetzt live gehen" — und der Zeitstempel dafuer.
    """
    (
        db.table("site_pages")
        .update(
            {
                "is_published": True,
                "is_draft": False,
                "last_single_publish_at": datetime.now(UTC).isoformat(),
            }
        )
        .eq("id", page_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )


def freischalten(
    db: Client,
    tenant_id: str,
    slug: str | None,
    passwort: str,
    geheimnis: bytes,
) -> str:
    """Passwort pruefen und ein Ticket ausgeben (0442).

    Ohne JWT — der Gast hat keines. Geprueft wird gegen die EINE Seite, die
    unter diesem Betrieb und Slug liegt; ein Ticket gilt danach nur fuer sie
    (die Seiten-ID steckt in der Signatur).

    Bei falschem Passwort ein 401 und sonst nichts: kein Hinweis, ob die Seite
    existiert, ob sie geschuetzt ist oder wie lang das Passwort war.
    """
    query = (
        db.table("site_pages")
        .select("id, access_password_hash")
        .eq("tenant_id", tenant_id)
        .eq("is_published", True)
        .eq("page_type", "normal")
    )
    query = query.eq("is_home", True) if not slug else query.eq("slug", slug)
    rows = query.limit(1).execute().data or []
    if not rows or not passt(passwort, rows[0].get("access_password_hash")):
        raise SiteConfigError("Passwort stimmt nicht.", status_code=401)
    return ticket_erzeugen(geheimnis, str(rows[0]["id"]))
