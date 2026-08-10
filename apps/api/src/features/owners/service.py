"""Service-Schicht für owners (verwaltete Eigentümer).

CRUD über die Service-Role mit EXPLIZITEM tenant-Scope: tenant_id stammt immer
aus dem verifizierten JWT (AuthContext), nie aus User-Input (gleiches Muster wie
properties.service). Objekt-Zuordnung mit Anteil + Provisions-Override. Optionale
Verknüpfung zu einem Owner-Login-User spiegelt sich ins Portal-Scoping
(owner_property_assignments via auth.OwnerAssignmentService).
"""
from __future__ import annotations

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.properties.schemas import types_for_accommodation

from .schemas import (
    AvailablePropertiesResponse,
    AvailableProperty,
    OwnerCreate,
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
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


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
        return OwnerResponse(**_owner_row(row), properties=self._links(owner_id))

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
            row = self._portalzugang_einrichten(ctx, row)
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
            einladung_versendet=True,
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
        eigene = {
            str(r["id"]): r["title"]
            for r in (
                self._db.table("properties")
                .select("id, title")
                .eq("tenant_id", tenant_id)
                .in_("id", property_ids)
                .execute()
            ).data
            or []
        }
        fremd = [pid for pid in property_ids if pid not in eigene]
        if fremd:
            raise OwnerError(
                "Mindestens ein Objekt gehört nicht zu diesem Konto.",
                status_code=400,
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
        row = self._portalzugang_einrichten(ctx, row)
        # Der nachträgliche Zugang trifft in aller Regel einen Eigentümer, dem
        # bereits Objekte gehören — genau der Fall, in dem die fehlende
        # Portal-Sicht am meisten weh tut (Zugang da, Portal leer).
        self._portalsicht_nachziehen(tenant_id, owner_id, str(row["user_id"]))
        return OwnerResponse(
            **_owner_row(row),
            properties=self._links(owner_id),
            einladung_versendet=True,
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

    def _portalzugang_einrichten(self, ctx: AuthContext, row: dict) -> dict:
        """Login-Nutzer anlegen, einladen und mit dem Eigentümer verknüpfen.

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
            self._validate_user_link(tenant_id, vorhandener)
            return self._user_verknuepfen(tenant_id, owner_id, vorhandener)

        user_id = self._einladen(ctx, row=row, email=email)
        return self._user_verknuepfen(tenant_id, owner_id, user_id)

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
        tenant_id = self._require_tenant(ctx)
        self._get_row(tenant_id, owner_id)  # 404, wenn fremd
        changes = req.model_dump(mode="json", exclude_unset=True)
        if "user_id" in changes:
            self._validate_user_link(tenant_id, changes["user_id"])
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
        log.info("owner_updated", tenant_id=tenant_id, owner_id=owner_id)
        return self.get(ctx, owner_id)

    def delete(self, ctx: AuthContext, owner_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        res = (
            self._db.table("owners")
            .delete()
            .eq("tenant_id", tenant_id)
            .eq("id", owner_id)
            .execute()
        )
        if not res.data:
            raise OwnerError("Eigentümer nicht gefunden.", status_code=404)
        log.info("owner_deleted", tenant_id=tenant_id, owner_id=owner_id)

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
        query = (
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
