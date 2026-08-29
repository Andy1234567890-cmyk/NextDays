"""Veröffentlichen je Kanal — welche Portale, was ändert sich dort, an/aus.

DER ANLASS (06.08.2026): Der Statuswechsel auf „Aktiv" wirkte NUR bei uns. Bei
Airbnb standen alle 18 Objekte weiter auf „Unlisted", denn `properties.status`
wird im ganzen Channel-Manager nirgends gelesen und steht auch nicht in
`_CONTENT_FIELDS` — ein Statuswechsel löste also keinen einzigen Sync aus.

Der Schalter dahinter heißt bei Airbnb `published` und liegt im Channex-Mapping
je Listing (`channels/{id}` → `attributes.rate_plans[].settings.published`),
NICHT am Listing selbst. `has_availability` am Listing ist etwas anderes und
verlangt beim Abschalten ein Pflichtfeld `deactivation_reason` — Finger weg,
das ist Airbnbs Urlaubsmodus, nicht die Sichtbarkeit.

WAS „VERBUNDEN" HEISST: eine Zeile in `channex_channel_connection` reicht NICHT.
Live gemessen sind dort 78 Zeilen, aber nur 18 tragen eine `channex_channel_id`
(Airbnb 18/38, Booking.com 0/20, Vrbo 0/20) — der Rest ist Absichtserklärung,
kein Kanal. Ein Portal ohne Kanal-ID darf nicht wählbar sein, sonst hakt der
Betrieb etwas an, das nirgends ankommt (Wurzel 4).

myBestDays ist KEIN OTA und läuft nicht über Channex: eigener Marktplatz,
eigene Achse (`properties.listed_on_marketplace` + Moderation, 0159/0203). Im
Auswahldialog steht er trotzdem gleichberechtigt daneben — für den Betrieb ist
er ein Vertriebskanal wie jeder andere.
"""
from __future__ import annotations

from typing import Any, Final

from supabase import Client

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .common import ChannelManagerError, log

# Der eigene Marktplatz. Kein Channex-Portal — eigener Code, damit die
# Oberfläche ihn wie ein Portal anzeigen kann, ohne dass er einer wird.
MARKTPLATZ_CODE: Final = "myBestDays"

# Anzeigenamen der Portale. Eigennamen, nicht übersetzt (Regel: Portal-Namen
# immer echt). „Channex" taucht nirgends auf — der Kunde sieht nur Portale.
_PORTAL_LABEL: Final[dict[str, str]] = {
    "AirBNB": "Airbnb",
    "BookingCom": "Booking.com",
    "Vrbo": "Vrbo",
    MARKTPLATZ_CODE: "myBestDays",
}

# Warum ein Kanal nicht wählbar ist. Schlüssel für die Oberfläche, kein Text:
# die 24 Sprachen übersetzen ihn selbst.
GRUND_KEIN_KANAL: Final = "nichtVerbunden"
GRUND_INAKTIV: Final = "verbindungInaktiv"


def portal_label(code: str) -> str:
    """Anzeigename eines Portals; unbekannter Code bleibt, wie er ist."""
    return _PORTAL_LABEL.get(code, code)


def _kanaele_des_objekts(
    db: Client, tenant_id: str, property_id: str
) -> list[dict[str, Any]]:
    """Alle Portal-Zeilen dieses Objekts — verbunden oder nicht."""
    return (
        db.table("channex_channel_connection")
        .select("ota_portal_code, channex_channel_id, is_active, last_error")
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        .execute()
    ).data or []


