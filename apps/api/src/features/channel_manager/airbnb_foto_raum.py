"""Foto ↔ Airbnb-Raum: anzeigen, umhängen, fehlende melden.

WARUM ES DAS GIBT: Airbnb blendet die gesamte „Photo tour" für Gäste aus, wenn
auch nur EIN Raum kein Foto hat („Guests only see your photo tour if every room
has a photo"). Der Betrieb sieht das nur im Airbnb-Extranet — bei uns fehlte
jeder Hinweis, und das Objekt wirkte vollständig gepflegt.

AIRBNB-EIGENHEIT, BEWUSST GEKAPSELT: Booking.com kennt keine Raum-Zuordnung für
Fotos, und der Booking-Connect kommt noch. Deshalb steht das Wissen hier und in
der eigenen Tabelle `airbnb_foto_raum` (0288) — nicht in `property_photos`, das
alle Portale lesen.

DIE ZWEI SCHREIBWEGE, live verifiziert (05.08.2026, Cornflower):

    zuordnen: PUT listing_photos/{id}   payload {"room_id": "817240083"}
    lösen:    PUT listing_photos/{id}   payload {"listing_id": "16759505…"}

Foto 2644186464 wanderte von Raum 792924436 auf 817240083 und zurück, beide Male
zurückgelesen; Foto 2644183304 wurde von 792924439 gelöst und wieder angehängt.

DREI FALLEN, jede gemessen:
  * `room_id` muss beim Zuordnen ALLEIN stehen — zusammen mit `listing_id`
    antwortet Airbnb „Please provide either a listing ID or a room ID, but not
    both."
  * `{"room_id": null}` und `{"room_id": ""}` LÖSEN NICHT. Airbnb antwortet
    200 mit leerem `data` und lässt die Zuordnung unverändert — ein stiller
    Nicht-Vorgang. Gelöst wird ausschließlich, indem man das Foto per
    `listing_id` an das Listing selbst hängt.
  * Ein Raum lässt sich bei Airbnb NICHT löschen. Es gibt überhaupt keine Route
    auf einen einzelnen Raum: `DELETE`, `PUT` und `POST` auf
    `listing_rooms/{id}` antworten alle „Route not found" — auch das harmlose
    `PUT {"is_private": true}`. Auch die Sammlung ist nicht ersetzbar
    (`PUT listing_rooms` → Route not found; `PUT listings/{id}` existiert zwar,
    ignoriert aber ein `rooms`-Feld). Kontrolltest, der das absichert: ein
    `DELETE listing_photos/<unsinn>` kommt bis Airbnb durch (403 mit Airbnb-
    `error_id`) — Channex filtert die Methode DELETE also nicht weg, die Route
    existiert bei Airbnb wirklich nicht. Räume verschwinden nur im Extranet.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from . import airbnb_listing_import as ali
from .channex_client import ChannexError
from .common import ChannelManagerError, log


class AirbnbFotoRaumMixin:
    """Zuordnung lesen und ändern; meldet Räume ohne Foto."""

    def airbnb_foto_raeume(
        self, ctx: AuthContext, *, property_id: str
    ) -> dict[str, Any]:
        """Was die Fotos-Seite braucht: Zuordnung je Foto + Räume ohne Foto.

        Kein Airbnb-Objekt → leere Antwort mit `verbunden: False`. Die
        Oberfläche blendet den Airbnb-Teil dann aus, statt eine leere Sektion zu
        zeigen (ein Booking-only-Objekt hat hier nichts zu suchen).
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        prop = load_scoped(
            db, "properties", property_id, tenant_id,
            columns="id, airbnb_listing_id",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        if not prop.get("airbnb_listing_id"):
            return {"verbunden": False, "fotos": [], "raeume": [], "ohne_foto": []}

        # Der Stand kommt DIREKT von Airbnb, nicht aus unserer Tabelle: dort
        # hängen die Fotos, und dort ändert der Betrieb sie auch im Extranet.
        # `airbnb_foto_raum` ist nur der Cache für den Schreibweg (die
        # `airbnb_photo_id`, ohne die kein Umhängen geht).
        #
        # WARUM NICHT AUS DEM CACHE: eine leere Tabelle sähe aus wie „kein Raum
        # hat ein Foto" und meldete alle Zimmer als fehlend — genau so ist es
        # live passiert (16 Fotos importiert, bevor die Tabelle existierte, und
        # die Warnung listete jedes Zimmer auf). Nicht-Wissen ist kein Befund
        # (Wurzel 4).
        airbnb_fotos = self._airbnb_fotos_mit_raum(db, tenant_id, property_id)
        if airbnb_fotos is None:
            # Airbnb nicht lesbar → KEINE Aussage treffen. Lieber gar keine
            # Warnung als eine erfundene.
            return {
                "verbunden": True, "stand_bekannt": False,
                "fotos": [], "raeume": [], "ohne_foto": [],
            }

        unsere = (
            db.table("property_photos")
            .select("id, url")
            .eq("property_id", property_id)
            .execute()
        ).data or []
        # Der Bezug läuft über die URL: unsere Zeilen tragen Airbnbs CDN-URL,
        # das ist der einzige Wert, den beide Seiten teilen.
        nach_url = {str(z.get("url")): str(z["id"]) for z in unsere}
        raeume = self._airbnb_raeume_mit_namen(db, tenant_id, property_id)
        zugeordnet = []
        belegt: set[str] = set()
        for foto in airbnb_fotos:
            if foto.get("airbnb_room_id"):
                belegt.add(str(foto["airbnb_room_id"]))
            unser_id = nach_url.get(foto["url"])
            if not unser_id:
                continue
            zugeordnet.append(
                {
                    "property_photo_id": unser_id,
                    "airbnb_photo_id": foto.get("airbnb_photo_id"),
                    "airbnb_room_id": foto.get("airbnb_room_id"),
                }
            )
        return {
            "verbunden": True,
            "stand_bekannt": True,
            "fotos": zugeordnet,
            "raeume": raeume,
            # Der Grund für die ganze Übung: Airbnb versteckt die Photo tour,
            # solange hier etwas drinsteht.
            "ohne_foto": [r for r in raeume if r["id"] not in belegt],
        }

    def _airbnb_fotos_mit_raum(
        self, db: Client, tenant_id: str, property_id: str
    ) -> list[dict[str, Any]] | None:
        """Airbnbs Fotos samt `room_id`. None = Stand unbekannt.

        None und `[]` sind verschieden: „nicht lesbar" darf nicht wie „keine
        Fotos" aussehen, sonst meldet die Oberfläche jedes Zimmer als leer.
        """
        listing_id = self._airbnb_listing_id(db, property_id)  # type: ignore[attr-defined]
        zugang = self._airbnb_token(db, tenant_id, property_id)  # type: ignore[attr-defined]
        if not listing_id or not zugang:
            return None
        token, _user = zugang
        fotos = self.airbnb_fotos_direkt(token, str(listing_id))  # type: ignore[attr-defined]
        return fotos or None

    def _airbnb_raeume_mit_namen(
        self, db: Client, tenant_id: str, property_id: str
    ) -> list[dict[str, Any]]:
        """Airbnbs Räume mit unserem Slug — die Auswahlliste der Oberfläche.

        Die Namen kommen NICHT aus unserer `property_rooms`: maßgeblich ist, was
        bei Airbnb steht (dort hängen die Fotos). Unser Slug wird nur zum
        Übersetzen mitgegeben; eine Raumart ohne Slug (`exterior`, `garden`)
        behält Airbnbs Rohwert, statt zu verschwinden.
        """
        listing_id = self._airbnb_listing_id(db, property_id)  # type: ignore[attr-defined]
        channel_id = self._airbnb_kanal_des_betriebs(db, tenant_id, property_id)  # type: ignore[attr-defined]
        if not listing_id or not channel_id:
            return []
        raeume = self._airbnb_raeume_lesen(channel_id, listing_id)  # type: ignore[attr-defined]
        if raeume is None:
            return []
        ergebnis = []
        for raum in raeume:
            art = str(raum.get("room_type") or "").strip()
            raum_id = str(raum.get("id") or "").strip()
            if not raum_id:
                continue
            ergebnis.append(
                {
                    "id": raum_id,
                    "airbnb_art": art,
                    "slug": ali.AIRBNB_RAUM_AUF_SLUG.get(art),
                }
            )
        return ergebnis

    def airbnb_foto_umhaengen(
        self, ctx: AuthContext, *, property_id: str, photo_id: str,
        room_id: str | None,
    ) -> dict[str, Any]:
        """Ein Foto bei Airbnb einem Raum zuordnen — oder davon lösen.

        `room_id=None` heißt LÖSEN: das Foto bleibt, hängt danach aber an keinem
        Raum mehr. Der Payload ist dafür ein anderer (`listing_id` statt
        `room_id`), weil ein leeres `room_id` von Airbnb still ignoriert wird.

        Reihenfolge: schreiben → ZURÜCKLESEN → erst dann unsere Zeile pflegen.
        Ein 200 von Channex beweist hier nichts (Wurzel 5); maßgeblich ist, was
        Airbnb danach liefert. Stimmt es nicht, bleibt unsere Zeile auf dem alten
        Stand und der Aufrufer bekommt einen Fehler — kein stiller Erfolg.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        load_scoped(
            db, "properties", property_id, tenant_id, columns="id",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        # Wurzel 9: das Foto MUSS zu diesem Objekt gehören — eine Foto-ID allein
        # darf nie genügen, sonst hängt man fremde Bilder um.
        eigenes = (
            db.table("property_photos")
            .select("id, url")
            .eq("id", photo_id)
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data
        if not eigenes:
            raise ChannelManagerError("Foto nicht gefunden.", status_code=404)

        airbnb_photo_id = self._airbnb_photo_id(
            db, tenant_id, property_id, photo_id, str(eigenes[0].get("url") or "")
        )
        if not airbnb_photo_id:
            raise ChannelManagerError(
                "Dieses Foto gibt es bei Airbnb nicht — nur dort vorhandene "
                "Bilder lassen sich einem Zimmer zuordnen.",
                status_code=409,
            )
        channel_id = self._airbnb_kanal_des_betriebs(db, tenant_id, property_id)  # type: ignore[attr-defined]
        if not channel_id:
            raise ChannelManagerError(
                "Es ist kein Airbnb-Konto verbunden.", status_code=409
            )

        roh_listing = self._airbnb_listing_id(db, property_id)  # type: ignore[attr-defined]
        listing_id = str(roh_listing or "")
        if not listing_id:
            raise ChannelManagerError(
                "Objekt ist nicht mit Airbnb verbunden.", status_code=409
            )
        if room_id:
            # NUR room_id — mit listing_id zusammen lehnt Airbnb ab
            # („either a listing ID or a room ID, but not both").
            payload: dict[str, Any] = {"room_id": room_id}
        else:
            # LÖSEN heißt: das Foto ans Listing selbst hängen. `room_id: null`
            # quittiert Airbnb mit 200 und tut nichts (gemessen).
            payload = {"listing_id": listing_id}

        # Der VORHER-Stand gehört ins Log, sonst ist im Fehlerfall nicht zu
        # sehen, ob die Ziel-Raum-ID überhaupt noch existierte. Genau daran ist
        # es live gescheitert: die Oberfläche hielt eine Raum-ID fest, die im
        # Airbnb-Extranet längst gelöscht war (der Raum kam mit NEUER ID zurück).
        vorher = self._raum_ids_und_foto_stand(db, tenant_id, property_id)
        log.info(
            "airbnb_foto_umhaengen_start",
            property_id=property_id, listing_id=listing_id,
            photo_id=photo_id, airbnb_photo_id=airbnb_photo_id,
            ziel_raum=room_id, aktueller_raum=vorher.get("raum_je_foto", {}).get(
                airbnb_photo_id
            ),
            bekannte_raeume=vorher.get("raum_ids"),
            bekannte_arten=vorher.get("art_je_raum"),
        )
        if room_id and room_id not in (vorher.get("raum_ids") or []):
            # DIE RAUM-ID IST FLÜCHTIG: Löschen+Neuanlegen desselben Zimmers gibt
            # eine NEUE ID (live: Balkon 817240083 → 817255403). Die Oberfläche
            # kann also eine tote ID halten, ohne dass jemand etwas falsch macht.
            # Statt mit 404 zu scheitern, wird über die ART neu aufgelöst —
            # `balcony` bleibt `balcony`, egal wie oft die Zeile neu entsteht.
            ersatz = self._raum_neu_aufloesen(
                room_id, vorher, db, tenant_id, property_id
            )
            if not ersatz:
                raise ChannelManagerError(
                    "Dieses Zimmer gibt es bei Airbnb nicht mehr. Bitte die "
                    "Seite neu laden — die Zimmerliste hat sich geändert.",
                    status_code=409,
                )
            log.info(
                "airbnb_raum_id_neu_aufgeloest",
                property_id=property_id, alt=room_id, neu=ersatz,
            )
            room_id = ersatz
            payload = {"room_id": room_id}

        try:
            antwort = self._channex.airbnb_api_proxy_write(  # type: ignore[attr-defined]
                channel_id, f"listing_photos/{airbnb_photo_id}", "put",
                payload=payload,
            )
        except ChannexError as exc:
            log.warning(
                "airbnb_foto_umhaengen_abgelehnt",
                property_id=property_id, airbnb_photo_id=airbnb_photo_id,
                ziel_raum=room_id, payload=payload,
                status=exc.channex_status, antwort=exc.payload,
            )
            raise ChannelManagerError(
                f"Airbnb hat die Zuordnung abgelehnt: {exc.message}",
                status_code=502,
            ) from exc
        log.info(
            "airbnb_foto_umhaengen_gesendet",
            property_id=property_id, airbnb_photo_id=airbnb_photo_id,
            payload=payload, antwort=antwort,
        )

        tatsaechlich = self._foto_raum_zurueckgelesen(
            db, tenant_id, property_id, airbnb_photo_id
        )
        if tatsaechlich != room_id:
            log.warning(
                "airbnb_foto_umhaengen_nicht_uebernommen",
                property_id=property_id, airbnb_photo_id=airbnb_photo_id,
                erwartet=room_id, zurueckgelesen=tatsaechlich, payload=payload,
            )
            raise ChannelManagerError(
                "Airbnb hat die Zuordnung angenommen, aber nicht übernommen. "
                "Bitte erneut versuchen.",
                status_code=502,
            )
        # Art mitschreiben: die Raum-ID ist flüchtig, die Art ist der Anker,
        # über den eine tote ID später wieder aufgelöst wird (0290).
        db.table("airbnb_foto_raum").update(
            {
                "airbnb_room_id": room_id,
                "airbnb_room_art": (vorher.get("art_je_raum") or {}).get(
                    room_id or ""
                ),
            }
        ).eq("tenant_id", tenant_id).eq("property_photo_id", photo_id).execute()
        log.info(
            "airbnb_foto_umgehaengt",
            property_id=property_id, airbnb_photo_id=airbnb_photo_id,
            room_id=room_id,
        )
        return {"property_photo_id": photo_id, "airbnb_room_id": room_id}

    def _raum_ids_und_foto_stand(
        self, db: Client, tenant_id: str, property_id: str
    ) -> dict[str, Any]:
        """Airbnbs Raum-IDs und die aktuelle Foto→Raum-Zuordnung, fürs Log.

        Best effort: das ist Diagnose, kein Kontrollpfad. Fällt der Abruf aus,
        wird der Vorgang trotzdem versucht — nur eben ohne Vorher-Bild im Log
        (Wurzel 5: ein Nebenpfad darf den Hauptpfad nicht kippen).
        """
        try:
            lid = self._airbnb_listing_id(db, property_id)  # type: ignore[attr-defined]
            kanal = self._airbnb_kanal_des_betriebs(db, tenant_id, property_id)  # type: ignore[attr-defined]
            raeume = (
                self._airbnb_raeume_lesen(kanal, lid)  # type: ignore[attr-defined]
                if lid and kanal
                else None
            ) or []
            fotos = self._airbnb_fotos_mit_raum(db, tenant_id, property_id) or []
        except Exception as exc:  # noqa: BLE001 — reine Diagnose
            log.warning("airbnb_vorherstand_unlesbar", error=str(exc)[:200])
            return {}
        return {
            "raum_ids": [str(r.get("id")) for r in raeume if r.get("id")],
            # Art je ID — die Art ist das Stabile, die ID nicht (siehe
            # `_raum_neu_aufloesen`).
            "art_je_raum": {
                str(r["id"]): str(r.get("room_type") or "")
                for r in raeume if r.get("id")
            },
            "raum_je_foto": {
                str(f.get("airbnb_photo_id")): f.get("airbnb_room_id")
                for f in fotos
            },
        }

    def _raum_neu_aufloesen(  # noqa: PLR0913 — alte ID plus Suchkontext
        self,
        alte_id: str,
        stand: dict[str, Any],
        db: Client,
        tenant_id: str,
        property_id: str,
    ) -> str | None:
        """Die heutige ID des Zimmers finden, dessen alte ID nicht mehr gilt.

        WARUM DAS NÖTIG IST: Airbnb vergibt beim Neuanlegen eines Zimmers eine
        neue ID. Wer den Balkon löscht und wieder anlegt, hat dieselbe Sache
        unter anderer Nummer — jede ID, die irgendwo zwischengespeichert wurde
        (offene Seite, unsere Cache-Zeile), zeigt danach ins Leere.

        Aufgelöst wird über die ART: die alte ID steht mit ihrer Art in
        `airbnb_foto_raum`; existiert heute genau ein Zimmer dieser Art, ist das
        die Fortsetzung. Bei mehreren gleichen Arten (zwei Schlafzimmer) ist die
        Zuordnung nicht eindeutig — dann lieber abbrechen und neu laden lassen,
        statt das Foto ins falsche Schlafzimmer zu hängen (Wurzel 4).
        """
        art = self._art_der_alten_raum_id(db, tenant_id, property_id, alte_id)
        if not art:
            return None
        passende = [
            raum_id
            for raum_id, raum_art in (stand.get("art_je_raum") or {}).items()
            if raum_art == art
        ]
        if len(passende) != 1:
            log.info(
                "airbnb_raum_id_nicht_eindeutig",
                property_id=property_id, alte_id=alte_id, art=art,
                treffer=passende,
            )
            return None
        return passende[0]

    def _art_der_alten_raum_id(
        self, db: Client, tenant_id: str, property_id: str, alte_id: str
    ) -> str | None:
        """Welche Raumart die (heute tote) ID hatte — aus unserer Cache-Zeile."""
        fotos = (
            db.table("property_photos")
            .select("id")
            .eq("property_id", property_id)
            .execute()
        ).data or []
        foto_ids = [str(f["id"]) for f in fotos]
        if not foto_ids:
            return None
        zeilen = (
            db.table("airbnb_foto_raum")
            .select("airbnb_room_id, airbnb_room_art")
            .eq("tenant_id", tenant_id)
            .in_("property_photo_id", foto_ids)
            .execute()
        ).data or []
        for zeile in zeilen:
            if str(zeile.get("airbnb_room_id") or "") == alte_id:
                return str(zeile.get("airbnb_room_art") or "") or None
        return None

    def _airbnb_photo_id(  # noqa: PLR0913 — Cache-Schlüssel plus Rückfallweg
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        photo_id: str,
        url: str,
    ) -> str | None:
        """Airbnbs Foto-Kennung. Erst aus dem Cache, sonst live nachschlagen.

        Der Cache (`airbnb_foto_raum`) füllt sich erst beim nächsten Abruf. Ohne
        den Rückfallweg wäre das Umhängen bis dahin gesperrt — live genau der
        Fall: 16 Fotos importiert, bevor die Tabelle existierte.

        Wird die Kennung live gefunden, wird die Cache-Zeile gleich angelegt:
        beim nächsten Mal reicht dann ein DB-Zugriff statt eines Fremdaufrufs.
        """
        zeile = (
            db.table("airbnb_foto_raum")
            .select("airbnb_photo_id")
            .eq("tenant_id", tenant_id)
            .eq("property_photo_id", photo_id)
            .limit(1)
            .execute()
        ).data
        if zeile:
            return str(zeile[0]["airbnb_photo_id"])
        if not url:
            return None
        for foto in self._airbnb_fotos_mit_raum(db, tenant_id, property_id) or []:
            if foto.get("url") != url or not foto.get("airbnb_photo_id"):
                continue
            db.table("airbnb_foto_raum").upsert(
                {
                    "tenant_id": tenant_id,
                    "property_photo_id": photo_id,
                    "airbnb_photo_id": foto["airbnb_photo_id"],
                    "airbnb_room_id": foto.get("airbnb_room_id"),
                },
                on_conflict="property_photo_id",
            ).execute()
            return str(foto["airbnb_photo_id"])
        return None

    def _foto_raum_zurueckgelesen(
        self, db: Client, tenant_id: str, property_id: str, airbnb_photo_id: str
    ) -> str | None:
        """Der Raum, an dem das Foto bei AIRBNB wirklich hängt.

        `None` heißt „hängt an keinem Raum" — und NUR das. Ist der Stand nicht
        lesbar (kein Token, Foto nicht gefunden), wirft die Methode: sonst sähe
        ein misslungenes Lösen wie ein gelungenes aus, weil beide Fälle `None`
        ergäben (Wurzel 5 — kein stiller Erfolg).
        """
        listing_id = self._airbnb_listing_id(db, property_id)  # type: ignore[attr-defined]
        zugang = self._airbnb_token(db, tenant_id, property_id)  # type: ignore[attr-defined]
        if not listing_id or not zugang:
            raise ChannelManagerError(
                "Der Stand bei Airbnb ist gerade nicht lesbar — die Änderung "
                "wurde nicht bestätigt.",
                status_code=502,
            )
        token, _user = zugang
        for foto in self.airbnb_fotos_direkt(token, str(listing_id)):  # type: ignore[attr-defined]
            if foto.get("airbnb_photo_id") == airbnb_photo_id:
                return foto.get("airbnb_room_id")
        raise ChannelManagerError(
            "Airbnb kennt dieses Foto nicht mehr — die Änderung wurde nicht "
            "bestätigt.",
            status_code=502,
        )
