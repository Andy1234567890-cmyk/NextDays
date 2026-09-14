"""Fachlogik des Bereichs »kontenplan«: Buchungskonten, Kostenstellen,
Zahlungsarten und die Pflege der Nummernkreise.

Was vom alten Werkzeug blieb, ist die FORM (Kontonummer/Name/Typ, Kostenstelle
mit Nummer, Zahlungsart mit Typ und Standard-Flag, Nummernkreis mit Format und
Vorschau). Die REGELN stehen hier und nur hier:

  * Kontonummer je Tenant eindeutig — Service prüft, der Unique-Index (0671)
    fängt Doppelklick und Retry (Wurzel 2, 23505 → 409).
  * Systemkonten (Standard-Import) sind nicht löschbar, nur deaktivierbar
    (409). Konten, die von anderen Tabellen referenziert werden, ebenfalls —
    die Quellen stehen in `VERWENDUNGS_QUELLEN` (heute leer: keine Tabelle
    im Repo referenziert `booking_accounts`; sobald Ausgaben/Belege ein
    `booking_account_id` tragen, kommt das Paar hier hinein).
  * Standard-Import ist idempotent: vorhandene Nummern werden übersprungen,
    nicht überschrieben (ein umbenanntes Konto bleibt umbenannt).
  * Genau EINE Standard-Zahlungsart je Tenant: der Service setzt die alte
    zurück, der partielle Unique-Index (0673) hält gegen Rennen.
  * Nummernkreise: Präfix/Suffix/Stellen jederzeit, der Startwert NUR solange
    `next_value == start_value` (0674) — vergebene Nummern werden nie
    verstellt (GoBD). Ein `POST …/next` gibt es weiterhin bewusst nicht.

Jede per-ID-Ladung läuft über `load_scoped` (Wurzel 3); Listen filtern immer
auf `tenant_id`. Jede Zustandsänderung loggt Tenant + ID.
"""

from __future__ import annotations

import re
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import load_scoped

from ...service import BuchhaltungService
from .schemas import (
    KONTENRAHMEN,
    LIMIT_MAX,
    BookingAccountCreate,
    BookingAccountResponse,
    BookingAccountUpdate,
    CostCenterCreate,
    CostCenterResponse,
    CostCenterUpdate,
    CreateDefaultsResult,
    ImportStandardResult,
    NumberSequenceUpdate,
    PaymentMethodCreate,
    PaymentMethodResponse,
    PaymentMethodUpdate,
)
from .skr import standardkonten

log = get_logger("nextdays.buchhaltung.kontenplan")

# (Tabelle, Spalte), die auf booking_accounts.id zeigen. Ein referenziertes
# Konto wird nicht gelöscht, nur deaktiviert (409). Heute leer — siehe Modulkopf.
VERWENDUNGS_QUELLEN: tuple[tuple[str, str], ...] = ()

_UNIQUE_VIOLATION = "23505"

# `RE-{number:4}/26` → prefix, padding, suffix. Zeichenvorrat wie im Schema.
_FORMAT_MUSTER = re.compile(
    r"^(?P<prefix>[A-Za-z0-9._/-]{0,20})\{number(?::(?P<pad>\d{1,2}))?\}"
    r"(?P<suffix>[A-Za-z0-9._/-]{0,20})$"
)


class KontenplanError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _nicht_gefunden(was: str) -> KontenplanError:
    return KontenplanError(f"{was} nicht gefunden.", status_code=404)


def _ist_unique_konflikt(exc: APIError) -> bool:
    return str(getattr(exc, "code", "") or "") == _UNIQUE_VIOLATION


def _json(payload: dict[str, Any]) -> dict[str, Any]:
    """Decimal → str für PostgREST (numeric-Spalten nehmen Text an)."""
    return {k: (str(v) if type(v).__name__ == "Decimal" else v) for k, v in payload.items()}


