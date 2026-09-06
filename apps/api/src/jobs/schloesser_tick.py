"""Tick: Türcodes rechtzeitig anlegen, Codes zurücklesen, Zustand pflegen.

WARUM EIN TICK UND NICHT ALLES BEIM BUCHEN (der Kern von 0573):

Der Zugang ENTSTEHT bei der Buchungsbestätigung — das macht
`reservations.writes` synchron, damit die Buchung sofort einen Datensatz hat.
Aber er wird erst kurz vor Anreise ans SCHLOSS gegeben, standardmäßig
72 Stunden vorher. Dieser Wert ist nicht willkürlich: Hostaway begründet ihn
ausdrücklich damit, dass so genug Zeit für WIEDERHOLVERSUCHE bleibt, falls das
Programmieren beim ersten Mal scheitert (Gerät offline, Speicher voll); Guesty
nennt denselben Wert. Ein Code, der erst beim Check-in erzeugt wird, hat kein
zweites Fenster — und ein Gast, der vor der Tür steht, ruft an.

DREI AUFGABEN, bewusst in einem Job (sie teilen denselben Bestand):

1. ANLEGEN: geplante Zugänge, deren Vorlauf erreicht ist, an Seam geben.
2. ZURÜCKLESEN: bei Salto und igloohome-offline erzeugt das SCHLOSSSYSTEM den
   Code — er ist erst nach dem Anlegen bekannt und muss geholt werden. Wer
   den Code selbst würfelt und sofort verschickt, sendet dort einen falschen.
3. AUFRÄUMEN: abgelaufene Zugänge auf `abgelaufen` setzen. Ohne das bliebe ein
   Code für immer „aktiv" und der PIN-Speicher des Schlosses liefe voll —
   Nuki fasst je Schloss nur 100 bzw. 200 Codes, igloohome 199, und Nuki
   empfiehlt das Aufräumen ausdrücklich als Pflichtbestandteil.

FAIL-CLOSED je Zugang: schlägt einer fehl, bleibt sein Zustand als
`fehlgeschlagen` mit Grund stehen und der Lauf macht weiter. Ein Fehler bei
einem Betrieb darf die Codes aller anderen nicht verhindern.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.features.schloesser.seam_client import (
    SeamFehler,
    SeamNichtKonfiguriert,
)
from src.features.schloesser.service import SchloesserService, als_zeitpunkt
from src.jobs.channex_budget import ChannexBudget
from src.jobs.queue import enqueue

log = get_logger("nextdays.jobs.schloesser_tick")

JOB_TYPE = "schloesser_codes"

# Harte Obergrenze je Lauf (Wurzel 8): der Rest kommt im nächsten Tick. Ohne
# sie könnte ein Nachlauf nach einer Störung hunderte Fremdaufrufe in einem
# Rutsch machen.
#
# 25 und nicht 200, weil dieser Job im FÜNF-MINUTEN-Takt läuft: das sind bis zu
# 300 Fremdaufrufe je Stunde, und Seams Rate-Limits sind nicht dokumentiert.
# Ein Rückstand von 100 Zugängen ist damit in 20 Minuten abgearbeitet — bei
# einem Vorlauffenster von 72 Stunden völlig ausreichend.
_MAX_JE_LAUF = 25


def einreihen(db: Client, bucket: int) -> int:
    """Einen Lauf einreihen (betriebsübergreifend, service_role).

    Der `dedup_key` verhindert, dass zwei Worker-Instanzen denselben Bucket
    doppelt einreihen (Wurzel 2).
    """
    enqueue(db, JOB_TYPE, payload={}, dedup_key=f"schloesser_tick:{bucket}")
    return 1


def handle(
    db: Client, _payload: dict[str, Any], _budget: ChannexBudget | None = None
) -> dict[str, Any]:
    """Worker-Handler des Jobs `schloesser_codes`. Zieht KEIN Channex-Budget."""
    return SchloesserTick(db).lauf()


class SchloesserTick:
    def __init__(self, db: Client) -> None:
        self._db = db

    def lauf(self) -> dict[str, Any]:
        ergebnis: dict[str, Any] = {
            "angelegt": 0,
            "codes_geholt": 0,
            "abgelaufen": 0,
            "fehler": [],
        }
        # Reihenfolge ist Absicht: erst aufräumen (macht Platz im
        # PIN-Speicher), dann anlegen, dann Codes holen.
        ergebnis["abgelaufen"] = self._abgelaufene_schliessen()
        ergebnis["angelegt"] = self._faellige_anlegen(ergebnis["fehler"])
        ergebnis["codes_geholt"] = self._codes_holen(ergebnis["fehler"])
        log.info(
            "schloesser_tick_fertig",
            angelegt=ergebnis["angelegt"],
            codes=ergebnis["codes_geholt"],
            abgelaufen=ergebnis["abgelaufen"],
            fehler=len(ergebnis["fehler"]),
        )
        return ergebnis

    # -- 1) Anlegen --------------------------------------------------------
    def _faellige_anlegen(self, fehler: list) -> int:
        """Geplante Zugänge an Seam geben, deren Vorlauf erreicht ist.

        Der Vorlauf steht je Objekt in `seam_einstellungen.vorlauf_stunden`
        (Standard 72). Weil die Fälligkeit damit objektabhängig ist, wird
        breit vorgefiltert (alles, was in den nächsten 30 Tagen beginnt) und
        die genaue Prüfung je Zeile gemacht — ein SQL-Join über eine
        Einstellung mit Default wäre hier fehleranfälliger als die
        Einzelprüfung.
        """
        jetzt = datetime.now(UTC)
        grenze = (jetzt + timedelta(days=30)).isoformat()
        offen = (
            self._db.table("seam_zugang")
            .select(
                "id, tenant_id, reservation_id, starts_at, status"
            )
            # `fehlgeschlagen` GEHÖRT DAZU — das ist der eigentliche Zweck des
            # 72-Stunden-Vorlaufs. Die erste Fassung filterte nur auf
            # `geplant`, womit ein einmal fehlgeschlagener Zugang NIE wieder
            # versucht wurde: ein Schloss, das im ersten Moment offline war,
            # hätte den Gast ohne Code anreisen lassen — genau der Fall, den
            # der Vorlauf verhindern soll (gefunden im Review, nicht im Test).
            .in_("status", ["geplant", "fehlgeschlagen"])
            .lte("starts_at", grenze)
            .order("starts_at")
            # Breiter holen als _MAX_JE_LAUF: die Fälligkeit hängt am Objekt
            # (`vorlauf_stunden`) und lässt sich nicht in die Query ziehen.
            # Würde hier auf 25 begrenzt, könnten 25 noch-nicht-fällige Zeilen
            # alle Plätze belegen und der Lauf legte dauerhaft NICHTS an
            # (Starvation, ebenfalls ein Review-Fund). Die harte Grenze greift
            # nach der Prüfung, siehe Zähler unten.
            .limit(_MAX_JE_LAUF * 8)
            .execute()
        ).data or []
        gezaehlt = 0
        for zeile in offen:
            # Die harte Obergrenze zählt ANGELEGTE, nicht geprüfte Zeilen
            # (Wurzel 8): sonst verbrauchen nicht-fällige Zeilen die Plätze.
            if gezaehlt >= _MAX_JE_LAUF:
                break
            if not self._ist_faellig(zeile, jetzt):
                continue
            try:
                SchloesserService(self._db).zugang_anlegen(
                    str(zeile["tenant_id"]), str(zeile["id"])
                )
                gezaehlt += 1
                if zeile.get("status") == "fehlgeschlagen":
                    log.info(
                        "schloesser_wiederholung_erfolgreich",
                        zugang_id=str(zeile["id"]),
                    )
            except SeamNichtKonfiguriert as exc:
                # Konfigurationsmangel: EINMAL laut melden und den Lauf
                # abbrechen — jeder weitere Versuch würde denselben Fehler
                # erzeugen. Der Zustand bleibt `geplant`, der nächste Tick
                # holt es nach, sobald die Variable gesetzt ist.
                log.error("schloesser_tick_kein_api_key")
                fehler.append(str(exc))
                break
            except SeamFehler as exc:
                # Der Service hat den Zustand schon auf `fehlgeschlagen`
                # gesetzt; hier nur zählen und weitermachen.
                fehler.append(f"{zeile['id']}: {exc}")
            except Exception as exc:  # noqa: BLE001 - ein Zugang stoppt nicht den Lauf
                log.warning(
                    "schloesser_anlegen_unerwartet",
                    zugang_id=str(zeile["id"]),
                    error=str(exc)[:200],
                )
                fehler.append(f"{zeile['id']}: {exc}")
        return gezaehlt

    def _ist_faellig(self, zeile: dict, jetzt: datetime) -> bool:
        """Ist der Vorlauf dieses Zugangs erreicht?

        Der Vorlauf hängt am Objekt der Buchung. Fehlt die Einstellung, gilt
        der Standard aus 0573 (72 h) — dieselbe Zahl wie in der Migration,
        damit ein Objekt ohne Zeile sich nicht anders verhält.
        """
        beginn = als_zeitpunkt(zeile.get("starts_at"))
        if beginn is None:
            return False
        stunden = self._vorlauf_stunden(str(zeile["reservation_id"]))
        return jetzt >= beginn - timedelta(hours=stunden)

    def _vorlauf_stunden(self, reservation_id: str) -> int:
        """Vorlauf des Objekts dieser Buchung (Standard 72)."""
        res = (
            self._db.table("reservations")
            .select("property_id")
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data or []
        if not res:
            return 72
        zeilen = (
            self._db.table("seam_einstellungen")
            .select("vorlauf_stunden")
            .eq("property_id", str(res[0]["property_id"]))
            .limit(1)
            .execute()
        ).data or []
        if not zeilen or zeilen[0].get("vorlauf_stunden") is None:
            return 72
        return int(zeilen[0]["vorlauf_stunden"])

    # -- 2) Codes zurücklesen ---------------------------------------------
    def _codes_holen(self, fehler: list) -> int:
        """Bei Seam nach dem Code fragen, wo wir noch keinen haben.

        Betrifft Salto (erzeugt den PIN selbst) und igloohome-offline
        (algorithmisch). Solange `code` leer ist, kann keine Anreisemail
        rausgehen — der Platzhalter bleibt leer und der Versand schlägt mit
        `FeldFehlt` fehl, statt einen falschen Code zu verschicken.
        """
        offen = (
            self._db.table("seam_zugang")
            .select("id, tenant_id, seam_grant_id")
            .in_("status", ["angelegt", "aktiv"])
            .is_("code", "null")
            .not_.is_("seam_grant_id", "null")
            .limit(_MAX_JE_LAUF)
            .execute()
        ).data or []
        gezaehlt = 0
        for zeile in offen:
            try:
                ergebnis = SchloesserService(self._db).zugang_aktualisieren(
                    str(zeile["tenant_id"]), str(zeile["id"])
                )
                if ergebnis.get("code"):
                    gezaehlt += 1
            except SeamNichtKonfiguriert:
                log.error("schloesser_tick_kein_api_key")
                break
            except SeamFehler as exc:
                fehler.append(f"{zeile['id']}: {exc}")
            except Exception as exc:  # noqa: BLE001 - Lauf weiterführen
                log.warning(
                    "schloesser_code_holen_unerwartet",
                    zugang_id=str(zeile["id"]),
                    error=str(exc)[:200],
                )
                fehler.append(f"{zeile['id']}: {exc}")
        return gezaehlt

    # -- 3) Aufräumen ------------------------------------------------------
    def _abgelaufene_schliessen(self) -> int:
        """Zugänge, deren Zeitraum vorbei ist, auf `abgelaufen` setzen.

        Rein lokal, kein Fremdaufruf: Seam räumt seine Seite selbst auf, und
        ein abgelaufener Code ist beim Hersteller schon ungültig. Wir ziehen
        nur unseren Zustand nach, damit die Oberfläche nicht dauerhaft
        „aktiv" für einen Aufenthalt von letztem Jahr zeigt.

        `nicht_widerrufbar` wird MITGENOMMEN: genau bei diesen Zeilen ist der
        Ablauf die eigentliche Nachricht („jetzt ist der Code wirklich weg").
        `widerrufen` bleibt unberührt — dieser Zustand ist endgültig.
        """
        jetzt = datetime.now(UTC).isoformat()
        betroffen = (
            self._db.table("seam_zugang")
            .update({"status": "abgelaufen"})
            .in_("status", ["aktiv", "angelegt", "nicht_widerrufbar"])
            .lt("ends_at", jetzt)
            .execute()
        ).data or []
        return len(betroffen)
