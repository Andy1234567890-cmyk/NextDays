"""Taeglicher Lauf: Rasterzellen abrufen und aggregiert ablegen.

Der Lauf ist idempotent (Wurzel 2): dieselbe Zelle am selben Tag zweimal
abgerufen ueberschreibt ihren Wert, statt einen zweiten anzulegen — der
UNIQUE-Index in 0556 ist der Backstop dazu.

Er ist ausserdem teil-tolerant, aber nicht still: faellt eine Zelle aus, laufen
die uebrigen weiter und die Zusammenfassung nennt die Zahl der Fehlschlaege.
Ein Lauf, der nichts geschrieben hat, meldet das als Fehler zurueck — sonst
sieht ein dauerhaft gebrochener Abruf aus wie ein ruhiger Betrieb (Wurzel 5).
"""
from __future__ import annotations

import time
from datetime import UTC, date, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger

from .beobachtung import Zelle, aggregieren, stichtage
from .quelle_airbnb import preise_mit_ort, verfuegbar
from .umgebung import _MAX_ALTER_TAGE

log = get_logger("nextdays.pricing.market.lauf")

_QUELLE = "umgebung"
_ART = "entire_home"

# Pause zwischen zwei Abrufen. Ein Marktbeobachtungslauf ist kein Wettrennen —
# die Daten sind einen Tag gueltig. Die Pause haelt die Last bei der Quelle
# niedrig und den Lauf unauffaellig.
_PAUSE_SEKUNDEN = 3.0

# Obergrenze der Zellen je Lauf (Wurzel 8). Bei 5 Betrieben sind es real
# eine Handvoll; die Grenze faengt ein unerwartetes Wachstum ab, bevor es
# einen stundenlangen Lauf erzeugt.
_MAX_ZELLEN = 50


