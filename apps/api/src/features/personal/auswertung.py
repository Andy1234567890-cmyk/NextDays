"""Auswertung & Lohnvorbereitung (0541, Etappe 5): Stunden, Zuschläge,
Abwesenheiten, Kosten je Objekt (inkl. Fremdfirmen), DATEV-Lohnimport.

Grundsatz (E4): hier wird VORBEREITET, nicht abgerechnet. Keine Steuer, kein
Netto. Fehlende Voraussetzungen (Stundenlohn ohne Währung, Regeln nicht
bestätigt, Lohnart nicht zugeordnet) werden als Hinweise BENANNT und machen
den Export unmöglich — nie eine stille 0 (Wurzel 4/5).

DATEV: Lohnbuchhaltung-Bewegungsdaten als ASCII-Import (Semikolon, CP1252,
ein Satz je Person und Lohnart mit Stunden/Tagen). Berater-/Mandantennummer und
die Lohnarten-Nummern kommen aus den Betriebsregeln — es gibt kein „übliches"
Mapping, das wir erfinden dürften.
"""

from __future__ import annotations

import csv
import io
from datetime import UTC, date, datetime, timedelta
from typing import Any

from src.core.security import AuthContext

from . import regelwerk as rw
from ._base import PLANBARE_ROLLEN, PersonalBase, PersonalError, als_dec, als_dt, log
from .schemas import (
    MAX_ZEITRAUM_TAGE,
    AuswertungResponse,
    LohnExportRequest,
    ObjektKosten,
    PersonAuswertung,
)

_AKTIVE_SCHICHT = ("entwurf", "veroeffentlicht", "bestaetigt")
_ZEIT_GUELTIG = ("abgeschlossen", "bestaetigt")
_LOHNART_PFLICHT = ("grundlohn", "nacht", "sonntag", "feiertag", "ueberstunden", "urlaub", "krank")


def kosten_satz(
    akte: dict[str, Any], firma: dict[str, Any] | None
) -> tuple[int | None, str | None]:
    """Stundensatz in Minor + Währung — EINE Wahrheit für alle Pakete (Vertrag §0).

    Angestellte: `stundenlohn_minor`; fehlt er, wird er aus einem Monatsgehalt
    abgeleitet (`gehalt_minor / (wochenstunden × 52/12)`), weil eine Vollzeit-
    kraft mit Festgehalt sonst als „ohne Lohn" gälte. Externe: der Satz der
    Fremdfirma, aber NUR bei `abrechnung='je_stunde'` — eine Pauschale ist kein
    Stundensatz und darf nicht als einer verrechnet werden.

    Ohne Währung gibt es keinen Betrag: `(None, None)`, nie ein Ersatzwert
    (Wurzel 4). Der Aufrufer macht daraus einen Hinweis, keine 0.
    """
    if akte.get("beschaeftigungsart") == "extern":
        if firma and firma.get("abrechnung") == "je_stunde" and firma.get("satz_minor") is not None:
            return int(firma["satz_minor"]), firma.get("currency")
        return None, None
    if not akte.get("currency"):
        return None, None
    waehrung = str(akte["currency"])
    if akte.get("stundenlohn_minor") is not None:
        return int(akte["stundenlohn_minor"]), waehrung
    gehalt, wochenstunden = akte.get("gehalt_minor"), akte.get("wochenstunden")
    if gehalt is not None and wochenstunden:
        monatsstunden = float(wochenstunden) * 52 / 12
        if monatsstunden > 0:
            return round(int(gehalt) / monatsstunden), waehrung
    return None, None


def arbeitgeber_satz(
    akte: dict[str, Any], firma: dict[str, Any] | None
) -> tuple[int | None, str | None]:
    """Wie `kosten_satz`, zusätzlich der Arbeitgeberaufschlag (Vertrag §2.1)."""
    satz, waehrung = kosten_satz(akte, firma)
    if satz is None:
        return None, None
    aufschlag = akte.get("arbeitgeber_aufschlag_pct")
    if aufschlag:
        satz = round(satz * (1 + float(aufschlag) / 100))
    return satz, waehrung


