"""Datei-Anlagen aus Formular-Einsendungen (0444).

Das ist der EINZIGE Weg, auf dem ein Fremder etwas in unseren Speicher legt.
Alles hier folgt daraus:

* **Eigener, privater Bucket.** Nicht der Medien-Bucket des Betriebs: der ist
  oeffentlich lesbar, und eine Gast-Datei hat in der Mediathek nichts verloren.
  Gelesen wird nur ueber kurzlebige, signierte Adressen.
* **Magic-Byte-Pruefung.** Der `content_type` des Clients ist eine Behauptung.
  Was wirklich in der Datei steht, entscheiden die Anfangsbytes.
* **Erzeugter Dateiname.** Der Name des Absenders wird NUR angezeigt. In einen
  Pfad gehoert er nie: `../`, Steuerzeichen, 4000 Zeichen, gleiche Namen von
  zwei Gaesten.
* **Verfall nach 90 Tagen.** Dieselbe Frist wie bei Hostaway. Eine Datei von
  einem Fremden, die ewig liegt, ist eine Haftung.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time

from pydantic import BaseModel, Field
from supabase import Client

from src.core.logging import get_logger

from .fehler import SiteConfigError

log = get_logger("nextdays.site_config.formular_anlagen")


# === Antwortformen ========================================================
# Sie stehen HIER und nicht in `schemas.py` — dieselbe Entscheidung wie bei
# `regeln.py`: `schemas.py` laeuft ueber die Zeilengrenze, die `pylint` setzt,
# und wer die Anlagen sucht, findet sie in der Datei, die nach ihnen heisst.


class FormUploadResponse(BaseModel):
    """Antwort an den GAST nach dem Hochladen einer Anlage (0445).

    Ohne Adresse. Der Gast soll seine eigene Datei nicht noch einmal abrufen
    koennen — er hat sie ja. Eine signierte Adresse in dieser Antwort waere ein
    Leseschluessel, der ueber den Browser-Verlauf und jeden Proxy wandert, fuer
    eine Datei, die dem BETRIEB gehoert."""

    ok: bool = True
    id: str
    name: str
    groesse: int


class FormAnlage(BaseModel):
    """Eine Anlage in der Antwortenliste des Betriebs (0445).

    `url` ist eine SIGNIERTE, kurzlebige Adresse und wird bei jedem Abruf neu
    erzeugt. `None` heisst: die Signatur ist fehlgeschlagen — die Oberflaeche
    zeigt den Namen dann ohne Link, statt auf ein totes Ziel zu fuehren
    (Wurzel 4)."""

    id: str
    feld: str
    name: str
    groesse: int
    mime: str
    url: str | None = None
    verfaellt_am: str | None = None


class FormAnlagenListResponse(BaseModel):
    items: list[FormAnlage] = Field(default_factory=list)

#: Der private Bucket. Getrennt von `site-media` (oeffentlich, Mediathek).
BUCKET = "site-form-uploads"

#: Hoechstgroesse je Datei. Dieselbe Grenze wie bei Hostaway: gross genug fuer
#: einen Grundriss, klein genug, dass niemand den Speicher als Ablage benutzt.
MAX_BYTES = 10 * 1024 * 1024

#: Wie lange eine signierte Leseadresse gilt. Fuenf Minuten reichen, um eine
#: Datei zu oeffnen oder zu speichern — und sind zu kurz, um sie
#: weiterzugeben.
SIGNATUR_SEKUNDEN = 300


def dateityp(inhalt: bytes) -> tuple[str, str] | None:
    """Der WIRKLICHE Typ aus den Anfangsbytes: ``(mime, endung)`` oder ``None``.

    Erlaubt ist, was ein Gast sinnvoll mitschickt: Bilder und PDF. KEIN ZIP, kein
    Office-Format, kein SVG.

    * ZIP und Office-Dateien (die selbst ZIPs sind) koennten alles enthalten,
      und wir wuerden es weiterreichen — an einen Betrieb, der die Datei
      oeffnet.
    * SVG ist HTML mit Skripten darin. Es waere der eine Dateityp, der beim
      Ansehen Code ausfuehrt.

    Wer mehr braucht, schickt einen Link. Das ist die ehrlichere Loesung als
    eine Erlaubnisliste, die mit jeder Anfrage waechst.
    """
    if inhalt.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if inhalt.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if inhalt[:4] == b"RIFF" and inhalt[8:12] == b"WEBP":
        return "image/webp", "webp"
    if inhalt.startswith(b"%PDF-"):
        return "application/pdf", "pdf"
    return None


def anzeigename(roh: str) -> str:
    """Der Name des Absenders, entschaerft fuer die ANZEIGE.

    Er landet nie in einem Pfad. Trotzdem wird er beschnitten: er steht in der
    Antwortenliste des Betriebs, und ein Name mit Steuerzeichen oder 4000
    Zeichen macht die Liste unlesbar.
    """
    sauber = "".join(c for c in (roh or "") if c.isprintable() and c not in "\\/")
    return sauber.strip()[:120] or "datei"


def speichern(
    db: Client,
    tenant_id: str,
    submission_id: str,
    feld: str,
    dateiname: str,
    inhalt: bytes,
) -> dict:
    """Eine Anlage ablegen und die Zeile dazu schreiben.

    Reihenfolge: erst pruefen, dann in den Speicher, dann die Zeile. Andersherum
    stuende eine Zeile in der Datenbank, zu der es keine Datei gibt — und die
    Antwortenliste zeigte einen Anhang, der beim Klick fehlt.
    """
    if not inhalt:
        raise SiteConfigError("Die Datei ist leer.", status_code=422)
    if len(inhalt) > MAX_BYTES:
        raise SiteConfigError(
            f"Die Datei ist groesser als {MAX_BYTES // (1024 * 1024)} MB.",
            status_code=413,
        )
    typ = dateityp(inhalt)
    if not typ:
        raise SiteConfigError(
            "Nur Bilder (JPG, PNG, WebP) und PDF sind moeglich.", status_code=422
        )
    mime, endung = typ

    # Der Pfad wird ERZEUGT: Tenant, Einsendung, Zufall. Der Zufall verhindert,
    # dass jemand die Adresse einer fremden Datei erraet, falls die Signatur je
    # entfaellt — und dass zwei Gaeste mit derselben `bild.jpg` kollidieren.
    pfad = f"{tenant_id}/{submission_id}/{secrets.token_hex(16)}.{endung}"
    db.storage.from_(BUCKET).upload(
        pfad, inhalt, {"content-type": mime, "upsert": "false"}
    )
    rows = (
        db.table("site_form_uploads")
        .insert(
            {
                "tenant_id": tenant_id,
                "submission_id": submission_id,
                "feld": feld[:60],
                "original_name": anzeigename(dateiname),
                "pfad": pfad,
                "groesse": len(inhalt),
                "mime": mime,
            }
        )
        .execute()
    ).data or []
    if not rows:
        # Die Datei liegt schon im Speicher. Sie stehen zu lassen waere eine
        # verwaiste Datei, die niemand mehr findet — und die trotzdem Platz und
        # Haftung kostet.
        try:
            db.storage.from_(BUCKET).remove([pfad])
        except Exception as exc:  # noqa: BLE001 — Aufraeumen darf nicht kippen
            log.warning("anlage_rollback_fehlgeschlagen", pfad=pfad, error=str(exc)[:200])
        raise SiteConfigError(
            "Die Anlage konnte nicht gespeichert werden.", status_code=500
        )
    log.info(
        "formular_anlage",
        tenant_id=tenant_id,
        submission_id=submission_id,
        groesse=len(inhalt),
        mime=mime,
    )
    return rows[0]


def liste(db: Client, tenant_id: str, submission_id: str) -> list[dict]:
    """Die Anlagen einer Einsendung — mit signierter, kurzlebiger Adresse.

    Die Adresse wird bei JEDEM Abruf neu erzeugt und gilt fuenf Minuten. Sie in
    der Datenbank zu speichern hiesse, eine dauerhaft gueltige Adresse zu einer
    fremden Datei zu fuehren.
    """
    rows = (
        db.table("site_form_uploads")
        .select("id, feld, original_name, groesse, mime, created_at, pfad, verfaellt_am")
        .eq("tenant_id", tenant_id)
        .eq("submission_id", submission_id)
        .order("created_at")
        .execute()
    ).data or []
    raus = []
    for r in rows:
        adresse = None
        try:
            signiert = db.storage.from_(BUCKET).create_signed_url(
                r["pfad"], SIGNATUR_SEKUNDEN
            )
            adresse = signiert.get("signedURL") or signiert.get("signedUrl")
        except Exception as exc:  # noqa: BLE001 — eine Datei kippt nicht die Liste
            log.warning(
                "anlage_signatur_fehlgeschlagen", pfad=r["pfad"], error=str(exc)[:200]
            )
        raus.append(
            {
                "id": str(r["id"]),
                "feld": r["feld"],
                "name": r["original_name"],
                "groesse": r["groesse"],
                "mime": r["mime"],
                # `None`, wenn die Signatur fehlschlug. Die Oberflaeche zeigt
                # den Namen dann ohne Link — besser als ein Link, der ins Leere
                # fuehrt (Wurzel 4).
                "url": adresse,
                "verfaellt_am": str(r["verfaellt_am"]),
            }
        )
    return raus


def dateien_entfernen(db: Client, tenant_id: str, submission_id: str) -> int:
    """Die Dateien einer Einsendung aus dem Speicher raeumen.

    Der Gegenzustand zum Loeschen einer Einsendung (Wurzel 1). Ohne diesen
    Aufruf loescht `formulare.loeschen` die Zeile, die Datenbank raeumt per
    `on delete cascade` die Zeilen in `site_form_uploads` mit — und die DATEIEN
    bleiben fuer immer im Bucket liegen. Niemand faende sie je wieder: der
    einzige Verweis auf ihren Pfad war die geloeschte Zeile.

    Live nachgemessen am 25.08.2026: nach einem Testlauf standen fuenf Dateien
    im Bucket und null Zeilen in der Tabelle. Bei personenbezogenen Daten ist
    das nicht nur Muell, sondern ein Loeschbegehren nach Art. 17 DSGVO, das nur
    zur Haelfte ausgefuehrt wurde.

    Auf `(submission_id, tenant_id)` gescopt, nicht auf die ID allein
    (Wurzel 3): die Service-Role umgeht RLS.

    Wirft, wenn der Speicher nicht mitspielt. Das ist Absicht: der Aufrufer darf
    die Zeile dann NICHT loeschen, sonst waere der Verweis auf die Datei weg und
    ein zweiter Versuch unmoeglich.
    """
    rows = (
        db.table("site_form_uploads")
        .select("pfad")
        .eq("submission_id", submission_id)
        .eq("tenant_id", tenant_id)
        .limit(MAX_ANLAGEN)
        .execute()
    ).data or []
    pfade = [r["pfad"] for r in rows if r.get("pfad")]
    if not pfade:
        return 0
    try:
        db.storage.from_(BUCKET).remove(pfade)
    except Exception as exc:
        log.error(
            "anlagen_loeschen_fehlgeschlagen",
            submission_id=submission_id,
            anzahl=len(pfade),
            error=str(exc)[:200],
        )
        raise SiteConfigError(
            "Die Anlagen konnten nicht geloescht werden. Die Anfrage bleibt "
            "bestehen — bitte erneut versuchen.",
            status_code=502,
        ) from exc
    log.info(
        "formular_anlagen_geloescht",
        tenant_id=tenant_id,
        submission_id=submission_id,
        anzahl=len(pfade),
    )
    return len(pfade)


def abgelaufene_entfernen(db: Client, grenze: int = 500) -> int:
    """Abgelaufene Anlagen loeschen — Datei zuerst, dann die Zeile.

    Gedacht fuer den Worker. Der Deckel ist keine Vorsicht, sondern Rechnung:
    der Aufruf laeuft in einem Job neben anderen, und ein Lauf, der zehntausend
    Dateien einzeln loescht, blockiert ihn.

    Datei ZUERST: bleibt die Zeile stehen, weil das Loeschen im Speicher
    fehlschlug, versucht es der naechste Lauf erneut. Andersherum waere die
    Datei fuer immer verwaist — niemand wuesste mehr, dass es sie gibt.
    """
    rows = (
        db.table("site_form_uploads")
        .select("id, pfad")
        .lt("verfaellt_am", "now()")
        .limit(grenze)
        .execute()
    ).data or []
    entfernt = 0
    for r in rows:
        try:
            db.storage.from_(BUCKET).remove([r["pfad"]])
        except Exception as exc:  # noqa: BLE001 — eine Datei kippt nicht den Lauf
            log.warning(
                "anlage_loeschen_fehlgeschlagen", pfad=r["pfad"], error=str(exc)[:200]
            )
            continue
        db.table("site_form_uploads").delete().eq("id", r["id"]).execute()
        entfernt += 1
    if entfernt:
        log.info("formular_anlagen_abgelaufen_entfernt", anzahl=entfernt)
    return entfernt


# === Der Weg, auf dem eine Datei zur Einsendung kommt ======================
#
# ZWEI Aufrufe und nicht einer, und das ist eine Entscheidung:
#
#   1. Das Formular wird als JSON abgeschickt und die Einsendung gespeichert.
#      Die Antwort traegt ihre ID und ein kurzlebiges TICKET.
#   2. Die Datei geht als eigener Aufruf hinterher, mit ID und Ticket.
#
# Warum nicht alles in einem multipart-Aufruf: `submission_id` ist NOT NULL
# (0444). Eine Datei ohne Einsendung waere eine verwaiste Zeile, und der Weg
# „erst Datei, dann Einsendung" braeuchte einen Zwischenzustand samt
# Aufraeumer fuer alles, was nie zu einer Einsendung wurde.
#
# Und warum ueberhaupt ein Ticket: ohne es koennte jeder, der eine
# Einsendungs-ID kennt oder raet, Dateien an die Einsendung eines Fremden
# haengen. Die ID steht in keiner Antwort an Dritte — aber „steht nirgends" ist
# kein Schutz.

#: Wie lange das Ticket gilt. Kurz: es ueberbrueckt zwei Aufrufe desselben
#: Formulars, nicht mehr. Wer eine Minute nach dem Absenden noch eine Datei
#: nachreichen will, schickt das Formular erneut.
TICKET_SEKUNDEN = 120


def ticket_erzeugen(
    geheimnis: bytes, submission_id: str, jetzt: int | None = None
) -> str:
    """Ein Ticket, das genau EINE Einsendung fuer kurze Zeit oeffnet."""
    ablauf = int(jetzt or time.time()) + TICKET_SEKUNDEN
    nachricht = f"upload.{submission_id}.{ablauf}".encode()
    return f"{ablauf}.{hmac.new(geheimnis, nachricht, hashlib.sha256).hexdigest()}"


def ticket_gilt(
    geheimnis: bytes,
    submission_id: str,
    ticket: str | None,
    jetzt: int | None = None,
) -> bool:
    """Ist das Ticket echt und noch gueltig? Fail-closed in jedem Zweifelsfall."""
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
        geheimnis,
        f"upload.{submission_id}.{ablauf}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(erwartet, signatur)


def einsendung_pruefen(db: Client, submission_id: str) -> dict:
    """Die Einsendung laden, an die eine Datei soll.

    Gibt die Zeile zurueck — der Aufrufer braucht `tenant_id` daraus und darf
    ihn NICHT vom Client entgegennehmen: sonst haenge ich eine Datei an eine
    fremde Einsendung, indem ich den falschen Betrieb behaupte (Wurzel 3).
    """
    rows = (
        db.table("site_form_submissions")
        .select("id, tenant_id, block_id")
        .eq("id", submission_id)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        raise SiteConfigError("Einsendung nicht gefunden.", status_code=404)
    return rows[0]


def anzahl(db: Client, submission_id: str) -> int:
    """Wie viele Anlagen die Einsendung schon hat.

    Ohne diese Zahl waere der Upload-Endpunkt ein unbegrenzter Bereich
    (Wurzel 8): mit einem gueltigen Ticket koennte jemand zwei Minuten lang
    Dateien schicken, bis der Speicher voll ist.
    """
    rows = (
        db.table("site_form_uploads")
        .select("id")
        .eq("submission_id", submission_id)
        .limit(MAX_ANLAGEN + 1)
        .execute()
    ).data or []
    return len(rows)


#: Hoechstzahl der Anlagen je Einsendung. Hostaway erlaubt eine Datei je FELD;
#: fuenf ist die groesszuegigere Fassung derselben Idee und immer noch weit
#: entfernt von „Ablage".
MAX_ANLAGEN = 5