class MarktBeobachtung:
    """Fuellt `markt_beobachtung` fuer alle Zellen, in denen wir Objekte haben."""

    def __init__(self, service_client: Client) -> None:
        self._db = service_client

    def lauf(self, *, heute: date | None = None) -> dict:
        """Ein kompletter Durchlauf. Rueckgabe ist die Bilanz, nicht nur 'ok'."""
        heute = heute or datetime.now(UTC).date()
        if not verfuegbar():
            log.error("markt_lauf_ohne_quelle")
            return {"ok": False, "grund": "quelle_fehlt", "zellen": 0, "werte": 0}

        zellen = self._zellen_mit_objekten()
        if not zellen:
            log.info("markt_lauf_keine_zellen")
            return {"ok": True, "zellen": 0, "werte": 0, "hinweis": "keine Objekte mit Koordinaten"}

        tage = stichtage(heute)
        geschrieben = 0
        zu_duenn = 0
        fehlschlaege = 0
        kartenpunkte = 0
        for zelle, waehrung in zellen:
            for tag in tage:
                sw_lat, sw_lng, ne_lat, ne_lng = zelle.kasten()
                punkte = preise_mit_ort(sw_lat, sw_lng, ne_lat, ne_lng, tag, waehrung)
                if not punkte:
                    fehlschlaege += 1
                    time.sleep(_PAUSE_SEKUNDEN)
                    continue
                # Karte ZUERST und OHNE Schwelle: jeder beobachtete Preis ist
                # ein Punkt, aus DENSELBEN Daten, kein zweiter Abruf. Die
                # Fuenferschwelle gilt nur fuer den Median darunter — sonst
                # bliebe die Karte an genau den Tagen leer, an denen der
                # Median fehlt, und das war der abgelehnte Zustand.
                kartenpunkte += self._punkte_schreiben(zelle, tag, waehrung, punkte)
                werte = aggregieren([p for p, _la, _lo in punkte])
                if werte is None:
                    zu_duenn += 1
                    time.sleep(_PAUSE_SEKUNDEN)
                    continue
                if self._speichern(zelle, tag, waehrung, werte):
                    geschrieben += 1
                time.sleep(_PAUSE_SEKUNDEN)

        verfallen = self._verfallenes_aufraeumen(heute)

        bilanz = {
            "ok": geschrieben > 0,
            "zellen": len(zellen),
            "stichtage": len(tage),
            "werte": geschrieben,
            "kartenpunkte": kartenpunkte,
            "zu_duenn": zu_duenn,
            "fehlschlaege": fehlschlaege,
            "verfallen": verfallen,
        }
        # Ein Lauf ohne einen einzigen Wert ist ein Ausfall, kein Erfolg.
        if geschrieben == 0:
            log.error("markt_lauf_ohne_ergebnis", **bilanz)
        else:
            log.info("markt_lauf_fertig", **bilanz)
        return bilanz

    def _zellen_mit_objekten(self) -> list[tuple[Zelle, str]]:
        """Die Rasterzellen, fuer die beobachtet wird — je mit ihrer Waehrung.

        NUR Objekte mit AKTIVER Marktregel (`dp_settings.market_enabled`):
        fuer ein Objekt, das die Regel nicht nutzt, waere der taegliche Abruf
        Last ohne Zweck. Schaltet ein Betrieb die Regel ein, ist seine Zelle am
        naechsten Tag dabei.

        Mehrere Objekte in derselben Zelle ergeben EINEN Abruf — das ist der
        Grund fuer das Raster.

        Waehrungen: liegen in einer Zelle Objekte verschiedener Waehrungen
        (Grenzregion), wird je Waehrung einmal abgerufen — ein Median in der
        falschen Waehrung waere ein grob falscher Faktor (Wurzel 4).
        """
        try:
            aktive = (
                self._db.table("dp_settings")
                .select("property_id")
                .eq("market_enabled", True)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001
            log.error("markt_lauf_regeln_unlesbar", fehler=str(exc)[:200])
            return []
        ids = [str(r["property_id"]) for r in aktive if r.get("property_id")]
        if not ids:
            log.info("markt_lauf_keine_aktive_regel")
            return []
        try:
            rows = (
                self._db.table("properties")
                .select("lat, lng, currency")
                .in_("id", ids)
                .eq("status", "active")
                .is_("archived_at", "null")
                .not_.is_("lat", "null")
                .not_.is_("lng", "null")
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001
            log.error("markt_lauf_objekte_unlesbar", fehler=str(exc)[:200])
            return []

        gesehen: set[tuple[float, float, str]] = set()
        raus: list[tuple[Zelle, str]] = []
        for r in rows:
            waehrung = (r.get("currency") or "").strip().upper()
            if not waehrung:
                continue
            try:
                zelle = Zelle.fuer(float(r["lat"]), float(r["lng"]))
            except (TypeError, ValueError):
                continue
            schluessel = (zelle.lat, zelle.lng, waehrung)
            if schluessel in gesehen:
                continue
            gesehen.add(schluessel)
            raus.append((zelle, waehrung))
        return raus[:_MAX_ZELLEN]

    def _verfallenes_aufraeumen(self, heute: date) -> int:
        """Zeilen loeschen, die aelter sind als `_MAX_ALTER_TAGE` (Wurzel 1).

        Der Lauf schreibt je Tag 23 STICHTAGE; morgen sind es 23 andere
        (heute+7 ist morgen heute+6 und kein Stichtag mehr). Das Abraeumen in
        `_punkte_schreiben` trifft nur denselben Stichtag — die Zeilen der
        gestrigen Stichtage bleiben liegen. Ohne diesen Schritt wuechse
        `markt_punkt` je Zelle um rund 2 500 Zeilen pro Tag, unbegrenzt, und
        kein Leser kaeme je an sie heran: der Verfall in `umgebung`/`stand`
        blendet Zeilen ueber `_MAX_ALTER_TAGE` ohnehin aus.

        Derselbe Schritt raeumt den Altbestand aus der Zellengroesse VOR dem
        04.09.2026 (0,25 statt 0,45 Grad) ab: dessen Zellkoordinaten findet
        `Zelle.fuer()` nicht mehr, die Zeilen waeren sonst fuer immer
        unerreichbar. Migration 0559 loescht sie sofort; dieser Verfall ist der
        Backstop, falls sie nicht eingespielt wird.

        Rueckgabe: geloeschte Zeilen ueber beide Tabellen (best-effort, laut).
        """
        grenze = (
            datetime.combine(heute, datetime.min.time(), tzinfo=UTC)
            - timedelta(days=_MAX_ALTER_TAGE)
        ).isoformat()
        geloescht = 0
        for tabelle in ("markt_beobachtung", "markt_punkt"):
            try:
                res = (
                    self._db.table(tabelle)
                    .delete()
                    .eq("quelle", _QUELLE)
                    .lt("abgerufen_am", grenze)
                    .execute()
                )
                geloescht += len(res.data or [])
            except Exception as exc:  # noqa: BLE001 — Aufraeumen darf den Lauf nicht kippen
                log.warning(
                    "markt_lauf_verfall_fehlgeschlagen",
                    tabelle=tabelle,
                    fehler=str(exc)[:200],
                )
        if geloescht:
            log.info("markt_lauf_verfall", zeilen=geloescht, grenze=grenze)
        return geloescht

    def _punkte_schreiben(
        self,
        zelle: Zelle,
        tag: date,
        waehrung: str,
        punkte: list[tuple[float, float, float]],
    ) -> int:
        """Alle beobachteten Preise des Tages als Kartenpunkte ablegen.

        Anders als der Median (der den Preisfaktor traegt) wird hier NICHT
        aggregiert und keine Mindestzahl verlangt: die Karte soll zeigen, was
        in der Region wirklich verlangt wird. Ein Raster darueberzulegen hat
        sich als falsch erwiesen — in duenn besiedelten Ferienregionen fielen
        dabei fast alle Objekte unter die Gruppenschwelle und die Karte blieb
        leer (gemessen 04.09.2026: 15 Objekte auf fuenf Teilgebiete mit
        4/3/3/3/2 Haeusern, kein einziges sichtbar).

        Gespeichert werden nur Ort und Preis, nie Name oder ID — aus diesen
        Zeilen laesst sich keine Wettbewerberliste rekonstruieren.

        Wurzel 1/2: der Tag wird VOR dem Schreiben abgeraeumt. Sonst wuechse
        die Tabelle bei jedem taeglichen Lauf um denselben Bestand, und
        abgemeldete Angebote blieben ewig auf der Karte stehen. Stichtage, die
        morgen keine mehr sind, raeumt `_verfallenes_aufraeumen` ab.

        Loeschen und Einfuegen sind zwei Aufrufe, keine Transaktion: reisst
        der Lauf dazwischen ab, fehlt dieser Tag bis zum naechsten Lauf. Das
        ist sichtbar (leere Karte fuer EINEN Stichtag) und heilt sich selbst —
        ein UNIQUE-Upsert ginge nicht, weil ein Ort mehrere Angebote tragen
        kann (siehe 0558).
        """
        if not punkte:
            return 0
        try:
            (
                self._db.table("markt_punkt")
                .delete()
                .eq("zelle_lat", zelle.lat)
                .eq("zelle_lng", zelle.lng)
                .eq("tag", tag.isoformat())
                .eq("objekt_art", _ART)
                .eq("quelle", _QUELLE)
                .eq("waehrung", waehrung)
                .execute()
            )
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "markt_lauf_punkte_aufraeumen_fehlgeschlagen",
                tag=tag.isoformat(),
                fehler=str(exc)[:200],
            )
            return 0
        jetzt = datetime.now(UTC).isoformat()
        zeilen = [
            {
                "zelle_lat": zelle.lat,
                "zelle_lng": zelle.lng,
                "tag": tag.isoformat(),
                "objekt_art": _ART,
                # Auf ~100 m gerundet: genau genug fuer die Karte, zu grob fuer
                # eine Adresse.
                "lat": round(lat, 3),
                "lng": round(lng, 3),
                "preis": round(preis, 2),
                "waehrung": waehrung,
                "quelle": _QUELLE,
                "abgerufen_am": jetzt,
            }
            for preis, lat, lng in punkte
        ]
        try:
            self._db.table("markt_punkt").insert(zeilen).execute()
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "markt_lauf_punkte_fehlgeschlagen",
                tag=tag.isoformat(),
                fehler=str(exc)[:200],
            )
            return 0
        return len(zeilen)

    def _speichern(
        self, zelle: Zelle, tag: date, waehrung: str, werte: dict[str, float]
    ) -> bool:
        try:
            self._db.table("markt_beobachtung").upsert(
                {
                    "zelle_lat": zelle.lat,
                    "zelle_lng": zelle.lng,
                    "tag": tag.isoformat(),
                    "objekt_art": _ART,
                    "median_preis": werte["median"],
                    "p25_preis": werte["p25"],
                    "p75_preis": werte["p75"],
                    "anzahl": int(werte["anzahl"]),
                    "waehrung": waehrung,
                    "quelle": _QUELLE,
                    "abgerufen_am": datetime.now(UTC).isoformat(),
                },
                on_conflict="zelle_lat,zelle_lng,tag,objekt_art,quelle",
            ).execute()
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "markt_lauf_speichern_fehlgeschlagen",
                tag=tag.isoformat(),
                fehler=str(exc)[:200],
            )
            return False
        return True
