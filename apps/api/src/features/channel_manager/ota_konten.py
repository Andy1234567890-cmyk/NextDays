"""OTA-Konten: ein Portal-Zugang eines Betriebs (0304).

Portal-NEUTRAL, anders als `airbnb_konten` — die Kontoidentität ist überall
dieselbe: der Channex-Kanal. Ein Kanal = ein Zugang (ein Airbnb-Host, ein
Booking-Hotel), darunter beliebig viele Objekte.

Ein Betrieb kann je Portal MEHRERE Konten führen: Agenturen betreuen hunderte
Vermieter mit je eigenem Zugang.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from .common import log


class KontoNichtGefunden(Exception):
    """Das Konto gibt es nicht — oder es gehört einem anderen Betrieb."""


def konto_sicherstellen(
    db: Client,
    tenant_id: str,
    *,
    portal_code: str,
    channel_id: str | None,
    host_id: str | None = None,
) -> str | None:
    """Das Konto zu einem Channex-Kanal holen oder anlegen. Gibt seine ID zurück.

    Der Kanal IST die Kontoidentität, deshalb wird darüber gesucht. Idempotent
    (Wurzel 2): derselbe Kanal ergibt beliebig oft dieselbe Kontozeile — der
    Verbindungsweg läuft mehrfach (Anlegen, Statuspoll, Finalisieren) und darf
    nicht bei jedem Durchgang ein weiteres Konto erzeugen.

    Ohne Kanal-ID gibt es nichts zu identifizieren → `None`. Die Verbindung
    trägt dann (noch) kein Konto; sobald der Kanal entsteht, wird es nachgetragen.

    `host_id` wird nachgezogen, sobald sie bekannt ist: bei Airbnb liefert
    Channex sie erst NACH der Autorisierung („Host ID … once connection is
    active it will show the Host ID here"). Ein bereits gesetzter Wert wird
    NICHT überschrieben — die Kennung eines Kontos ändert sich nicht, und ein
    abweichender Wert wäre ein Hinweis auf einen Kanalwechsel, kein Update.
    """
    if not channel_id:
        return None
    vorhanden = (
        db.table("ota_account")
        .select("id, ota_hotel_id")
        .eq("tenant_id", tenant_id)
        .eq("channex_channel_id", str(channel_id))
        .limit(1)
        .execute()
    ).data or []
    if vorhanden:
        konto = vorhanden[0]
        if host_id and not konto.get("ota_hotel_id"):
            db.table("ota_account").update(
                {"ota_hotel_id": str(host_id)}
            ).eq("id", konto["id"]).execute()
        return str(konto["id"])

    angelegt = (
        db.table("ota_account")
        .insert({
            "tenant_id": tenant_id,
            "ota_portal_code": portal_code,
            "channex_channel_id": str(channel_id),
            "ota_hotel_id": str(host_id) if host_id else None,
        })
        .execute()
    ).data or []
    return str(angelegt[0]["id"]) if angelegt else None


def konto_anlegen(
    db: Client, tenant_id: str, *, portal_code: str
) -> str | None:
    """Ein NEUES, noch kanalloses Portal-Konto anlegen und seine ID zurückgeben.

    Der Anker für einen frisch begonnenen Verbindungsversuch: das Konto
    existiert, bevor irgendein Channex-Aufruf läuft, und alle Folge-Aufrufe
    beziehen sich darauf. Der Kanal wird später nachgetragen
    (`kanal_ans_konto_schreiben`).

    WIEDERVERWENDEN statt anhäufen (Wurzel 2): ein bereits vorhandenes Konto
    ohne Kanal ist ein abgebrochener Versuch für genau diesen Zweck. Ohne diese
    Prüfung entstünde bei jedem Klick auf „Konto verbinden" eine weitere Zeile
    „Ohne Namen", und die Kontoliste füllte sich mit Karteileichen.
    """
    offen = (
        db.table("ota_account")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("ota_portal_code", portal_code)
        .is_("channex_channel_id", "null")
        .order("created_at")
        .limit(1)
        .execute()
    ).data or []
    if offen:
        return str(offen[0]["id"])
    angelegt = (
        db.table("ota_account")
        .insert({"tenant_id": tenant_id, "ota_portal_code": portal_code})
        .execute()
    ).data or []
    return str(angelegt[0]["id"]) if angelegt else None


def kanal_ans_konto_schreiben(
    db: Client, tenant_id: str, *, account_id: str, channel_id: str
) -> None:
    """Einen frisch angelegten Channex-Kanal an ein BESTEHENDES Konto hängen.

    Der Unterschied zu `konto_sicherstellen`: dort ist der Kanal die Identität
    und ein unbekannter Kanal erzeugt ein neues Konto. Hier ist das KONTO die
    Identität — es existiert bereits, weil der Betrieb es benannt hat, und
    bekommt nur seinen Kanal nachgetragen.

    Ohne diesen Weg legte ein zweiter Verbindungsversuch desselben Kontos jedes
    Mal eine weitere Kontozeile an, und die Kontoliste füllte sich mit „Ohne
    Namen"-Einträgen, die alle denselben Zugang meinen.

    Ein bereits gesetzter Kanal wird NICHT überschrieben (Wurzel 1): sonst
    verlöre das Konto die Verbindung zu seinem autorisierten Kanal, und dessen
    Tokens wären für uns nicht mehr auffindbar.
    """
    vorhanden = (
        db.table("ota_account")
        .select("id, channex_channel_id")
        .eq("tenant_id", tenant_id)
        .eq("id", account_id)
        .limit(1)
        .execute()
    ).data or []
    if not vorhanden or vorhanden[0].get("channex_channel_id"):
        return
    db.table("ota_account").update(
        {"channex_channel_id": str(channel_id)}
    ).eq("tenant_id", tenant_id).eq("id", account_id).execute()


def konto_status_setzen(
    db: Client,
    tenant_id: str,
    *,
    channel_id: str,
    host_id: str | None,
    connected: bool,
    last_error: str | None,
) -> None:
    """Verbindungszustand am Konto nachziehen (aus dem Channex-Statuspoll).

    Best effort (Wurzel 5): der Kontosatz ist Anzeige, die Verbindung selbst
    steht in `channex_channel_connection`. Scheitert das Schreiben, sieht die
    Kontoliste veraltet aus — der Verkauf läuft trotzdem korrekt weiter.

    `connected_at` wird nur EINMAL gesetzt: es ist der Zeitpunkt der ersten
    erfolgreichen Autorisierung, kein „zuletzt gesehen". Jeder Poll würde ihn
    sonst nach vorne schieben und die Angabe wertlos machen (Wurzel 5b).
    """
    aenderung: dict[str, Any] = {
        "token_invalid": not connected and bool(host_id),
        "last_error": last_error,
    }
    if host_id:
        aenderung["ota_hotel_id"] = str(host_id)
    try:
        vorhanden = (
            db.table("ota_account")
            .select("id, connected_at")
            .eq("tenant_id", tenant_id)
            .eq("channex_channel_id", str(channel_id))
            .limit(1)
            .execute()
        ).data or []
        if not vorhanden:
            return
        if connected and not vorhanden[0].get("connected_at"):
            aenderung["connected_at"] = "now()"
        db.table("ota_account").update(aenderung).eq(
            "id", vorhanden[0]["id"]
        ).execute()
    except Exception as exc:  # noqa: BLE001 — Anzeige darf den Hauptpfad nicht kippen
        log.warning(
            "ota_konto_status_nicht_gesetzt",
            channel_id=channel_id, error=str(exc)[:200],
        )


def gehoert_kanal_dem_betrieb(db: Client, tenant_id: str, channel_id: str) -> bool:
    """Gehört dieser Channex-Kanal dem Betrieb? (IDOR-Schutz, Wurzel 3)

    ZWEI Belege, und beide müssen zählen:

    * eine Verbindungszeile mit diesem Kanal (der Normalfall — Objekte hängen
      daran), oder
    * ein Konto mit diesem Kanal (0304).

    Nur die Verbindungen zu prüfen war zu eng: ein frisch verbundenes Konto,
    dessen Autorisierung noch nicht durch ist, hat NULL Objekte. Live gemessen —
    Kanal a24fa1c5 existierte bei Channex, das Konto stand in unserer DB, und
    das Trennen antwortete trotzdem mit 404: der Betrieb konnte einen
    angefangenen Zugang nicht mehr loswerden.
    """
    verbindung = (
        db.table("channex_channel_connection")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("channex_channel_id", channel_id)
        .limit(1)
        .execute()
    ).data
    if verbindung:
        return True
    konto = (
        db.table("ota_account")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("channex_channel_id", channel_id)
        .limit(1)
        .execute()
    ).data
    return bool(konto)


def konto_zum_kanal_loesen(db: Client, tenant_id: str, channel_id: str) -> None:
    """Nach dem Trennen: die Kontozeile dieses Kanals entfernen.

    Der Kanal ist bei Channex gelöscht — ein Konto, das darauf zeigt, wäre eine
    Karteileiche in der Liste, die sich nicht mehr trennen lässt (Wurzel 1: der
    Gegenzustand gehört mitgepflegt). Die Verbindungen bleiben bestehen; sie
    verlieren durch `on delete set null` nur ihren Kontobezug und behalten
    Objekt und Hotel-ID für ein späteres Neuverbinden.
    """
    try:
        db.table("ota_account").delete().eq("tenant_id", tenant_id).eq(
            "channex_channel_id", channel_id
        ).execute()
    except Exception as exc:  # noqa: BLE001 — Aufräumen darf das Trennen nicht kippen
        log.warning(
            "ota_konto_nicht_geloest", channel_id=channel_id, error=str(exc)[:200]
        )


def konten_des_betriebs(
    db: Client, tenant_id: str, portal_code: str | None = None
) -> list[dict[str, Any]]:
    """Alle Portal-Konten eines Betriebs, optional auf ein Portal begrenzt.

    Speist die Kontoliste der Oberfläche („Verbundene Konten"). Auch Konten
    OHNE Kanal kommen mit: eine angefangene Verbindung muss sichtbar sein,
    sonst drückt der Betrieb ratlos ein zweites Mal auf „Konto verbinden".
    """
    frage = (
        db.table("ota_account")
        .select(
            "id, ota_portal_code, channex_channel_id, ota_hotel_id, "
            "display_name, is_active, token_invalid, last_error, connected_at"
        )
        .eq("tenant_id", tenant_id)
    )
    if portal_code:
        frage = frage.eq("ota_portal_code", portal_code)
    return (frage.order("created_at").execute()).data or []


def konto_umbenennen(
    db: Client, tenant_id: str, account_id: str, display_name: str | None
) -> dict[str, Any]:
    """Anzeigename eines Kontos setzen. Tenant-gescoped (Wurzel 3).

    Leerer Name → `None`: dann zeigt die Oberfläche wieder die Kennung, statt
    eine leere Zeile (Wurzel 4).
    """
    name = (display_name or "").strip() or None
    treffer = (
        db.table("ota_account")
        .update({"display_name": name})
        .eq("tenant_id", tenant_id)
        .eq("id", account_id)
        .execute()
    ).data or []
    if not treffer:
        raise KontoNichtGefunden
    return treffer[0]


def objekte_je_konto_zaehlen(db: Client, tenant_id: str) -> dict[str, int]:
    """Konto-ID → Anzahl der VERBUNDENEN Objekte (für die Kontoliste).

    Gezählt wird nur, was wirklich synchronisiert: `is_active` UND ein Kanal.
    Eine Zeile ohne beides ist ein Objekt, das beim Konto einmal registriert
    WAR — nach dem Trennen bleibt sie bewusst stehen, damit ein Neuverbinden
    die Hotel-ID nicht neu abfragen muss.

    Ohne diese Einschränkung war die Zahl zu hoch: live standen 19 Zeilen am
    Konto des Beta-Betriebs, aber nur 18 Objekte synchronisierten — das
    neunzehnte (Stjerneskud) zeigt in der Kanalliste „Nicht verbunden" mit
    einem Verbinden-Knopf. Eine Kontoliste, die 19 behauptet, widerspricht der
    Tabelle daneben.
    """
    zeilen = (
        db.table("channex_channel_connection")
        .select("ota_account_id")
        .eq("tenant_id", tenant_id)
        .eq("is_active", True)
        .not_.is_("ota_account_id", "null")
        .not_.is_("property_id", "null")
        .not_.is_("channex_channel_id", "null")
        .execute()
    ).data or []
    zaehler: dict[str, int] = {}
    for z in zeilen:
        schluessel = str(z["ota_account_id"])
        zaehler[schluessel] = zaehler.get(schluessel, 0) + 1
    return zaehler
