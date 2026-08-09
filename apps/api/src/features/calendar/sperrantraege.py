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
from .service import BlockRequest, CalendarError, CalendarService

log = get_logger("nextdays.sperrantraege")

# Spalten, die der Agentur-Blick braucht. Explizit statt "*", damit ein später
# ergänztes sensibles Feld nicht automatisch mit ausgeliefert wird.
_SPALTEN = (
    "id, tenant_id, property_id, requested_by, start_date, end_date, status, "
    "reason, decided_by, decided_at, decision_note, created_at"
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
        items = [_item(r, titel, namen) for r in rows]
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
        """Antrag genehmigen und die Nächte im Kalender sperren.

        REIHENFOLGE IST DER KERN (Wurzel 2): Erst wird der Antrag per bedingtem
        UPDATE von 'pending' auf 'approved' GECLAIMT, dann gesperrt. Ein
        Doppelklick/Retry verliert das Rennen um den Claim und bekommt 409 —
        ohne den Claim würden zwei parallele Requests beide sperren und beide
        eine Benachrichtigung auslösen.

        Schlägt das Sperren fehl (409: der Zeitraum enthält gebuchte Tage), wird
        der Claim ZURÜCKGEROLLT: der Antrag steht wieder auf 'pending'. Genau
        das verlangt die Vorgabe — ein Antrag, dessen Sperre nicht ausgeführt
        werden konnte, darf nicht als genehmigt gelten, sonst zeigt das Portal
        dem Eigentümer eine Sperre, die es im Kalender nicht gibt.
        """
        antrag = self._laden(ctx, antrag_id)
        rng = self._range(antrag)
        try:
            geclaimt = self._claim(
                antrag_id,
                von="pending",
                nach="approved",
                ctx=ctx,
                note=req.note,
            )
        except Exception as exc:  # noqa: BLE001 — auf 23P01 geprüft, sonst re-raise
            # Der EXCLUDE-Constraint aus 0333 (23P01) schlägt zu, wenn für
            # dieses Objekt bereits ein GENEHMIGTER Antrag im Zeitraum liegt.
            # Das ist eine fachliche Aussage und kein 500 — dem Nutzer sagen,
            # WAS kollidiert. Jeder andere Fehler wird NICHT verschluckt
            # (Wurzel 5) und fliegt unverändert weiter.
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
            self._calendar.block(
                ctx.tenant_id,
                BlockRequest(property_id=str(antrag["property_id"]), range=rng),
                # 0337: die gesperrten Nächte tragen die Antrags-ID, damit der
                # Widerruf sie GEZIELT wieder freigibt und nicht jede andere
                # manuelle Sperre im selben Zeitraum mitreißt (Wurzel 1).
                block_request_id=antrag_id,
            )
        except BaseException:
            # Gegenzustand pflegen (Wurzel 1): der Claim war eine Zustands-
            # änderung, die ohne den Seiteneffekt keinen Bestand haben darf.
            #
            # BEWUSST BaseException und nicht nur CalendarError: nicht nur der
            # fachliche 409 („enthält bereits gebuchte Tage") lässt die Sperre
            # ausfallen, sondern auch ein Netz-/PostgREST-Fehler im Upsert. Wer
            # hier nur CalendarError fängt, lässt genau diese Fälle als
            # „approved ohne eine einzige gesperrte Nacht" stehen — der
            # Zustand, den dieser Block verhindern soll. Es wird NICHTS
            # verschluckt (Wurzel 5): sofort re-raise, der Aufrufer sieht den
            # Originalfehler.
            self._zuruecksetzen(ctx, antrag_id)
            raise
        log.info(
            "sperrantrag_genehmigt",
            tenant_id=ctx.tenant_id,
            antrag_id=antrag_id,
            property_id=str(antrag["property_id"]),
            naechte=len(rng.nights()),
        )
        neu = self._laden(ctx, antrag_id)
        self._melde_entscheidung(ctx, neu, GENEHMIGT)
        return _item(neu, self._titel({str(neu["property_id"])}), {})

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
        return _item(neu, self._titel({str(neu["property_id"])}), {})

    def zuruecknehmen(
        self, ctx: AuthContext, antrag_id: str, req: BlockRequestDecision
    ) -> SperrantragItem:
        """Eine bereits erteilte Genehmigung widerrufen.

        WURZEL 1 — der Gegenzustand, und zwar NUR der eigene: Die Genehmigung
        hat Nächte gesperrt; ihr Widerruf MUSS sie wieder freigeben, sonst
        bliebe das Objekt für immer blockiert, ohne dass noch ein Antrag darauf
        hinweist. Freigegeben wird über den BESTEHENDEN Weg
        `CalendarService.unblock` — MIT der Antrags-ID (0337), sodass genau die
        Zeilen verschwinden, die diese Genehmigung erzeugt hat.

        Ohne die ID löschte der Widerruf alles mit `status='blocked' AND
        source='manual'` im Zeitraum. Eine Agentur-Sperre (Renovierung 1.–20.)
        trägt dieselbe Signatur wie eine genehmigte Antragssperre (5.–7.) — der
        Widerruf des Antrags riss also die Handwerker-Sperre für diese drei
        Nächte mit auf, und das Objekt war wieder verkäuflich. Der
        EXCLUDE-Constraint aus 0333 greift dagegen nicht: er sichert nur, dass
        nicht zwei GENEHMIGTE Anträge überlappen; hier steht auf der Gegenseite
        gar kein Antrag.

        An Channex geht tag-genau nur, was danach WIRKLICH offen ist — weder
        eine inzwischen eingegangene Buchung noch eine weiterlaufende
        Agentur-Sperre wird neu zum Verkauf gemeldet.

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
            self._calendar.unblock(
                ctx.tenant_id,
                str(antrag["property_id"]),
                rng,
                block_request_id=antrag_id,
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
        return _item(neu, self._titel({str(neu["property_id"])}), {})

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
    r: dict, titel: dict[str, str], namen: dict[str, str]
) -> SperrantragItem:
    pid = str(r["property_id"])
    requested_by = str(r["requested_by"]) if r.get("requested_by") else None
    return SperrantragItem(
        id=str(r["id"]),
        property_id=pid,
        property_title=titel.get(pid),
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
