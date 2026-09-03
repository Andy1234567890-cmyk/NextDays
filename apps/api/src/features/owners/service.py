"""Service-Schicht für owners (verwaltete Eigentümer).

CRUD über die Service-Role mit EXPLIZITEM tenant-Scope: tenant_id stammt immer
aus dem verifizierten JWT (AuthContext), nie aus User-Input (gleiches Muster wie
properties.service). Objekt-Zuordnung mit Anteil + Provisions-Override. Optionale
Verknüpfung zu einem Owner-Login-User spiegelt sich ins Portal-Scoping
(owner_property_assignments via auth.OwnerAssignmentService).
"""
# pylint: disable=too-many-lines
# 1575 Zeilen (Limit 1500). Bewusst als EIN Modul: der Eigentuemer-Slice haelt
# Zuordnung, Aufenthalte, Abrechnung und Reporting zusammen, und diese Teile
# lesen sich gegenseitig. Ein Aufteilen entlang der Zeilenzahl statt entlang der
# Fachlichkeit erzeugt zwei Module mit zirkulaerem Import — dieselbe Begruendung
# wie in payments/service.py und calendar/service.py.
from __future__ import annotations

from postgrest.exceptions import APIError
from supabase import Client

from src.core.bestand import nur_im_bestand
from src.core.logging import get_logger, mask_email
from src.core.mail_sprache import normalisieren
from src.core.security import AuthContext
from src.core.supabase import load_scoped
from src.features.properties.schemas import types_for_accommodation

from .eigennutzungen import eigennutzungen_entfernen, eigennutzungen_laden
from .portalzugang import portalzugang_entfernen
from .schemas import (
    AvailablePropertiesResponse,
    AvailableProperty,
    OwnerByPropertyResponse,
    OwnerCreate,
    OwnerKontakt,
    OwnerListItem,
    OwnerListResponse,
    OwnerPropertyAssign,
    OwnerPropertyLink,
    OwnerResponse,
    OwnerUpdate,
    SliceHealth,
)

log = get_logger("nextdays.owners")

# Postgres-Fehlercode für eine Fremdschlüssel-Verletzung. Hier heißt er immer:
# der Mandant aus dem Token existiert nicht (mehr) — `owners.tenant_id`
# referenziert `tenants(id)`, und `user_id` ist vorher schon geprüft.
_FK_VERLETZUNG = "23503"

# Postgres-Fehlercode für eine Unique-Verletzung. Auf `owner_properties` heißt
# er genau eine Sache: `owner_properties_property_id_key` (Migration 0073) —
# das Objekt gehört bereits einem Eigentümer. Das ist der DB-Backstop unter der
# Vorab-Prüfung in `_objekte_zuordnen` und fängt das Rennen zwischen zwei
# gleichzeitigen Zuordnungen ab (Wurzel 2).
_UNIQUE_VERLETZUNG = "23505"

_OWNER_COLUMNS = (
    "id, tenant_id, name, company, email, phone, street, house_number, "
    "postal_code, city, country, tax_id, vat_id, iban, bic, bank_name, "
    "account_holder, default_commission_pct, default_payout_method, "
    "statement_frequency, notes, user_id, language, created_at, updated_at"
)


class OwnerError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt.

    `details` trägt strukturierte Zusatzangaben, die der Client für seine
    Reaktion BRAUCHT — etwa die Anzahl der Eigennutzungen, über die das
    Löschen zurückfragt. Sie stehen bewusst neben der Meldung und nicht darin:
    der Meldungstext ist übersetzbar, eine Zahl daraus zurückzuparsen wäre eine
    zweite, brüchige Wahrheit (Wurzel 4).
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 400,
        details: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details


