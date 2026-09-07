"""Service-Schicht für public_portal (Eigentümer-Self-Service-Portal, §4.2).

Der eingeloggte Eigentümer sieht NUR seine zugeordneten Objekte
(owner_property_assignments) — der Service nutzt den Service-Role-Key (umgeht RLS),
darum wird der Owner-Scope hier EXPLIZIT durchgesetzt (fail-closed: keine
Zuordnung → sieht nichts). Beträge/Gäste werden über guest_masking maskiert: ein
Owner sieht Netto/Vorname, aber keinen Gastpreis/PII.

ZUR DATEIGRÖSSE (pylint C0302, Grenze 1500): Die Datei lag mit 1483 Zeilen
knapp darunter und ist mit den Familienzugängen (0389) darüber gerutscht. Was
sich sinnvoll trennen ließ, IST getrennt — die gesamte Familien-Logik steht in
`familie.py`, hier stehen nur noch die Aufruf-Hüllen.

Der verbleibende Brocken ist der Auszahlungs-Apparat (`_payout_je_nacht`,
`_vertrag_je_buchung`, `_portal_saetze_je_buchung`,
`_auszahlung_einer_buchung`, ~260 Zeilen). Ihn auszulagern wäre ein eigener
Umbau mit Regressionsrisiko in der ABRECHNUNG — also am falschen Ort in einem
Auftrag über Familienzugänge. Er ist als eigene Aufgabe vorgemerkt; bis dahin
trägt die Datei die Ausnahme mit dieser Begründung statt einer stillschweigend
hochgesetzten Grenze in `pyproject.toml` (die würde für ALLE Module gelten).
"""
# pylint: disable=too-many-lines
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import fetch_all_rows
from src.features.auth.guest_masking import GuestMask, load_guest_mask
from src.features.owner_statements.common import (
    Auszahlung,
    PayoutUnbekannt,
    Vertragsregeln,
    auszahlung_berechnen,
    buchungs_payout,
    effektive_provision_pct,
    naechte_payout_map,
    owner_payout,
    payout_je_nacht,
    portal_abzug,
    portal_brutto,
    portal_zieht_ein,
    vertragsregeln_aus_zeile,
)
from src.features.owner_statements.gebuehren_quelle import (
    gebuehren_der_buchung,
    klassifikation_laden,
)
from src.features.owner_statements.payloads import (
    csv_muster_je_objekt,
    payloads_laden,
)
from src.features.tasks.regel_uebersetzung import (
    lesersprache,
    namen_in_sprache,
)

from .familie import darf_berichte, freigabe_stufe, melde_freigabe_noetig
from .schemas import (
    BestellbareLeistungen,
    BestellteLeistung,
    BlockRequestCreate,
    BlockRequestItem,
    BlockRequestList,
    MeterReadingCreate,
    MeterReadingItem,
    MeterReadingList,
    PortalAlbumGroup,
    PortalCalendarDay,
    PortalCalendarResponse,
    PortalEarningsItem,
    PortalEarningsResponse,
    PortalImage,
    PortalImageList,
    PortalNightBooking,
    PortalPhotoAlbum,
    PortalProperty,
    PortalPropertyDetail,
    PortalPropertyList,
    PortalStatementItem,
    PortalStatementList,
    PortalStatisticsResponse,
    SliceHealth,
)
from .statistik import berechne_statistik

log = get_logger("nextdays.public_portal")

_CENT = Decimal("0.01")

# Harte Obergrenzen der neuen Lesepfade (Wurzel 8: kein unbegrenzter Bereich).
# Sie sind so gewählt, dass sie im Alltag nie greifen — ein Objekt hat selten
# mehr als 60 Bilder, ein Eigentümer selten mehr als eine Handvoll Objekte.
MAX_BILDER_JE_OBJEKT = 300
MAX_BILDER_JE_ALBUM = 2000
# Zwei Jahre. Genug für „dieses Jahr gegen letztes", und die Obergrenze, ab
# der eine Portal-Abfrage zum Bestandsdump würde.
MAX_STATISTIK_TAGE = 730


def _money(value: Decimal) -> float:
    return float(value.quantize(_CENT, rounding=ROUND_HALF_UP))


@dataclass(frozen=True, slots=True)
class _Belegung:
    """EINE Buchung, die diese Nacht belegt — eine je EINHEIT.

    `betrag is None` zusammen mit `grund` heißt: nicht ausweisbar — nie eine
    erfundene Null (Wurzel 4).

    Seit 0265 hängen an einem `property_id` n ≥ 1 Einheiten
    (`property_units`), und `reservations.unit_id` sagt, WELCHE eine Buchung
    belegt. Zwei gleichzeitige Reservierungen am selben Objekt sind damit der
    Normalfall, nicht die Ausnahme — fünf identische Studios unter einem Typ
    können an derselben Nacht fünf verschiedene Gäste tragen.

    `eigennutzung=True` ist eine Belegung durch den EIGENTÜMER selbst (0241,
    `reservations.is_owner_stay`) — der genehmigte Sperrantrag. Sie bringt
    keinen Umsatz, belegt die Nacht aber genauso; deshalb steht sie hier mit
    `betrag=None` und OHNE `grund`: es ist nichts unbestimmt, es gibt schlicht
    nichts auszuzahlen. Ein `grund` würde in der Oberfläche „nicht ausweisbar"
    behaupten und den Eigentümer einen Datenfehler suchen lassen, wo keiner ist.
    """

    reservation_id: str
    unit_id: str | None
    betrag: float | None
    currency: str | None
    grund: str | None
    gast: str | None
    quelle: str | None
    eigennutzung: bool = False


@dataclass(frozen=True, slots=True)
class _GebuehrenKontext:
    """Die je Auswertung EINMAL geladenen Bezugsdaten der Gebührenrechnung.

    Gebündelt statt als vier weitere Parameter durch `_verteile` geschleift:
    die Methode trägt schon die Bezugsdaten einer Buchung, und jeder zusätzliche
    Einzelparameter macht die Aufrufstelle unleserlicher als die Sache ist.
    """

    klassifikation: dict[tuple[str, str | None], tuple[str, bool]]
    type_attributes: dict[str, Any] | None
    payloads: dict[str, Any]
    # Gelerntes Portal-Verhalten dieses Objekts für CSV-Buchungen ohne
    # Zwilling (`payloads.csv_muster_je_objekt`), None = Vorgabe „im_betrag".
    csv_muster: str | None = None


@dataclass(slots=True)
class _NachtInfo:
    """Alle Belegungen EINER Nacht plus ihre Summe.

    Warum eine LISTE und nicht eine Zeile: die Nacht-Map war ein
    ``dict[datum] = eine Buchung``. Bei einem Typ mit mehreren Einheiten
    überschrieb die zweite Buchung die erste, und der Eigentümer sah für die
    überlappenden Nächte nur EINEN Payout — bei fünf Studios ein Fünftel
    seines Geldes. Die Summe ist deshalb die Summe ALLER Belegungen der Nacht.

    ``summe is None`` heißt: für mindestens eine Belegung ist kein Betrag
    ausweisbar, es wird keine Teilsumme als Gesamtsumme ausgegeben (Wurzel 4).
    """

    belegungen: list[_Belegung]

    @property
    def summe(self) -> float | None:
        """Summe der Nacht — None, sobald EINE Belegung unbestimmt ist.

        Eine Teilsumme auszuweisen wäre schlimmer als gar keine: sie sähe aus
        wie der Ertrag der Nacht, wäre aber zu niedrig (Wurzel 4).
        """
        # Eigennutzungen zählen hier NICHT mit: sie bringen keinen Umsatz, also
        # ist ihr fehlender Betrag kein „unbestimmt". Ohne diese Ausnahme zöge
        # eine Eigennutzung die ganze Nacht auf None und verschluckte den echten
        # Payout einer gleichzeitig belegten Schwestereinheit (0265).
        bezahlte = [b for b in self.belegungen if not b.eigennutzung]
        if not bezahlte:
            return None
        if any(b.betrag is None for b in bezahlte):
            return None
        gesamt = sum(
            (Decimal(str(b.betrag)) for b in bezahlte), Decimal("0")
        )
        return _money(gesamt)

    @property
    def currency(self) -> str | None:
        """Währung der Nacht — nur, wenn ALLE Belegungen dieselbe tragen.

        Zwei Buchungen in verschiedenen Währungen auf einem Objekt sind ein
        Datenfehler; ihn durch die Währung der ersten Zeile zu übertünchen wäre
        ein erfundener Wert. Dann lieber keine Währung (die UI rendert
        symbollos) und die Einzelzeilen darunter zeigen ihre eigene.
        """
        waehrungen = {b.currency for b in self.belegungen if b.currency}
        return waehrungen.pop() if len(waehrungen) == 1 else None

    @property
    def grund(self) -> str | None:
        """Erster Grund, warum ein Betrag fehlt (stabil sortiert)."""
        gruende = sorted({b.grund for b in self.belegungen if b.grund})
        return gruende[0] if gruende else None


def _als_datum(wert: object) -> date | None:
    if isinstance(wert, date):
        return wert
    if not wert:
        return None
    try:
        return date.fromisoformat(str(wert))
    except ValueError:
        return None


def _provision_pflicht(
    provisionen: dict[str, Decimal] | None,
    property_id: str,
    *,
    hat_eigentuemer: bool = True,
) -> Decimal:
    """Provisionssatz des Objekts — fehlt er, ist das ein Datenfehler.

    Ein `0` als Ausweichwert wäre die teuerste Sorte Fallback: er zahlte dem
    Eigentümer im Kalender den vollen Payout aus, während die Abrechnung später
    die echte Provision abzieht. Zwei verschiedene Zahlen für dasselbe Geld.

    ZWEI GRÜNDE, ZWEI MELDUNGEN — der Unterschied kostete real eine
    Fehlersuche (13.08.2026): Die Meldung lautete pauschal „Objekt hat keinen
    Eigentümer-Datensatz mit Provisionssatz". Tatsächlich existierten
    Eigentümer UND Vertrag mit 20 %; der Vertrag galt nur ab dem 12.08., die
    Buchung war am 09.08. abgereist. Wer die Meldung las, suchte an der
    falschen Stelle — sie behauptete fehlende Stammdaten, wo in Wahrheit ein
    Zeitraum nicht passte. Eine Diagnose, die in die Irre führt, ist schlimmer
    als gar keine.
    """
    if not provisionen or property_id not in provisionen:
        if hat_eigentuemer:
            raise PayoutUnbekannt(
                "provision_zeitraum",
                "Für den Aufenthaltszeitraum gilt kein Eigentümer-Vertrag "
                "(Stichtag ist die Abreise), und am Eigentümer ist kein "
                "Standard-Provisionssatz hinterlegt.",
            )
        raise PayoutUnbekannt(
            "provision",
            "Objekt hat keinen Eigentümer-Datensatz mit Provisionssatz.",
        )
    return provisionen[property_id]