class KontenplanService:
    """Alle Operationen sind auf `ctx.tenant_id` gescopet; `company_id` aus
    dem Pfad ist Altlast und wird ignoriert."""

    def __init__(self, db: Client) -> None:
        self._db = db
        # Nummernkreis-Form und Typ-Tabelle kommen aus dem Bestand — EINE
        # Quelle für `{type, format, nextNumber, …}`, keine zweite Kopie.
        self._bestand = BuchhaltungService(db)

    # ------------------------------------------------------------- Hilfen
    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise KontenplanError("Kein Mandant im Kontext.", status_code=403)
        return ctx.tenant_id

    @staticmethod
    def _limit(limit: int | None) -> int:
        if limit is None:
            return LIMIT_MAX
        if limit < 1 or limit > LIMIT_MAX:
            raise KontenplanError(f"limit muss zwischen 1 und {LIMIT_MAX} liegen.", status_code=422)
        return limit

    def _insert(self, table: str, payload: dict, *, konflikt: str) -> dict:
        try:
            res = self._db.table(table).insert(_json(payload)).execute()
        except APIError as exc:
            if _ist_unique_konflikt(exc):
                raise KontenplanError(konflikt, status_code=409) from exc
            raise
        rows = res.data or []
        if not rows:
            raise KontenplanError("Anlegen fehlgeschlagen.", status_code=500)
        return rows[0]

    def _update(
        self, table: str, row_id: str, tenant_id: str, payload: dict, *, konflikt: str
    ) -> dict:
        try:
            res = (
                self._db.table(table)
                .update(_json(payload))
                .eq("id", row_id)
                .eq("tenant_id", tenant_id)
                .execute()
            )
        except APIError as exc:
            if _ist_unique_konflikt(exc):
                raise KontenplanError(konflikt, status_code=409) from exc
            raise
        rows = res.data or []
        if not rows:
            raise _nicht_gefunden("Eintrag")
        return rows[0]

    def _delete(self, table: str, row_id: str, tenant_id: str) -> None:
        self._db.table(table).delete().eq("id", row_id).eq("tenant_id", tenant_id).execute()

    @staticmethod
    def _aenderungen(data: Any) -> dict:  # noqa: ANN401 — Pydantic-Modell beliebiger Klasse
        """Nur gesetzte Felder (PATCH-Semantik, auch für PUT: Fehlendes bleibt)."""
        return data.model_dump(exclude_unset=True, by_alias=False)

    # ------------------------------------------------------ Buchungskonten
    def list_booking_accounts(
        self,
        ctx: AuthContext,
        *,
        type_: str | None = None,
        active: bool | None = None,
        search: str | None = None,
        limit: int | None = None,
    ) -> list[BookingAccountResponse]:
        tenant_id = self._tenant(ctx)
        grenze = self._limit(limit)
        q = self._db.table("booking_accounts").select("*").eq("tenant_id", tenant_id)
        if type_ is not None:
            q = q.eq("type", type_)
        if active is not None:
            q = q.eq("active", active)
        rows = (q.order("number").limit(LIMIT_MAX).execute()).data or []
        if search:
            s = search.strip().lower()
            rows = [
                r
                for r in rows
                if s in str(r.get("number", "")).lower() or s in str(r.get("name", "")).lower()
            ]
        return [BookingAccountResponse.model_validate(r) for r in rows[:grenze]]

    def create_booking_account(
        self, ctx: AuthContext, data: BookingAccountCreate
    ) -> BookingAccountResponse:
        tenant_id = self._tenant(ctx)
        payload = {**data.model_dump(by_alias=False), "tenant_id": tenant_id, "is_system": False}
        row = self._insert(
            "booking_accounts",
            payload,
            konflikt=f"Kontonummer {data.number} ist bereits vergeben.",
        )
        log.info(
            "kontenplan_konto_angelegt", tenant_id=tenant_id, id=row.get("id"), number=data.number
        )
        return BookingAccountResponse.model_validate(row)

    def update_booking_account(
        self, ctx: AuthContext, account_id: str, data: BookingAccountUpdate
    ) -> BookingAccountResponse:
        tenant_id = self._tenant(ctx)
        bestand = load_scoped(
            self._db, "booking_accounts", account_id, tenant_id, not_found=_nicht_gefunden("Konto")
        )
        aenderungen = self._aenderungen(data)
        if not aenderungen:
            return BookingAccountResponse.model_validate(bestand)
        if bestand.get("is_system") and any(k in aenderungen for k in ("number", "type")):
            # Nummer/Typ eines Standardkontos sind die Identität im Kontenrahmen.
            raise KontenplanError(
                "Nummer und Typ eines Standardkontos sind nicht änderbar.", status_code=409
            )
        row = self._update(
            "booking_accounts",
            account_id,
            tenant_id,
            aenderungen,
            konflikt=f"Kontonummer {aenderungen.get('number')} ist bereits vergeben.",
        )
        log.info(
            "kontenplan_konto_geaendert",
            tenant_id=tenant_id,
            id=account_id,
            felder=sorted(aenderungen),
        )
        return BookingAccountResponse.model_validate(row)

    def _konto_in_verwendung(self, tenant_id: str, account_id: str) -> bool:
        for table, column in VERWENDUNGS_QUELLEN:
            res = (
                self._db.table(table)
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq(column, account_id)
                .limit(1)
                .execute()
            )
            if res.data:
                return True
        return False

    def delete_booking_account(self, ctx: AuthContext, account_id: str) -> None:
        tenant_id = self._tenant(ctx)
        bestand = load_scoped(
            self._db, "booking_accounts", account_id, tenant_id, not_found=_nicht_gefunden("Konto")
        )
        if bestand.get("is_system"):
            raise KontenplanError(
                "Standardkonten können nicht gelöscht, nur deaktiviert werden.", status_code=409
            )
        if self._konto_in_verwendung(tenant_id, account_id):
            raise KontenplanError(
                "Das Konto wird bereits bebucht und kann nur deaktiviert werden.", status_code=409
            )
        self._delete("booking_accounts", account_id, tenant_id)
        log.info(
            "kontenplan_konto_geloescht",
            tenant_id=tenant_id,
            id=account_id,
            number=bestand.get("number"),
        )

    def import_standard(self, ctx: AuthContext, kontenrahmen: str) -> ImportStandardResult:
        tenant_id = self._tenant(ctx)
        if kontenrahmen not in KONTENRAHMEN:
            raise KontenplanError("kontenrahmen muss SKR03 oder SKR04 sein.", status_code=422)
        vorhanden = {
            str(r["number"])
            for r in (
                self._db.table("booking_accounts")
                .select("number")
                .eq("tenant_id", tenant_id)
                .limit(LIMIT_MAX)
                .execute()
            ).data
            or []
        }
        angelegt = 0
        uebersprungen = 0
        for konto in standardkonten(kontenrahmen):
            if konto["number"] in vorhanden:
                uebersprungen += 1
                continue
            try:
                self._db.table("booking_accounts").insert(
                    {**konto, "tenant_id": tenant_id}
                ).execute()
            except APIError as exc:
                if not _ist_unique_konflikt(exc):
                    raise
                # Paralleler Import hat gewonnen — Idempotenz (Wurzel 2).
                uebersprungen += 1
                continue
            angelegt += 1
        log.info(
            "kontenplan_standard_importiert",
            tenant_id=tenant_id,
            kontenrahmen=kontenrahmen,
            angelegt=angelegt,
            uebersprungen=uebersprungen,
        )
        return ImportStandardResult(
            kontenrahmen=kontenrahmen,
            angelegt=angelegt,
            uebersprungen=uebersprungen,
            accounts=self.list_booking_accounts(ctx),
        )

    # ------------------------------------------------------- Kostenstellen
    def list_cost_centers(
        self, ctx: AuthContext, *, active: bool | None = None, limit: int | None = None
    ) -> list[CostCenterResponse]:
        tenant_id = self._tenant(ctx)
        grenze = self._limit(limit)
        q = self._db.table("cost_centers").select("*").eq("tenant_id", tenant_id)
        if active is not None:
            q = q.eq("active", active)
        rows = (q.order("number").limit(grenze).execute()).data or []
        return [CostCenterResponse.model_validate(r) for r in rows]

    def create_cost_center(self, ctx: AuthContext, data: CostCenterCreate) -> CostCenterResponse:
        tenant_id = self._tenant(ctx)
        row = self._insert(
            "cost_centers",
            {**data.model_dump(by_alias=False), "tenant_id": tenant_id},
            konflikt=f"Kostenstelle {data.number} existiert bereits.",
        )
        log.info("kontenplan_kostenstelle_angelegt", tenant_id=tenant_id, id=row.get("id"))
        return CostCenterResponse.model_validate(row)

    def update_cost_center(
        self, ctx: AuthContext, center_id: str, data: CostCenterUpdate
    ) -> CostCenterResponse:
        tenant_id = self._tenant(ctx)
        bestand = load_scoped(
            self._db,
            "cost_centers",
            center_id,
            tenant_id,
            not_found=_nicht_gefunden("Kostenstelle"),
        )
        aenderungen = self._aenderungen(data)
        if not aenderungen:
            return CostCenterResponse.model_validate(bestand)
        row = self._update(
            "cost_centers",
            center_id,
            tenant_id,
            aenderungen,
            konflikt=f"Kostenstelle {aenderungen.get('number')} existiert bereits.",
        )
        log.info("kontenplan_kostenstelle_geaendert", tenant_id=tenant_id, id=center_id)
        return CostCenterResponse.model_validate(row)

    def delete_cost_center(self, ctx: AuthContext, center_id: str) -> None:
        tenant_id = self._tenant(ctx)
        load_scoped(
            self._db,
            "cost_centers",
            center_id,
            tenant_id,
            not_found=_nicht_gefunden("Kostenstelle"),
        )
        self._delete("cost_centers", center_id, tenant_id)
        log.info("kontenplan_kostenstelle_geloescht", tenant_id=tenant_id, id=center_id)

    # -------------------------------------------------------- Zahlungsarten
    def list_payment_methods(
        self, ctx: AuthContext, *, active: bool | None = None, limit: int | None = None
    ) -> list[PaymentMethodResponse]:
        tenant_id = self._tenant(ctx)
        grenze = self._limit(limit)
        q = self._db.table("payment_methods").select("*").eq("tenant_id", tenant_id)
        if active is not None:
            q = q.eq("active", active)
        rows = (q.order("name").limit(grenze).execute()).data or []
        return [PaymentMethodResponse.model_validate(r) for r in rows]

    def _standard_zuruecksetzen(self, tenant_id: str, *, ausser: str | None) -> None:
        q = (
            self._db.table("payment_methods")
            .update({"is_default": False})
            .eq("tenant_id", tenant_id)
            .eq("is_default", True)
        )
        if ausser:
            q = q.neq("id", ausser)
        q.execute()

    def create_payment_method(
        self, ctx: AuthContext, data: PaymentMethodCreate
    ) -> PaymentMethodResponse:
        tenant_id = self._tenant(ctx)
        if data.is_default:
            self._standard_zuruecksetzen(tenant_id, ausser=None)
        row = self._insert(
            "payment_methods",
            {**data.model_dump(by_alias=False), "tenant_id": tenant_id},
            konflikt=f"Zahlungsart {data.name!r} existiert bereits.",
        )
        log.info("kontenplan_zahlungsart_angelegt", tenant_id=tenant_id, id=row.get("id"))
        return PaymentMethodResponse.model_validate(row)

    def update_payment_method(
        self, ctx: AuthContext, method_id: str, data: PaymentMethodUpdate
    ) -> PaymentMethodResponse:
        tenant_id = self._tenant(ctx)
        bestand = load_scoped(
            self._db,
            "payment_methods",
            method_id,
            tenant_id,
            not_found=_nicht_gefunden("Zahlungsart"),
        )
        aenderungen = self._aenderungen(data)
        if not aenderungen:
            return PaymentMethodResponse.model_validate(bestand)
        if aenderungen.get("is_default"):
            self._standard_zuruecksetzen(tenant_id, ausser=method_id)
        row = self._update(
            "payment_methods",
            method_id,
            tenant_id,
            aenderungen,
            konflikt=f"Zahlungsart {aenderungen.get('name')!r} existiert bereits.",
        )
        log.info("kontenplan_zahlungsart_geaendert", tenant_id=tenant_id, id=method_id)
        return PaymentMethodResponse.model_validate(row)

    def delete_payment_method(self, ctx: AuthContext, method_id: str) -> None:
        tenant_id = self._tenant(ctx)
        load_scoped(
            self._db,
            "payment_methods",
            method_id,
            tenant_id,
            not_found=_nicht_gefunden("Zahlungsart"),
        )
        self._delete("payment_methods", method_id, tenant_id)
        log.info("kontenplan_zahlungsart_geloescht", tenant_id=tenant_id, id=method_id)

    # -------------------------------------------------------- Nummernkreise
    def _kreis_aufloesen(self, sequence: str) -> tuple[str, str, str]:
        """`Rechnung` ODER `invoice` → (label, doc_type, prefix_vorgabe)."""
        typen = BuchhaltungService._DOC_TYPE_MAP  # noqa: SLF001 — eine Quelle für die Typen
        if sequence in typen:
            doc_type, prefix = typen[sequence]
            return sequence, doc_type, prefix
        for label, (doc_type, prefix) in typen.items():
            if doc_type == sequence:
                return label, doc_type, prefix
        raise KontenplanError(f"Unbekannter Nummernkreis '{sequence}'.", status_code=404)

    def _kreis_row(self, tenant_id: str, doc_type: str) -> dict | None:
        rows = (
            self._db.table("number_sequences")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("doc_type", doc_type)
            .is_("year", "null")
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def _kreis_antwort(self, tenant_id: str, label: str, row: dict | None) -> dict:
        antwort = self._bestand._kreis_als_bestand(tenant_id, label, row)  # noqa: SLF001
        antwort["canEdit"] = True
        antwort["startValue"] = (row or {}).get("start_value") or 1
        antwort["gezogen"] = bool(row) and int(row.get("next_value") or 1) > int(
            row.get("start_value") or 1
        )
        return antwort

    @staticmethod
    def _format_zerlegen(data: NumberSequenceUpdate) -> dict:
        felder: dict[str, Any] = {}
        if data.format is not None:
            treffer = _FORMAT_MUSTER.match(data.format.strip())
            if not treffer:
                raise KontenplanError(
                    "Format muss die Form PRÄFIX{number:N}SUFFIX haben, z. B. RE-{number:4}.",
                    status_code=422,
                )
            felder["prefix"] = treffer.group("prefix")
            felder["suffix"] = treffer.group("suffix")
            if treffer.group("pad") is not None:
                felder["padding"] = int(treffer.group("pad"))
        if data.prefix is not None:
            felder["prefix"] = data.prefix
        if data.suffix is not None:
            felder["suffix"] = data.suffix
        if data.padding is not None:
            felder["padding"] = data.padding
        pad = felder.get("padding")
        if pad is not None and not 1 <= pad <= 10:
            raise KontenplanError("Stellenzahl muss zwischen 1 und 10 liegen.", status_code=422)
        return felder

    def update_number_sequence(
        self, ctx: AuthContext, sequence: str, data: NumberSequenceUpdate
    ) -> dict:
        tenant_id = self._tenant(ctx)
        label, doc_type, prefix_vorgabe = self._kreis_aufloesen(sequence)
        felder = self._format_zerlegen(data)
        row = self._kreis_row(tenant_id, doc_type)
        if row is None:
            neu = {
                "tenant_id": tenant_id,
                "doc_type": doc_type,
                "prefix": felder.get("prefix", prefix_vorgabe),
                "suffix": felder.get("suffix", ""),
                "padding": felder.get("padding", BuchhaltungService._PADDING_VORGABE),  # noqa: SLF001
            }
            if data.next_number is not None:
                neu["next_value"] = data.next_number
                neu["start_value"] = data.next_number
            try:
                row = self._insert(
                    "number_sequences", neu, konflikt="Nummernkreis wird gerade angelegt."
                )
            except KontenplanError as exc:
                if exc.status_code != 409:
                    raise
                # Rennen mit next_document_number(): Zeile ist jetzt da → als Änderung.
                row = self._kreis_row(tenant_id, doc_type)
                if row is None:
                    raise
                return self.update_number_sequence(ctx, sequence, data)
            log.info("kontenplan_nummernkreis_angelegt", tenant_id=tenant_id, doc_type=doc_type)
            return self._kreis_antwort(tenant_id, label, row)

        if data.next_number is not None:
            gezogen = int(row.get("next_value") or 1) > int(row.get("start_value") or 1)
            if gezogen:
                raise KontenplanError(
                    "Startwert nicht änderbar: aus diesem Kreis wurden bereits Nummern vergeben.",
                    status_code=409,
                )
            felder["next_value"] = data.next_number
            felder["start_value"] = data.next_number
        if not felder:
            return self._kreis_antwort(tenant_id, label, row)
        row = self._update(
            "number_sequences", str(row["id"]), tenant_id, felder, konflikt="Nummernkreis-Konflikt."
        )
        log.info(
            "kontenplan_nummernkreis_geaendert",
            tenant_id=tenant_id,
            doc_type=doc_type,
            felder=sorted(felder),
        )
        return self._kreis_antwort(tenant_id, label, row)

    def create_default_sequences(self, ctx: AuthContext) -> CreateDefaultsResult:
        tenant_id = self._tenant(ctx)
        vorhanden = {
            r["doc_type"]
            for r in (
                self._db.table("number_sequences")
                .select("doc_type")
                .eq("tenant_id", tenant_id)
                .is_("year", "null")
                .execute()
            ).data
            or []
        }
        angelegt: list[str] = []
        typen = BuchhaltungService._DOC_TYPE_MAP  # noqa: SLF001
        for label, (doc_type, prefix) in typen.items():
            if doc_type in vorhanden:
                continue
            try:
                self._db.table("number_sequences").insert(
                    {"tenant_id": tenant_id, "doc_type": doc_type, "prefix": prefix}
                ).execute()
            except APIError as exc:
                if not _ist_unique_konflikt(exc):
                    raise
                continue
            angelegt.append(label)
        log.info("kontenplan_nummernkreise_vorgaben", tenant_id=tenant_id, angelegt=angelegt)
        return CreateDefaultsResult(
            angelegt=angelegt, sequences=self._bestand.list_number_sequences(ctx)
        )
