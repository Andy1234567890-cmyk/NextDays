"""Stammdaten des Personalbereichs (0541): Mitarbeiterliste, Akte, Fremdfirmen,
Arbeitsbereiche, Qualifikationen, Dokumente, Regeln, Pausenmodelle, Vorlagen.

Alles läuft mit der Service-Role und scopt deshalb EXPLIZIT auf den Tenant
(Wurzel 3). Die Akte ist nur für MANAGE_PERSONAL erreichbar (admin/co_admin,
Rolle frisch aus der DB); die Schichtleitung sieht Name, Rolle und
Arbeitsbereiche ihrer Leute — nie Lohn, Adresse oder Kennungen (§4.3).
"""

# pylint: disable=too-many-lines
# Stammdaten sind sieben kleine Fachgebiete mit gemeinsamem Scope; geteilt nach
# Zeilenzahl entstünden Module, die dieselben drei Helfer importieren.
from __future__ import annotations

from datetime import date, timedelta
from typing import Any
from uuid import uuid4

from postgrest.exceptions import APIError

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from . import laender
from ._base import (
    _UNIQUE_VERLETZUNG,
    PLANBARE_ROLLEN,
    PersonalBase,
    PersonalError,
    als_date,
    als_dt,
    als_float,
    als_time,
    jetzt,
    log,
)
from .akte_krypto import AkteKryptoFehler, entschluesseln, maskieren, verschluesseln
from .schemas import (
    Akte,
    AkteUpdate,
    Arbeitsbereich,
    ArbeitsbereichCreate,
    ArbeitsbereichUpdate,
    Dokument,
    DokumentAnfrage,
    DokumentUpdate,
    Fremdfirma,
    FremdfirmaCreate,
    FremdfirmaUpdate,
    KostenSumme,
    MitarbeiterListItem,
    MitarbeiterListResponse,
    Paar,
    Pausenmodell,
    PausenmodellSet,
    Qualifikation,
    QualifikationSet,
    Regeln,
    RegelnSet,
    RegelVorschlag,
    Schichtvorlage,
    SchichtvorlageCreate,
    SchichtvorlageUpdate,
    SliceHealth,
)

