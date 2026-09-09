"""Konto-Löschung aus der APP heraus (angemeldet).

Warum es diesen Weg NEBEN dem öffentlichen Formular (`service.py`) gibt: Apple
verlangt ihn ausdrücklich — App Review Guideline 5.1.1(v): *„If your app supports
account creation, you must also offer account deletion within the app."* Google
verlangt zusätzlich den Web-Weg für Leute, die die App schon deinstalliert haben.
Beide Wege sind Pflicht, und beide arbeiten auf DERSELBEN Tabelle
(`account_deletion_requests`, Migration 0413) — sonst gäbe es zwei Löschbücher,
und das Backoffice müsste in zwei Listen schauen.

Der Unterschied zum öffentlichen Formular ist die Beweislage: dort muss der
Postfach-Besitz erst per Mail-Link bewiesen werden (Double-Opt-in), hier ist er
durch die Anmeldung PLUS die Passwort-Rückfrage bereits bewiesen. Ein Antrag von
hier startet deshalb direkt als `confirmed`.

Zwei Fälle, weil an einem Konto Verschiedenes hängt:

* **Nicht der Kontoinhaber** (co_admin, staff, cleaner, owner): der eigene Zugang
  wird SOFORT gelöscht. Am Zugang selbst hängt kein Beleg — Buchungen, Rechnungen
  und Auszahlungen gehören dem Betrieb, nicht dem Login.
* **Kontoinhaber** (`role='admin'`): daran hängt der ganze BETRIEB. Sofort löschen
  wäre keine Funktion, sondern eine Waffe (dieselbe Überlegung wie in 0413) — und
  es würde die dänische Buchführungspflicht verletzen: Belege müssen 5 Jahre
  aufbewahrt werden. Hier entsteht deshalb ein Antrag, den das Backoffice prüft.
  Apple genügt das: die Richtlinie verlangt, dass der Nutzer die Löschung
  *initiieren* kann, nicht dass sie in derselben Sekunde vollzogen ist.

Was der Aufrufer erfährt, steht in der Antwort und ist bewusst konkret: WAS
gelöscht wurde, WAS aufbewahrt wird und WARUM. Ein „Konto gelöscht" auf einen
Antrag hin wäre eine Falschaussage (Wurzel 4).
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import structlog
from pydantic import SecretStr
from supabase import Client

from src.core.security import AuthContext
from src.features.auth.account_service import AccountService

from .service import TABELLE, LoeschantragError

log = structlog.get_logger(__name__)

# Der Freitext des Antragstellers wird gekappt wie im öffentlichen Formular —
# derselbe Grund (Wurzel 8), dieselbe Grenze.
GRUND_MAX = 2000

# Was der Betrieb NICHT löschen lassen kann, weil das Gesetz es verlangt. Steht
# hier als Text, weil die App es dem Nutzer vor der Bestätigung zeigen muss:
# eine Löschung, die stillschweigend Rechnungen behält, ist eine Täuschung.
AUFBEWAHRUNG_HINWEIS = (
    "Rechnungen, Zahlungen und Buchungsbelege bleiben aus gesetzlicher "
    "Aufbewahrungspflicht erhalten (Buchführung, 5 Jahre). Sie werden vom "
    "Konto getrennt und nicht weiter für den Betrieb verwendet."
)


class InAppLoeschung:
    """Löschung des eigenen Kontos für angemeldete Betriebs-Nutzer."""

    def __init__(self, *, db: Client, account_service: AccountService) -> None:
        # `db` ist der service_role-Client: die Antragstabelle ist für
        # anon/authenticated hart gesperrt (0413). `account_service` bringt die
        # Passwort-Rückfrage und den Auth-Löschpfad mit — beides existiert dort
        # schon, eine zweite Umsetzung würde driften.
        self._db = db
        self._konto = account_service

    # --- Lesen ---------------------------------------------------------------

    def status(self, ctx: AuthContext) -> dict[str, Any]:
        """Liegt für dieses Konto ein Löschantrag vor?

        Die App braucht das, um „Löschung beantragt am …" anzuzeigen statt den
        Knopf erneut anzubieten — sonst stellt jemand denselben Antrag dreimal
        und hält ihn für wirkungslos (Wurzel 2).
        """
        offen = self._offener_antrag(ctx.user_id)
        if offen is None:
            return {"antrag_offen": False, "beantragt_am": None, "hinweis": None}
        return {
            "antrag_offen": True,
            "beantragt_am": offen.get("confirmed_at") or offen.get("requested_at"),
            "hinweis": AUFBEWAHRUNG_HINWEIS,
        }

    # --- Schreiben -----------------------------------------------------------

    def loeschen(
        self, ctx: AuthContext, *, passwort: SecretStr, grund: str | None = None
    ) -> dict[str, Any]:
        """Eigenen Zugang löschen bzw. die Betriebs-Löschung beantragen.

        Die Passwort-Rückfrage ist Pflicht (Wurzel 7): ein gekapertes Token
        allein darf kein Konto vernichten können. Sie läuft über
        `AccountService.passwort_pruefen` — dieselbe Hürde wie beim E-Mail- und
        Passwortwechsel, inklusive ihres fail-closed-Verhaltens bei einer GoTrue-
        Störung.
        """
        self._konto.passwort_pruefen(ctx, passwort)

        eigene = self._eigene_zeile(ctx.user_id)
        rolle = (eigene.get("role") or "").strip()
        tenant_id = eigene.get("tenant_id")
        email = (eigene.get("email") or "").strip().lower()

        if rolle == "admin":
            return self._antrag_anlegen(
                user_id=ctx.user_id,
                tenant_id=tenant_id,
                email=email,
                grund=grund,
            )
        return self._zugang_loeschen(ctx, tenant_id=tenant_id, rolle=rolle)

    def antrag_zuruecknehmen(self, ctx: AuthContext) -> dict[str, Any]:
        """Einen eigenen, noch nicht ausgeführten Antrag zurückziehen.

        Der Gegenzustand zum Antrag (Wurzel 1). Ohne ihn bliebe ein versehentlich
        gestellter Antrag bis zur Bearbeitung stehen, und der einzige Ausweg wäre
        der Support.
        """
        offen = self._offener_antrag(ctx.user_id)
        if offen is None:
            raise LoeschantragError("Es liegt kein Löschantrag vor.", status_code=404)
        self._db.table(TABELLE).update(
            {
                "status": "rejected",
                "resolved_at": _jetzt(),
                "resolved_by": ctx.user_id,
                # Begründung ist bei `rejected` Pflicht (Trigger aus 0413) — und
                # hier auch inhaltlich richtig: der Antragsteller selbst hat
                # zurückgezogen.
                "resolution_note": "Vom Antragsteller in der App zurückgezogen.",
            }
        ).eq("id", offen["id"]).execute()
        log.info("konto_loeschantrag_zurueckgezogen", user_id=ctx.user_id)
        return {"antrag_offen": False, "beantragt_am": None, "hinweis": None}

    # --- Innereien -----------------------------------------------------------

    def _zugang_loeschen(
        self, ctx: AuthContext, *, tenant_id: str | None, rolle: str
    ) -> dict[str, Any]:
        """Login und Nutzerzeile entfernen — Reihenfolge wie bei
        `AccountService.delete_managed_user`: erst der Auth-Login (danach ist
        keine Anmeldung mehr möglich), dann die Zeile. Scheitert der zweite
        Schritt, bleibt der Nutzer sichtbar und der Aufruf ist wiederholbar; es
        entsteht KEIN Halbzustand mit funktionierendem Login.

        DAVOR läuft der Gegenzustand des EIGENTÜMERS (Wurzel 1). Er ist nötig,
        weil die Fremdschlüssel der Datenbank an zwei Stellen genau das Falsche
        tun, wenn die `users`-Zeile verschwindet — beide am 09.09.2026
        nachgemessen, keine Vermutung:

        * `block_requests.requested_by` ist `on delete cascade`, aber
          `availability.block_request_id` (0337) und
          `reservations.block_request_id` (0353) sind `on delete set null`. Der
          Antrag verschwindet also, die von ihm GESPERRTEN NÄCHTE bleiben — und
          mit dem Antrag verschwindet der einzige Anker, über den der Widerruf
          genau diese Nächte wieder freigeben könnte. Das Objekt bliebe für
          einen Zeitraum gesperrt, den niemand mehr erklären kann.
        * `owner_family_members` kaskadiert über `owner_user_id`, die
          `owner_property_assignments` der Familienmitglieder aber NICHT. Die
          Familie behielte die Objekt-Sicht, und `darf()` läse den fehlenden
          Familieneintrag als „ist selbst Eigentümer" — eine Rechte-AUSWEITUNG
          durch Löschen. `FamilieService.entfernen` beschreibt genau diesen
          Fall und macht es für den Einzelfall richtig; hier fehlte er.

        Was der Gegenzustand NICHT anfasst, und warum:
        * `owners` (Stammdaten, Bankverbindung, Provision) hängt über
          `owners.user_id` mit `on delete set null` — die verwaltete
          Eigentümer-PARTEI und ihre Abrechnungshistorie überleben. Das ist
          richtig: gelöscht wird ein LOGIN, nicht der Vertragspartner des
          Betriebs. `owner_statements`, `owner_properties` und der Anteil
          bleiben unberührt.
        * Vergangene Sperren bleiben stehen. Der Aufenthalt hat stattgefunden;
          seine Nächte nachträglich freizugeben wäre eine Verfälschung der
          Belegungshistorie.

        Reihenfolge bewusst: erst freigeben, dann löschen. Bricht der zweite
        Schritt ab, sind Nächte eines noch existierenden Kontos freigegeben —
        sichtbar im Portal als zurückgenommener Antrag und wiederholbar.
        Umgekehrt wäre der Zustand nicht mehr reparierbar, weil der Anker weg
        wäre.
        """
        user_id = ctx.user_id
        if rolle == "owner":
            self._sperren_freigeben(ctx)
            self._familienzugaenge_entziehen(user_id, tenant_id)

        try:
            # Derselbe service_role-Client, der auch die Antragstabelle bedient —
            # kein Griff in die Innereien des AccountService.
            self._db.auth.admin.delete_user(user_id)
        except Exception as exc:  # noqa: BLE001 — SDK-Fehler einheitlich melden
            log.warning(
                "konto_selbst_auth_delete_failed", user_id=user_id, error=str(exc)[:200]
            )
            raise LoeschantragError(
                "Der Zugang konnte nicht gelöscht werden. Bitte erneut versuchen.",
                status_code=502,
            ) from exc

        query = self._db.table("users").delete().eq("id", user_id)
        if tenant_id:
            query = query.eq("tenant_id", tenant_id)
        query.execute()

        log.info("konto_selbst_geloescht", user_id=user_id, tenant_id=tenant_id)
        return {
            "geloescht": True,
            "antrag_offen": False,
            "beantragt_am": None,
            "detail": (
                "Ihr Zugang wurde gelöscht. Die Daten des Betriebs bleiben "
                "bestehen — sie gehören dem Betrieb, nicht Ihrem Zugang."
            ),
            "hinweis": AUFBEWAHRUNG_HINWEIS,
        }

    def _sperren_freigeben(self, ctx: AuthContext) -> None:
        """Genehmigte, noch nicht abgelaufene Sperren dieses Eigentümers lösen.

        Über den EINEN bestehenden Weg (`SperrantragService.zuruecknehmen`),
        nicht über eine eigene Freigabe: dort hängt die ganze Kette dran —
        Storno der Eigennutzungs-Reservierung samt `_release_nights`, der
        Unblock über die Antrags-ID für den Altbestand, die bestellten
        Leistungen und der Stand an die Portale. Eine zweite Umsetzung hier
        würde davon Teile vergessen, und man sähe es erst am Portal.

        Der Filter ist `end_date >= heute`: `block_requests.end_date` ist
        INKLUSIV (siehe `lib/aufenthalt.ts`), ein heute endender Aufenthalt
        gehört also noch dazu.
        """
        # Erst hier importiert: `calendar` zieht den halben Reservierungs-Slice
        # nach, und `account_deletion` wird auch aus dem öffentlichen Web-Weg
        # geladen, der davon nichts braucht.
        from src.features.calendar.schemas import (  # noqa: PLC0415
            BlockRequestDecision,
        )
        from src.features.calendar.service import CalendarError  # noqa: PLC0415
        from src.features.calendar.sperrantraege import (  # noqa: PLC0415
            SperrantragService,
        )

        heute = datetime.now(UTC).date().isoformat()
        res = (
            self._db.table("block_requests")
            .select("id, property_id, start_date, end_date")
            .eq("tenant_id", ctx.tenant_id)
            .eq("requested_by", ctx.user_id)
            .eq("status", "approved")
            .gte("end_date", heute)
            .execute()
        )
        offen = res.data or []
        if not offen:
            return

        dienst = SperrantragService(self._db)
        entscheidung = BlockRequestDecision(
            note="Der Eigentümer hat sein Konto gelöscht; die Nächte sind frei."
        )
        for zeile in offen:
            antrag_id = str(zeile["id"])
            try:
                dienst.zuruecknehmen(ctx, antrag_id, entscheidung)
            except CalendarError as exc:
                if exc.status_code != 409:
                    # Alles andere ist ein echter Fehler und darf die Löschung
                    # NICHT still passieren lassen (Wurzel 5): sonst stünde das
                    # Objekt gesperrt und das Konto wäre weg.
                    raise
                # 409 heißt: der Antrag ist nicht mehr 'approved' — jemand war
                # schneller. Dann gibt es nichts freizugeben.
                log.info(
                    "konto_selbst_sperre_bereits_entschieden",
                    user_id=ctx.user_id,
                    antrag_id=antrag_id,
                )
                continue
            log.info(
                "konto_selbst_sperre_freigegeben",
                user_id=ctx.user_id,
                antrag_id=antrag_id,
                property_id=str(zeile["property_id"]),
                von=zeile.get("start_date"),
                bis=zeile.get("end_date"),
            )

    def _familienzugaenge_entziehen(
        self, user_id: str, tenant_id: str | None
    ) -> None:
        """Die Objekt-Sicht der Familienmitglieder dieses Eigentümers entziehen.

        Die `owner_family_members`-Zeilen selbst kaskadieren gleich mit dem
        Login weg; entzogen werden muss die `owner_property_assignments`-Zeile,
        die der Einladeweg zusätzlich anlegt (`FamilieService._sicht_geben`).

        Entzogen wird NUR die Sicht auf das Objekt DIESER Familienzeile. Ein
        Mensch kann von zwei Eigentümern eingeladen sein — wer pauschal alle
        Zuordnungen dieses Nutzers löschte, nähme ihm den Zugang zum Haus einer
        anderen Familie. Deshalb der zusätzliche Filter auf `property_id`, und
        deshalb erst die Prüfung, ob eine ANDERE Familienzeile dieselbe Sicht
        noch trägt.
        """
        res = (
            self._db.table("owner_family_members")
            .select("id, user_id, property_id")
            .eq("owner_user_id", user_id)
            .execute()
        )
        zeilen = res.data or []
        for zeile in zeilen:
            mitglied = str(zeile["user_id"])
            property_id = str(zeile["property_id"])
            weitere = (
                self._db.table("owner_family_members")
                .select("id")
                .eq("user_id", mitglied)
                .eq("property_id", property_id)
                .neq("owner_user_id", user_id)
                .limit(1)
                .execute()
            ).data or []
            if weitere:
                continue
            loeschen = (
                self._db.table("owner_property_assignments")
                .delete()
                .eq("user_id", mitglied)
                .eq("property_id", property_id)
            )
            if tenant_id:
                loeschen = loeschen.eq("tenant_id", tenant_id)
            loeschen.execute()
            log.info(
                "konto_selbst_familienzugang_entzogen",
                user_id=user_id,
                mitglied_id=mitglied,
                property_id=property_id,
            )

    def _antrag_anlegen(
        self,
        *,
        user_id: str,
        tenant_id: str | None,
        email: str,
        grund: str | None,
    ) -> dict[str, Any]:
        """Antrag für die Löschung des Betriebs anlegen (Kontoinhaber).

        Idempotent: liegt schon ein offener Antrag vor, wird er zurückgegeben
        statt ein zweiter angelegt. Der Teil-UNIQUE aus 0413 wäre der Backstop,
        aber ein 409 im Gesicht des Nutzers, der zweimal getippt hat, ist keine
        Antwort (Wurzel 2).
        """
        offen = self._offener_antrag(user_id)
        if offen is not None:
            return {
                "geloescht": False,
                "antrag_offen": True,
                "beantragt_am": offen.get("confirmed_at") or offen.get("requested_at"),
                "detail": (
                    "Ihr Löschantrag liegt bereits vor und wird geprüft. "
                    "Sie können ihn zurückziehen, solange er nicht ausgeführt ist."
                ),
                "hinweis": AUFBEWAHRUNG_HINWEIS,
            }

        jetzt = _jetzt()
        self._db.table(TABELLE).insert(
            {
                "email": email,
                # Direkt `confirmed`: der Postfach-Besitz ist durch Anmeldung und
                # Passwort-Rückfrage bewiesen, ein Mail-Link wäre hier eine Hürde
                # ohne Erkenntnisgewinn.
                "status": "confirmed",
                "reason": (grund or "").strip()[:GRUND_MAX] or None,
                "requested_at": jetzt,
                "confirmed_at": jetzt,
                "matched_user_id": user_id,
                "matched_tenant_id": tenant_id,
            }
        ).execute()

        log.info(
            "konto_loeschantrag_aus_app", user_id=user_id, tenant_id=tenant_id
        )
        return {
            "geloescht": False,
            "antrag_offen": True,
            "beantragt_am": jetzt,
            "detail": (
                "Ihr Löschantrag ist eingegangen. Weil Sie der Kontoinhaber sind, "
                "hängt der gesamte Betrieb an diesem Konto — Objekte, Buchungen, "
                "Portalverbindungen und Auszahlungen. Wir prüfen offene "
                "Zahlungen und Fristen und melden uns per E-Mail."
            ),
            "hinweis": AUFBEWAHRUNG_HINWEIS,
        }

    def _eigene_zeile(self, user_id: str) -> dict[str, Any]:
        res = (
            self._db.table("users")
            .select("id, tenant_id, email, role")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            # Kein Fallback auf „dann eben löschen": ohne Nutzerzeile ist die
            # Rolle unbekannt, und die Rolle entscheidet über Sofort-Löschung
            # oder Antrag (Wurzel 4).
            raise LoeschantragError("Konto nicht gefunden.", status_code=404)
        return rows[0]

    def _offener_antrag(self, user_id: str) -> dict[str, Any] | None:
        res = (
            self._db.table(TABELLE)
            .select("id, status, requested_at, confirmed_at")
            .eq("matched_user_id", user_id)
            .in_("status", ["pending", "confirmed"])
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None


def _jetzt() -> str:
    return datetime.now(UTC).isoformat()