def _kosten_einer_person(  # noqa: PLR0913 — Grundzeit plus vier Zuschlagsarten
    satz: int | None,
    regeln: rw.Regeln | None,
    *,
    ist: int,
    nacht: int,
    sonntag: int,
    feiertag: int,
    ueber: int,
) -> int | None:
    """Personalkosten in Minor — Grundzeit plus vier Zuschlaege.

    Herausgezogen am 10.09.2026 aus `AuswertungService.auswerten`. `None`
    statt 0, wenn der Satz fehlt: eine 0 hiesse „diese Person kostet nichts"
    und summierte sich stillschweigend in die Gesamtkosten (Wurzel 4). Der
    Aufrufer benennt die Person stattdessen im Hinweis.
    """
    if satz is None or regeln is None:
        return None
    kosten = round(satz * ist / 60)
    kosten += rw.zuschlag_betrag_minor(satz, nacht, regeln.zuschlag_nacht_pct)
    kosten += rw.zuschlag_betrag_minor(satz, sonntag, regeln.zuschlag_sonntag_pct)
    kosten += rw.zuschlag_betrag_minor(satz, feiertag, regeln.zuschlag_feiertag_pct)
    kosten += rw.zuschlag_betrag_minor(satz, ueber, regeln.zuschlag_ueberstunden_pct)
    return kosten


