"""Genehmigungs-Workflow für Sperr-Anträge des Eigentümers (Etappe A).

WARUM IM calendar-SLICE UND NICHT IN public_portal:
Der Antrag wird im Eigentümer-Portal GESTELLT (public_portal), aber hier
ENTSCHIEDEN — und eine Entscheidung ist eine Kalender-Aktion: sie sperrt Nächte
in `availability` und schiebt sie über die ARI-Outbox an die Portale. Der ganze
Seiteneffekt liegt in `CalendarService` (block/unblock inkl. Doppelbuchungs-
schutz, je-Einheit-Zeilen aus 0266 und Channex-Push). Läge der Approve-Pfad im
public_portal, müsste der Owner-Slice den Kalender-Service importieren und den
Agentur-Scope (Capability APPROVE_BLOCK) mitführen — zwei Rollenwelten in einem
Modul, dessen Docstring „der eingeloggte Eigentümer sieht NUR seine Objekte"
verspricht. Getrennt bleibt: public_portal = Antragsteller (owner),
calendar/sperrantraege = Entscheider (Agentur).

ZUSTANDSAUTOMAT (bewusst klein, drei Zustände aus 0014):

    pending ──approve──> approved ──revoke──> rejected
       └─────reject────> rejected

Jeder Übergang geht NUR aus einem definierten Vorzustand und wird über einen
bedingten UPDATE geclaimt (Wurzel 2, siehe `_claim`). Ein zweiter Klick findet
den Vorzustand nicht mehr vor und bekommt 409 — nicht stillschweigend ein
zweites Mal denselben Seiteneffekt.
"""
from __future__ import annotations

from datetime import date, timedelta

from supabase import Client

from src.core.logging import get_logger
from src.core.mail_sprache import FALLBACK
from src.core.mail_texte import text as mail_text
from src.core.security import AuthContext
from src.features.auth.permissions import Capability, has_capability
from src.features.auth.schemas import UserRole

from .schemas import (
    BlockRequestDecision,
    DateRange,
    SperrantragItem,
    SperrantragListe,
)
from .service import CalendarError, CalendarService

log = get_logger("nextdays.sperrantraege")

# Spalten, die der Agentur-Blick braucht. Explizit statt "*", damit ein später
# ergänztes sensibles Feld nicht automatisch mit ausgeliefert wird.
_SPALTEN = (
    "id, tenant_id, property_id, unit_id, requested_by, start_date, end_date, "
    "status, reason, decided_by, decided_at, decision_note, created_at"
)

# Ein Antrag darf nicht beliebig weit in die Zukunft sperren — ein Tippfehler
# (Jahr 2099) würde sonst zehntausende availability-Zeilen je Einheit erzeugen
# und die ARI-Outbox fluten (Wurzel 8: jeder unbegrenzte Bereich braucht eine
# harte Obergrenze).
MAX_SPERR_NAECHTE = 730

# Die drei Entscheidungen und ihre Mailtexte (Betreff, Rumpf). Als Konstanten
# statt deutscher Wörter im Aufruf: der Empfänger ist ein Eigentümer, der
# überall in Europa sitzen kann, und der Dispatcher übersetzt beide Schlüssel
# in SEINE Sprache. „zurückgenommen" ist fachlich etwas anderes als
# „abgelehnt" (der Antrag WAR genehmigt) und hat darum einen eigenen Satz.
GENEHMIGT = "genehmigt"
ABGELEHNT = "abgelehnt"
ZURUECKGENOMMEN = "zurueckgenommen"

# Auditgrund für den Storno der Eigennutzung, wenn die Entscheidung keine
# Anmerkung trägt. Bewusst ein interner Protokolltext und kein Kundentext: er
# landet in `reservations.cancel_reason` (Audit-Spur der Agentur), nicht in
# einer Mail an den Eigentümer — die geht über die Katalog-Schlüssel raus.
_STORNO_GRUND = "Genehmigung des Sperrantrags zurückgenommen"

_ENTSCHEIDUNGS_TEXTE: dict[str, tuple[str, str]] = {
    GENEHMIGT: (
        "sperrantrag.entschieden_genehmigt",
        "sperrantrag.rumpf_genehmigt",
    ),
    ABGELEHNT: (
        "sperrantrag.entschieden_abgelehnt",
        "sperrantrag.rumpf_abgelehnt",
    ),
    ZURUECKGENOMMEN: (
        "sperrantrag.entschieden_zurueckgenommen",
        "sperrantrag.rumpf_zurueckgenommen",
    ),
}