def kanal_auswahl(
    db: Client, tenant_id: str, property_id: str, *, marktplatz: bool
) -> list[dict[str, Any]]:
    """Die Kanäle für den Auswahl-Dialog, je mit „wählbar" und Grund.

    Nicht verbundene Portale werden MITGELIEFERT statt weggelassen: der Betrieb
    soll sehen, dass es sie gibt und warum sie (noch) nicht gehen. Weglassen
    sähe aus, als gäbe es das Portal nicht.
    """
    # JE PORTAL eine Zeile, nicht je Verbindungszeile.
    #
    # `_kanaele_des_objekts` liefert Zeilen aus `channex_channel_connection`,
    # und davon kann es zu EINEM Portal mehrere geben: jeder abgebrochene
    # Verbindungsversuch hinterlaesst eine, ebenso ein zweiter Portal-Zugang
    # am selben Objekt (0304). Live am 29.08.2026 standen deshalb DREIMAL
    # „Airbnb — Noch nicht mit diesem Portal verbunden" im Dialog, und React
    # meldete zusaetzlich „Encountered two children with the same key,
    # `AirBNB`" (der Schluessel ist der Portal-Code).
    #
    # Zusammengefasst wird nach dem BESTEN Zustand: eine verbundene und aktive
    # Zeile schlaegt eine tote. Sonst haette eine Leiche aus einem Abbruch das
    # Portal gesperrt, obwohl daneben eine funktionierende Verbindung steht.
    bester: dict[str, dict[str, Any]] = {}
    for row in _kanaele_des_objekts(db, tenant_id, property_id):
        code = str(row.get("ota_portal_code") or "")
        if not code:
            continue
        hat_kanal = bool(row.get("channex_channel_id"))
        aktiv = bool(row.get("is_active"))
        grund = None
        if not hat_kanal:
            grund = GRUND_KEIN_KANAL
        elif not aktiv:
            grund = GRUND_INAKTIV
        eintrag = {
            "code": code,
            "name": portal_label(code),
            "waehlbar": grund is None,
            # Fremde Portale sind immer abwählbar — der Betrieb entscheidet,
            # wem er Provision zahlt.
            "pflicht": False,
            "grund": grund,
            "letzter_fehler": row.get("last_error"),
        }
        vorhanden = bester.get(code)
        # Rang: waehlbar (2) > verbunden aber inaktiv (1) > kein Kanal (0).
        rang = 2 if grund is None else (1 if hat_kanal else 0)
        if vorhanden is None or rang > int(vorhanden["_rang"]):
            eintrag["_rang"] = rang
            bester[code] = eintrag
    kanaele: list[dict[str, Any]] = []
    for eintrag in bester.values():
        eintrag.pop("_rang", None)
        kanaele.append(eintrag)
    kanaele.sort(key=lambda k: (not k["waehlbar"], k["name"]))
    # Der eigene Marktplatz steht IMMER an erster Stelle und ist NICHT
    # abwählbar: myBestDays ist unsere eigene Strecke — ein Objekt, das dort
    # nicht liegt, verkaufen wir gar nicht selbst, sondern nur über fremde
    # Portale gegen deren Provision. Er braucht auch keinen Channex-Kanal
    # (eigene Achse, siehe Modul-Docstring), kann also nie „nicht verbunden"
    # sein. `pflicht` sagt der Oberfläche: anzeigen, angehakt, nicht klickbar.
    kanaele.insert(0, {
        "code": MARKTPLATZ_CODE,
        "name": portal_label(MARKTPLATZ_CODE),
        "waehlbar": True,
        "pflicht": True,
        "grund": None,
        "bereits_gelistet": marktplatz,
        "letzter_fehler": None,
    })
    return kanaele


