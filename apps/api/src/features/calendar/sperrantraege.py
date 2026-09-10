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

from datetime import UTC, date, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger
from src.core.mail_sprache import FALLBACK
from src.core.mail_texte import text as mail_text
from src.core.security import AuthContext
from src.features.tasks.regel_uebersetzung import (
    lesersprache,
    namen_in_sprache,
)

from . import sperrantrag_anzeige as anzeige
from .schemas import (
    BestellteLeistungItem,
    BlockRequestDecision,
    DateRange,
    SperrantragItem,
    SperrantragKollisionen,
    SperrantragListe,
)
from .service import CalendarError, CalendarService

# `_item` (Zeile → Antwortmodell) und `_als_datum` liegen im Nachbarmodul und
# werden hier benutzt. Kein Re-Export: ausserhalb importiert sie niemand.
from .sperrantrag_anzeige import _als_datum, _item
from .sperrantrag_kollisionen import (
    kollisionen_pruefen,
    konflikt_text,
    naechste_freie_spanne,
)
from .sperrantrag_leistungen import (
    leistungen_alle_setzen,
    leistungen_entscheiden,
    leistungen_pruefen,
)
from .sperrantrag_vorgaenge import VorgaengeMixin

log = get_logger("nextdays.sperrantraege")

# Spalten, die der Agentur-Blick braucht. Explizit statt "*", damit ein später
# ergänztes sensibles Feld nicht automatisch mit ausgeliefert wird.
_SPALTEN = (
    "id, tenant_id, property_id, unit_id, requested_by, start_date, end_date, "
    "status, reason, decided_by, decided_at, decision_note, created_at, "
    # Vertragskündigung (0377).
    "ist_kuendigung, als_kuendigung_gewertet, vertragsende_gesetzt_auf, "
    # Freigabe durch den Eigentümer (0389). Die Agentur sieht nur Anträge, die
    # diese Stufe passiert haben — der Wert wird trotzdem mitgelesen, damit in
    # der Oberfläche steht, ob die Familie zugestimmt hat oder ob es der
    # Antrag des Eigentümers selbst war.
    "owner_freigabe, owner_decided_by, owner_decided_at, owner_decision_note, "
    # Aufhebungswunsch des Eigentümers (0513). Die Agentur MUSS ihn in der
    # Warteschlange sehen: jeder Tag ohne Entscheidung ist ein Tag, an dem
    # Nächte gesperrt bleiben, die niemand mehr braucht.
    "aufhebung, aufhebung_grund, aufhebung_beantragt_am, "
    "aufhebung_entscheidungsnotiz"
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
# Der Aufhebungswunsch wurde abgelehnt: die Sperrung BLEIBT. Eigene Konstante
# und eigener Text, weil es fachlich das Gegenteil von `ZURUECKGENOMMEN` ist —
# dort wird freigegeben, hier bleibt gesperrt. Bis 03.09.2026 meldete dieser
# Uebergang GAR NICHTS: der Eigentuemer hatte um Freigabe gebeten und erfuhr
# nie, dass sie abgelehnt wurde. Er sah im Portal weiter „beantragt" und
# wartete auf eine Antwort, die schon gefallen war.
AUFHEBUNG_ABGELEHNT = "aufhebung_abgelehnt"

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
    AUFHEBUNG_ABGELEHNT: (
        "sperrantrag.entschieden_aufhebung_abgelehnt",
        "sperrantrag.rumpf_aufhebung_abgelehnt",
    ),
}

# Welche Notiz-Spalte den optionalen zweiten Absatz speist. Die Entscheidung
# ueber den Antrag steht in `decision_note`, die ueber den Aufhebungswunsch in
# `aufhebung_entscheidungsnotiz` — beide zu lesen waere falsch: der Eigentuemer
# bekaeme zur Aufhebungs-Ablehnung die Begruendung von damals.
_NOTIZ_SPALTE: dict[str, str] = {
    GENEHMIGT: "decision_note",
    ABGELEHNT: "decision_note",
    ZURUECKGENOMMEN: "decision_note",
    AUFHEBUNG_ABGELEHNT: "aufhebung_entscheidungsnotiz",
}


