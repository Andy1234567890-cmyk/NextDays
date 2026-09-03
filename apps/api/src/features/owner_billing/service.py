"""Service für owner_billing — Klassifikation + Abrechnungsvertrag pflegen.

Dieser Slice PFLEGT Konfiguration. Er rechnet KEINE Auszahlung: die Formel
liegt weiterhin allein in ``owner_statements.common`` und ist in dieser Etappe
unverändert führend. Was hier zusätzlich steht, sind die beiden
AUFLÖSUNGS-Funktionen (``klassifikation_aufloesen``, ``vertrag_aufloesen``) —
sie beantworten „welche Regel gilt für X am Tag Y", nicht „wie viel Geld".
Damit ist der spätere Umstieg genau ein Schritt: die Rechenkette ruft sie auf,
statt selbst in den Tabellen zu suchen.

Alle DB-Zugriffe laufen über die Service-Role und sind deshalb AUSNAHMSLOS
explizit tenant-gescoped (Wurzel 3): RLS greift hier nicht, `rolbypassrls` ist
gesetzt. Jeder Zugriff per ID lädt tenant-gefiltert; es gibt keinen ungescopten
Load mit nachgelagertem Vergleich.
"""
from __future__ import annotations

from datetime import date
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.properties.gebuehren import (
    FEE_TYPE_LABEL,
    FEE_TYPES,
)

from .schemas import (
    FeeClassificationBatchUpsert,
    FeeClassificationResponse,
    FeeClassificationUebersicht,
    FeeClassificationUpsert,
    FeeTypeZuordnung,
    OwnerBillingTermsCreate,
    OwnerBillingTermsListResponse,
    OwnerBillingTermsResponse,
    OwnerBillingTermsUpdate,
    PortalAbzugssatzCreate,
    PortalAbzugssatzListResponse,
    PortalAbzugssatzResponse,
    PortalAbzugssatzUpdate,
    SliceHealth,
)
from .vertragsende_kopplung import betroffene_objekte, nachziehen

log = get_logger("nextdays.owner_billing")

# Unique-Verletzung. Auf `fee_classification` heißt sie: für diese
# (Betrieb, Art[, Objekt]) gibt es schon eine Regel — der Backstop unter dem
# Upsert gegen Doppelklick/Retry (Wurzel 2).
_UNIQUE_VERLETZUNG = "23505"
# Exclusion-Verletzung. Auf `owner_billing_terms` heißt sie genau eine Sache:
# der Zeitraum überschneidet sich mit einem bestehenden Vertrag derselben
# Geltung. Das ist der DB-Backstop unter der Vorab-Prüfung im Service — zwei
# gleichzeitige Anlagen prüfen beide gegen den Stand VOR der jeweils anderen.
_EXCLUSION_VERLETZUNG = "23P01"

_TERMS_COLUMNS = (
    "id, tenant_id, owner_id, property_id, gueltig_ab, gueltig_bis, "
    "provisions_pct, min_provision_betrag, min_provision_currency, "
    "pauschale_betrag, pauschale_currency, pauschale_basis, "
    "pauschale_zeitpunkt, notiz, erstellt_von, created_at, updated_at"
)

_SAETZE_COLUMNS = (
    "id, tenant_id, kanal, property_id, gueltig_ab, gueltig_bis, "
    "provision_pct, zahlungsgebuehr_pct, notiz, erstellt_von, "
    "created_at, updated_at"
)

_CLASS_COLUMNS = (
    "id, tenant_id, fee_type, property_id, gehoert_zu, provisionspflichtig, "
    "notiz, zugeordnet_von, zugeordnet_am, created_at, updated_at"
)


class BillingError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class KlassifikationFehlt(Exception):
    """Eine Gebührenart ist NICHT klassifiziert — Rechnen unmöglich.

    Das Gegenstück zu ``owner_statements.common.PayoutUnbekannt`` und bewusst
    nach demselben Muster gebaut: ``fee_type`` benennt maschinenlesbar, WELCHE
    Art fehlt, damit die Oberfläche direkt auf die Zuordnungsmaske zeigen kann,
    statt eine unbrauchbare Zahl anzuzeigen.

    Ohne diese Ausnahme müsste die Auflösung eine Zugehörigkeit unterstellen.
    Die naheliegende Unterstellung wäre „gehört dem Eigentümer und ist
    provisionspflichtig" — sie sieht plausibel aus und wäre bei jeder
    Reinigungsgebühr falsch, ohne dass es jemandem auffiele (Wurzel 4).
    """

    def __init__(self, fee_type: str, message: str) -> None:
        super().__init__(message)
        self.fee_type = fee_type
        self.message = message


def _float(value: object) -> float | None:
    """Zahl aus der DB in float — ``None`` bleibt ``None``.

    Kein stilles ``0.0``: ein fehlender Betrag ist etwas anderes als null Geld.
    """
    if value is None:
        return None
    return float(value)


def _iso(value: object) -> str:
    """Zeitstempel als String — die DB liefert ihn bereits so."""
    return str(value) if value is not None else ""


