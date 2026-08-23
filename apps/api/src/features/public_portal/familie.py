"""Familienzugänge des Eigentümers (0389).

Ein Ferienhaus gehört einer Familie, nicht einer Person. Bisher hatte genau ein
Mensch den Portalzugang; Ehepartner und Kinder teilten sich dessen Passwort oder
riefen bei der Agentur an. Beides ist schlecht: ein geteiltes Passwort macht
jeden Vorgang urheberlos (wer hat die Sperrung beantragt?), und der Anruf landet
bei einer Agentur, die den Wunsch gar nicht beurteilen kann — ob Tante Inge im
Juli darf, weiß nur die Familie.

Dieses Modul macht zwei Dinge:
  * Familienmitglieder mit EIGENEM Login einladen, mit einer Zugriffsstufe je
    Person und Objekt (`owner_family_members`).
  * Deren Sperrwünsche in Stufe 1 durch den Eigentümer führen
    (`block_requests.owner_freigabe`), BEVOR die Agentur sie sieht.

Bewusst ein eigenes Modul neben `service.py`: Der Portal-Service ist bereits
über 1300 Zeilen, und die Freigabe-Logik ist ein abgeschlossener Vorgang mit
eigenen Riegeln. Der Einladungs-WEG dagegen wird NICHT hier nachgebaut, sondern
an `AuthService.invite` delegiert — denselben, den die Agentur benutzt. Vorbild
ist `owners/service.py:_einladen`, das es genauso hält: „Ein zweiter
Einladungsweg wäre eine Kopie, die beim nächsten Sicherheitsfix vergessen wird."
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

import structlog
from supabase import Client

from ..auth.permissions import Capability, owner_family_has_capability
from ..auth.schemas import UserRole

if TYPE_CHECKING:  # pragma: no cover - nur für Typprüfung
    from src.core.security import AuthContext

log = structlog.get_logger(__name__)

# Die Stufen aus dem Enum public.owner_family_access (0389). Als Tupel statt
# frei geformter Strings, damit ein Tippfehler hier auffällt und nicht erst als
# leere Rechte-Menge beim Nutzer (fail-closed).
STUFEN: tuple[str, ...] = ("nutzung", "nutzung_berichte")

# Obergrenze je Objekt. Ohne sie wäre „Familienzugang" ein unbegrenzter
# Einladungs-Endpunkt für den Kunden — jede Einladung legt einen Auth-User an
# und verschickt eine Mail (Wurzel 8: jeder unbegrenzte Bereich bekommt eine
# harte Grenze). 25 ist großzügig für eine Familie und klein genug, dass
# Missbrauch auffällt, bevor er teuer wird.
MAX_FAMILIE_JE_OBJEKT = 25


class FamilieError(Exception):
    """Fachlicher Fehler mit HTTP-Status (wie PortalError im Nachbarmodul)."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class OwnerFamilyService:
    """Familienzugänge verwalten und Sperranträge in Stufe 1 entscheiden."""

    def __init__(self, service_client: Client) -> None:
        self._db = service_client

    # --- Grundlagen ---------------------------------------------------------

    @staticmethod
    def _require(ctx: AuthContext) -> tuple[str, str]:
        if not ctx.tenant_id or not ctx.user_id:
            raise FamilieError("Kein Tenant/Nutzer im Konto.", status_code=400)
        return ctx.tenant_id, ctx.user_id

    def mitgliedschaft(self, ctx: AuthContext, property_id: str) -> dict | None:
        """Die Familien-Zeile des aktuellen Nutzers für dieses Objekt.

        `None` heißt: kein Familienmitglied — also entweder der Eigentümer
        selbst oder jemand ohne Bezug. Der Aufrufer entscheidet, was das
        bedeutet; hier wird nichts geraten.
        """
        tenant_id, user_id = self._require(ctx)
        rows = (
            self._db.table("owner_family_members")
            .select("id, owner_user_id, property_id, access")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def stufe(self, ctx: AuthContext) -> str | None:
        """Kontoweite Familienstufe des eingeloggten Nutzers (0389).

        Die EINE Quelle für `effective_capabilities(..., family_access=…)` in
        den Portal-Guards. `None` = kein Familienmitglied (der Eigentümer
        selbst) und damit keine Deckelung.
        """
        tenant_id, user_id = self._require(ctx)
        return familienstufe(self._db, tenant_id, user_id)

    def eigene_rolle(self, ctx: AuthContext) -> dict:
        """Was ist dieser Portal-Nutzer, und was darf er?

        Für die Oberfläche: Sie darf keinen Menüpunkt zeigen, der in eine
        leere Liste oder einen 403 führt. Ohne diese Auskunft müsste sie es
        aus dem Vorhandensein von Daten erraten — und ein Ladefehler sähe
        dann aus wie „keine Rechte" (Wurzel 4/5).

        Drei Aussagen:
          ist_familienmitglied — es gibt mindestens eine Zuordnung zu mir
          darf_berichte       — mindestens eine davon trägt 'nutzung_berichte'
                                (der Eigentümer selbst: immer true)
          darf_zugaenge       — darf Familienzugänge vergeben und Stufe 1
                                entscheiden; nur der Eigentümer selbst
        """
        tenant_id, user_id = self._require(ctx)
        rows = (
            self._db.table("owner_family_members")
            .select("access")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .execute()
        ).data or []
        ist_mitglied = bool(rows)
        return {
            "ist_familienmitglied": ist_mitglied,
            "darf_berichte": (
                not ist_mitglied
                or any(r.get("access") == "nutzung_berichte" for r in rows)
            ),
            # Ein Familienmitglied verwaltet keine Zugänge und entscheidet
            # nichts — sonst umginge es die Hierarchie, für die es die Stufe
            # überhaupt gibt.
            "darf_zugaenge": not ist_mitglied,
        }

    def ist_familienmitglied(self, ctx: AuthContext) -> bool:
        """Ist dieser Nutzer IRGENDWO Familienmitglied?

        Trennt die beiden Sorten Portalnutzer, ohne ein Objekt zu kennen:
        Eigentümer (keine Zeile) und Familienmitglied (mindestens eine). Wird
        gebraucht, um die Berichte-Sperre zu greifen, bevor ein konkretes
        Objekt im Spiel ist.
        """
        tenant_id, user_id = self._require(ctx)
        rows = (
            self._db.table("owner_family_members")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        ).data or []
        return bool(rows)

    def darf(self, ctx: AuthContext, property_id: str, cap: Capability) -> bool:
        """Darf dieser Nutzer das an DIESEM Objekt?

        Die OBJEKTGENAUE Prüfung über die Capability-Matrix
        (`OWNER_FAMILY_CAPABILITIES`). Der Eigentümer selbst (keine
        Familien-Zeile) wird nicht eingeschränkt; ein Familienmitglied wird auf
        seine Stufe begrenzt, fail-closed bei unbekannter Stufe.

        ABGRENZUNG zu `PublicPortalService._darf_berichte`: Jenes fragt
        „mindestens EINE Zuordnung mit Berichten?" und ist für die
        objektübergreifenden Finanzflächen richtig (Umsatz summiert über alle
        Objekte). Diese Methode fragt „an DIESEM Objekt?" und ist die richtige,
        sobald eine Fläche je Objekt entscheidet. Zwei Fragen, zwei Antworten —
        beide gehen auf dieselbe Spalte `access`.
        """
        zeile = self.mitgliedschaft(ctx, property_id)
        if zeile is None:
            return True
        return owner_family_has_capability(zeile.get("access"), cap)

    # --- Liste --------------------------------------------------------------

    def liste(self, ctx: AuthContext, property_ids: list[str]) -> list[dict]:
        """Die Familienzugänge, die DIESER Eigentümer vergeben hat.

        Gefiltert auf `owner_user_id = ich` und zusätzlich auf die Objekte, die
        der Aufrufer ohnehin sehen darf. Beide Filter, obwohl einer genügte:
        Fiele die Objektzuordnung später auseinander (das ist live schon
        passiert, siehe owners/README), zeigte die Liste sonst Personen zu
        einem Objekt, das der Eigentümer nicht mehr hat.
        """
        tenant_id, user_id = self._require(ctx)
        if not property_ids:
            return []
        rows = (
            self._db.table("owner_family_members")
            .select(
                "id, user_id, property_id, access, created_at,"
                " users!owner_family_members_user_id_fkey(email, full_name)"
            )
            .eq("tenant_id", tenant_id)
            .eq("owner_user_id", user_id)
            .in_("property_id", property_ids)
            .order("created_at", desc=True)
            .execute()
        ).data or []
        return rows

    # --- Anlegen ------------------------------------------------------------

    def einladen(
        self,
        ctx: AuthContext,
        property_id: str,
        email: str,
        full_name: str,
        access: str,
        sprache: str | None = None,
    ) -> tuple[dict, bool]:
        """Ein Familienmitglied einladen. Gibt (Zeile, mail_versendet) zurück.

        Der Login entsteht über `AuthService.invite` mit `role=owner` — kein
        zweiter Einladungsweg. Lazy-Import wie in `owners/service.py`, damit
        der Portal-Slice nicht am Auth-Slice hängt.

        Idempotent (Wurzel 2): Existiert im Tenant schon ein Login zu dieser
        Adresse, wird VERKNÜPFT statt eingeladen, und der zweite Rückgabewert
        sagt ehrlich, dass keine Mail rausging. Ein Doppelklick erzeugt keinen
        zweiten Auth-User und keine zweite Mail.
        """
        tenant_id, user_id = self._require(ctx)
        if access not in STUFEN:
            raise FamilieError("Unbekannte Zugriffsstufe.", status_code=422)
        adresse = (email or "").strip().lower()
        if not adresse:
            raise FamilieError("E-Mail fehlt.", status_code=422)

        # NUR der Eigentümer lädt ein — nie ein Familienmitglied (Wurzel 9).
        #
        # Ohne diesen Riegel besteht ein Mitglied die Objekt-Prüfung des
        # Routers mühelos: `_sicht_geben` hat ihm ja genau diese
        # owner_property_assignments-Zeile gegeben. Es könnte dann jemanden
        # mit der Stufe 'nutzung_berichte' einladen, die der echte Eigentümer
        # nie vergeben hat — und würde als `owner_user_id` selbst zum
        # Freigabe-Anker: Anträge des Eingeladenen entschiede es fortan selbst,
        # und der Eigentümer sähe sie in seiner Liste nie. Das hebelt genau die
        # Hierarchie aus, für die es die zweite Stufe gibt.
        self._require_kein_mitglied(tenant_id, user_id, property_id)

        self._grenze_pruefen(tenant_id, property_id)

        vorhandener = self._login_zu_email(tenant_id, adresse)
        if vorhandener and vorhandener["id"] == user_id:
            # Der Eigentümer würde sich selbst zum eigenen Familienmitglied
            # machen — die DB lehnt das ab (owner_family_members_nicht_selbst),
            # aber ein sprechender Fehler ist besser als ein 500 aus dem
            # Constraint.
            raise FamilieError(
                "Sie können sich nicht selbst einladen.", status_code=422
            )

        mail_versendet = False
        if vorhandener:
            ziel_user_id = str(vorhandener["id"])
        else:
            ziel_user_id = self._neuen_login_einladen(
                ctx, adresse, full_name, sprache
            )
            mail_versendet = True

        zeile = self._zuordnung_schreiben(
            tenant_id=tenant_id,
            user_id=ziel_user_id,
            owner_user_id=user_id,
            property_id=property_id,
            access=access,
        )
        self._sicht_geben(tenant_id, ziel_user_id, property_id)
        log.info(
            "portal_familie_eingeladen",
            tenant_id=tenant_id,
            property_id=property_id,
            access=access,
            mail_versendet=mail_versendet,
        )
        return zeile, mail_versendet

    def _require_kein_mitglied(
        self, tenant_id: str, user_id: str, property_id: str | None = None
    ) -> None:
        """Der Aufrufer darf für dieses Objekt KEIN Familienmitglied sein.

        Der Riegel für alle verwaltenden Wege (einladen, Stufe ändern,
        entfernen). Ein Mitglied besteht die reine Objekt-Prüfung, weil es das
        Objekt sehen DARF — sehen und verwalten sind hier zwei verschiedene
        Dinge (Wurzel 9).

        `property_id=None` prüft objektübergreifend: Wer irgendwo Mitglied ist,
        verwaltet nirgends. Das ist die schärfere Lesart und für die
        Stufen-/Entfernen-Wege richtig, weil dort das Objekt erst aus der
        geladenen Zeile hervorgeht.
        """
        query = (
            self._db.table("owner_family_members")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
        )
        if property_id:
            query = query.eq("property_id", property_id)
        if query.limit(1).execute().data:
            # 404 wie überall im Portal: kein Existenz-Leak, und für die
            # Oberfläche ist der Weg schlicht nicht vorhanden.
            raise FamilieError("Nicht gefunden.", status_code=404)

    def _grenze_pruefen(self, tenant_id: str, property_id: str) -> None:
        vorhanden = (
            self._db.table("owner_family_members")
            .select("id", count="exact")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .execute()
        )
        if (vorhanden.count or 0) >= MAX_FAMILIE_JE_OBJEKT:
            raise FamilieError(
                f"Höchstens {MAX_FAMILIE_JE_OBJEKT} Zugänge je Objekt.",
                status_code=422,
            )

    def _login_zu_email(self, tenant_id: str, adresse: str) -> dict | None:
        rows = (
            self._db.table("users")
            .select("id, email")
            .eq("tenant_id", tenant_id)
            .ilike("email", adresse)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def _neuen_login_einladen(
        self,
        ctx: AuthContext,
        adresse: str,
        full_name: str,
        sprache: str | None,
    ) -> str:
        """Login über den EINEN Einladungsweg anlegen (AuthService.invite).

        Die Objektzuordnung macht `_sicht_geben` danach selbst: `InviteRequest`
        trägt sie nicht, und sie muss auf genau DIESES Objekt begrenzt sein.

        `sprache` wird durchgereicht, weil der Einladende hier der EIGENTÜMER
        ist — seine Browsersprache ist nicht die des Empfängers. Fehlt die
        Angabe, greift die Kette Betriebssprache → Englisch (Wurzel 4: lieber
        keine Angabe als eine plausibel erfundene).
        """
        # Lazy-Import: verhindert einen Import-Zyklus public_portal → auth →
        # public_portal und hält die Slice-Kopplung lose (Vorbild owners).
        from src.core.supabase import get_anon_client  # noqa: PLC0415

        from ..auth.schemas import InviteRequest  # noqa: PLC0415
        from ..auth.service import AuthService  # noqa: PLC0415

        tenant_id, user_id = self._require(ctx)
        # `invite` fasst ausschließlich den service_client an (Nutzeranlage,
        # users-Zeile, Mail). Der anon_client gehört zum Login-Pfad derselben
        # Klasse und wird hier nur gebraucht, weil der Konstruktor ihn verlangt
        # — dasselbe Muster wie in owners/service.py.
        auth = AuthService(anon_client=get_anon_client(), service_client=self._db)
        try:
            angelegt = auth.invite(
                InviteRequest(
                    email=adresse,
                    full_name=full_name or adresse,
                    role=UserRole.owner,
                    preferred_language=sprache,
                ),
                tenant_id=tenant_id,
                # Der Eigentümer ist der Einladende: seine Rechte klemmen die
                # Vergabe (Wurzel 3). Ein Eigentümer kann damit konstruktiv
                # niemanden mit mehr Rechten anlegen, als er selbst hat.
                granter_id=user_id,
            )
        except Exception as exc:  # noqa: BLE001 - in Fachfehler übersetzen
            log.warning("portal_familie_invite_fehler", error=str(exc))
            raise FamilieError(
                "Einladung konnte nicht versendet werden.", status_code=502
            ) from exc
        if not angelegt.user_id:
            raise FamilieError("Zugang konnte nicht angelegt werden.", status_code=500)
        return str(angelegt.user_id)

    def _zuordnung_schreiben(
        self,
        *,
        tenant_id: str,
        user_id: str,
        owner_user_id: str,
        property_id: str,
        access: str,
    ) -> dict:
        """Zuordnung anlegen oder Stufe aktualisieren.

        `upsert` auf (user_id, property_id) — den UNIQUE-Index dafür legt 0389
        an. Damit ist ein zweiter Klick auf „Einladen" kein Fehler, sondern
        eine Aktualisierung der Stufe (Wurzel 2).
        """
        res = (
            self._db.table("owner_family_members")
            .upsert(
                {
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "owner_user_id": owner_user_id,
                    "property_id": property_id,
                    "access": access,
                    "invited_by": owner_user_id,
                },
                on_conflict="user_id,property_id",
            )
            .execute()
        ).data
        if not res:
            raise FamilieError("Zugang konnte nicht angelegt werden.", status_code=500)
        return res[0]

    def _sicht_geben(self, tenant_id: str, user_id: str, property_id: str) -> None:
        """Objekt-Sichtbarkeit im Portal setzen (owner_property_assignments).

        Getrennt von der Familien-Zeile, weil der Portal-Scope überall über
        diese Tabelle läuft (`_owned_property_ids`). Ohne diesen Eintrag wäre
        das Familienmitglied eingeladen und sähe beim Login NICHTS — genau der
        Live-Bug, den owners/README für die Eigentümer selbst beschreibt.
        """
        self._db.table("owner_property_assignments").upsert(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "property_id": property_id,
            },
            on_conflict="user_id,property_id",
        ).execute()

    # --- Ändern und Entfernen ----------------------------------------------

    def stufe_aendern(self, ctx: AuthContext, mitglied_id: str, access: str) -> dict:
        """Zugriffsstufe eines Mitglieds ändern."""
        if access not in STUFEN:
            raise FamilieError("Unbekannte Zugriffsstufe.", status_code=422)
        tenant_id, user_id = self._require(ctx)
        zeile = self._eigene_zeile(tenant_id, user_id, mitglied_id)
        res = (
            self._db.table("owner_family_members")
            .update({"access": access})
            .eq("id", zeile["id"])
            .eq("tenant_id", tenant_id)
            .eq("owner_user_id", user_id)
            .execute()
        ).data
        if not res:
            raise FamilieError("Zugang nicht gefunden.", status_code=404)
        log.info("portal_familie_stufe", mitglied_id=mitglied_id, access=access)
        return res[0]

    def entfernen(self, ctx: AuthContext, mitglied_id: str) -> None:
        """Familienzugang entziehen.

        Entfernt BEIDES: die Familien-Zeile und die Objekt-Sichtbarkeit. Nur
        die Familien-Zeile zu löschen hinterließe einen Zugang, der das Objekt
        weiter sieht — nur eben ohne Stufe, was `darf()` als „Eigentümer"
        lesen würde. Das wäre eine Rechte-AUSWEITUNG durch Löschen (Wurzel 1:
        der Gegenzustand gehört mitgepflegt).

        Der Login selbst bleibt bestehen: Die Person kann Zugänge zu anderen
        Objekten haben, und ein Login zu löschen ist Sache der Agentur.
        """
        tenant_id, user_id = self._require(ctx)
        zeile = self._eigene_zeile(tenant_id, user_id, mitglied_id)
        # Zuerst die Sicht, dann die Familien-Zeile. In dieser Reihenfolge
        # entsteht bei einem Abbruch dazwischen ein Mitglied OHNE Sicht (harmlos,
        # es sieht nichts) statt eines Zugangs MIT Sicht und ohne Stufe.
        self._db.table("owner_property_assignments").delete().eq(
            "tenant_id", tenant_id
        ).eq("user_id", zeile["user_id"]).eq(
            "property_id", zeile["property_id"]
        ).execute()
        self._db.table("owner_family_members").delete().eq("id", zeile["id"]).eq(
            "tenant_id", tenant_id
        ).eq("owner_user_id", user_id).execute()
        log.info(
            "portal_familie_entfernt",
            tenant_id=tenant_id,
            property_id=zeile["property_id"],
        )

    def _eigene_zeile(self, tenant_id: str, user_id: str, mitglied_id: str) -> dict:
        """Eine Familien-Zeile laden, die DIESEM Eigentümer gehört.

        Load und Scope in derselben Abfrage (Wurzel 3/9): Der Item-Zugriff
        prüft denselben Filter wie die Liste (`owner_user_id`), nicht nur den
        Mandanten — sonst könnte ein Eigentümer über eine geratene UUID die
        Zugänge eines anderen Eigentümers im selben Betrieb verwalten.

        Zusätzlich der Mitglieds-Riegel: `owner_user_id` allein schützt hier
        zwar schon (ein Mitglied ist für niemanden Anker), aber genau diese
        Sorte „ein Filter genügt doch" war der Grund, warum der Einladungsweg
        offen stand. Zwei unabhängige Bedingungen sind billiger als der nächste
        Fund.
        """
        self._require_kein_mitglied(tenant_id, user_id)
        rows = (
            self._db.table("owner_family_members")
            .select("id, user_id, property_id, access, owner_user_id")
            .eq("id", mitglied_id)
            .eq("tenant_id", tenant_id)
            .eq("owner_user_id", user_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise FamilieError("Zugang nicht gefunden.", status_code=404)
        return rows[0]

    # --- Stufe 1: Freigabe der Sperranträge ---------------------------------

    def offene_antraege(self, ctx: AuthContext) -> list[dict]:
        """Sperranträge, die auf die Freigabe DIESES Eigentümers warten."""
        tenant_id, user_id = self._require(ctx)
        ids = self._meine_objekte_als_eigentuemer(tenant_id, user_id)
        if not ids:
            return []
        return (
            self._db.table("block_requests")
            .select(
                "id, property_id, unit_id, start_date, end_date, reason,"
                " created_at, requested_by, owner_freigabe, status"
            )
            .eq("tenant_id", tenant_id)
            .eq("owner_freigabe", "offen")
            .in_("property_id", ids)
            .order("created_at", desc=False)
            .execute()
        ).data or []

    def _meine_objekte_als_eigentuemer(
        self, tenant_id: str, user_id: str
    ) -> list[str]:
        """Objekte, für die dieser Nutzer Familienzugänge vergeben hat.

        Das ist der Freigabe-Scope: Nur wer für ein Objekt als
        `owner_user_id` eingetragen ist, entscheidet dessen Stufe 1.
        """
        rows = (
            self._db.table("owner_family_members")
            .select("property_id")
            .eq("tenant_id", tenant_id)
            .eq("owner_user_id", user_id)
            .execute()
        ).data or []
        return sorted({str(r["property_id"]) for r in rows})

    def antragsteller_namen(self, antraege: list[dict]) -> dict[str, str]:
        """Namen zu den Antragstellern nachschlagen.

        Der Eigentümer soll „Anna Jensen möchte vom 3. bis 10. Juli" lesen,
        nicht eine UUID. Ein Sammelabruf statt einer Abfrage je Zeile.

        Fehlt ein Name, bleibt der Eintrag WEG statt auf einen Platzhalter zu
        fallen — die Oberfläche zeigt dann die E-Mail oder gar nichts, aber
        erfindet keinen Namen (Wurzel 4).
        """
        ids = sorted({str(a["requested_by"]) for a in antraege if a.get("requested_by")})
        if not ids:
            return {}
        rows = (
            self._db.table("users")
            .select("id, full_name, email")
            .in_("id", ids)
            .execute()
        ).data or []
        namen: dict[str, str] = {}
        for r in rows:
            name = (r.get("full_name") or "").strip() or (r.get("email") or "").strip()
            if name:
                namen[str(r["id"])] = name
        return namen

    def entscheiden(
        self,
        ctx: AuthContext,
        antrag_id: str,
        *,
        freigeben: bool,
        note: str | None = None,
    ) -> dict:
        """Stufe 1 entscheiden: an die Agentur weiterreichen oder ablehnen.

        KEINE Kalenderwirkung. Das ist der Kern der Trennung: `status` bleibt
        unangetastet auf 'pending', und erst die Agentur löst mit ihrem
        `approve` die Reservierung samt Advisory-Lock, ARI-Outbox und
        Channex-Push aus. Bis dahin bleibt das Objekt normal verkäuflich.

        Compare-and-Set auf `owner_freigabe='offen'` (Wurzel 2): Bei zwei
        gleichzeitigen Klicks gewinnt einer, der andere bekommt 409 — die DB
        entscheidet, nicht die Reihenfolge der Requests.
        """
        tenant_id, user_id = self._require(ctx)
        antrag = self._antrag_in_meinem_scope(tenant_id, user_id, antrag_id)
        if antrag["owner_freigabe"] != "offen":
            raise FamilieError("Antrag ist bereits entschieden.", status_code=409)
        neu = "freigegeben" if freigeben else "abgelehnt"
        res = (
            self._db.table("block_requests")
            .update(
                {
                    "owner_freigabe": neu,
                    "owner_decided_by": user_id,
                    "owner_decided_at": datetime.now(UTC).isoformat(),
                    "owner_decision_note": note,
                }
            )
            .eq("id", antrag_id)
            .eq("tenant_id", tenant_id)
            .eq("owner_freigabe", "offen")
            .execute()
        ).data
        if not res:
            raise FamilieError("Antrag ist bereits entschieden.", status_code=409)
        log.info(
            "portal_familie_freigabe",
            tenant_id=tenant_id,
            antrag_id=antrag_id,
            entscheidung=neu,
        )
        return res[0]

    def _antrag_in_meinem_scope(
        self, tenant_id: str, user_id: str, antrag_id: str
    ) -> dict:
        """Antrag laden, der zu einem Objekt DIESES Eigentümers gehört.

        Wurzel 9: derselbe Scope wie `offene_antraege`. Ohne die
        Objekt-Einschränkung könnte ein Eigentümer über eine geratene UUID die
        Anträge eines fremden Eigentümers im selben Betrieb entscheiden.
        """
        ids = self._meine_objekte_als_eigentuemer(tenant_id, user_id)
        if not ids:
            raise FamilieError("Antrag nicht gefunden.", status_code=404)
        rows = (
            self._db.table("block_requests")
            .select("id, property_id, owner_freigabe, status, requested_by")
            .eq("id", antrag_id)
            .eq("tenant_id", tenant_id)
            .in_("property_id", ids)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise FamilieError("Antrag nicht gefunden.", status_code=404)
        return rows[0]


# --- Benachrichtigung an den Eigentümer -------------------------------------
# Als Modulfunktionen und nicht als Methoden des Portal-Service: Sie gehören
# fachlich zu den Familienzugängen, und `service.py` ist bereits an der
# Zeilengrenze (pylint C0302). Der Portal-Service ruft sie auf, statt sie zu
# besitzen — dasselbe Muster wie `melde_neuen_antrag` im calendar-Slice.


def antragsteller_name(db: Client, user_id: str) -> str:
    """Anzeigename für die Freigabe-Mail: Name, sonst E-Mail.

    Kein erfundener Platzhalter („Ein Familienmitglied"): Der Eigentümer soll
    erkennen, WER etwas möchte. Die E-Mail-Adresse existiert immer, es gibt
    also keinen Fall, in dem geraten werden müsste (Wurzel 4).
    """
    if not user_id:
        return ""
    rows = (
        db.table("users")
        .select("full_name, email")
        .eq("id", user_id)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        return ""
    return (rows[0].get("full_name") or "").strip() or (
        rows[0].get("email") or ""
    ).strip()


def melde_freigabe_noetig(
    db: Client, tenant_id: str, owner_user_id: str | None, antrag: dict
) -> None:
    """Den EIGENTÜMER bitten, den Antrag seiner Familie zu entscheiden (0389).

    Nicht die Agentur: Solange Stufe 1 offen ist, existiert der Antrag für sie
    nicht. Ihn ihr trotzdem zu melden hieße, eine Anfrage anzukündigen, die sie
    nirgends findet.

    Best-effort (Wurzel 5): Der Antrag steht in der DB und darf nicht daran
    scheitern, dass der Mailserver klemmt — der Eigentümer sieht ihn ohnehin in
    seiner Freigabe-Liste.
    """
    if not owner_user_id:
        return
    property_id = str(antrag["property_id"])
    try:
        from src.core.mail_texte import FALLBACK  # noqa: PLC0415
        from src.core.mail_texte import text as mail_text  # noqa: PLC0415
        from src.features.notification_settings.dispatcher import (  # noqa: PLC0415
            NotificationDispatcher,
        )

        rows = (
            db.table("properties")
            .select("title")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        titel = (rows[0].get("title") if rows else None) or property_id[:8]
        zeitraum = f"{antrag['start_date']} – {antrag['end_date']}"
        werte: dict[str, object] = {
            "titel": titel,
            "zeitraum": zeitraum,
            # Der Name gehört in den Satz, statt ihn zu umschreiben („ein
            # Zugang deiner Familie") — das überträgt sich in keine der 24
            # Sprachen elegant, ein Eigenname in jede.
            "antragsteller": antragsteller_name(
                db, str(antrag.get("requested_by") or "")
            ),
        }
        rumpf_keys = ["sperrantrag.rumpf_freigabe"]
        grund = (antrag.get("reason") or "").strip()
        if grund:
            rumpf_keys.append("sperrantrag.begruendung")
            werte["grund"] = grund
        NotificationDispatcher(db).sende(
            user_id=owner_user_id,
            schluessel="block_freigabe",
            # Glocke: fertiger Satz in der Ausweichsprache. Mail/SMS bekommen
            # Schlüssel, die der Dispatcher in die Sprache des EMPFÄNGERS
            # übersetzt.
            betreff=mail_text("sperrantrag.freigabe", FALLBACK, **werte),
            text="\n\n".join(mail_text(k, FALLBACK, **werte) for k in rumpf_keys),
            betreff_key="sperrantrag.freigabe",
            betreff_werte=werte,
            text_key=rumpf_keys,
            text_werte=werte,
            tenant_id=tenant_id,
            property_id=property_id,
            ziel_pfad="/portal/sperrungen",
            # Ein Antrag, eine Meldung — auch bei wiederholtem Aufruf (Wurzel 2).
            dedup_key=f"block_freigabe:{antrag['id']}",
        )
    except Exception as exc:  # noqa: BLE001 - Versand darf den Antrag nicht kippen
        log.warning("portal_freigabe_meldung_fehler", error=str(exc)[:200])


# --- Finanzfreigabe und Freigabe-Stufe --------------------------------------
# Beide fragen dieselbe Spalte (`owner_family_members.access` bzw. die bloße
# Existenz einer Zeile) und gehören darum hierher, nicht in den Portal-Service.


def familienstufe(db: Client, tenant_id: str, user_id: str) -> str | None:
    """Die KONTOWEITE Familienstufe dieses Portal-Nutzers (0389).

    `None` heißt: keine Familien-Zeile — also der Eigentümer selbst, der nicht
    gedeckelt wird. Sonst die höchste Stufe, die IRGENDEINE seiner Zuordnungen
    trägt.

    Warum „die höchste" und nicht je Objekt: Diese Auskunft speist die
    Endpunkt-Guards, und die entscheiden über die FLÄCHE (darf der Fotoalbum-
    Endpunkt überhaupt antworten?), nicht über eine einzelne Zeile. Der
    Objekt-Scope kommt danach und unabhängig aus
    `owner_property_assignments` — ein Mitglied sieht also nie ein Objekt, zu
    dem es nicht zugeordnet ist, auch wenn seine Stufe an einem ANDEREN Objekt
    höher ist. Für objektgenaue Fragen gibt es `OwnerFamilyService.darf`.
    Dieselbe Bündelung nimmt `darf_berichte` seit jeher vor (unten) — sie ist
    hier nur benannt statt zweimal gedacht.

    Fail-closed (Wurzel 5): Ein unbekannter Wert in der Spalte wird
    unverändert zurückgegeben und ergibt über
    `owner_family_capabilities_for` die LEERE Fähigkeitsmenge — ein Tippfehler
    sperrt, statt zu öffnen.
    """
    rows = (
        db.table("owner_family_members")
        .select("access")
        .eq("tenant_id", tenant_id)
        .eq("user_id", user_id)
        .execute()
    ).data or []
    if not rows:
        return None
    vorhanden = {str(r.get("access")) for r in rows}
    for stufe in reversed(STUFEN):
        if stufe in vorhanden:
            return stufe
    # Nur unbekannte Werte: den ersten (stabil sortiert) zurückgeben, damit die
    # Deckelung greift und nichts geraten wird.
    return sorted(vorhanden)[0]


def darf_berichte(db: Client, tenant_id: str, user_id: str) -> bool:
    """Darf dieser Nutzer Finanzzahlen sehen? (0389)

    Die EINE Wahrheit für alle Finanzflächen des Portals — `earnings` und
    `my_statements` (dort als 403) und der Payout im Kalender (dort als
    unterdrückter Wert). Zwei getrennte Leser wären zwei Regeln, die
    auseinanderlaufen; genau so entstand die Lücke, dass der Kalender die
    Sperre der Berichte umging.

    Wer keine Familien-Zeile hat, ist der Eigentümer selbst und darf. Sonst
    muss mindestens EINE Zuordnung 'nutzung_berichte' tragen.

    Warum „mindestens eine" und nicht je Objekt: Umsatz und Auszahlung werden
    über alle zugeordneten Objekte zusammengerechnet. Eine Teilmengen-
    Auswertung ergäbe eine Zahl, die niemand wiederfindet — eine plausibel
    aussehende Falschaussage (Wurzel 4).

    Dieselbe Frage, nur anders geschnitten, stellt `familienstufe` — deshalb
    beantwortet sie sie hier, statt die Spalte ein zweites Mal auszuwerten.
    """
    stufe = familienstufe(db, tenant_id, user_id)
    # None = Eigentümer selbst.
    return stufe is None or stufe == "nutzung_berichte"


def freigabe_stufe(
    db: Client, tenant_id: str, user_id: str, property_id: str
) -> tuple[str, str | None]:
    """Braucht dieser Antrag die Freigabe eines Eigentümers? (0389)

    Rückgabe: (owner_freigabe-Wert, zuständiger Eigentümer oder None).

    Der Eigentümer selbst hat keine Familien-Zeile → 'nicht_noetig', sein
    Antrag geht wie bisher direkt an die Agentur (sich selbst zu genehmigen
    wäre ein Klick ohne Erkenntniswert). Ein Familienmitglied startet auf
    'offen' und ist für die Agentur unsichtbar, bis der Eigentümer entscheidet.
    """
    rows = (
        db.table("owner_family_members")
        .select("owner_user_id")
        .eq("tenant_id", tenant_id)
        .eq("user_id", user_id)
        .eq("property_id", property_id)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        return "nicht_noetig", None
    return "offen", str(rows[0]["owner_user_id"])
