"""Lohnlauf mit Statuskette und Monatsabschluss-Assistent (0547, Vertrag §4.3).

Bis 0547 war der Lohnexport ein Knopf ohne Zustand: wer wann exportiert hatte,
stand nirgends, und ob alle Zeiten bestätigt und alle Monate abgeschlossen
waren, prüfte niemand — der Fehler fiel erst im Lohnprogramm auf.

Der Lohnlauf macht den Monat zu einem Vorgang mit gerichteter Kette:

    entwurf ──pruefen(ohne Fehler)──▶ geprueft ──freigeben──▶ freigegeben
                                                                   │
                       zuruecksetzen(Grund) ◀── exportiert ◀──exportieren

Die Richtung steckt zusätzlich im DB-Constraint `personal_lohnlaeufe_kette`
(0547): `freigegeben` ohne `geprueft_am` lässt die Datenbank nicht zu. Beide
Wege prüfen dasselbe — der Constraint ist der Backstop gegen den Direktpfad
(Wurzel 6), die Dienstprüfung liefert die verständliche Meldung.

Idempotenz (Wurzel 2): `anlegen` gibt einen vorhandenen Lauf zurück (200), statt
einen zweiten anzulegen — der UNIQUE-Index `(tenant_id, jahr, monat)` ist der
Backstop, wenn zwei Klicks gleichzeitig ankommen.

Exportiert werden AUSSCHLIESSLICH bestätigte Zeiten
(`lohnexport(nur_bestaetigt=True)`): eine abgeschlossene, aber unbestätigte
Stempelung ist eine Behauptung, keine Grundlage für eine Lohnzahlung.
"""

from __future__ import annotations

import base64
from datetime import UTC, date, datetime, timedelta
from typing import Any

from postgrest.exceptions import APIError

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from ._base import LEITUNG, PLANBARE_ROLLEN, PersonalBase, PersonalError, als_dt, log
from .auswertung import AuswertungService, kosten_satz
from .berichte_schemas import (
    Lohnlauf,
    LohnlaufCreate,
    LohnlaufExport,
    LohnlaufExportResponse,
    LohnlaufZuruecksetzen,
    Pruefung,
    Pruefungen,
)
from .schemas import LohnExportRequest

_UNIQUE_VERLETZUNG = "23505"
_LOHNART_PFLICHT = ("grundlohn", "nacht", "sonntag", "feiertag", "ueberstunden", "urlaub", "krank")
_AKTIVE_SCHICHT = ("entwurf", "veroeffentlicht", "bestaetigt")


