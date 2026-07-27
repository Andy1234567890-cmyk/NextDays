"""Steuerzahler-Angaben — Lesen, Anlegen, Bestaetigen (DAC7/PStTG).

Ein Eintrag je (tenant_id, country). Scope IMMER auf ctx.tenant_id (Wurzel 3) —
der Service-Client umgeht RLS.

Die Liste der FEHLENDEN Laender wird aus den Objekten des Betriebs ABGELEITET,
nicht gepflegt: DAC7 verlangt Angaben fuer jedes Land, in dem der Anbieter
Objekte hat. Eine zweite Liste danebenzuhalten waere ein Gegenzustand, der
auseinanderlaeuft (Wurzel 1/4).
"""
from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import fetch_all_rows

from .schemas import (
    ObjektAngabe,
    ObjektAngabeStatus,
    TaxpayerCreate,
    TaxpayerEntry,
    TaxpayerOverview,
)

log = get_logger("nextdays.taxpayer")


class TaxpayerError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


_SPALTEN = (
    "id, country, kind, tin, first_name, last_name, date_of_birth, "
    "birth_place_city, birth_place_country, legal_name, "
    "business_registration_number, address_line1, address_line2, "
    "postal_code, city, confirmed_at, updated_at"
)

# Spalten fuer die Objektangaben (§ 14 Abs. 4 Nr. 6).
_OBJEKT_SPALTEN = (
    "id, title, city, country, land_registration_number, "
    "land_registration_unavailable, land_registration_confirmed_at"
)