class SperrantragService:
    """Agentur-Sicht auf die Sperr-Anträge der Eigentümer."""

    def __init__(self, db: Client, calendar: CalendarService | None = None) -> None:
        self._db = db
        self._calendar = calendar or CalendarService(client=db)

    # --- Scope ---------------------------------------------------------------

    def _tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise CalendarError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    def _laden(self, ctx: AuthContext, antrag_id: str) -> dict:
        """EINE Zeile per ID — Load und Scope in EINEM Schritt (Wurzel 3).

        Der Service läuft mit dem Service-Role-Key und umgeht RLS; ohne das
        `eq("tenant_id", …)` in DERSELBEN Abfrage ließe sich über eine geratene
        UUID der Sperrantrag eines fremden Mandanten lesen und entscheiden.
        Wurzel 9: derselbe Scope wie im List-Pfad, nicht bloß Authentifizierung.
        """
        tenant_id = self._tenant(ctx)
        rows = (
            self._db.table("block_requests")
            .select(_SPALTEN)
            .eq("id", antrag_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise CalendarError("Sperrantrag nicht gefunden.", status_code=404)
        return rows[0]

    # --- Liste ---------------------------------------------------------------

    def liste(
        self, ctx: AuthContext, *, status: str | None = None
    ) -> SperrantragListe:
        """Anträge des Mandanten. `status=None` → alle, sonst gefiltert."""
        tenant_id = self._tenant(ctx)
        query = (
            self._db.table("block_requests")
            .select(_SPALTEN)
            .eq("tenant_id", tenant_id)
        )
        if status:
            if status not in {"pending", "approved", "rejected"}:
                raise CalendarError(
                    f"Unbekannter Status: {status}", status_code=422
                )
            query = query.eq("status", status)
        # Offene zuerst bearbeiten: älteste oben (der partielle Index aus 0332
        # bedient genau diese Sortierung).
        rows = query.order("created_at", desc=False).execute().data or []
        titel = self._titel({str(r["property_id"]) for r in rows})
        namen = self._namen({str(r["requested_by"]) for r in rows if r.get("requested_by")})
        einheiten = self._einheiten_namen(
            {str(r["unit_id"]) for r in rows if r.get("unit_id")}
        )
        items = [_item(r, titel, namen, einheiten) for r in rows]
        return SperrantragListe(items=items, total=len(items))

    def _titel(self, property_ids: set[str]) -> dict[str, str]:
        if not property_ids:
            return {}
        rows = (
            self._db.table("properties")
            .select("id, title")
            .in_("id", sorted(property_ids))
            .execute()
        ).data or []
        return {str(r["id"]): r.get("title") or "" for r in rows}

    def _einheiten_namen(self, unit_ids: set[str]) -> dict[str, str]:
        """Anzeigenamen der beantragten Einheiten („Studio 3").

        Ohne sie stünde in der Warteschlange eine nackte UUID, und die Agentur
        könnte nicht erkennen, WELCHE der fünf identischen Einheiten der
        Eigentümer meint — die Entscheidung hinge an einer unlesbaren Angabe.
        """
        if not unit_ids:
            return {}
        rows = (
            self._db.table("property_units")
            .select("id, name")
            .in_("id", sorted(unit_ids))
            .execute()
        ).data or []
        return {str(r["id"]): r.get("name") or "" for r in rows}

    def _einzel_item(self, antrag: dict) -> SperrantragItem:
        """Antwort auf eine EINZEL-Entscheidung (approve/reject/revoke).

        Zieht Objekttitel und Einheitenname genauso nach wie der Listenpfad —
        sonst zeigte die Oberfläche direkt nach der Entscheidung eine nackte
        UUID, wo eine Sekunde vorher „Studio 3" stand. Der Antragsteller-Name
        bleibt hier bewusst weg: die Entscheiderin hat ihn gerade vor sich, und
        ein weiterer users-Lookup je Klick trüge nichts bei.
        """
        return _item(
            antrag,
            self._titel({str(antrag["property_id"])}),
            {},
            self._einheiten_namen(
                {str(antrag["unit_id"])} if antrag.get("unit_id") else set()
            ),
        )

    def _namen(self, user_ids: set[str]) -> dict[str, str]:
        """Namen der Antragsteller. Bewusst OHNE E-Mail/Telefon (Wurzel 9):
        die Entscheidungsliste braucht sie nicht, und ausgelieferte Kontakt-
        daten wären Recon-Material."""
        if not user_ids:
            return {}
        rows = (
            self._db.table("users")
            .select("id, name")
            .in_("id", sorted(user_ids))
            .execute()
        ).data or []
        return {str(r["id"]): r.get("name") or "" for r in rows}

    # --- Entscheiden ---------------------------------------------------------

    def genehmigen(
        self, ctx: AuthContext, antrag_id: str, req: BlockRequestDecision
    ) -> SperrantragItem:
        """Antrag genehmigen: der Zeitraum wird als EIGENTÜMER-AUFENTHALT belegt.

        WAS SICH GEGENÜBER DER ERSTEN FASSUNG GEÄNDERT HAT (und warum):
        Bis hierher erzeugte die Genehmigung eine anonyme `blocked`-Nacht über
        `CalendarService.block`. Der Kalender war damit zwar zu, aber der ganze
        0241-Apparat (`reservations.is_owner_stay`) blieb ungenutzt: nirgends
        stand, WER das Objekt nutzt. Weder die Buchungsliste noch die
        Eigentümer-Abrechnung noch die Belegungsstatistik konnten den Aufenthalt
        von einer Handwerker-Sperre unterscheiden — genau die Lücke, die 0241
        schließen sollte.

        Jetzt entsteht eine Reservierung mit `is_owner_stay=true` und
        `owner_id`. Damit greifen Kalenderbelegung, Verfügbarkeits-Push an die
        Portale, Ausschluss aus Umsatz/Statement und der Personenbezug über
        EINEN Weg (Wurzel 1) — statt über einen zweiten, parallel gepflegten
        Sperr-Pfad, der bei jeder Änderung mitgezogen werden müsste.

        REIHENFOLGE IST DER KERN (Wurzel 2): Erst wird der Antrag per bedingtem
        UPDATE von 'pending' auf 'approved' GECLAIMT, dann belegt. Ein
        Doppelklick/Retry verliert das Rennen um den Claim und bekommt 409 —
        ohne den Claim würden zwei parallele Requests beide belegen und beide
        eine Benachrichtigung auslösen. Der UNIQUE-Index
        `reservations_block_request_aktiv_idx` (0353) ist der DB-seitige
        Backstop dazu.

        Schlägt das Belegen fehl (409: der Zeitraum enthält gebuchte Tage), wird
        der Claim ZURÜCKGEROLLT: der Antrag steht wieder auf 'pending'. Genau
        das verlangt die Vorgabe — ein Antrag, dessen Sperre nicht ausgeführt
        werden konnte, darf nicht als genehmigt gelten, sonst zeigt das Portal
        dem Eigentümer eine Sperre, die es im Kalender nicht gibt.
        """
        antrag = self._laden(ctx, antrag_id)
        rng = self._range(antrag)
        # Der Eigentümer steht VOR dem Claim fest. Fehlt er, scheitert die
        # Genehmigung, ohne den Antrag angefasst zu haben — ein Claim, den man
        # gleich wieder zurückrollt, ist eine überflüssige Zustandsänderung.
        owner_id = self._eigentuemer(ctx, str(antrag["property_id"]))
        try:
            geclaimt = self._claim(
                antrag_id,
                von="pending",
                nach="approved",
                ctx=ctx,
                note=req.note,
            )
        except Exception as exc:  # noqa: BLE001 — auf 23P01 geprüft, sonst re-raise
            # Der EXCLUDE-Constraint aus 0333/0353 (23P01) schlägt zu, wenn für
            # dieses Objekt und dieselbe Einheit bereits ein GENEHMIGTER Antrag
            # im Zeitraum liegt. Das ist eine fachliche Aussage und kein 500 —
            # dem Nutzer sagen, WAS kollidiert. Jeder andere Fehler wird NICHT
            # verschluckt (Wurzel 5) und fliegt unverändert weiter.
            if "23P01" not in str(exc) and "block_requests_kein_ueberlapp" not in str(exc):
                raise
            raise CalendarError(
                "Für dieses Objekt ist im Zeitraum bereits eine Sperrung "
                "genehmigt. Bitte den bestehenden Antrag zurücknehmen.",
                status_code=409,
            ) from exc
        if geclaimt is None:
            raise CalendarError(
                f"Antrag ist bereits {_status_text(antrag.get('status'))} — "
                "keine zweite Entscheidung möglich.",
                status_code=409,
            )
        try:
            self._eigennutzung_anlegen(ctx, antrag, owner_id, rng)
        except BaseException:
            # Gegenzustand pflegen (Wurzel 1): der Claim war eine Zustands-
            # änderung, die ohne den Seiteneffekt keinen Bestand haben darf.
            #
            # BEWUSST BaseException und nicht nur CalendarError/ReservationError:
            # nicht nur der fachliche 409 („enthält bereits gebuchte Tage") lässt
            # die Belegung ausfallen, sondern auch ein Netz-/PostgREST-Fehler im
            # RPC-Aufruf. Wer hier nur die fachliche Ausnahme fängt, lässt genau
            # diese Fälle als „approved ohne eine einzige belegte Nacht" stehen —
            # der Zustand, den dieser Block verhindern soll. Es wird NICHTS
            # verschluckt (Wurzel 5): sofort re-raise, der Aufrufer sieht den
            # Originalfehler.
            self._zuruecksetzen(ctx, antrag_id)
            raise
        log.info(
            "sperrantrag_genehmigt",
            tenant_id=ctx.tenant_id,
            antrag_id=antrag_id,
            property_id=str(antrag["property_id"]),
            unit_id=str(antrag["unit_id"]) if antrag.get("unit_id") else None,
            owner_id=owner_id,
            naechte=len(rng.nights()),
        )
        neu = self._laden(ctx, antrag_id)
        self._melde_entscheidung(ctx, neu, GENEHMIGT)
        return self._einzel_item(neu)

    def _eigentuemer(self, ctx: AuthContext, property_id: str) -> str:
        """Der verwaltete Eigentümer DIESES Objekts (`owners`, 0063).

        Eindeutig ohne jede Annahme: seit 0073 (`unique (property_id)`) gehört
        ein Objekt genau EINEM Eigentümer. Es wird also nichts geraten und
        nichts über `requested_by` rückgeschlossen — der Antragsteller kann ein
        Verwalter im Auftrag sein, der Eigentümer der Sache ist trotzdem der am
        Objekt hinterlegte.

        Fehlt der Eintrag, ist das ein Datenfehler und KEIN Fall für einen
        Ersatzwert (Wurzel 4): eine Eigennutzung ohne Eigentümer wäre genau die
        anonyme Sperre, die dieser Umbau abschafft. Klar fehlschlagen mit der
        Aussage, was zu tun ist.
        """
        rows = (
            self._db.table("owner_properties")
            .select("owner_id, owners!inner(id, tenant_id)")
            .eq("property_id", property_id)
            .eq("owners.tenant_id", ctx.tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows or not rows[0].get("owner_id"):
            raise CalendarError(
                "Dem Objekt ist kein Eigentümer zugeordnet — die Eigennutzung "
                "kann niemandem zugeschrieben werden. Bitte zuerst unter "
                "Eigentümer das Objekt zuordnen.",
                status_code=422,
            )
        return str(rows[0]["owner_id"])

    def _eigennutzung_anlegen(
        self,
        ctx: AuthContext,
        antrag: dict,
        owner_id: str,
        rng: DateRange,
    ) -> None:
        """Die genehmigte Sperre als Eigentümer-Aufenthalt buchen.

        Über den BESTEHENDEN Reservierungs-Schreibpfad, nicht über einen
        eigenen Insert: dort hängen der atomare RPC (Advisory-Lock,
        Einheitenwahl, EXCLUDE-Backstop), die Kalenderbelegung je Einheit, die
        ARI-Outbox-Zeile in derselben Transaktion und der Verfügbarkeits-Push
        mit der echten Stückzahl. Ein zweiter Insert daneben müsste all das
        nachbauen und liefe beim ersten Zusatz auseinander (Wurzel 1: ein Weg).

        `check_out` ist EXKLUSIV wie überall im Kalender; `rng.end` ist es
        bereits (`_range` rechnet das inklusive `end_date` des Antrags einmalig
        um). Es wird hier NICHT noch einmal verschoben.

        Der Kanal ist `direct`: die Belegung entsteht im Haus, nicht über ein
        Portal. Ein OTA-Kanal löste die Provisionslogik aus — für einen
        Aufenthalt ohne Umsatz.
        """
        from src.features.reservations.schemas import (  # noqa: PLC0415
            ReservationChannel,
            ReservationCreate,
            ReservationStatus,
        )
        from src.features.reservations.service import (  # noqa: PLC0415
            ReservationsService,
        )

        ReservationsService(service_client=self._db).create(
            ctx,
            ReservationCreate(
                property_id=str(antrag["property_id"]),
                check_in=rng.start,
                check_out=rng.end,
                channel=ReservationChannel.direct,
                status=ReservationStatus.confirmed,
                is_owner_stay=True,
                owner_id=owner_id,
                # Die im Antrag benannte Einheit (0353). None = der Antrag meint
                # den Typ; die RPC wählt dann die erste freie Einheit.
                unit_id=(
                    str(antrag["unit_id"]) if antrag.get("unit_id") else None
                ),
            ),
            # 0353: die Reservierung trägt die Antrags-ID, damit der Widerruf
            # GENAU sie storniert und nicht eine zweite, unabhängig erfasste
            # Eigennutzung im selben Zeitraum mitreißt (Wurzel 1). Bewusst
            # KEIN Feld im HTTP-Schema — es darf nicht vom Client kommen.
            block_request_id=str(antrag["id"]),
        )

    def ablehnen(
        self, ctx: AuthContext, antrag_id: str, req: BlockRequestDecision
    ) -> SperrantragItem:
        """Antrag ablehnen. Kein Kalender-Seiteneffekt — nichts wurde gesperrt."""
        antrag = self._laden(ctx, antrag_id)
        geclaimt = self._claim(
            antrag_id, von="pending", nach="rejected", ctx=ctx, note=req.note
        )
        if geclaimt is None:
            raise CalendarError(
                f"Antrag ist bereits {_status_text(antrag.get('status'))} — "
                "keine zweite Entscheidung möglich.",
                status_code=409,
            )
        log.info(
            "sperrantrag_abgelehnt", tenant_id=ctx.tenant_id, antrag_id=antrag_id
        )
        neu = self._laden(ctx, antrag_id)
        self._melde_entscheidung(ctx, neu, ABGELEHNT)
        return self._einzel_item(neu)

    def zuruecknehmen(
        self, ctx: AuthContext, antrag_id: str, req: BlockRequestDecision
    ) -> SperrantragItem:
        """Eine bereits erteilte Genehmigung widerrufen.

        WURZEL 1 — der Gegenzustand, und zwar NUR der eigene: Die Genehmigung
        hat den Zeitraum belegt; ihr Widerruf MUSS ihn wieder freigeben, sonst
        bliebe das Objekt für immer blockiert, ohne dass noch ein Antrag darauf
        hinweist. Es gibt dafür GENAU EINEN Anker, nie eine Suche über
        (Objekt, Zeitraum): sonst risse der Widerruf eine zweite, unabhängig
        erfasste Belegung im selben Zeitraum mit.

        ZWEI FORMEN, BEIDE ZU BEDIENEN — der Bestand ist der Grund:
        * Genehmigungen AB 0353 haben eine Reservierung mit
          `is_owner_stay=true` und `block_request_id` erzeugt. Sie wird über den
          bestehenden Storno-Weg zurückgenommen; der gibt die Nächte über
          `_release_nights` frei und meldet die echte Stückzahl an die Portale.
        * Genehmigungen DAVOR haben eine anonyme `blocked`-Nacht mit
          `availability.block_request_id` (0337) erzeugt. Für sie bleibt
          `CalendarService.unblock` MIT der Antrags-ID der Weg. Ihn hier
          wegzulassen hieße, jeden vor dem Umbau genehmigten Antrag dauerhaft
          unwiderrufbar zu machen — das Objekt bliebe gesperrt.

        Beide Wege laufen unbedingt, nicht als Entweder-oder: welche Form
        vorliegt, entscheidet der Fund der Reservierung, und ein Antrag, der
        (durch einen abgebrochenen Lauf) beides hinterlassen hat, muss beides
        loswerden. Der Unblock ohne passende Zeilen ist ein No-op.

        Ohne die Antrags-ID löschte der Widerruf alles mit `status='blocked'
        AND source='manual'` im Zeitraum. Eine Agentur-Sperre (Renovierung
        1.–20.) trägt dieselbe Signatur wie eine genehmigte Antragssperre
        (5.–7.) — der Widerruf des Antrags riss also die Handwerker-Sperre für
        diese drei Nächte mit auf, und das Objekt war wieder verkäuflich. Der
        EXCLUDE-Constraint aus 0333 greift dagegen nicht: er sichert nur, dass
        nicht zwei GENEHMIGTE Anträge überlappen; hier steht auf der Gegenseite
        gar kein Antrag.

        An die Portale geht danach der echte Kalenderstand — weder eine
        inzwischen eingegangene Buchung noch eine weiterlaufende Agentur-Sperre
        wird neu zum Verkauf gemeldet.

        Zielzustand ist 'rejected': das Enum aus 0014 kennt nur die drei
        Zustände, und ein Zurück auf 'pending' würde den Antrag erneut in der
        Warteschlange auftauchen lassen, obwohl er bereits behandelt wurde.
        """
        antrag = self._laden(ctx, antrag_id)
        rng = self._range(antrag)
        geclaimt = self._claim(
            antrag_id, von="approved", nach="rejected", ctx=ctx, note=req.note
        )
        if geclaimt is None:
            raise CalendarError(
                "Nur ein genehmigter Antrag kann zurückgenommen werden "
                f"(Antrag ist {_status_text(antrag.get('status'))}).",
                status_code=409,
            )
        try:
            self._eigennutzung_stornieren(ctx, antrag_id, req.note)
            self._calendar.unblock(
                ctx.tenant_id,
                str(antrag["property_id"]),
                rng,
                block_request_id=antrag_id,
                # Die Einheit des Antrags. Bei Altbestand ist sie NULL und der
                # Unblock bleibt objektweit — genau so wurde damals gesperrt.
                unit_id=(
                    str(antrag["unit_id"]) if antrag.get("unit_id") else None
                ),
            )
        except BaseException:
            # Wie beim Genehmigen (siehe dort): ohne die Freigabe darf der
            # Widerruf nicht stehen bleiben, sonst zeigt das Portal
            # „zurückgenommen", während die Nächte gesperrt sind. Auch hier
            # jeder Fehler, nicht nur der fachliche — und sofort re-raise.
            self._auf_genehmigt_zurueck(ctx, antrag_id)
            raise
        log.info(
            "sperrantrag_zurueckgenommen",
            tenant_id=ctx.tenant_id,
            antrag_id=antrag_id,
            property_id=str(antrag["property_id"]),
        )
        neu = self._laden(ctx, antrag_id)
        self._melde_entscheidung(ctx, neu, ZURUECKGENOMMEN)
        return self._einzel_item(neu)

    def _eigennutzung_stornieren(
        self, ctx: AuthContext, antrag_id: str, note: str | None
    ) -> None:
        """Die aus DIESEM Antrag entstandene Eigennutzung zurücknehmen.

        Gefunden wird sie über `reservations.block_request_id` (0353) — nicht
        über (Objekt, Zeitraum, is_owner_stay). Diese Suche träfe eine zweite,
        unabhängig erfasste Eigennutzung im selben Zeitraum mit und stornierte
        eine Belegung, mit der dieser Antrag nichts zu tun hat (Wurzel 1: nur
        den eigenen Gegenzustand aufheben).

        Tenant-gescopt in DERSELBEN Abfrage (Wurzel 3) und auf die lebenden
        Zustände begrenzt: eine bereits stornierte Zeile ist der Zielzustand,
        ein zweiter Storno darauf gäbe 409 und ließe den Widerruf scheitern,
        obwohl nichts mehr zu tun ist (Wurzel 2: retrybar bleiben).

        Kein Treffer heißt: der Antrag stammt aus der Zeit vor 0353 und hat
        eine anonyme `blocked`-Nacht hinterlassen. Das ist kein Fehler — der
        Aufrufer räumt sie im selben Zug über `unblock` ab.
        """
        rows = (
            self._db.table("reservations")
            .select("id")
            .eq("block_request_id", antrag_id)
            .eq("tenant_id", ctx.tenant_id)
            .neq("status", "cancelled")
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            return
        from src.features.reservations.service import (  # noqa: PLC0415
            ReservationsService,
        )

        # `cancel` verlangt eine Begründung (Pflicht, wird auditiert), die
        # Anmerkung der Entscheidung ist dagegen optional. Fehlt sie, steht
        # hier der VORGANG als Grund — das ist keine erfundene Angabe, sondern
        # die belegbare Tatsache, warum storniert wurde (Wurzel 4: kein
        # plausibler Ersatz für eine fehlende Nutzereingabe, sondern eine
        # eigene, wahre Aussage).
        grund = (note or "").strip() or f"{_STORNO_GRUND} ({antrag_id})"
        ReservationsService(service_client=self._db).cancel(
            ctx, str(rows[0]["id"]), grund
        )

    # --- Zustandswechsel -----------------------------------------------------

    def _claim(
        self,
        antrag_id: str,
        *,
        von: str,
        nach: str,
        ctx: AuthContext,
        note: str | None,
    ) -> dict | None:
        """Zustandswechsel als bedingter UPDATE — der Idempotenz-Riegel.

        `eq("status", von)` macht den Wechsel zu einem Compare-and-Set: die DB
        entscheidet, wer gewinnt. Kommen zwei Approve-Requests gleichzeitig an,
        trifft der zweite die Zeile nicht mehr im Vorzustand an und bekommt
        eine leere Rückgabe → der Aufrufer wirft 409, statt ein zweites Mal zu
        sperren. Ein vorheriges SELECT + späteres UPDATE hätte genau dieses
        Rennen offen gelassen (Wurzel 2).
        """
        res = (
            self._db.table("block_requests")
            .update(
                {
                    "status": nach,
                    "decided_by": ctx.user_id,
                    # Fachlicher Entscheidungszeitpunkt, nicht updated_at (5b).
                    "decided_at": "now()",
                    "decision_note": note,
                }
            )
            .eq("id", antrag_id)
            .eq("tenant_id", ctx.tenant_id)
            .eq("status", von)
            .execute()
        ).data or []
        return res[0] if res else None

    def _zuruecksetzen(self, ctx: AuthContext, antrag_id: str) -> None:
        """Claim aufheben: zurück auf 'pending', Entscheidungsspuren löschen.

        Gescopt wie jeder andere Zugriff (Wurzel 3) UND auf den Zustand
        bedingt, den dieser Aufruf selbst gesetzt hat (`status='approved'`).
        Ohne die Statusbedingung könnte ein Rollback einen Zustand
        überschreiben, den inzwischen JEMAND ANDERES gesetzt hat — der Claim
        hätte das Rennen dann umsonst gewonnen (Wurzel 2).
        """
        self._db.table("block_requests").update(
            {
                "status": "pending",
                "decided_by": None,
                "decided_at": None,
                "decision_note": None,
            }
        ).eq("id", antrag_id).eq("tenant_id", ctx.tenant_id).eq(
            "status", "approved"
        ).execute()

    def _auf_genehmigt_zurueck(self, ctx: AuthContext, antrag_id: str) -> None:
        """Widerruf aufheben: der Antrag bleibt genehmigt (Sperre steht).

        Ebenfalls tenant-gescopt und auf den selbst gesetzten Zustand bedingt.
        """
        self._db.table("block_requests").update(
            {"status": "approved"}
        ).eq("id", antrag_id).eq("tenant_id", ctx.tenant_id).eq(
            "status", "rejected"
        ).execute()

    # --- Helfer --------------------------------------------------------------

    @staticmethod
    def _range(antrag: dict) -> DateRange:
        """`block_requests` speichert start/end INKLUSIV (der Eigentümer meint
        „vom 1. bis zum 5. gesperrt"), `DateRange` arbeitet mit exklusivem Ende
        wie der ganze Kalender. Die Umrechnung gehört an diese EINE Stelle —
        ein off-by-one hier ließe je Antrag eine Nacht ungesperrt.
        """
        start = _als_datum(antrag["start_date"])
        ende_inklusiv = _als_datum(antrag["end_date"])
        if ende_inklusiv < start:
            raise CalendarError(
                "Antrag mit Enddatum vor Startdatum.", status_code=422
            )
        naechte = (ende_inklusiv - start).days + 1
        if naechte > MAX_SPERR_NAECHTE:
            raise CalendarError(
                f"Zeitraum umfasst {naechte} Nächte — höchstens "
                f"{MAX_SPERR_NAECHTE} sind zulässig.",
                status_code=422,
            )
        return DateRange(start=start, end=ende_inklusiv + timedelta(days=1))

    def _melde_entscheidung(
        self, ctx: AuthContext, antrag: dict, entscheidung: str
    ) -> None:
        """Den Antragsteller über die Entscheidung informieren.

        `entscheidung` ist eine der Konstanten `GENEHMIGT`/`ABGELEHNT`/
        `ZURUECKGENOMMEN` — kein deutsches Wort mehr, sondern der Zugang zu
        zwei Katalog-Schlüsseln (Betreff und Rumpf). Bis hierher stand hier ein
        deutscher Satz, der einem dänischen Eigentümer auf Deutsch zuging.

        Best-effort (Wurzel 5): Der Hauptpfad ist die Sperre im Kalender — die
        ist bereits passiert und darf nicht daran scheitern, dass ein Mailserver
        klemmt. Der Fehlschlag wird protokolliert, nicht verschluckt.
        """
        empfaenger = antrag.get("requested_by")
        if not empfaenger:
            return
        betreff_key, rumpf_key = _ENTSCHEIDUNGS_TEXTE[entscheidung]
        titel = self._titel({str(antrag["property_id"])}).get(
            str(antrag["property_id"]), ""
        ) or str(antrag["property_id"])[:8]
        zeitraum = f"{antrag['start_date']} – {antrag['end_date']}"
        notiz = str(antrag.get("decision_note") or "").strip()
        werte: dict[str, object] = {"titel": titel, "zeitraum": zeitraum}
        # Die Anmerkung ist OPTIONAL und darum ein zweiter Absatz, kein
        # Satzende im Rumpf: fehlt sie, darf kein leeres „Anmerkung:" dastehen.
        rumpf_keys = [rumpf_key]
        if notiz:
            rumpf_keys.append("sperrantrag.anmerkung")
            werte["notiz"] = notiz
        try:
            from src.features.notification_settings.dispatcher import (  # noqa: PLC0415
                NotificationDispatcher,
            )

            NotificationDispatcher(self._db).sende(
                user_id=str(empfaenger),
                schluessel="block_decision",
                # Glocke: der fertige Satz in der Ausweichsprache. Die
                # Oberfläche zeigt ihn neben dem Objektnamen, der ohnehin in
                # Originalschreibweise dasteht.
                betreff=mail_text(betreff_key, FALLBACK, **werte),
                text="\n\n".join(
                    mail_text(k, FALLBACK, **werte) for k in rumpf_keys
                ),
                # Mail/SMS: Schlüssel — der Dispatcher übersetzt sie in die
                # Sprache des Empfängers.
                betreff_key=betreff_key,
                betreff_werte=werte,
                text_key=rumpf_keys,
                text_werte=werte,
                tenant_id=ctx.tenant_id,
                property_id=str(antrag["property_id"]),
                ziel_pfad="/portal/sperrungen",
                dedup_key=f"block_decision:{antrag['id']}:{antrag.get('status')}",
            )
        except Exception as exc:  # noqa: BLE001 — Nebenpfad, siehe Docstring
            log.warning(
                "sperrantrag_meldung_fehlgeschlagen",
                antrag_id=str(antrag["id"]),
                error=str(exc)[:200],
            )


def melde_neuen_antrag(
    db: Client, tenant_id: str, antrag: dict, titel: str
) -> None:
    """Die Entscheider des Mandanten über einen NEUEN Antrag informieren.

    Liegt hier statt im public_portal, weil der Empfängerkreis eine Frage der
    Capability-Matrix ist (wer darf entscheiden?) und nicht der Portal-Sicht.

    Empfänger sind die Nutzer des Mandanten, deren ROLLE die Capability
    APPROVE_BLOCK trägt — dieselbe Bedingung wie der Guard am Endpunkt. Die
    Rolle kommt aus der DB, nicht aus einem JWT (Wurzel 7): der Antragsteller
    hat mit den Rollen der anderen nichts zu tun.

    Best-effort (Wurzel 5): der Antrag ist gespeichert; er darf nicht verloren
    gehen, weil der Versand klemmt.
    """
    try:
        rows = (
            db.table("users")
            .select("id, role")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        empfaenger = [
            str(r["id"]) for r in rows if _darf_entscheiden(r.get("role"))
        ]
        if not empfaenger:
            log.info("sperrantrag_ohne_entscheider", tenant_id=tenant_id)
            return
        from src.features.notification_settings.dispatcher import (  # noqa: PLC0415
            NotificationDispatcher,
        )

        dispatcher = NotificationDispatcher(db)
        zeitraum = f"{antrag['start_date']} – {antrag['end_date']}"
        grund = (antrag.get("reason") or "").strip()
        werte: dict[str, object] = {"titel": titel, "zeitraum": zeitraum}
        # Die Begründung ist OPTIONAL und darum ein zweiter Absatz, kein
        # Satzende im Rumpf: fehlt sie, darf kein leeres „Begründung:"
        # dastehen (gleiche Regel wie bei der Anmerkung der Entscheidung).
        rumpf_keys = ["sperrantrag.rumpf_neu"]
        if grund:
            rumpf_keys.append("sperrantrag.begruendung")
            werte["grund"] = grund
        for nutzer in empfaenger:
            dispatcher.sende(
                user_id=nutzer,
                schluessel="block_request",
                # Glocke: fertiger Satz in der Ausweichsprache — die Oberfläche
                # bekommt keinen Schlüssel, sondern den gerenderten Text.
                betreff=mail_text("sperrantrag.neu", FALLBACK, **werte),
                text="\n\n".join(
                    mail_text(k, FALLBACK, **werte) for k in rumpf_keys
                ),
                # Mail/SMS: Schlüssel — der Dispatcher übersetzt sie in die
                # Sprache des Empfängers. Vorher stand hier ein hart deutscher
                # f-String, der jeden Entscheider unabhängig von seiner
                # Sprachwahl auf Deutsch anschrieb.
                betreff_key="sperrantrag.neu",
                betreff_werte=werte,
                text_key=rumpf_keys,
                text_werte=werte,
                tenant_id=tenant_id,
                property_id=str(antrag["property_id"]),
                ziel_pfad="/kalender/sperrantraege",
                dedup_key=f"block_request:{antrag['id']}",
            )
    except Exception as exc:  # noqa: BLE001 — Nebenpfad, siehe Docstring
        log.warning(
            "sperrantrag_meldung_fehlgeschlagen",
            tenant_id=tenant_id,
            error=str(exc)[:200],
        )


def _darf_entscheiden(role: str | None) -> bool:
    """Trägt diese Rolle die Capability APPROVE_BLOCK? Fail-closed (Wurzel 6):
    eine unbekannte oder fehlende Rolle bekommt nichts."""
    if not role:
        return False
    try:
        rolle = UserRole(role)
    except ValueError:
        return False
    return has_capability(rolle, Capability.APPROVE_BLOCK)


def _status_text(status: str | None) -> str:
    return {
        "pending": "offen",
        "approved": "genehmigt",
        "rejected": "abgelehnt",
    }.get(status or "", status or "unbekannt")


def _als_datum(wert: object) -> date:
    if isinstance(wert, date):
        return wert
    return date.fromisoformat(str(wert))


def _item(
    r: dict,
    titel: dict[str, str],
    namen: dict[str, str],
    einheiten: dict[str, str] | None = None,
) -> SperrantragItem:
    pid = str(r["property_id"])
    uid = str(r["unit_id"]) if r.get("unit_id") else None
    requested_by = str(r["requested_by"]) if r.get("requested_by") else None
    return SperrantragItem(
        id=str(r["id"]),
        property_id=pid,
        property_title=titel.get(pid),
        unit_id=uid,
        unit_name=(einheiten or {}).get(uid or ""),
        requested_by=requested_by,
        requested_by_name=namen.get(requested_by or ""),
        start_date=_als_datum(r["start_date"]),
        end_date=_als_datum(r["end_date"]),
        status=r.get("status") or "pending",
        reason=r.get("reason"),
        decided_by=str(r["decided_by"]) if r.get("decided_by") else None,
        decided_at=str(r["decided_at"]) if r.get("decided_at") else None,
        decision_note=r.get("decision_note"),
        created_at=str(r["created_at"]) if r.get("created_at") else None,
    )