class OwnersService:
    slice_name = "owners"

    def __init__(self, service_client: Client) -> None:
        self._db = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise OwnerError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    def _accommodation_type(self, tenant_id: str) -> str | None:
        """Betriebsart des Tenants (tenants.accommodation_type, 0090)."""
        row = (
            self._db.table("tenants")
            .select("accommodation_type")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        )
        return row.data[0].get("accommodation_type") if row.data else None

    def _tenant_property_ids(self, tenant_id: str) -> set[str]:
        rows = (
            self._db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return {str(r["id"]) for r in rows}

    def _ist_archiviert(self, tenant_id: str, property_id: str) -> bool:
        rows = (
            self._db.table("properties")
            .select("archived_at")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return bool(rows and rows[0].get("archived_at"))

    def _links(self, owner_id: str) -> list[OwnerPropertyLink]:
        rows = (
            self._db.table("owner_properties")
            .select("property_id, ownership_share, commission_override_pct")
            .eq("owner_id", owner_id)
            .execute()
        ).data or []
        return [
            OwnerPropertyLink(
                property_id=str(r["property_id"]),
                ownership_share=float(r.get("ownership_share") or 0),
                commission_override_pct=(
                    float(r["commission_override_pct"])
                    if r.get("commission_override_pct") is not None
                    else None
                ),
            )
            for r in rows
        ]

    def _get_row(self, tenant_id: str, owner_id: str) -> dict:
        res = (
            self._db.table("owners")
            .select(_OWNER_COLUMNS)
            .eq("tenant_id", tenant_id)
            .eq("id", owner_id)
            .execute()
        )
        if not res.data:
            raise OwnerError("Eigentümer nicht gefunden.", status_code=404)
        return res.data[0]

    def list(self, ctx: AuthContext) -> OwnerListResponse:
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("owners")
            .select(_OWNER_COLUMNS)
            .eq("tenant_id", tenant_id)
            .order("name")
            .execute()
        ).data or []
        # Objekt-Anzahl + effektive Provisions-Spanne je Eigentümer in einem
        # Rutsch (kein N+1). Effektiv = Override je Objekt, sonst Owner-Default.
        owner_ids = [str(r["id"]) for r in rows]
        # `or 0` stand hier bis 09.08.2026 und machte den FEHLENDEN Satz zu
        # einer 0, die als „0 %" in der Spanne landete. NULL bleibt jetzt NULL.
        default_by_owner: dict[str, float | None] = {
            str(r["id"]): (
                float(r["default_commission_pct"])
                if r.get("default_commission_pct") is not None
                else None
            )
            for r in rows
        }
        counts: dict[str, int] = {oid: 0 for oid in owner_ids}
        eff_by_owner: dict[str, list[float]] = {oid: [] for oid in owner_ids}
        # Objekte, deren effektiver Satz WEDER am Objekt NOCH am Eigentümer
        # steht. Sie dürfen nicht in die Spanne einfließen (das wäre wieder die
        # erfundene 0), müssen aber sichtbar bleiben — sonst zeigte die Karte
        # eine saubere Spanne und verschwiege, dass ein Teil ungeklärt ist.
        offen_by_owner: dict[str, int] = {oid: 0 for oid in owner_ids}
        if owner_ids:
            links = (
                self._db.table("owner_properties")
                .select("owner_id, commission_override_pct")
                .in_("owner_id", owner_ids)
                .execute()
            ).data or []
            for link in links:
                oid = str(link["owner_id"])
                counts[oid] = counts.get(oid, 0) + 1
                override = link.get("commission_override_pct")
                eff = (
                    float(override)
                    if override is not None
                    else default_by_owner.get(oid)
                )
                if eff is None:
                    offen_by_owner[oid] = offen_by_owner.get(oid, 0) + 1
                    continue
                eff_by_owner.setdefault(oid, []).append(eff)
        items = [
            OwnerListItem(
                **_owner_row(r),
                property_count=counts.get(str(r["id"]), 0),
                commission_min=(
                    min(eff_by_owner[str(r["id"])])
                    if eff_by_owner.get(str(r["id"]))
                    else None
                ),
                commission_max=(
                    max(eff_by_owner[str(r["id"])])
                    if eff_by_owner.get(str(r["id"]))
                    else None
                ),
                commission_missing_count=offen_by_owner.get(str(r["id"]), 0),
            )
            for r in rows
        ]
        return OwnerListResponse(items=items, total=len(items))

    def get(self, ctx: AuthContext, owner_id: str) -> OwnerResponse:
        tenant_id = self._require_tenant(ctx)
        row = self._get_row(tenant_id, owner_id)
        antwort = OwnerResponse(**_owner_row(row), properties=self._links(owner_id))
        # Läuft die Stammdaten-Adresse von der Anmelde-Adresse auseinander, ist
        # ein Wechsel offen: GoTrue wartet auf die Bestätigung des Eigentümers.
        # Das gehört in JEDE Antwort, nicht nur in die des auslösenden
        # Speichervorgangs — sonst ist der Zustand nach einem Neuladen der Seite
        # unsichtbar, obwohl er weiterbesteht, und der Knopf zum erneuten
        # Anstossen unerreichbar (Wurzel 5b).
        anmelde = self._anmelde_email(row)
        stammdaten = (row.get("email") or "").strip()
        if anmelde and stammdaten and anmelde.casefold() != stammdaten.casefold():
            antwort.email_bestaetigung_an = stammdaten
        return antwort

    def create(self, ctx: AuthContext, req: OwnerCreate) -> OwnerResponse:
        """Eigentümer anlegen — auf Wunsch samt Portalzugang.

        Reihenfolge ist Absicht: ERST die Stammdaten, DANN der Zugang. Die
        Abrechnungspartei ist der eigentliche Zweck des Aufrufs und steht auch
        dann, wenn der Zugang scheitert; umgekehrt wäre ein Login ohne
        Stammdatensatz ein Nutzer, den die Eigentümer-Liste nicht kennt.
        """
        tenant_id = self._require_tenant(ctx)
        payload = req.model_dump(mode="json")
        payload["tenant_id"] = tenant_id
        # Kein Spaltenwert — das Flag steuert nur, ob zusätzlich eingeladen
        # wird. Bliebe es drin, lehnte PostgREST den Insert ab.
        portalzugang = bool(payload.pop("portalzugang", False))
        # Ebenso kein Spaltenwert: die Objekte hängen in `owner_properties`,
        # nicht an der `owners`-Zeile. Bliebe der Schlüssel im Payload, würde
        # PostgREST den Insert mit PGRST204 („Could not find the 'property_ids'
        # column") abweisen — live gegen die Staging-DB gesehen.
        payload.pop("property_ids", None)
        # Ohne Postfach gibt es keinen Einmal-Link. Das VOR dem Insert prüfen:
        # sonst stünde der Eigentümer schon da und der Aufruf schlüge trotzdem
        # fehl — der Betreiber legte ihn beim zweiten Versuch doppelt an.
        if portalzugang and not (req.email or "").strip():
            raise OwnerError(
                "Für den Portalzugang wird eine E-Mail-Adresse gebraucht.",
                status_code=422,
            )
        self._validate_user_link(tenant_id, payload.get("user_id"))
        try:
            res = self._db.table("owners").insert(payload).execute()
        except APIError as exc:
            # Fremdschlüssel-Verletzung (23503): der Mandant aus dem Token gibt
            # es nicht (mehr). Real erreichbar mit einem noch gültigen JWT eines
            # inzwischen gelöschten Tenants — der Token läuft weiter, die Zeile
            # ist weg. Ohne diesen Zweig entkommt der rohe `APIError` und wird
            # zu einem nackten 500 `internal_error` (Wurzel 5: client-
            # erreichbarer Input darf keinen 500 werfen). 409 statt 500, damit
            # der Aufrufer sieht, dass sein Konto neu geladen werden muss.
            if getattr(exc, "code", None) == _FK_VERLETZUNG:
                raise OwnerError(
                    "Das Konto zu dieser Sitzung existiert nicht mehr. "
                    "Bitte neu anmelden.",
                    status_code=409,
                ) from exc
            raise
        if not res.data:
            raise OwnerError("Eigentümer konnte nicht angelegt werden.", status_code=500)
        row = res.data[0]
        owner_id = str(row["id"])
        log.info("owner_created", tenant_id=tenant_id, owner_id=owner_id)

        # Objekte SOFORT mitzuordnen — der eigentliche Zweck des Aufrufs, wenn
        # der Betreiber im Dialog Objekte angehakt hat. Scheitert das (fremdes
        # Objekt, inzwischen von jemand anderem belegt), wird der eben angelegte
        # Eigentümer wieder entfernt: ein Eigentümer OHNE seine Objekte ist
        # nicht das, was der Betreiber angefordert hat, und er stünde still
        # halbfertig in der Liste (Wurzel 1/5 — kein halber Zustand).
        #
        # Der Rollback umfasst AUCH den Portalzugang: scheitert die Einladung
        # (unzustellbare Adresse, Mailfehler), darf kein Eigentümer mit seinen
        # Objekten, aber ohne den angeforderten Zugang zurückbleiben. Live
        # gesehen: bei einer vom Mailvalidator abgewiesenen Adresse standen
        # Eigentümer und Objekte bereits in der DB, der Aufruf endete trotzdem
        # im Fehler — der Betreiber legte ihn beim zweiten Versuch doppelt an.
        # Deshalb hängen beide Schritte am selben Rollback.
        try:
            if req.property_ids:
                self._objekte_zuordnen(tenant_id, owner_id, req.property_ids)
            if not portalzugang:
                return OwnerResponse(
                    **_owner_row(row), properties=self._links(owner_id)
                )
            row, eingeladen = self._portalzugang_einrichten(ctx, row)
        except Exception:
            # Bewusst breit: JEDER Fehlschlag zwischen Anlage und fertigem
            # Ergebnis muss die Anlage zurücknehmen, nicht nur die fachlichen
            # `OwnerError`. Ein Validierungsfehler der Mailadresse ist genauso
            # ein „nicht das, was angefordert wurde" wie ein belegtes Objekt.
            # Der Fehler wird unverändert weitergereicht (kein Verschlucken,
            # Wurzel 5) — nur der halbe Zustand verschwindet.
            self._anlage_zuruecknehmen(tenant_id, owner_id)
            raise
        # Der Portalzugang ist erst dann ein Zugang, wenn der Eigentümer auch
        # etwas SIEHT: `owner_properties` ist die Abrechnungsseite,
        # `owner_property_assignments` die Portal-Sicht (0058, steuert
        # `owner_can_see_property`). Ohne den zweiten Eintrag loggt sich der
        # Eigentümer ein und findet ein leeres Portal vor.
        self._portalsicht_nachziehen(tenant_id, owner_id, str(row["user_id"]))
        return OwnerResponse(
            **_owner_row(row),
            properties=self._links(owner_id),
            einladung_versendet=eingeladen,
        )

    def _anlage_zuruecknehmen(self, tenant_id: str, owner_id: str) -> None:
        """Den eben angelegten Eigentümer wieder entfernen (Rollback der Anlage).

        Wird NUR aufgerufen, wenn nach der Anlage etwas scheitert — die
        Objektzuordnung oder der Portalzugang — und der Eigentümer damit nicht
        das ist, was angefordert wurde. Tenant-gescopt wie jeder andere Zugriff
        (Wurzel 3).

        Die bereits geschriebenen `owner_properties`-Zeilen verschwinden per
        `on delete cascade` mit dem Eigentümer (0063); die Objekte sind danach
        wieder frei. Ein bereits angelegter Login-Nutzer bleibt bestehen — den
        rollt `AuthService.invite` bei einem Mailfehler selbst zurück, und ein
        erfolgreich eingeladener Nutzer ist ein eigener, gewollter Datensatz
        unter /konto/nutzer, den dieser Rollback nicht mit abräumen darf.

        Das `except` ist bewusst breit und bewusst still: hier läuft bereits ein
        Fehlerpfad, und ein zweiter Fehler beim Aufräumen darf den ERSTEN,
        aussagekräftigen Fehler nicht überschreiben — der Betreiber soll lesen,
        welches Objekt das Problem war, nicht warum das Aufräumen scheiterte.
        Der Rest ist ein Eigentümer ohne Objekte, den der Betreiber sieht und
        löschen kann; kein unerreichbarer Zustand.
        """
        try:
            self._db.table("owners").delete().eq("tenant_id", tenant_id).eq(
                "id", owner_id
            ).execute()
        except Exception:  # noqa: BLE001  pylint: disable=broad-exception-caught
            log.warning(
                "owner_rollback_fehlgeschlagen",
                tenant_id=tenant_id,
                owner_id=owner_id,
            )

    def _objekte_zuordnen(
        self, tenant_id: str, owner_id: str, property_ids: list[str]
    ) -> None:
        """Mehrere Objekte in EINEM Zug zuordnen.

        Wurzel 3: JEDE übergebene ID wird gegen die Objekte DIESES Mandanten
        geprüft, bevor irgendetwas geschrieben wird. Eine untergemischte fremde
        ID lässt den ganzen Aufruf scheitern, statt sie still zu überspringen —
        stilles Überspringen wäre eine Falschaussage über das Ergebnis.

        Wurzel 9: derselbe Scope, den auch der List-Pfad
        (`available_properties`) anlegt — frei ODER bereits bei diesem Owner.
        Ein Objekt, das inzwischen einem ANDEREN Eigentümer gehört, wird mit
        409 und NAMEN des Objekts abgewiesen; der Betreiber soll wissen,
        welches gemeint ist.

        Wurzel 2: der Insert läuft als Upsert auf `owner_id,property_id`, ein
        Doppelklick erzeugt also keine zweite Zeile. Zusätzlich fängt der Code
        die Unique-Verletzung 23505 aus `unique (property_id)` (0073) ab: die
        entsteht, wenn zwischen Prüfung und Insert ein anderer Vorgang dasselbe
        Objekt belegt hat. Das ist ein echter Konflikt und wird als solcher
        gemeldet, nicht verschluckt.
        """
        if not property_ids:
            return

        # Titel gleich mitladen: sie werden in den Fehlermeldungen gebraucht.
        # Ein zweiter Ladevorgang nur für den Text wäre eine Runde zu viel.
        zeilen = (
            self._db.table("properties")
            .select("id, title, archived_at")
            .eq("tenant_id", tenant_id)
            .in_("id", property_ids)
            .execute()
        ).data or []
        eigene = {str(r["id"]): r["title"] for r in zeilen}
        fremd = [pid for pid in property_ids if pid not in eigene]
        if fremd:
            raise OwnerError(
                "Mindestens ein Objekt gehört nicht zu diesem Konto.",
                status_code=400,
            )
        # Dieselbe Grenze wie in `_zuordenbare_objekte` (Wurzel 3/9): die
        # Auswahl zeigt Archiviertes nicht, der Schreibpfad nimmt es per ID
        # ebenso wenig an — und zwar in DIESEM Pfad, denn die Mehrfachauswahl
        # der Detailseite und der Anlege-Dialog laufen hier, nicht über
        # `assign_property`.
        archiviert = [r["title"] for r in zeilen if r.get("archived_at")]
        if archiviert:
            raise OwnerError(
                "Archivierte Objekte können keinem Eigentümer mehr zugeordnet "
                f"werden: {', '.join(sorted(str(t) for t in archiviert))}.",
                status_code=422,
            )

        # Schon vergeben? Vor dem Schreiben prüfen, damit der Betreiber eine
        # Meldung MIT Objektnamen bekommt statt eines nackten DB-Konflikts.
        belegt = (
            self._db.table("owner_properties")
            .select("property_id, owners(name)")
            .in_("property_id", property_ids)
            .neq("owner_id", owner_id)
            .execute()
        ).data or []
        if belegt:
            raise OwnerError(
                _belegt_meldung(belegt, eigene), status_code=409
            )

        try:
            self._db.table("owner_properties").upsert(
                [
                    {"owner_id": owner_id, "property_id": pid}
                    for pid in property_ids
                ],
                on_conflict="owner_id,property_id",
            ).execute()
        except APIError as exc:
            # 23505 kann hier nur `unique (property_id)` sein (0073): zwischen
            # der Prüfung oben und diesem Insert hat ein anderer Vorgang eines
            # der Objekte belegt. Spezifisch fangen und als Konflikt melden —
            # ein breites `except` würde dieses Signal verschlucken und die
            # Zuordnung als erledigt ausgeben (Wurzel 5).
            if getattr(exc, "code", None) == _UNIQUE_VERLETZUNG:
                raise OwnerError(
                    "Mindestens eines der Objekte wurde soeben einem anderen "
                    "Eigentümer zugeordnet. Bitte die Auswahl neu laden.",
                    status_code=409,
                ) from exc
            raise
        log.info(
            "owner_properties_assigned",
            tenant_id=tenant_id,
            owner_id=owner_id,
            count=len(property_ids),
        )

    def _portalsicht_nachziehen(
        self, tenant_id: str, owner_id: str, user_id: str
    ) -> None:
        """Die Abrechnungs-Zuordnung in die PORTAL-Sicht spiegeln.

        Es sind zwei Tabellen mit zwei Aufgaben:
          * `owner_properties` — wem gehört das Objekt (Abrechnung, Provision).
          * `owner_property_assignments` (0058) — was sieht dieser LOGIN im
            Portal; genau darauf setzt `owner_can_see_property` und die RLS aus
            0059 auf.

        Bis hierher schrieb der owners-Slice ausschließlich die erste. Ein
        Eigentümer, dem ein Objekt gehörte und der einen Portalzugang bekam,
        loggte sich ein und sah NICHTS — die Zuordnung war da, die Sichtbarkeit
        nicht. Das ist der Grund für diese Methode.

        Nur sinnvoll mit verknüpftem Login: ohne `user_id` gibt es niemanden,
        dem etwas sichtbar gemacht werden könnte.

        Idempotent (Wurzel 2): geschrieben wird nur, was noch nicht dasteht.
        Ein zweiter Aufruf ändert nichts. Bestehende Sichtbarkeiten bleiben
        unangetastet — das hier ist ein ERGÄNZEN, kein Replace: die Agentur darf
        einem Eigentümer über `/auth/.../owner-assignments` auch Objekte
        sichtbar machen, die ihm nicht gehören (Verwalter-Fall), und die dürfen
        hier nicht wegfallen (Wurzel 1).
        """
        if not user_id:
            return
        gehoert = [link.property_id for link in self._links(owner_id)]
        if not gehoert:
            return
        sichtbar = {
            str(r["property_id"])
            for r in (
                self._db.table("owner_property_assignments")
                .select("property_id")
                .eq("tenant_id", tenant_id)
                .eq("user_id", user_id)
                .execute()
            ).data
            or []
        }
        fehlend = [pid for pid in gehoert if pid not in sichtbar]
        if not fehlend:
            return
        self._db.table("owner_property_assignments").insert(
            [
                {"tenant_id": tenant_id, "user_id": user_id, "property_id": pid}
                for pid in fehlend
            ]
        ).execute()
        log.info(
            "owner_portalsicht_nachgezogen",
            tenant_id=tenant_id,
            owner_id=owner_id,
            user_id=user_id,
            count=len(fehlend),
        )

    def portalzugang_einladen(self, ctx: AuthContext, owner_id: str) -> OwnerResponse:
        """Portalzugang für einen BESTEHENDEN Eigentümer nachträglich einrichten.

        Der zweite Weg zum selben Ziel: wer beim Anlegen noch keine Adresse
        hatte oder den Zugang erst später braucht, kommt hierüber — ohne die
        Person unter /konto/nutzer ein zweites Mal anzulegen.
        """
        tenant_id = self._require_tenant(ctx)
        row = self._get_row(tenant_id, owner_id)
        if not (row.get("email") or "").strip():
            raise OwnerError(
                "Für den Portalzugang wird eine E-Mail-Adresse gebraucht.",
                status_code=422,
            )
        row, eingeladen = self._portalzugang_einrichten(ctx, row)
        # Der nachträgliche Zugang trifft in aller Regel einen Eigentümer, dem
        # bereits Objekte gehören — genau der Fall, in dem die fehlende
        # Portal-Sicht am meisten weh tut (Zugang da, Portal leer).
        self._portalsicht_nachziehen(tenant_id, owner_id, str(row["user_id"]))
        return OwnerResponse(
            **_owner_row(row),
            properties=self._links(owner_id),
            einladung_versendet=eingeladen,
        )

    def einladung_erneut_senden(self, ctx: AuthContext, owner_id: str) -> None:
        """Die Zugangs-Einladung noch einmal verschicken.

        Der Fall: der Zugang IST eingerichtet (`owners.user_id` steht), aber die
        Mail ist nie angekommen oder der Sieben-Tage-Token ist abgelaufen. Ohne
        diesen Weg bliebe dem Eigentümer nur „Passwort vergessen" — was er nicht
        findet, weil er das Produkt noch nie gesehen hat.

        Abgrenzung zu `portalzugang_einladen`: dort gibt es noch KEINEN Login,
        hier gibt es ihn schon. Beide Zustände sind an `owners.user_id`
        unterscheidbar, und die Oberfläche zeigt je Zustand genau einen Knopf.

        Kein zweiter Mailweg (Wurzel 2/4): der Versand läuft über
        `AuthService.einladung_erneut_senden` — dieselbe Stelle, die
        /konto/nutzer benutzt. Dort sitzen Sperrfrist (1 Minute je Konto),
        Token-Entwertung und die Einladungsvorlage. Ein eigener Versand hier
        wäre die Kopie, die beim nächsten Sicherheitsfix vergessen würde.

        Scope (Wurzel 3/9): der Eigentümer wird über `_get_row(tenant_id, ...)`
        geladen — derselbe Helfer und derselbe Scope wie der List-Pfad, 404 bei
        fremdem Mandanten. Der `user_id` kommt damit aus der GESCOPTEN Zeile,
        nie aus der Anfrage; ein Aufrufer kann keine fremde Nutzer-ID
        unterschieben.
        """
        # pylint: disable=import-outside-toplevel
        from src.core.supabase import get_anon_client
        from src.features.auth.service import AuthError, AuthService

        tenant_id = self._require_tenant(ctx)
        row = self._get_row(tenant_id, owner_id)
        user_id = row.get("user_id")
        if not user_id:
            # Kein Login = nichts zum erneut Senden. Der richtige Weg ist
            # `portalzugang_einladen`; hier still einen Zugang anzulegen wäre
            # eine andere Handlung als die, auf die geklickt wurde.
            raise OwnerError(
                "Für diesen Eigentümer gibt es noch keinen Portalzugang.",
                status_code=409,
            )
        if not (row.get("email") or "").strip():
            raise OwnerError(
                "Für die Einladung wird eine E-Mail-Adresse gebraucht.",
                status_code=422,
            )
        try:
            AuthService(
                anon_client=get_anon_client(), service_client=self._db
            ).einladung_erneut_senden(ctx, str(user_id))
        except AuthError as exc:
            raise OwnerError(exc.message, status_code=exc.status_code) from exc
        log.info(
            "owner_einladung_erneut_versendet",
            tenant_id=tenant_id,
            owner_id=owner_id,
        )

    def _portalzugang_einrichten(
        self, ctx: AuthContext, row: dict
    ) -> tuple[dict, bool]:
        """Login-Nutzer anlegen, einladen und mit dem Eigentümer verknüpfen.

        Gibt die aktualisierte Eigentümer-Zeile zurück UND ob dabei wirklich
        eine Einladungsmail rausging — im Verknüpfungs-Zweig (bestehender
        Login) geht keine, und der Aufrufer darf nichts anderes behaupten.

        Der Versand läuft NICHT über einen eigenen Mailweg, sondern über
        `AuthService.invite` — denselben, den /konto/nutzer benutzt. Dort sitzt
        bereits alles, was dieser Vorgang braucht: Zufallspasswort, das niemand
        kennt, Einmal-Token als SHA-256, Sprachauflösung des Empfängers und der
        Alles-oder-nichts-Rollback bei Mailfehler (0334). Ein zweiter
        Einladungsweg wäre eine Kopie, die beim nächsten Sicherheitsfix
        vergessen würde.

        Wurzel 2 (Idempotenz): der Claim ist die E-Mail-Adresse selbst. Trägt
        der Tenant bereits einen Nutzer mit dieser Adresse, wird DIESER
        verknüpft, statt einen zweiten anzulegen — ein Doppelklick erzeugt
        damit keinen zweiten Nutzer und keine zweite Mail.

        Wurzel 5 (kein halber Zustand): scheitert die Einladung, rollt
        `AuthService.invite` den Nutzer selbst vollständig zurück und wirft.
        Der Eigentümer-Stammdatensatz bleibt bestehen und ist über
        `portalzugang_einladen` erneut einladbar — das ist ein vollständiger,
        benannter Zustand, kein unerreichbarer Rest.
        """
        tenant_id = str(row["tenant_id"])
        email = str(row["email"]).strip()
        owner_id = str(row["id"])

        vorhandener = self._nutzer_mit_adresse(tenant_id, email)
        if vorhandener is not None:
            # Schon ein Login zu dieser Adresse: nur verknüpfen. Die Rolle muss
            # trotzdem stimmen — `_validate_user_link` weist einen Mitarbeiter-
            # oder Admin-Zugang ab, statt ihn still zum Eigentümer zu machen.
            #
            # Hier geht KEINE Mail raus, und das muss der Aufrufer erfahren:
            # meldete die Oberfläche trotzdem „Einladung versendet", wartete
            # der Betrieb auf eine Mail, die es nie gab (live am 10.08.2026).
            self._validate_user_link(tenant_id, vorhandener)
            return self._user_verknuepfen(tenant_id, owner_id, vorhandener), False

        user_id = self._einladen(ctx, row=row, email=email)
        return self._user_verknuepfen(tenant_id, owner_id, user_id), True

    def _einladen(self, ctx: AuthContext, *, row: dict, email: str) -> str:
        """Login-Nutzer mit Rolle `owner` anlegen und Einladungsmail auslösen.

        Lazy-Import: `auth.service` importiert seinerseits aus dem
        owners-Umfeld nicht, aber der Import auf Modulebene würde die beiden
        Slices dauerhaft aneinanderbinden.
        """
        # pylint: disable=import-outside-toplevel
        from src.core.supabase import get_anon_client
        from src.features.auth.schemas import InviteRequest, UserRole
        from src.features.auth.service import AuthError, AuthService

        # `invite` fasst ausschliesslich den service_client an (Nutzeranlage,
        # users-Zeile, Mail). Der anon_client gehört zum Login-Pfad derselben
        # Klasse und wird hier nur gebraucht, weil der Konstruktor ihn verlangt.
        try:
            antwort = AuthService(
                anon_client=get_anon_client(), service_client=self._db
            ).invite(
                InviteRequest(
                    email=email,
                    full_name=str(row["name"]),
                    role=UserRole.owner,
                    # Die Sprache der PARTEI (`owners.language`) wird zur
                    # Sprache des Logins. Sie ist die einzige echte Auskunft
                    # über diesen Empfänger; ist sie leer, bleibt sie leer und
                    # `core.mail_sprache` geht die Kette Betrieb → Englisch
                    # weiter. Kein erfundenes „de" (Wurzel 4).
                    preferred_language=row.get("language"),
                ),
                tenant_id=str(row["tenant_id"]),
                granter_id=ctx.user_id,
            )
        except AuthError as exc:
            raise OwnerError(exc.message, status_code=exc.status_code) from exc
        return antwort.user_id

    def _nutzer_mit_adresse(self, tenant_id: str, email: str) -> str | None:
        """Bestehender Login des Tenants zu dieser Adresse — oder None.

        Tenant-gescopt (Wurzel 3). Mehrere Treffer ergeben None: dann ist die
        Adresse nicht eindeutig zuzuordnen, und zu raten wäre schlimmer als
        der klare Fehler, den das Anlegen danach wirft.
        """
        rows = (
            self._db.table("users")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("email", email)
            .limit(2)
            .execute()
        ).data or []
        return str(rows[0]["id"]) if len(rows) == 1 else None

    def _user_verknuepfen(
        self, tenant_id: str, owner_id: str, user_id: str
    ) -> dict:
        """`owners.user_id` setzen — ohne diesen Link sieht der eingeloggte
        Eigentümer im Portal KEINE Abrechnungen (owner_statements löst seine
        owner_id genau darüber auf)."""
        res = (
            self._db.table("owners")
            .update({"user_id": user_id})
            .eq("tenant_id", tenant_id)
            .eq("id", owner_id)
            .execute()
        ).data or []
        if not res:
            raise OwnerError("Eigentümer nicht gefunden.", status_code=404)
        # Die Sprache aus der Maske auf den frisch verknüpften Login spiegeln.
        # Betrifft VOR ALLEM den Zweig „bestehender Login wird übernommen":
        # dort läuft keine Einladung und damit auch nichts, was
        # `preferred_language` sonst setzen würde — der Login behielte seine
        # alte (oder gar keine) Sprache, und die Mails kämen falsch.
        self._sprache_an_login(tenant_id, res[0])
        log.info(
            "owner_portalzugang_verknuepft",
            tenant_id=tenant_id,
            owner_id=owner_id,
            user_id=user_id,
        )
        return res[0]

    def update(
        self, ctx: AuthContext, owner_id: str, req: OwnerUpdate
    ) -> OwnerResponse:
        """Stammdaten ändern — samt Adresswechsel des LOGINS.

        Die E-Mail-Adresse ist der einzige Wert hier, der nicht nur Stammdaten
        ist: sie ist zugleich die Anmeldeadresse. Bis hierher schrieb dieser Weg
        ausschliesslich `owners.email`; der Login lief weiter gegen die ALTE
        Adresse in GoTrue (`auth.users.email`) und `public.users.email` blieb
        ebenfalls stehen. Folge: die Eigentümer-Maske zeigte die neue Adresse,
        „Einladung erneut senden" ging an die alte, und niemand sah den
        Widerspruch. Deshalb stösst der Adresswechsel jetzt zusätzlich den
        GoTrue-Wechsel an (Doppel-Opt-in, siehe `_email_wechsel_anstossen`).
        """
        tenant_id = self._require_tenant(ctx)
        vorher = self._get_row(tenant_id, owner_id)  # 404, wenn fremd
        changes = req.model_dump(mode="json", exclude_unset=True)
        if "user_id" in changes:
            self._validate_user_link(tenant_id, changes["user_id"])
        # Der Adresswechsel wird VOR dem Schreiben der Stammdaten entschieden,
        # aber NACH dem Schreiben ausgeführt: die Reihenfolge muss so sein,
        # damit ein abgewiesener GoTrue-Wechsel (Adresse schon vergeben) nicht
        # eine bereits gespeicherte `owners.email` zurücklässt, die zu keinem
        # Login gehört. Erst prüfen, dann schreiben, dann anstossen — der
        # Konflikt fliegt aus `_email_wechsel_anstossen` als 409, bevor
        # irgendetwas geschrieben ist.
        neue_email = self._geaenderte_email(vorher, changes)
        # `wechsel` beschreibt NUR den Login-Anteil: er bleibt None, wenn der
        # Eigentümer keinen Portalzugang hat. `neue_email` ist die Frage
        # „wurde die Adresse überhaupt geändert" — die beiden fallen
        # auseinander, und das Protokoll hängt an der zweiten: ein
        # Adresswechsel ohne Login ist ebenfalls ein Vorgang, den man später
        # nachvollziehen können muss.
        wechsel = (
            self._email_wechsel_pruefen(vorher, neue_email)
            if neue_email is not None
            else None
        )
        if changes:
            res = (
                self._db.table("owners")
                .update(changes)
                .eq("tenant_id", tenant_id)
                .eq("id", owner_id)
                .execute()
            )
            if not res.data:
                raise OwnerError("Eigentümer nicht gefunden.", status_code=404)
            # Sprachwechsel in der Maske auf den Login durchreichen — sonst
            # bliebe die Änderung wirkungslos: die Mail liest den Login, nicht
            # die Partei-Zeile.
            if "language" in changes:
                self._sprache_an_login(tenant_id, res.data[0])
        log.info("owner_updated", tenant_id=tenant_id, owner_id=owner_id)
        antwort = self.get(ctx, owner_id)
        if neue_email is not None:
            antwort.email_bestaetigung_an = self._email_wechsel_anstossen(
                ctx, vorher, neue_email=neue_email, wechsel=wechsel
            )
        return antwort

    def _sprache_an_login(self, tenant_id: str, row: dict) -> None:
        """`owners.language` auf den verknüpften Login schreiben.

        Mails an einen Eigentümer laufen über seinen LOGIN
        (`users.preferred_language`, `core.mail_empfaenger`), nicht über die
        Partei-Zeile `owners`. Das Dropdown der Maske schreibt aber nur
        `owners.language` — beim Anlegen MIT Einladung reicht der Aufruf sie
        zwar an `InviteRequest.preferred_language` durch, auf zwei anderen
        Wegen jedoch nicht:

          * ein BESTEHENDER Login wird verknüpft (keine Einladung, also nichts,
            was `preferred_language` setzen würde),
          * die Sprache wird SPÄTER in der Maske geändert (der Update-Pfad
            fasste den Login nie an).

        In beiden Fällen blieb die Auswahl wirkungslos und die Mail ging in der
        alten Sprache raus. Das Dropdown ist die Quelle der Wahrheit; hier wird
        sie auf den Login gespiegelt.

        Ohne Login gibt es nichts zu spiegeln. Leere Sprache schreibt nichts:
        NULL ist die Stufe, an der die Kette bewusst zur Betriebssprache
        weitergeht — ein erfundener Wert wäre Wurzel 4.

        Best-effort (Wurzel 5): ein Fehler kippt weder Anlage noch Speichern,
        wird aber geloggt und beim nächsten Speichern nachgeholt.
        """
        user_id = row.get("user_id")
        sprache = normalisieren(row.get("language"))
        if not user_id or sprache is None:
            return
        try:
            self._db.table("users").update(
                {"preferred_language": sprache}
            ).eq("tenant_id", tenant_id).eq("id", str(user_id)).execute()
        except Exception as exc:  # noqa: BLE001 — Nebenpfad, kippt den Hauptpfad nicht
            log.warning(
                "owner_sprache_login_nicht_gespiegelt",
                tenant_id=tenant_id,
                user_id=str(user_id),
                error=str(exc)[:200],
            )

    def _geaenderte_email(self, vorher: dict, changes: dict) -> str | None:
        """Die NEUE Adresse, falls dieser Aufruf sie wirklich ändert — sonst None.

        Bezugsgrösse ist die ANMELDE-Adresse, nicht der alte `owners`-Wert.
        Zuerst stand hier der Vergleich gegen `owners.email` — und damit konnte
        ein Datensatz, dessen beide Adressen bereits auseinanderlaufen, sich nie
        wieder heilen: `owners.email` trug die neue Adresse, der Login die alte,
        der Vergleich meldete „keine Änderung", und die Maske zeigte weiterhin
        eine Adresse, mit der man sich nicht anmelden kann (Wurzel 5b — die
        stille Falschaussage, die niemand als Bug erkennt). Gegen den Login
        verglichen verschwindet der Sonderfall: jedes Speichern zieht nach, was
        noch nicht nachgezogen ist.

        Ohne Portalzugang gibt es keine Anmelde-Adresse; dann bleibt der alte
        `owners`-Wert die Bezugsgrösse, damit das Protokoll den Wechsel der
        reinen Korrespondenzadresse trotzdem festhält.

        Die Maske schickt beim Speichern immer alle Felder mit; ohne diesen
        Vergleich löste jedes Speichern eines Telefonnummern-Tippfehlers einen
        GoTrue-Adresswechsel samt Bestätigungsmail aus (Wurzel 2: dieselbe
        Adresse noch einmal zu setzen ist keine Änderung).

        Gross-/Kleinschreibung im lokalen Teil ist bei GoTrue nicht
        unterscheidend (die Adresse wird beim Anlegen kleingeschrieben
        abgelegt). Ein Wechsel von „Max@…" auf „max@…" ist deshalb KEIN
        Wechsel und darf keine Bestätigungsmail auslösen.
        """
        if "email" not in changes:
            return None
        neu = (changes.get("email") or "").strip()
        if not neu:
            return None
        alt = self._anmelde_email(vorher) or (vorher.get("email") or "").strip()
        if neu.casefold() == alt.strip().casefold():
            return None
        return neu

    def _anmelde_email(self, vorher: dict) -> str | None:
        """Die Adresse, mit der sich dieser Eigentümer WIRKLICH anmeldet.

        Quelle ist GoTrue, nicht der Spiegel `public.users`: der wird nur beim
        Abruf des EIGENEN Kontos nachgezogen (`AccountService._email_nachziehen`)
        und läuft für einen fremden Eigentümer daher beliebig lange nach. Für
        die Frage „stimmt die Stammdaten-Adresse mit dem Login überein" wäre er
        eine Quelle, die genau dann falsch liegt, wenn es darauf ankommt.

        Kein Portalzugang oder GoTrue nicht erreichbar → None. Der Aufrufer
        fällt dann auf den alten `owners`-Wert zurück; lieber ein Wechsel zu
        wenig erkannt als ein Adresswechsel, der auf einer geratenen
        Bezugsgrösse beruht (Wurzel 4).
        """
        user_id = vorher.get("user_id")
        if not user_id:
            return None
        try:
            res = self._db.auth.admin.get_user_by_id(str(user_id))
        except Exception as exc:  # noqa: BLE001 — Aufrufer behandelt None konservativ
            log.warning(
                "owner_anmelde_email_nicht_lesbar",
                owner_id=vorher.get("id"),
                error=str(exc)[:200],
            )
            return None
        return getattr(res.user, "email", None) if res and res.user else None

    def _email_wechsel_pruefen(self, vorher: dict, neue_email: str) -> dict | None:
        """Vorprüfung des Adresswechsels — wirft, BEVOR etwas geschrieben wird.

        Gibt den Kontext des Wechsels zurück (oder None, wenn es nur ein
        Stammdaten-Wechsel ohne Login ist). Ein `None` heisst ausdrücklich
        NICHT „nichts zu tun": das Protokoll wird auch dann geschrieben, nur
        eben ohne Login-Bezug.

        Wurzel 2/5 (Kollision): ist die Adresse im selben Betrieb bereits von
        einem ANDEREN Login belegt, würde GoTrue den Wechsel später ablehnen —
        dann stünde `owners.email` schon auf der neuen Adresse und der Login
        auf der alten, also genau der Zustand, den dieser ganze Weg beseitigen
        soll. Deshalb hier ein sauberer 409 vor jedem Schreibvorgang.
        """
        user_id = vorher.get("user_id")
        if not user_id:
            # Kein Portalzugang: die Adresse ist reine Korrespondenzadresse,
            # es gibt keinen Login, dessen Anmeldeadresse mitzuziehen wäre.
            return None
        tenant_id = str(vorher["tenant_id"])
        fremd = (
            self._db.table("users")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("email", neue_email)
            .neq("id", str(user_id))
            .limit(1)
            .execute()
        ).data or []
        if fremd:
            raise OwnerError(
                "Diese E-Mail-Adresse wird bereits von einem anderen Zugang "
                "in diesem Betrieb verwendet. Bitte eine andere Adresse "
                "eintragen.",
                status_code=409,
            )
        return {"user_id": str(user_id), "neue_email": neue_email}

    def _email_wechsel_anstossen(
        self,
        ctx: AuthContext,
        vorher: dict,
        *,
        neue_email: str,
        wechsel: dict | None,
    ) -> str | None:
        """GoTrue-Adresswechsel anstossen und den Vorgang protokollieren.

        DOPPEL-OPT-IN, KEIN `email_confirm` (Wurzel 7): GoTrue verschickt die
        Bestätigung an die NEUE Adresse und schaltet die Anmeldung erst nach
        dem Klick dort um. Bis dahin meldet sich der Eigentümer weiter mit der
        BISHERIGEN Adresse an. Ein `email_confirm=True` würde die Adresse
        sofort umstellen — wer sich vertippt oder ein fremdes Postfach angibt,
        sperrt den Eigentümer damit dauerhaft aus und kann sein Konto über
        „Passwort vergessen" übernehmen. Derselbe Weg und dieselbe Begründung
        wie beim Selbst-Änderungsweg (`auth.account_service.update_email`).

        `public.users.email` wird bewusst NICHT mitgeschrieben: sie ist der
        Spiegel von GoTrue und gilt erst, wenn dort umgeschaltet wurde.
        `AccountService._email_nachziehen` gleicht sie beim nächsten
        Kontoabruf des Eigentümers an. Ein sofortiges Schreiben hier hiesse,
        eine Adresse als Login-Adresse auszuweisen, unter der man sich (noch)
        gar nicht anmelden kann — und liefe bei einem Fehlschlag von GoTrue
        dauerhaft auseinander (Wurzel 1).

        `wechsel` ist None, wenn der Eigentümer keinen Portalzugang hat: dann
        ist die Adresse reine Korrespondenzadresse und sofort gültig. Der
        Vorgang wird trotzdem protokolliert — auch ein Wechsel ohne Login ist
        einer, den man später nachvollziehen können muss.

        Rückgabe: die Adresse, an die die Bestätigung ging — oder None, wenn
        es keinen Login gab (reiner Stammdaten-Wechsel). Die Oberfläche macht
        daraus den Zwischenstand-Hinweis; ohne ihn sähe der Betreiber eine
        gespeicherte neue Adresse und wüsste nicht, dass die Anmeldung noch
        auf der alten läuft (Wurzel 5b — den laufenden Vorgang verschweigen
        wäre eine Falschaussage über den Zustand).
        """
        angestossen = False
        if wechsel is not None:
            try:
                self._db.auth.admin.update_user_by_id(
                    wechsel["user_id"], {"email": wechsel["neue_email"]}
                )
            except Exception as exc:
                # Spezifisch genug: der einzige fachlich erwartbare Fall ist
                # eine bereits vergebene Adresse (betriebsübergreifend — die
                # Vorprüfung oben sieht nur den eigenen Mandanten). Als 409
                # melden statt als 500, und NICHT verschlucken: ein stiller
                # Fehlschlag hier hinterliesse genau die Adressspaltung, die
                # dieser Weg beseitigen soll (Wurzel 5).
                log.warning(
                    "owner_email_gotrue_wechsel_fehlgeschlagen",
                    tenant_id=str(vorher["tenant_id"]),
                    owner_id=str(vorher["id"]),
                    email=mask_email(wechsel["neue_email"]),
                    error=str(exc)[:200],
                )
                raise OwnerError(
                    "Die Anmeldeadresse konnte nicht geändert werden — sie "
                    "ist vermutlich bereits vergeben. Die Stammdaten wurden "
                    "gespeichert; bitte eine andere Adresse eintragen.",
                    status_code=409,
                ) from exc
            angestossen = True
        self._email_wechsel_protokollieren(
            ctx, vorher=vorher, neue_email=neue_email, angestossen=angestossen
        )
        return neue_email if angestossen else None

    def _email_wechsel_protokollieren(
        self,
        ctx: AuthContext,
        *,
        vorher: dict,
        neue_email: str,
        angestossen: bool,
    ) -> None:
        """Alt → neu, auslösender Nutzer, Zeitpunkt (0352).

        Ein Administrator greift hier in die ANMELDEDATEN einer anderen Person
        ein. Der Betroffene sieht davon nur eine Bestätigungsmail, und aus
        `owners.email` allein ist im Nachhinein weder die alte Adresse noch der
        Auslöser ablesbar — dort steht nur der Endzustand.

        Best-effort (Wurzel 5): der Wechsel selbst ist an dieser Stelle bereits
        passiert und lässt sich nicht mehr zurücknehmen. Ein Schreibfehler im
        Protokoll darf den Aufruf deshalb nicht kippen — er würde dem Betreiber
        einen Fehlschlag melden, den es nicht gab, und ihn zu einem zweiten
        Versuch verleiten. Der Fehlschlag wird sichtbar geloggt, nie
        verschluckt.
        """
        try:
            self._db.table("owner_email_changes").insert(
                {
                    "tenant_id": str(vorher["tenant_id"]),
                    "owner_id": str(vorher["id"]),
                    "user_id": (
                        str(vorher["user_id"]) if vorher.get("user_id") else None
                    ),
                    "alte_email": vorher.get("email") or None,
                    "neue_email": neue_email,
                    "login_wechsel_angestossen": angestossen,
                    "actor_user_id": ctx.user_id,
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001  pylint: disable=broad-exception-caught
            log.error(
                "owner_email_protokoll_fehlgeschlagen",
                tenant_id=str(vorher["tenant_id"]),
                owner_id=str(vorher["id"]),
                error=str(exc)[:200],
            )
            return
        log.info(
            "owner_email_geaendert",
            tenant_id=str(vorher["tenant_id"]),
            owner_id=str(vorher["id"]),
            actor=ctx.user_id,
            # Maskiert (DSGVO/CWE-532): der Klartext gehört ins Protokoll,
            # nicht ins Log.
            alt=mask_email(vorher.get("email")),
            neu=mask_email(neue_email),
            login_wechsel_angestossen=angestossen,
        )

    def email_bestaetigung_erneut_senden(
        self, ctx: AuthContext, owner_id: str
    ) -> str:
        """Die Bestätigungsmail zum Adresswechsel noch einmal anstossen.

        Der Fall ist real und nicht selten: die Bestätigung geht an die NEUE
        Adresse — und genau die ist gerade der wunde Punkt (Tippfehler im
        Postfachnamen, Spamfilter, Postfach noch nicht eingerichtet). Ohne
        diesen Weg bliebe der Wechsel für immer im Zwischenzustand hängen:
        `owners.email` neu, Login alt, und kein Knopf, der das auflöst.

        GoTrue kennt keinen eigenen „E-Mail-Wechsel erneut senden"-Aufruf.
        Denselben Adresswechsel noch einmal anzustossen IST der vorgesehene
        Weg — `update_user_by_id({"email": …})` mit unverändertem Ziel
        erneuert den offenen Wechsel und verschickt die Bestätigung neu. Das
        ist genau der EINE freigegebene Aufruf, kein zweiter Mailweg
        (Wurzel 2/4).

        Voraussetzung ist ein Portalzugang: ohne Login gibt es keine
        Anmeldeadresse, die zu bestätigen wäre — dann ist die Adresse reine
        Korrespondenzadresse und schon mit dem Speichern fertig.

        Scope (Wurzel 3/9): derselbe Helfer und derselbe Scope wie der
        List-Pfad — `_get_row(tenant_id, owner_id)` wirft 404 bei einem
        fremden Mandanten, und die `user_id` stammt aus der GESCOPTEN Zeile,
        nie aus der Anfrage.
        """
        tenant_id = self._require_tenant(ctx)
        row = self._get_row(tenant_id, owner_id)
        email = (row.get("email") or "").strip()
        if not email:
            raise OwnerError(
                "Für die Bestätigung wird eine E-Mail-Adresse gebraucht.",
                status_code=422,
            )
        if not row.get("user_id"):
            raise OwnerError(
                "Für diesen Eigentümer gibt es keinen Portalzugang — die "
                "Adresse gilt bereits ohne Bestätigung.",
                status_code=409,
            )
        try:
            self._db.auth.admin.update_user_by_id(
                str(row["user_id"]), {"email": email}
            )
        except Exception as exc:
            log.warning(
                "owner_email_bestaetigung_erneut_fehlgeschlagen",
                tenant_id=tenant_id,
                owner_id=owner_id,
                email=mask_email(email),
                error=str(exc)[:200],
            )
            raise OwnerError(
                "Die Bestätigung konnte nicht erneut verschickt werden — die "
                "Adresse ist vermutlich bereits vergeben.",
                status_code=409,
            ) from exc
        log.info(
            "owner_email_bestaetigung_erneut_versendet",
            tenant_id=tenant_id,
            owner_id=owner_id,
            actor=ctx.user_id,
            neu=mask_email(email),
        )
        return email

    def delete(
        self, ctx: AuthContext, owner_id: str, *, mit_eigennutzungen: bool = False
    ) -> None:
        """Eigentümer löschen — mit allem, was nur seinetwegen existiert.

        ZWEI GEGENZUSTÄNDE (Wurzel 1), beide gehören zum Löschen dazu:

        1. EIGENNUTZUNGEN. Ohne `mit_eigennutzungen` ist das ein 409 mit der
           ANZAHL betroffener Aufenthalte, damit die Oberfläche danach fragen
           kann. Mit dem Flag werden sie zuerst weggeräumt: aktive laufen durch
           `ReservationsService.cancel` (die EINE Stelle, die Kalendernächte
           freigibt), danach fallen alle Zeilen weg — auch die schon
           stornierten, die den Check-Constraint sonst weiter brechen.

        2. PORTALZUGANG. Login und Portal-Sicht gehen ohne eigene Rückfrage
           mit: sie existieren ausschließlich, weil es diesen Eigentümer gab.
           Blieben sie stehen, könnte sich ein gelöschter Eigentümer weiter
           anmelden — und ein später mit derselben Adresse neu angelegter
           Eigentümer bekäme KEINE Einladungsmail, weil `_portalzugang_
           einrichten` den übrig gebliebenen Login nur verknüpft (live
           aufgetreten, 10.08.2026).
        """
        tenant_id = self._require_tenant(ctx)
        row = self._get_row(tenant_id, owner_id)  # Scope + 404 vor Seiteneffekt
        stays = eigennutzungen_laden(self._db, tenant_id, owner_id)
        if stays and not mit_eigennutzungen:
            # Kein Abbruch, sondern eine RÜCKFRAGE: die Oberfläche zeigt die
            # Zahl und schickt denselben Aufruf mit `mit_eigennutzungen=true`
            # erneut. Die Zahl steht strukturiert daneben, nicht nur im Text —
            # sie ist die Grundlage der Frage, nicht bloß Dekoration.
            raise OwnerError(
                f"Dieser Eigentümer hat {len(stays)} Eigennutzung(en) im "
                "Kalender.",
                status_code=409,
                details={
                    "code": "owner_has_stays",
                    "eigennutzungen": len(stays),
                },
            )
        if stays:
            eigennutzungen_entfernen(
                self._db, ctx, tenant_id, owner_id, stays, fehler=OwnerError
            )
        # Der Zugang VOR der owners-Zeile: solange sie steht, ist über
        # `owners.user_id` nachvollziehbar, welcher Login zu räumen ist.
        # Scheitert das Löschen des Logins, bricht der Vorgang hier ab und der
        # Eigentümer bleibt vollständig bestehen — wiederholbar, statt ein
        # Eigentümer weg und sein Zugang übrig (Wurzel 5).
        user_id = row.get("user_id")
        if user_id:
            portalzugang_entfernen(
                self._db, tenant_id, str(user_id), fehler=OwnerError
            )
        res = (
            self._db.table("owners")
            .delete()
            .eq("tenant_id", tenant_id)
            .eq("id", owner_id)
            .execute()
        )
        if not res.data:
            raise OwnerError("Eigentümer nicht gefunden.", status_code=404)
        log.info(
            "owner_deleted",
            tenant_id=tenant_id,
            owner_id=owner_id,
            eigennutzungen=len(stays),
            portalzugang=bool(user_id),
        )

    def available_properties(
        self, ctx: AuthContext, owner_id: str
    ) -> AvailablePropertiesResponse:
        """Objekte, die diesem Owner zugeordnet werden dürfen: frei (keinem Owner
        zugeordnet) ODER bereits bei diesem Owner. Objekte anderer Eigentümer
        bleiben außen vor — ein Objekt gehört genau einem Eigentümer."""
        tenant_id = self._require_tenant(ctx)
        self._get_row(tenant_id, owner_id)
        return self._zuordenbare_objekte(tenant_id, owner_id)

    def free_properties(self, ctx: AuthContext) -> AvailablePropertiesResponse:
        """Objekte OHNE Eigentümer — die Auswahl für einen NEUEN Eigentümer.

        Der Anlege-Dialog kann `available_properties` nicht benutzen: dort gibt
        es noch keine `owner_id`, gegen die „frei ODER bereits seins" geprüft
        werden könnte. Fachlich ist es derselbe Filter mit leerer zweiter Hälfte,
        deshalb läuft er auch durch dieselbe Methode (`_zuordenbare_objekte`) —
        eine zweite Filter-Kopie wäre die zweite Wahrheit darüber, was
        zuordenbar ist.
        """
        tenant_id = self._require_tenant(ctx)
        # `owner_id=None` heißt: kein Eigentümer, dem schon etwas gehören
        # könnte — es bleiben genau die freien Objekte übrig.
        return self._zuordenbare_objekte(tenant_id, None)

    def by_property(
        self, ctx: AuthContext, property_id: str
    ) -> OwnerByPropertyResponse:
        """Wem gehört DIESES Objekt? — der Personenbezug für die Eigennutzung.

        WARUM ES DIESEN WEG BRAUCHT: Wer eine Eigennutzung anlegt (0353,
        `reservations.owner_id`), muss den Eigentümer des gewählten Objekts
        kennen. Über die vorhandenen Routen ging das nur als N+1: alle
        Eigentümer listen (`OwnerListItem` trägt nur `property_count`, keine
        property_ids), dann für jeden mit Objekten das Detail laden und den
        Treffer suchen. Bei 40 Eigentümern sind das 41 Abrufe für eine Frage,
        die eine Zeile in `owner_properties` beantwortet.

        WARUM IM owners-SLICE UND NICHT AM OBJEKT: Die Antwort besteht aus
        Eigentümer-Stammdaten. Läge sie am properties-Slice, müsste der
        `owners`-Zugriff samt seines Feldzuschnitts dort ein zweites Mal
        entstehen — und der Zuschnitt ist hier die eigentliche Arbeit
        (`OwnerKontakt` statt `OwnerBase`). Das Objekt ist der EINGANG, nicht
        der Inhalt; deshalb `/owners/by-property/{property_id}`.

        ZWEI SCOPES, beide über den Mandanten aus dem verifizierten Token
        (Wurzel 3):
        1. Das OBJEKT gehört dem Mandanten — `load_scoped` filtert per
           (id, tenant_id) in EINER Abfrage und wirft sonst 404. Ohne diese
           Prüfung ließe sich über eine geratene property_id der Eigentümer
           eines fremden Betriebs samt Kontaktdaten auslesen.
        2. Der EIGENTÜMER gehört dem Mandanten — die Zuordnung wird über
           `owners.tenant_id` gegengeprüft. Das ist kein doppelter Boden ohne
           Grund: `owner_properties` trägt selbst keine tenant_id, ein
           fehlgeleiteter Link zeigte sonst ungeprüft auf einen fremden
           Stammsatz.

        KEIN EIGENTÜMER IST KEIN FEHLER: Die Zuordnung ist optional. In dem
        Fall kommt 200 mit `owner=None` zurück — der Aufrufer unterscheidet
        „nachgesehen, keiner da" von „Abruf fehlgeschlagen" (Wurzel 4/5). Ein
        404 hätte beide Aussagen in einen Statuscode gepackt.
        """
        tenant_id = self._require_tenant(ctx)
        # Load und Scope untrennbar (Wurzel 3) — kein roher Load mit
        # nachträglichem `!= tenant_id`.
        load_scoped(
            self._db,
            "properties",
            property_id,
            tenant_id,
            columns="id",
            not_found=OwnerError("Objekt nicht gefunden.", status_code=404),
        )
        # `owners!inner` erzwingt den Mandanten des STAMMSATZES in derselben
        # Abfrage; ein Link auf einen fremden Eigentümer fällt damit heraus,
        # statt seine Kontaktdaten auszuliefern.
        rows = (
            self._db.table("owner_properties")
            .select(
                "owner_id, "
                "owners!inner(id, tenant_id, name, company, email, phone, "
                "country, language)"
            )
            .eq("property_id", property_id)
            .eq("owners.tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return OwnerByPropertyResponse(property_id=property_id, owner=None)
        eigentuemer = rows[0].get("owners") or {}
        # PostgREST liefert einen 1:1-Embed als Objekt, ältere Fassungen als
        # einelementige Liste. Beides annehmen, statt sich auf eine Form zu
        # verlassen, die eine Client-Version später ändert.
        if isinstance(eigentuemer, list):
            eigentuemer = eigentuemer[0] if eigentuemer else {}
        if not eigentuemer:
            return OwnerByPropertyResponse(property_id=property_id, owner=None)
        return OwnerByPropertyResponse(
            property_id=property_id,
            owner=OwnerKontakt(
                id=str(eigentuemer["id"]),
                name=eigentuemer.get("name") or "",
                company=eigentuemer.get("company"),
                email=eigentuemer.get("email"),
                phone=eigentuemer.get("phone"),
                country=eigentuemer.get("country"),
                language=eigentuemer.get("language"),
            ),
        )

    def _zuordenbare_objekte(
        self, tenant_id: str, owner_id: str | None
    ) -> AvailablePropertiesResponse:
        """Objekte des Mandanten, die `owner_id` zugeordnet werden dürfen.

        Zuordenbar = keinem Eigentümer zugeordnet ODER bereits diesem. Mit
        `owner_id=None` (neuer Eigentümer) bleiben nur die freien übrig.

        Adresse und erstes Foto kommen mit, weil die Mehrfachauswahl sie zeigt:
        bei 18 ähnlich benannten Objekten ist die Adresse das
        Unterscheidungsmerkmal. Fehlen sie, bleiben sie leer — kein Platzhalter.
        """
        # Nur der geführte Bestand: ein archiviertes Objekt (0416) ist aus dem
        # Vertrag heraus und darf keinem Eigentümer mehr angeboten werden. Live
        # stand „Fewo-Mosbjerg-Sindal" (archiviert 21.08.2026) hier weiter als
        # freies Objekt (03.09.2026).
        query = nur_im_bestand(
            self._db.table("properties")
            .select("id, title, street, house_number, city, photos")
            .eq("tenant_id", tenant_id)
        )
        # Betriebsart-Scope wie in PropertiesService.list(): keine
        # betriebsfremden Objekte zur Zuordnung anbieten.
        allowed = types_for_accommodation(self._accommodation_type(tenant_id))
        if allowed is not None:
            query = query.in_("property_type", sorted(t.value for t in allowed))
        props = query.order("title").execute().data or []
        taken = (
            self._db.table("owner_properties")
            .select("property_id, owner_id")
            .execute()
        ).data or []
        # property_id → owner_id (alle Zuordnungen im Tenant via property scope).
        owner_by_prop = {str(t["property_id"]): str(t["owner_id"]) for t in taken}
        items = [
            AvailableProperty(
                id=str(p["id"]),
                title=p["title"],
                subtitle=_objekt_referenz(p),
                photo=_erstes_foto(p),
            )
            for p in props
            # `.get(id, owner_id)` heißt „nicht vergeben zählt als passend".
            # Bei owner_id=None ist der Vergleich None == None für alle freien
            # Objekte wahr und für jedes vergebene falsch — genau der Filter,
            # den der Anlege-Dialog braucht.
            if owner_by_prop.get(str(p["id"]), owner_id) == owner_id
        ]
        return AvailablePropertiesResponse(items=items)

    def assign_property(
        self, ctx: AuthContext, owner_id: str, req: OwnerPropertyAssign
    ) -> OwnerResponse:
        """Objekt zuordnen (oder Anteil/Provision aktualisieren). Nur eigene
        Tenant-Objekte erlaubt."""
        tenant_id = self._require_tenant(ctx)
        self._get_row(tenant_id, owner_id)
        if req.property_id not in self._tenant_property_ids(tenant_id):
            raise OwnerError(
                "Objekt gehört nicht zu diesem Konto.", status_code=400
            )
        # Dieselbe Grenze wie in `_zuordenbare_objekte`, serverseitig
        # erzwungen (Wurzel 3): die Auswahl zeigt Archiviertes nicht mehr, ein
        # direkter Aufruf mit der ID darf es ebenso wenig zuordnen.
        if self._ist_archiviert(tenant_id, req.property_id):
            raise OwnerError(
                "Objekt ist archiviert und kann keinem Eigentümer mehr "
                "zugeordnet werden.",
                status_code=422,
            )
        # Exklusivität: ein Objekt darf nur EINEM Eigentümer gehören. Ist es
        # bereits einem ANDEREN Owner zugeordnet, klar abweisen (kein stilles
        # Umhängen). Aktualisieren des eigenen Links (Anteil/Provision) bleibt ok.
        existing = (
            self._db.table("owner_properties")
            .select("owner_id, owners(name)")
            .eq("property_id", req.property_id)
            .neq("owner_id", owner_id)
            .limit(1)
            .execute()
        ).data or []
        if existing:
            other = existing[0].get("owners") or {}
            other_name = other.get("name") if isinstance(other, dict) else None
            raise OwnerError(
                "Objekt ist bereits einem anderen Eigentümer zugeordnet"
                + (f" ({other_name})" if other_name else "")
                + ". Erst dort entfernen.",
                status_code=409,
            )
        self._db.table("owner_properties").upsert(
            {
                "owner_id": owner_id,
                "property_id": req.property_id,
                "ownership_share": req.ownership_share,
                "commission_override_pct": req.commission_override_pct,
            },
            on_conflict="owner_id,property_id",
        ).execute()
        log.info(
            "owner_property_assigned",
            tenant_id=tenant_id,
            owner_id=owner_id,
            property_id=req.property_id,
        )
        # Hat der Eigentümer einen Portalzugang, muss er das Objekt auch SEHEN.
        # Ohne diese Zeile wächst die Abrechnungsseite, die Portal-Sicht nicht.
        row = self._get_row(tenant_id, owner_id)
        if row.get("user_id"):
            self._portalsicht_nachziehen(tenant_id, owner_id, str(row["user_id"]))
        return self.get(ctx, owner_id)

    def assign_properties(
        self, ctx: AuthContext, owner_id: str, property_ids: list[str]
    ) -> OwnerResponse:
        """Mehrere Objekte auf einmal zuordnen (nachträglich, Detailseite).

        Derselbe Weg wie beim Anlegen — nur ohne die Eigentümer-Anlage davor.
        Anteil und Provisions-Override bleiben auf dem Standard; feinjustiert
        wird pro Objekt weiterhin über `assign_property`.
        """
        tenant_id = self._require_tenant(ctx)
        row = self._get_row(tenant_id, owner_id)
        self._objekte_zuordnen(tenant_id, owner_id, property_ids)
        if row.get("user_id"):
            self._portalsicht_nachziehen(tenant_id, owner_id, str(row["user_id"]))
        return self.get(ctx, owner_id)

    def unassign_property(
        self, ctx: AuthContext, owner_id: str, property_id: str
    ) -> OwnerResponse:
        tenant_id = self._require_tenant(ctx)
        row = self._get_row(tenant_id, owner_id)
        self._db.table("owner_properties").delete().eq("owner_id", owner_id).eq(
            "property_id", property_id
        ).execute()
        # Gegenzustand (Wurzel 1): mit dem Eigentum endet auch die Portal-Sicht.
        # Bliebe der Eintrag in `owner_property_assignments` stehen, sähe ein
        # Eigentümer Kalender und Daten eines Objekts weiter, das ihm nicht mehr
        # gehört — die Zuordnung wäre entfernt und der Zugriff trotzdem offen.
        if row.get("user_id"):
            self._db.table("owner_property_assignments").delete().eq(
                "tenant_id", tenant_id
            ).eq("user_id", str(row["user_id"])).eq(
                "property_id", property_id
            ).execute()
            # Dasselbe für die Familienzugänge, die dieser Eigentümer für
            # DIESES Objekt vergeben hat (0389). Sie hängen an seinem Login,
            # nicht am Eigentum, und blieben sonst mit voller Sicht stehen —
            # auf ein Objekt, das ihrem Eigentümer nicht mehr gehört. Zuerst
            # die Sicht, dann die Familien-Zeile: bricht es dazwischen ab,
            # bleibt ein Zugang OHNE Sicht (harmlos) statt einer Sicht ohne
            # Stufe, die im Code als „Eigentümer" gelesen würde.
            familie = (
                self._db.table("owner_family_members")
                .select("user_id")
                .eq("tenant_id", tenant_id)
                .eq("owner_user_id", str(row["user_id"]))
                .eq("property_id", property_id)
                .execute()
            ).data or []
            for mitglied in {str(r["user_id"]) for r in familie}:
                self._db.table("owner_property_assignments").delete().eq(
                    "tenant_id", tenant_id
                ).eq("user_id", mitglied).eq(
                    "property_id", property_id
                ).execute()
            self._db.table("owner_family_members").delete().eq(
                "tenant_id", tenant_id
            ).eq("owner_user_id", str(row["user_id"])).eq(
                "property_id", property_id
            ).execute()
        log.info(
            "owner_property_unassigned",
            tenant_id=tenant_id,
            owner_id=owner_id,
            property_id=property_id,
        )
        return self.get(ctx, owner_id)

    def _validate_user_link(self, tenant_id: str, user_id: str | None) -> None:
        """Wenn ein Owner-Login-User verknüpft wird, muss er Rolle 'owner' im
        selben Tenant haben (Portal-Scoping setzt darauf auf)."""
        if not user_id:
            return
        rows = (
            self._db.table("users")
            .select("id, role")
            .eq("id", user_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise OwnerError("Verknüpfter Nutzer nicht gefunden.", status_code=404)
        if rows[0].get("role") != "owner":
            raise OwnerError(
                "Nur ein Nutzer mit der Rolle 'owner' kann verknüpft werden.",
                status_code=400,
            )


def _objekt_referenz(p: dict) -> str | None:
    """Zweite Zeile in der Auswahlliste: Adresse als Unterscheidungsmerkmal.

    Fehlt sie, ist das Ergebnis None und die Zeile bleibt weg — kein
    „Adresse unbekannt" und kein Leerstring, der wie ein leeres Feld aussieht.
    """
    strasse = " ".join(
        str(p[k]).strip() for k in ("street", "house_number") if p.get(k)
    )
    teile = [t for t in (strasse, str(p.get("city") or "").strip()) if t]
    return ", ".join(teile) or None


def _erstes_foto(p: dict) -> str | None:
    """Vorschaubild für die Auswahlliste. Ohne Fotos: None (Haus-Symbol)."""
    fotos = p.get("photos")
    if isinstance(fotos, list) and fotos:
        return str(fotos[0])
    return None


def _belegt_meldung(belegt: list[dict], titel: dict[str, str]) -> str:
    """Fehlertext für Objekte, die schon einem anderen Eigentümer gehören.

    Nennt die OBJEKTE beim Namen. Ein „mindestens eines der Objekte ist
    vergeben" zwingt den Betreiber, bei 18 Objekten selbst zu suchen, welches
    gemeint ist — und genau dieses Suchen soll die Mehrfachauswahl ersparen.
    """
    namen = []
    for row in belegt:
        pid = str(row["property_id"])
        anderer = row.get("owners")
        anderer_name = anderer.get("name") if isinstance(anderer, dict) else None
        # Der Objekttitel steht in `titel` — die IDs kamen ja gerade von dort.
        # Fehlt er dennoch, steht die ID da: eine ID ist unschön, aber wahr,
        # ein erfundener Platzhalter wäre es nicht (Wurzel 4).
        eintrag = titel.get(pid, pid)
        namen.append(f"{eintrag} ({anderer_name})" if anderer_name else eintrag)
    return (
        "Diese Objekte sind bereits einem anderen Eigentümer zugeordnet: "
        + ", ".join(namen)
        + ". Erst dort entfernen."
    )


def _owner_row(r: dict) -> dict:
    """DB-Zeile in das Response-Schema überführen (None-/Typ-Glättung)."""
    return {
        "id": str(r["id"]),
        "tenant_id": str(r["tenant_id"]),
        "name": r["name"],
        "company": r.get("company"),
        "email": r.get("email"),
        "phone": r.get("phone"),
        "street": r.get("street"),
        "house_number": r.get("house_number"),
        "postal_code": r.get("postal_code"),
        "city": r.get("city"),
        "country": r.get("country"),
        "tax_id": r.get("tax_id"),
        "vat_id": r.get("vat_id"),
        "iban": r.get("iban"),
        "bic": r.get("bic"),
        "bank_name": r.get("bank_name"),
        "account_holder": r.get("account_holder"),
        # `or 0` stand hier bis 09.08.2026 und machte aus einem FEHLENDEN Satz
        # eine 0, die der Client nicht mehr von einer vereinbarten 0 %
        # unterscheiden konnte — die Maske zeigte „0 %", wo nichts vereinbart
        # war (Wurzel 4). NULL bleibt jetzt NULL; die UI zeigt dafür ein leeres
        # Feld mit Hinweis statt einer erfundenen Zahl.
        "default_commission_pct": (
            float(r["default_commission_pct"])
            if r.get("default_commission_pct") is not None
            else None
        ),
        "default_payout_method": r.get("default_payout_method"),
        "statement_frequency": r.get("statement_frequency") or "none",
        "notes": r.get("notes"),
        # Die Korrespondenzsprache MUSS hier stehen. Fehlte sie, fiel die
        # Antwort still auf den Schema-Default `None` zurück: die DB trug
        # längst `da`, die API meldete `null`, und die UI zeigte nach dem
        # Speichern wieder ein leeres Sprachfeld — ein Wert, der gesetzt ist
        # und trotzdem als „nicht erfasst" ausgeliefert wird (Wurzel 4).
        "language": r.get("language"),
        "user_id": str(r["user_id"]) if r.get("user_id") else None,
        "created_at": str(r["created_at"]) if r.get("created_at") else None,
        "updated_at": str(r["updated_at"]) if r.get("updated_at") else None,
    }