class LohnlaufService(PersonalBase):
    """Der Vorgang „Monat abrechnen": anlegen, prüfen, freigeben, exportieren."""

    # ------------------------------------------------------------------
    # Rechte
    # ------------------------------------------------------------------

    def _require_leitung(self, ctx: AuthContext, tenant_id: str) -> None:
        """EXPORT_LOHN im Token UND Leitungsrolle frisch aus der DB (Wurzel 7)."""
        if self._rolle_aus_db(ctx, tenant_id) not in LEITUNG:
            raise PersonalError(
                "Den Lohnlauf führt die Leitung.",
                status_code=403,
                details={"code": "keine_leitung"},
            )

    # ------------------------------------------------------------------
    # Lesen
    # ------------------------------------------------------------------

    def liste(self, ctx: AuthContext, jahr: int) -> list[Lohnlauf]:
        tenant_id = self._require_tenant(ctx)
        self._require_leitung(ctx, tenant_id)
        rows = (
            self._db.table("personal_lohnlaeufe")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("jahr", jahr)
            .execute()
        ).data or []
        return sorted(
            (self._lauf(r) for r in rows), key=lambda x: (x.jahr, x.monat), reverse=True
        )

    def _own_lauf(self, ctx: AuthContext, tenant_id: str, lauf_id: str) -> dict[str, Any]:
        """Laden und Scopen in EINEM Schritt (Wurzel 3)."""
        self._require_leitung(ctx, tenant_id)
        return load_scoped(
            self._db,
            "personal_lohnlaeufe",
            lauf_id,
            tenant_id,
            not_found=PersonalError("Lohnlauf nicht gefunden.", status_code=404),
        )

    @staticmethod
    def _lauf(row: dict[str, Any]) -> Lohnlauf:
        return Lohnlauf(
            id=str(row["id"]),
            jahr=int(row["jahr"]),
            monat=int(row["monat"]),
            status=str(row["status"]),  # type: ignore[arg-type]
            pruefungen=Pruefungen.model_validate(dict(row.get("pruefungen") or {})),
            geprueft_am=als_dt(row.get("geprueft_am")),
            freigegeben_am=als_dt(row.get("freigegeben_am")),
            exportiert_am=als_dt(row.get("exportiert_am")),
            export_format=row.get("export_format"),
            export_name=row.get("export_name"),
            notiz=row.get("notiz"),
            created_at=als_dt(row.get("created_at")),
        )

    # ------------------------------------------------------------------
    # Anlegen (idempotent)
    # ------------------------------------------------------------------

    def anlegen(self, ctx: AuthContext, req: LohnlaufCreate) -> Lohnlauf:
        tenant_id = self._require_tenant(ctx)
        self._require_leitung(ctx, tenant_id)
        vorhanden = self._suchen(tenant_id, req.jahr, req.monat)
        if vorhanden is not None:
            return self._lauf(vorhanden)
        try:
            row = (
                self._db.table("personal_lohnlaeufe")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "jahr": req.jahr,
                        "monat": req.monat,
                        "status": "entwurf",
                        "pruefungen": {},
                    }
                )
                .execute()
                .data[0]
            )
        except APIError as exc:
            if getattr(exc, "code", None) != _UNIQUE_VERLETZUNG:
                raise
            # Zwei Klicks gleichzeitig: der UNIQUE-Index hat gewonnen (Wurzel 2).
            nach = self._suchen(tenant_id, req.jahr, req.monat)
            if nach is None:
                raise
            return self._lauf(nach)
        log.info(
            "personal_lohnlauf_angelegt", tenant_id=tenant_id, jahr=req.jahr, monat=req.monat
        )
        return self._lauf(row)

    def _suchen(self, tenant_id: str, jahr: int, monat: int) -> dict[str, Any] | None:
        rows = (
            self._db.table("personal_lohnlaeufe")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("jahr", jahr)
            .eq("monat", monat)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    # ------------------------------------------------------------------
    # Prüfen (Monatsabschluss-Assistent)
    # ------------------------------------------------------------------

    def pruefen(self, ctx: AuthContext, lauf_id: str) -> Lohnlauf:
        """Zehn Prüfungen; ohne Fehler wird der Lauf `geprueft`, sonst bleibt er `entwurf`.

        Ein Lauf mit Fehlern zurück auf `entwurf` zu setzen ist Absicht: der
        Betrieb soll die Ursache beheben und erneut prüfen, nicht an einem
        „halb geprüften" Zustand vorbei freigeben können.
        """
        tenant_id = self._require_tenant(ctx)
        row = self._own_lauf(ctx, tenant_id, lauf_id)
        jahr, monat = int(row["jahr"]), int(row["monat"])
        von = date(jahr, monat, 1)
        bis = date(jahr + (monat == 12), (monat % 12) + 1, 1) - timedelta(days=1)
        fehler: list[Pruefung] = []
        warnungen: list[Pruefung] = []
        ids = {
            str(u["id"])
            for u in self._users(tenant_id)
            if str(u.get("role")) in PLANBARE_ROLLEN and u.get("deactivated_at") is None
        }
        users = {str(u["id"]): u for u in self._users(tenant_id, ids)}
        akten = self._akten(tenant_id, ids)
        firmen = self._firmen(tenant_id)
        zeiten = self._zeiten_im_monat(tenant_id, ids, von, bis)
        self._pruefe_zeiten(users, zeiten, fehler)
        self._pruefe_stempelungen(tenant_id, ids, users, von, bis, fehler)
        self._pruefe_abschluesse(tenant_id, ids, users, akten, jahr, monat, fehler)
        self._pruefe_loehne(users, akten, firmen, zeiten, fehler)
        self._pruefe_lohnarten(tenant_id, fehler)
        self._pruefe_verdienstgrenzen(users, akten, firmen, zeiten, fehler)
        self._pruefe_plan_ist(tenant_id, ids, users, von, bis, zeiten, warnungen)
        self._pruefe_ueberstunden(tenant_id, ids, users, von, bis, warnungen)
        pruefungen = Pruefungen(
            geprueft_am=datetime.now(UTC),
            personen=len(users),
            zeiten=len(zeiten),
            fehler=fehler,
            warnungen=warnungen,
        )
        neu = {
            "pruefungen": pruefungen.model_dump(mode="json"),
            "geprueft_von": ctx.user_id,
            "geprueft_am": pruefungen.geprueft_am.isoformat(),
            "status": "entwurf" if fehler else "geprueft",
        }
        if fehler:
            # Ein Lauf mit Fehlern verliert eine frühere Freigabe: die Zahlen
            # hinter der Freigabe stimmen nicht mehr (Gegenzustand, Wurzel 1).
            neu.update({"freigegeben_von": None, "freigegeben_am": None})
        log.info(
            "personal_lohnlauf_geprueft",
            tenant_id=tenant_id,
            jahr=jahr,
            monat=monat,
            fehler=len(fehler),
            warnungen=len(warnungen),
        )
        return self._schreiben(tenant_id, lauf_id, neu)

    # --- die einzelnen Prüfarten ---------------------------------------

    @staticmethod
    def _pruefe_zeiten(
        users: dict[str, dict[str, Any]], zeiten: list[dict[str, Any]], fehler: list[Pruefung]
    ) -> None:
        """`zeit_unbestaetigt`: abgeschlossen, aber niemand hat sie bestätigt."""
        offen: dict[str, int] = {}
        for z in zeiten:
            if z.get("status") == "abgeschlossen":
                uid = str(z["user_id"])
                offen[uid] = offen.get(uid, 0) + 1
        for uid, anzahl in sorted(offen.items()):
            fehler.append(
                Pruefung(
                    art="zeit_unbestaetigt",
                    user_id=uid,
                    name=_name(users, uid),
                    werte={"anzahl": anzahl},
                )
            )

    def _pruefe_stempelungen(  # noqa: PLR0913 — Zeitraum, Personen, Namen, Ausgabe
        self,
        tenant_id: str,
        ids: set[str],
        users: dict[str, dict[str, Any]],
        von: date,
        bis: date,
        fehler: list[Pruefung],
    ) -> None:
        """`stempelung_offen`: eine Stempelung ohne Ende — die Dauer ist unbekannt."""
        if not ids:
            return
        rows = (
            self._db.table("personal_zeiterfassung")
            .select("id, user_id, start_at, status")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .eq("status", "offen")
            .gte("start_at", _tag_start(von))
            .lt("start_at", _tag_start(bis + timedelta(days=1)))
            .execute()
        ).data or []
        for r in sorted(rows, key=lambda x: str(x.get("start_at") or "")):
            uid = str(r["user_id"])
            fehler.append(
                Pruefung(
                    art="stempelung_offen",
                    user_id=uid,
                    name=_name(users, uid),
                    werte={"start_at": str(r.get("start_at") or ""), "id": str(r["id"])},
                )
            )

    def _pruefe_abschluesse(  # noqa: PLR0913 — die Prüfung braucht Monat, Personen, Akten
        self,
        tenant_id: str,
        ids: set[str],
        users: dict[str, dict[str, Any]],
        akten: dict[str, dict[str, Any]],
        jahr: int,
        monat: int,
        fehler: list[Pruefung],
    ) -> None:
        """`monatsabschluss_fehlt`: ohne Abschluss ist Soll/Ist nicht festgeschrieben."""
        if not ids:
            return
        rows = (
            self._db.table("personal_monatsabschluesse")
            .select("user_id")
            .eq("tenant_id", tenant_id)
            .eq("jahr", jahr)
            .eq("monat", monat)
            .in_("user_id", sorted(ids))
            .execute()
        ).data or []
        vorhanden = {str(r["user_id"]) for r in rows}
        for uid in sorted(ids - vorhanden):
            if (akten.get(uid) or {}).get("beschaeftigungsart") == "extern":
                continue
            fehler.append(
                Pruefung(
                    art="monatsabschluss_fehlt",
                    user_id=uid,
                    name=_name(users, uid),
                    werte={"jahr": jahr, "monat": monat},
                )
            )

    @staticmethod
    def _pruefe_loehne(  # noqa: PLR0913 — vier Quellen, zwei Fehlerarten
        users: dict[str, dict[str, Any]],
        akten: dict[str, dict[str, Any]],
        firmen: dict[str, dict[str, Any]],
        zeiten: list[dict[str, Any]],
        fehler: list[Pruefung],
    ) -> None:
        """`lohn_fehlt` / `waehrung_fehlt`: nur für Personen, die im Monat gearbeitet haben."""
        gearbeitet = {str(z["user_id"]) for z in zeiten}
        for uid in sorted(gearbeitet):
            akte = akten.get(uid) or {}
            if akte.get("beschaeftigungsart") == "extern":
                firma = firmen.get(str(akte.get("firma_id") or ""))
                satz, waehrung = kosten_satz(akte, firma)
                if satz is None:
                    fehler.append(
                        Pruefung(
                            art="lohn_fehlt",
                            user_id=uid,
                            name=_name(users, uid),
                            werte={"firma": (firma or {}).get("name") or ""},
                        )
                    )
                elif not waehrung:
                    fehler.append(
                        Pruefung(art="waehrung_fehlt", user_id=uid, name=_name(users, uid))
                    )
                continue
            hat_lohn = (
                akte.get("stundenlohn_minor") is not None or akte.get("gehalt_minor") is not None
            )
            if not hat_lohn:
                fehler.append(Pruefung(art="lohn_fehlt", user_id=uid, name=_name(users, uid)))
            elif not akte.get("currency"):
                fehler.append(Pruefung(art="waehrung_fehlt", user_id=uid, name=_name(users, uid)))

    def _pruefe_lohnarten(self, tenant_id: str, fehler: list[Pruefung]) -> None:
        """`lohnart_fehlt`: ohne Zuordnung weiß kein Lohnprogramm, was die Stunden sind."""
        regeln_row = self._regeln_row(tenant_id) or {}
        lohnarten = dict(regeln_row.get("lohnarten") or {})
        fehlende = [key for key in _LOHNART_PFLICHT if not lohnarten.get(key)]
        if fehlende:
            fehler.append(Pruefung(art="lohnart_fehlt", werte={"lohnarten": fehlende}))

    @staticmethod
    def _pruefe_verdienstgrenzen(  # noqa: PLR0913 — Grenze, Satz, Zeiten, Ausgabe
        users: dict[str, dict[str, Any]],
        akten: dict[str, dict[str, Any]],
        firmen: dict[str, dict[str, Any]],
        zeiten: list[dict[str, Any]],
        fehler: list[Pruefung],
    ) -> None:
        """`verdienstgrenze_ueberschritten`: eine gerissene Grenze kostet den Betrieb.

        Gerechnet wird über die Minuten des Monats × Satz; Jahresgrenzen kann
        ein Monatslauf nicht beurteilen und meldet er nicht — dafür ist der
        Bericht `verdienstgrenzen` da.
        """
        minuten: dict[str, int] = {}
        for z in zeiten:
            start, ende = als_dt(z.get("start_at")), als_dt(z.get("end_at"))
            if start is None or ende is None:
                continue
            uid = str(z["user_id"])
            minuten[uid] = minuten.get(uid, 0) + int((ende - start).total_seconds() // 60)
        for uid, min_ in sorted(minuten.items()):
            akte = akten.get(uid) or {}
            grenze = akte.get("verdienstgrenze_minor")
            if grenze is None or akte.get("verdienstgrenze_zeitraum") != "monat":
                continue
            satz, waehrung = kosten_satz(akte, firmen.get(str(akte.get("firma_id") or "")))
            if satz is None:
                continue
            betrag = round(satz * min_ / 60)
            if betrag > int(grenze):
                fehler.append(
                    Pruefung(
                        art="verdienstgrenze_ueberschritten",
                        user_id=uid,
                        name=_name(users, uid),
                        werte={
                            "grenze_minor": int(grenze),
                            "betrag_minor": betrag,
                            "currency": waehrung,
                        },
                    )
                )

    def _pruefe_plan_ist(  # noqa: PLR0913 — zwei Warnarten aus derselben Gegenüberstellung
        self,
        tenant_id: str,
        ids: set[str],
        users: dict[str, dict[str, Any]],
        von: date,
        bis: date,
        zeiten: list[dict[str, Any]],
        warnungen: list[Pruefung],
    ) -> None:
        """`schicht_ohne_zeit` / `zeit_ohne_schicht` — Warnung, kein Fehler.

        Beides kann richtig sein (Schicht abgesagt und nicht nachgetragen, Zeit
        spontan gestempelt), deshalb blockiert es die Freigabe nicht.
        """
        if not ids:
            return
        schichten = [
            s
            for s in (
                self._db.table("personal_schichten")
                .select("id, user_id, datum, status")
                .eq("tenant_id", tenant_id)
                .in_("user_id", sorted(ids))
                .gte("datum", von.isoformat())
                .lte("datum", bis.isoformat())
                .execute()
            ).data
            or []
            if s.get("status") in _AKTIVE_SCHICHT
        ]
        mit_zeit = {str(z.get("schicht_id")) for z in zeiten if z.get("schicht_id")}
        ohne_zeit: dict[str, int] = {}
        for s in schichten:
            if str(s["id"]) in mit_zeit:
                continue
            uid = str(s.get("user_id") or "")
            if uid:
                ohne_zeit[uid] = ohne_zeit.get(uid, 0) + 1
        for uid, anzahl in sorted(ohne_zeit.items()):
            warnungen.append(
                Pruefung(
                    art="schicht_ohne_zeit",
                    user_id=uid,
                    name=_name(users, uid),
                    werte={"anzahl": anzahl},
                )
            )
        ohne_schicht: dict[str, int] = {}
        for z in zeiten:
            if z.get("schicht_id"):
                continue
            uid = str(z["user_id"])
            ohne_schicht[uid] = ohne_schicht.get(uid, 0) + 1
        for uid, anzahl in sorted(ohne_schicht.items()):
            warnungen.append(
                Pruefung(
                    art="zeit_ohne_schicht",
                    user_id=uid,
                    name=_name(users, uid),
                    werte={"anzahl": anzahl},
                )
            )

    def _pruefe_ueberstunden(  # noqa: PLR0913 — Zeitraum, Personen, Namen, Ausgabe
        self,
        tenant_id: str,
        ids: set[str],
        users: dict[str, dict[str, Any]],
        von: date,
        bis: date,
        warnungen: list[Pruefung],
    ) -> None:
        """`ueberstunden_offen`: ein unentschiedener Antrag ändert den Saldo noch."""
        if not ids:
            return
        rows = (
            self._db.table("personal_ueberstunden_antraege")
            .select("user_id, datum, minuten, status")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .eq("status", "beantragt")
            .gte("datum", von.isoformat())
            .lte("datum", bis.isoformat())
            .execute()
        ).data or []
        je_person: dict[str, list[int]] = {}
        for r in rows:
            je_person.setdefault(str(r["user_id"]), []).append(int(r.get("minuten") or 0))
        for uid, liste in sorted(je_person.items()):
            warnungen.append(
                Pruefung(
                    art="ueberstunden_offen",
                    user_id=uid,
                    name=_name(users, uid),
                    werte={"anzahl": len(liste), "minuten": sum(liste)},
                )
            )

    def _zeiten_im_monat(
        self, tenant_id: str, ids: set[str], von: date, bis: date
    ) -> list[dict[str, Any]]:
        if not ids:
            return []
        rows = (
            self._db.table("personal_zeiterfassung")
            .select("id, user_id, start_at, end_at, schicht_id, status")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .gte("start_at", _tag_start(von))
            .lt("start_at", _tag_start(bis + timedelta(days=1)))
            .execute()
        ).data or []
        return [r for r in rows if r.get("status") in ("abgeschlossen", "bestaetigt")]

    def _firmen(self, tenant_id: str) -> dict[str, dict[str, Any]]:
        rows = (
            self._db.table("personal_fremdfirmen")
            .select("*")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return {str(r["id"]): r for r in rows}

    # ------------------------------------------------------------------
    # Kette: freigeben, exportieren, zurücksetzen
    # ------------------------------------------------------------------

    def freigeben(self, ctx: AuthContext, lauf_id: str) -> Lohnlauf:
        tenant_id = self._require_tenant(ctx)
        row = self._own_lauf(ctx, tenant_id, lauf_id)
        if row.get("status") != "geprueft":
            raise PersonalError(
                "Erst prüfen, dann freigeben.",
                status_code=409,
                details={"code": "nicht_geprueft", "status": row.get("status")},
            )
        log.info("personal_lohnlauf_freigegeben", tenant_id=tenant_id, lauf_id=lauf_id)
        return self._schreiben(
            tenant_id,
            lauf_id,
            {
                "status": "freigegeben",
                "freigegeben_von": ctx.user_id,
                "freigegeben_am": datetime.now(UTC).isoformat(),
            },
        )

    def exportieren(
        self, ctx: AuthContext, lauf_id: str, req: LohnlaufExport
    ) -> LohnlaufExportResponse:
        """Export aus freigegebenem (oder erneut aus exportiertem) Lauf, nur bestätigte Zeiten."""
        tenant_id = self._require_tenant(ctx)
        row = self._own_lauf(ctx, tenant_id, lauf_id)
        if row.get("status") not in ("freigegeben", "exportiert"):
            raise PersonalError(
                "Export nur aus einem freigegebenen Lohnlauf.",
                status_code=409,
                details={"code": "nicht_freigegeben", "status": row.get("status")},
            )
        name, inhalt, mime = AuswertungService(self._db).lohnexport(
            ctx,
            LohnExportRequest(jahr=int(row["jahr"]), monat=int(row["monat"]), format=req.format),
            nur_bestaetigt=True,
        )
        self._schreiben(
            tenant_id,
            lauf_id,
            {
                "status": "exportiert",
                "exportiert_von": ctx.user_id,
                "exportiert_am": datetime.now(UTC).isoformat(),
                "export_format": req.format,
                "export_name": name,
            },
        )
        log.info(
            "personal_lohnlauf_exportiert",
            tenant_id=tenant_id,
            lauf_id=lauf_id,
            format=req.format,
            bytes=len(inhalt),
        )
        return LohnlaufExportResponse(
            inhalt_base64=base64.b64encode(inhalt).decode(), mime=mime, name=name
        )

    def zuruecksetzen(
        self, ctx: AuthContext, lauf_id: str, req: LohnlaufZuruecksetzen
    ) -> Lohnlauf:
        """Zurück auf `entwurf` — mit Grund in der Notiz, auch aus `exportiert`.

        Gegenzustand (Wurzel 1): Prüf-, Freigabe- und Export-Marken fallen mit,
        sonst stünde `geprueft_am` an einem Entwurf, dessen Zahlen sich seither
        geändert haben — und der DB-Constraint der Kette würde beim nächsten
        Schritt schweigen, obwohl die Freigabe nicht mehr gilt.
        """
        tenant_id = self._require_tenant(ctx)
        row = self._own_lauf(ctx, tenant_id, lauf_id)
        vorher = str(row.get("status") or "")
        if vorher == "entwurf":
            raise PersonalError(
                "Dieser Lohnlauf ist schon im Entwurf.",
                status_code=409,
                details={"code": "schon_entwurf"},
            )
        notiz = f"{datetime.now(UTC).date().isoformat()} zurückgesetzt aus {vorher}: {req.grund}"
        alt = str(row.get("notiz") or "")
        log.info(
            "personal_lohnlauf_zurueckgesetzt",
            tenant_id=tenant_id,
            lauf_id=lauf_id,
            vorher=vorher,
        )
        return self._schreiben(
            tenant_id,
            lauf_id,
            {
                "status": "entwurf",
                "geprueft_von": None,
                "geprueft_am": None,
                "freigegeben_von": None,
                "freigegeben_am": None,
                "exportiert_von": None,
                "exportiert_am": None,
                "export_format": None,
                "export_name": None,
                "notiz": f"{alt}\n{notiz}".strip(),
            },
        )

    def _schreiben(self, tenant_id: str, lauf_id: str, neu: dict[str, Any]) -> Lohnlauf:
        rows = (
            self._db.table("personal_lohnlaeufe")
            .update(neu)
            .eq("id", lauf_id)
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        if rows:
            return self._lauf(rows[0])
        # Kein Rückgabe-Body (manche PostgREST-Antworten) → gescoped nachlesen.
        return self._lauf(
            load_scoped(
                self._db,
                "personal_lohnlaeufe",
                lauf_id,
                tenant_id,
                not_found=PersonalError("Lohnlauf nicht gefunden.", status_code=404),
            )
        )


def _name(users: dict[str, dict[str, Any]], user_id: str) -> str:
    return str((users.get(user_id) or {}).get("full_name") or user_id)


def _tag_start(tag: date) -> str:
    return datetime.combine(tag, datetime.min.time(), UTC).isoformat()


def get_lohnlauf_service() -> LohnlaufService:
    from src.core.supabase import get_service_client  # noqa: PLC0415 — Zyklus vermeiden

    return LohnlaufService(service_client=get_service_client())


__all__ = ["LohnlaufService", "get_lohnlauf_service"]
