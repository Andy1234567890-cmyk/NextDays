"""KI-Regeln: was die KI beantworten darf und wie zugestellt wird (0493).

Eine Regel ist die Antwort auf die Frage, die der Betrieb wirklich hat: *„Was
darf die KI von allein schreiben?"* Vorher gab es dafür ein einziges
Freitextfeld für den ganzen Betrieb — damit ließ sich „WLAN-Fragen ja,
Erstattungen nie" nicht ausdrücken.

Ein Mixin von :class:`InboxService`, wie ``vorlagen`` und ``planung``.

**Die fest eingebaute Sperre.** Zu Geld (Erstattung, Rabatt, Entschädigung),
Zahlungsdaten, Sicherheitsvorfällen und Verfügbarkeitszusagen antwortet die KI
NIE automatisch — auch wenn eine Regel es ausdrücklich erlaubt. Sie erzeugt
dort einen Entwurf. Diese Sperre steht in :data:`GESPERRTE_THEMEN` und ist
nicht abschaltbar; der Grund ist, dass solche Antworten entweder Geld wert oder
rechtlich bindend sind. Eine Zusage „ja, wir erstatten Ihnen 200 €", die
niemand gelesen hat, kostet echtes Geld — und ein Betrieb, der eine Regel
„beantworte alles automatisch" anlegt, hat das nicht gemeint.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .errors import InboxError
from .schemas import (
    KiProtokollEintrag,
    KiProtokollList,
    KiRegel,
    KiRegelList,
    KiRegelUpsert,
)

log = get_logger("nextdays.inbox.ki_regeln")

# Wie viele Regeln ein Betrieb höchstens anlegen darf. Jede aktive Regel geht
# in den Prompt; ohne Obergrenze verdrängen 200 Regeln den Kontext, den der
# Sammler ausgewählt hat (Wurzel 8).
MAX_REGELN = 50

# Wie viele Regeln höchstens in EINEN Prompt gehen. Auch unterhalb von
# MAX_REGELN: 50 Anweisungen à 2000 Zeichen wären 100.000 Zeichen.
MAX_REGELN_JE_PROMPT = 15

# Wie viele Protokollzeilen die Liste höchstens zurückgibt.
MAX_PROTOKOLL = 200

# Themen, bei denen NIE automatisch gesendet wird — unabhängig von jeder Regel.
#
# Die Stichwörter stehen mehrsprachig da (de/en/da), weil die Gastfrage in der
# Sprache des Gastes ankommt. Sie sind bewusst großzügig geschnitten: ein
# falsch-positiver Treffer kostet einen Entwurf, den ein Mensch abnickt; ein
# falsch-negativer kostet eine ungeprüfte Geldzusage.
GESPERRTE_THEMEN: dict[str, tuple[str, ...]] = {
    "Geld / Erstattung": (
        "erstatt", "rückerstatt", "rueckerstatt", "refund", "refusion",
        "tilbagebetal", "rabatt", "discount", "nachlass", "gutschein",
        "voucher", "entschädig", "entschaedig", "compensation", "kompensation",
        "storn", "cancel", "afbestil", "kaution", "deposit", "depositum",
        "zurückzahl", "zurueckzahl", "money back", "tilbage",
        # Getrennte Verbform („zahlen Sie das Geld zurück"). Als Paar und
        # nicht als blosses „zurück": das allein fing „Der Weg zurück zum
        # Strand" mit und hätte jede Wegbeschreibung zum Entwurf gemacht.
        "geld zurück", "geld zurueck", "betrag zurück", "betrag zurueck",
    ),
    "Zahlung": (
        "zahlung", "payment", "betaling", "rechnung", "invoice", "faktura",
        "kreditkarte", "credit card", "kreditkort", "iban", "überweis",
        "ueberweis", "transfer", "bezahl", "pay", "betal",
    ),
    "Sicherheit / Schaden": (
        "einbruch", "burglary", "indbrud", "diebstahl", "theft", "tyveri",
        "verletz", "injur", "skade", "unfall", "accident", "ulykke",
        "polizei", "police", "politi", "anwalt", "lawyer", "advokat",
        "wasserschaden", "water damage", "vandskade", "feuer", "fire",
    ),
    "Verfügbarkeitszusage": (
        "reservier", "reserve", "reserver", "buchen wir", "book it",
        "verlänger", "verlaenger", "extend", "forlæng", "forlaeng",
        "umbuch", "rebook", "ombook",
    ),
}

_WORT = re.compile(r"[^\W\d_]+", re.UNICODE)


def gesperrtes_thema(frage: str) -> str | None:
    """Trifft die Frage ein Thema, das nie automatisch beantwortet wird?

    Gibt den Namen des Themas zurück (er landet im Protokoll als ``grund``)
    oder ``None``. Der Name statt eines bloßen ``True``, weil der Betrieb im
    Protokoll lesen können muss, WARUM eine Antwort ein Entwurf blieb — sonst
    sieht die Sperre wie ein Aussetzer aus.
    """
    text = frage.lower()
    worte = {w.lower() for w in _WORT.findall(frage) if len(w) >= 3}
    for thema, stichwoerter in GESPERRTE_THEMEN.items():
        for s in stichwoerter:
            # Mehrwortige Stichwörter („money back") gegen den ganzen Text,
            # einzelne gegen die Wörter — und NUR in einer Richtung: das
            # Stichwort ist der Wortstamm, das Wort seine Erweiterung
            # („erstatt" trifft „erstatten"). Die Rückrichtung (`w in s`) hat
            # live falsch gegriffen: „the" steckt in „theft" und „wir" in
            # „buchen wir", also galten „Where is the supermarket?" und „Wann
            # können wir anreisen?" als gesperrt. Ein zu breiter Fang macht die
            # Autoantwort wertlos, weil dann alles Entwurf bleibt.
            treffer = s in text if " " in s else any(w.startswith(s) for w in worte)
            if treffer:
                return thema
    return None


class KiRegelnMixin:
    """Regeln lesen, schreiben, anwenden. Teil von `InboxService`."""

    _db: Client | None

    # -- Lesen ---------------------------------------------------------------
    def list_ki_regeln(self, ctx: AuthContext) -> KiRegelList:
        db, tenant_id = self._require(ctx)
        zeilen = (
            db.table("ki_regel")
            .select(
                "id, name, aktiv, gilt_fuer, zustellart, anweisung, "
                "ist_eskalation, eskalation_posteingang, benachrichtigen, "
                "verwendet_zaehler, "
                "zuletzt_verwendet_at"
            )
            .eq("tenant_id", tenant_id)
            .order("created_at")
            .limit(MAX_REGELN)
            .execute()
        ).data or []
        zuordnung = self._regel_objekte(db, tenant_id, [str(z["id"]) for z in zeilen])
        items = [
            KiRegel(**{**z, "property_ids": zuordnung.get(str(z["id"]), [])})
            for z in zeilen
        ]
        return KiRegelList(items=items, total=len(items))

    @staticmethod
    def _regel_objekte(
        db: Client, tenant_id: str, regel_ids: list[str]
    ) -> dict[str, list[str]]:
        """Objektzuordnung aller Regeln in EINER Abfrage.

        Eine Abfrage je Regel wäre bei zwölf Regeln dieselbe Antwort in zwölf
        Runden — und die Liste öffnet der Betrieb bei jedem Blick auf die
        Einstellungen.
        """
        if not regel_ids:
            return {}
        zeilen = (
            db.table("ki_regel_objekt")
            .select("regel_id, property_id")
            .eq("tenant_id", tenant_id)
            .in_("regel_id", regel_ids)
            .execute()
        ).data or []
        nach_regel: dict[str, list[str]] = {}
        for z in zeilen:
            nach_regel.setdefault(str(z["regel_id"]), []).append(str(z["property_id"]))
        return nach_regel

    # -- Schreiben -----------------------------------------------------------
    def create_ki_regel(self, ctx: AuthContext, req: KiRegelUpsert) -> KiRegel:
        db, tenant_id = self._require(ctx)
        vorhanden = (
            db.table("ki_regel")
            .select("id", count="exact")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).count or 0
        if vorhanden >= MAX_REGELN:
            raise InboxError(
                f"Mehr als {MAX_REGELN} Regeln sind nicht möglich.", status_code=422
            )
        objekte = self._regel_objekte_pruefen(db, tenant_id, req)
        zeile = (
            db.table("ki_regel")
            .insert({"tenant_id": tenant_id, **self._regel_felder(req)})
            .execute()
        ).data[0]
        self._objekte_setzen(db, tenant_id, str(zeile["id"]), objekte)
        return KiRegel(**{**zeile, "property_ids": objekte})

    def update_ki_regel(
        self, ctx: AuthContext, regel_id: str, req: KiRegelUpsert
    ) -> KiRegel:
        db, tenant_id = self._require(ctx)
        objekte = self._regel_objekte_pruefen(db, tenant_id, req)
        zeilen = (
            db.table("ki_regel")
            .update({**self._regel_felder(req), "updated_at": _jetzt()})
            .eq("tenant_id", tenant_id)
            .eq("id", regel_id)
            .execute()
        ).data
        if not zeilen:
            raise InboxError("Regel nicht gefunden.", status_code=404)
        self._objekte_setzen(db, tenant_id, regel_id, objekte)
        return KiRegel(**{**zeilen[0], "property_ids": objekte})

    def delete_ki_regel(self, ctx: AuthContext, regel_id: str) -> None:
        db, tenant_id = self._require(ctx)
        # `ki_regel_objekt` hängt per `on delete cascade` — der Gegenzustand
        # wird von der DB gepflegt, nicht hier nachgebaut (Wurzel 1).
        db.table("ki_regel").delete().eq("tenant_id", tenant_id).eq(
            "id", regel_id
        ).execute()

    @staticmethod
    def _regel_felder(req: KiRegelUpsert) -> dict:
        return {
            "name": req.name.strip(),
            "aktiv": req.aktiv,
            "gilt_fuer": req.gilt_fuer,
            "zustellart": req.zustellart,
            "anweisung": req.anweisung.strip(),
            "ist_eskalation": req.ist_eskalation,
            "eskalation_posteingang": req.eskalation_posteingang,
            "benachrichtigen": req.benachrichtigen,
        }

    def _regel_objekte_pruefen(
        self, db: Client, tenant_id: str, req: KiRegelUpsert
    ) -> list[str]:
        """Die genannten Objekte gehören diesem Betrieb — serverseitig geprüft.

        Ohne diese Prüfung könnte eine Anfrage eine fremde property_id
        eintragen; die Regel griffe dann bei einem Objekt eines anderen
        Betriebs (Wurzel 3). Die RLS der Zuordnungstabelle allein reicht nicht:
        der Server schreibt als service_role und umgeht sie.
        """
        if req.gilt_fuer != "auswahl":
            return []
        ids = sorted({str(p) for p in req.property_ids if str(p).strip()})
        if not ids:
            raise InboxError(
                "Bei 'Nur ausgewählte Objekte' muss mindestens ein Objekt "
                "gewählt sein.",
                status_code=422,
            )
        eigene = {
            str(z["id"])
            for z in (
                db.table("properties")
                .select("id")
                .eq("tenant_id", tenant_id)
                .in_("id", ids)
                .execute()
            ).data or []
        }
        fremd = [i for i in ids if i not in eigene]
        if fremd:
            raise InboxError("Objekt nicht gefunden.", status_code=404)
        return ids

    @staticmethod
    def _objekte_setzen(
        db: Client, tenant_id: str, regel_id: str, property_ids: list[str]
    ) -> None:
        """Die Zuordnung auf den Sollzustand bringen (Alt/Neu-Diff, Wurzel 1).

        Erst löschen, dann setzen: eine Regel, die von drei Objekten auf eines
        umgestellt wird, muss die zwei anderen VERLIEREN. Ein reines Einfügen
        ließe sie stehen, und die Regel griffe weiter, wo sie nicht mehr soll.
        """
        db.table("ki_regel_objekt").delete().eq("tenant_id", tenant_id).eq(
            "regel_id", regel_id
        ).execute()
        if property_ids:
            db.table("ki_regel_objekt").insert(
                [
                    {
                        "tenant_id": tenant_id,
                        "regel_id": regel_id,
                        "property_id": p,
                    }
                    for p in property_ids
                ]
            ).execute()

    # -- Anwenden ------------------------------------------------------------
    def regeln_fuer_thread(
        self, db: Client, tenant_id: str, property_id: str | None
    ) -> list[dict]:
        """Aktive Regeln, die für dieses Objekt gelten.

        Betriebsweite (`gilt_fuer='alle'`) plus die diesem Objekt zugeordneten.
        Ohne Objekt gelten nur die betriebsweiten — eine objektbezogene Regel
        auf eine Konversation ohne Unterkunft anzuwenden hieße raten.
        """
        alle = (
            db.table("ki_regel")
            .select(
                "id, name, zustellart, anweisung, ist_eskalation, "
                "eskalation_posteingang, benachrichtigen"
            )
            .eq("tenant_id", tenant_id)
            .eq("aktiv", True)
            .eq("gilt_fuer", "alle")
            .limit(MAX_REGELN_JE_PROMPT)
            .execute()
        ).data or []
        if not property_id:
            return alle
        zuordnung = (
            db.table("ki_regel_objekt")
            .select("regel_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .execute()
        ).data or []
        ids = [str(z["regel_id"]) for z in zuordnung]
        if not ids:
            return alle
        eigene = (
            db.table("ki_regel")
            .select(
                "id, name, zustellart, anweisung, ist_eskalation, "
                "eskalation_posteingang, benachrichtigen"
            )
            .eq("tenant_id", tenant_id)
            .eq("aktiv", True)
            .eq("gilt_fuer", "auswahl")
            .in_("id", ids)
            .limit(MAX_REGELN_JE_PROMPT)
            .execute()
        ).data or []
        # Objektbezogene zuerst: sie sind die spezifischeren.
        return (eigene + alle)[:MAX_REGELN_JE_PROMPT]

    @staticmethod
    def zustellart_entscheiden(
        regeln: list[dict], frage: str, autoantwort_aktiv: bool
    ) -> tuple[str, str | None, dict | None]:
        """Wird gesendet oder nur entworfen? Und warum?

        Gibt ``(zustellart, grund, regel)`` zurück. ``grund`` ist gesetzt,
        wenn eine automatische Zustellung VERHINDERT wurde — er steht im
        Protokoll und erklärt dem Betrieb, warum die KI diesmal nicht selbst
        geantwortet hat.

        Die Reihenfolge der Prüfungen ist die Rangfolge:

        1. Der große Schalter aus. Nichts geht automatisch.
        2. Eine Eskalationsregel greift. Dann wird gemeldet, nicht geantwortet.
        3. Ein gesperrtes Thema. Nie automatisch, egal was die Regel sagt.
        4. Eine Regel mit ``zustellart='automatisch'``. Erst hier wird gesendet.
        5. Sonst: Entwurf — die Vorgabe.
        """
        if not autoantwort_aktiv:
            return "entwurf", None, None
        eskalation = next((r for r in regeln if r.get("ist_eskalation")), None)
        if eskalation:
            return (
                "entwurf",
                f"Eskalationsregel: {eskalation['name']}",
                eskalation,
            )
        thema = gesperrtes_thema(frage)
        if thema:
            return "entwurf", f"Gesperrtes Thema: {thema}", None
        automatisch = next(
            (r for r in regeln if r.get("zustellart") == "automatisch"), None
        )
        if automatisch:
            return "automatisch", None, automatisch
        return "entwurf", None, (regeln[0] if regeln else None)

    def regel_verwendet(self, db: Client, tenant_id: str, regel_id: str) -> None:
        """Den „Verwendet"-Zähler hochsetzen. Best effort.

        Schlägt es fehl, ist die Antwort trotzdem erzeugt — ein verlorener
        Zählerstand ist ärgerlich, eine verworfene fertige Antwort wäre
        schlimmer. Der Fehler wird aber geloggt (Wurzel 5).
        """
        try:
            # Lesen + Schreiben statt eines DB-seitigen Inkrements: der Zähler
            # ist eine Anzeige ("13 mal"), kein Abrechnungswert. Zwei
            # gleichzeitige Antworten am selben Thread können sich hier um
            # eins verzählen — das ist der Preis dafür, keine Funktion in die
            # DB zu legen, die genau eine Spalte hochsetzt. Wer den Zähler
            # später exakt braucht, zählt im Protokoll (`ki_antwort_protokoll`),
            # das jede einzelne Antwort trägt.
            stand = (
                db.table("ki_regel")
                .select("verwendet_zaehler")
                .eq("tenant_id", tenant_id)
                .eq("id", regel_id)
                .limit(1)
                .execute()
            ).data or []
            if not stand:
                return
            db.table("ki_regel").update(
                {
                    "verwendet_zaehler": int(stand[0]["verwendet_zaehler"]) + 1,
                    "zuletzt_verwendet_at": _jetzt(),
                }
            ).eq("tenant_id", tenant_id).eq("id", regel_id).execute()
        except Exception as exc:  # noqa: BLE001 — best effort, siehe Docstring
            log.warning(
                "ki_regel_zaehler_nicht_erhoeht",
                regel_id=regel_id,
                grund=type(exc).__name__,
            )

    # -- Protokoll -----------------------------------------------------------
    def protokollieren(
        self,
        db: Client,
        tenant_id: str,
        *,
        thread_id: str,
        quelle: str,
        regel_id: str | None,
        frage: str,
        antwort: str,
        zustellart: str,
        gesendet: bool,
        quellen: list[str],
        weggelassen: list[str],
        eskaliert: bool = False,
        grund: str | None = None,
        modell: str | None = None,
        region: str | None = None,
        tokens_ein: int = 0,
        tokens_aus: int = 0,
    ) -> None:
        """Eine Antwort protokollieren — bei JEDER Antwort, auch beim Entwurf.

        Best effort: das Protokoll darf die Antwort nicht kippen. Es wird aber
        LAUT geloggt, wenn es fehlschlägt — eine Spur mit stillen Lücken ist
        als Nachweis wertlos, und niemand würde es merken (Wurzel 5).
        """
        try:
            db.table("ki_antwort_protokoll").insert(
                {
                    "tenant_id": tenant_id,
                    "thread_id": thread_id,
                    "quelle": quelle,
                    "regel_id": regel_id,
                    "frage_auszug": frage[:2000] or None,
                    "antwort": antwort,
                    "zustellart": zustellart,
                    "gesendet_at": _jetzt() if gesendet else None,
                    "quellen": quellen,
                    "weggelassen": weggelassen,
                    "eskaliert": eskaliert,
                    "grund": grund[:500] if grund else None,
                    "modell": modell,
                    "region": region,
                    "tokens_ein": tokens_ein,
                    "tokens_aus": tokens_aus,
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001 — best effort, siehe Docstring
            log.error(
                "ki_protokoll_nicht_geschrieben",
                tenant_id=tenant_id,
                thread_id=thread_id,
                grund=type(exc).__name__,
                fehler=str(exc)[:300],
            )

    def list_ki_protokoll(
        self, ctx: AuthContext, *, thread_id: str | None = None, limit: int = 50
    ) -> KiProtokollList:
        db, tenant_id = self._require(ctx)
        # Wurzel 8: der Client bestimmt die Menge nicht unbegrenzt.
        menge = max(1, min(int(limit), MAX_PROTOKOLL))
        q = (
            db.table("ki_antwort_protokoll")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(menge)
        )
        if thread_id:
            q = q.eq("thread_id", thread_id)
        zeilen = q.execute().data or []
        namen = self._regel_namen(db, tenant_id, zeilen)
        items = [
            KiProtokollEintrag(
                id=str(z["id"]),
                thread_id=str(z["thread_id"]),
                quelle=z["quelle"],
                regel_id=str(z["regel_id"]) if z.get("regel_id") else None,
                regel_name=namen.get(str(z.get("regel_id"))),
                frage_auszug=z.get("frage_auszug"),
                antwort=z.get("antwort"),
                zustellart=z["zustellart"],
                gesendet_at=z.get("gesendet_at"),
                quellen=list(z.get("quellen") or []),
                weggelassen=list(z.get("weggelassen") or []),
                eskaliert=bool(z.get("eskaliert")),
                grund=z.get("grund"),
                created_at=z.get("created_at"),
            )
            for z in zeilen
        ]
        return KiProtokollList(items=items, total=len(items))

    @staticmethod
    def _regel_namen(db: Client, tenant_id: str, zeilen: list[dict]) -> dict[str, str]:
        """Regelnamen zu den Protokollzeilen — eine Abfrage, nicht n.

        Der Name statt nur der ID, weil „Regel 7f3a…" niemandem sagt, welche
        Regel gegriffen hat.
        """
        ids = sorted({str(z["regel_id"]) for z in zeilen if z.get("regel_id")})
        if not ids:
            return {}
        return {
            str(r["id"]): str(r["name"])
            for r in (
                db.table("ki_regel")
                .select("id, name")
                .eq("tenant_id", tenant_id)
                .in_("id", ids)
                .execute()
            ).data or []
        }


def _jetzt() -> str:
    return datetime.now(UTC).isoformat()