_BUCKET = "personal-dokumente"
_URL_TTL = 10 * 60
_MAX_DOKUMENT_BYTES = 20 * 1024 * 1024
_ABLAUF_WARNUNG_TAGE = 30
_ENC_FELDER = {"steuer_id": "steuer_id_enc", "sv_nummer": "sv_nummer_enc", "iban": "iban_enc"}
_AKTE_SPALTEN = (
    "user_id, employee_number, beschaeftigungsart, firma_id, position, eintritt, austritt, "
    "probezeit_bis, wochenstunden, tagesstunden, arbeitstage_je_woche, stundenlohn_minor, "
    "gehalt_minor, currency, urlaubsanspruch_tage, geburtsdatum, geburtsort, "
    "staatsangehoerigkeit, strasse, hausnummer, plz, ort, land, notfall_name, "
    "notfall_beziehung, notfall_telefon, steuer_id_enc, sv_nummer_enc, krankenkasse, "
    "iban_enc, bic, bank_name, kontoinhaber, notiz, familienstand, kinder_anzahl, "
    "lohnmerkmale, arbeitgeber_aufschlag_pct, verdienstgrenze_minor, "
    "verdienstgrenze_zeitraum, stempel_id, terminal_pin_hash, updated_at"
)
_MAGIC: tuple[tuple[bytes, str], ...] = (
    (b"%PDF", "application/pdf"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
)


def _dateityp(content: bytes) -> str | None:
    """MIME aus den Magic-Bytes — nie aus dem Client-Header (Wurzel 8)."""
    for magic, mime in _MAGIC:
        if content.startswith(magic):
            return mime
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


def monatskosten(akte: dict[str, Any]) -> tuple[str, int] | None:
    """(Währung, Minor) der monatlichen Personalkosten aus der Akte — oder None.

    Gehalt ODER Stundenlohn × Wochenstunden × 52/12, plus Arbeitgeber-Aufschlag
    in Prozent. Fehlt Lohn, Währung oder Aufschlag, gibt es KEINE Zahl (Wurzel
    4): eine Kostenkachel mit erfundenem Aufschlag wäre eine Falschaussage.
    Externe Kräfte haben keine Lohnfelder → None (ihre Kosten stehen an der
    Fremdfirma).
    """
    cur = akte.get("currency")
    aufschlag = als_float(akte.get("arbeitgeber_aufschlag_pct"))
    if not cur or aufschlag is None:
        return None
    gehalt = akte.get("gehalt_minor")
    lohn = akte.get("stundenlohn_minor")
    std = als_float(akte.get("wochenstunden"))
    if gehalt is not None:
        basis = float(gehalt)
    elif lohn is not None and std is not None:
        basis = float(lohn) * std * 52 / 12
    else:
        return None
    return str(cur), round(basis * (1 + aufschlag / 100))


class PersonalService(PersonalBase):
    slice_name = "personal"

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    # ------------------------------------------------------------------
    # Mitarbeiterliste
    # ------------------------------------------------------------------

    def mitarbeiter(self, ctx: AuthContext) -> MitarbeiterListResponse:
        tenant_id = self._require_tenant(ctx)
        ids = self._personen_im_scope(ctx, tenant_id)
        users = [u for u in self._users(tenant_id, ids) if str(u.get("role")) in PLANBARE_ROLLEN]
        akten = self._akten(tenant_id, ids)
        firmen = self._firmen_namen(tenant_id)
        bereiche = self._bereiche_namen(tenant_id)
        quali = self._qualifikationen_je_person(tenant_id, ids)
        faellig = self._dokumente_faellig(tenant_id, ids)
        leitung = self._ist_leitung(ctx)
        items: list[MitarbeiterListItem] = []
        summen: dict[str, KostenSumme] = {}
        hinweise: list[str] = []
        for u in sorted(
            users, key=lambda r: (str(r.get("full_name") or "").casefold(), str(r["id"]))
        ):
            uid = str(u["id"])
            a = akten.get(uid) or {}
            kosten = monatskosten(a) if leitung and u.get("deactivated_at") is None else None
            if leitung and kosten is None and a and a.get("beschaeftigungsart") != "extern":
                hinweise.append(str(u.get("full_name") or uid))
            if kosten is not None:
                cur, minor = kosten
                alt = summen.get(cur)
                summen[cur] = KostenSumme(
                    currency=cur,
                    minor=(alt.minor if alt else 0) + minor,
                    personen=(alt.personen if alt else 0) + 1,
                )
            items.append(
                MitarbeiterListItem(
                    user_id=uid,
                    full_name=u.get("full_name"),
                    email=u.get("email") if leitung else None,
                    phone=u.get("phone") if leitung else None,
                    kosten_monat_minor=kosten[1] if kosten else None,
                    kosten_currency=kosten[0] if kosten else None,
                    role=str(u.get("role")),
                    is_active=u.get("deactivated_at") is None,
                    avatar_url=u.get("avatar_url"),
                    beschaeftigungsart=a.get("beschaeftigungsart"),
                    firma_name=firmen.get(str(a.get("firma_id") or "")),
                    position=a.get("position"),
                    employee_number=a.get("employee_number") if leitung else None,
                    eintritt=als_date(a.get("eintritt")) if leitung else None,
                    austritt=als_date(a.get("austritt")) if leitung else None,
                    wochenstunden=als_float(a.get("wochenstunden")) if leitung else None,
                    arbeitsbereiche=[bereiche[b] for b in quali.get(uid, []) if b in bereiche],
                    dokumente_faellig=faellig.get(uid, 0) if leitung else 0,
                    akte_vorhanden=uid in akten,
                )
            )
        return MitarbeiterListResponse(
            items=items,
            kosten_monat=sorted(summen.values(), key=lambda k: k.currency),
            kosten_hinweise=hinweise,
        )

    def _firmen_namen(self, tenant_id: str) -> dict[str, str]:
        rows = (
            self._db.table("personal_fremdfirmen")
            .select("id, name")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return {str(r["id"]): str(r["name"]) for r in rows}

    def _bereiche_namen(self, tenant_id: str) -> dict[str, str]:
        rows = (
            self._db.table("personal_arbeitsbereiche")
            .select("id, name")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return {str(r["id"]): str(r["name"]) for r in rows}

    def _qualifikationen_je_person(self, tenant_id: str, ids: set[str]) -> dict[str, list[str]]:
        if not ids:
            return {}
        rows = (
            self._db.table("personal_qualifikationen")
            .select("user_id, arbeitsbereich_id")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .execute()
        ).data or []
        aus: dict[str, list[str]] = {}
        for r in rows:
            b = str(r["arbeitsbereich_id"])
            liste = aus.setdefault(str(r["user_id"]), [])
            if b not in liste:
                liste.append(b)
        return aus

    def _dokumente_faellig(self, tenant_id: str, ids: set[str]) -> dict[str, int]:
        if not ids:
            return {}
        grenze = (date.today() + timedelta(days=_ABLAUF_WARNUNG_TAGE)).isoformat()
        rows = (
            self._db.table("personal_dokumente")
            .select("user_id, ablauf_am, storage_pfad")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .execute()
        ).data or []
        aus: dict[str, int] = {}
        for r in rows:
            ablauf = r.get("ablauf_am")
            offen = r.get("storage_pfad") is None
            if offen or (ablauf and str(ablauf) <= grenze):
                aus[str(r["user_id"])] = aus.get(str(r["user_id"]), 0) + 1
        return aus

    # ------------------------------------------------------------------
    # Akte
    # ------------------------------------------------------------------

    def akte(self, ctx: AuthContext, user_id: str) -> Akte:
        tenant_id = self._require_tenant(ctx)
        self._require_planbar(tenant_id, user_id)
        row = self._akte_row(tenant_id, user_id)
        if row is None:
            # Noch keine Akte: leere Vorlage, damit das Formular etwas zeigt —
            # `beschaeftigungsart` ist Pflicht und muss beim Speichern gesetzt werden.
            return Akte(user_id=user_id, beschaeftigungsart="vollzeit")
        return self._akte_aus_row(tenant_id, row)

    def _akte_row(self, tenant_id: str, user_id: str) -> dict[str, Any] | None:
        rows = (
            self._db.table("personal_akten")
            .select(_AKTE_SPALTEN)
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def _akte_aus_row(self, tenant_id: str, row: dict[str, Any]) -> Akte:
        firma_name = None
        if row.get("firma_id"):
            firma_name = self._firmen_namen(tenant_id).get(str(row["firma_id"]))
        return Akte(
            user_id=str(row["user_id"]),
            employee_number=row.get("employee_number"),
            beschaeftigungsart=row["beschaeftigungsart"],
            firma_id=row.get("firma_id"),
            firma_name=firma_name,
            position=row.get("position"),
            eintritt=als_date(row.get("eintritt")),
            austritt=als_date(row.get("austritt")),
            probezeit_bis=als_date(row.get("probezeit_bis")),
            wochenstunden=als_float(row.get("wochenstunden")),
            tagesstunden=als_float(row.get("tagesstunden")),
            arbeitstage_je_woche=row.get("arbeitstage_je_woche"),
            stundenlohn_minor=row.get("stundenlohn_minor"),
            gehalt_minor=row.get("gehalt_minor"),
            currency=row.get("currency"),
            urlaubsanspruch_tage=als_float(row.get("urlaubsanspruch_tage")),
            geburtsdatum=als_date(row.get("geburtsdatum")),
            geburtsort=row.get("geburtsort"),
            staatsangehoerigkeit=row.get("staatsangehoerigkeit"),
            strasse=row.get("strasse"),
            hausnummer=row.get("hausnummer"),
            plz=row.get("plz"),
            ort=row.get("ort"),
            land=row.get("land"),
            notfall_name=row.get("notfall_name"),
            notfall_beziehung=row.get("notfall_beziehung"),
            notfall_telefon=row.get("notfall_telefon"),
            steuer_id_maskiert=self._maskiert(row.get("steuer_id_enc")),
            sv_nummer_maskiert=self._maskiert(row.get("sv_nummer_enc")),
            iban_maskiert=self._maskiert(row.get("iban_enc")),
            krankenkasse=row.get("krankenkasse"),
            bic=row.get("bic"),
            bank_name=row.get("bank_name"),
            kontoinhaber=row.get("kontoinhaber"),
            notiz=row.get("notiz"),
            familienstand=row.get("familienstand"),
            kinder_anzahl=row.get("kinder_anzahl"),
            lohnmerkmale=[
                Paar(schluessel=str(x.get("schluessel") or ""), wert=str(x.get("wert") or ""))
                for x in (row.get("lohnmerkmale") or [])
                if isinstance(x, dict) and x.get("schluessel")
            ],
            arbeitgeber_aufschlag_pct=als_float(row.get("arbeitgeber_aufschlag_pct")),
            verdienstgrenze_minor=row.get("verdienstgrenze_minor"),
            verdienstgrenze_zeitraum=row.get("verdienstgrenze_zeitraum"),
            stempel_id=row.get("stempel_id"),
            hat_terminal_pin=bool(row.get("terminal_pin_hash")),
            updated_at=als_dt(row.get("updated_at")),
        )

    @staticmethod
    def _maskiert(enc: object) -> str | None:
        if not enc:
            return None
        try:
            return maskieren(entschluesseln(str(enc)))
        except AkteKryptoFehler as exc:
            # Anzeige darf nicht kippen: der Fehler wird als Wert BENANNT, nicht
            # als leeres Feld ausgegeben (Wurzel 5).
            return f"⚠ {exc.message}"

    def akte_speichern(self, ctx: AuthContext, user_id: str, req: AkteUpdate) -> Akte:
        tenant_id = self._require_tenant(ctx)
        user = self._require_planbar(tenant_id, user_id)
        self.akte_patch_anwenden(tenant_id, user_id, req, rolle=str(user.get("role") or ""))
        row = self._akte_row(tenant_id, user_id)
        if row is None:
            raise PersonalError("Akte konnte nicht gelesen werden.", status_code=500)
        return self._akte_aus_row(tenant_id, row)

    def akte_patch_anwenden(
        self, tenant_id: str, user_id: str, req: AkteUpdate, *, rolle: str = ""
    ) -> None:
        """Der Schreibkern der Akte OHNE AuthContext.

        Zwei Aufrufer teilen ihn: `akte_speichern` (Nutzer klickt Speichern, Guard
        MANAGE_PERSONAL und Scope davor) und `akte_aenderungen.aenderungen_anwenden`
        (der Worker am Stichtag, wo es keinen Nutzer und keinen ctx gibt). Ohne
        diesen Schnitt müsste der Worker die Prüf- und Verschlüsselungslogik
        kopieren — und eine Kopie wäre am ersten neuen Pflichtfeld auseinander.
        Die Autorisierung sitzt bei den Aufrufern, hier NICHT: wer diese Methode
        ruft, hat den Scope schon geprüft.
        """
        vorher = self._akte_row(tenant_id, user_id)
        payload: dict[str, Any] = {}
        felder = req.model_dump(exclude_unset=True, exclude={"geleert"})
        for name, wert in felder.items():
            if wert is None:
                continue
            if name in _ENC_FELDER:
                try:
                    payload[_ENC_FELDER[name]] = verschluesseln(str(wert).strip())
                except AkteKryptoFehler as exc:
                    raise PersonalError(exc.message, status_code=exc.status_code) from exc
            elif isinstance(wert, date):
                payload[name] = wert.isoformat()
            else:
                # Listen (lohnmerkmale) kommen aus model_dump bereits als dicts → jsonb.
                payload[name] = wert
        for name in req.geleert:
            payload[_ENC_FELDER.get(name, name)] = None
        zusammen = {**(vorher or {}), **payload}
        self._akte_pruefen(tenant_id, zusammen)
        payload["tenant_id"] = tenant_id
        payload["user_id"] = user_id
        if vorher is None and "beschaeftigungsart" not in payload:
            raise PersonalError("Beschäftigungsart ist Pflicht.", status_code=422)
        try:
            if vorher is None:
                self._db.table("personal_akten").insert(payload).execute()
            else:
                (
                    self._db.table("personal_akten")
                    .update(payload)
                    .eq("tenant_id", tenant_id)
                    .eq("user_id", user_id)
                    .execute()
                )
        except APIError as exc:
            if getattr(exc, "code", None) == _UNIQUE_VERLETZUNG:
                raise PersonalError(
                    "Diese Personalnummer ist bereits vergeben.", status_code=409
                ) from exc
            raise
        log.info(
            "personal_akte_gespeichert",
            tenant_id=tenant_id,
            user_id=user_id,
            felder=sorted(k for k in payload if k not in ("tenant_id", "user_id")),
            rolle=rolle,
        )

    def _akte_pruefen(self, tenant_id: str, a: dict[str, Any]) -> None:
        art = a.get("beschaeftigungsart")
        if (
            a.get("stundenlohn_minor") is not None or a.get("gehalt_minor") is not None
        ) and not a.get("currency"):
            raise PersonalError(
                "Lohnbeträge brauchen eine Währung (Wurzel 4).",
                status_code=422,
                details={"code": "waehrung_fehlt"},
            )
        # Verdienstgrenze (0544): Betrag und Zeitraum sind ein PAAR, und ein
        # Betrag ohne Währung ist kein Betrag — beides prüft die DB auch, aber
        # der Nutzer bekommt hier den Code, den das Frontend übersetzt.
        grenze, zeitraum = a.get("verdienstgrenze_minor"), a.get("verdienstgrenze_zeitraum")
        if (grenze is None) != (zeitraum is None):
            raise PersonalError(
                "Verdienstgrenze braucht Betrag UND Zeitraum (Monat oder Jahr).",
                status_code=422,
                details={"code": "verdienstgrenze_paar"},
            )
        if grenze is not None and not a.get("currency"):
            raise PersonalError(
                "Die Verdienstgrenze braucht eine Währung (Wurzel 4).",
                status_code=422,
                details={"code": "waehrung_fehlt"},
            )
        if art == "extern":
            if not a.get("firma_id"):
                raise PersonalError("Externe Kräfte brauchen eine Fremdfirma.", status_code=422)
            for feld in ("stundenlohn_minor", "gehalt_minor", "urlaubsanspruch_tage"):
                if a.get(feld) is not None:
                    raise PersonalError(
                        "Externe Kräfte tragen keine Lohn- oder Urlaubsfelder.", status_code=422
                    )
            load_scoped(
                self._db,
                "personal_fremdfirmen",
                str(a["firma_id"]),
                tenant_id,
                columns="id",
                not_found=PersonalError("Fremdfirma nicht gefunden.", status_code=404),
            )
        elif a.get("firma_id"):
            raise PersonalError("Nur externe Kräfte gehören zu einer Fremdfirma.", status_code=422)
        eintritt, austritt = als_date(a.get("eintritt")), als_date(a.get("austritt"))
        if eintritt and austritt and austritt < eintritt:
            raise PersonalError("Austritt liegt vor dem Eintritt.", status_code=422)

    def akte_klartext(self, tenant_id: str, user_id: str) -> dict[str, str | None]:
        """Entschlüsselte Kennungen — NUR für den Lohnexport (EXPORT_LOHN)."""
        row = self._akte_row(tenant_id, user_id) or {}
        aus: dict[str, str | None] = {}
        for name, spalte in _ENC_FELDER.items():
            enc = row.get(spalte)
            aus[name] = entschluesseln(str(enc)) if enc else None
        return aus

    # ------------------------------------------------------------------
    # Fremdfirmen
    # ------------------------------------------------------------------

    def fremdfirmen(self, ctx: AuthContext) -> list[Fremdfirma]:
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("personal_fremdfirmen")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("name")
            .execute()
        ).data or []
        zaehler: dict[str, int] = {}
        for a in (
            self._db.table("personal_akten").select("firma_id").eq("tenant_id", tenant_id).execute()
        ).data or []:
            if a.get("firma_id"):
                zaehler[str(a["firma_id"])] = zaehler.get(str(a["firma_id"]), 0) + 1
        return [self._firma(r, zaehler.get(str(r["id"]), 0)) for r in rows]

    @staticmethod
    def _firma(r: dict[str, Any], anzahl: int) -> Fremdfirma:
        return Fremdfirma(
            id=str(r["id"]),
            name=r["name"],
            kontakt_name=r.get("kontakt_name"),
            kontakt_email=r.get("kontakt_email"),
            kontakt_telefon=r.get("kontakt_telefon"),
            abrechnung=r["abrechnung"],
            satz_minor=r.get("satz_minor"),
            currency=r.get("currency"),
            notiz=r.get("notiz"),
            archived_at=als_dt(r.get("archived_at")),
            anzahl_personen=anzahl,
        )

    def fremdfirma_anlegen(self, ctx: AuthContext, req: FremdfirmaCreate) -> Fremdfirma:
        tenant_id = self._require_tenant(ctx)
        payload = {**req.model_dump(), "tenant_id": tenant_id}
        row = self._db.table("personal_fremdfirmen").insert(payload).execute().data[0]
        return self._firma(row, 0)

    def fremdfirma_aendern(
        self, ctx: AuthContext, firma_id: str, req: FremdfirmaUpdate
    ) -> Fremdfirma:
        tenant_id = self._require_tenant(ctx)
        vorher = load_scoped(
            self._db,
            "personal_fremdfirmen",
            firma_id,
            tenant_id,
            not_found=PersonalError("Fremdfirma nicht gefunden.", status_code=404),
        )
        payload = req.model_dump(exclude_unset=True, exclude={"archiviert"})
        zusammen = {**vorher, **payload}
        if (zusammen.get("satz_minor") is None) != (zusammen.get("currency") is None):
            raise PersonalError("Satz und Währung gehören zusammen.", status_code=422)
        if req.archiviert is not None:
            payload["archived_at"] = jetzt().isoformat() if req.archiviert else None
        if payload:
            (
                self._db.table("personal_fremdfirmen")
                .update(payload)
                .eq("id", firma_id)
                .eq("tenant_id", tenant_id)
                .execute()
            )
        row = load_scoped(
            self._db,
            "personal_fremdfirmen",
            firma_id,
            tenant_id,
            not_found=PersonalError("Fremdfirma nicht gefunden.", status_code=404),
        )
        return self._firma(row, 0)

    # ------------------------------------------------------------------
    # Arbeitsbereiche
    # ------------------------------------------------------------------

    def arbeitsbereiche(
        self, ctx: AuthContext, *, mit_archiv: bool = False
    ) -> list[Arbeitsbereich]:
        tenant_id = self._require_tenant(ctx)
        q = self._db.table("personal_arbeitsbereiche").select("*").eq("tenant_id", tenant_id)
        if not mit_archiv:
            q = q.is_("archived_at", "null")
        rows = q.order("sort").execute().data or []
        return [
            self._bereich(r)
            for r in sorted(rows, key=lambda r: (int(r.get("sort") or 0), str(r["name"])))
        ]

    @staticmethod
    def _bereich(r: dict[str, Any]) -> Arbeitsbereich:
        return Arbeitsbereich(
            id=str(r["id"]),
            name=r["name"],
            kurz=r["kurz"],
            farbe=r["farbe"],
            sort=int(r.get("sort") or 0),
            archived_at=als_dt(r.get("archived_at")),
        )

    def arbeitsbereich_anlegen(self, ctx: AuthContext, req: ArbeitsbereichCreate) -> Arbeitsbereich:
        tenant_id = self._require_tenant(ctx)
        try:
            row = (
                self._db.table("personal_arbeitsbereiche")
                .insert({**req.model_dump(), "tenant_id": tenant_id})
                .execute()
            ).data[0]
        except APIError as exc:
            if getattr(exc, "code", None) == _UNIQUE_VERLETZUNG:
                raise PersonalError(
                    "Diesen Arbeitsbereich gibt es schon.", status_code=409
                ) from exc
            raise
        return self._bereich(row)

    def arbeitsbereich_aendern(
        self, ctx: AuthContext, bereich_id: str, req: ArbeitsbereichUpdate
    ) -> Arbeitsbereich:
        tenant_id = self._require_tenant(ctx)
        load_scoped(
            self._db,
            "personal_arbeitsbereiche",
            bereich_id,
            tenant_id,
            columns="id",
            not_found=PersonalError("Arbeitsbereich nicht gefunden.", status_code=404),
        )
        payload = req.model_dump(exclude_unset=True, exclude={"archiviert"})
        if req.archiviert is not None:
            payload["archived_at"] = jetzt().isoformat() if req.archiviert else None
        if payload:
            (
                self._db.table("personal_arbeitsbereiche")
                .update(payload)
                .eq("id", bereich_id)
                .eq("tenant_id", tenant_id)
                .execute()
            )
        return self._bereich(
            load_scoped(
                self._db,
                "personal_arbeitsbereiche",
                bereich_id,
                tenant_id,
                not_found=PersonalError("Arbeitsbereich nicht gefunden.", status_code=404),
            )
        )

    # ------------------------------------------------------------------
    # Qualifikationen
    # ------------------------------------------------------------------

    def qualifikationen(self, ctx: AuthContext, user_id: str) -> list[Qualifikation]:
        tenant_id = self._require_tenant(ctx)
        self._require_person_im_scope(ctx, tenant_id, user_id)
        rows = (
            self._db.table("personal_qualifikationen")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .execute()
        ).data or []
        return [
            Qualifikation(
                id=str(r["id"]),
                user_id=str(r["user_id"]),
                arbeitsbereich_id=str(r["arbeitsbereich_id"]),
                property_id=r.get("property_id"),
                stufe=r.get("stufe") or "selbststaendig",
            )
            for r in rows
        ]

    def qualifikationen_setzen(
        self, ctx: AuthContext, user_id: str, eintraege: list[QualifikationSet]
    ) -> list[Qualifikation]:
        """Replace-Semantik wie die Objektzuweisung: genau diese Einträge."""
        tenant_id = self._require_tenant(ctx)
        self._require_planbar(tenant_id, user_id)
        bereiche = self._bereiche_namen(tenant_id)
        for e in eintraege:
            if e.arbeitsbereich_id not in bereiche:
                raise PersonalError("Arbeitsbereich nicht gefunden.", status_code=404)
            if e.property_id:
                self._property_im_tenant(tenant_id, e.property_id)
        (
            self._db.table("personal_qualifikationen")
            .delete()
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .execute()
        )
        if eintraege:
            self._db.table("personal_qualifikationen").insert(
                [
                    {
                        "tenant_id": tenant_id,
                        "user_id": user_id,
                        "arbeitsbereich_id": e.arbeitsbereich_id,
                        "property_id": e.property_id,
                        "stufe": e.stufe,
                    }
                    for e in eintraege
                ]
            ).execute()
        return self.qualifikationen(ctx, user_id)

    # ------------------------------------------------------------------
    # Dokumente
    # ------------------------------------------------------------------

    def dokumente(self, ctx: AuthContext, user_id: str) -> list[Dokument]:
        tenant_id = self._require_tenant(ctx)
        self._require_person_im_scope(ctx, tenant_id, user_id)
        rows = (
            self._db.table("personal_dokumente")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .order("created_at")
            .execute()
        ).data or []
        return [self._dokument(r) for r in rows]

    def _dokument(self, r: dict[str, Any]) -> Dokument:
        heute = date.today()
        ablauf = als_date(r.get("ablauf_am"))
        pfad = r.get("storage_pfad")
        if pfad is None:
            zustand = "offen"
        elif ablauf and ablauf < heute:
            zustand = "abgelaufen"
        elif ablauf and ablauf <= heute + timedelta(days=_ABLAUF_WARNUNG_TAGE):
            zustand = "laeuft_ab"
        else:
            zustand = "gueltig"
        return Dokument(
            id=str(r["id"]),
            user_id=str(r["user_id"]),
            art=r["art"],
            titel=r["titel"],
            eingereicht=pfad is not None,
            content_type=r.get("content_type"),
            groesse_bytes=r.get("groesse_bytes"),
            ablauf_am=ablauf,
            angefragt_am=als_dt(r.get("angefragt_am")),
            eingereicht_am=als_dt(r.get("eingereicht_am")),
            geprueft_am=als_dt(r.get("geprueft_am")),
            notiz=r.get("notiz"),
            dokument_nummer=r.get("dokument_nummer"),
            ausgestellt_am=als_date(r.get("ausgestellt_am")),
            behoerde=r.get("behoerde"),
            zustand=zustand,
            download_url=self._signiert(pfad),
        )

    def _signiert(self, pfad: object) -> str | None:
        if not pfad:
            return None
        try:
            signed = self._db.storage.from_(_BUCKET).create_signed_url(str(pfad), _URL_TTL)
        except Exception as exc:  # noqa: BLE001 — ein Dokument ohne Link statt 500
            log.warning(
                "personal_dokument_signieren_fehlgeschlagen", pfad=str(pfad), error=str(exc)
            )
            return None
        if isinstance(signed, dict):
            return signed.get("signedURL") or signed.get("signedUrl")
        return None

    def dokument_anfragen(self, ctx: AuthContext, user_id: str, req: DokumentAnfrage) -> Dokument:
        tenant_id = self._require_tenant(ctx)
        self._require_planbar(tenant_id, user_id)
        row = (
            self._db.table("personal_dokumente")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                    "art": req.art,
                    "titel": req.titel,
                    "ablauf_am": req.ablauf_am.isoformat() if req.ablauf_am else None,
                    "notiz": req.notiz,
                    "angefragt_am": jetzt().isoformat(),
                }
            )
            .execute()
            .data[0]
        )
        return self._dokument(row)

    def dokument_hochladen(  # noqa: PLR0913 — Datei + Metadaten
        self,
        ctx: AuthContext,
        user_id: str,
        *,
        content: bytes,
        dateiname: str,
        art: str,
        titel: str | None,
        ablauf_am: date | None,
        dokument_id: str | None = None,
    ) -> Dokument:
        """Datei zu einem angefragten Dokument oder als neues Dokument.

        Die eigene Person darf hochladen (Attest, Ausweis), die Leitung für jede
        Person im Scope. Typ aus den Magic-Bytes, Größe gedeckelt (Wurzel 8).
        """
        tenant_id = self._require_tenant(ctx)
        self._require_person_im_scope(ctx, tenant_id, user_id)
        if not content:
            raise PersonalError("Leere Datei.", status_code=422)
        if len(content) > _MAX_DOKUMENT_BYTES:
            raise PersonalError("Datei zu groß (max. 20 MB).", status_code=413)
        mime = _dateityp(content)
        if mime is None:
            raise PersonalError("Nur PDF, JPG, PNG oder WebP.", status_code=422)
        endung = {
            "application/pdf": "pdf",
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
        }[mime]
        pfad = f"{tenant_id}/{user_id}/{uuid4().hex}.{endung}"
        self._db.storage.from_(_BUCKET).upload(
            pfad, content, {"content-type": mime, "upsert": "false"}
        )
        werte = {
            "storage_pfad": pfad,
            "content_type": mime,
            "groesse_bytes": len(content),
            "eingereicht_am": jetzt().isoformat(),
        }
        if dokument_id:
            load_scoped(
                self._db,
                "personal_dokumente",
                dokument_id,
                tenant_id,
                columns="id, user_id",
                not_found=PersonalError("Dokument nicht gefunden.", status_code=404),
            )
            (
                self._db.table("personal_dokumente")
                .update(werte)
                .eq("id", dokument_id)
                .eq("tenant_id", tenant_id)
                .eq("user_id", user_id)
                .execute()
            )
            row = load_scoped(
                self._db,
                "personal_dokumente",
                dokument_id,
                tenant_id,
                not_found=PersonalError("Dokument nicht gefunden.", status_code=404),
            )
        else:
            row = (
                self._db.table("personal_dokumente")
                .insert(
                    {
                        **werte,
                        "tenant_id": tenant_id,
                        "user_id": user_id,
                        "art": art,
                        "titel": (titel or dateiname or art)[:200],
                        "ablauf_am": ablauf_am.isoformat() if ablauf_am else None,
                    }
                )
                .execute()
                .data[0]
            )
        log.info(
            "personal_dokument_hochgeladen",
            tenant_id=tenant_id,
            user_id=user_id,
            art=art,
            bytes=len(content),
        )
        return self._dokument(row)

    def dokument_aendern(self, ctx: AuthContext, dokument_id: str, req: DokumentUpdate) -> Dokument:
        tenant_id = self._require_tenant(ctx)
        load_scoped(
            self._db,
            "personal_dokumente",
            dokument_id,
            tenant_id,
            columns="id",
            not_found=PersonalError("Dokument nicht gefunden.", status_code=404),
        )
        payload: dict[str, Any] = {}
        felder = req.model_dump(exclude_unset=True, exclude={"geprueft"})
        for k, v in felder.items():
            payload[k] = v.isoformat() if isinstance(v, date) else v
        if req.geprueft is not None:
            payload["geprueft_am"] = jetzt().isoformat() if req.geprueft else None
            payload["geprueft_von"] = ctx.user_id if req.geprueft else None
        if payload:
            (
                self._db.table("personal_dokumente")
                .update(payload)
                .eq("id", dokument_id)
                .eq("tenant_id", tenant_id)
                .execute()
            )
        return self._dokument(
            load_scoped(
                self._db,
                "personal_dokumente",
                dokument_id,
                tenant_id,
                not_found=PersonalError("Dokument nicht gefunden.", status_code=404),
            )
        )

    def dokument_loeschen(self, ctx: AuthContext, dokument_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        row = load_scoped(
            self._db,
            "personal_dokumente",
            dokument_id,
            tenant_id,
            columns="id, storage_pfad",
            not_found=PersonalError("Dokument nicht gefunden.", status_code=404),
        )
        if row.get("storage_pfad"):
            try:
                self._db.storage.from_(_BUCKET).remove([str(row["storage_pfad"])])
            except Exception as exc:  # noqa: BLE001 — Datei-Rest hält die Zeile nicht
                log.warning(
                    "personal_dokument_datei_nicht_geloescht",
                    pfad=row["storage_pfad"],
                    error=str(exc),
                )
        (
            self._db.table("personal_dokumente")
            .delete()
            .eq("id", dokument_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )

    # ------------------------------------------------------------------
    # Regeln
    # ------------------------------------------------------------------

    def _tenant_land(self, tenant_id: str) -> str:
        rows = (
            self._db.table("tenants").select("country").eq("id", tenant_id).limit(1).execute()
        ).data or []
        land = (rows[0].get("country") if rows else None) or ""
        if not land:
            raise PersonalError("Das Land des Betriebs ist nicht erfasst.", status_code=422)
        return str(land).upper()

    def regeln(self, ctx: AuthContext) -> Regeln | None:
        tenant_id = self._require_tenant(ctx)
        row = self._regeln_row(tenant_id)
        return self._regeln_aus_row(row) if row else None

    @staticmethod
    def _regeln_aus_row(row: dict[str, Any]) -> Regeln:
        return Regeln(
            land=str(row["land"]),
            zeitzone=str(row["zeitzone"]),
            feiertage_region=row.get("feiertage_region"),
            ruhezeit_stunden=float(row["ruhezeit_stunden"]),
            max_tagesstunden=float(row["max_tagesstunden"]),
            max_wochenstunden=float(row["max_wochenstunden"]),
            nacht_von=als_time(row["nacht_von"]),  # type: ignore[arg-type]
            nacht_bis=als_time(row["nacht_bis"]),  # type: ignore[arg-type]
            zuschlag_nacht_pct=float(row["zuschlag_nacht_pct"]),
            zuschlag_sonntag_pct=float(row["zuschlag_sonntag_pct"]),
            zuschlag_feiertag_pct=float(row["zuschlag_feiertag_pct"]),
            zuschlag_ueberstunden_pct=float(row["zuschlag_ueberstunden_pct"]),
            urlaubsjahr_start_monat=int(row["urlaubsjahr_start_monat"]),
            uebertrag_verfall_monat=row.get("uebertrag_verfall_monat"),
            uebertrag_max_tage=als_float(row.get("uebertrag_max_tage")),
            mindest_vorlauf_urlaub_tage=int(row.get("mindest_vorlauf_urlaub_tage") or 0),
            datev_berater_nr=row.get("datev_berater_nr"),
            datev_mandanten_nr=row.get("datev_mandanten_nr"),
            lohnarten=dict(row.get("lohnarten") or {}),
            bestaetigt_am=als_dt(row.get("bestaetigt_am")),
            bestaetigt_von=row.get("bestaetigt_von"),
        )

    def regel_vorschlag(self, ctx: AuthContext) -> RegelVorschlag:
        tenant_id = self._require_tenant(ctx)
        land = self._tenant_land(tenant_id)
        vorschlag, spezifisch = laender.vorschlag_fuer(land)
        if vorschlag is None:
            return RegelVorschlag(
                land=land,
                vorhanden=False,
                hinweise=[
                    "Für dieses Land liegen keine Vorschlagswerte vor — bitte selbst eintragen."
                ],
            )
        zone = laender.zeitzone_fuer(land)
        werte = RegelnSet(
            zeitzone=zone or "UTC",
            ruhezeit_stunden=vorschlag.ruhezeit_stunden,
            max_tagesstunden=vorschlag.max_tagesstunden,
            max_wochenstunden=vorschlag.max_wochenstunden,
            nacht_von=vorschlag.nacht_von,
            nacht_bis=vorschlag.nacht_bis,
            zuschlag_nacht_pct=vorschlag.zuschlag_nacht_pct,
            zuschlag_sonntag_pct=vorschlag.zuschlag_sonntag_pct,
            zuschlag_feiertag_pct=vorschlag.zuschlag_feiertag_pct,
            zuschlag_ueberstunden_pct=vorschlag.zuschlag_ueberstunden_pct,
            urlaubsjahr_start_monat=vorschlag.urlaubsjahr_start_monat,
            uebertrag_verfall_monat=vorschlag.uebertrag_verfall_monat,
        )
        hinweise = list(vorschlag.hinweise)
        if not spezifisch:
            hinweise.insert(0, "Nur EU-Mindestwerte hinterlegt.")
        if zone is None:
            hinweise.append("Zeitzone bitte setzen (kein Vorschlag).")
        return RegelVorschlag(
            land=land, vorhanden=True, werte=werte, quelle=vorschlag.quelle, hinweise=hinweise
        )

    def regeln_bestaetigen(self, ctx: AuthContext, req: RegelnSet) -> Regeln:
        """Speichert UND bestätigt — die Werte sind ab jetzt die Wahrheit."""
        tenant_id = self._require_tenant(ctx)
        land = self._tenant_land(tenant_id)
        try:
            from zoneinfo import ZoneInfo  # noqa: PLC0415 — nur zur Prüfung

            ZoneInfo(req.zeitzone)
        except (KeyError, ValueError) as exc:
            raise PersonalError("Unbekannte Zeitzone.", status_code=422) from exc
        payload = {
            **req.model_dump(),
            "nacht_von": req.nacht_von.isoformat(),
            "nacht_bis": req.nacht_bis.isoformat(),
            "tenant_id": tenant_id,
            "land": land,
            "bestaetigt_am": jetzt().isoformat(),
            "bestaetigt_von": ctx.user_id,
        }
        self._db.table("personal_regeln").upsert(payload, on_conflict="tenant_id").execute()
        log.info("personal_regeln_bestaetigt", tenant_id=tenant_id, land=land, von=ctx.user_id)
        row = self._regeln_row(tenant_id)
        if row is None:
            raise PersonalError("Regeln konnten nicht gelesen werden.", status_code=500)
        return self._regeln_aus_row(row)

    # ------------------------------------------------------------------
    # Pausenmodelle
    # ------------------------------------------------------------------

    def pausenmodelle(self, ctx: AuthContext) -> list[Pausenmodell]:
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("personal_pausenmodelle")
            .select("*")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return [
            Pausenmodell(
                id=str(r["id"]),
                arbeitsbereich_id=r.get("arbeitsbereich_id"),
                ab_minuten=int(r["ab_minuten"]),
                pause_minuten=int(r["pause_minuten"]),
            )
            for r in sorted(
                rows, key=lambda r: (str(r.get("arbeitsbereich_id") or ""), int(r["ab_minuten"]))
            )
        ]

    def pausenmodelle_setzen(
        self, ctx: AuthContext, eintraege: list[PausenmodellSet]
    ) -> list[Pausenmodell]:
        tenant_id = self._require_tenant(ctx)
        bereiche = self._bereiche_namen(tenant_id)
        for e in eintraege:
            if e.arbeitsbereich_id and e.arbeitsbereich_id not in bereiche:
                raise PersonalError("Arbeitsbereich nicht gefunden.", status_code=404)
        self._db.table("personal_pausenmodelle").delete().eq("tenant_id", tenant_id).execute()
        if eintraege:
            self._db.table("personal_pausenmodelle").insert(
                [{**e.model_dump(), "tenant_id": tenant_id} for e in eintraege]
            ).execute()
        return self.pausenmodelle(ctx)

    # ------------------------------------------------------------------
    # Schichtvorlagen
    # ------------------------------------------------------------------

    def vorlagen(self, ctx: AuthContext, *, mit_archiv: bool = False) -> list[Schichtvorlage]:
        tenant_id = self._require_tenant(ctx)
        q = self._db.table("personal_schichtvorlagen").select("*").eq("tenant_id", tenant_id)
        if not mit_archiv:
            q = q.is_("archived_at", "null")
        rows = q.execute().data or []
        return [
            self._vorlage(r)
            for r in sorted(rows, key=lambda r: (int(r.get("sort") or 0), str(r["name"])))
        ]

    @staticmethod
    def _vorlage(r: dict[str, Any]) -> Schichtvorlage:
        return Schichtvorlage(
            id=str(r["id"]),
            name=r["name"],
            kurz=r["kurz"],
            start_zeit=als_time(r["start_zeit"]),  # type: ignore[arg-type]
            end_zeit=als_time(r["end_zeit"]),  # type: ignore[arg-type]
            pause_min=int(r.get("pause_min") or 0),
            farbe=r["farbe"],
            arbeitsbereich_id=r.get("arbeitsbereich_id"),
            sort=int(r.get("sort") or 0),
            archived_at=als_dt(r.get("archived_at")),
        )

    def vorlage_anlegen(self, ctx: AuthContext, req: SchichtvorlageCreate) -> Schichtvorlage:
        tenant_id = self._require_tenant(ctx)
        if req.arbeitsbereich_id and req.arbeitsbereich_id not in self._bereiche_namen(tenant_id):
            raise PersonalError("Arbeitsbereich nicht gefunden.", status_code=404)
        payload = {
            **req.model_dump(),
            "tenant_id": tenant_id,
            "start_zeit": req.start_zeit.isoformat(),
            "end_zeit": req.end_zeit.isoformat(),
        }
        try:
            row = self._db.table("personal_schichtvorlagen").insert(payload).execute().data[0]
        except APIError as exc:
            if getattr(exc, "code", None) == _UNIQUE_VERLETZUNG:
                raise PersonalError("Diese Vorlage gibt es schon.", status_code=409) from exc
            raise
        return self._vorlage(row)

    def vorlage_aendern(
        self, ctx: AuthContext, vorlage_id: str, req: SchichtvorlageUpdate
    ) -> Schichtvorlage:
        tenant_id = self._require_tenant(ctx)
        load_scoped(
            self._db,
            "personal_schichtvorlagen",
            vorlage_id,
            tenant_id,
            columns="id",
            not_found=PersonalError("Vorlage nicht gefunden.", status_code=404),
        )
        payload: dict[str, Any] = {}
        for k, v in req.model_dump(exclude_unset=True, exclude={"archiviert"}).items():
            payload[k] = v.isoformat() if hasattr(v, "isoformat") else v
        if req.archiviert is not None:
            payload["archived_at"] = jetzt().isoformat() if req.archiviert else None
        if payload:
            (
                self._db.table("personal_schichtvorlagen")
                .update(payload)
                .eq("id", vorlage_id)
                .eq("tenant_id", tenant_id)
                .execute()
            )
        return self._vorlage(
            load_scoped(
                self._db,
                "personal_schichtvorlagen",
                vorlage_id,
                tenant_id,
                not_found=PersonalError("Vorlage nicht gefunden.", status_code=404),
            )
        )