class AuswertungService(PersonalBase):
    def auswerten(  # noqa: PLR0912, PLR0915 — eine Auswertung mit allen Größen
        self,
        ctx: AuthContext,
        von: date,
        bis: date,
        *,
        user_ids: set[str] | None = None,
        nur_bestaetigt: bool = False,
    ) -> AuswertungResponse:
        tenant_id = self._require_tenant(ctx)
        if bis < von or (bis - von).days > MAX_ZEITRAUM_TAGE:
            raise PersonalError("Ungültiger Zeitraum.", status_code=422)
        hinweise: list[str] = []
        regeln: rw.Regeln | None
        try:
            regeln = self._regeln(tenant_id)
        except PersonalError as exc:
            regeln = None
            hinweise.append(exc.message)
        ids = self._personen_im_scope(ctx, tenant_id)
        if user_ids is not None:
            ids &= user_ids
        users = {
            str(u["id"]): u
            for u in self._users(tenant_id, ids)
            if str(u.get("role")) in PLANBARE_ROLLEN
        }
        akten = self._akten(tenant_id, set(users))
        firmen = self._firmen(tenant_id)
        feiertage: set[date] = set()
        if regeln is not None:
            try:
                feiertage = set(self._feiertage(tenant_id, von, bis))
            except PersonalError as exc:
                hinweise.append(exc.message)
        zeiten = self._zeiten(tenant_id, set(users), von, bis, nur_bestaetigt=nur_bestaetigt)
        schichten = self._schichten(tenant_id, set(users), von, bis)
        abwesenheiten = self._abwesenheiten(tenant_id, set(users), von, bis)
        titel = self._property_titel(
            tenant_id, {str(z["property_id"]) for z in zeiten if z.get("property_id")}
        )
        personen: list[PersonAuswertung] = []
        objekte: dict[str, dict[str, Any]] = {}
        ohne_lohn: list[str] = []
        for uid, u in sorted(
            users.items(), key=lambda kv: (str(kv[1].get("full_name") or "").casefold(), kv[0])
        ):
            akte = akten.get(uid) or {}
            extern = akte.get("beschaeftigungsart") == "extern"
            firma = firmen.get(str(akte.get("firma_id") or ""))
            ist = nacht = sonntag = feiertag = 0
            for z in zeiten:
                if str(z["user_id"]) != uid:
                    continue
                s, e = als_dt(z["start_at"]), als_dt(z.get("end_at"))
                if s is None or e is None:
                    continue
                pause = rw.pausen_minuten(list(z.get("pausen") or []))
                if regeln is not None:
                    zs = rw.zuschlaege_berechnen(s, e, pause, regeln=regeln, feiertage=feiertage)
                    netto, nacht_, sonn_, feier_ = (
                        zs.netto_min,
                        zs.nacht_min,
                        zs.sonntag_min,
                        zs.feiertag_min,
                    )
                else:
                    netto, nacht_, sonn_, feier_ = rw.netto_minuten(s, e, pause), 0, 0, 0
                ist += netto
                nacht += nacht_
                sonntag += sonn_
                feiertag += feier_
                # Kosten je Objekt: Stundenlohn der Person bzw. Satz der Firma.
                pid = str(z.get("property_id") or "")
                eintrag = objekte.setdefault(
                    pid, {"minuten": 0, "kosten": 0, "fremd": 0, "currency": None}
                )
                eintrag["minuten"] += netto
                satz, waehrung = self._satz(akte, firma)
                if satz is not None:
                    betrag = round(satz * netto / 60)
                    eintrag["kosten"] += betrag
                    if extern:
                        eintrag["fremd"] += betrag
                    if eintrag["currency"] not in (None, waehrung):
                        hinweise.append(
                            f"Objekt {titel.get(pid, pid) or '—'}: gemischte Währungen."
                        )
                    eintrag["currency"] = eintrag["currency"] or waehrung
            plan = sum(
                rw.netto_minuten(
                    als_dt(s["start_at"]), als_dt(s["end_at"]), int(s.get("pause_min") or 0)
                )  # type: ignore[arg-type]
                for s in schichten
                if str(s.get("user_id") or "") == uid and s.get("status") in _AKTIVE_SCHICHT
            )
            soll = self._soll_minuten(akte, von, bis, feiertage)
            ueber = max(0, ist - soll) if soll and not extern else 0
            abw: dict[str, float] = {}
            for a in abwesenheiten:
                if str(a["user_id"]) == uid and a.get("status") == "genehmigt":
                    abw[str(a["art"])] = abw.get(str(a["art"]), 0) + float(
                        als_dec(a.get("tage_berechnet"))
                    )
            satz, waehrung = self._satz(akte, firma)
            kosten = _kosten_einer_person(
                satz, regeln,
                ist=ist, nacht=nacht, sonntag=sonntag,
                feiertag=feiertag, ueber=ueber,
            )
            if satz is None and ist > 0:
                ohne_lohn.append(str(u.get("full_name") or uid))
            personen.append(
                PersonAuswertung(
                    user_id=uid,
                    full_name=u.get("full_name"),
                    beschaeftigungsart=akte.get("beschaeftigungsart"),
                    firma_name=(firma or {}).get("name"),
                    soll_minuten=soll,
                    plan_minuten=plan,
                    ist_minuten=ist,
                    nacht_minuten=nacht,
                    sonntag_minuten=sonntag,
                    feiertag_minuten=feiertag,
                    ueberstunden_minuten=ueber,
                    abwesenheit_tage=abw,
                    kosten_minor=kosten,
                    currency=waehrung if kosten is not None else None,
                )
            )
        if ohne_lohn:
            hinweise.append(
                f"Ohne Stundenlohn/Satz (keine Kosten gerechnet): {', '.join(sorted(ohne_lohn))}."
            )
        objekt_liste = [
            ObjektKosten(
                property_id=pid or None,
                property_title=titel.get(pid) if pid else None,
                minuten=int(e["minuten"]),
                kosten_minor=int(e["kosten"]),
                currency=e["currency"],
                fremd_minor=int(e["fremd"]),
            )
            for pid, e in sorted(objekte.items(), key=lambda kv: -kv[1]["minuten"])
        ]
        return AuswertungResponse(
            von=von, bis=bis, personen=personen, objekte=objekt_liste, hinweise=hinweise
        )

    @staticmethod
    def _satz(akte: dict[str, Any], firma: dict[str, Any] | None) -> tuple[int | None, str | None]:
        """Alias auf `kosten_satz` — die Auswertung rechnet ohne Arbeitgeberaufschlag
        (sie bereitet den LOHN vor, nicht die Vollkosten)."""
        return kosten_satz(akte, firma)

    def _soll_minuten(
        self, akte: dict[str, Any], von: date, bis: date, feiertage: set[date]
    ) -> int:
        """Sollstunden im Zeitraum aus Wochenstunden × Arbeitstagen (ohne Feiertage)."""
        wochenstunden = akte.get("wochenstunden")
        if wochenstunden is None:
            return 0
        arbeitstage = self._arbeitstage(akte)
        tage = rw.arbeitstage_zaehlen(von, bis, arbeitstage=arbeitstage, feiertage=feiertage)
        je_tag = float(wochenstunden) * 60 / max(1, len(arbeitstage))
        return round(tage * je_tag)

    def _firmen(self, tenant_id: str) -> dict[str, dict[str, Any]]:
        rows = (
            self._db.table("personal_fremdfirmen")
            .select("*")
            .eq("tenant_id", tenant_id)
            .execute()
            .data
            or []
        )
        return {str(r["id"]): r for r in rows}

    def _zeiten(  # noqa: PLR0913 — Zeitraum, Personen und die Statusfrage
        self,
        tenant_id: str,
        ids: set[str],
        von: date,
        bis: date,
        *,
        nur_bestaetigt: bool = False,
    ) -> list[dict[str, Any]]:
        if not ids:
            return []
        gueltig = ("bestaetigt",) if nur_bestaetigt else _ZEIT_GUELTIG
        rows = (
            self._db.table("personal_zeiterfassung")
            .select("user_id, start_at, end_at, pausen, property_id, status")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .gte("start_at", datetime.combine(von, datetime.min.time(), UTC).isoformat())
            .lt(
                "start_at",
                datetime.combine(bis + timedelta(days=1), datetime.min.time(), UTC).isoformat(),
            )
            .execute()
        ).data or []
        return [r for r in rows if r.get("status") in gueltig]

    def _schichten(
        self, tenant_id: str, ids: set[str], von: date, bis: date
    ) -> list[dict[str, Any]]:
        if not ids:
            return []
        return (
            self._db.table("personal_schichten")
            .select("user_id, start_at, end_at, pause_min, status")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .gte("datum", von.isoformat())
            .lte("datum", bis.isoformat())
            .execute()
        ).data or []

    def _abwesenheiten(
        self, tenant_id: str, ids: set[str], von: date, bis: date
    ) -> list[dict[str, Any]]:
        if not ids:
            return []
        return (
            self._db.table("personal_abwesenheiten")
            .select("user_id, art, status, tage_berechnet, von, bis")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .lte("von", bis.isoformat())
            .gte("bis", von.isoformat())
            .execute()
        ).data or []

    # ------------------------------------------------------------------
    # Lohnexport
    # ------------------------------------------------------------------

    def lohnexport(
        self, ctx: AuthContext, req: LohnExportRequest, *, nur_bestaetigt: bool = False
    ) -> tuple[str, bytes, str]:
        """(Dateiname, Inhalt, MIME). Verweigert mit 422, wenn Voraussetzungen fehlen.

        `nur_bestaetigt=True` nimmt AUSSCHLIESSLICH bestätigte Zeiten (der Weg
        des Lohnlaufs, §4.3: „nur freigegebene Zeiten"); der freie Export nimmt
        auch abgeschlossene, damit eine Vorschau möglich bleibt.
        """
        tenant_id = self._require_tenant(ctx)
        regeln_row = self._regeln_row(tenant_id) or {}
        von = date(req.jahr, req.monat, 1)
        bis = date(req.jahr + (req.monat == 12), (req.monat % 12) + 1, 1) - timedelta(days=1)
        auswertung = self.auswerten(ctx, von, bis, nur_bestaetigt=nur_bestaetigt)
        if auswertung.hinweise and any(
            "Regeln" in h or "Feiertage" in h for h in auswertung.hinweise
        ):
            raise PersonalError(
                "Export nicht möglich.", status_code=422, details={"hinweise": auswertung.hinweise}
            )
        akten = self._akten(tenant_id, {p.user_id for p in auswertung.personen})
        if req.format == "csv":
            return self._csv(auswertung, akten, von)
        lohnarten = dict(regeln_row.get("lohnarten") or {})
        fehlende = [k for k in _LOHNART_PFLICHT if not lohnarten.get(k)]
        berater, mandant = regeln_row.get("datev_berater_nr"), regeln_row.get("datev_mandanten_nr")
        probleme: list[str] = []
        if not berater or not mandant:
            probleme.append("DATEV-Berater- und Mandantennummer fehlen in den Betriebsregeln.")
        if fehlende:
            probleme.append("Lohnarten nicht zugeordnet: " + ", ".join(fehlende) + ".")
        ohne_nr = [
            p.full_name or p.user_id
            for p in auswertung.personen
            if p.beschaeftigungsart != "extern"
            and (p.ist_minuten > 0 or p.abwesenheit_tage)
            and not (akten.get(p.user_id) or {}).get("employee_number")
        ]
        if ohne_nr:
            probleme.append("Ohne Personalnummer: " + ", ".join(ohne_nr) + ".")
        if probleme:
            raise PersonalError(
                "DATEV-Export nicht möglich.", status_code=422, details={"hinweise": probleme}
            )
        return self._datev_lodas(auswertung, akten, lohnarten, str(berater), str(mandant), von)

    @staticmethod
    def _csv(
        auswertung: AuswertungResponse, akten: dict[str, dict[str, Any]], von: date
    ) -> tuple[str, bytes, str]:
        puffer = io.StringIO()
        w = csv.writer(puffer, delimiter=";")
        w.writerow(
            [
                "personalnummer",
                "name",
                "beschaeftigungsart",
                "firma",
                "soll_std",
                "ist_std",
                "nacht_std",
                "sonntag_std",
                "feiertag_std",
                "ueberstunden_std",
                "urlaub_tage",
                "krank_tage",
                "unbezahlt_tage",
                "kosten",
                "waehrung",
            ]
        )
        for p in auswertung.personen:
            a = akten.get(p.user_id) or {}
            w.writerow(
                [
                    a.get("employee_number") or "",
                    p.full_name or "",
                    p.beschaeftigungsart or "",
                    p.firma_name or "",
                    _std(p.soll_minuten),
                    _std(p.ist_minuten),
                    _std(p.nacht_minuten),
                    _std(p.sonntag_minuten),
                    _std(p.feiertag_minuten),
                    _std(p.ueberstunden_minuten),
                    _tage(p.abwesenheit_tage.get("urlaub")),
                    _tage(
                        p.abwesenheit_tage.get("krank", 0) + p.abwesenheit_tage.get("kind_krank", 0)
                    ),
                    _tage(p.abwesenheit_tage.get("unbezahlt")),
                    f"{p.kosten_minor / 100:.2f}".replace(".", ",")
                    if p.kosten_minor is not None
                    else "",
                    p.currency or "",
                ]
            )
        name = f"lohnvorbereitung-{von.strftime('%Y-%m')}.csv"
        return name, puffer.getvalue().encode("utf-8-sig"), "text/csv; charset=utf-8"

    @staticmethod
    def _datev_lodas(  # noqa: PLR0913 — der Satzaufbau braucht alle Kennungen
        auswertung: AuswertungResponse,
        akten: dict[str, dict[str, Any]],
        lohnarten: dict[str, str],
        berater: str,
        mandant: str,
        von: date,
    ) -> tuple[str, bytes, str]:
        """LODAS-Importdatei „Bewegungsdaten": Kopf mit Berater/Mandant/Abrechnungs-
        monat, dann je Person und Lohnart ein Satz (Personalnummer;Lohnart;Wert).

        Der Aufbau folgt der DATEV-Dokumentation „LODAS Lohn Import — Bewegungs-
        daten" (Satzbeschreibung `[Bewegungsdaten]`, Felder pnr, la, bs, wert).
        Zeiten in Stunden mit zwei Nachkommastellen und Komma, Tage ebenso.
        """
        zeilen = [
            "[Allgemein]",
            "Ziel=LODAS",
            "Version_SST=1.0",
            f"BeraterNr={berater}",
            f"MandantenNr={mandant}",
            f"Datum={datetime.now(UTC).strftime('%d.%m.%Y')}",
            'StringBegrenzer="',
            "Kommentarzeichen=*",
            "Feldtrenner=;",
            "Zahlenkomma=,",
            "Datumsformat=TT.MM.JJJJ",
            "",
            "[Satzbeschreibung]",
            "100;u_lod_bwd_buchung_standard;pnr#psd;abrechnung_zeitraum#bwd;"
            "la_eigene#bwd;bs_wert_butab#bwd;",
            "",
            "[Bewegungsdaten]",
        ]
        zeitraum = von.strftime("01.%m.%Y")
        for p in auswertung.personen:
            if p.beschaeftigungsart == "extern":
                continue
            pnr = str((akten.get(p.user_id) or {}).get("employee_number") or "")
            werte = [
                ("grundlohn", _std(p.ist_minuten - p.ueberstunden_minuten)),
                ("nacht", _std(p.nacht_minuten)),
                ("sonntag", _std(p.sonntag_minuten)),
                ("feiertag", _std(p.feiertag_minuten)),
                ("ueberstunden", _std(p.ueberstunden_minuten)),
                ("urlaub", _tage(p.abwesenheit_tage.get("urlaub"))),
                (
                    "krank",
                    _tage(
                        p.abwesenheit_tage.get("krank", 0) + p.abwesenheit_tage.get("kind_krank", 0)
                    ),
                ),
            ]
            for schluessel, wert in werte:
                if wert in ("0,00", ""):
                    continue
                zeilen.append(f"100;{pnr};{zeitraum};{lohnarten[schluessel]};{wert};")
        name = f"datev-lodas-{von.strftime('%Y-%m')}.txt"
        inhalt = ("\r\n".join(zeilen) + "\r\n").encode("cp1252", errors="replace")
        log.info(
            "personal_datev_export",
            monat=von.strftime("%Y-%m"),
            personen=len(auswertung.personen),
            zeilen=len(zeilen),
        )
        return name, inhalt, "text/plain; charset=windows-1252"


def _std(minuten: int) -> str:
    return f"{minuten / 60:.2f}".replace(".", ",")


def _tage(wert: float | None) -> str:
    return f"{float(wert or 0):.2f}".replace(".", ",")
