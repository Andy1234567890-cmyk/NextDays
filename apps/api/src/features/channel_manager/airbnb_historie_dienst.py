"""Route-Einstieg: Buchungshistorie EINES Objekts holen — Vorschau und Import.

Zwei Einstiege, weil der Betrieb VOR dem Import wissen muss, worauf er sich
einlässt:

  `airbnb_historie_vorschau` — sagt, welche Etappen der gewählte Zeitraum
      ergibt und wie viele Buchungen dieses Objekt darin hat. Reiner GET, ändert
      nichts. Damit füllt der Dialog seine Zahlen, bevor irgendwas geschrieben
      wird.

  `airbnb_historie_importieren` — fährt dieselben Etappen und übernimmt. Meldet
      je Etappe den Fortschritt, damit die Oberfläche mitlaufen kann statt vor
      einem hängenden Knopf zu stehen (ein Zeitraum 2020–heute sind 27 Etappen).

BEIDE ARBEITEN AUF GENAU EINEM OBJEKT. Der Kanal trägt alle Objekte des Kontos
(live 462 Buchungen über 41 Inserate) — ein Objekt-Import darf davon nur seine
eigenen anfassen. Gefiltert wird auf `properties.airbnb_listing_id`; alles
andere wird gezählt und gemeldet, aber nicht geschrieben.
"""
from __future__ import annotations

from collections.abc import Callable
from datetime import date
from typing import Any

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from .airbnb_historie import EtappenErgebnis, etappen_planen
from .common import ChannelManagerError, log, ota_buchungszeitpunkt

# Kein erfundener Standard-Zeitraum: fehlt eine Angabe, fragt die Oberfläche.
# Ein stillschweigendes „letzte 2 Jahre" ließe Buchungen zurück, ohne dass es
# jemandem auffällt — genau das soll dieser Weg verhindern.