class OwnerBillingService:
    """Pflege der Abrechnungs-Konfiguration eines Betriebs."""

    slice_name = "owner_billing"

    def __init__(self, service_client: Client) -> None:
        self._db = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    # -- gemeinsame Scope-Helfer -------------------------------------------

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise BillingError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    def _require_own_owner(self, tenant_id: str, owner_id: str) -> dict[str, Any]:
        """Den Eigentümer tenant-gescoped laden (Wurzel 3).

        Laden und Scopen in EINEM Zugriff, nicht als roher Load mit
        nachgelagertem Vergleich. Ein fremder Mandant ergibt 404 und nicht
        403: ein 403 wäre die Auskunft, dass es die ID gibt.
        """
        res = (
            self._db.table("owners")
            .select("id, name")
            .eq("tenant_id", tenant_id)
            .eq("id", owner_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise BillingError("Eigentümer nicht gefunden.", status_code=404)
        return res.data[0]

    def _require_own_property(self, tenant_id: str, property_id: str) -> None:
        """Prüfen, dass das Objekt zu diesem Betrieb gehört (Wurzel 3)."""
        res = (
            self._db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise BillingError(
                "Objekt gehört nicht zu diesem Konto.", status_code=404
            )

    def _owner_besitzt_objekt(
        self, tenant_id: str, owner_id: str, property_id: str
    ) -> None:
        """Gehört das Objekt diesem Eigentümer?

        Ein objektbezogener Vertrag für ein Objekt, das dem Eigentümer gar
        nicht gehört, wäre stumm wirkungslos: die Auflösung fände ihn nie,
        weil sie über den Eigentümer des Objekts einsteigt. Die Agentur würde
        einen Satz pflegen, der nie greift, und den Fehler erst bemerken, wenn
        die Abrechnung mit dem falschen Satz rechnet.
        """
        self._require_own_property(tenant_id, property_id)
        res = (
            self._db.table("owner_properties")
            .select("owner_id")
            .eq("owner_id", owner_id)
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise BillingError(
                "Dieses Objekt ist dem Eigentümer nicht zugeordnet. Ein "
                "Vertrag darauf würde nie greifen.",
                status_code=422,
            )

    # ==================================================================
    # A) Gebühren-Klassifikation
    # ==================================================================

    def _class_row(self, row: dict[str, Any]) -> FeeClassificationResponse:
        return FeeClassificationResponse(
            id=str(row["id"]),
            fee_type=str(row["fee_type"]),
            property_id=(
                str(row["property_id"]) if row.get("property_id") else None
            ),
            gehoert_zu=row["gehoert_zu"],
            provisionspflichtig=bool(row["provisionspflichtig"]),
            notiz=row.get("notiz"),
            zugeordnet_von=(
                str(row["zugeordnet_von"]) if row.get("zugeordnet_von") else None
            ),
            zugeordnet_am=_iso(row.get("zugeordnet_am")),
            created_at=_iso(row.get("created_at")),
            updated_at=_iso(row.get("updated_at")),
        )

    def _klassifikationen(self, tenant_id: str) -> list[dict[str, Any]]:
        return (
            self._db.table("fee_classification")
            .select(_CLASS_COLUMNS)
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []

    def _bestands_arten(
        self, tenant_id: str
    ) -> dict[str, tuple[int, list[str]]]:
        """Welche Gebührenarten stehen im Bestand des Betriebs — und wie oft?

        ZWEI Quellen, und beide sind nötig:

        1. ``property_pricing_config.fees`` — die gepflegten Objekt-Gebühren.
        2. ``channex_booking.raw`` — die Arten, die PORTAL-Buchungen
           mitbringen, gelesen mit denselben Lesern wie die Abrechnung
           (siehe ``_portal_arten``).

        Nur (1) zu lesen war eine stille Lücke: die Abrechnung wirft
        ``gebuehr_nicht_zugeordnet`` für JEDE Art, die sie antrifft — auch für
        eine, die ausschließlich über einen Portal-Feed hereinkommt und an
        keinem Objekt gepflegt ist. Die Maske zeigte dann „alles zugeordnet",
        während die Abrechnung blockierte, und die Zuordnung, die sie verlangte,
        war dort gar nicht anlegbar. Genau diese Lücke war am 03.09.2026 die
        Frage „warum sehen wir nicht, was fehlt?".

        Die Maske zeigt weiterhin nur, was der Betrieb WIRKLICH benutzt: alle 49
        Arten anzubieten hieße, die Agentur 49 Entscheidungen treffen zu
        lassen, von denen 46 nie eine Gebühr betreffen.

        Gebühren OHNE ``feeType`` (Altbestand) laufen unter ``unknown`` — das
        ist der Katalogwert, den ``fee_category`` für sie ohnehin liefert. Sie
        verschwinden damit nicht stillschweigend, sondern erscheinen als eine
        Art, die die Agentur zuordnen muss.
        """
        rows = (
            self._db.table("property_pricing_config")
            .select("fees")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []

        zaehler: dict[str, int] = {}
        namen: dict[str, list[str]] = {}
        for row in rows:
            fees = row.get("fees")
            if not isinstance(fees, list):
                continue
            for fee in fees:
                if not isinstance(fee, dict):
                    continue
                art = str(fee.get("feeType") or "").strip() or "unknown"
                zaehler[art] = zaehler.get(art, 0) + 1
                name = str(fee.get("name") or "").strip()
                liste = namen.setdefault(art, [])
                # Nur die ersten drei verschiedenen Namen: die Maske braucht
                # sie zur Wiedererkennung, nicht als vollständige Liste.
                if name and name not in liste and len(liste) < 3:
                    liste.append(name)

        # Zweite Quelle: die Arten, die PORTAL-Buchungen mitbringen — gelesen
        # aus `channex_booking.raw`, nicht aus `reservation_portal_gebuehren`.
        #
        # Warum der Payload und nicht die Tabelle: die Tabelle wird beim IMPORT
        # gefuellt und traegt damit den Stand des Lesers, der damals lief.
        # Wird der Leser spaeter um eine Gebuehrenart erweitert, bleibt die
        # Tabelle auf dem alten Stand — die Maske meldete „alles zugeordnet",
        # waehrend die Abrechnung (die den Payload liest) eine Zuordnung
        # verlangt. Genau diese Auseinanderentwicklung war der Anlass; die
        # Maske liest deshalb dieselbe Quelle wie die Rechnung.
        #
        # `ota_bezeichnung` als Name zur Wiedererkennung („Stromkosten") —
        # dasselbe Feld, das die Abrechnung anzeigt.
        for art, name in self._portal_arten(tenant_id):
            zaehler[art] = zaehler.get(art, 0) + 1
            liste = namen.setdefault(art, [])
            if name and name not in liste and len(liste) < 3:
                liste.append(name)

        return {art: (n, namen.get(art, [])) for art, n in zaehler.items()}

    def _portal_arten(self, tenant_id: str) -> list[tuple[str, str]]:
        """``(art, anzeigename)`` aus den PAYLOADS der Portal-Buchungen.

        Benutzt DIESELBEN Leser UND DIESELBE QUELLE wie die Abrechnung
        (`owner_statements.payloads.payloads_laden` +
        `owner_statements.gebuehren_quelle`) — nicht eine zweite Auslegung
        derselben Daten. Zwei Leser waeren zwei Wahrheiten: die Maske zeigte
        eine Art, die die Rechnung nicht sieht, oder umgekehrt.

        Warum NICHT ``reservations.ota_details``: das ist eine GEKUERZTE Kopie
        des Channex-Payloads. ``rooms[].meta.charge_periods`` — der
        sprachneutrale Gebuehrenschluessel, an dem die Abrechnung
        ``ELECTRICITYFEE`` erkennt — fehlt dort vollstaendig (live gemessen
        03.09.2026 an der Buchung 5522296055: in ``channex_booking.raw``
        vorhanden, in ``ota_details`` nicht). Die Maske bot ``electricity``
        deshalb nicht an, waehrend die Abrechnung genau diese Zuordnung
        verlangte — die Agentur konnte die Blockade nicht aufloesen.

        Eine Buchung, deren Aufstellung nicht lesbar ist, wird UEBERSPRUNGEN
        statt gemeldet: hier geht es um die Zuordnungsmaske, und ein
        Lesefehler gehoert in die Abrechnung bzw. in
        `scripts/diagnose/portal-gebuehren-lesbar.py` — nicht in eine
        Auswahlliste, die dann gar nicht mehr laedt (Wurzel 5: best effort,
        solange der Hauptpfad nicht kippt).
        """
        # Lokal importiert: `owner_billing` haengt sonst am ganzen
        # Abrechnungs-Slice, und der importiert seinerseits hierher zurueck.
        from src.features.owner_statements import (  # noqa: PLC0415
            gebuehren_quelle as gq,
        )
        from src.features.owner_statements.common import (  # noqa: PLC0415
            PayoutUnbekannt,
        )
        from src.features.owner_statements.payloads import (  # noqa: PLC0415
            payloads_laden,
        )

        # `external_ref` und `id` gehoeren mit in die Auswahl: `payloads_laden`
        # findet darueber den CSV-Zwilling bzw. den 0528-Payload.
        zeilen = (
            self._db.table("reservations")
            .select("id, source_channex_booking_id, external_ref")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []

        try:
            payloads = payloads_laden(self._db, tenant_id, zeilen)
        except Exception:  # noqa: BLE001 — Auswahlliste darf nie kippen
            log.warning("zuordnungsmaske_payloads_unlesbar", tenant_id=tenant_id)
            return []

        aus: list[tuple[str, str]] = []
        for raw in payloads.values():
            if not isinstance(raw, dict):
                continue
            try:
                posten = gq.booking_gebuehren(raw)
                bezeichnungen = gq.booking_bezeichnungen(raw)
            except PayoutUnbekannt:
                # Nicht auflösbar — die Abrechnung meldet es an ihrer Stelle.
                continue
            except Exception:  # noqa: BLE001 — Auswahlliste darf nie kippen
                log.warning("zuordnungsmaske_payload_unlesbar", tenant_id=tenant_id)
                continue
            for art, _betrag in posten or []:
                aus.append((str(art), bezeichnungen.get(str(art), "")))
        return aus

    def uebersicht(self, ctx: AuthContext) -> FeeClassificationUebersicht:
        """Die Zuordnungsmaske: Bestands-Arten + bereits getroffene Zuordnung.

        Zeigt AUSDRÜCKLICH auch Arten, die zwar keine Bestandsgebühr mehr
        haben, aber schon zugeordnet wurden — sonst verschwände eine bewusste
        Entscheidung aus der Oberfläche, sobald die letzte Gebühr dieser Art
        gelöscht wird, und die Regel wirkte unsichtbar weiter.
        """
        tenant_id = self._require_tenant(ctx)
        bestand = self._bestands_arten(tenant_id)
        gespeichert = self._klassifikationen(tenant_id)

        betriebsregel: dict[str, dict[str, Any]] = {}
        ausnahmen: dict[str, list[dict[str, Any]]] = {}
        for row in gespeichert:
            art = str(row["fee_type"])
            if row.get("property_id"):
                ausnahmen.setdefault(art, []).append(row)
            else:
                betriebsregel[art] = row

        arten = sorted(set(bestand) | set(betriebsregel) | set(ausnahmen))
        items: list[FeeTypeZuordnung] = []
        offen = 0
        for art in arten:
            anzahl, namen = bestand.get(art, (0, []))
            regel = betriebsregel.get(art)
            if regel is None:
                # Nur was auch benutzt wird, ist ein OFFENER Punkt: eine Art
                # ohne Bestandsgebühr kann die Abrechnung nicht zum Scheitern
                # bringen.
                if anzahl > 0:
                    offen += 1
            items.append(
                FeeTypeZuordnung(
                    fee_type=art,
                    # Fällt der Katalog aus, steht der technische Wert da —
                    # das ist ehrlicher als ein erfundenes Klartext-Label.
                    label=FEE_TYPE_LABEL.get(art, art),
                    anzahl=anzahl,
                    beispiel_namen=namen,
                    klassifikation=(
                        self._class_row(regel) if regel is not None else None
                    ),
                    ausnahmen=[
                        self._class_row(r) for r in ausnahmen.get(art, [])
                    ],
                )
            )
        return FeeClassificationUebersicht(items=items, offen=offen)

    def _pruefe_fee_type(self, fee_type: str) -> str:
        """Die Art muss im Katalog stehen.

        Der Katalog (``gebuehren.FEE_TYPES``) ist die eine Quelle; eine Regel
        für eine erfundene Art wäre eine Zeile, die nie greift, weil keine
        Gebühr sie je trägt.
        """
        art = fee_type.strip()
        if art not in FEE_TYPES:
            raise BillingError(
                f"Unbekannte Gebührenart: {art}", status_code=422
            )
        return art

    def klassifikation_setzen(
        self, ctx: AuthContext, req: FeeClassificationBatchUpsert
    ) -> FeeClassificationUebersicht:
        """Mehrere Zuordnungen in einem Zug setzen (die Maske speichert alles).

        Vor dem ersten Schreiben wird ALLES geprüft. Sonst hinterließe eine
        abgelehnte fünfte Zeile eine halb gespeicherte Maske, und die Agentur
        müsste raten, was schon drin ist.
        """
        tenant_id = self._require_tenant(ctx)

        gesehen: set[tuple[str, str | None]] = set()
        geprueft: list[FeeClassificationUpsert] = []
        for item in req.items:
            art = self._pruefe_fee_type(item.fee_type)
            if item.property_id:
                self._require_own_property(tenant_id, item.property_id)
            schluessel = (art, item.property_id)
            # Zwei widersprüchliche Regeln in EINEM Aufruf: der Unique-Index
            # fängt sie zwar, aber erst beim zweiten Schreiben und mit einer
            # Meldung, die die Agentur nicht versteht.
            if schluessel in gesehen:
                raise BillingError(
                    f"Die Gebührenart {art} kommt in der Zuordnung doppelt vor.",
                    status_code=422,
                )
            gesehen.add(schluessel)
            geprueft.append(item.model_copy(update={"fee_type": art}))

        for item in geprueft:
            self._eine_klassifikation_schreiben(tenant_id, ctx, item)
        return self.uebersicht(ctx)

    def _eine_klassifikation_schreiben(
        self, tenant_id: str, ctx: AuthContext, item: FeeClassificationUpsert
    ) -> None:
        """Eine Zuordnung anlegen oder ändern.

        Bewusst UPDATE-dann-INSERT statt eines PostgREST-Upserts: der Upsert
        bräuchte ein ``on_conflict`` auf einen der beiden PARTIELLEN
        Unique-Indizes, und partielle Indizes taugen dafür nicht — der
        Betriebs-Fall (property_id is null) und der Objekt-Fall liegen auf
        verschiedenen Indizes. Der Unique-Index bleibt trotzdem der Backstop:
        rennen zwei Aufrufe, läuft der zweite in 23505 statt eine zweite
        widersprüchliche Regel anzulegen (Wurzel 2).
        """
        werte = {
            "gehoert_zu": item.gehoert_zu.value,
            "provisionspflichtig": item.provisionspflichtig,
            "notiz": item.notiz,
            "zugeordnet_von": ctx.user_id,
            # Eigene Uhr für die ENTSCHEIDUNG, nicht `updated_at` (Wurzel 5b):
            # eine spätere Korrektur der Notiz darf den Zeitpunkt der
            # Zuordnung nicht verschieben. Hier ist es aber genau derselbe
            # Vorgang — die Agentur bestätigt die Zuordnung erneut.
            "zugeordnet_am": "now()",
        }

        abfrage = (
            self._db.table("fee_classification")
            .update(werte)
            .eq("tenant_id", tenant_id)
            .eq("fee_type", item.fee_type)
        )
        abfrage = (
            abfrage.eq("property_id", item.property_id)
            if item.property_id
            else abfrage.is_("property_id", "null")
        )
        vorhanden = abfrage.execute()
        if vorhanden.data:
            return

        try:
            self._db.table("fee_classification").insert(
                {
                    "tenant_id": tenant_id,
                    "fee_type": item.fee_type,
                    "property_id": item.property_id,
                    **werte,
                }
            ).execute()
        except APIError as exc:
            if exc.code == _UNIQUE_VERLETZUNG:
                # Ein gleichzeitiger zweiter Aufruf war schneller. Sein Wert
                # steht jetzt drin — der hier ist derselbe Vorgang, also ist
                # das kein Fehler für die Agentur.
                log.info(
                    "klassifikation_rennen",
                    fee_type=item.fee_type,
                    tenant_id=tenant_id,
                )
                return
            raise

    def klassifikation_loeschen(
        self, ctx: AuthContext, klassifikation_id: str
    ) -> FeeClassificationUebersicht:
        """Eine Zuordnung entfernen (z. B. eine Objekt-Ausnahme aufheben).

        Danach ist die Art wieder UNKLASSIFIZIERT bzw. fällt auf die
        Betriebsregel zurück. Das ist ausdrücklich erlaubt: eine Zuordnung, die
        man nicht mehr loswird, zwänge die Agentur, mit einer falschen Regel zu
        leben.
        """
        tenant_id = self._require_tenant(ctx)
        res = (
            self._db.table("fee_classification")
            .delete()
            .eq("tenant_id", tenant_id)
            .eq("id", klassifikation_id)
            .execute()
        )
        if not res.data:
            raise BillingError("Zuordnung nicht gefunden.", status_code=404)
        return self.uebersicht(ctx)

    def klassifikation_aufloesen(
        self, tenant_id: str, fee_type: str | None, property_id: str | None
    ) -> tuple[str, bool]:
        """Welche Klassifikation gilt für DIESE Gebühr an DIESEM Objekt?

        Die Auflösung, die die Rechenkette beim späteren Umstieg aufruft.
        Vorrang: Objekt-Ausnahme vor Betriebsregel — dasselbe Prinzip wie
        ``commission_override_pct`` vor ``default_commission_pct``.

        Gibt ``(gehoert_zu, provisionspflichtig)`` zurück. Fehlt die Regel,
        wirft sie ``KlassifikationFehlt`` und liefert KEINEN Ersatz: eine
        unterstellte Zugehörigkeit wäre eine Zahl, die plausibel aussieht und
        das Geld der falschen Partei zuschlägt (Wurzel 4).
        """
        art = (fee_type or "").strip() or "unknown"
        rows = (
            self._db.table("fee_classification")
            .select("fee_type, property_id, gehoert_zu, provisionspflichtig")
            .eq("tenant_id", tenant_id)
            .eq("fee_type", art)
            .execute()
        ).data or []

        betrieb: dict[str, Any] | None = None
        for row in rows:
            if property_id and str(row.get("property_id") or "") == property_id:
                return str(row["gehoert_zu"]), bool(row["provisionspflichtig"])
            if not row.get("property_id"):
                betrieb = row
        if betrieb is not None:
            return str(betrieb["gehoert_zu"]), bool(betrieb["provisionspflichtig"])

        raise KlassifikationFehlt(
            art,
            f"Die Gebührenart „{FEE_TYPE_LABEL.get(art, art)}“ ist nicht "
            "zugeordnet. Ohne Zuordnung ist nicht bestimmbar, wem der Betrag "
            "gehört und ob er provisionspflichtig ist.",
        )

    # ==================================================================
    # B) Abrechnungsvertrag
    # ==================================================================

    def _terms_row(
        self, row: dict[str, Any], *, heute: date
    ) -> OwnerBillingTermsResponse:
        ab = date.fromisoformat(str(row["gueltig_ab"]))
        bis_roh = row.get("gueltig_bis")
        bis = date.fromisoformat(str(bis_roh)) if bis_roh else None
        return OwnerBillingTermsResponse(
            id=str(row["id"]),
            owner_id=str(row["owner_id"]),
            property_id=(
                str(row["property_id"]) if row.get("property_id") else None
            ),
            gueltig_ab=ab,
            gueltig_bis=bis,
            provisions_pct=float(row["provisions_pct"]),
            min_provision_betrag=_float(row.get("min_provision_betrag")),
            min_provision_currency=row.get("min_provision_currency"),
            pauschale_betrag=_float(row.get("pauschale_betrag")),
            pauschale_currency=row.get("pauschale_currency"),
            pauschale_basis=row.get("pauschale_basis"),
            pauschale_zeitpunkt=row.get("pauschale_zeitpunkt"),
            notiz=row.get("notiz"),
            erstellt_von=(
                str(row["erstellt_von"]) if row.get("erstellt_von") else None
            ),
            created_at=_iso(row.get("created_at")),
            updated_at=_iso(row.get("updated_at")),
            # Halb offenes Intervall [ab, bis): der Endtag gehört schon zum
            # Folgevertrag.
            aktuell=ab <= heute and (bis is None or heute < bis),
        )

    def vertraege_liste(
        self, ctx: AuthContext, owner_id: str
    ) -> OwnerBillingTermsListResponse:
        """Die vollständige HISTORIE eines Eigentümers, nicht nur der aktuelle.

        Einschließlich der objektbezogenen Verträge: die Agentur muss auf einen
        Blick sehen, dass ein einzelnes Objekt anders abgerechnet wird — sonst
        sucht sie den abweichenden Satz beim Eigentümer und findet ihn nicht.
        """
        tenant_id = self._require_tenant(ctx)
        self._require_own_owner(tenant_id, owner_id)
        rows = (
            self._db.table("owner_billing_terms")
            .select(_TERMS_COLUMNS)
            .eq("tenant_id", tenant_id)
            .eq("owner_id", owner_id)
            .order("gueltig_ab", desc=True)
            .execute()
        ).data or []
        heute = date.today()
        return OwnerBillingTermsListResponse(
            items=[self._terms_row(r, heute=heute) for r in rows]
        )

    def _require_own_terms(
        self, tenant_id: str, terms_id: str
    ) -> dict[str, Any]:
        """Einen Vertrag tenant-gescoped laden (Wurzel 3/9).

        Derselbe Scope wie im List-Pfad: ohne ihn könnte ein Nutzer mit
        gültigem Token den Vertrag eines fremden Betriebs lesen oder ändern,
        wenn er dessen ID kennt.
        """
        res = (
            self._db.table("owner_billing_terms")
            .select(_TERMS_COLUMNS)
            .eq("tenant_id", tenant_id)
            .eq("id", terms_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise BillingError("Vertrag nicht gefunden.", status_code=404)
        return res.data[0]

    def _pruefe_ueberlappung(
        self,
        tenant_id: str,
        owner_id: str,
        property_id: str | None,
        gueltig_ab: date,
        gueltig_bis: date | None,
        *,
        ausser_id: str | None = None,
    ) -> None:
        """Überschneidet sich der Zeitraum mit einem bestehenden Vertrag?

        Der EXCLUDE-Constraint in der DB (0343) fängt das ohnehin ab — aber mit
        einer Meldung, die niemand versteht. Diese Prüfung liefert der Agentur
        stattdessen den konkreten Vertrag, der im Weg steht. Der Constraint
        bleibt der Backstop für das Rennen zwischen zwei gleichzeitigen
        Anlagen, das keine Vorab-Prüfung schließen kann (Wurzel 2).
        """
        abfrage = (
            self._db.table("owner_billing_terms")
            .select("id, gueltig_ab, gueltig_bis")
            .eq("tenant_id", tenant_id)
            .eq("owner_id", owner_id)
        )
        abfrage = (
            abfrage.eq("property_id", property_id)
            if property_id
            else abfrage.is_("property_id", "null")
        )
        for row in abfrage.execute().data or []:
            if ausser_id and str(row["id"]) == ausser_id:
                continue
            anderer_ab = date.fromisoformat(str(row["gueltig_ab"]))
            anderer_bis_roh = row.get("gueltig_bis")
            anderer_bis = (
                date.fromisoformat(str(anderer_bis_roh))
                if anderer_bis_roh
                else None
            )
            # Halb offene Intervalle [a, b) überlappen genau dann, wenn jedes
            # vor dem Ende des anderen beginnt.
            beginnt_vor_ende = gueltig_bis is None or anderer_ab < gueltig_bis
            endet_nach_beginn = anderer_bis is None or gueltig_ab < anderer_bis
            if beginnt_vor_ende and endet_nach_beginn:
                bis_text = (
                    anderer_bis.isoformat() if anderer_bis else "unbefristet"
                )
                raise BillingError(
                    "Für diesen Zeitraum gibt es bereits einen Vertrag "
                    f"({anderer_ab.isoformat()} bis {bis_text}). Beende ihn "
                    "zuerst — zwei gleichzeitig gültige Verträge ließen offen, "
                    "mit welchem Satz gerechnet wird.",
                    status_code=409,
                )

    def _vertragsende_koppeln(
        self,
        tenant_id: str,
        owner_id: str,
        property_ids: list[str],
    ) -> list[dict[str, Any]]:
        """Nach jeder Vertragsänderung das Vermarktungsende der berührten
        Objekte neu bestimmen (0378).

        Der Abrechnungsvertrag und das Vermarktungsende sind EIN Ereignis: läuft
        der Vertrag aus, darf das Objekt nicht weiter bei Booking und Airbnb
        stehen. Vorher waren das zwei Felder, die nichts voneinander wussten.
        Die Regel und die Begründung stehen in `vertragsende_kopplung`.

        Aufzurufen NACH dem Schreiben — die Kopplung liest den neuen Stand aus
        der Tabelle, statt ihn aus dem Request nachzubilden: sonst hätte sie
        eine zweite, mit der Zeit abweichende Meinung darüber, was gilt.
        """
        if not property_ids:
            return []
        return nachziehen(self._db, tenant_id, owner_id, property_ids)

    def _kopplungs_objekte(
        self, tenant_id: str, owner_id: str, *property_ids: str | None
    ) -> list[str]:
        """Die Objekte, deren Ende nach dieser Änderung neu zu rechnen ist.

        Mehrere `property_id`-Werte, weil eine Änderung die Geltung VERSCHIEBEN
        kann (Objektvertrag → eigentümerweit oder umgekehrt): dann muss auch das
        vorher betroffene Objekt neu gerechnet werden, sonst bliebe es auf dem
        alten Ende stehen (Wurzel 1). `None` als Wert heißt „eigentümerweit" und
        fächert auf alle Objekte des Eigentümers auf.
        """
        gesammelt: list[str] = []
        for property_id in property_ids:
            for objekt in betroffene_objekte(
                self._db, tenant_id, owner_id, property_id
            ):
                if objekt not in gesammelt:
                    gesammelt.append(objekt)
        return gesammelt

    def vertrag_anlegen(
        self, ctx: AuthContext, owner_id: str, req: OwnerBillingTermsCreate
    ) -> OwnerBillingTermsResponse:
        """Einen neuen Vertrag anlegen (Ablösung = neuer Vertrag, nicht Update)."""
        tenant_id = self._require_tenant(ctx)
        self._require_own_owner(tenant_id, owner_id)
        if req.property_id:
            self._owner_besitzt_objekt(tenant_id, owner_id, req.property_id)
        self._pruefe_ueberlappung(
            tenant_id, owner_id, req.property_id, req.gueltig_ab, req.gueltig_bis
        )

        zeile = {
            "tenant_id": tenant_id,
            "owner_id": owner_id,
            "property_id": req.property_id,
            "gueltig_ab": req.gueltig_ab.isoformat(),
            "gueltig_bis": (
                req.gueltig_bis.isoformat() if req.gueltig_bis else None
            ),
            "provisions_pct": req.provisions_pct,
            "min_provision_betrag": req.min_provision_betrag,
            "min_provision_currency": req.min_provision_currency,
            "pauschale_betrag": req.pauschale_betrag,
            "pauschale_currency": req.pauschale_currency,
            "pauschale_basis": (
                req.pauschale_basis.value if req.pauschale_basis else None
            ),
            "pauschale_zeitpunkt": (
                req.pauschale_zeitpunkt.value
                if req.pauschale_zeitpunkt
                else None
            ),
            "notiz": req.notiz,
            "erstellt_von": ctx.user_id,
        }
        try:
            res = (
                self._db.table("owner_billing_terms").insert(zeile).execute()
            )
        except APIError as exc:
            if exc.code == _EXCLUSION_VERLETZUNG:
                raise BillingError(
                    "Für diesen Zeitraum wurde soeben ein anderer Vertrag "
                    "angelegt. Lade die Historie neu.",
                    status_code=409,
                ) from exc
            raise
        antwort = self._terms_row(res.data[0], heute=date.today())
        # Ein befristeter Vertrag ist gleichzeitig ein Vermarktungsende, ein
        # Anschlussvertrag hebt das Ende des Vorgängers auf — beides fällt beim
        # ANLEGEN an, nicht erst beim Ändern.
        antwort.vertragsende_wirkung = self._vertragsende_koppeln(
            tenant_id,
            owner_id,
            self._kopplungs_objekte(tenant_id, owner_id, req.property_id),
        )
        return antwort

    def vertrag_aendern(
        self, ctx: AuthContext, terms_id: str, req: OwnerBillingTermsUpdate
    ) -> OwnerBillingTermsResponse:
        """Einen bestehenden Vertrag korrigieren.

        Korrigieren, nicht ablösen: wer ab einem Datum anders abrechnen will,
        legt einen NEUEN Vertrag an. Diese Route ist für den Tippfehler im
        Satz oder die nachgetragene Befristung.
        """
        tenant_id = self._require_tenant(ctx)
        alt = self._require_own_terms(tenant_id, terms_id)

        neu_ab = req.gueltig_ab or date.fromisoformat(str(alt["gueltig_ab"]))
        if req.unbefristet:
            neu_bis: date | None = None
        elif req.gueltig_bis is not None:
            neu_bis = req.gueltig_bis
        else:
            alt_bis = alt.get("gueltig_bis")
            neu_bis = date.fromisoformat(str(alt_bis)) if alt_bis else None
        if neu_bis is not None and neu_bis <= neu_ab:
            raise BillingError(
                "„Gültig bis“ muss nach „Gültig ab“ liegen.", status_code=422
            )

        self._pruefe_ueberlappung(
            tenant_id,
            str(alt["owner_id"]),
            str(alt["property_id"]) if alt.get("property_id") else None,
            neu_ab,
            neu_bis,
            ausser_id=terms_id,
        )

        aenderung: dict[str, Any] = {
            "gueltig_ab": neu_ab.isoformat(),
            "gueltig_bis": neu_bis.isoformat() if neu_bis else None,
        }
        if req.provisions_pct is not None:
            aenderung["provisions_pct"] = req.provisions_pct
        if req.notiz is not None:
            aenderung["notiz"] = req.notiz

        self._min_provision_uebernehmen(aenderung, alt, req)
        self._pauschale_uebernehmen(aenderung, alt, req)

        # DEBUGGING (12.08.2026): Alt- und Neu-Wert je Änderung. Ohne das war
        # nicht unterscheidbar, ob ein Speichern gar nicht ankam, mit
        # unveränderten Werten kam oder an einem Constraint scheiterte — live
        # stand im Formular ein neues „Gültig bis", in der DB der alte Wert,
        # und im Log war NICHTS (die ganze Datei hatte eine Log-Zeile).
        log.info(
            "billing_terms_update_start",
            tenant_id=tenant_id,
            terms_id=terms_id,
            property_id=str(alt["property_id"]) if alt.get("property_id") else None,
            gueltig_ab_alt=str(alt.get("gueltig_ab")),
            gueltig_ab_neu=aenderung["gueltig_ab"],
            gueltig_bis_alt=str(alt.get("gueltig_bis")),
            gueltig_bis_neu=aenderung["gueltig_bis"],
            felder=sorted(aenderung),
        )
        try:
            res = (
                self._db.table("owner_billing_terms")
                .update(aenderung)
                .eq("tenant_id", tenant_id)
                .eq("id", terms_id)
                .execute()
            )
        except APIError as exc:
            log.warning(
                "billing_terms_update_fehler",
                tenant_id=tenant_id,
                terms_id=terms_id,
                code=exc.code,
                message=str(exc.message)[:300],
            )
            if exc.code == _EXCLUSION_VERLETZUNG:
                raise BillingError(
                    "Der geänderte Zeitraum überschneidet sich mit einem "
                    "anderen Vertrag.",
                    status_code=409,
                ) from exc
            raise
        if not res.data:
            # Kein Treffer heißt: die ID gehört nicht zu diesem Mandanten oder
            # existiert nicht. Das MUSS im Log stehen — es sieht in der
            # Oberfläche wie „nichts passiert" aus.
            log.warning(
                "billing_terms_update_ohne_treffer",
                tenant_id=tenant_id,
                terms_id=terms_id,
            )
            raise BillingError("Vertrag nicht gefunden.", status_code=404)
        log.info(
            "billing_terms_aktualisiert",
            tenant_id=tenant_id,
            terms_id=terms_id,
            gueltig_bis=res.data[0].get("gueltig_bis"),
            provisions_pct=res.data[0].get("provisions_pct"),
        )
        antwort = self._terms_row(res.data[0], heute=date.today())
        # Die Geltung kann sich verschoben haben (Objektvertrag ↔
        # eigentümerweit) — deshalb ALT und NEU nachziehen, sonst bliebe das
        # vorher betroffene Objekt auf dem alten Ende stehen (Wurzel 1).
        antwort.vertragsende_wirkung = self._vertragsende_koppeln(
            tenant_id,
            str(alt["owner_id"]),
            self._kopplungs_objekte(
                tenant_id,
                str(alt["owner_id"]),
                str(alt["property_id"]) if alt.get("property_id") else None,
                (
                    str(res.data[0]["property_id"])
                    if res.data[0].get("property_id")
                    else None
                ),
            ),
        )
        return antwort

    @staticmethod
    def _min_provision_uebernehmen(
        aenderung: dict[str, Any],
        alt: dict[str, Any],
        req: OwnerBillingTermsUpdate,
    ) -> None:
        """Mindestprovision zusammenführen — Betrag und Währung nur gemeinsam.

        Der DB-CHECK verlangt, dass beide gesetzt oder beide leer sind. Ein
        PATCH, der nur den Betrag schickt, würde ihn ohne diese Zusammenführung
        mit der alten Währung kombinieren — was richtig ist —, ein PATCH mit
        nur der Währung dagegen liefe in einen CHECK-Fehler mit
        Constraint-Namen. Deshalb wird hier zusammengeführt und danach
        geprüft.
        """
        if req.ohne_min_provision:
            aenderung["min_provision_betrag"] = None
            aenderung["min_provision_currency"] = None
            return
        betrag = (
            req.min_provision_betrag
            if req.min_provision_betrag is not None
            else _float(alt.get("min_provision_betrag"))
        )
        currency = req.min_provision_currency or alt.get("min_provision_currency")
        if (betrag is None) != (currency is None):
            raise BillingError(
                "Mindestprovision braucht Betrag UND Währung.", status_code=422
            )
        aenderung["min_provision_betrag"] = betrag
        aenderung["min_provision_currency"] = currency

    @staticmethod
    def _pauschale_uebernehmen(
        aenderung: dict[str, Any],
        alt: dict[str, Any],
        req: OwnerBillingTermsUpdate,
    ) -> None:
        """Pauschale zusammenführen — alle vier Felder oder keines."""
        if req.ohne_pauschale:
            for feld in (
                "pauschale_betrag",
                "pauschale_currency",
                "pauschale_basis",
                "pauschale_zeitpunkt",
            ):
                aenderung[feld] = None
            return
        betrag = (
            req.pauschale_betrag
            if req.pauschale_betrag is not None
            else _float(alt.get("pauschale_betrag"))
        )
        currency = req.pauschale_currency or alt.get("pauschale_currency")
        basis = (
            req.pauschale_basis.value
            if req.pauschale_basis
            else alt.get("pauschale_basis")
        )
        zeitpunkt = (
            req.pauschale_zeitpunkt.value
            if req.pauschale_zeitpunkt
            else alt.get("pauschale_zeitpunkt")
        )
        werte = (betrag, currency, basis, zeitpunkt)
        gesetzt = [w is not None for w in werte]
        if any(gesetzt) and not all(gesetzt):
            raise BillingError(
                "Die Pauschale je Buchung braucht Betrag, Währung, Basis und "
                "Zeitpunkt — oder gar nichts.",
                status_code=422,
            )
        aenderung["pauschale_betrag"] = betrag
        aenderung["pauschale_currency"] = currency
        aenderung["pauschale_basis"] = basis
        aenderung["pauschale_zeitpunkt"] = zeitpunkt

    def vertrag_loeschen(self, ctx: AuthContext, terms_id: str) -> None:
        """Einen Vertrag entfernen.

        Gedacht für den versehentlich angelegten Vertrag. Einen ABGELAUFENEN
        Vertrag zu löschen ist fachlich etwas anderes — er ist die Grundlage
        bereits erzeugter Abrechnungen —, technisch aber derselbe Vorgang; die
        Oberfläche warnt davor.
        """
        tenant_id = self._require_tenant(ctx)
        # VOR dem Delete lesen: danach ist nicht mehr feststellbar, welcher
        # Eigentümer und welche Objekte betroffen waren — und ohne das bliebe
        # ein Objekt gesperrt, dessen Vertrag gerade entfernt wurde (Wurzel 1).
        # Gleichzeitig ist das der Tenant-Scope des Item-Pfads (Wurzel 3/9).
        alt = self._require_own_terms(tenant_id, terms_id)
        objekte = self._kopplungs_objekte(
            tenant_id,
            str(alt["owner_id"]),
            str(alt["property_id"]) if alt.get("property_id") else None,
        )
        log.info(
            "billing_terms_loeschen_start",
            tenant_id=tenant_id,
            terms_id=terms_id,
            owner_id=str(alt["owner_id"]),
            objekte=len(objekte),
        )
        res = (
            self._db.table("owner_billing_terms")
            .delete()
            .eq("tenant_id", tenant_id)
            .eq("id", terms_id)
            .execute()
        )
        if not res.data:
            raise BillingError("Vertrag nicht gefunden.", status_code=404)
        self._vertragsende_koppeln(tenant_id, str(alt["owner_id"]), objekte)

    def vertrag_aufloesen(
        self,
        tenant_id: str,
        owner_id: str,
        property_id: str | None,
        stichtag: date,
    ) -> dict[str, Any] | None:
        """Welcher Vertrag galt am Stichtag — Objekt schlägt Eigentümer.

        Die zweite Auflösung, die die Rechenkette beim späteren Umstieg
        aufruft. Der Stichtag kommt vom AUFRUFER (Check-out der Buchung bzw.
        Ende des Abrechnungszeitraums) und nie aus ``date.today()``: sonst
        rechnete ein im September erzeugtes Juli-Statement mit dem
        September-Vertrag, und dieselbe Abrechnung ergäbe je nach Erzeugungstag
        eine andere Zahl.

        ``None`` heißt: für diesen Tag gibt es keinen Vertrag. Diese Etappe
        wertet das nicht aus — die bestehende Rechenkette bleibt führend. Beim
        Umstieg ist ``None`` ein klarer Fehler, kein Rückfall auf einen
        Standardsatz.
        """
        rows = (
            self._db.table("owner_billing_terms")
            .select(_TERMS_COLUMNS)
            .eq("tenant_id", tenant_id)
            .eq("owner_id", owner_id)
            .lte("gueltig_ab", stichtag.isoformat())
            .execute()
        ).data or []

        objekt_treffer: dict[str, Any] | None = None
        owner_treffer: dict[str, Any] | None = None
        for row in rows:
            bis_roh = row.get("gueltig_bis")
            if bis_roh and date.fromisoformat(str(bis_roh)) <= stichtag:
                continue
            zeilen_property = (
                str(row["property_id"]) if row.get("property_id") else None
            )
            if zeilen_property is None:
                owner_treffer = row
            elif property_id and zeilen_property == property_id:
                objekt_treffer = row
        return objekt_treffer or owner_treffer

    def naechster_vertragsbeginn(
        self,
        tenant_id: str,
        owner_id: str,
        property_id: str | None,
        stichtag: date,
    ) -> date | None:
        """Wann beginnt der ERSTE Vertrag NACH dem Stichtag — oder ``None``.

        Die Diagnose-Schwester von ``vertrag_aufloesen``: sie rechnet nichts,
        sie erklärt. Live am 02.09.2026: der Vertrag des Eigentümers stand
        mit 20 % in der DB, galt aber erst ab dem 12.08.; eine Buchung mit
        Abreise 09.08. fand am Stichtag keinen Vertrag, und die Abrechnung
        meldete „kein Provisionssatz hinterlegt". Der Betrieb suchte den
        Satz in den Stammdaten — wo er nie fehlte. Mit dem Datum des nächsten
        Vertragsbeginns lautet die Meldung stattdessen „Vertrag gilt erst ab
        12.08.2026, Abreise 09.08.2026 liegt davor" — und zeigt auf den
        Handgriff (Vertragsbeginn zurückdatieren), nicht auf eine Maske, in
        der nichts zu tun ist.

        Objekt- und Eigentümerverträge zählen gleich, weil beide die Lücke
        schließen würden. ``None`` heißt: nach dem Stichtag beginnt kein
        Vertrag — dann fehlt er wirklich.
        """
        rows = (
            self._db.table("owner_billing_terms")
            .select("property_id, gueltig_ab")
            .eq("tenant_id", tenant_id)
            .eq("owner_id", owner_id)
            .gt("gueltig_ab", stichtag.isoformat())
            .execute()
        ).data or []
        kandidaten: list[date] = []
        for row in rows:
            zeilen_property = (
                str(row["property_id"]) if row.get("property_id") else None
            )
            if zeilen_property is not None and zeilen_property != property_id:
                continue
            try:
                kandidaten.append(date.fromisoformat(str(row["gueltig_ab"])[:10]))
            except (KeyError, ValueError, TypeError):
                continue
        return min(kandidaten) if kandidaten else None

    # ==================================================================
    # C) Portal-Abzugssätze (0364)
    # ==================================================================

    @staticmethod
    def _satz_row(
        row: dict[str, Any], *, heute: date
    ) -> PortalAbzugssatzResponse:
        ab = date.fromisoformat(str(row["gueltig_ab"]))
        bis_roh = row.get("gueltig_bis")
        bis = date.fromisoformat(str(bis_roh)) if bis_roh else None
        provision = float(row["provision_pct"])
        gebuehr = _float(row.get("zahlungsgebuehr_pct"))
        return PortalAbzugssatzResponse(
            id=str(row["id"]),
            kanal=str(row["kanal"]),
            property_id=(
                str(row["property_id"]) if row.get("property_id") else None
            ),
            provision_pct=provision,
            zahlungsgebuehr_pct=gebuehr,
            gueltig_ab=ab,
            gueltig_bis=bis,
            notiz=row.get("notiz"),
            created_at=_iso(row.get("created_at")),
            updated_at=_iso(row.get("updated_at")),
            # Halb offenes Intervall [ab, bis): der Endtag gehört schon zum
            # Folgesatz.
            aktuell=ab <= heute and (bis is None or heute < bis),
            gesamt_pct=provision + (gebuehr or 0.0),
        )

    def saetze_liste(self, ctx: AuthContext) -> PortalAbzugssatzListResponse:
        """Alle Portal-Abzugssätze des Betriebs — mit Historie.

        Die Historie gehört dazu: eine Abrechnung aus dem Juli ist nicht
        nachvollziehbar, wenn im September ein anderer Satz gilt und der alte
        nicht mehr sichtbar ist.
        """
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("portal_abzugssaetze")
            .select(_SAETZE_COLUMNS)
            .eq("tenant_id", tenant_id)
            .order("kanal")
            .order("gueltig_ab", desc=True)
            .execute()
        ).data or []
        heute = date.today()
        return PortalAbzugssatzListResponse(
            items=[self._satz_row(r, heute=heute) for r in rows]
        )

    def _require_own_satz(
        self, tenant_id: str, satz_id: str
    ) -> dict[str, Any]:
        """Einen Satz tenant-gescoped laden (Wurzel 3/9).

        Derselbe Scope wie im List-Pfad — ohne ihn könnte ein Nutzer mit
        gültigem Token den Satz eines fremden Betriebs ändern, wenn er die ID
        kennt. Ein geänderter Satz verschiebt echte Auszahlungen.
        """
        res = (
            self._db.table("portal_abzugssaetze")
            .select(_SAETZE_COLUMNS)
            .eq("tenant_id", tenant_id)
            .eq("id", satz_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise BillingError("Portal-Satz nicht gefunden.", status_code=404)
        return res.data[0]

    def satz_anlegen(
        self, ctx: AuthContext, req: PortalAbzugssatzCreate
    ) -> PortalAbzugssatzResponse:
        """Einen Portal-Abzugssatz anlegen.

        Eine Satzänderung des Portals ist ein NEUER Satz ab Datum X, kein
        Überschreiben — sonst rechnete eine Juli-Abrechnung rückwirkend mit dem
        September-Satz.
        """
        tenant_id = self._require_tenant(ctx)
        if req.property_id:
            self._require_own_property(tenant_id, req.property_id)
        zeile = {
            "tenant_id": tenant_id,
            "kanal": req.kanal,
            "property_id": req.property_id,
            "gueltig_ab": req.gueltig_ab.isoformat(),
            "gueltig_bis": (
                req.gueltig_bis.isoformat() if req.gueltig_bis else None
            ),
            "provision_pct": req.provision_pct,
            "zahlungsgebuehr_pct": req.zahlungsgebuehr_pct,
            "notiz": req.notiz,
            "erstellt_von": ctx.user_id,
        }
        try:
            res = (
                self._db.table("portal_abzugssaetze").insert(zeile).execute()
            )
        except APIError as exc:
            if exc.code == _EXCLUSION_VERLETZUNG:
                raise BillingError(
                    f"Für „{req.kanal}“ gilt in diesem Zeitraum schon ein "
                    "anderer Satz. Befriste den alten oder wähle ein späteres "
                    "Startdatum.",
                    status_code=409,
                ) from exc
            raise
        return self._satz_row(res.data[0], heute=date.today())

    def satz_aendern(
        self, ctx: AuthContext, satz_id: str, req: PortalAbzugssatzUpdate
    ) -> PortalAbzugssatzResponse:
        """Einen Satz korrigieren — für den Tippfehler, nicht für die Ablösung."""
        tenant_id = self._require_tenant(ctx)
        alt = self._require_own_satz(tenant_id, satz_id)
        aenderung: dict[str, Any] = {}
        if req.provision_pct is not None:
            aenderung["provision_pct"] = req.provision_pct
        if req.ohne_zahlungsgebuehr:
            # Ausdrücklich „erhebt keine" — nicht 0, das wäre eine vereinbarte
            # Null-Gebühr und damit eine andere Aussage.
            aenderung["zahlungsgebuehr_pct"] = None
        elif req.zahlungsgebuehr_pct is not None:
            aenderung["zahlungsgebuehr_pct"] = req.zahlungsgebuehr_pct
        if req.gueltig_ab is not None:
            aenderung["gueltig_ab"] = req.gueltig_ab.isoformat()
        if req.ohne_gueltig_bis:
            aenderung["gueltig_bis"] = None
        elif req.gueltig_bis is not None:
            aenderung["gueltig_bis"] = req.gueltig_bis.isoformat()
        if req.notiz is not None:
            aenderung["notiz"] = req.notiz
        if not aenderung:
            return self._satz_row(alt, heute=date.today())

        # Zeitraum nach der Zusammenführung prüfen: ein PATCH, der nur
        # `gueltig_ab` schickt, könnte es hinter das bestehende `gueltig_bis`
        # schieben. Der DB-CHECK fängt das ab, aber mit Constraint-Namen statt
        # einer Meldung, die jemand versteht.
        neu_ab = date.fromisoformat(
            str(aenderung.get("gueltig_ab", alt["gueltig_ab"]))
        )
        bis_wert = (
            aenderung["gueltig_bis"]
            if "gueltig_bis" in aenderung
            else alt.get("gueltig_bis")
        )
        neu_bis = date.fromisoformat(str(bis_wert)) if bis_wert else None
        if neu_bis is not None and neu_bis <= neu_ab:
            raise BillingError(
                "„Gültig bis“ muss nach „Gültig ab“ liegen.", status_code=422
            )
        aenderung["updated_at"] = "now()"
        try:
            res = (
                self._db.table("portal_abzugssaetze")
                .update(aenderung)
                .eq("tenant_id", tenant_id)
                .eq("id", satz_id)
                .execute()
            )
        except APIError as exc:
            if exc.code == _EXCLUSION_VERLETZUNG:
                raise BillingError(
                    "Der geänderte Zeitraum überschneidet sich mit einem "
                    "anderen Satz dieses Kanals.",
                    status_code=409,
                ) from exc
            raise
        if not res.data:
            raise BillingError("Portal-Satz nicht gefunden.", status_code=404)
        return self._satz_row(res.data[0], heute=date.today())

    def satz_loeschen(self, ctx: AuthContext, satz_id: str) -> None:
        """Einen versehentlich angelegten Satz entfernen.

        Einen ABGELAUFENEN Satz sollte man nicht löschen — er begründet die
        Zahlen alter Abrechnungen. Das Löschen ist für den Fehleintrag.
        """
        tenant_id = self._require_tenant(ctx)
        self._require_own_satz(tenant_id, satz_id)
        self._db.table("portal_abzugssaetze").delete().eq(
            "tenant_id", tenant_id
        ).eq("id", satz_id).execute()

    def portal_satz_aufloesen(
        self,
        tenant_id: str,
        kanal: str,
        property_id: str | None,
        stichtag: date,
    ) -> dict[str, Any] | None:
        """Welcher Portal-Abzugssatz galt am Stichtag — Objekt schlägt Betrieb.

        Dieselbe Vorrang- und Zeitachsen-Logik wie ``vertrag_aufloesen`` (0364
        ist bewusst nach demselben Muster gebaut): halb offenes Intervall
        ``[ab, bis)``, Stichtag vom AUFRUFER (Check-out der Buchung), nie
        ``date.today()``.

        ``None`` heißt: für diesen Kanal ist am Stichtag kein Satz hinterlegt.
        Das ist KEIN „0 % Abzug" — die Rechenkette wirft dann
        ``PayoutUnbekannt("portal_abzug")``, sofern das Portal auch keinen
        Betrag mitgemeldet hat.
        """
        kanal_norm = (kanal or "").strip().lower()
        if not kanal_norm:
            return None
        rows = (
            self._db.table("portal_abzugssaetze")
            .select(
                "kanal, property_id, gueltig_ab, gueltig_bis, "
                "provision_pct, zahlungsgebuehr_pct"
            )
            .eq("tenant_id", tenant_id)
            .eq("kanal", kanal_norm)
            .lte("gueltig_ab", stichtag.isoformat())
            .execute()
        ).data or []

        objekt_treffer: dict[str, Any] | None = None
        betrieb_treffer: dict[str, Any] | None = None
        for row in rows:
            bis_roh = row.get("gueltig_bis")
            if bis_roh and date.fromisoformat(str(bis_roh)) <= stichtag:
                continue
            zeilen_property = (
                str(row["property_id"]) if row.get("property_id") else None
            )
            if zeilen_property is None:
                betrieb_treffer = row
            elif property_id and zeilen_property == property_id:
                objekt_treffer = row
        return objekt_treffer or betrieb_treffer
