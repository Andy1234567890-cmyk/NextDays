"""Zustand der Automatisierungen: was ist geplant, gesendet, fehlgeschlagen?

Eine Regel konnte bis hierher nur BESCHRIEBEN werden (Auslöser, Zeitplan,
Zuweisung) — ob sie jemals gefeuert hat, stand nirgends. Das Versandprotokoll
`automation_scheduled_message` weiß es seit 0072, aber niemand hat es gelesen:
eine Regel, die seit Wochen an einem fehlenden Platzhalter scheitert, sah in
der Oberfläche genauso aus wie eine, die täglich zustellt. Dieses Modul macht
daraus je Regel eine Handvoll Zahlen plus den letzten Fehlergrund.

Eigenes Modul und nicht in `service.py`/`automationen.py`: dieselbe Bewegung,
aus der `kennzahlen.py` und `planung.py` entstanden sind — der Service steht an
der pylint-Grenze, und hier liegt LESENDE Auswertung, nicht Verwaltung.

Zwei Regeln, die hier tragen:

* **Wurzel 3** — Service-Role umgeht RLS. Jede Abfrage filtert explizit auf
  `tenant_id`; der Detail-Endpunkt lädt die Regel zusätzlich über
  `load_scoped`, damit eine fremde Automation-ID ein 404 ergibt und keine
  Zeilen (Wurzel 9: derselbe Scope wie die Liste).
* **Wurzel 8** — die Abfrage ist gedeckelt (`MAX_ZEILEN`). Ein Betrieb mit
  Jahren Protokoll soll keine unbegrenzte Zeilenmenge ziehen. Wird der Deckel
  erreicht, sagt die Antwort das über `gekappt` — eine gekappte Zahl still als
  Gesamtzahl auszugeben wäre eine Falschaussage (Wurzel 4).

ZUR ZEITANGABE (Wurzel 5b): `updated_at` ist hier zulässig, weil der Versand
UNSERE Handlung ist — der Dispatch setzt die Zeile auf `sent`/`failed`. Es ist
ausdrücklich NICHT der Zeitpunkt eines fremden Ereignisses. `send_at` ist der
GEPLANTE Zeitpunkt und wird deshalb getrennt geführt.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Final

from pydantic import BaseModel, Field

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .errors import InboxError

log = get_logger("nextdays.inbox")

if TYPE_CHECKING:  # pragma: no cover - nur für die Typprüfung
    from supabase import Client

# Obergrenze der ausgewerteten Protokollzeilen (Wurzel 8). Deckt den realen
# Bestand um Größenordnungen: der Beta-Betrieb steht nach einem Jahr bei knapp
# vierstellig. Wird sie erreicht, meldet die Antwort `gekappt=True`.
MAX_ZEILEN: Final = 5000

# So viele Protokollzeilen darf die Detailliste einer Regel höchstens zeigen.
MAX_NACHRICHTEN: Final = 50

# Die Zustände aus `automation_scheduled_status_chk` (0316). `sending` ist der
# atomare Claim vor dem Versand — er wird getrennt geführt und NICHT zu
# `pending` addiert, damit die Zahl sagt, was sie heißt.
ZUSTAENDE: Final = ("pending", "sending", "sent", "failed", "skipped", "cancelled")

# Genau die Spalten, die gebraucht werden. `body` ist bewusst NICHT dabei: der
# Nachrichtentext geht den Zustandsbericht nichts an (0337 sperrt die Tabelle
# genau deshalb für den DB-Direktpfad).
_SPALTEN: Final = "automation_id,status,send_at,updated_at,last_error"
# Wie viele FEHLGESCHLAGENE Zeilen je Betrieb zu Objekt-Lücken aufgelöst werden
# (Wurzel 8). Die Auflösung kostet drei zusätzliche Abfragen mit einer `in`-
# Liste; unbegrenzt wäre sie bei einem Betrieb mit jahrelangem Protokoll eine
# IN-Liste über Tausende IDs. Die Lücken-Sicht braucht keine Vollständigkeit —
# sie nennt die betroffenen OBJEKTE, und die wiederholen sich.
MAX_LUECKEN_ZEILEN: Final = 200


class AutomationLuecke(BaseModel):
    """Ein OBJEKT, an dem Nachrichten dieser Regel gescheitert sind.

    Der Betrieb braucht nicht den Fehlersatz, sondern die Stelle: welches Haus,
    welche Felder, und ob sie HEUTE noch leer sind. Genau das steht hier.
    """

    property_id: str
    #: Name des Objekts; None, wenn es inzwischen gelöscht wurde.
    objekt: str | None = None
    #: Alle Platzhalter, die in den Fehlschlägen dieses Objekts fehlten.
    felder: list[str] = Field(default_factory=list)
    #: Die Teilmenge davon, die am Objekt heute noch leer ist. Leere Liste
    #: heißt: inzwischen gepflegt — der Fehlschlag ist Vergangenheit.
    heute_leer: list[str] = Field(default_factory=list)
    #: Wie viele Nachrichten an diesem Objekt scheiterten.
    anzahl: int = 0


class AutomationStand(BaseModel):
    """Zustand EINER Regel, verdichtet aus ihrem Versandprotokoll."""

    automation_id: str
    pending: int = 0
    sending: int = 0
    sent: int = 0
    failed: int = 0
    skipped: int = 0
    cancelled: int = 0
    gesamt: int = 0
    #: Grund des jüngsten Fehlschlags (`last_error`), sonst None. Nie ein
    #: Ersatztext — fehlt der Grund, fehlt er (Wurzel 4).
    letzter_fehler: str | None = None
    #: Wann dieser Fehlschlag protokolliert wurde (`updated_at`, unsere Uhr).
    letzter_fehler_am: str | None = None
    #: Frühester geplanter Versand über alle offenen Zeilen (`send_at`).
    naechster_versand: str | None = None
    #: Wann zuletzt erfolgreich zugestellt wurde (`updated_at` der jüngsten
    #: `sent`-Zeile, unsere Uhr).
    letzter_erfolg_am: str | None = None
    #: True, wenn aus den Fehlschlägen keine Arbeit mehr folgt. Zwei Wege
    #: dorthin: nach dem jüngsten Fehlschlag wurde wieder zugestellt, ODER die
    #: betroffenen Aufenthalte sind vorbei — an eine abgereiste Buchung geht
    #: keine Nachricht mehr, der Fehlschlag ist dann Historie.
    #:
    #: Ohne den zweiten Weg blieb ein Fehler EWIG rot stehen: „Forbidden" von
    #: Booking.com zu einem Aufenthalt vom August, danach nie wieder ein
    #: Versand — also nie ein Erfolg, der ihn ablösen konnte (15.09.2026,
    #: „warum immer noch").
    erledigt: bool = False
    #: Die betroffenen Objekte mit ihren fehlenden Angaben — die Sicht, mit der
    #: der Betrieb etwas tun kann. Leer, wenn kein Fehlschlag an einem
    #: fehlenden Platzhalter lag.
    luecken: list[AutomationLuecke] = Field(default_factory=list)


class AutomationStandListe(BaseModel):
    """Zustand aller Regeln des Betriebs."""

    items: list[AutomationStand] = Field(default_factory=list)
    total: int = 0
    #: True, wenn die Obergrenze griff und die Zahlen deshalb unvollständig
    #: sind. Die Oberfläche sagt das dazu, statt eine Teilsumme als Gesamtsumme
    #: auszugeben.
    gekappt: bool = False


class AutomationNachricht(BaseModel):
    """Eine Zeile des Versandprotokolls (ohne Nachrichtentext) — mit der
    Buchung dahinter, damit der Betrieb sieht, WEN es betrifft (14.09.2026)."""

    id: str
    status: str
    send_at: str | None = None
    updated_at: str | None = None
    last_error: str | None = None
    thread_id: str | None = None
    gast: str | None = None
    ota_name: str | None = None
    arrival_date: str | None = None
    departure_date: str | None = None
    property_id: str | None = None
    objekt: str | None = None
    # Aus `last_error` gelesene Platzhalter ohne Wert („Diese Felder haben …
    # keinen Wert: a, b") — leer, wenn der Fehler ein anderer war.
    fehlende_felder: list[str] = Field(default_factory=list)
    # Teilmenge davon, die am Objekt HEUTE noch leer ist (nur die vier
    # Gästemappen-Spalten, die dieser Code kennt — alles andere bleibt offen,
    # statt „gefüllt" zu behaupten).
    heute_leer: list[str] = Field(default_factory=list)


class AutomationNachrichtenListe(BaseModel):
    """Die jüngsten Protokollzeilen EINER Regel."""

    items: list[AutomationNachricht] = Field(default_factory=list)
    total: int = 0


def _tenant(ctx: AuthContext) -> str:
    """Mandant aus dem Token — ohne ihn wird nichts gelesen (Wurzel 3)."""
    if not ctx.tenant_id:
        raise InboxError("Kein Tenant im Token.", status_code=403)
    return ctx.tenant_id


def _text(wert: object) -> str | None:
    """Rohwert als Zeichenkette, leer/NULL bleibt None (kein Ersatzwert)."""
    if wert is None:
        return None
    s = str(wert).strip()
    return s or None


def _leer(automation_id: str) -> AutomationStand:
    """Zustand einer Regel, die noch nie eingeplant wurde — alles null.

    Bewusst eine Zeile mit Nullen statt gar kein Eintrag: „0 geplant · 0
    gesendet" ist eine Aussage, ein fehlender Eintrag wäre nur eine Lücke, und
    die Oberfläche müsste sich dann selbst einen Nullwert ausdenken.
    """
    return AutomationStand(automation_id=automation_id)


def stand_laden(db: Client, ctx: AuthContext) -> AutomationStandListe:
    """Zustand je Regel aus EINER tenant-gescopten Abfrage, in Python verdichtet.

    Warum eine Abfrage statt einer je Regel: ein Betrieb mit 20 Regeln zöge
    sonst 20 Rundreisen für eine Liste, die in einem Rutsch zu haben ist. Die
    Verdichtung in Python ist billig — PostgREST kann `group by` ohnehin nicht
    ohne eine eigene View, und eine View wäre eine zweite Wahrheit zu pflegen.

    Regeln OHNE Protokollzeile bekommen trotzdem einen Eintrag (`_leer`), damit
    die Oberfläche für jede Regel eine Aussage hat.
    """
    tenant_id = _tenant(ctx)
    regeln = (
        db.table("message_automation")
        .select("id")
        .eq("tenant_id", tenant_id)
        .limit(MAX_ZEILEN)
        .execute()
    ).data or []
    stand: dict[str, AutomationStand] = {
        str(r["id"]): _leer(str(r["id"])) for r in regeln if r.get("id")
    }

    zeilen = (
        db.table("automation_scheduled_message")
        .select(f"thread_id,{_SPALTEN}")
        .eq("tenant_id", tenant_id)
        .order("updated_at", desc=True)
        .limit(MAX_ZEILEN)
        .execute()
    ).data or []

    for zeile in zeilen:
        aid = _text(zeile.get("automation_id"))
        if not aid:
            continue
        eintrag = stand.get(aid)
        if eintrag is None:
            # Protokoll einer bereits gelöschten Regel (ON DELETE CASCADE lässt
            # das eigentlich nicht zu, eine Wiederherstellung aber schon) —
            # mitzählen statt verschlucken.
            eintrag = _leer(aid)
            stand[aid] = eintrag
        _zeile_verbuchen(eintrag, zeile)

    _luecken_ergaenzen(db, tenant_id, stand, zeilen)
    items = sorted(stand.values(), key=lambda s: s.automation_id)
    return AutomationStandListe(
        items=items, total=len(items), gekappt=len(zeilen) >= MAX_ZEILEN
    )


def _luecken_ergaenzen(
    db: Client, tenant_id: str, stand: dict[str, AutomationStand], zeilen: list[dict]
) -> None:
    """Je Regel die betroffenen OBJEKTE an den Zustand hängen.

    Warum nicht erst im Protokoll-Dialog: die Karte soll den Befund ZEIGEN,
    nicht über ihn reden. Ein Satz „Diese Felder haben keinen Wert: door_code,
    wifi_ssid" nennt weder das Haus noch, ob es heute noch fehlt — der Betrieb
    musste ihn erst irgendwo nachschlagen (Anlass 15.09.2026).

    Drei Abfragen für ALLE Regeln zusammen, nicht je Regel eine: die Auflösung
    Buchung → Objekt → Gästemappe ist dieselbe, und die Objekte wiederholen
    sich über die Regeln hinweg.
    """
    # ALLE Fehlschläge — nicht nur die mit Platzhalter-Lücke: auch ein
    # „Forbidden" braucht die Buchung dahinter, um zu wissen, ob der Aufenthalt
    # noch läuft.
    fehl = [z for z in zeilen if str(z.get("status") or "") == "failed"][
        :MAX_LUECKEN_ZEILEN
    ]
    if not fehl:
        return
    threads = _threads(
        db, tenant_id, {str(z["thread_id"]) for z in fehl if z.get("thread_id")}
    )
    objekt_ids = {str(t["property_id"]) for t in threads.values() if t.get("property_id")}
    objekte = _objekte(db, tenant_id, objekt_ids)
    leer = _portal_leer(db, objekt_ids)

    je_regel: dict[str, dict[str, AutomationLuecke]] = {}
    for z in fehl:
        aid = _text(z.get("automation_id"))
        th = threads.get(str(z.get("thread_id") or ""), {})
        pid = _text(th.get("property_id"))
        if not aid or not pid:
            continue
        luecke = je_regel.setdefault(aid, {}).setdefault(
            pid,
            AutomationLuecke(property_id=pid, objekt=_text(objekte.get(pid, {}).get("title"))),
        )
        luecke.anzahl += 1
        heute = leer.get(pid, set())
        for feld in fehlende_felder_aus(z.get("last_error")):
            if feld not in luecke.felder:
                luecke.felder.append(feld)
            if feld in heute and feld not in luecke.heute_leer:
                luecke.heute_leer.append(feld)
    for aid, gefunden in je_regel.items():
        eintrag = stand.get(aid)
        if eintrag is not None:
            eintrag.luecken = sorted(
                gefunden.values(), key=lambda x: (-x.anzahl, x.objekt or "")
            )
    _erledigt_setzen(stand, fehl, threads)


def _erledigt_setzen(
    stand: dict[str, AutomationStand], fehl: list[dict], threads: dict[str, dict]
) -> None:
    """Je Regel: folgt aus den Fehlschlägen noch Arbeit?

    Nein, wenn danach wieder zugestellt wurde ODER jeder betroffene Aufenthalt
    vorbei ist. Eine Nachricht an eine abgereiste Buchung nimmt kein Portal mehr
    an — sie rot stehen zu lassen, verlangt eine Handlung, die es nicht gibt.

    Ein Fehlschlag OHNE auflösbare Buchung gilt als offen: lieber einmal zu viel
    gezeigt als eine Panne stillgelegt, die niemand geprüft hat (Wurzel 5).
    """
    heute = datetime.now(UTC).date().isoformat()
    laufend: dict[str, bool] = {}
    for z in fehl:
        aid = _text(z.get("automation_id"))
        if not aid:
            continue
        th = threads.get(str(z.get("thread_id") or ""))
        abreise = _text((th or {}).get("departure_date"))
        # Ohne Buchung oder ohne Abreisedatum: als laufend werten.
        laufend[aid] = laufend.get(aid, False) or not abreise or abreise >= heute
    for aid, eintrag in stand.items():
        if not eintrag.failed:
            continue
        danach_zugestellt = bool(
            eintrag.letzter_erfolg_am
            and eintrag.letzter_fehler_am
            and eintrag.letzter_erfolg_am > eintrag.letzter_fehler_am
        )
        eintrag.erledigt = danach_zugestellt or not laufend.get(aid, True)


def _zeile_verbuchen(eintrag: AutomationStand, zeile: dict) -> None:
    """Eine Protokollzeile in den Zustand ihrer Regel einrechnen.

    Die Zeilen kommen nach `updated_at` absteigend — der ERSTE gesehene
    Fehlschlag ist deshalb der jüngste, und spätere überschreiben ihn nicht.
    """
    zustand = _text(zeile.get("status"))
    if zustand not in ZUSTAENDE:
        # Ein unbekannter Zustand wird GEZÄHLT (`gesamt`), aber keinem Feld
        # zugeschlagen: ihn still auf `pending` zu buchen wäre ein erfundener
        # Wert (Wurzel 4). Fällt er auf, weil die Summe nicht aufgeht.
        eintrag.gesamt += 1
        return
    setattr(eintrag, zustand, getattr(eintrag, zustand) + 1)
    eintrag.gesamt += 1
    if zustand == "failed" and eintrag.letzter_fehler is None:
        eintrag.letzter_fehler = _text(zeile.get("last_error"))
        eintrag.letzter_fehler_am = _text(zeile.get("updated_at"))
    if zustand == "sent" and eintrag.letzter_erfolg_am is None:
        eintrag.letzter_erfolg_am = _text(zeile.get("updated_at"))
    if zustand in ("pending", "sending"):
        geplant = _text(zeile.get("send_at"))
        if geplant and (
            eintrag.naechster_versand is None or geplant < eintrag.naechster_versand
        ):
            # ISO-8601 in derselben Schreibweise sortiert lexikografisch wie
            # chronologisch; PostgREST liefert alle Zeitstempel als UTC-ISO.
            eintrag.naechster_versand = geplant


# Platzhalter, deren Wert in `property_guest_portal` steht — nur für diese
# kann „heute noch leer" geprüft werden (Spaltenname = Platzhaltername).
_PORTAL_FELDER: Final = ("door_code", "wifi_ssid", "wifi_password", "contact_phone")
_FELDFEHLT_PRAEFIX: Final = "keinen Wert: "
# Zustände, aus denen ein erneuter Versand erlaubt ist — 'sent' bewusst nicht
# (Doppelversand, Wurzel 2), 'pending'/'sending' laufen bereits.
ERNEUT_ERLAUBT: Final = frozenset({"failed", "skipped", "cancelled"})


def fehlende_felder_aus(last_error: str | None) -> list[str]:
    """Die Feldnamen aus dem FeldFehlt-Text (felder.py) — sonst leer."""
    text = str(last_error or "")
    if _FELDFEHLT_PRAEFIX not in text:
        return []
    rest = text.split(_FELDFEHLT_PRAEFIX, 1)[1]
    return [f.strip().rstrip(".") for f in rest.split(",") if f.strip()]


def _threads(db: Client, tenant_id: str, ids: set[str]) -> dict[str, dict]:
    if not ids:
        return {}
    rows = (
        db.table("channex_booking")
        .select("id, property_id, ota_name, arrival_date, departure_date, customer")
        .eq("tenant_id", tenant_id)
        .in_("id", sorted(ids))
        .execute()
    ).data or []
    return {str(r["id"]): r for r in rows}


def _objekte(db: Client, tenant_id: str, ids: set[str]) -> dict[str, dict]:
    if not ids:
        return {}
    rows = (
        db.table("properties")
        .select("id, title")
        .eq("tenant_id", tenant_id)
        .in_("id", sorted(ids))
        .execute()
    ).data or []
    return {str(r["id"]): r for r in rows}


def _portal_leer(db: Client, ids: set[str]) -> dict[str, set[str]]:
    """Je Objekt: welche der bekannten Gästemappen-Spalten sind HEUTE leer?"""
    if not ids:
        return {}
    rows = (
        db.table("property_guest_portal")
        .select("property_id, " + ", ".join(_PORTAL_FELDER))
        .in_("property_id", sorted(ids))
        .execute()
    ).data or []
    stand = {str(r["property_id"]): r for r in rows}
    return {
        pid: {
            f for f in _PORTAL_FELDER
            if not str((stand.get(pid) or {}).get(f) or "").strip()
        }
        for pid in ids
    }


def _gastname(customer: object) -> str | None:
    if not isinstance(customer, dict):
        return None
    name = " ".join(
        str(customer.get(k) or "").strip() for k in ("name", "surname")
    ).strip()
    return name or None


def _zeile(z: dict, th: dict, obj: dict, leer: set[str]) -> AutomationNachricht:
    fehlend = fehlende_felder_aus(z.get("last_error"))
    return AutomationNachricht(
        id=str(z.get("id")),
        status=_text(z.get("status")) or "",
        send_at=_text(z.get("send_at")),
        updated_at=_text(z.get("updated_at")),
        last_error=_text(z.get("last_error")),
        thread_id=_text(z.get("thread_id")),
        gast=_gastname(th.get("customer")),
        ota_name=_text(th.get("ota_name")),
        arrival_date=_text(th.get("arrival_date")),
        departure_date=_text(th.get("departure_date")),
        property_id=_text(th.get("property_id")),
        objekt=_text(obj.get("title")),
        fehlende_felder=fehlend,
        heute_leer=[f for f in fehlend if f in leer],
    )


def nachrichten_laden(
    db: Client, ctx: AuthContext, automation_id: str, *, limit: int = 10
) -> AutomationNachrichtenListe:
    """Die jüngsten Protokollzeilen EINER Regel.

    Der Scope ist derselbe wie beim Listen-Endpunkt (Wurzel 9): die Regel wird
    über `load_scoped` per (id, tenant_id) geladen — eine fremde ID ergibt ein
    404, nicht eine leere Liste und erst recht keine fremden Zeilen. Zusätzlich
    filtert die Protokollabfrage selbst noch einmal auf `tenant_id`.
    """
    tenant_id = _tenant(ctx)
    load_scoped(
        db,
        "message_automation",
        automation_id,
        tenant_id,
        columns="id",
        not_found=InboxError("Automatisierung nicht gefunden.", status_code=404),
    )
    grenze = max(1, min(int(limit), MAX_NACHRICHTEN))
    zeilen = (
        db.table("automation_scheduled_message")
        .select(f"id,thread_id,{_SPALTEN}")
        .eq("tenant_id", tenant_id)
        .eq("automation_id", automation_id)
        .order("updated_at", desc=True)
        .limit(grenze)
        .execute()
    ).data or []
    threads = _threads(
        db, tenant_id, {str(z["thread_id"]) for z in zeilen if z.get("thread_id")}
    )
    objekt_ids = {str(t["property_id"]) for t in threads.values() if t.get("property_id")}
    objekte = _objekte(db, tenant_id, objekt_ids)
    leer = _portal_leer(db, objekt_ids)
    items = []
    for z in zeilen:
        if not z.get("id"):
            continue
        th = threads.get(str(z.get("thread_id") or ""), {})
        pid = str(th.get("property_id") or "")
        items.append(_zeile(z, th, objekte.get(pid, {}), leer.get(pid, set())))
    return AutomationNachrichtenListe(items=items, total=len(items))


def erneut_einplanen(db: Client, ctx: AuthContext, nachricht_id: str) -> AutomationNachricht:
    """Eine fehlgeschlagene/übersprungene Zeile zurück auf 'pending' — Versand
    im nächsten Minutentakt mit den HEUTIGEN Werten (der Text wird erst beim
    Senden gerendert; ein inzwischen nachgetragener Türcode steht also drin).

    Nur aus `ERNEUT_ERLAUBT`: eine gesendete Zeile noch einmal freizugeben wäre
    ein Doppelversand (Wurzel 2), eine offene läuft schon. `send_at` wird auf
    JETZT gesetzt, sonst griffe die Nachzügler-Schranke des Versands erneut.
    Scope: Zeile per (id, tenant_id) — eine fremde ID ist ein 404 (Wurzel 9).
    Die Statusbedingung im Update ist der Claim gegen einen zweiten Klick.
    """
    tenant_id = _tenant(ctx)
    zeile = load_scoped(
        db,
        "automation_scheduled_message",
        nachricht_id,
        tenant_id,
        columns=f"id,thread_id,{_SPALTEN}",
        not_found=InboxError("Nachricht nicht gefunden.", status_code=404),
    )
    if str(zeile.get("status") or "") not in ERNEUT_ERLAUBT:
        raise InboxError(
            "Nur fehlgeschlagene, übersprungene oder stornierte Nachrichten "
            "können erneut gesendet werden.",
            status_code=409,
        )
    jetzt = datetime.now(UTC).isoformat()
    neu = (
        db.table("automation_scheduled_message")
        .update({"status": "pending", "send_at": jetzt, "last_error": None})
        .eq("tenant_id", tenant_id)
        .eq("id", nachricht_id)
        .eq("status", str(zeile["status"]))
        .execute()
    ).data or []
    if not neu:
        raise InboxError("Die Nachricht wurde inzwischen verändert.", status_code=409)
    log.info(
        "automail_erneut_eingeplant",
        tenant_id=tenant_id, nachricht_id=nachricht_id, user_id=ctx.user_id,
        vorher=zeile.get("status"),
    )
    tid = str(zeile.get("thread_id") or "")
    return _zeile(neu[0], _threads(db, tenant_id, {tid}).get(tid, {}), {}, set())


def erneut_alle_fehlgeschlagenen(
    db: Client, ctx: AuthContext, automation_id: str
) -> int:
    """Alle 'failed'-Zeilen EINER Regel erneut einplanen.

    Nur 'failed', nicht 'skipped': übersprungen heißt „Zeitpunkt vorbei" oder
    „Anker lag vor der Buchung" — die Regel galt dort nicht; das ist keine
    Panne, die man wiederholt. Gibt die Zahl der freigegebenen Zeilen zurück.
    """
    tenant_id = _tenant(ctx)
    load_scoped(
        db, "message_automation", automation_id, tenant_id, columns="id",
        not_found=InboxError("Automatisierung nicht gefunden.", status_code=404),
    )
    jetzt = datetime.now(UTC).isoformat()
    neu = (
        db.table("automation_scheduled_message")
        .update({"status": "pending", "send_at": jetzt, "last_error": None})
        .eq("tenant_id", tenant_id)
        .eq("automation_id", automation_id)
        .eq("status", "failed")
        .execute()
    ).data or []
    log.info(
        "automail_erneut_alle", tenant_id=tenant_id, automation_id=automation_id,
        anzahl=len(neu), user_id=ctx.user_id,
    )
    return len(neu)