class TaxpayerService:
    def __init__(self, db: Client) -> None:
        self._db = db

    # -- Lesen --------------------------------------------------------------

    def overview(self, ctx: AuthContext) -> TaxpayerOverview:
        """Eintraege, fehlende Laender und die USt-IdNr. fuer den Tab."""
        tenant_id = self._tenant(ctx)
        eintraege = self.list(ctx)
        abgedeckt = {e.country for e in eintraege}
        return TaxpayerOverview(
            eintraege=eintraege,
            fehlende_laender=sorted(
                self._objekt_laender(tenant_id) - abgedeckt
            ),
            vat_id=self._vat_id(tenant_id),
            objekte_ohne_angabe=self._objekte_ohne_angabe(tenant_id),
        )

    # -- § 14 Abs. 4 Nr. 6: Grundbuchnummer je Objekt ----------------------

    def objektangaben(self, ctx: AuthContext) -> list[ObjektAngabeStatus]:
        """Stand der Grundbuchnummern über alle Objekte des Betriebs."""
        rows = (
            self._db.table("properties")
            .select(_OBJEKT_SPALTEN)
            .eq("tenant_id", self._tenant(ctx))
            .order("title")
            .execute()
        ).data or []
        return [
            ObjektAngabeStatus(
                property_id=r["id"],
                title=r.get("title"),
                city=r.get("city"),
                country=r.get("country"),
                land_registration_number=r.get("land_registration_number"),
                land_registration_unavailable=bool(
                    r.get("land_registration_unavailable")
                ),
                confirmed_at=r.get("land_registration_confirmed_at"),
            )
            for r in rows
        ]

    def objektangabe_speichern(
        self, ctx: AuthContext, property_id: str, daten: ObjektAngabe
    ) -> ObjektAngabeStatus:
        """Grundbuchnummer eines Objekts setzen oder als nicht vorhanden
        erklaeren.

        Der Scope wird beim LADEN erzwungen, nicht danach geprueft (Wurzel 3):
        ein Objekt eines fremden Betriebs ist hier schlicht nicht auffindbar.
        """
        tenant_id = self._tenant(ctx)
        vorhanden = (
            self._db.table("properties")
            .select("id")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not vorhanden:
            raise TaxpayerError("Objekt nicht gefunden.", status_code=404)

        self._db.table("properties").update(
            {
                "land_registration_number": daten.land_registration_number,
                "land_registration_unavailable": (
                    daten.land_registration_unavailable
                ),
                # Auch das Ergebnis „keine Nummer" ist eine Erhebung — der
                # Zeitstempel belegt sie (Sorgfaltspflicht, § 25 Abs. 1 Nr. 6).
                "land_registration_confirmed_at": datetime.now(UTC).isoformat(),
            }
        ).eq("id", property_id).eq("tenant_id", tenant_id).execute()

        log.info(
            "dac7_objektangabe_gespeichert",
            tenant_id=tenant_id,
            property_id=property_id,
            hat_nummer=bool(daten.land_registration_number),
            nicht_vorhanden=daten.land_registration_unavailable,
        )
        return self._objektangabe(tenant_id, property_id)

    def _objektangabe(
        self, tenant_id: str, property_id: str
    ) -> ObjektAngabeStatus:
        rows = (
            self._db.table("properties")
            .select(_OBJEKT_SPALTEN)
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise TaxpayerError(
                "Gespeicherte Objektangabe nicht gefunden.", status_code=500
            )
        r = rows[0]
        return ObjektAngabeStatus(
            property_id=r["id"],
            title=r.get("title"),
            city=r.get("city"),
            country=r.get("country"),
            land_registration_number=r.get("land_registration_number"),
            land_registration_unavailable=bool(
                r.get("land_registration_unavailable")
            ),
            confirmed_at=r.get("land_registration_confirmed_at"),
        )

    def _objekte_ohne_angabe(self, tenant_id: str) -> int:
        """Objekte, bei denen die Nummer weder erfasst noch als nicht
        vorhanden erklaert wurde."""
        res = (
            self._db.table("properties")
            .select("id", count="exact")
            .eq("tenant_id", tenant_id)
            .is_("land_registration_number", "null")
            .eq("land_registration_unavailable", False)
            .execute()
        )
        return res.count or 0

    def list(self, ctx: AuthContext) -> list[TaxpayerEntry]:
        rows = (
            self._db.table("taxpayer_info")
            .select(_SPALTEN)
            .eq("tenant_id", self._tenant(ctx))
            .order("country")
            .execute()
        ).data or []
        return [TaxpayerEntry(**row) for row in rows]

    # -- Schreiben ----------------------------------------------------------

    def upsert(self, ctx: AuthContext, daten: TaxpayerCreate) -> TaxpayerEntry:
        """Angaben fuer ein Land anlegen — oder die STAMMDATEN korrigieren.

        Zwei-Klassen-Modell nach Airbnbs Vorbild (Hilfeartikel 417):

          aenderbar:     Name, Anschrift, Geburtsort — Tippfehler und Umzuege
          NICHT aenderbar: Steuernummer, Firmenname, Art (individual/entity)

        Der Grund ist fachlich, nicht kosmetisch: Eine geaenderte Steuernummer
        ist ein ANDERER Steuerpflichtiger, kein korrigierter Datensatz. Wuerde
        man sie still ueberschreiben, stuende in der naechsten Meldung eine
        andere Person unter demselben Eintrag — und die bereits gemeldete
        Selbstauskunft waere nicht mehr nachvollziehbar. Wer die Nummer
        wechselt, muss den Eintrag entfernen und neu anlegen (409).

        `confirmed_at` wird bei jedem Schreiben gesetzt: wer abschickt,
        erklaert die Angaben als richtig (DAC7 verlangt die Selbstauskunft).
        """
        tenant_id = self._tenant(ctx)
        land = daten.country.upper()
        bestand = (
            self._db.table("taxpayer_info")
            .select("id, tin, kind, legal_name")
            .eq("tenant_id", tenant_id)
            .eq("country", land)
            .limit(1)
            .execute()
        ).data
        if bestand:
            self._pruefe_unveraenderliche(bestand[0], daten)

        zeile = daten.model_dump(mode="json", exclude_none=True)
        jetzt = datetime.now(UTC).isoformat()
        antwort = (
            self._db.table("taxpayer_info")
            .upsert(
                {
                    **zeile,
                    "tenant_id": tenant_id,
                    "confirmed_at": jetzt,
                    "updated_at": jetzt,
                },
                on_conflict="tenant_id,country",
            )
            .execute()
        )
        if not antwort.data:
            raise TaxpayerError(
                "Steuerangaben konnten nicht gespeichert werden.", status_code=500
            )
        log.info(
            "taxpayer_info_gespeichert",
            tenant_id=tenant_id,
            country=land,
            kind=daten.kind.value,
            neu=not bestand,
        )
        return self._eintrag(tenant_id, land)

    @staticmethod
    def _pruefe_unveraenderliche(
        bestand: dict, daten: TaxpayerCreate
    ) -> None:
        """Identitaetsbestimmende Felder duerfen nicht ueberschrieben werden.

        409 statt 400: der Zustand in der DB widerspricht dem Wunsch — der
        Nutzer muss den Eintrag entfernen, nicht seine Eingabe reparieren.
        """
        gesperrt = (
            ("tin", bestand.get("tin"), daten.tin, "Steuernummer"),
            ("kind", bestand.get("kind"), daten.kind.value, "Art des Steuerzahlers"),
            (
                "legal_name",
                bestand.get("legal_name"),
                daten.legal_name,
                "Firmenname",
            ),
        )
        geaendert = [
            bezeichnung
            for _, alt, neu, bezeichnung in gesperrt
            if alt and neu and alt != neu
        ]
        if geaendert:
            felder = ", ".join(geaendert)
            raise TaxpayerError(
                f"{felder} kann nicht geändert werden. Entferne die "
                "Steuerangaben für dieses Land und lege sie neu an.",
                status_code=409,
            )

    def delete(self, ctx: AuthContext, country: str) -> None:
        """Angaben eines Landes entfernen. Scope auf den eigenen Tenant."""
        tenant_id = self._tenant(ctx)
        land = (country or "").upper()
        vorhanden = (
            self._db.table("taxpayer_info")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("country", land)
            .limit(1)
            .execute()
        ).data
        if not vorhanden:
            raise TaxpayerError(
                f"Für {land} sind keine Steuerangaben hinterlegt.", status_code=404
            )
        self._db.table("taxpayer_info").delete().eq("tenant_id", tenant_id).eq(
            "country", land
        ).execute()
        log.info("taxpayer_info_geloescht", tenant_id=tenant_id, country=land)

    # -- Intern -------------------------------------------------------------

    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise TaxpayerError("Kein Betrieb im Kontext.", status_code=400)
        return ctx.tenant_id

    def _eintrag(self, tenant_id: str, country: str) -> TaxpayerEntry:
        rows = (
            self._db.table("taxpayer_info")
            .select(_SPALTEN)
            .eq("tenant_id", tenant_id)
            .eq("country", country.upper())
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise TaxpayerError(
                "Gespeicherte Steuerangaben nicht gefunden.", status_code=500
            )
        return TaxpayerEntry(**rows[0])

    def _objekt_laender(self, tenant_id: str) -> set[str]:
        """Laender, in denen der Betrieb Objekte hat — dort greift DAC7.

        fetch_all_rows: bei >1000 Objekten fehlte sonst ein Land in
        `fehlende_laender`, und die Enforcement-Kaskade forderte die Angaben
        dafuer nie an.
        """
        rows = fetch_all_rows(
            self._db.table("properties")
            .select("country")
            .eq("tenant_id", tenant_id)
            .order("id")
        )
        return {
            (r["country"] or "").upper() for r in rows if r.get("country")
        }

    def _vat_id(self, tenant_id: str) -> str | None:
        """USt-IdNr. aus dem Rechnungsprofil — im Tab nur ANGEZEIGT.

        Sie liegt bewusst weiter auf tenant_billing_profile: sie steuert die
        Rechnungsstellung, nicht die DAC7-Meldung. Zwei Speicherorte fuer
        denselben Wert waeren ein Datenfehler (Wurzel 4).
        """
        rows = (
            self._db.table("tenant_billing_profile")
            .select("vat_id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0].get("vat_id") if rows else None