class SperrantragService(VorgaengeMixin):
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

        Der `owner_freigabe`-Filter steht deshalb hier GENAUSO wie in `liste`:
        Ohne ihn wäre die Freigabe-Stufe (0389) eine reine Anzeige-Kosmetik —
        die Agentur sähe den offenen Antrag zwar nicht in ihrer Warteschlange,
        könnte ihn aber über seine ID direkt genehmigen und damit die
        Zustimmung des Eigentümers überspringen. Genau diese Sorte Lücke
        beschreibt Wurzel 9.
        """
        tenant_id = self._tenant(ctx)
        rows = (
            self._db.table("block_requests")
            .select(_SPALTEN)
            .eq("id", antrag_id)
            .eq("tenant_id", tenant_id)
            .in_("owner_freigabe", ["nicht_noetig", "freigegeben"])
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
            # Stufe 1 (0389): Wünscht ein FAMILIENMITGLIED des Eigentümers eine
            # Sperrzeit, muss erst der Eigentümer zustimmen. Bis dahin
            # existiert der Antrag für die Agentur nicht — sie könnte ihn
            # ohnehin nicht beurteilen (ob Tante Inge im Juli darf, weiß nur
            # die Familie) und würde durch eine Genehmigung die Freigabe
            # überspringen.
            #
            # Was die Agentur sieht:
            #   nicht_noetig — Antrag des Eigentümers selbst (der Normalfall
            #                  und der gesamte Altbestand)
            #   freigegeben  — die Familie ist sich einig
            # Was sie NIE sieht: 'offen' und 'abgelehnt'. Ein vom Eigentümer
            # abgelehnter Antrag ist erledigt und erreicht sie nicht.
            .in_("owner_freigabe", ["nicht_noetig", "freigegeben"])
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
        titel = self._titel(tenant_id, {str(r["property_id"]) for r in rows})
        namen = self._namen(
            tenant_id,
            {str(r["requested_by"]) for r in rows if r.get("requested_by")},
        )
        einheiten = self._einheiten_namen(
            tenant_id,
            {str(r["unit_id"]) for r in rows if r.get("unit_id")}
        )
        # 0510: einmal für die ganze Liste. Die Agentur entscheidet mit der
        # Sperre auch über die Arbeit, die daraus entsteht — sie muss sie sehen.
        bestellt = self._bestellungen(rows, self._sprache(ctx))
        objekte = {str(r["property_id"]) for r in rows}
        fotos = anzeige.objekt_fotos(self._db, tenant_id, objekte)
        items = [
            _item(r, titel, namen, einheiten, bestellt.get(str(r["id"])), fotos)
            for r in rows
        ]
        return SperrantragListe(items=items, total=len(items))


    def _titel(self, tenant_id: str, property_ids: set[str]) -> dict[str, str]:
        """Objekttitel. `tenant_id` ist Pflicht — siehe `_namen` (Wurzel 3)."""
        if not property_ids:
            return {}
        rows = (
            self._db.table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .in_("id", sorted(property_ids))
            .execute()
        ).data or []
        return {str(r["id"]): r.get("title") or "" for r in rows}

    def _einheiten_namen(
        self, tenant_id: str, unit_ids: set[str]
    ) -> dict[str, str]:
        """Anzeigenamen der beantragten Einheiten („Studio 3").

        Ohne sie stünde in der Warteschlange eine nackte UUID, und die Agentur
        könnte nicht erkennen, WELCHE der fünf identischen Einheiten der
        Eigentümer meint — die Entscheidung hinge an einer unlesbaren Angabe.

        `tenant_id` ist Pflicht — siehe `_namen` (Wurzel 3).
        """
        if not unit_ids:
            return {}
        rows = (
            self._db.table("property_units")
            .select("id, name")
            .eq("tenant_id", tenant_id)
            .in_("id", sorted(unit_ids))
            .execute()
        ).data or []
        return {str(r["id"]): r.get("name") or "" for r in rows}

    def _einzel_item(
        self, antrag: dict, ctx: AuthContext | None = None
    ) -> SperrantragItem:
        """Antwort auf eine EINZEL-Entscheidung (approve/reject/revoke).

        Zieht Objekttitel und Einheitenname genauso nach wie der Listenpfad —
        sonst zeigte die Oberfläche direkt nach der Entscheidung eine nackte
        UUID, wo eine Sekunde vorher „Studio 3" stand. Der Antragsteller-Name
        bleibt hier bewusst weg: die Entscheiderin hat ihn gerade vor sich, und
        ein weiterer users-Lookup je Klick trüge nichts bei.
        """
        tenant_id = str(antrag["tenant_id"])
        pid = str(antrag["property_id"])
        return _item(
            antrag,
            self._titel(tenant_id, {pid}),
            {},
            self._einheiten_namen(
                tenant_id,
                {str(antrag["unit_id"])} if antrag.get("unit_id") else set(),
            ),
            self._bestellungen([antrag], self._sprache(ctx)).get(
                str(antrag["id"])
            ),
            anzeige.objekt_fotos(self._db, tenant_id, {pid}),
        )

    def _sprache(self, ctx: AuthContext | None) -> str | None:
        """Die Anzeigesprache der Entscheiderin (0511).

        `None`, wenn kein Kontext vorliegt — dann bleiben die Regelnamen so, wie
        der Betrieb sie eingetippt hat. Das ist die ehrliche Auskunft: eine
        Sprache zu raten, um „irgendwas uebersetzt" zu zeigen, waere ein
        erfundener Wert (Wurzel 4).
        """
        if ctx is None or not ctx.user_id:
            return None
        return lesersprache(self._db, ctx.user_id, ctx.tenant_id)

    def _bestellungen(
        self, rows: list[dict], sprache: str | None = None
    ) -> dict[str, list[BestellteLeistungItem]]:
        """Je Antrag die bestellten Leistungen mit Regelnamen (0510).

        Gebündelt über die ganze Liste — zwei Abfragen für 40 Anträge statt 80.
        Ein Antrag ohne Eintrag hat nichts bestellt; dann entsteht aus seiner
        Genehmigung auch keine Aufgabe.
        """
        antrags_ids = [str(r["id"]) for r in rows]
        if not antrags_ids:
            return {}
        zeilen = (
            self._db.table("block_request_services")
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
                self._db.table("task_rules")
                .select("id, name")
                .in_("id", rule_ids)
                .execute()
            ).data
            or []
        }
        # 0511: in der Sprache der Entscheiderin. Sie sieht damit dasselbe wie
        # der Eigentuemer im Portal — nur in IHRER Sprache. Ohne das stuende in
        # der Warteschlange, was der Betrieb intern eingetippt hat, und bei
        # gemischt benannten Regeln (live: „Anreisecheck" neben „Reng T") waere
        # die Haelfte davon fuer sie unlesbar.
        if sprache:
            namen.update(namen_in_sprache(self._db, rule_ids, sprache))
        out: dict[str, list[BestellteLeistungItem]] = {}
        for z in zeilen:
            rule_id = str(z["rule_id"])
            # Regel zwischen den beiden Abfragen gelöscht: die Bestellung ist
            # gegenstandslos. Sie wegzulassen ist richtiger, als einen
            # Platzhalternamen zu erfinden (Wurzel 4).
            if rule_id not in namen:
                continue
            out.setdefault(str(z["block_request_id"]), []).append(
                BestellteLeistungItem(
                    rule_id=rule_id,
                    name=namen[rule_id],
                    # 0538: der Zustand der Genehmigung je Leistung. Der Fake
                    # der Tests kennt keinen DB-Default, deshalb der Rueckfall
                    # auf den Anfangszustand — er ist KEIN erfundener Wert,
                    # sondern der, den die Spalte selbst setzt.
                    status=str(z.get("status") or "angefragt"),
                    entscheidungsnotiz=z.get("entscheidungsnotiz"),
                )
            )
        return out

    def _namen(self, tenant_id: str, user_ids: set[str]) -> dict[str, str]:
        """Namen der Antragsteller. Bewusst OHNE E-Mail/Telefon (Wurzel 9):
        die Entscheidungsliste braucht sie nicht, und ausgelieferte Kontakt-
        daten wären Recon-Material.

        Die Spalte heißt `full_name`, NICHT `name` — es gab nie eine
        `users.name`. Der falsche Name warf `42703 column users.name does not
        exist` und damit einen 500 auf `GET /calendar/block-requests`; die Liste
        war unbenutzbar (live 12.08.2026). Muster wie in `tasks.service` und
        `reservations.reads`.

        `tenant_id` ist Pflicht, nicht Kosmetik: der Service-Role-Client umgeht
        RLS, ein Filter allein auf `id` würde also auch Nutzer FREMDER Mandanten
        auflösen (Wurzel 3). Die IDs stammen zwar aus tenant-gefilterten
        Anträgen, aber der Scope gehört an den Load — nicht in die Annahme, dass
        der Aufrufer schon richtig gefiltert hat.
        """
        if not user_ids:
            return {}
        rows = (
            self._db.table("users")
            .select("id, full_name")
            .eq("tenant_id", tenant_id)
            .in_("id", sorted(user_ids))
            .execute()
        ).data or []
        return {str(r["id"]): r.get("full_name") or "" for r in rows}

    # --- Vorschau: was steht im Weg? ----------------------------------------

    def kollisionen(
        self, ctx: AuthContext, antrag_id: str, *, als_kuendigung: bool = False
    ) -> SperrantragKollisionen:
        """Was der Genehmigung DIESES Antrags im Weg steht (nur lesend).

        Die Oberfläche lädt das, BEVOR jemand „Genehmigen" drückt: bei einem
        Jahresantrag ist „was kollidiert?" die eigentliche Arbeit, und ein
        nackter 409 nach dem Klick beantwortet sie nicht.

        Bewusst ein eigener Endpunkt und kein Feld an `SperrantragItem`: die
        Prüfung liest `availability`, `stop_sell`, `reservations`, `guests` und
        `property_units` über den ganzen Zeitraum — das pro Zeile der
        Warteschlange zu tun, machte die Liste unbenutzbar langsam.

        `als_kuendigung` prüft den Antrag als VERTRAGSKÜNDIGUNG (0377). Das
        ändert den Befund grundlegend: eine bestehende `contract_end`-Sperre ist
        dann kein Hindernis, sondern der Zielzustand — genau das, was hier
        gesetzt werden soll. Die Oberfläche schaltet damit um, sobald die
        Agentur im Dialog „als Vertragsende akzeptieren" wählt, und sieht sofort,
        was die Kündigung wirklich betrifft (nämlich die Buchungen dahinter).
        """
        antrag = self._laden(ctx, antrag_id)
        rng = self._range(antrag)
        kuendigung = bool(antrag.get("ist_kuendigung")) or als_kuendigung
        befund = kollisionen_pruefen(
            self._db,
            str(antrag["tenant_id"]),
            str(antrag["property_id"]),
            rng,
            unit_id=(
                str(antrag["unit_id"]) if antrag.get("unit_id") else None
            ),
            antrag_id=antrag_id,
            als_kuendigung=kuendigung,
        )
        if befund.blockiert:
            # Nur wenn es klemmt: der Vorschlag kostet einen zweiten Durchlauf
            # über denselben Zeitraum und trägt bei freiem Zeitraum nichts bei.
            spanne = naechste_freie_spanne(
                self._db,
                str(antrag["tenant_id"]),
                str(antrag["property_id"]),
                rng,
            )
            if spanne:
                befund.frei_von, befund.frei_bis = spanne
        return befund

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

        ZWEI GANZ VERSCHIEDENE ENTSCHEIDUNGEN (0377): Ist der Antrag eine
        VERTRAGSKÜNDIGUNG, führt er nicht hierher, sondern in
        `_kuendigung_genehmigen`. Dort entsteht keine Eigennutzung, sondern das
        Vertragsende am Objekt — eine Kündigung ist keine Belegung.
        """
        antrag = self._laden(ctx, antrag_id)
        rng = self._range(antrag)
        kuendigung = self._ist_kuendigung(antrag, req)
        log.info(
            "sperrantrag_genehmigen_start",
            tenant_id=ctx.tenant_id,
            antrag_id=antrag_id,
            property_id=str(antrag["property_id"]),
            unit_id=str(antrag["unit_id"]) if antrag.get("unit_id") else None,
            status_vorher=antrag.get("status"),
            von=rng.start.isoformat(),
            bis_exklusiv=rng.end.isoformat(),
            naechte=len(rng.nights()),
            mit_notiz=bool((req.note or "").strip()),
            kuendigung=kuendigung,
            # Woher die Einordnung kommt — der Unterschied ist rechtlich
            # erheblich und muss im Log stehen, nicht nur „kuendigung=True".
            kuendigung_quelle=(
                "eigentuemer" if antrag.get("ist_kuendigung")
                else "agentur" if req.als_kuendigung
                else None
            ),
        )
        if kuendigung:
            return self._kuendigung_genehmigen(ctx, antrag, req, rng)
        # Der Eigentümer steht VOR dem Claim fest. Fehlt er, scheitert die
        # Genehmigung, ohne den Antrag angefasst zu haben — ein Claim, den man
        # gleich wieder zurückrollt, ist eine überflüssige Zustandsänderung.
        owner_id = self._eigentuemer(ctx, str(antrag["property_id"]))
        # Dasselbe für die Leistungen (0538), VOR dem Claim: ein 422 hier
        # lässt den Antrag unberührt.
        leistungen = leistungen_pruefen(self._db, antrag_id, req)
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
            log.info(
                "sperrantrag_claim_verloren",
                tenant_id=ctx.tenant_id,
                antrag_id=antrag_id,
                status_vorgefunden=antrag.get("status"),
            )
            raise CalendarError(
                f"Antrag ist bereits {_status_text(antrag.get('status'))} — "
                "keine zweite Entscheidung möglich.",
                status_code=409,
            )
        log.info(
            "sperrantrag_claim_gesetzt",
            tenant_id=ctx.tenant_id,
            antrag_id=antrag_id,
            von="pending",
            nach="approved",
            entschieden_von=ctx.user_id,
        )
        try:
            # Belegungs-Riegel NACH dem Claim, und das ist keine Kosmetik:
            # Steht er davor, sieht er beim ZWEITEN Klick die Eigennutzung, die
            # der ERSTE Klick angelegt hat, und meldet „Zeitraum nicht frei" —
            # eine falsche Aussage, denn der wahre Grund ist „bereits
            # genehmigt". Der Claim ist der Einzige, der diese Frage beantworten
            # kann (er allein kennt den Vorzustand), also entscheidet er zuerst.
            # Danach ist jede gefundene Belegung echte FREMD-Belegung.
            #
            # Der Preis ist eine Claim-Spur, die zurückgerollt wird — dieselbe
            # Rückrollung, die der `except`-Block unten für den Schreibpfad
            # ohnehin fährt (Wurzel 1). Der Riegel liegt bewusst INNERHALB
            # dieses try: sein 409 muss den Claim genauso zurücknehmen wie ein
            # gescheitertes Anlegen, sonst bliebe der Antrag „approved" ohne
            # eine einzige belegte Nacht.
            self._kollisionen_riegel(ctx, antrag, rng, antrag_id)
            # Leistungen VOR der Eigennutzung entscheiden (0538): deren
            # Anlegen stößt `sync_for_reservation` an, das den Zustand der
            # Bestellzeilen liest — auf `angefragt` entstünde keine Aufgabe.
            # Im try: scheitert die Belegung, rollt `_zuruecksetzen` sie mit.
            leistungen_entscheiden(self._db, ctx, antrag_id, leistungen)
            self._eigennutzung_anlegen(ctx, antrag, owner_id, rng)
        except BaseException as exc:
            log.warning(
                "sperrantrag_belegung_fehlgeschlagen",
                tenant_id=ctx.tenant_id,
                antrag_id=antrag_id,
                property_id=str(antrag["property_id"]),
                fehler=str(exc)[:300],
                claim_wird_zurueckgerollt=True,
            )
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
            # Der Kalender ist ab hier belegt und die ARI-Jobs sind eingereiht;
            # was danach kommt (Mail, Aggregate), kippt die Sperre nicht mehr.
            kalender_belegt=True,
        )
        neu = self._laden(ctx, antrag_id)
        self._melde_entscheidung(ctx, neu, GENEHMIGT)
        return self._einzel_item(neu, ctx)

    # --- Vertragskündigung (0377) -------------------------------------------

    @staticmethod
    def _ist_kuendigung(antrag: dict, req: BlockRequestDecision) -> bool:
        """Ist DIESE Genehmigung eine Vertragskündigung?

        Zwei Wege dorthin, und beide zählen:
          * Der EIGENTÜMER hat es beim Stellen erklärt (`ist_kuendigung`) — seine
            Willenserklärung, die Agentur bestätigt sie nur.
          * Die AGENTUR wertet den Antrag so (`req.als_kuendigung`). Der
            Bestandsfall: Anträge von vor diesem Feld tragen `false`, obwohl der
            Eigentümer im Freitext genau das erklärt hat („Vi er ikke
            interesseret i udlejning 2027", live 12.08.2026). Ohne diesen Weg
            müsste die Agentur den Eigentümer erneut anschreiben, damit er einen
            zweiten Antrag mit Häkchen stellt — für eine Absicht, die er längst
            mitgeteilt hat.

        Kein Freitext-Erraten (kein „enthält das Wort udlejning"): eine
        Kündigung ist eine Rechtshandlung und darf nicht aus einer
        Wortsuche in 24 Sprachen folgen (Wurzel 4).
        """
        return bool(antrag.get("ist_kuendigung")) or bool(req.als_kuendigung)

    def _kuendigung_genehmigen(
        self,
        ctx: AuthContext,
        antrag: dict,
        req: BlockRequestDecision,
        rng: DateRange,
    ) -> SperrantragItem:
        """Eine Kündigung genehmigen: Vertragsende am Objekt setzen.

        WARUM DAS NICHT DER NORMALE WEG IST: Eine Kündigung belegt keine Nächte.
        Der normale Pfad legt eine Eigennutzung an — bei einer Kündigung wäre
        das doppelt falsch: er verlangte einen `owner_id`-Personenbezug für
        einen Aufenthalt, den es nicht gibt, und er sperrte GENAU den beantragten
        Zeitraum, während ein Vertragsende unbefristet gilt (es endet nicht am
        31.12.2027 wieder). Die Sperre kommt darum aus
        `properties.vertragsende_durchsetzen`: sie schreibt den 730-Tage-Horizont
        mit `source='contract_end'`, wächst über den nächtlichen Nachzug mit und
        hat ihren eigenen, geprüften Gegenzustand (Wurzel 1).

        DAS DATUM: `req.vertragsende` wenn gesetzt, sonst der `start_date` des
        Antrags — „ab da nicht mehr vermieten" heißt „ab da kein Vertrag". Es
        wird NICHT aus dem Freitext geraten und nicht auf einen Monatsanfang
        gerundet (Wurzel 4).

        REIHENFOLGE wie im Sperr-Pfad (Wurzel 2): erst claimen, dann handeln,
        bei Fehlschlag zurückrollen. Ein Doppelklick bekommt 409, statt das
        Vertragsende zweimal zu setzen — was hier besonders zählt, weil der
        zweite Lauf sonst einen inzwischen von Hand korrigierten Wert
        überschriebe.
        """
        property_id = str(antrag["property_id"])
        ende = req.vertragsende or rng.start
        # Ein Vertragsende in der Vergangenheit ist kein Tippfehler, den man
        # glattbügelt: es hieße, das Objekt sei schon seit Monaten nicht mehr
        # unter Vertrag, während es verkauft wurde. Klar fehlschlagen.
        if ende < date.today():
            raise CalendarError(
                f"Das Vertragsende ({ende.isoformat()}) liegt in der "
                "Vergangenheit. Bitte ein Datum ab heute wählen.",
                status_code=422,
            )
        alt = self._vertragsende_lesen(ctx, property_id)
        geclaimt = self._claim(
            antrag_id=str(antrag["id"]),
            von="pending",
            nach="approved",
            ctx=ctx,
            note=req.note,
            kuendigung_felder={
                # Was die AGENTUR gewertet hat — getrennt von der Erklärung des
                # Eigentümers, damit hinterher nicht dasteht „er hat gekündigt",
                # wo ausgelegt wurde.
                "als_kuendigung_gewertet": bool(req.als_kuendigung),
                "vertragsende_gesetzt_auf": ende.isoformat(),
            },
        )
        if geclaimt is None:
            log.info(
                "sperrantrag_claim_verloren",
                tenant_id=ctx.tenant_id,
                antrag_id=str(antrag["id"]),
                status_vorgefunden=antrag.get("status"),
                kuendigung=True,
            )
            raise CalendarError(
                f"Antrag ist bereits {_status_text(antrag.get('status'))} — "
                "keine zweite Entscheidung möglich.",
                status_code=409,
            )
        log.info(
            "sperrantrag_kuendigung_claim_gesetzt",
            tenant_id=ctx.tenant_id,
            antrag_id=str(antrag["id"]),
            property_id=property_id,
            vertragsende_alt=alt.isoformat() if alt else None,
            vertragsende_neu=ende.isoformat(),
            entschieden_von=ctx.user_id,
        )
        try:
            gesperrt = self._vertragsende_setzen(ctx, property_id, ende)
        except BaseException as exc:
            # Wie im Sperr-Pfad: ohne den Seiteneffekt darf der Claim nicht
            # stehen bleiben, sonst gilt der Antrag als genehmigt, während der
            # Vertrag unverändert weiterläuft (mit Provision und Distribution).
            log.warning(
                "sperrantrag_vertragsende_fehlgeschlagen",
                tenant_id=ctx.tenant_id,
                antrag_id=str(antrag["id"]),
                property_id=property_id,
                fehler=str(exc)[:300],
                claim_wird_zurueckgerollt=True,
            )
            self._zuruecksetzen(ctx, str(antrag["id"]))
            raise
        log.info(
            "sperrantrag_kuendigung_genehmigt",
            tenant_id=ctx.tenant_id,
            antrag_id=str(antrag["id"]),
            property_id=property_id,
            vertragsende=ende.isoformat(),
            gesperrte_naechte=gesperrt,
            war_schon_gesetzt=alt == ende,
        )
        neu = self._laden(ctx, str(antrag["id"]))
        self._melde_entscheidung(ctx, neu, GENEHMIGT)
        return self._einzel_item(neu, ctx)

    def _vertragsende_lesen(
        self, ctx: AuthContext, property_id: str
    ) -> date | None:
        """Das aktuell hinterlegte Vertragsende — tenant-gescopt (Wurzel 3).

        Wird VOR dem Setzen gelesen, damit im Log steht, was überschrieben
        wurde. Live gelernt: „Feriehus Kornblomst" hatte längst den 09.10.2026
        stehen (deshalb war 2027 komplett gesperrt), und niemand hatte den
        Zusammenhang zum offenen Antrag gesehen.
        """
        rows = (
            self._db.table("properties")
            .select("contract_end_date")
            .eq("id", property_id)
            .eq("tenant_id", self._tenant(ctx))
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise CalendarError("Objekt nicht gefunden.", status_code=404)
        wert = rows[0].get("contract_end_date")
        return _als_datum(wert) if wert else None

    def _vertragsende_setzen(
        self, ctx: AuthContext, property_id: str, ende: date
    ) -> int:
        """Vertragsende am Objekt schreiben und durchsetzen. Gibt die Zahl der
        geschriebenen Sperrnächte zurück.

        Über `properties.vertragsende_durchsetzen` — den EINEN Einstiegspunkt,
        der beide Richtungen kennt (Wurzel 1). Ein eigener Sperr-Loop hier
        müsste den 730-Tage-Horizont, das Auslassen fremder Sperren, den
        ARI-Push mit der echten Stückzahl und den nächtlichen Nachzug nachbauen
        — und liefe beim ersten Zusatz dort auseinander.

        Der UPDATE ist tenant-gescopt; `vertragsende_durchsetzen` selbst
        verlässt sich darauf, dass der Aufrufer das Objekt schon geprüft hat
        (`_vertragsende_lesen` hat das getan).
        """
        from src.features.properties.vertragsende import (  # noqa: PLC0415
            vertragsende_durchsetzen,
        )

        self._db.table("properties").update(
            {"contract_end_date": ende.isoformat()}
        ).eq("id", property_id).eq("tenant_id", self._tenant(ctx)).execute()
        return vertragsende_durchsetzen(
            self._db, str(ctx.tenant_id), property_id, ende
        )

    def _kollisionen_riegel(
        self,
        ctx: AuthContext,
        antrag: dict,
        rng: DateRange,
        antrag_id: str,
    ) -> None:
        """Ist der Zeitraum frei? Wenn nicht: 409 mit dem konkreten Befund.

        WARUM HIER UND NICHT ERST IM SCHREIBPFAD: `ReservationsService.create`
        prüft die Belegung ebenfalls und wirft 409 — aber mit dem Satz
        „Zeitraum enthält bereits belegte/gesperrte Tage", der nicht sagt,
        welche Buchung im Weg steht. Bei einem Jahresantrag ist das die
        gesamte Information, die fehlt. Dieser Riegel liefert sie.

        Er ERSETZT die Prüfung im Schreibpfad NICHT (Wurzel 2): zwischen
        diesem Lesen und dem Anlegen kann eine OTA-Buchung eingehen. Der
        Advisory-Lock in der RPC und der EXCLUDE-Constraint bleiben der harte
        Schutz; hier entsteht die Aussage.

        Storniert wird NICHTS (Entscheidung 12.08.2026): eine Gastbuchung
        wegen eines Sperrantrags automatisch zu stornieren hätte Außenwirkung
        (Gast-Mail, Rückzahlung, OTA-Meldung) und keinen Rückweg. Die Agentur
        löst die Kollisionen bewusst einzeln auf.
        """
        befund = kollisionen_pruefen(
            self._db,
            str(antrag["tenant_id"]),
            str(antrag["property_id"]),
            rng,
            unit_id=(
                str(antrag["unit_id"]) if antrag.get("unit_id") else None
            ),
            antrag_id=antrag_id,
        )
        if not befund.blockiert:
            log.info(
                "sperrantrag_zeitraum_frei",
                tenant_id=ctx.tenant_id,
                antrag_id=antrag_id,
                freie_einheit_id=befund.freie_einheit_id,
                min_freie_einheiten=befund.min_freie_einheiten,
                # Auch ein FREIER Zeitraum kann Buchungen enthalten — nämlich
                # in Schwestereinheiten. Das mitzuloggen erspart die Rückfrage
                # „warum ging das durch, da war doch eine Buchung?".
                buchungen_in_anderen_einheiten=befund.buchungen_gesamt,
            )
            return
        log.warning(
            "sperrantrag_zeitraum_blockiert",
            tenant_id=ctx.tenant_id,
            antrag_id=antrag_id,
            property_id=str(antrag["property_id"]),
            grund=befund.grund,
            buchungen=befund.buchungen_gesamt,
            sperrtage=befund.sperrtage_gesamt,
            stop_sell_tage=befund.stop_sell_gesamt,
            min_freie_einheiten=befund.min_freie_einheiten,
            # Die kollidierenden IDs: damit steht im Log, WAS aufzulösen ist,
            # ohne Gastnamen/Kontaktdaten zu protokollieren (keine PII).
            reservierungen=[k.reservation_id for k in befund.buchungen[:20]],
        )
        raise CalendarError(konflikt_text(befund), status_code=409)

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
        # Mit dem Antrag fallen seine Bestellungen (0538, Wurzel 1): sonst
        # stünde „Endreinigung: angefragt" unter einer Ablehnung.
        leistungen_alle_setzen(self._db, ctx, antrag_id, "abgelehnt", req.note)
        log.info(
            "sperrantrag_abgelehnt", tenant_id=ctx.tenant_id, antrag_id=antrag_id
        )
        neu = self._laden(ctx, antrag_id)
        self._melde_entscheidung(ctx, neu, ABGELEHNT)
        return self._einzel_item(neu, ctx)

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
        # Mit der Sperre fällt die Arbeit dazu (0538): die Aufgaben über den
        # Storno der Eigennutzung, die Bestellzeilen hier.
        leistungen_alle_setzen(self._db, ctx, antrag_id, "abgelehnt", req.note)
        log.info(
            "sperrantrag_widerruf_claim_gesetzt",
            tenant_id=ctx.tenant_id,
            antrag_id=antrag_id,
            property_id=str(antrag["property_id"]),
            naechte=len(rng.nights()),
            entschieden_von=ctx.user_id,
        )
        try:
            # War es eine Kündigung, ist der Gegenzustand das VERTRAGSENDE und
            # nicht eine Nächte-Freigabe (0377) — zwei verschiedene Wege für
            # zwei verschiedene Genehmigungen.
            self._vertragsende_widerrufen(ctx, antrag)
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
        except BaseException as exc:
            # Wie beim Genehmigen (siehe dort): ohne die Freigabe darf der
            # Widerruf nicht stehen bleiben, sonst zeigt das Portal
            # „zurückgenommen", während die Nächte gesperrt sind. Auch hier
            # jeder Fehler, nicht nur der fachliche — und sofort re-raise.
            log.warning(
                "sperrantrag_freigabe_fehlgeschlagen",
                tenant_id=ctx.tenant_id,
                antrag_id=antrag_id,
                property_id=str(antrag["property_id"]),
                fehler=str(exc)[:300],
                claim_wird_zurueckgerollt=True,
            )
            self._auf_genehmigt_zurueck(ctx, antrag_id)
            raise
        log.info(
            "sperrantrag_zurueckgenommen",
            tenant_id=ctx.tenant_id,
            antrag_id=antrag_id,
            property_id=str(antrag["property_id"]),
        )
        # Wurzel 1: Lag ein Aufhebungswunsch vor (0513), ist er mit diesem
        # Widerruf ERLEDIGT. Bliebe er auf 'beantragt' stehen, zeigte das Portal
        # dem Eigentuemer weiter „wird geprueft", obwohl seine Naechte laengst
        # frei sind — und die Warteschlange der Agentur einen Vorgang, den es
        # nicht mehr gibt. Der Filter auf 'beantragt' laesst einen Widerruf
        # OHNE vorherigen Wunsch unberuehrt (No-op), statt ihm nachtraeglich
        # eine Aufhebung anzudichten, die niemand beantragt hat.
        self._aufhebung_abschliessen(ctx, antrag_id, "aufgehoben", req.note)
        neu = self._laden(ctx, antrag_id)
        self._melde_entscheidung(ctx, neu, ZURUECKGENOMMEN)
        return self._einzel_item(neu, ctx)

    def _aufhebung_abschliessen(
        self, ctx: AuthContext, antrag_id: str, ergebnis: str, note: str | None
    ) -> None:
        """Einen OFFENEN Aufhebungswunsch als entschieden markieren (0513).

        Bedingter UPDATE auf `aufhebung='beantragt'`: gab es keinen Wunsch,
        passiert nichts. Das ist Absicht — ein Widerruf, den die Agentur von
        sich aus ausloest, ist keine Antwort auf einen Wunsch des Eigentuemers.
        """
        self._db.table("block_requests").update(
            {
                "aufhebung": ergebnis,
                "aufhebung_entschieden_von": ctx.user_id,
                # Fachlicher Entscheidungszeitpunkt, nicht updated_at (5b).
                "aufhebung_entschieden_am": datetime.now(UTC).isoformat(),
                "aufhebung_entscheidungsnotiz": (note or "").strip() or None,
            }
        ).eq("id", antrag_id).eq("tenant_id", ctx.tenant_id).eq(
            "aufhebung", "beantragt"
        ).execute()

    def aufhebung_ablehnen(
        self, ctx: AuthContext, antrag_id: str, req: BlockRequestDecision
    ) -> SperrantragItem:
        """Den Aufhebungswunsch ablehnen — die Sperrung BLEIBT (0513).

        Kein Kalender-Seiteneffekt: es wird nichts freigegeben, der Status des
        Antrags bleibt 'approved'. Abgelehnt wird nur der Wunsch, sie
        aufzuheben.

        Der Eigentuemer braucht eine Begruendung, sonst wirkt die Ablehnung wie
        Willkuer — sie steht in `aufhebung_entscheidungsnotiz` und ist im Portal
        sichtbar.
        """
        antrag = self._laden(ctx, antrag_id)
        if str(antrag.get("aufhebung") or "keine") != "beantragt":
            raise CalendarError(
                "Zu dieser Sperrung liegt kein offener Aufhebungswunsch vor.",
                status_code=409,
            )
        self._aufhebung_abschliessen(ctx, antrag_id, "abgelehnt", req.note)
        neu = self._laden(ctx, antrag_id)
        # Der Eigentuemer MUSS es erfahren: er hat um Freigabe gebeten, und
        # die Antwort ist „nein". Ohne Meldung stand im Portal weiter
        # „beantragt" und er wartete auf eine schon gefallene Entscheidung.
        self._melde_entscheidung(ctx, neu, AUFHEBUNG_ABGELEHNT)
        log.info(
            "sperrantrag_aufhebung_abgelehnt",
            tenant_id=ctx.tenant_id,
            antrag_id=antrag_id,
        )
        return self._einzel_item(neu, ctx)

    def _vertragsende_widerrufen(
        self, ctx: AuthContext, antrag: dict
    ) -> None:
        """Das aus DIESER Genehmigung gesetzte Vertragsende zurücknehmen (0377).

        WURZEL 1, UND ZWAR NUR DER EIGENE GEGENZUSTAND: Zurückgenommen wird nur,
        wenn am Objekt GENAU DAS Datum steht, das diese Genehmigung geschrieben
        hat (`vertragsende_gesetzt_auf`). Hat jemand danach ein anderes Ende
        eingetragen — von Hand oder über einen zweiten Antrag —, bleibt es
        stehen: der Widerruf DIESES Antrags darf keine fremde, jüngere
        Entscheidung überschreiben. Dasselbe Prinzip wie beim Storno über
        `block_request_id` statt über (Objekt, Zeitraum).

        Kein Anker, nichts zu tun: ein Antrag ohne `vertragsende_gesetzt_auf`
        war keine Kündigung (oder hat keine gesetzt) — dann ist dies ein No-op
        und der normale Freigabe-Pfad übernimmt.

        Das Ende wird auf `None` gesetzt, was `vertragsende_durchsetzen` als
        „unbefristet" versteht: es hebt ALLE `contract_end`-Sperren ab heute auf
        und meldet die Tage als verfügbar. Ein Datum weiter in der Zukunft wäre
        geraten (Wurzel 4) — der Vertrag läuft nach dem Widerruf schlicht
        weiter.
        """
        anker = antrag.get("vertragsende_gesetzt_auf")
        if not anker:
            return
        property_id = str(antrag["property_id"])
        gesetzt = _als_datum(anker)
        aktuell = self._vertragsende_lesen(ctx, property_id)
        if aktuell != gesetzt:
            log.info(
                "sperrantrag_vertragsende_nicht_widerrufen",
                tenant_id=ctx.tenant_id,
                antrag_id=str(antrag["id"]),
                property_id=property_id,
                gesetzt_von_diesem_antrag=gesetzt.isoformat() if gesetzt else None,
                aktuell_am_objekt=aktuell.isoformat() if aktuell else None,
                grund="fremder_oder_juengerer_wert",
            )
            return
        from src.features.properties.vertragsende import (  # noqa: PLC0415
            vertragsende_durchsetzen,
        )

        self._db.table("properties").update(
            {"contract_end_date": None}
        ).eq("id", property_id).eq("tenant_id", self._tenant(ctx)).execute()
        vertragsende_durchsetzen(
            self._db, str(ctx.tenant_id), property_id, None
        )
        log.info(
            "sperrantrag_vertragsende_widerrufen",
            tenant_id=ctx.tenant_id,
            antrag_id=str(antrag["id"]),
            property_id=property_id,
            war=gesetzt.isoformat() if gesetzt else None,
        )

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
        from src.features.reservations.schemas import (  # noqa: PLC0415
            CancelParty,
            CancelReasonCode,
        )
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
            ctx,
            str(rows[0]["id"]),
            grund,
            # Der BETRIEB nimmt hier seine eigene Genehmigung zurück (die
            # Capability APPROVE_BLOCK hat nur admin/co_admin) — nicht der
            # Eigentümer, der die Sperre beantragt hatte.
            partei=CancelParty.betrieb,
            reason_code=CancelReasonCode.eigennutzung_aufgeloest,
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
        kuendigung_felder: dict[str, object] | None = None,
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
                    # Kündigungs-Einordnung und -Datum gehen IM SELBEN UPDATE
                    # mit (0377): stünden sie in einem zweiten, könnte ein
                    # Abbruch dazwischen einen genehmigten Antrag ohne
                    # Kündigungsspur hinterlassen — und der Widerruf wüsste
                    # nicht, dass er ein Vertragsende zurückzunehmen hat.
                    **(kuendigung_felder or {}),
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
        # Die Leistungsentscheidungen gehören zum selben Claim (0538) und
        # gehen mit ihm zurück.
        leistungen_alle_setzen(self._db, ctx, antrag_id, "angefragt", None)

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
        titel = self._titel(
            str(antrag["tenant_id"]), {str(antrag["property_id"])}
        ).get(
            str(antrag["property_id"]), ""
        ) or str(antrag["property_id"])[:8]
        zeitraum = f"{antrag['start_date']} – {antrag['end_date']}"
        notiz = str(antrag.get(_NOTIZ_SPALTE[entscheidung]) or "").strip()
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
                # Die ENTSCHEIDUNG im Schluessel, nicht `status`: bei einer
                # Aufhebungs-Entscheidung bleibt `status` auf 'approved'
                # stehen. Ueber `status` waere die Ablehnung des
                # Aufhebungswunsches also derselbe Schluessel wie die
                # Genehmigung des Antrags von damals — sie waere am
                # Unique-Index (0287) verschluckt worden, solange jene
                # ungelesen ist, und das ist sie ohne Glocke im Portal immer
                # (Wurzel 2: der Schluessel beschreibt das EREIGNIS).
                dedup_key=f"block_decision:{antrag['id']}:{entscheidung}",
            )
        except Exception as exc:  # noqa: BLE001 — Nebenpfad, siehe Docstring
            log.warning(
                "sperrantrag_meldung_fehlgeschlagen",
                antrag_id=str(antrag["id"]),
                error=str(exc)[:200],
            )


# Die Benachrichtigungen (melde_neuen_antrag, melde_aufhebungswunsch) liegen
# in `sperrantrag_meldung.py`, die Anzeige-Anreicherung in
# `sperrantrag_anzeige.py` — sie beantworten eine andere Frage als dieser
# Zustandsautomat und liessen das Modul ueber 1500 Zeilen wachsen. Der
# Re-Export haelt die bestehenden Importwege gueltig.

def _status_text(status: str | None) -> str:
    return {
        "pending": "offen",
        "approved": "genehmigt",
        "rejected": "abgelehnt",
    }.get(status or "", status or "unbekannt")