class VeroeffentlichenMixin:
    """Kanal-Auswahl, Änderungs-Vorschau und Schalten je Kanal."""

    def veroeffentlichen_uebersicht(
        self, ctx: AuthContext, property_id: str
    ) -> dict[str, Any]:
        """Schritt 1 des Dialogs: Wo kann dieses Objekt veröffentlicht werden?

        Liefert je Kanal, ob er wählbar ist und warum nicht — plus den
        aktuellen Objektstatus, damit die Oberfläche „veröffentlichen" von
        „deaktivieren" unterscheiden kann.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        prop = load_scoped(
            db, "properties", property_id, tenant_id,
            columns="id, title, status, listed_on_marketplace, moderation_status",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        kanaele = kanal_auswahl(
            db, tenant_id, property_id,
            marktplatz=bool(prop.get("listed_on_marketplace")),
        )
        log.info(
            "veroeffentlichen_uebersicht",
            property_id=property_id,
            waehlbar=[k["code"] for k in kanaele if k["waehlbar"]],
            gesperrt=[k["code"] for k in kanaele if not k["waehlbar"]],
        )
        return {
            "property_id": property_id,
            "titel": prop.get("title"),
            "status": prop.get("status"),
            "moderation_status": prop.get("moderation_status"),
            "kanaele": kanaele,
        }

    def veroeffentlichen_vorschau(
        self, ctx: AuthContext, property_id: str, portal_code: str
    ) -> dict[str, Any]:
        """Schritt 2: Was ändert sich bei DIESEM Portal, wenn wir jetzt senden?

        Für Airbnb ein echter Feld-Abgleich gegen die Anzeige (`airbnb_diagnose`
        liest den Ist-Stand direkt bei Airbnb). Für Portale ohne Gegenstelle
        gibt es KEINEN erfundenen Abgleich — dann sagt `vergleichbar: false`,
        warum, und die Oberfläche zeigt statt eines Diffs den Hinweis.

        Der eigene Marktplatz hat keine Fremdstelle: dort zählt allein, ob die
        Freigabe schon erteilt ist.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        prop = load_scoped(
            db, "properties", property_id, tenant_id,
            columns="id, listed_on_marketplace, moderation_status",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )

        if portal_code == MARKTPLATZ_CODE:
            return {
                "portal_code": portal_code,
                "portal": portal_label(portal_code),
                "vergleichbar": False,
                "grund": "eigenerMarktplatz",
                "moderation_status": prop.get("moderation_status"),
                "bereits_gelistet": bool(prop.get("listed_on_marketplace")),
                "felder": [],
            }

        # Ohne Kanal-ID gibt es keine Gegenstelle — nicht raten (Wurzel 4).
        verbunden = [
            k for k in _kanaele_des_objekts(db, tenant_id, property_id)
            if str(k.get("ota_portal_code")) == portal_code
        ]
        if not verbunden or not verbunden[0].get("channex_channel_id"):
            return {
                "portal_code": portal_code,
                "portal": portal_label(portal_code),
                "vergleichbar": False,
                "grund": GRUND_KEIN_KANAL,
                "felder": [],
            }

        if portal_code != "AirBNB":
            # Booking.com/Vrbo sind angebunden, aber es gibt (noch) keinen Weg,
            # ihren Ist-Stand zu lesen. Das ehrlich sagen, statt einen leeren
            # Diff als „alles gleich" auszugeben.
            return {
                "portal_code": portal_code,
                "portal": portal_label(portal_code),
                "vergleichbar": False,
                "grund": "keinIstAbgleich",
                "felder": [],
            }

        diagnose = self.airbnb_diagnose(ctx, property_id)  # type: ignore[attr-defined]
        felder = [
            f for f in diagnose.get("felder") or []
            if f.get("status") in ("abweichung", "fehlt")
        ]
        return {
            "portal_code": portal_code,
            "portal": portal_label(portal_code),
            "vergleichbar": bool(diagnose.get("erreichbar")),
            "grund": None if diagnose.get("erreichbar") else "nichtErreichbar",
            "hinweis": diagnose.get("hinweis"),
            # Nur die Unterschiede — eine Liste, in der 20 von 22 Zeilen „ok"
            # sagen, verbirgt genau die zwei, um die es geht.
            "felder": felder,
            "fotos": diagnose.get("fotos") or {},
            "beschreibung": diagnose.get("beschreibung") or {},
        }

    def airbnb_sichtbarkeit_setzen(
        self, channel_id: str, listing_id: str, *, sichtbar: bool
    ) -> bool:
        """`published` EINES Airbnb-Listings im Kanal-Mapping setzen.

        GEFAHR, die den ganzen Aufbau bestimmt: `PUT channels/{id}` ERSETZT das
        `rate_plans`-Array vollständig (kein Merge, verifiziert in
        `_attach_room_to_channel`). Der Kanal trägt ALLE Objekte des Kontos —
        live 18 Stück. Wer nur das eine Mapping sendet, löscht die anderen 17
        und trennt damit fremde Objekte von ihrem Portal.

        Deshalb: erst den Ist-Stand lesen, GENAU EIN Mapping ändern, alles
        andere unverändert zurückschreiben (Wurzel 1 — der Gegenzustand ist
        hier „alle übrigen bleiben, wie sie waren").

        Rückgabe: True, wenn der Wert danach wirklich steht. Kein Vertrauen in
        den Statuscode — zurückgelesen wird immer.
        """
        try:
            aktuell = self._channex.get_channel(channel_id)  # type: ignore[attr-defined]
        except Exception as exc:  # noqa: BLE001 — in ChannelManagerError wandeln
            raise ChannelManagerError(
                f"Kanal nicht lesbar: {exc}", status_code=502
            ) from exc
        attrs = (aktuell.get("data") or {}).get("attributes") or {}
        plans = attrs.get("rate_plans") or []

        neu: list[dict[str, Any]] = []
        getroffen = 0
        for plan in plans:
            settings = dict(plan.get("settings") or {})
            if str(settings.get("listing_id") or "") == str(listing_id):
                settings["published"] = sichtbar
                getroffen += 1
            neu.append({
                "rate_plan_id": plan.get("rate_plan_id"),
                "settings": settings,
            })
        if not getroffen:
            raise ChannelManagerError(
                "Dieses Objekt ist im Portal-Kanal nicht zugeordnet.",
                status_code=422,
            )
        if getroffen > 1:
            # Zwei Mappings auf dieselbe Anzeige: dann ist unklar, welches gilt.
            # Lieber abbrechen als das falsche schalten (Wurzel 5).
            raise ChannelManagerError(
                f"Mehrdeutige Zuordnung: {getroffen} Einträge zeigen auf "
                f"dieselbe Anzeige {listing_id}.",
                status_code=409,
            )
        # Sicherung: Wir senden so viele Mappings zurück, wie wir gelesen haben.
        # Weicht das ab, ist beim Umbau etwas verloren gegangen — dann NICHT
        # senden, sonst trennt der PUT fremde Objekte vom Portal.
        if len(neu) != len(plans):
            raise ChannelManagerError(
                "Interner Fehler beim Kanal-Umbau — nicht gesendet.",
                status_code=500,
            )

        log.info(
            "airbnb_sichtbarkeit_sende",
            channel_id=channel_id, listing_id=listing_id,
            sichtbar=sichtbar, mappings=len(neu),
        )
        senden = self._channex.update_channel  # type: ignore[attr-defined]
        try:
            senden(channel_id, {"rate_plans": neu})
        except Exception as exc:  # noqa: BLE001
            raise ChannelManagerError(
                f"Sichtbarkeit nicht übertragbar: {exc}", status_code=502
            ) from exc

        ist = self._airbnb_sichtbarkeit_lesen(channel_id, listing_id)
        angekommen = ist is sichtbar
        log.info(
            "airbnb_sichtbarkeit_gesetzt",
            channel_id=channel_id, listing_id=listing_id,
            soll=sichtbar, ist=ist, angekommen=angekommen,
        )
        if not angekommen:
            log.warning(
                "airbnb_sichtbarkeit_nicht_uebernommen",
                listing_id=listing_id, soll=sichtbar, ist=ist,
            )
        return angekommen

    def _airbnb_sichtbarkeit_lesen(
        self, channel_id: str, listing_id: str
    ) -> bool | None:
        """`published` dieses Listings, wie es GERADE im Kanal steht.

        `None` = Mapping nicht gefunden oder Kanal nicht lesbar — dann steht im
        Log `None` statt einer erfundenen Aussage.
        """
        try:
            aktuell = self._channex.get_channel(channel_id)  # type: ignore[attr-defined]
        except Exception as exc:  # noqa: BLE001 — reine Gegenprobe
            log.warning("airbnb_sichtbarkeit_nicht_lesbar", error=str(exc)[:200])
            return None
        attrs = (aktuell.get("data") or {}).get("attributes") or {}
        for plan in attrs.get("rate_plans") or []:
            settings = plan.get("settings") or {}
            if str(settings.get("listing_id") or "") == str(listing_id):
                wert = settings.get("published")
                return bool(wert) if wert is not None else None
        return None