class AirbnbHistorieDienstMixin:
    """Vorschau und Import der Airbnb-Historie eines Objekts."""

    def _historie_kontext(
        self, ctx: AuthContext, property_id: str
    ) -> tuple[Any, str, dict[str, Any], str, str]:
        """Gemeinsame Vorprüfung beider Einstiege.

        Liefert (db, tenant_id, objekt, listing_id, token). Wirft mit klarer
        Begründung, wenn etwas fehlt — nie mit einem Ersatzwert weiterarbeiten.
        """
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]
        # Wurzel 3/9: derselbe Tenant-Scope wie im List-Pfad, gescopt geladen.
        prop = load_scoped(
            db, "properties", property_id, tenant_id,
            columns="id, title, currency, airbnb_listing_id",
            not_found=ChannelManagerError("Objekt nicht gefunden.", status_code=404),
        )
        listing_id = str(prop.get("airbnb_listing_id") or "")
        if not listing_id:
            raise ChannelManagerError(
                "Dieses Objekt ist mit keiner Airbnb-Anzeige verknüpft. Rufe es "
                "zuerst bei Airbnb ab, dann steht die Verknüpfung.",
                status_code=422,
            )
        zugang = self._airbnb_token(db, tenant_id)  # type: ignore[attr-defined]
        if not zugang:
            raise ChannelManagerError(
                "Es ist kein Airbnb-Konto verbunden. Verbinde zuerst Airbnb im "
                "Kanalmanager.",
                status_code=409,
            )
        return db, tenant_id, prop, listing_id, zugang[0]

    @staticmethod
    def _zeitraum(von: str, bis: str) -> tuple[date, date]:
        """Zeitraum der Anfrage prüfen. Ungültiges Datum → 422, kein Ersatz."""
        try:
            return date.fromisoformat(von), date.fromisoformat(bis)
        except ValueError as exc:
            raise ChannelManagerError(
                "Bitte Start und Ende als Datum angeben (JJJJ-MM-TT).",
                status_code=422,
            ) from exc

    def airbnb_historie_vorschau(
        self, ctx: AuthContext, property_id: str, *, von: str, bis: str
    ) -> dict[str, Any]:
        """Was würde dieser Zeitraum bringen? Liest, schreibt nichts.

        Zeigt die Etappen mit Fundzahlen, damit der Betrieb den Umfang sieht,
        bevor er importiert — und sieht, wenn eine Etappe scheitert.
        """
        _db, _tid, prop, listing_id, token = self._historie_kontext(ctx, property_id)
        start, ende = self._zeitraum(von, bis)
        ergebnis = self.airbnb_historie_lesen(  # type: ignore[attr-defined]
            token, listing_id, von=start, bis=ende
        )
        return {
            "property_id": property_id,
            "titel": prop.get("title"),
            "listing_id": listing_id,
            "von": ergebnis.von,
            "bis": ergebnis.bis,
            "etappen": [vars(e) for e in ergebnis.etappen],
            "gefunden": len(ergebnis.buchungen),
            "mit_nachrichten": sum(
                1 for b in ergebnis.buchungen if b.get("thread_id")
            ),
            "fremde": ergebnis.fremde,
            "vollstaendig": ergebnis.vollstaendig,
            "jahre": _jahresverteilung(ergebnis.buchungen),
        }

    def airbnb_historie_importieren(
        self,
        ctx: AuthContext,
        property_id: str,
        *,
        von: str,
        bis: str,
        melden: Callable[[EtappenErgebnis], None] | None = None,
    ) -> dict[str, Any]:
        """Die Historie dieses Objekts holen und übernehmen.

        `vollstaendig: false` heißt: mindestens eine Etappe ist gescheitert, es
        FEHLEN also möglicherweise Buchungen. Die Oberfläche muss das zeigen und
        zum erneuten Lauf auffordern, statt „fertig" zu melden (Wurzel 5).
        """
        db, tenant_id, prop, listing_id, token = self._historie_kontext(
            ctx, property_id
        )
        waehrung = str(prop.get("currency") or "").strip()
        if not waehrung:
            # Wurzel 4: keine Buchung ohne echte Währung schreiben, kein „EUR".
            raise ChannelManagerError(
                "Dem Objekt fehlt die Währung. Trage sie zuerst am Objekt ein, "
                "sonst könnten Beträge falsch übernommen werden.",
                status_code=422,
            )
        start, ende = self._zeitraum(von, bis)

        gelesen = self.airbnb_historie_lesen(  # type: ignore[attr-defined]
            token, listing_id, von=start, bis=ende, melden=melden
        )
        uebernommen = self.airbnb_buchungen_uebernehmen(  # type: ignore[attr-defined]
            db, tenant_id, property_id, gelesen.buchungen, waehrung=waehrung
        )

        log.info(
            "airbnb_historie_import_fertig",
            tenant_id=tenant_id, property_id=property_id,
            listing_id=listing_id, von=gelesen.von, bis=gelesen.bis,
            gelesen=len(gelesen.buchungen), angelegt=uebernommen.angelegt,
            aktualisiert=uebernommen.aktualisiert,
            uebersprungen=uebernommen.uebersprungen,
            vollstaendig=gelesen.vollstaendig,
        )
        return {
            "property_id": property_id,
            "titel": prop.get("title"),
            "listing_id": listing_id,
            "von": gelesen.von,
            "bis": gelesen.bis,
            "etappen": [vars(e) for e in gelesen.etappen],
            "gelesen": len(gelesen.buchungen),
            "angelegt": uebernommen.angelegt,
            "aktualisiert": uebernommen.aktualisiert,
            "uebersprungen": uebernommen.uebersprungen,
            "gruende": uebernommen.gruende,
            "fremde": gelesen.fremde,
            "vollstaendig": gelesen.vollstaendig,
            "fehlgeschlagene_etappen": [
                vars(e) for e in gelesen.fehlgeschlagene
            ],
        }

    def airbnb_historie_etappe(
        self,
        ctx: AuthContext,
        property_id: str,
        *,
        von: str,
        bis: str,
        nummer: int,
        uebernehmen: bool,
        bekannt: list[str] | None = None,
    ) -> dict[str, Any]:
        """GENAU EINE Etappe fahren — der Weg für einen sichtbaren Fortschritt.

        Warum überhaupt einzeln: Ein Zeitraum 2020–heute sind 27 Etappen mit
        rund 60 Aufrufen und über einer Minute Laufzeit. Als EIN Request bleibt
        die Oberfläche so lange stumm — der Betrieb sieht einen Spinner und
        weiß nicht, ob noch etwas passiert. Also holt die Oberfläche Etappe für
        Etappe und zeigt jede Zeile, sobald sie fertig ist.

        `bekannt` sind die Bestätigungscodes der VORHERIGEN Etappen. Ohne sie
        wüsste dieser Aufruf nichts von der Überlappung und meldete dieselbe
        Buchung viermal als „neu" — der Zähler im Dialog wäre schlicht falsch.
        Geschrieben wird trotzdem idempotent (Upsert über den Code), die Liste
        korrigiert also die ANZEIGE, nicht die Wirkung.

        `uebernehmen=False` ist der Vorschau-Modus: nur zählen, nichts
        schreiben. Damit fährt der Dialog dieselbe Kette zweimal — einmal zum
        Zeigen, einmal zum Übernehmen.
        """
        db, tenant_id, prop, listing_id, token = self._historie_kontext(
            ctx, property_id
        )
        start, ende = self._zeitraum(von, bis)
        plan = etappen_planen(start, ende)
        if not 1 <= nummer <= len(plan):
            raise ChannelManagerError(
                f"Etappe {nummer} gibt es in diesem Zeitraum nicht "
                f"({len(plan)} Etappen).",
                status_code=422,
            )
        etappen_start, etappen_ende = plan[nummer - 1]

        waehrung = str(prop.get("currency") or "").strip()
        if uebernehmen and not waehrung:
            raise ChannelManagerError(
                "Dem Objekt fehlt die Währung. Trage sie zuerst am Objekt ein, "
                "sonst könnten Beträge falsch übernommen werden.",
                status_code=422,
            )

        # Nur DIESE eine Etappe lesen: `airbnb_historie_lesen` mit einem
        # Zeitraum, der genau einen Etappen-Start ergibt.
        gelesen = self.airbnb_historie_lesen(  # type: ignore[attr-defined]
            token, listing_id, von=etappen_start, bis=etappen_start
        )
        schon = set(bekannt or [])
        frisch = [
            b for b in gelesen.buchungen
            if str(b.get("confirmation_code") or "") not in schon
        ]

        uebernommen = None
        if uebernehmen and frisch:
            uebernommen = self.airbnb_buchungen_uebernehmen(  # type: ignore[attr-defined]
                db, tenant_id, property_id, frisch, waehrung=waehrung
            )

        etappe = gelesen.etappen[0] if gelesen.etappen else None
        return {
            "nummer": nummer,
            "gesamt": len(plan),
            "von": etappen_start.isoformat(),
            "bis": etappen_ende.isoformat(),
            "gefunden": len(gelesen.buchungen),
            "neu": len(frisch),
            "codes": [
                str(b.get("confirmation_code") or "") for b in gelesen.buchungen
            ],
            "jahre": _jahresverteilung(frisch),
            "mit_nachrichten": sum(1 for b in frisch if b.get("thread_id")),
            "fremde": gelesen.fremde,
            "angelegt": uebernommen.angelegt if uebernommen else 0,
            "aktualisiert": uebernommen.aktualisiert if uebernommen else 0,
            "uebersprungen": uebernommen.uebersprungen if uebernommen else 0,
            "gruende": uebernommen.gruende if uebernommen else [],
            # Wurzel 5: eine gescheiterte Etappe wird benannt, nicht verschluckt
            # — sonst zählt der Dialog munter weiter, obwohl Buchungen fehlen.
            "fehler": etappe.fehler if etappe else None,
        }

    def buchungszeitpunkte_heilen(self, grenze: int = 200) -> dict[str, int]:
        """Fehlende `booked_at` bei ALLEN Tenants nachtragen (Worker-Tick).

        DER GRUND, warum das ein Dauerlauf und keine Einmal-Reparatur ist: Ein
        Zeitpunkt kann aus drei Richtungen fehlen — Buchungen von VOR 0291/0292,
        ein Portal ohne das Feld, oder ein Feed-Eingang, bevor die Anbindung
        stand. In allen drei Fällen zeigte der Posteingang unseren
        Anlagezeitpunkt statt des echten (live: 22 Buchungen aus März/Juni/Juli
        alle als „heute 10:48"). Ein Handlauf heilt das einmal; die nächste
        Buchung ohne Feld steht wieder falsch da. Deshalb heilt das System sich
        selbst.

        Arbeitet je AIRBNB-KANAL, nicht je Buchung: ein Abruf deckt alle
        offenen Zeilen eines Kontos ab (bei 22 offenen sonst 22 Rundreisen).
        Angefasst wird nur, was `booked_at IS NULL` hat — ein vorhandener Wert
        ist der echte und wird nie überschrieben.
        """
        db = self._require_db()  # type: ignore[attr-defined]
        offen = (
            db.table("channex_booking")
            .select("id, tenant_id, ota_reservation_code, ota_name")
            .is_("booked_at", "null")
            .eq("ota_name", "AirBNB")
            .limit(grenze)
            .execute()
        ).data or []
        if not offen:
            return {"geprueft": 0, "gesetzt": 0}

        # Nach Tenant bündeln: der Airbnb-Kanal hängt am Konto, nicht am Objekt.
        je_tenant: dict[str, list[dict[str, Any]]] = {}
        for zeile in offen:
            tid = str(zeile.get("tenant_id") or "")
            if tid:
                je_tenant.setdefault(tid, []).append(zeile)

        gesetzt = 0
        for tenant_id, zeilen in je_tenant.items():
            try:
                gesetzt += self._zeitpunkte_eines_tenants(db, tenant_id, zeilen)
            except (ChannelManagerError, OSError) as exc:
                # Ein Konto ohne Token/Kanal darf die anderen nicht aufhalten;
                # der nächste Tick versucht es erneut (best effort, Wurzel 5:
                # spezifisch gefangen, nicht blind).
                log.warning(
                    "buchungszeitpunkt_heilung_tenant_fehlgeschlagen",
                    tenant_id=tenant_id, error=str(exc)[:200],
                )
        log.info(
            "buchungszeitpunkte_geheilt",
            geprueft=len(offen), gesetzt=gesetzt, tenants=len(je_tenant),
        )
        return {"geprueft": len(offen), "gesetzt": gesetzt}

    def _zeitpunkte_eines_tenants(
        self, db: Any, tenant_id: str, zeilen: list[dict[str, Any]]
    ) -> int:
        """Die offenen Zeitpunkte EINES Kontos beim Portal holen und setzen."""
        zugang = self._airbnb_token(db, tenant_id)  # type: ignore[attr-defined]
        if not zugang:
            return 0
        token = zugang[0]

        # Ein Abruf über den vollen Bestandszeitraum liefert die Zeitpunkte
        # aller Inserate des Kontos auf einmal. Das Listing ist hier egal — wir
        # ordnen über den Bestätigungscode zu, nicht über das Objekt.
        heute = date.today()
        gelesen = self.airbnb_historie_lesen(  # type: ignore[attr-defined]
            token, listing_id="", von=date(heute.year - 6, 1, 1),
            bis=date(heute.year + 2, 12, 31), alle_listings=True,
        )
        zeitpunkt = {
            str(b.get("confirmation_code") or ""): ota_buchungszeitpunkt(b)
            for b in gelesen.buchungen
        }

        gesetzt = 0
        for zeile in zeilen:
            code = str(zeile.get("ota_reservation_code") or "")
            wert = zeitpunkt.get(code)
            if not wert:
                continue
            db.table("channex_booking").update({"booked_at": wert}).eq(
                "id", zeile["id"]
            ).execute()
            (
                db.table("reservations")
                .update({"booked_at": wert})
                .eq("tenant_id", tenant_id)
                .eq("external_ref", code)
                .is_("booked_at", "null")
                .execute()
            )
            gesetzt += 1
        return gesetzt

    def airbnb_buchungszeitpunkte_nachziehen(
        self, ctx: AuthContext, property_id: str
    ) -> dict[str, Any]:
        """`booked_at` für bestehende Buchungen dieses Objekts nachtragen (0291).

        Für alles, was über den Feed hereinkam: dort steht das echte
        Buchungsdatum NICHT drin (Channex' `ota_booked_at` ist leer, live
        geprüft), also zeigte der Posteingang eine Buchung vom 23.03. als
        „heute". Dieser Lauf holt den Zeitpunkt beim Portal nach.

        Angefasst werden NUR Zeilen ohne `booked_at` — ein vorhandener Wert ist
        bereits der echte und wird nicht überschrieben.
        """
        db, tenant_id, prop, listing_id, token = self._historie_kontext(
            ctx, property_id
        )
        offen = (
            db.table("reservations")
            .select("id, external_ref")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .is_("booked_at", "null")
            .execute()
        ).data or []
        if not offen:
            return {"geprueft": 0, "gesetzt": 0, "ohne_datum": 0}

        # Den vollen Zeitraum des Objekts einmal lesen und daraus eine
        # Code→Zeitpunkt-Tabelle bauen: ein Abruf je Etappe statt einer je
        # Buchung (bei 22 offenen Zeilen sonst 22 Rundreisen).
        heute = date.today()
        gelesen = self.airbnb_historie_lesen(  # type: ignore[attr-defined]
            token, listing_id,
            von=date(heute.year - 6, 1, 1), bis=date(heute.year + 2, 12, 31),
        )
        zeitpunkt = {
            str(b.get("confirmation_code") or ""):
                b.get("booked_at") or b.get("created_at")
            for b in gelesen.buchungen
        }

        gesetzt = 0
        for zeile in offen:
            wert = zeitpunkt.get(str(zeile.get("external_ref") or ""))
            if not wert:
                continue
            (
                db.table("reservations")
                .update({"booked_at": wert})
                .eq("tenant_id", tenant_id)
                .eq("id", zeile["id"])
                .execute()
            )
            gesetzt += 1

        # Der Posteingang liest aus `channex_booking`, nicht aus
        # `reservations` (0292) — ohne diesen zweiten Durchgang stünde dort
        # weiter der Feed-Eingang, obwohl die Reservierung schon stimmt.
        for code, wert in zeitpunkt.items():
            if not (code and wert):
                continue
            (
                db.table("channex_booking")
                .update({"booked_at": wert})
                .eq("tenant_id", tenant_id)
                .eq("ota_reservation_code", code)
                .is_("booked_at", "null")
                .execute()
            )

        log.info(
            "airbnb_buchungszeitpunkte_nachgezogen",
            tenant_id=tenant_id, property_id=property_id,
            geprueft=len(offen), gesetzt=gesetzt,
        )
        return {
            "titel": prop.get("title"),
            "geprueft": len(offen),
            "gesetzt": gesetzt,
            # Was das Portal nicht kennt, bleibt leer statt geraten (Wurzel 4).
            "ohne_datum": len(offen) - gesetzt,
        }

    @staticmethod
    def airbnb_historie_etappen_plan(von: str, bis: str) -> list[dict[str, str]]:
        """Nur der Plan, ohne einen einzigen Aufruf bei Airbnb.

        Damit kann die Oberfläche sofort sagen „das werden 27 Etappen", während
        der Nutzer noch am Datum dreht.
        """
        try:
            start, ende = date.fromisoformat(von), date.fromisoformat(bis)
        except ValueError as exc:
            raise ChannelManagerError(
                "Bitte Start und Ende als Datum angeben (JJJJ-MM-TT).",
                status_code=422,
            ) from exc
        return [
            {"nummer": str(i), "von": a.isoformat(), "bis": b.isoformat()}
            for i, (a, b) in enumerate(etappen_planen(start, ende), start=1)
        ]


def _jahresverteilung(buchungen: list[dict[str, Any]]) -> dict[str, int]:
    """Buchungen je Anreisejahr — die Tabelle, die der Dialog vorab zeigt."""
    jahre: dict[str, int] = {}
    for b in buchungen:
        jahr = str(b.get("start_date") or "")[:4]
        if jahr:
            jahre[jahr] = jahre.get(jahr, 0) + 1
    return dict(sorted(jahre.items()))