class PortalError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class PublicPortalService:
    slice_name = "public_portal"

    def __init__(self, service_client: Client | None = None) -> None:
        self._db = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    # --- Scope ---------------------------------------------------------------

    def _require(self, ctx: AuthContext) -> tuple[str, str]:
        if not ctx.tenant_id or not ctx.user_id:
            raise PortalError("Kein Tenant/Nutzer im Konto.", status_code=400)
        return ctx.tenant_id, ctx.user_id

    def _owned_property_ids(self, ctx: AuthContext) -> list[str]:
        """Objekte, die diesem Eigentümer zugeordnet sind. Fail-closed."""
        tenant_id, user_id = self._require(ctx)
        rows = (
            self._db.table("owner_property_assignments")
            .select("property_id")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .execute()
        ).data or []
        return [str(r["property_id"]) for r in rows]

    def _require_own(self, ctx: AuthContext, property_id: str) -> None:
        if property_id not in self._owned_property_ids(ctx):
            raise PortalError("Objekt nicht gefunden.", status_code=404)

    # Öffentliche Hüllen für den Familien-Slice (0389). Der Objekt-Scope ist
    # dieselbe Wahrheit wie hier drin — ein zweiter Leser mit eigener Abfrage
    # wäre eine Kopie, die auseinanderlaufen kann (Wurzel 3).
    def owned_property_ids(self, ctx: AuthContext) -> list[str]:
        """Objekte, die dieser Portal-Nutzer sehen darf."""
        return self._owned_property_ids(ctx)

    def require_own_property(self, ctx: AuthContext, property_id: str) -> None:
        """404, wenn das Objekt nicht zu diesem Portal-Nutzer gehört."""
        self._require_own(ctx, property_id)

    def _darf_berichte(self, ctx: AuthContext) -> bool:
        """Finanzfreigabe dieses Zugangs (0389) — Regel in `familie.py`."""
        tenant_id, user_id = self._require(ctx)
        return darf_berichte(self._db, tenant_id, user_id)

    def _require_berichte(self, ctx: AuthContext) -> None:
        """403 für Flächen, die OHNE Beträge sinnlos wären.

        Der Kalender nutzt stattdessen `_darf_berichte` und unterdrückt nur die
        Beträge — er bleibt auch ohne Finanzfreigabe nützlich.
        """
        if not self._darf_berichte(ctx):
            raise PortalError(
                "Für diesen Zugang sind die Berichte nicht freigegeben.",
                status_code=403,
            )

    # --- Objekte -------------------------------------------------------------

    def my_properties(self, ctx: AuthContext) -> PortalPropertyList:
        ids = self._owned_property_ids(ctx)
        if not ids:
            return PortalPropertyList(items=[], total=0)
        rows = (
            self._db.table("properties")
            .select("id, title, city, photos")
            .in_("id", ids)
            .order("title")
            .execute()
        ).data or []
        items = [
            PortalProperty(
                id=str(r["id"]),
                title=r.get("title") or "",
                city=r.get("city"),
                photo=(r.get("photos") or [None])[0],
            )
            for r in rows
        ]
        return PortalPropertyList(items=items, total=len(items))

    # --- Objektbereich / Bilder / Fotoalbum / Statistik (lesend) -------------
    #
    # Die vier Flächen zu den Rechten pm_property_area,
    # pm_view_property_images, pm_photo_album und pm_nonrevenue_charts. Alle
    # rein lesend (§4.2) und alle OHNE Geldfeld: die Spalten sind darum
    # einzeln aufgezählt, nie `select("*")` — ein Stern zöge `deposit_amount`,
    # `total_amount` und die Rate-Daten mit herein, und niemand sähe es der
    # Zeile an.

    def property_detail(
        self, ctx: AuthContext, property_id: str
    ) -> PortalPropertyDetail:
        """Der Objektbereich EINES eigenen Objekts, lesend.

        Fremde/unbekannte ID → 404 (nicht 403): die Existenz fremder Objekte
        wird nicht verraten. Denselben Scope prüft die Liste `my_properties`
        (Wurzel 9).
        """
        tenant_id, _ = self._require(ctx)
        self._require_own(ctx, property_id)
        rows = (
            self._db.table("properties")
            .select(
                "id, title, description, property_type, category_slug, "
                "subtype_slug, listing_type, total_rooms, status, "
                "street, house_number, postal_code, city, country, lat, lng, "
                "timezone, max_guests, floors_total, floor_number, year_built, "
                "size_value, size_unit, bfe_number, amenities, room_amenities"
            )
            .eq("id", property_id)
            # Tenant-Filter zusätzlich zur Zuordnung: Load und Scope in
            # DERSELBEN Abfrage (Wurzel 3), damit kein späterer Umbau die
            # beiden trennt.
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise PortalError("Objekt nicht gefunden.", status_code=404)
        row = rows[0]
        log.info(
            "portal_objektbereich", user_id=ctx.user_id, property_id=property_id
        )
        return PortalPropertyDetail(
            id=str(row["id"]),
            title=row.get("title") or "",
            description=row.get("description"),
            property_type=row.get("property_type"),
            category_slug=row.get("category_slug"),
            subtype_slug=row.get("subtype_slug"),
            listing_type=row.get("listing_type"),
            total_rooms=row.get("total_rooms"),
            status=row.get("status"),
            street=row.get("street"),
            house_number=row.get("house_number"),
            postal_code=row.get("postal_code"),
            city=row.get("city"),
            country=row.get("country"),
            lat=row.get("lat"),
            lng=row.get("lng"),
            timezone=row.get("timezone"),
            max_guests=row.get("max_guests"),
            floors_total=row.get("floors_total"),
            floor_number=row.get("floor_number"),
            year_built=row.get("year_built"),
            size_value=row.get("size_value"),
            size_unit=row.get("size_unit"),
            bfe_number=row.get("bfe_number"),
            amenities=list(row.get("amenities") or []),
            room_amenities=list(row.get("room_amenities") or []),
            units_total=self._einheiten_zahl(property_id),
            cover_image_url=self._titelbild(property_id),
        )

    def _titelbild(self, property_id: str) -> str | None:
        """URL des Titelbilds oder None — nie ein Platzhalterbild (Wurzel 4)."""
        rows = (
            self._db.table("property_photos")
            .select("url, is_cover, sort_order")
            .eq("property_id", property_id)
            .order("is_cover", desc=True)
            .order("sort_order")
            .limit(1)
            .execute()
        ).data or []
        return str(rows[0]["url"]) if rows else None

    def property_images(
        self, ctx: AuthContext, property_id: str
    ) -> PortalImageList:
        """Die Bilder EINES eigenen Objekts (`property_photos`, 0061).

        `url` geht so hinaus, wie sie gespeichert ist: der Bucket
        `property-images` ist öffentlich (0062, damit anonyme Gäste die
        Buchungsstrecke laden können). Eine signierte URL wäre hier eine
        Erfindung ohne Gegenwert — sie liefe ab, während die Datei weiter
        öffentlich erreichbar bliebe.
        """
        self._require_own(ctx, property_id)
        rows = (
            self._db.table("property_photos")
            .select("id, property_id, url, sort_order, is_cover, caption, author")
            .eq("property_id", property_id)
            .order("sort_order")
            .limit(MAX_BILDER_JE_OBJEKT)
            .execute()
        ).data or []
        items = [self._bild(r) for r in rows]
        log.info(
            "portal_objektbilder",
            user_id=ctx.user_id,
            property_id=property_id,
            anzahl=len(items),
        )
        return PortalImageList(
            property_id=property_id, items=items, total=len(items)
        )

    def photo_album(self, ctx: AuthContext) -> PortalPhotoAlbum:
        """Die Bilder ALLER zugeordneten Objekte, je Objekt gruppiert."""
        ids = self._owned_property_ids(ctx)
        if not ids:
            return PortalPhotoAlbum(groups=[], total=0)
        # Titel UND Ort: zwei gleich benannte Häuser („Strandhus") sind im
        # Album sonst nicht auseinanderzuhalten.
        kopf: dict[str, tuple[str, str | None]] = {
            str(r["id"]): (r.get("title") or "", r.get("city"))
            for r in (
                self._db.table("properties")
                .select("id, title, city")
                .in_("id", ids)
                .order("title")
                .execute()
            ).data
            or []
        }
        rows = (
            self._db.table("property_photos")
            .select("id, property_id, url, sort_order, is_cover, caption, author")
            .in_("property_id", ids)
            .order("property_id")
            .order("sort_order")
            # Harte Obergrenze (Wurzel 8): ein Eigentümer mit vielen Objekten
            # zöge sonst eine unbegrenzte Liste. Sie ist so hoch angesetzt,
            # dass sie im Alltag nie greift.
            .limit(MAX_BILDER_JE_ALBUM)
            .execute()
        ).data or []
        je_objekt: dict[str, list[PortalImage]] = {pid: [] for pid in kopf}
        for r in rows:
            je_objekt.setdefault(str(r["property_id"]), []).append(self._bild(r))
        groups = [
            PortalAlbumGroup(
                property_id=pid,
                title=kopf.get(pid, ("", None))[0],
                city=kopf.get(pid, ("", None))[1],
                items=bilder,
                total=len(bilder),
            )
            # Reihenfolge über die Objekt-Titel, nicht über die Bild-Zeilen.
            for pid, bilder in sorted(
                je_objekt.items(), key=lambda kv: (kopf.get(kv[0], ("", None))[0], kv[0])
            )
        ]
        gesamt = sum(g.total for g in groups)
        log.info(
            "portal_fotoalbum",
            user_id=ctx.user_id,
            objekte=len(groups),
            bilder=gesamt,
        )
        return PortalPhotoAlbum(groups=groups, total=gesamt)

    @staticmethod
    def _bild(row: dict) -> PortalImage:
        caption = row.get("caption")
        return PortalImage(
            id=str(row["id"]),
            property_id=str(row["property_id"]),
            url=str(row["url"]),
            sort_order=int(row.get("sort_order") or 0),
            is_cover=bool(row.get("is_cover")),
            caption=caption if isinstance(caption, dict) else {},
            author=row.get("author"),
        )

    def statistics(
        self,
        ctx: AuthContext,
        property_id: str | None,
        date_from: date | None,
        date_to: date | None,
    ) -> PortalStatisticsResponse:
        """Nicht-Umsatz-Auswertung über die eigenen Objekte.

        Ohne Zeitraum: die letzten zwölf Monate. Die Spanne ist hart auf
        `MAX_STATISTIK_TAGE` gedeckelt (Wurzel 8) — ohne Deckel ließe sich mit
        einem Datumspaar über hundert Jahre eine Abfrage über den gesamten
        Bestand auslösen.

        KEIN GELDFELD: die Abfrage wählt die Betragsspalten gar nicht erst
        aus. Was nicht geladen wird, kann auch kein späterer Umbau versehentlich
        ausgeben.
        """
        tenant_id, _ = self._require(ctx)
        von, bis = self._statistik_zeitraum(date_from, date_to)
        if property_id:
            # Item-Pfad prüft denselben Scope wie der Listen-Pfad (Wurzel 9).
            self._require_own(ctx, property_id)
            ids = [property_id]
        else:
            ids = self._owned_property_ids(ctx)
        einheiten = self._einheiten_je_objekt(ids)
        units_total = sum(einheiten.values())
        capacity = units_total * ((bis - von).days + 1)
        rows: list[dict] = []
        if ids:
            rows = fetch_all_rows(
                self._db.table("reservations")
                .select(
                    # Nur, was die Auswertung braucht — keine Beträge, keine
                    # Währung, keine Gastdaten.
                    "id, property_id, check_in, check_out, channel, ota_name, "
                    "booked_at, is_owner_stay"
                )
                .eq("tenant_id", tenant_id)
                .in_("property_id", ids)
                .in_("status", ["confirmed", "completed"])
                # Überlappung mit dem Fenster: check_in <= bis UND
                # check_out > von (check_out ist der Abreisetag, keine Nacht).
                .lte("check_in", bis.isoformat())
                .gt("check_out", von.isoformat())
                .order("id")
            )
        log.info(
            "portal_statistik",
            user_id=ctx.user_id,
            property_id=property_id,
            objekte=len(ids),
            von=von.isoformat(),
            bis=bis.isoformat(),
            buchungen=len(rows),
        )
        return berechne_statistik(
            property_id=property_id,
            rows=rows,
            date_from=von,
            date_to=bis,
            capacity_unit_nights=capacity,
            units_total=units_total,
        )

    @staticmethod
    def _statistik_zeitraum(
        date_from: date | None, date_to: date | None
    ) -> tuple[date, date]:
        """Zeitraum prüfen und deckeln — 422 statt einer stillen Kürzung.

        Eine stillschweigend gekürzte Spanne wäre die schlimmere Antwort: die
        Oberfläche zeigte eine Auslastung, die zu einem anderen Zeitraum
        gehört als der, der darübersteht (Wurzel 4).
        """
        if (date_from is None) != (date_to is None):
            raise PortalError(
                "Zeitraum unvollständig: from und to gehören zusammen.",
                status_code=422,
            )
        if date_from is None or date_to is None:
            heute = date.today()
            return heute - timedelta(days=364), heute
        if date_to < date_from:
            raise PortalError(
                "Zeitraum ungültig: to liegt vor from.", status_code=422
            )
        if (date_to - date_from).days + 1 > MAX_STATISTIK_TAGE:
            raise PortalError(
                f"Zeitraum zu groß: höchstens {MAX_STATISTIK_TAGE} Tage.",
                status_code=422,
            )
        return date_from, date_to

    # --- Kalender (maskiert) -------------------------------------------------

    def calendar(  # noqa: PLR0914 — ein Kalendertag trägt viele Einzelwerte
        self, ctx: AuthContext, property_id: str, start: date, end: date
    ) -> PortalCalendarResponse:
        """Kalender des Eigentümers: Belegung, Gastvorname/Quelle und je
        belegter Nacht sein NETTO-Auszahlungsbetrag (Etappe B).

        Der Gast-Verkaufspreis (`price`) läuft weiter über die Maske und ist
        für einen Eigentümer None (§4.2). Der Auszahlungsbetrag ist etwas
        anderes: er ist SEIN Geld und darum kein Gastdatum — er hängt nicht an
        `mask.amounts`. Sonst bekäme ein Eigentümer entweder nie einen Betrag
        zu sehen (mask.amounts ist für ihn per Default False) oder — hätte man
        stattdessen `price` durchgereicht — den Bruttopreis des Gastes.

        FAMILIENZUGÄNGE (0389): Der Endpunkt hängt an VIEW_CALENDAR, nicht an
        VIEW_OWNER_REPORTS — ein Familienmitglied der Stufe 'nutzung' kommt
        also herein und SOLL das auch (es plant seine Nutzung). Der Payout
        gehört ihm aber nicht: Über ein Jahr summiert ist er exakt der
        Jahresumsatz, den `earnings` derselben Person mit 403 verweigert. Die
        Beträge werden deshalb hier einzeln unterdrückt statt den Endpunkt zu
        sperren — der Kalender bleibt sichtbar, das Geld nicht.
        """
        self._require_own(ctx, property_id)
        # Nicht `_require_berichte`: das würde 403 werfen und den Kalender
        # mitnehmen. Hier zählt nur, OB die Beträge mitgehen dürfen.
        zeigt_payout = self._darf_berichte(ctx)
        mask = load_guest_mask(self._db, ctx.user_id)
        avail = {
            r["date"]: r.get("status") or "open"
            for r in (
                self._db.table("availability")
                .select("date, status")
                .eq("property_id", property_id)
                .gte("date", start.isoformat())
                .lt("date", end.isoformat())
                .execute()
            ).data
            or []
        }
        prices: dict[str, float | None] = {}
        if mask.amounts:
            from src.features.pricing.resolver import PricingResolver

            resolver = PricingResolver(service_client=self._db)
            for day in resolver.effective_prices(property_id, start, end):
                prices[day.date.isoformat()] = day.price

        nacht_info = self._payout_je_nacht(ctx, property_id, start, end, mask)
        einheiten_gesamt = self._einheiten_zahl(property_id)

        days: list[PortalCalendarDay] = []
        cur = start
        while cur < end:
            iso = cur.isoformat()
            info = nacht_info.get(iso)
            belegungen = info.belegungen if info else []
            gast_belegung = next(
                (b for b in belegungen if not b.eigennutzung), None
            )
            days.append(
                PortalCalendarDay(
                    date=cur,
                    status=avail.get(iso, "open"),
                    # Gastpreis nur, wenn die Maske Beträge erlaubt (für den
                    # Eigentümer None — er sieht seinen Payout, nicht den Preis).
                    price=prices.get(iso) if mask.amounts else None,
                    # Ohne Berichte-Freigabe kein Betrag und keine Währung
                    # (0389). `None` heißt in dieser Fläche „keine Sicht" und
                    # wird als „—" gerendert — nie als 0 (Wurzel 4).
                    owner_payout_per_night=(
                        info.summe if info and zeigt_payout else None
                    ),
                    currency=info.currency if info and zeigt_payout else None,
                    owner_payout_unknown_reason=(
                        info.grund if info and zeigt_payout else None
                    ),
                    # Erster Gast/Quelle nur als Kurzform für die Monatszelle —
                    # die vollständige Liste steht in `bookings`.
                    #
                    # Bewusst die erste BEZAHLTE Belegung: eine Eigennutzung hat
                    # weder Gast noch Portal, und stünde sie vorn, verdeckte sie
                    # den Gastnamen einer gleichzeitig belegten Schwestereinheit
                    # (0265) mit einem leeren Feld.
                    guest_first_name=(
                        gast_belegung.gast if gast_belegung else None
                    ),
                    booking_source=(
                        gast_belegung.quelle if gast_belegung else None
                    ),
                    bookings=[
                        _buchung(b, zeigt_payout=zeigt_payout)
                        for b in belegungen
                    ],
                    units_booked=len(belegungen),
                    units_total=einheiten_gesamt,
                )
            )
            cur += timedelta(days=1)
        return PortalCalendarResponse(property_id=property_id, days=days)

    def _einheiten_zahl(self, property_id: str) -> int:
        """Wie viele Einheiten führt dieser Typ (0265)?

        Ohne eine einzige Zeile in `property_units` gilt der Typ als
        Ein-Einheiten-Objekt — das ist KEIN erfundener Ersatzwert, sondern das
        dokumentierte Datenmodell: „im Normalfall genau eine" (CLAUDE.md), und
        der ganze Altbestand vor 0265 hat gar keine Zeile.
        """
        return self._einheiten_je_objekt([property_id])[property_id]

    def _einheiten_je_objekt(self, property_ids: list[str]) -> dict[str, int]:
        """Einheitenzahl je Objekt in EINER Abfrage (0265).

        Dieselbe Regel wie `_einheiten_zahl` (keine Zeile = eine Einheit), nur
        für mehrere Objekte auf einmal — die Statistik braucht die Kapazität
        über alle zugeordneten Objekte und würde sonst je Objekt einzeln
        fragen. Eine Regel, zwei Schnitte; `_einheiten_zahl` ruft diese hier.
        """
        if not property_ids:
            return {}
        rows = (
            self._db.table("property_units")
            .select("id, property_id")
            .in_("property_id", property_ids)
            .execute()
        ).data or []
        gefunden: dict[str, int] = {}
        for row in rows:
            pid = str(row["property_id"])
            gefunden[pid] = gefunden.get(pid, 0) + 1
        return {pid: max(gefunden.get(pid, 0), 1) for pid in property_ids}

    def _payout_je_nacht(
        self,
        ctx: AuthContext,
        property_id: str,
        start: date,
        end: date,
        mask: GuestMask,
    ) -> dict[str, _NachtInfo]:
        """Je belegter Nacht im Fenster: Auszahlung, Gastvorname und Quelle.

        Die Provision und die Payout-Formel kommen aus dem GETEILTEN Helfer
        `owner_statements.common` — dieselbe Rechnung wie in der Abrechnung.
        Stünde sie hier noch einmal, zeigte der Kalender über kurz oder lang
        eine andere Zahl als das Statement über denselben Zeitraum.

        PROVISIONSQUELLE (0343, Umstieg Schritt 1): Vorrang hat der
        Abrechnungsvertrag `owner_billing_terms`, aufgelöst JE BUCHUNG mit dem
        Check-out als Stichtag. Erst wenn für diesen Tag kein Vertrag gilt,
        greifen die Altspalten. Der Stichtag darf nicht der angezeigte Monat
        und schon gar nicht `date.today()` sein: sonst zeigte derselbe Kalender
        je Aufrufzeitpunkt andere Zahlen, sobald ein Vertrag abgelöst wird.

        Wurzel 4: Fehlt eine Grundlage (Provision, Betrag, Nächte, Währung),
        wird kein Ersatzwert gesetzt — die Nacht bekommt `betrag=None` und den
        maschinenlesbaren Grund, damit die UI „nicht ausweisbar" zeigen kann
        statt einer erfundenen Null.

        MEHRERE EINHEITEN (0265): Es wird je Nacht eine LISTE gesammelt, keine
        einzelne Zeile. Zwei Buchungen am selben Objekt (verschiedene
        Einheiten) sind der Normalfall; die frühere `dict[datum] = eine Zeile`
        ließ die zweite die erste überschreiben, und der Payout der ersten war
        für die überlappenden Nächte verschwunden.
        """
        tenant_id, _ = self._require(ctx)
        # Nur Reservierungen, die das Fenster ÜBERLAPPEN: check_in < end und
        # check_out > start (check_out ist der Abreisetag, keine Nacht mehr).
        reservations = fetch_all_rows(
            self._db.table("reservations")
            .select(
                "id, property_id, unit_id, guest_id, channel, ota_name, "
                "check_in, check_out, status, total_amount, channel_fee, "
                # `ota_reservation_code` verbindet die Reservierung mit dem
                # Original-Payload (`channex_booking`), aus dem die vom Portal
                # WIRKLICH abgerechneten Gebühren kommen. `ota_commission` ist
                # der gemeldete Portal-Abzug, `payment_collect` entscheidet, ob
                # zusätzlich eine Zahlungsgebühr anfällt (0364).
                "currency, source_channex_booking_id, external_ref, ota_commission, "
                # `pets` entscheidet, ob die Haustiergebühr des Objekts anfiel.
                "payment_collect, pets, "
                # Eigennutzung des Eigentümers (0241): belegt die Nacht, bringt
                # aber keinen Umsatz. Muss je ZEILE bekannt sein, weil davon
                # abhängt, ob überhaupt gerechnet wird.
                "is_owner_stay"
            )
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            # Eigentümer-Aufenthalte werden MITGELADEN und weiter unten von der
            # Payout-Rechnung ausgenommen (`is_owner_stay` je Zeile).
            #
            # Vorher stand hier `.eq("is_owner_stay", False)`. Die Absicht war
            # richtig — eine Eigennutzung bringt keine Auszahlung (0241) —, die
            # Folge war es nicht: mit dem Payout verschwand die BELEGUNG. Der
            # Eigentümer bekam für seine eigene, genehmigte Sperre eine Nacht
            # mit `status='booked'`, aber `units_booked=0` und leerer
            # `bookings`-Liste; die Oberfläche zeichnet dort nichts und die
            # Sperre war unsichtbar (live 12.08.2026: FeWo *Stjerneskud*,
            # 29.08.–11.09., genehmigter Sperrantrag).
            #
            # Der Filter gehört an die RECHNUNG, nicht an die Belegung: was
            # Geld bringt, entscheidet `is_owner_stay` je Zeile, was den
            # Kalender belegt, ist jede aktive Reservierung.
            .in_("status", ["confirmed", "completed"])
            .lt("check_in", end.isoformat())
            .gt("check_out", start.isoformat())
            .order("id")
        )
        if not reservations:
            return {}
        provisionen = self._provision_map(tenant_id, property_id)
        vertraege = self._vertrag_je_buchung(
            tenant_id, property_id, reservations
        )
        namen = self._gast_namen(
            [str(r["guest_id"]) for r in reservations if r.get("guest_id")]
        )
        # Zusatzleistungen zählen in den Owner-Split (owner_statements
        # `_rental_rows`: `price = total_amount + addon_total`, und
        # `buchungs_payout` bekommt sie als dritten Summanden). Ohne sie hier
        # zeigte der Kalender eine ANDERE Zahl als die Abrechnung über
        # denselben Zeitraum — genau der Fehler, den der geteilte Helfer
        # verhindern soll. Sichtbar wird er erst, sobald ein Extra verkauft ist.
        addons = self._addon_summen([str(r["id"]) for r in reservations])
        kontext = self._gebuehren_kontext(tenant_id, property_id, reservations)
        portal_saetze = self._portal_saetze_je_buchung(
            tenant_id, property_id, reservations
        )
        out: dict[str, _NachtInfo] = {}
        for r in reservations:
            self._verteile(
                r,
                provisionen,
                vertraege,
                namen,
                addons,
                mask,
                start,
                end,
                out,
                kontext=kontext,
                portal_saetze=portal_saetze,
            )
        return out

    def _vertrag_je_buchung(
        self, tenant_id: str, property_id: str, reservations: list[dict]
    ) -> dict[str, Vertragsregeln]:
        """Den geltenden Abrechnungsvertrag JE BUCHUNG auflösen (0343).

        Der Stichtag ist der Check-out der jeweiligen Buchung — nicht der
        angezeigte Monat. Damit trägt jede Nacht den Satz, der zum Zeitpunkt
        ihres Aufenthalts vereinbart war; eine Vertragsablösung mitten im Jahr
        rechnet also nicht rückwirkend um. Buchungen mit demselben Check-out
        teilen sich die Auflösung, damit ein Monat nicht 30 gleiche Abfragen
        auslöst.

        Die Auflösung selbst (Objekt-Vertrag schlägt Eigentümer-Vertrag,
        halb offenes Intervall) liegt in `OwnerBillingService.vertrag_aufloesen`
        und wird NICHT hier kopiert — sie ist ausdrücklich als die Auflösung
        gebaut, „die die Rechenkette beim späteren Umstieg aufruft".

        Ein Objekt ohne Eigentümer-Datensatz hat keinen Vertrag; dann bleibt die
        Karte leer und der Aufrufer fällt auf die Altspalten zurück.
        """
        owner_id = self._owner_id_von_objekt(property_id)
        if not owner_id:
            return {}
        # Lokal importiert wie `PricingResolver`/`sperrantraege` in diesem Slice:
        # ein Modul-Import verschränkte zwei Slices dauerhaft, obwohl die
        # Auflösung nur auf diesem einen Pfad gebraucht wird.
        from src.features.owner_billing.service import (  # noqa: PLC0415
            OwnerBillingService,
        )

        billing = OwnerBillingService(service_client=self._db)
        je_stichtag: dict[str, Vertragsregeln | None] = {}
        out: dict[str, Vertragsregeln] = {}
        for r in reservations:
            checkout = _als_datum(r.get("check_out"))
            if checkout is None:
                continue
            schluessel = checkout.isoformat()
            if schluessel not in je_stichtag:
                zeile = billing.vertrag_aufloesen(
                    tenant_id, owner_id, property_id, checkout
                )
                try:
                    je_stichtag[schluessel] = (
                        vertragsregeln_aus_zeile(zeile) if zeile else None
                    )
                except PayoutUnbekannt as exc:
                    # Ein ungültiger Vertragssatz darf den Kalender nicht
                    # abreißen (wie beim ungültigen Altspalten-Satz): die
                    # betroffene Nacht bekommt später einen `grund`.
                    log.warning(
                        "portal_vertrag_ungueltig",
                        property_id=property_id,
                        stichtag=schluessel,
                        fehler=exc.message,
                    )
                    je_stichtag[schluessel] = None
            regeln = je_stichtag[schluessel]
            if regeln is not None:
                out[str(r["id"])] = regeln
        return out

    def _gebuehren_kontext(
        self, tenant_id: str, property_id: str, reservations: list[dict]
    ) -> _GebuehrenKontext:
        """Alles, was die Gebühren- und Portal-Rechnung je Buchung braucht.

        EINMAL geladen, nicht je Buchung: bei einem Monat mit 30 Tagen wären es
        sonst dutzende identische Abfragen. Drei Bestandteile:

        * die Zuordnungen (`fee_classification`) des Betriebs,
        * die Gebühren-Stammdaten des Objekts (`type_attributes`),
        * die Original-Payloads der OTA-Buchungen (`channex_booking.raw`) —
          denn dort stehen die Gebühren, die das Portal WIRKLICH abgerechnet
          hat (Airbnb: Reinigung mal 795, mal 1.075, mal 1.275 DKK bei
          identischen Stammdaten von 795).
        """
        objekt = (
            self._db.table("properties")
            .select("type_attributes")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        # `reservations.source_channex_booking_id` trägt Channex' EIGENE
        # Buchungs-ID (`channex_booking.channex_booking_id`), nicht unsere
        # Zeilen-ID — live geprüft: über `channex_booking_id` treffen alle 76
        # Feed-Buchungen, über `id` keine einzige.
        return _GebuehrenKontext(
            klassifikation=klassifikation_laden(self._db, tenant_id),
            type_attributes=(objekt[0].get("type_attributes") if objekt else None),
            payloads=payloads_laden(self._db, tenant_id, reservations),
            csv_muster=csv_muster_je_objekt(self._db, tenant_id, [property_id]).get(
                property_id
            ),
        )

    def _portal_saetze_je_buchung(
        self, tenant_id: str, property_id: str, reservations: list[dict]
    ) -> dict[str, dict[str, Any]]:
        """Den geltenden Portal-Abzugssatz je Buchung auflösen (0364).

        Stichtag ist der Check-out — dieselbe Zeitachse wie beim
        Abrechnungsvertrag. Buchungen mit gleichem (Kanal, Check-out) teilen
        sich die Auflösung.
        """
        from src.features.owner_billing.service import (  # noqa: PLC0415
            OwnerBillingService,
        )

        billing = OwnerBillingService(service_client=self._db)
        gecacht: dict[tuple[str, str], dict[str, Any] | None] = {}
        out: dict[str, dict[str, Any]] = {}
        for r in reservations:
            kanal = str(r.get("channel") or "").strip().lower()
            checkout = _als_datum(r.get("check_out"))
            if not kanal or checkout is None:
                continue
            schluessel = (kanal, checkout.isoformat())
            if schluessel not in gecacht:
                gecacht[schluessel] = billing.portal_satz_aufloesen(
                    tenant_id, kanal, property_id, checkout
                )
            satz = gecacht[schluessel]
            if satz is not None:
                out[str(r["id"])] = satz
        return out

    def _auszahlung_einer_buchung(
        self,
        r: dict,
        *,
        regeln: Vertragsregeln,
        addon_total: Decimal | None,
        kontext: _GebuehrenKontext,
        portal_saetze: dict[str, dict[str, Any]],
    ) -> Auszahlung:
        """Die volle Kette für EINE Buchung — der eine Weg für beide Ansichten.

        Kalender und Einnahmen-Übersicht riefen die Kette bis 11.08.2026 mit je
        eigenem Code auf; jede Abweichung darin wäre eine zweite Zahl für
        dasselbe Geld gewesen. Hier steht sie einmal.
        """
        naechte = self._nights(r.get("check_in"), r.get("check_out"))
        currency = (r.get("currency") or "").strip()
        befund = gebuehren_der_buchung(
            raw=kontext.payloads.get(
                str(r.get("source_channex_booking_id") or "")
            ),
            type_attributes=kontext.type_attributes,
            naechte=naechte,
            klassifikation=kontext.klassifikation,
            property_id=str(r["property_id"]),
            reservierung=r,
            csv_muster=kontext.csv_muster,
        )
        basis = befund.basisbetrag(r.get("total_amount"))
        satz = portal_saetze.get(str(r["id"])) or {}
        abzug = portal_abzug(
            kanal=r.get("channel"),
            # OHNE Zusatzleistungen: die kennt das Portal nicht (`portal_brutto`).
            brutto=portal_brutto(
                uebernachtung=basis,
                gebuehren=befund.gebuehren,
                gebuehren_im_betrag=befund.im_gesamtpreis,
            ),
            gemeldete_provision=r.get("ota_commission"),
            provision_pct=satz.get("provision_pct"),
            zahlungsgebuehr_pct=satz.get("zahlungsgebuehr_pct"),
            # Die Zahlungsgebühr ist das Entgelt für die GELDWEITERLEITUNG —
            # nur wenn das Portal einzieht, fällt sie an. Ein LEERES
            # `payment_collect` heißt dabei nicht „nein": siehe
            # `portal_zieht_ein`.
            zieht_portal_ein=portal_zieht_ein(
                r.get("channel"), r.get("payment_collect")
            ),
        )
        return auszahlung_berechnen(
            uebernachtung=basis,
            gebuehren=befund.gebuehren,
            gebuehren_im_betrag=befund.im_gesamtpreis,
            addon_total=addon_total,
            abzug=abzug,
            regeln=regeln,
            naechte=naechte,
            currency=currency,
        )

    def _owner_id_von_objekt(self, property_id: str) -> str | None:
        """Der Eigentümer dieses Objekts (genau einer, unique 0073)."""
        rows = (
            self._db.table("owner_properties")
            .select("owner_id")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        return str(rows[0]["owner_id"]) if rows else None

    def _addon_summen(self, reservation_ids: list[str]) -> dict[str, Decimal]:
        """Verkaufte Zusatzleistungen je Reservierung.

        DIESELBE Ableitung wie `OwnerStatementsService._addon_sums`: stornierte
        Positionen zählen nicht, alles andere summiert sich je Reservierung.
        Fehlt die Zeile ganz, gibt es schlicht keine Extras — das ist ein
        echter Zustand und kein Datenloch (`buchungs_payout` nimmt `None` als
        „keine Extras").
        """
        ids = sorted({r for r in reservation_ids if r})
        if not ids:
            return {}
        rows = fetch_all_rows(
            self._db.table("reservation_addons")
            .select("reservation_id, total, status")
            .in_("reservation_id", ids)
            .order("id")
        )
        summen: dict[str, Decimal] = {}
        for a in rows:
            if (a.get("status") or "pending") == "cancelled":
                continue
            rid = str(a["reservation_id"])
            summen[rid] = summen.get(rid, Decimal("0")) + (
                Decimal(str(a.get("total"))) if a.get("total") is not None
                else Decimal("0")
            )
        return summen

    def _verteile(  # noqa: PLR0913 — eine Buchung mit ihren Bezugsdaten
        self,
        r: dict,
        provisionen: dict[str, Decimal] | None,
        vertraege: dict[str, Vertragsregeln],
        namen: dict[str, str],
        addons: dict[str, Decimal],
        mask: GuestMask,
        start: date,
        end: date,
        out: dict[str, _NachtInfo],
        *,
        kontext: _GebuehrenKontext,
        portal_saetze: dict[str, dict[str, Any]],
    ) -> None:
        """Eine Reservierung auf ihre Nächte im Fenster verteilen."""
        check_in = _als_datum(r.get("check_in"))
        check_out = _als_datum(r.get("check_out"))
        # Gastname und Quelle laufen durch die BESTEHENDE Maske (Wurzel: keine
        # eigene Kürzung). Ein Eigentümer hat VIEW_GUEST_LIMITED und darum
        # weder VIEW_GUEST_NAME noch VIEW_BOOKING_SOURCE — `mask.name` gibt ihm
        # den Vornamen. Die Quelle liefern wir ihm bewusst dennoch: der Kanal
        # seiner eigenen Buchung ist Teil des Auszahlungsnachweises (welcher
        # Portal-Abzug entstand), kein Gast-PII.
        gast = mask.name(namen.get(str(r.get("guest_id"))))
        quelle = r.get("ota_name") or r.get("channel")
        grund: str | None = None
        betraege: list[Decimal] = []
        currency = (r.get("currency") or "").strip()
        # Eigennutzung (0241): der genehmigte Sperrantrag des Eigentümers. Sie
        # belegt die Nacht, bringt aber keinen Umsatz — es wird GAR NICHT
        # gerechnet. Der Unterschied zu „Betrag nicht ausweisbar" ist
        # wesentlich: dort fehlt eine Grundlage (Datenfehler), hier gibt es
        # nichts auszuzahlen. Darum bleibt `grund` None; ein Grund ließe die
        # Oberfläche „nicht ausweisbar" behaupten und den Eigentümer einen
        # Fehler suchen, den es nicht gibt (Wurzel 4).
        #
        # Gast und Quelle fallen ebenfalls weg: bei einer Eigennutzung gibt es
        # keinen Gast (`guest_id` ist NULL) und `channel='direct'` ist eine
        # technische Angabe, kein Buchungsportal — als Kanal-Logo gerendert
        # sähe die eigene Sperre wie eine Direktbuchung aus.
        eigennutzung = bool(r.get("is_owner_stay"))
        if eigennutzung:
            self._nacht_eintragen(
                r,
                start,
                end,
                out,
                betrag_je_nacht=[],
                currency=None,
                grund=None,
                gast=None,
                quelle=None,
                eigennutzung=True,
            )
            return
        try:
            # Vertrag (0343) schlägt Altspalten. Nur wenn für den Stichtag
            # dieser Buchung kein Vertrag gilt, muss überhaupt ein Altsatz da
            # sein — darum wird `_provision_pflicht` erst dann befragt und
            # wirft nicht mehr für Objekte, die längst einen Vertrag haben.
            regeln = vertraege.get(str(r["id"]))
            naechte = (check_out - check_in).days if check_in and check_out else 0
            if regeln is not None:
                # VOLLE Kette: Gebühren in den Gastpreis, Portal-Abzug,
                # provisionsfreie Gebühren aus der Bemessung und die des
                # Eigentümers zu 100 % zurück (0364). Derselbe Weg wie in der
                # Einnahmen-Übersicht — eine zweite Rechnung hier wäre eine
                # zweite Zahl für dasselbe Geld.
                ergebnis = self._auszahlung_einer_buchung(
                    r,
                    regeln=regeln,
                    addon_total=addons.get(str(r["id"])),
                    kontext=kontext,
                    portal_saetze=portal_saetze,
                )
                betraege = payout_je_nacht(ergebnis.netto, naechte)
            else:
                # Ohne Vertrag bleibt der Altweg: die Altspalten kennen weder
                # Gebühren-Zuordnung noch Portal-Sätze, also wäre jede
                # Gebührenrechnung darauf eine Erfindung.
                nacht_werte = naechte_payout_map(
                    total_amount=r.get("total_amount"),
                    channel_fee=r.get("channel_fee"),
                    addon_total=addons.get(str(r["id"])),
                    provision_pct=_provision_pflicht(
                        provisionen,
                        str(r["property_id"]),
                        # Gibt es den Eigentümer? Dann liegt es nicht an
                        # fehlenden Stammdaten, sondern daran, dass für den
                        # Aufenthalt kein Vertrag galt — die Meldung muss das
                        # unterscheiden, sonst sucht man an der falschen Stelle.
                        hat_eigentuemer=self._owner_id_von_objekt(
                            str(r["property_id"])
                        )
                        is not None,
                    ),
                    naechte=naechte,
                    currency=currency,
                )
                betraege = [n.payout for n in nacht_werte]
        except PayoutUnbekannt as exc:
            # Kein Ersatzwert (Wurzel 4) — der Grund wird ausgewiesen. Nicht
            # verschluckt: er steht im Log UND in der Antwort.
            grund = exc.grund
            log.info(
                "portal_payout_unbestimmt",
                reservation_id=str(r.get("id")),
                grund=exc.grund,
            )
        self._nacht_eintragen(
            r,
            start,
            end,
            out,
            betrag_je_nacht=betraege,
            currency=currency or None,
            grund=grund,
            gast=gast,
            quelle=quelle,
            eigennutzung=False,
        )

    @staticmethod
    def _nacht_eintragen(  # noqa: PLR0913 — eine Belegung mit ihren Anzeigedaten
        r: dict,
        start: date,
        end: date,
        out: dict[str, _NachtInfo],
        *,
        betrag_je_nacht: list[Decimal],
        currency: str | None,
        grund: str | None,
        gast: str | None,
        quelle: str | None,
        eigennutzung: bool,
    ) -> None:
        """Eine Buchung auf ihre Nächte im Fenster eintragen.

        EIN Weg für beide Arten (Wurzel 1): bezahlte Buchung und Eigennutzung
        landen über dieselbe Zuschnitt-Logik in der Nacht-Map. Ein zweiter,
        danebenstehender Loop für die Eigennutzung liefe beim ersten Zusatz
        auseinander — etwa wenn das Fenster-Zuschneiden sich ändert.

        `betrag_je_nacht` ist bei einer Eigennutzung leer: dort gibt es nichts
        zu verteilen, und jede Nacht bekommt `betrag=None` ohne `grund`.
        """
        check_in = _als_datum(r.get("check_in"))
        check_out = _als_datum(r.get("check_out"))
        if check_in is None or check_out is None:
            return
        # Nächte der Buchung auf das angefragte Fenster zuschneiden.
        cur = check_in
        index = 0
        while cur < check_out:
            if start <= cur < end:
                betrag = (
                    _money(betrag_je_nacht[index])
                    if betrag_je_nacht and index < len(betrag_je_nacht)
                    else None
                )
                # ANHÄNGEN, nicht ersetzen: mehrere Einheiten desselben Typs
                # können dieselbe Nacht belegen (0265). Ein `out[iso] = …`
                # verlöre hier den Payout der zuvor eingetragenen Einheit.
                info = out.setdefault(cur.isoformat(), _NachtInfo(belegungen=[]))
                info.belegungen.append(
                    _Belegung(
                        reservation_id=str(r["id"]),
                        unit_id=str(r["unit_id"]) if r.get("unit_id") else None,
                        betrag=betrag,
                        currency=currency,
                        grund=grund,
                        gast=gast,
                        quelle=quelle,
                        eigennutzung=eigennutzung,
                    )
                )
            cur += timedelta(days=1)
            index += 1

    def _provision_map_fuer(
        self, tenant_id: str, property_ids: list[str]
    ) -> dict[str, Decimal] | None:
        """Provisionssätze für MEHRERE Objekte (Einnahmen-Übersicht).

        Baut auf derselben Ableitung auf wie `_provision_map` — Objekt-Override
        vor Owner-Default —, nur über eine Liste. Objekte ohne gültigen Satz
        fehlen in der Map und führen beim Aufrufer zu `PayoutUnbekannt`, statt
        stillschweigend mit 0 % durchzugehen.
        """
        zusammen: dict[str, Decimal] = {}
        for pid in property_ids:
            teil = self._provision_map(tenant_id, pid)
            if teil:
                zusammen.update(teil)
        return zusammen or None

    def _provision_map(
        self, tenant_id: str, property_id: str
    ) -> dict[str, Decimal] | None:
        """Effektiver Provisionssatz des Objekts: Objekt-Override, sonst der
        Owner-Default — dieselbe Ableitung wie in der Abrechnung, hier über den
        geteilten Helfer.

        `None` heißt: zu diesem Objekt gibt es gar keinen Eigentümer-Datensatz.
        Dann ist die Auszahlung nicht bestimmbar (kein 0-%-Fallback).
        """
        zuordnung = (
            self._db.table("owner_properties")
            .select("owner_id, property_id, commission_override_pct")
            .eq("property_id", property_id)
            .execute()
        ).data or []
        if not zuordnung:
            return None
        owner_ids = sorted({str(z["owner_id"]) for z in zuordnung})
        besitzer = (
            self._db.table("owners")
            .select("id, default_commission_pct")
            .eq("tenant_id", tenant_id)
            .in_("id", owner_ids)
            .execute()
        ).data or []
        defaults = {
            str(o["id"]): o.get("default_commission_pct") for o in besitzer
        }
        out: dict[str, Decimal] = {}
        for z in zuordnung:
            owner_id = str(z["owner_id"])
            if owner_id not in defaults:
                continue  # fremder Mandant — nicht verwenden
            try:
                out[str(z["property_id"])] = effektive_provision_pct(
                    z.get("commission_override_pct"), defaults[owner_id]
                )
            except PayoutUnbekannt as exc:
                # Kein/ungültiger Satz: das Objekt bleibt aus der Map. Der
                # Fehler darf NICHT hier hochschlagen, sonst risse eine einzige
                # unvollständige Stammdatenzeile den ganzen Kalender ab (der
                # Eigentümer sähe nicht einmal mehr seine Belegung). Die
                # betroffene Nacht bekommt später einen `grund` — der Betrag
                # fehlt sichtbar, statt erfunden oder alles zu kippen.
                #
                # Ein UNGÜLTIGER Satz (120 %) ist dabei mehr als eine Lücke: er
                # wird geloggt, damit der Betrieb ihn korrigieren kann, statt
                # dass die Zelle nur wortlos leer bleibt.
                if exc.grund == "provision_ungueltig":
                    log.warning(
                        "portal_provision_ungueltig",
                        property_id=str(z["property_id"]),
                        fehler=exc.message,
                    )
                continue
        return out or None

    def _gast_namen(self, guest_ids: list[str]) -> dict[str, str]:
        ids = sorted({g for g in guest_ids if g})
        if not ids:
            return {}
        rows = (
            self._db.table("guests")
            .select("id, name")
            .in_("id", ids)
            .execute()
        ).data or []
        return {str(r["id"]): r.get("name") or "" for r in rows}

    # --- Earnings (maskiert) -------------------------------------------------

    def earnings(
        self, ctx: AuthContext, period_from: date, period_to: date
    ) -> PortalEarningsResponse:
        tenant_id, user_id = self._require(ctx)
        # Familienzugänge sehen Finanzen nur, wenn der Eigentümer sie
        # freigeschaltet hat (0389). Die Capability am Endpunkt genügt nicht:
        # ein Familienmitglied trägt die Rolle `owner` und bekommt sie darüber.
        self._require_berichte(ctx)
        mask = load_guest_mask(self._db, user_id)
        ids = self._owned_property_ids(ctx)
        currency = self._tenant_currency(tenant_id)
        if not ids:
            return PortalEarningsResponse(
                period_from=period_from,
                period_to=period_to,
                items=[],
                total_payout=0.0 if mask.amounts else None,
                currency=currency,
            )
        titles = {
            str(r["id"]): r.get("title") or ""
            for r in (
                self._db.table("properties")
                .select("id, title")
                .in_("id", ids)
                .execute()
            ).data
            or []
        }
        # Vollständig paginiert: die Einnahmen-Übersicht aggregiert payout/nights
        # über ALLE Reservierungen des Zeitraums. Ein stiller 1000-Zeilen-Cap würde
        # dem Owner im Portal zu niedrige Summen anzeigen.
        reservations = fetch_all_rows(
            self._db.table("reservations")
            # `currency` gehört dazu, seit der Vertrag (0343) Pauschale und
            # Mindestprovision in EIGENER Währung tragen kann: ohne die
            # Buchungswährung ist nicht prüfbar, ob sie zusammenpassen.
            .select(
                "id, property_id, check_in, check_out, total_amount, "
                "channel_fee, currency, channel, source_channex_booking_id, "
                "external_ref, ota_commission, payment_collect"
            )
            .eq("tenant_id", tenant_id)
            .in_("property_id", ids)
            .gte("check_in", period_from.isoformat())
            .lte("check_in", period_to.isoformat())
            .in_("status", ["confirmed", "completed"])
            # HIER gehört der Filter hin — anders als im Kalender (0241): die
            # Einnahmen-Übersicht zählt VERMIETUNG, und eine Eigennutzung ist
            # keine. Ohne ihn wurden Nächte und Buchungen des Eigentümers als
            # Vermietung ausgewiesen (live 12.08.2026: FeWo *Stjerneskud*
            # zeigte 50 Nächte / 6 Buchungen statt 36 / 5, weil 14 Nächte
            # Eigennutzung mitzählten). Die Auszahlungssumme blieb dabei
            # unauffällig, weil eine Eigennutzung `total_amount = 0` trägt —
            # die falsche Zahl stand in der Belegung, nicht im Geld.
            #
            # Der Kalender macht bewusst das Gegenteil und lädt sie MIT: dort
            # ist die Frage „was belegt diese Nacht?", hier „was hat vermietet
            # eingebracht?".
            .eq("is_owner_stay", False)
            .order("id")
        )

        # DIESELBE Rechnung wie Kalender und Abrechnung: Extras zählen mit, die
        # Provision wird abgezogen. Vorher stand hier `total_amount −
        # channel_fee` roh — also der Betrag VOR Provision und OHNE Extras. Das
        # war eine dritte Zahl für dasselbe Geld: die Einnahmen-Übersicht wies
        # dem Eigentümer mehr aus, als er je bekommt.
        addons = self._addon_summen([str(r["id"]) for r in reservations])
        provisionen = self._provision_map_fuer(tenant_id, ids)
        # Auch die Einnahmen-Übersicht folgt dem Vertrag (0343). Ohne das wäre
        # sie erneut eine dritte Zahl: der Kalender rechnete 20 % aus dem
        # Vertrag, diese Liste fiele auf die leere Altspalte zurück und zeigte
        # „—" — für denselben Zeitraum, dasselbe Geld.
        je_objekt = {
            pid: [r for r in reservations if str(r["property_id"]) == pid]
            for pid in ids
        }
        vertraege_je_objekt = {
            pid: self._vertrag_je_buchung(tenant_id, pid, zeilen)
            for pid, zeilen in je_objekt.items()
        }
        # Gebühren und Portal-Sätze ebenfalls je Objekt — dieselbe Kette wie im
        # Kalender. Ohne sie fehlten dem Gastpreis die Gebühren und dem
        # Eigentümer seine Nebenkosten, und die Übersicht wiche wieder von der
        # Kalenderansicht ab.
        kontext_je_objekt = {
            pid: self._gebuehren_kontext(tenant_id, pid, zeilen)
            for pid, zeilen in je_objekt.items()
        }
        portal_je_objekt = {
            pid: self._portal_saetze_je_buchung(tenant_id, pid, zeilen)
            for pid, zeilen in je_objekt.items()
        }

        # Hat das Objekt überhaupt einen Eigentümer? Einmal je Objekt statt je
        # Buchung — nur für die UNTERSCHEIDUNG der Fehlermeldung gebraucht
        # („keine Stammdaten" vs. „Vertrag gilt für diesen Zeitraum nicht").
        hat_eigentuemer_je_objekt = {
            pid: self._owner_id_von_objekt(pid) is not None for pid in ids
        }

        agg: dict[str, dict] = {
            pid: {
                "nights": 0,
                "reservations": 0,
                "payout": Decimal("0"),
                # Sobald EINE Buchung nicht ausweisbar ist, gibt es für dieses
                # Objekt keine Summe (Wurzel 4). Eine Teilsumme sähe aus wie
                # der volle Ertrag, wäre aber zu klein.
                "bestimmbar": True,
            }
            for pid in ids
        }
        for r in reservations:
            pid = str(r["property_id"])
            a = agg.setdefault(
                pid,
                {
                    "nights": 0,
                    "reservations": 0,
                    "payout": Decimal("0"),
                    "bestimmbar": True,
                },
            )
            a["nights"] += self._nights(r.get("check_in"), r.get("check_out"))
            a["reservations"] += 1
            try:
                regeln = vertraege_je_objekt.get(pid, {}).get(str(r["id"]))
                if regeln is not None:
                    a["payout"] += self._auszahlung_einer_buchung(
                        r,
                        regeln=regeln,
                        addon_total=addons.get(str(r["id"])),
                        kontext=kontext_je_objekt[pid],
                        portal_saetze=portal_je_objekt.get(pid, {}),
                    ).netto
                else:
                    a["payout"] += owner_payout(
                        buchungs_payout(
                            r.get("total_amount"),
                            r.get("channel_fee"),
                            addons.get(str(r["id"])),
                        ),
                        _provision_pflicht(
                            provisionen,
                            pid,
                            hat_eigentuemer=hat_eigentuemer_je_objekt.get(
                                pid, True
                            ),
                        ),
                    )
            except PayoutUnbekannt as exc:
                # Kein Ersatzwert: `total_amount or 0` hätte eine Buchung ohne
                # Betrag stillschweigend als 0-€-Buchung verbucht und die
                # Summe zu niedrig gemacht, ohne dass es jemand sieht.
                a["bestimmbar"] = False
                log.info(
                    "portal_earnings_unbestimmt",
                    reservation_id=str(r.get("id")),
                    grund=exc.grund,
                )

        items: list[PortalEarningsItem] = []
        total = Decimal("0")
        gesamt_bestimmbar = all(a["bestimmbar"] for a in agg.values())
        for pid, a in agg.items():
            total += a["payout"]
            items.append(
                PortalEarningsItem(
                    property_id=pid,
                    title=titles.get(pid, ""),
                    nights=a["nights"],
                    reservations=a["reservations"],
                    payout=(
                        _money(a["payout"])
                        if mask.amounts and a["bestimmbar"]
                        else None
                    ),
                    currency=currency,
                )
            )
        items.sort(key=lambda i: i.title)
        return PortalEarningsResponse(
            period_from=period_from,
            period_to=period_to,
            items=items,
            # Die Gesamtsumme fällt weg, sobald IRGENDEIN Objekt unbestimmbar
            # ist — sonst wäre sie die Summe über eine Lücke.
            total_payout=(
                _money(total) if mask.amounts and gesamt_bestimmbar else None
            ),
            currency=currency,
        )

    # --- Statements (eigene) -------------------------------------------------

    def my_statements(self, ctx: AuthContext) -> PortalStatementList:
        """Finalisierte Statements der Owner, die mit diesem Login verknüpft sind."""
        tenant_id, user_id = self._require(ctx)
        # Dieselbe Freigabe wie bei `earnings` (0389). Ein Familienmitglied
        # bekäme hier zwar ohnehin eine leere Liste (es hat keine Zeile in
        # `owners`), aber die Regel darf nicht von diesem Nebeneffekt abhängen:
        # ändert sich die Verknüpfung einmal, wäre die Sperre still weg.
        self._require_berichte(ctx)
        owner_ids = [
            str(r["id"])
            for r in (
                self._db.table("owners")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("user_id", user_id)
                .execute()
            ).data
            or []
        ]
        if not owner_ids:
            return PortalStatementList(items=[], total=0)
        rows = (
            self._db.table("owner_statements")
            .select(
                "id, period_from, period_to, status, owner_payout, currency, "
                "invoice_number, created_at"
            )
            .eq("tenant_id", tenant_id)
            .in_("owner_id", owner_ids)
            .eq("status", "finalized")
            .order("created_at", desc=True)
            .execute()
        ).data or []
        items = [self._statement_item(r) for r in rows]
        return PortalStatementList(items=items, total=len(items))

    @staticmethod
    def _statement_item(r: dict) -> PortalStatementItem:
        """Eine finalisierte Abrechnung für die Portal-Liste.

        Wurzel 4: Die Währung kommt AUS DER ZEILE. Hier stand ein
        `or "EUR"` — bei einer Abrechnung ohne Währung wäre dem Eigentümer ein
        dänischer oder polnischer Betrag als Euro ausgewiesen worden. Fehlt
        sie, ist das ein Datenfehler (eine finalisierte Abrechnung ohne
        Währung darf es nicht geben) → 422, wie `_tenant_currency` es im
        selben Modul schon macht.
        """
        currency = (r.get("currency") or "").strip()
        if not currency:
            raise PortalError(
                f"Abrechnung {r['id']} hat keine Währung — Betrag nicht "
                "ausweisbar.",
                status_code=422,
            )
        return PortalStatementItem(
            id=str(r["id"]),
            period_from=date.fromisoformat(r["period_from"]),
            period_to=date.fromisoformat(r["period_to"]),
            status=r.get("status") or "finalized",
            # Auch der BETRAG kommt aus der Zeile, ohne Ausweichwert: eine
            # finalisierte Abrechnung ohne `owner_payout` als „0,00" zu zeigen
            # hieße, dem Eigentümer eine Auszahlung von null auszuweisen, wo in
            # Wahrheit die Zahl fehlt (Wurzel 4). Das ist derselbe Datenfehler
            # wie die fehlende Währung darüber → 422.
            owner_payout=_money(_pflicht_betrag(r, "owner_payout")),
            currency=currency,
            invoice_number=r.get("invoice_number"),
            created_at=str(r["created_at"]) if r.get("created_at") else None,
        )

    # --- Sperrung beantragen -------------------------------------------------

    def request_block(
        self, ctx: AuthContext, req: BlockRequestCreate
    ) -> BlockRequestItem:
        tenant_id, user_id = self._require(ctx)
        self._require_own(ctx, req.property_id)
        if req.end_date < req.start_date:
            raise PortalError("Enddatum vor Startdatum.", status_code=400)
        unit_id = self._require_own_unit(tenant_id, req.property_id, req.unit_id)
        # Bestellte Leistungen (0510) VOR dem Insert prüfen: eine Regel-ID aus
        # einem fremden Mandanten würde sonst am Antrag hängen und bei der
        # Genehmigung zur Aufgabe (Wurzel 3).
        bestellbar = self._geprueft_bestellbar(
            tenant_id, req.property_id, req.bestellte_leistungen
        )
        # Stufe 1 (0389): Stellt ein FAMILIENMITGLIED den Antrag, wartet er
        # zuerst auf den Eigentümer und ist für die Agentur unsichtbar. Der
        # Eigentümer selbst hat keine Familien-Zeile → 'nicht_noetig', sein
        # Antrag geht wie bisher direkt an die Agentur (sich selbst zu
        # genehmigen wäre ein Klick ohne Erkenntniswert).
        freigabe, owner_user_id = freigabe_stufe(
            self._db, tenant_id, user_id, req.property_id
        )
        res = (
            self._db.table("block_requests")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": req.property_id,
                    # Die gewünschte Einheit (0353). NULL = das ganze Objekt.
                    "unit_id": unit_id,
                    "requested_by": user_id,
                    "start_date": req.start_date.isoformat(),
                    "end_date": req.end_date.isoformat(),
                    "status": "pending",
                    # Begründung des Eigentümers (0332) — ohne sie muss die
                    # Agentur raten, warum gesperrt werden soll.
                    "reason": req.reason,
                    # Der Eigentümer erklärt damit, den Vermarktungsvertrag
                    # beenden zu wollen (0377). Es ist SEINE Erklärung — die
                    # Agentur entscheidet beim Genehmigen, ob und zu welchem
                    # Datum sie wirksam wird, und trägt ihre eigene Wertung in
                    # `als_kuendigung_gewertet`.
                    "ist_kuendigung": req.ist_kuendigung,
                    "owner_freigabe": freigabe,
                }
            )
            .execute()
        )
        if not res.data:
            raise PortalError("Antrag konnte nicht angelegt werden.", status_code=500)
        # Bestellung NACH dem Antrag, weil sie seine ID braucht. Die Regeln
        # selbst sind VOR dem Insert geprüft (`_geprueft_bestellbar` oben) —
        # ein Antrag mit einer Fremd-Regel darf gar nicht erst entstehen.
        self._bestellung_schreiben(str(res.data[0]["id"]), bestellbar)
        log.info(
            "portal_block_requested",
            tenant_id=tenant_id,
            property_id=req.property_id,
            owner_freigabe=freigabe,
        )
        if freigabe == "offen":
            # Der Antrag wartet auf die Familie — die Agentur bekommt ihn erst
            # nach der Freigabe zu sehen, also auch erst dann eine Meldung.
            # Stattdessen wird der EIGENTÜMER benachrichtigt.
            melde_freigabe_noetig(
                self._db, tenant_id, owner_user_id, res.data[0]
            )
        else:
            self._melde_antrag(tenant_id, res.data[0])
        # Die eben geschriebene Bestellung mitgeben — die Oberfläche zeigt nach
        # dem Absenden, was bestellt wurde, ohne den Antrag neu zu laden.
        return _block(
            res.data[0],
            bestellungen_laden(
                self._db,
                [str(res.data[0]["id"])],
                lesersprache(self._db, user_id, tenant_id),
            ).get(str(res.data[0]["id"])),
        )

    def bestellbare_leistungen(
        self, ctx: AuthContext, property_id: str
    ) -> BestellbareLeistungen:
        """Welche Leistungen der Eigentümer zu diesem Objekt bestellen kann.

        Ohne diesen Weg könnte er nichts ankreuzen — die Auswahl im Portal muss
        aus den ECHTEN Regeln des Betriebs kommen, nicht aus einer zweiten,
        hartkodierten Liste, die neben ihr herliefe.

        Wurzel 3/9: derselbe Objekt-Scope wie beim Antrag selbst
        (`_require_own`). Wer die Regeln eines Objekts nicht sehen darf, für das
        er keinen Antrag stellen darf, darf sie auch nicht auflisten.
        """
        tenant_id, _ = self._require(ctx)
        self._require_own(ctx, property_id)
        rules = (
            self._db.table("task_rules")
            .select("id, name")
            .eq("tenant_id", tenant_id)
            .eq("kind", "auto")
            .eq("active", True)
            .order("name")
            .execute()
        ).data or []
        if not rules:
            return BestellbareLeistungen(items=[])

        # Objekt-Zuordnung: eine Regel OHNE Zeile gilt für alle Objekte —
        # genauso liest sie die Engine (`engine.sync_for_reservation`). Wer das
        # hier anders auslegte, böte eine Leistung an, die zu dieser Sperre nie
        # eine Aufgabe ergäbe.
        zuordnungen = (
            self._db.table("task_rule_assignments")
            .select("rule_id, property_id")
            .in_("rule_id", [str(r["id"]) for r in rules])
            .execute()
        ).data or []
        je_regel: dict[str, set[str]] = {}
        for z in zuordnungen:
            je_regel.setdefault(str(z["rule_id"]), set()).add(str(z["property_id"]))

        passend = [
            r
            for r in rules
            if str(r["id"]) not in je_regel
            or property_id in je_regel[str(r["id"])]
        ]
        # 0511: Der Regelname ist ein Freitext in EINER Sprache. Eine deutsche
        # Agentur, die daenische Eigentuemer betreut (live: derselbe Betrieb
        # fuehrt „Anreisecheck" und „Reng T" nebeneinander), zeigte ihm sonst
        # ein Kuerzel, das er nicht lesen kann — und er soll hier eine Leistung
        # bestellen, die er bezahlt. Fehlt eine Fassung, bleibt der
        # Originalname: das ist die ehrliche Auskunft, kein Ersatzwert.
        sprache = lesersprache(self._db, ctx.user_id, tenant_id)
        fassungen = namen_in_sprache(
            self._db, [str(r["id"]) for r in passend], sprache
        )
        return BestellbareLeistungen(
            items=[
                BestellteLeistung(
                    rule_id=str(r["id"]),
                    name=fassungen.get(str(r["id"])) or str(r.get("name") or ""),
                )
                for r in passend
            ]
        )

    def _eigener_antrag(self, ctx: AuthContext, antrag_id: str) -> dict:
        """Den Antrag laden — und zwar NUR einen eigenen (Wurzel 3/9).

        Load und Scope in DERSELBEN Abfrage: `requested_by` ist der Filter, nicht
        eine Pruefung danach. Der Item-Pfad darf nicht mehr hergeben als der
        List-Pfad (`list_block_requests` filtert genauso) — sonst liesse sich
        ueber eine geratene ID der Antrag eines anderen Eigentuemers desselben
        Mandanten lesen und zurueckziehen.
        """
        tenant_id, user_id = self._require(ctx)
        rows = (
            self._db.table("block_requests")
            .select(
                "id, tenant_id, property_id, status, requested_by, "
                "aufhebung, aufhebung_beantragt_am"
            )
            .eq("id", antrag_id)
            .eq("tenant_id", tenant_id)
            .eq("requested_by", user_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise PortalError("Antrag nicht gefunden.", status_code=404)
        return rows[0]

    def zurueckziehen(self, ctx: AuthContext, antrag_id: str) -> None:
        """Einen NOCH OFFENEN Antrag zuruecknehmen (0513).

        Es ist nichts gesperrt, solange nichts genehmigt ist — es gibt also
        keinen Gegenzustand zu pflegen (Wurzel 1 greift hier nicht). Der
        Eigentuemer nimmt seine eigene Erklaerung zurueck, die Agentur muss
        dafuer nichts tun.

        GELOESCHT, nicht auf 'rejected' gesetzt: 'rejected' heisst „die Agentur
        hat abgelehnt" und stuende in ihrer Historie als ihre Entscheidung. Ein
        zurueckgezogener Antrag ist keine Ablehnung — ihn so zu fuehren waere
        eine Falschaussage ueber die Agentur.

        Der Statusfilter im DELETE ist der Idempotenz-Riegel (Wurzel 2): kommt
        der Klick doppelt oder wurde in der Zwischenzeit genehmigt, trifft das
        DELETE nichts, und der Aufrufer bekommt 409 statt einer stillen
        Loeschung eines inzwischen wirksamen Antrags.
        """
        antrag = self._eigener_antrag(ctx, antrag_id)
        if str(antrag.get("status")) != "pending":
            raise PortalError(
                "Dieser Antrag ist bereits entschieden. Eine genehmigte "
                "Sperrung koennen Sie zur Aufhebung vorschlagen.",
                status_code=409,
            )
        res = (
            self._db.table("block_requests")
            .delete()
            .eq("id", antrag_id)
            .eq("tenant_id", str(antrag["tenant_id"]))
            .eq("status", "pending")
            .execute()
        )
        if not res.data:
            raise PortalError(
                "Der Antrag wurde inzwischen entschieden.", status_code=409
            )
        log.info(
            "portal_block_zurueckgezogen",
            tenant_id=str(antrag["tenant_id"]),
            antrag_id=antrag_id,
        )

    def aufhebung_beantragen(
        self, ctx: AuthContext, antrag_id: str, grund: str | None
    ) -> BlockRequestItem:
        """Die Aufhebung einer GENEHMIGTEN Sperrung beantragen (0513).

        Hier haengt eine Reservierung samt Kalenderbelegung und Portal-Push
        daran — der Eigentuemer kann sie nicht selbst aufloesen (§4.2: er
        beantragt, er entscheidet nicht). Die Sperre besteht deshalb WEITER,
        bis die Agentur zustimmt; `status` bleibt unangetastet auf 'approved'.

        Der bedingte UPDATE ist Compare-and-Set (Wurzel 2): ein zweiter Klick
        trifft die Zeile nicht mehr auf `aufhebung='keine'` und bekommt 409,
        statt den Beantragungszeitpunkt zu ueberschreiben.
        """
        antrag = self._eigener_antrag(ctx, antrag_id)
        if str(antrag.get("status")) != "approved":
            raise PortalError(
                "Nur eine genehmigte Sperrung kann aufgehoben werden.",
                status_code=409,
            )
        if str(antrag.get("aufhebung") or "keine") != "keine":
            raise PortalError(
                "Zu dieser Sperrung liegt bereits ein Aufhebungswunsch vor.",
                status_code=409,
            )
        res = (
            self._db.table("block_requests")
            .update(
                {
                    "aufhebung": "beantragt",
                    "aufhebung_grund": (grund or "").strip() or None,
                    # Unsere Uhr ist hier richtig: die Handlung passiert in
                    # diesem System (Wurzel 5b greift nicht).
                    "aufhebung_beantragt_am": datetime.now(UTC).isoformat(),
                }
            )
            .eq("id", antrag_id)
            .eq("tenant_id", str(antrag["tenant_id"]))
            .eq("aufhebung", "keine")
            .execute()
        ).data
        if not res:
            raise PortalError(
                "Zu dieser Sperrung liegt bereits ein Aufhebungswunsch vor.",
                status_code=409,
            )
        log.info(
            "portal_aufhebung_beantragt",
            tenant_id=str(antrag["tenant_id"]),
            antrag_id=antrag_id,
        )
        self._melde_aufhebung(str(antrag["tenant_id"]), res[0])
        return _block(res[0])

    def _geprueft_bestellbar(
        self, tenant_id: str, property_id: str, rule_ids: list[str]
    ) -> list[str]:
        """Die bestellten Regeln gehören DIESEM Mandanten und diesem Objekt.

        Wurzel 3: Der Service läuft mit dem Service-Role-Key und umgeht RLS.
        Eine ungeprüft übernommene `rule_id` hinge am Antrag und würde bei der
        Genehmigung zur Aufgabe — über eine geratene UUID ließe sich die Regel
        eines FREMDEN Betriebs auslösen.

        Drei Bedingungen, alle serverseitig:
          * die Regel gehört dem Mandanten (`tenant_id`),
          * sie ist planmäßig und aktiv (`kind='auto'`, `active`) — eine
            Vorlage oder eine abgeschaltete Regel zu bestellen ergäbe eine
            Aufgabe, die es im normalen Betrieb nicht gibt,
          * sie gilt für DIESES Objekt: entweder ohne Objekt-Zuordnung (gilt
            für alle) oder mit einer Zuordnung, die dieses Objekt nennt.

        Die dritte ist die, die man vergisst: sonst bestellte ein Eigentümer
        die Reinigungsregel, die für ein ganz anderes Objekt gepflegt ist, und
        bekäme eine Aufgabe mit fremden Zeiten und fremdem Zuständigen.

        Unbekannte oder unpassende IDs sind ein Fehler, kein stilles Weglassen
        (Wurzel 4/5): der Eigentümer hat etwas bestellt und bekäme sonst
        wortlos weniger, als er angekreuzt hat.
        """
        gewuenscht = list(dict.fromkeys(str(r) for r in rule_ids if r))
        if not gewuenscht:
            return []

        rules = (
            self._db.table("task_rules")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("kind", "auto")
            .eq("active", True)
            .in_("id", gewuenscht)
            .execute()
        ).data or []
        erlaubt = {str(r["id"]) for r in rules}

        # Objekt-Zuordnung: eine Regel OHNE Zeile gilt für alle Objekte (so
        # liest sie auch die Engine, `engine.sync_for_reservation`). Nur wer
        # eine Zuordnung hat, muss dieses Objekt darunter haben.
        zuordnungen: list[dict] = []
        if erlaubt:
            zuordnungen = (
                self._db.table("task_rule_assignments")
                .select("rule_id, property_id")
                .in_("rule_id", list(erlaubt))
                .execute()
            ).data or []
        je_regel: dict[str, set[str]] = {}
        for z in zuordnungen:
            je_regel.setdefault(str(z["rule_id"]), set()).add(str(z["property_id"]))
        erlaubt = {
            rid
            for rid in erlaubt
            if rid not in je_regel or property_id in je_regel[rid]
        }

        unbekannt = [rid for rid in gewuenscht if rid not in erlaubt]
        if unbekannt:
            raise PortalError(
                "Eine bestellte Leistung gibt es für dieses Objekt nicht.",
                status_code=422,
            )
        return gewuenscht

    def _bestellung_schreiben(
        self, block_request_id: str, rule_ids: list[str]
    ) -> None:
        """Die geprüften Bestellungen an den Antrag hängen.

        `on_conflict` über den UNIQUE aus 0510: ein Doppelklick oder ein Retry
        wiederholt den Insert, und zwei gleiche Zeilen wären zwei Aufgaben
        (Wurzel 2).
        """
        if not rule_ids:
            return
        self._db.table("block_request_services").upsert(
            [
                {"block_request_id": block_request_id, "rule_id": rid}
                for rid in rule_ids
            ],
            on_conflict="block_request_id,rule_id",
        ).execute()

    def _require_own_unit(
        self, tenant_id: str, property_id: str, unit_id: str | None
    ) -> str | None:
        """Die gewünschte Einheit gehört zu DIESEM Objekt und Mandanten.

        Wurzel 3: Der Service läuft mit dem Service-Role-Key und umgeht RLS.
        Eine ungeprüft übernommene `unit_id` landete im Antrag und würde bei der
        Genehmigung zur Belegung — über eine geratene UUID ließe sich damit die
        Einheit eines FREMDEN Objekts beantragen. Beide Filter in DERSELBEN
        Abfrage, damit Load und Scope nicht auseinanderfallen (Wurzel 9: der
        Item-Scope ist derselbe wie der des Objekts eine Zeile darüber).

        `None` bleibt `None`: keine Angabe heißt „das ganze Objekt".
        """
        if not unit_id:
            return None
        rows = (
            self._db.table("property_units")
            .select("id")
            .eq("id", unit_id)
            .eq("property_id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise PortalError(
                "Einheit gehört nicht zu diesem Objekt.", status_code=422
            )
        return unit_id

    def _melde_antrag(self, tenant_id: str, antrag: dict) -> None:
        """Die Entscheider der Agentur über den neuen Antrag informieren.

        Über den EINEN Dispatcher (kein eigener Mail-/SMS-Aufruf) und
        best-effort: der Antrag ist gespeichert und darf nicht verloren gehen,
        weil der Versand klemmt (Wurzel 5). Der Empfängerkreis (Capability
        APPROVE_BLOCK) liegt im calendar-Slice, weil er dieselbe Frage
        beantwortet wie der Guard am Entscheidungs-Endpunkt.
        """
        property_id = str(antrag["property_id"])
        rows = (
            self._db.table("properties")
            .select("title")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        titel = (rows[0].get("title") if rows else None) or property_id[:8]
        from src.features.calendar.sperrantrag_meldung import (  # noqa: PLC0415
            melde_neuen_antrag,
        )

        melde_neuen_antrag(self._db, tenant_id, antrag, titel)

    def _melde_aufhebung(self, tenant_id: str, antrag: dict) -> None:
        """Die Entscheider ueber den Aufhebungswunsch informieren (0513).

        Dieselbe Bauform wie `_melde_antrag`: EIN Dispatcher, best-effort. Der
        Wunsch ist gespeichert und darf nicht verloren gehen, weil der Versand
        klemmt (Wurzel 5).
        """
        property_id = str(antrag["property_id"])
        rows = (
            self._db.table("properties")
            .select("title")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        titel = (rows[0].get("title") if rows else None) or property_id[:8]
        from src.features.calendar.sperrantrag_meldung import (  # noqa: PLC0415
            melde_aufhebungswunsch,
        )

        melde_aufhebungswunsch(self._db, tenant_id, antrag, titel)

    def my_block_requests(self, ctx: AuthContext) -> BlockRequestList:
        tenant_id, user_id = self._require(ctx)
        rows = (
            self._db.table("block_requests")
            .select(
                "id, property_id, unit_id, start_date, end_date, status, "
                "reason, decided_at, decision_note, created_at, "
                # Vertragskündigung (0377) — der Eigentümer sieht, dass sein
                # Antrag als Kündigung geführt wird und zu welchem Datum.
                "ist_kuendigung, als_kuendigung_gewertet, "
                "vertragsende_gesetzt_auf, "
                # Stufe 1 (0389) — wo der Antrag gerade liegt.
                "owner_freigabe, owner_decision_note, "
                # Aufhebung (0513) — der Eigentuemer muss sehen, dass sein
                # Wunsch angekommen ist und was daraus wurde. Ohne diese Felder
                # klickt er ein zweites Mal, weil sich nichts sichtbar aendert.
                "aufhebung, aufhebung_grund, aufhebung_entscheidungsnotiz"
            )
            .eq("tenant_id", tenant_id)
            # Wurzel 3/9: der Eigentümer sieht NUR seine eigenen Anträge, nicht
            # die anderer Eigentümer desselben Mandanten.
            .eq("requested_by", user_id)
            .order("created_at", desc=True)
            .execute()
        ).data or []
        # 0510: einmal für die ganze Seite, nicht je Zeile. 0511: in der
        # Sprache des Lesers.
        bestellt = bestellungen_laden(
            self._db,
            [str(r["id"]) for r in rows],
            lesersprache(self._db, user_id, tenant_id),
        )
        return BlockRequestList(
            items=[_block(r, bestellt.get(str(r["id"]))) for r in rows],
            total=len(rows),
        )

    # --- Zählerstände --------------------------------------------------------

    def add_meter_reading(
        self, ctx: AuthContext, req: MeterReadingCreate
    ) -> MeterReadingItem:
        tenant_id, user_id = self._require(ctx)
        self._require_own(ctx, req.property_id)
        res = (
            self._db.table("meter_readings")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": req.property_id,
                    "meter_kind": req.meter_kind,
                    "value": req.value,
                    "read_at": req.read_at.isoformat(),
                    "created_by": user_id,
                }
            )
            .execute()
        )
        if not res.data:
            raise PortalError(
                "Zählerstand konnte nicht angelegt werden.", status_code=500
            )
        log.info(
            "portal_meter_reading_added",
            tenant_id=tenant_id,
            property_id=req.property_id,
        )
        return _meter(res.data[0])

    def meter_readings(self, ctx: AuthContext, property_id: str) -> MeterReadingList:
        self._require_own(ctx, property_id)
        rows = (
            self._db.table("meter_readings")
            .select("id, property_id, meter_kind, value, read_at, created_at")
            .eq("property_id", property_id)
            .order("read_at", desc=True)
            .execute()
        ).data or []
        return MeterReadingList(items=[_meter(r) for r in rows], total=len(rows))

    # --- Helfer --------------------------------------------------------------

    @staticmethod
    def _nights(check_in: str | None, check_out: str | None) -> int:
        try:
            return max(
                (date.fromisoformat(check_out) - date.fromisoformat(check_in)).days, 0
            )
        except (ValueError, TypeError):
            return 0

    def _tenant_currency(self, tenant_id: str) -> str:
        """Mandantenwährung für die Owner-Portal-Einnahmen. Fehlt sie, ist das
        ein Datenfehler → fail-closed (422), kein erfundenes EUR (Wurzel 4):
        diese Währung speist echte Geldbeträge (earnings/payout)."""
        rows = (
            self._db.table("tenants")
            .select("currency")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        currency = (rows[0].get("currency") if rows else None) or ""
        if not currency.strip():
            raise PortalError(
                "Keine Währung für den Mandanten hinterlegt.", status_code=422
            )
        return currency


def _pflicht_betrag(r: dict, spalte: str) -> Decimal:
    """Ein Geldbetrag, der DA SEIN MUSS. Fehlt er, ist das ein Datenfehler.

    Der Unterschied zu `or 0`: eine fehlende Zahl und eine Null sind zwei
    verschiedene Aussagen. „Deine Auszahlung ist 0,00 €" ist eine Behauptung,
    „hier fehlt ein Wert" ist die Wahrheit — und nur die zweite fällt jemandem
    auf, bevor der Eigentümer sich wundert (Wurzel 4).
    """
    wert = r.get(spalte)
    if wert is None:
        raise PortalError(
            f"Abrechnung {r.get('id')} hat keinen Wert für {spalte} — Betrag "
            "nicht ausweisbar.",
            status_code=422,
        )
    return Decimal(str(wert))


def _buchung(b: _Belegung, *, zeigt_payout: bool = True) -> PortalNightBooking:
    """Interne Belegung → Antwortmodell. Nichts wird ergänzt oder ersetzt.

    `zeigt_payout=False` für Familienzugänge ohne Berichte-Freigabe (0389):
    Die Beträge je Buchung sind dieselbe Information wie die Tagessumme eine
    Ebene höher — würde nur dort unterdrückt, stünde das Geld hier weiter drin.
    """
    return PortalNightBooking(
        reservation_id=b.reservation_id,
        unit_id=b.unit_id,
        owner_payout_per_night=b.betrag if zeigt_payout else None,
        currency=b.currency if zeigt_payout else None,
        payout_unknown_reason=b.grund if zeigt_payout else None,
        guest_first_name=b.gast,
        booking_source=b.quelle,
        is_owner_stay=b.eigennutzung,
    )


def bestellungen_laden(
    db: Client, antrags_ids: list[str], sprache: str | None = None
) -> dict[str, list[BestellteLeistung]]:
    """Je Antrag die bestellten Leistungen mit dem NAMEN ihrer Regel (0510).

    Gebündelt für die ganze Liste, nicht je Zeile: eine Abfrage je Antrag wären
    bei 40 Anträgen 80 Roundtrips (Bestellung + Regelname).

    Der Name wird MITGELADEN statt nachgeschlagen, weil die Oberfläche sonst
    eine UUID anzeigen müsste — oder die Regelliste separat holen, die ein
    Eigentümer gar nicht sehen darf (§4.3).
    """
    if not antrags_ids:
        return {}
    zeilen = (
        db.table("block_request_services")
        .select("block_request_id, rule_id, status, entscheidungsnotiz")
        .in_("block_request_id", antrags_ids)
        .execute()
    ).data or []
    if not zeilen:
        return {}

    rule_ids = list({str(z["rule_id"]) for z in zeilen})
    namen = {
        str(r["id"]): str(r.get("name") or "")
        for r in (
            db.table("task_rules")
            .select("id, name")
            .in_("id", rule_ids)
            .execute()
        ).data
        or []
    }
    # 0511: dieselbe Fassung wie in der Bestellliste. Stuende hier der
    # Originalname, haette der Eigentuemer „Slutrengoering" angekreuzt und
    # danach „Reng J" in seiner Antragsliste — dieselbe Leistung unter zwei
    # Namen ist schlimmer als ein Kuerzel.
    if sprache:
        namen.update(namen_in_sprache(db, rule_ids, sprache))
    out: dict[str, list[BestellteLeistung]] = {}
    for z in zeilen:
        rule_id = str(z["rule_id"])
        # Eine Regel ohne Namen gibt es nicht (`task_rules.name` ist NOT NULL);
        # fehlt die Zeile ganz, wurde die Regel zwischen den beiden Abfragen
        # gelöscht. Dann ist die Bestellung gegenstandslos — sie wegzulassen ist
        # richtiger, als einen Platzhalter zu erfinden (Wurzel 4).
        if rule_id not in namen:
            continue
        out.setdefault(str(z["block_request_id"]), []).append(
            BestellteLeistung(
                rule_id=rule_id,
                name=namen[rule_id],
                # 0538: was die Agentur entschieden hat. Der Rueckfall ist der
                # DB-Default der Spalte, kein erfundener Wert (Fake ohne Default).
                status=str(z.get("status") or "angefragt"),
                entscheidungsnotiz=z.get("entscheidungsnotiz"),
            )
        )
    return out


def _block(
    r: dict, bestellt: list[BestellteLeistung] | None = None
) -> BlockRequestItem:
    return BlockRequestItem(
        id=str(r["id"]),
        property_id=str(r["property_id"]),
        unit_id=str(r["unit_id"]) if r.get("unit_id") else None,
        start_date=date.fromisoformat(r["start_date"])
        if isinstance(r["start_date"], str)
        else r["start_date"],
        end_date=date.fromisoformat(r["end_date"])
        if isinstance(r["end_date"], str)
        else r["end_date"],
        status=r.get("status") or "pending",
        reason=r.get("reason"),
        decided_at=str(r["decided_at"]) if r.get("decided_at") else None,
        decision_note=r.get("decision_note"),
        created_at=str(r["created_at"]) if r.get("created_at") else None,
        ist_kuendigung=bool(r.get("ist_kuendigung")),
        als_kuendigung_gewertet=bool(r.get("als_kuendigung_gewertet")),
        # Stufe 1 (0389). Ohne dieses Feld sähe ein Familienmitglied nur
        # „offen" und wüsste nicht, WO sein Antrag liegt — bei der Familie
        # oder schon bei der Verwaltung. „Verschwunden" ist die schlechteste
        # aller Rückmeldungen.
        owner_freigabe=r.get("owner_freigabe") or "nicht_noetig",
        owner_decision_note=r.get("owner_decision_note"),
        vertragsende_gesetzt_auf=(
            date.fromisoformat(str(r["vertragsende_gesetzt_auf"])[:10])
            if r.get("vertragsende_gesetzt_auf")
            else None
        ),
        bestellte_leistungen=bestellt or [],
        aufhebung=str(r.get("aufhebung") or "keine"),
        aufhebung_grund=r.get("aufhebung_grund"),
        aufhebung_entscheidungsnotiz=r.get("aufhebung_entscheidungsnotiz"),
    )


def _meter(r: dict) -> MeterReadingItem:
    return MeterReadingItem(
        id=str(r["id"]),
        property_id=str(r["property_id"]),
        meter_kind=r["meter_kind"],
        value=float(r.get("value") or 0),
        read_at=date.fromisoformat(r["read_at"])
        if isinstance(r["read_at"], str)
        else r["read_at"],
        created_at=str(r["created_at"]) if r.get("created_at") else None,
    )
