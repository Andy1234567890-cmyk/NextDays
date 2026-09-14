"""Meldeläufe: erzeugen, speichern, abgeben, herunterladen.

Ein Meldelauf ist mehr als eine Datei. Gespeichert wird, WAS gemeldet wurde
(die Kennungen je Anbieter) und WORAUS es entstand (die Buchungen je Zahl) —
ohne beides ist später weder eine Korrektur noch eine Auskunft möglich.

STATUS-LEBENSZYKLUS:
    entwurf    darf beliebig neu berechnet werden
    abgegeben  unveränderlich; existiert in den Büchern der Behörde
    ersetzt    durch eine Korrektur abgelöst

Ein abgegebener Lauf wird nie geändert. Eine Korrektur ist ein NEUER Lauf,
der auf ihn verweist — so bleibt nachvollziehbar, was wann galt.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import fetch_all_rows

from .aufbau import MeldungsAufbau
from .csv_dk import schreiben
from .kanaele import Meldungsart
from .modell import Anbieter, Meldung, Pruefbericht
from .pruefung import pruefen
from .rechner import quartal_von, zahlungszeitpunkt
from .xml_dpi import schreiben as schreiben_xml

log = get_logger("nextdays.dac7.service")

# Erstes und derzeit einziges Zielformat.
_BEHOERDE_DK = "DK"

# DAC7 gilt ab dem Meldezeitraum 2023.
_ERSTES_MELDEJAHR = 2023

# Blockgroessen: eine `in_`-Liste bzw. ein Insert mit tausenden Eintraegen
# sprengt die Laenge der PostgREST-Anfrage.
_ID_BLOCK = 200
_EINFUEGE_BLOCK = 500


class Dac7Error(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True, slots=True)
class _Beleg:
    """Eine Buchung, wie sie in der Meldeakte steht."""

    anschrift: str
    reservation_id: str
    betrag: str
    waehrung: str
    quartal: int


@dataclass(frozen=True, slots=True)
class LaufErgebnis:
    """Das Ergebnis eines Erzeugungslaufs."""

    lauf_id: str | None
    meldung: Meldung | None
    bericht: Pruefbericht
    datei: str | None

    @property
    def erfolgreich(self) -> bool:
        return self.datei is not None


def _pruefbericht_als_json(bericht: Pruefbericht) -> dict[str, Any]:
    """Den Bericht so ablegen, dass er in Jahren noch lesbar ist.

    Bewusst schlichte Strukturen statt einer Objektserialisierung: Der
    abgelegte Bericht muss auch dann verständlich bleiben, wenn sich unsere
    Klassen längst geändert haben.
    """
    return {
        "fehler": [
            {"betrifft": b.betrifft, "feld": b.feld, "grund": b.grund}
            for b in bericht.fehler
        ],
        "hinweise": [
            {"betrifft": b.betrifft, "feld": b.feld, "grund": b.grund}
            for b in bericht.hinweise
        ],
        "einbezogene_buchungen": bericht.einbezogene_buchungen,
        "ausgeschlossene_buchungen": bericht.ausgeschlossene_buchungen,
    }


class Dac7Service:
    """Erzeugt und verwaltet die Meldeläufe eines Betriebs."""

    def __init__(self, db: Client) -> None:
        self._db = db
        self._aufbau = MeldungsAufbau(db)

    # -- Erzeugen -----------------------------------------------------------

    def erzeugen(
        self,
        ctx: AuthContext,
        *,
        jahr: int,
        art: Meldungsart = Meldungsart.BETRIEB,
        speichern: bool = True,
    ) -> LaufErgebnis:
        """Die Meldung eines Jahres berechnen.

        Mit `speichern=False` ist das ein PROBELAUF: Es wird gerechnet und
        geprüft, aber nichts abgelegt. Genau das braucht man, um vor der
        ersten echten Meldung zu sehen, ob die Daten tragen — und es ist
        auch nach einer Abgabe noch möglich, weil ein Probelauf am
        abgegebenen Stand nichts ändert.

        Mit `speichern=True` entsteht ein Entwurf. Ein bereits abgegebener
        Lauf wird dabei nicht überschrieben.
        """
        tenant_id = self._tenant(ctx)
        self._jahr_pruefen(jahr)

        # Die Sperre gilt nur fürs Ablegen. Ein Probelauf darf auch nach
        # der Abgabe laufen: Er ändert nichts und beantwortet die Frage
        # „wie sähe die Meldung mit dem heutigen Datenstand aus".
        if speichern and self._abgegebener_lauf(tenant_id, jahr, art):
            msg = (
                f"Für {jahr} wurde bereits eine Meldung abgegeben. "
                "Eine Änderung ist nur als Korrekturmeldung möglich."
            )
            raise Dac7Error(msg, status_code=409)

        # Die Referenz macht die Kennungen eindeutig und reproduzierbar:
        # gleiche Eingaben ergeben dieselbe Datei.
        referenz = f"{art.value[:3].upper()}{jahr}"
        meldung, bericht = self._aufbau.bauen(
            tenant_id=tenant_id,
            jahr=jahr,
            art=art,
            behoerde_land=_BEHOERDE_DK,
            referenz=referenz,
        )

        if meldung is None:
            return LaufErgebnis(
                lauf_id=None, meldung=None, bericht=bericht, datei=None
            )

        pruefen(meldung, bericht)
        if not bericht.darf_melden:
            log.info(
                "dac7_lauf_unvollstaendig",
                tenant_id=tenant_id,
                jahr=jahr,
                fehler=len(bericht.fehler),
            )
            return LaufErgebnis(
                lauf_id=None, meldung=meldung, bericht=bericht, datei=None
            )

        datei = schreiben(meldung)
        lauf_id = None
        if speichern:
            lauf_id = self._lauf_ablegen(
                tenant_id=tenant_id,
                ctx=ctx,
                meldung=meldung,
                bericht=bericht,
                art=art,
                datei=datei,
            )

        log.info(
            "dac7_probelauf" if not speichern else "dac7_lauf_erzeugt",
            tenant_id=tenant_id,
            jahr=jahr,
            anbieter=len(meldung.anbieter),
            buchungen=bericht.einbezogene_buchungen,
        )
        return LaufErgebnis(
            lauf_id=lauf_id, meldung=meldung, bericht=bericht, datei=datei
        )

    # -- Ablegen ------------------------------------------------------------

    def _lauf_ablegen(
        self,
        *,
        tenant_id: str,
        ctx: AuthContext,
        meldung: Meldung,
        bericht: Pruefbericht,
        art: Meldungsart,
        datei: str,
    ) -> str:
        """Den Lauf samt Anbieterkennungen und Belegen speichern."""
        # Einen früheren Entwurf desselben Zuschnitts ersetzen: Zwei
        # Entwürfe für dasselbe Jahr nebeneinander wären nur verwirrend.
        self._entwuerfe_entfernen(tenant_id, meldung.jahr, art)

        einheiten = sum(len(a.taetigkeiten) for a in meldung.anbieter)
        zeile = (
            self._db.table("dac7_meldelaeufe")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "art": art.value,
                    "jahr": meldung.jahr,
                    "behoerde_land": _BEHOERDE_DK,
                    "status": "entwurf",
                    "meldeart": meldung.meldeart,
                    "melde_ref_id": meldung.melde_ref_id,
                    "betreiber_doc_ref_id": meldung.betreiber.doc_ref_id,
                    "anzahl_anbieter": len(meldung.anbieter),
                    "anzahl_einheiten": einheiten,
                    "anzahl_buchungen": bericht.einbezogene_buchungen,
                    "datei_pruefsumme": hashlib.sha256(
                        datei.encode("utf-8")
                    ).hexdigest(),
                    "datei_name": self._dateiname(meldung),
                    "pruefbericht": _pruefbericht_als_json(bericht),
                    "erstellt_von": ctx.user_id,
                }
            )
            .execute()
        )
        lauf_id = zeile.data[0]["id"]
        self._anbieter_ablegen(lauf_id, meldung)
        return lauf_id

    def _anbieter_ablegen(self, lauf_id: str, meldung: Meldung) -> None:
        """Anbieterkennungen und Belege des Laufs speichern."""
        for anbieter in meldung.anbieter:
            anzeigename = anbieter.name or " ".join(
                t for t in (anbieter.vorname, anbieter.nachname) if t
            )
            zeile = (
                self._db.table("dac7_meldelauf_anbieter")
                .insert(
                    {
                        "lauf_id": lauf_id,
                        "doc_ref_id": anbieter.doc_ref_id,
                        "owner_id": anbieter.quelle_id,
                        "ist_person": anbieter.ist_person,
                        "anzeigename": anzeigename,
                        "satzart": anbieter.satzart,
                    }
                )
                .execute()
            )
            self._belege_ablegen(lauf_id, zeile.data[0]["id"], anbieter)

    def _belege_ablegen(
        self, lauf_id: str, anbieter_id: str, anbieter: Anbieter
    ) -> None:
        """Welche Buchung in welche gemeldete Zahl einging.

        Eine Zeile je Buchung — das ist die Antwort auf die Rückfrage der
        Behörde „woher kommt dieser Betrag". Betrag und Quartal werden aus
        der Buchung selbst geholt, nicht aus der Quartalssumme abgeleitet:
        Ein aus der Summe zurückgerechneter Einzelbetrag wäre eine
        Erfindung, und in einer Steuerakte ist das der Unterschied zwischen
        Nachweis und Behauptung.
        """
        belege = self._buchungen_der_belege(anbieter)
        if not belege:
            return
        zeilen = [
            {
                "lauf_id": lauf_id,
                "anbieter_id": anbieter_id,
                "einheit_anschrift": beleg.anschrift,
                "reservation_id": beleg.reservation_id,
                "betrag": beleg.betrag,
                "waehrung": beleg.waehrung,
                "quartal": beleg.quartal,
            }
            for beleg in belege
        ]
        # In Blöcken: ein Betrieb mit tausenden Buchungen sprengte sonst die
        # Anfrage.
        for start in range(0, len(zeilen), _EINFUEGE_BLOCK):
            self._db.table("dac7_meldelauf_belege").insert(
                zeilen[start : start + _EINFUEGE_BLOCK]
            ).execute()

    def _buchungen_der_belege(
        self, anbieter: Anbieter
    ) -> list[_Beleg]:
        """Die Buchungen aller Tätigkeiten eines Anbieters nachschlagen.

        Die Tätigkeit kennt die Buchungskennungen; Betrag und Zeitpunkt
        stehen an der Buchung. Beides wird hier zusammengeführt, damit in
        der Akte der tatsächliche Einzelbetrag steht.
        """
        alle_ids = [
            beleg
            for taetigkeit in anbieter.taetigkeiten
            for beleg in taetigkeit.belege
        ]
        if not alle_ids:
            return []

        buchungen: dict[str, dict] = {}
        for start in range(0, len(alle_ids), _ID_BLOCK):
            block = alle_ids[start : start + _ID_BLOCK]
            for zeile in fetch_all_rows(
                self._db.table("reservations")
                .select("id, total_amount, currency, booked_at, check_in")
                .in_("id", block)
                .order("id")
            ):
                buchungen[zeile["id"]] = zeile

        belege: list[_Beleg] = []
        for taetigkeit in anbieter.taetigkeiten:
            anschrift = (
                taetigkeit.anschrift.ort or taetigkeit.anschrift.strasse or ""
            )
            for beleg in taetigkeit.belege:
                buchung = buchungen.get(beleg)
                if buchung is None:
                    continue
                zeitpunkt = zahlungszeitpunkt(buchung)
                if zeitpunkt is None:
                    continue
                belege.append(
                    _Beleg(
                        anschrift=anschrift,
                        reservation_id=beleg,
                        betrag=str(buchung.get("total_amount") or 0),
                        waehrung=buchung.get("currency") or taetigkeit.waehrung,
                        quartal=quartal_von(zeitpunkt),
                    )
                )
        return belege

    def _entwuerfe_entfernen(
        self, tenant_id: str, jahr: int, art: Meldungsart
    ) -> None:
        (
            self._db.table("dac7_meldelaeufe")
            .delete()
            .eq("tenant_id", tenant_id)
            .eq("jahr", jahr)
            .eq("art", art.value)
            .eq("status", "entwurf")
            .execute()
        )

    # -- Abgeben ------------------------------------------------------------

    def abgeben(self, ctx: AuthContext, lauf_id: str) -> dict:
        """Einen Entwurf als abgegeben kennzeichnen.

        Das ist ein bewusster Schritt des Nutzers, NACHDEM er die Datei bei
        der Behörde hochgeladen hat — wir laden nicht selbst hoch. Ab dann
        ist der Lauf unveränderlich.
        """
        tenant_id = self._tenant(ctx)
        lauf = self._lauf_laden(tenant_id, lauf_id)

        if lauf["status"] == "abgegeben":
            msg = "Dieser Lauf ist bereits als abgegeben gekennzeichnet."
            raise Dac7Error(msg, status_code=409)

        antwort = (
            self._db.table("dac7_meldelaeufe")
            .update(
                {
                    "status": "abgegeben",
                    "abgegeben_am": datetime.now(UTC).isoformat(),
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            )
            .eq("id", lauf_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        log.info("dac7_lauf_abgegeben", tenant_id=tenant_id, lauf_id=lauf_id)
        return antwort.data[0]

    # -- Lesen --------------------------------------------------------------

    def laeufe(self, ctx: AuthContext, jahr: int | None = None) -> list[dict]:
        abfrage = (
            self._db.table("dac7_meldelaeufe")
            .select("*")
            .eq("tenant_id", self._tenant(ctx))
            .order("jahr", desc=True)
            .order("created_at", desc=True)
        )
        if jahr is not None:
            abfrage = abfrage.eq("jahr", jahr)
        return fetch_all_rows(abfrage)

    def lauf_anbieter(self, ctx: AuthContext, lauf_id: str) -> list[dict]:
        """Die gemeldeten Anbieter eines Laufs — die Auskunft an die Behörde."""
        self._lauf_laden(self._tenant(ctx), lauf_id)
        return fetch_all_rows(
            self._db.table("dac7_meldelauf_anbieter")
            .select("*")
            .eq("lauf_id", lauf_id)
            .order("doc_ref_id")
        )

    def datei_neu_erzeugen(
        self, ctx: AuthContext, lauf_id: str, *, format: str = "csv"
    ) -> str:
        """Die Datei eines gespeicherten Laufs erneut erzeugen.

        Möglich, weil die Erzeugung reproduzierbar ist: gleiche Daten,
        gleiche Datei. Die Prüfsumme des Laufs belegt, ob sie es noch ist —
        weicht sie ab, haben sich die zugrunde liegenden Daten geändert, und
        genau das muss auffallen.

        `format` wählt den Serialisierer: `csv` für das Meldejahr 2025
        (TastSelv Erhverv), `xml` für das DPI-XML ab 2026. Beide lesen
        DENSELBEN gerechneten Baum — die Meldung entsteht einmal, nur ihre
        Schreibweise unterscheidet sich.

        Die Prüfsummen-Gegenprobe gilt nur für die CSV: Der Lauf hat seine
        Prüfsumme über sie gebildet, und das DPI-XML trägt einen
        Übermittlungs-Zeitstempel, der sich bei jedem Aufruf ändert. Ein
        Vergleich dagegen würde immer abweichen und damit nichts mehr
        aussagen.
        """
        tenant_id = self._tenant(ctx)
        lauf = self._lauf_laden(tenant_id, lauf_id)

        meldung, bericht = self._aufbau.bauen(
            tenant_id=tenant_id,
            jahr=lauf["jahr"],
            art=Meldungsart(lauf["art"]),
            behoerde_land=lauf["behoerde_land"],
            referenz=f"{lauf['art'][:3].upper()}{lauf['jahr']}",
        )
        if meldung is None or not pruefen(meldung, bericht).darf_melden:
            msg = (
                "Die Datei lässt sich nicht erneut erzeugen — die "
                "zugrunde liegenden Daten sind unvollständig geworden."
            )
            raise Dac7Error(msg, status_code=409)

        if format == "xml":
            return schreiben_xml(meldung)

        datei = schreiben(meldung)
        pruefsumme = hashlib.sha256(datei.encode("utf-8")).hexdigest()
        if lauf.get("datei_pruefsumme") and pruefsumme != lauf["datei_pruefsumme"]:
            log.warning(
                "dac7_datei_weicht_ab",
                tenant_id=tenant_id,
                lauf_id=lauf_id,
                erwartet=lauf["datei_pruefsumme"],
                erhalten=pruefsumme,
            )
        return datei

    # -- Intern -------------------------------------------------------------

    def _lauf_laden(self, tenant_id: str, lauf_id: str) -> dict:
        """Einen Lauf im Tenant-Scope laden (Wurzel 3).

        Load und Scope in EINEM Schritt: Ein ungescopter Load mit
        anschließendem Vergleich wäre die Stelle, an der man den Scope
        vergisst.
        """
        antwort = (
            self._db.table("dac7_meldelaeufe")
            .select("*")
            .eq("id", lauf_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not antwort.data:
            msg = "Meldelauf nicht gefunden."
            raise Dac7Error(msg, status_code=404)
        return antwort.data[0]

    def _abgegebener_lauf(
        self, tenant_id: str, jahr: int, art: Meldungsart
    ) -> dict | None:
        antwort = (
            self._db.table("dac7_meldelaeufe")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("jahr", jahr)
            .eq("art", art.value)
            .eq("status", "abgegeben")
            .limit(1)
            .execute()
        )
        return antwort.data[0] if antwort.data else None

    @staticmethod
    def _dateiname(meldung: Meldung) -> str:
        return f"dac7-{meldung.jahr}-{meldung.melde_ref_id}.csv"

    @staticmethod
    def _jahr_pruefen(jahr: int) -> None:
        aktuelles = datetime.now(UTC).year
        if not _ERSTES_MELDEJAHR <= jahr <= aktuelles:
            msg = (
                f"Meldejahr muss zwischen {_ERSTES_MELDEJAHR} und "
                f"{aktuelles} liegen."
            )
            raise Dac7Error(msg, status_code=422)

    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            msg = "Kein Betrieb im Kontext."
            raise Dac7Error(msg, status_code=403)
        return ctx.tenant_id
