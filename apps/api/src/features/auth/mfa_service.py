"""Zwei-Faktor-Authentifizierung: Pflicht-Erzwingung (AAL2) und der eine
Faktor, den GoTrue nicht kennt (Wiederherstellungscodes).

Leitgedanke (CLAUDE.md, Wurzel 7): Der direkte GoTrue-Login
(`POST /auth/v1/token`, anon-Key) umgeht JEDE App-Route. Eine 2FA, die nur in
`/api/v1/auth/login` sitzt, beruehrt einen Angreifer nie. Deshalb:

- Enrollment, Challenge und Verify der drei echten Faktoren (TOTP, SMS/Phone,
  WebAuthn/Passkey) macht **GoTrue selbst** — live gegen `auth.factor_type`
  geprueft, v2.189.0 kann alle drei nativ. Hier wird nichts davon nachgebaut,
  sonst gaebe es zwei Wahrheiten ueber „hat einen zweiten Faktor".
- Was GoTrue nach bestandenem Faktor ausstellt, ist ein Token mit `aal: aal2`.
  Dieser Claim ist die einzige Quelle der Wahrheit und wird zentral in
  `core.security.get_current_user` geprueft — also auf JEDEM Endpunkt und
  unabhaengig davon, ueber welchen Weg das Token entstanden ist.
- Die Rolle fuer die Pflichtpruefung kommt aus der **DB** (`public.users.role`),
  nie aus dem JWT: eine entzogene Admin-Rolle wuerde sonst bis zum Token-Ablauf
  weitergelten (Wurzel 7).

Wiederherstellungscodes sind der Rettungsweg und liegen in
`public.mfa_recovery_code` — nur als SHA-256-Hash (Wurzel 6), Einloesung als
atomarer DB-Claim (Wurzel 2), byteweiser Vergleich (Wurzel 5).
"""
from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import secrets_match

log = get_logger("nextdays.auth.mfa")

# Rollen, fuer die ein zweiter Faktor PFLICHT ist (Entscheidung des Nutzers).
# Bewusst ein frozenset an EINER Stelle: eine weitere Pflichtrolle ist ein
# Eintrag hier, keine zweite Verzweigung irgendwo im Guard.
PFLICHT_ROLLEN = frozenset({"admin", "co_admin"})

# Einrichtungsfrist fuer BESTANDSKONTEN einer Pflichtrolle, die noch keinen
# Faktor haben. Begruendung siehe Migration 0341: eine sofort greifende Sperre
# haette mit dem Einspielen jeden bestehenden Admin ausgesperrt, auch den, der
# den Fehler beheben muesste. Waehrend der Frist kommt der Nutzer durch und
# bekommt bei jedem Request die Aufforderung; danach ist zu.
# Die Frist gilt NUR fuer das Fehlen eines Faktors — wer einen hat, muss ihn
# ab sofort loesen (dort gibt es keine Kulanz).
GRACE_DAUER = timedelta(days=14)

# Anzahl und Entropie der Wiederherstellungscodes. 10 Codes a 10 Zeichen aus
# einem 32er-Alphabet = ~50 Bit je Code — weit ausserhalb von Bruteforce, und
# der Einloese-Endpunkt liegt zusaetzlich im strengen `mfa`-Rate-Limit-Bucket.
RECOVERY_CODE_ANZAHL = 10
_RECOVERY_CODE_LAENGE = 10
# Crockford-Base32 ohne I/L/O/U: keine Verwechslung von 0/O und 1/I/L beim
# Abtippen, kein zufaelliges Bilden anstoessiger Woerter (kein U).
_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

# Pfade, die ein Konto unter Enrollment-Zwang noch benutzen darf — sonst
# koennte es die geforderte 2FA gar nicht erst einrichten (das waere eine
# Sperre ohne Ausweg). Bewusst eng: nur die 2FA-Einrichtung selbst, die
# Kontoanzeige und das Abmelden.
ENROLLMENT_ERLAUBTE_PFADE = (
    "/auth/mfa/",
    "/auth/account",
    "/auth/logout",
)


class MfaError(Exception):
    """Fachlicher 2FA-Fehler mit HTTP-Status (nie ein 500 aus Nutzereingabe)."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class MfaPflicht:
    """Ergebnis der Pflichtpruefung fuer EINEN Nutzer.

    `erzwingen` = der Zugang ist zu (Frist abgelaufen oder nie eine gehabt).
    `grace_until` = solange darf er noch durch, wird aber aufgefordert.
    """

    pflichtig: bool
    hat_faktor: bool
    erzwingen: bool
    grace_until: datetime | None


def _now() -> datetime:
    return datetime.now(UTC)


def _zeit(wert: str) -> datetime:
    """Einen Zeitstempel aus der DB robust als AWARE datetime lesen.

    Wichtig, weil `_now()` aware ist: ein NAIVER Wert (Zeitstempel ohne
    Offset) wuerde beim Vergleich `_now() >= grace_until` einen TypeError
    werfen — und der ist KEIN MfaError, liefe also am fail-closed-Zweig des
    Guards vorbei in einen 500. Genau die Konten, die dann nicht mehr
    durchkaemen, sind die pflichtigen ohne Faktor: sie koennten die geforderte
    2FA nicht einmal mehr einrichten, weil auch /auth/mfa/* stuerbe.
    Dasselbe Muster wie `inbox.scheduler._parse` — bewusst keine dritte
    Variante mit eigenem Verhalten.
    """
    dt = datetime.fromisoformat(wert.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt


def _hash_code(code: str) -> str:
    """Normalisieren und hashen. Die Normalisierung (Trim, Grossschreibung,
    Bindestriche raus) MUSS beim Erzeugen und beim Einloesen identisch sein —
    sonst matcht kein einziger Code. Deshalb genau diese eine Funktion."""
    normalisiert = code.strip().upper().replace("-", "").replace(" ", "")
    return hashlib.sha256(normalisiert.encode()).hexdigest()


def _neuer_code() -> str:
    """Ein Wiederherstellungscode. `secrets`, nicht `random` (Wurzel 5)."""
    roh = "".join(secrets.choice(_ALPHABET) for _ in range(_RECOVERY_CODE_LAENGE))
    # In zwei Bloecken ausgeben (XXXXX-XXXXX) — reine Lesehilfe, der Hash
    # laeuft ueber die normalisierte Form ohne Bindestrich.
    return f"{roh[:5]}-{roh[5:]}"


class MfaService:
    """Alles, was NICHT GoTrue macht: Pflicht-Status und Wiederherstellungscodes.

    Arbeitet ausschliesslich mit dem service_role-Client — alle drei Tabellen
    aus 0341 sind fuer anon/authenticated hart gesperrt (Wurzel 6).
    """

    def __init__(self, db: Client) -> None:
        self._db = db

    # -- Faktoren (aus GoTrue gelesen, nicht selbst gefuehrt) ---------------

    def faktoren(self, user_id: str) -> list[dict]:
        """Die VERIFIZIERTEN Faktoren eines Nutzers aus `auth.mfa_factors`.

        Bewusst nur `status='verified'`: eine angefangene, nie bestaetigte
        Enrollment-Zeile ist kein zweiter Faktor. Sie als solchen zu zaehlen
        waere ein Fallback auf einen Wunschzustand (Wurzel 4) — und wuerde die
        Pflicht aushebeln, indem man ein Enrollment startet und abbricht.
        """
        try:
            res = self._db.rpc(
                "mfa_faktoren_lesen", {"p_user_id": user_id}
            ).execute()
        except APIError as exc:
            # Fail-CLOSED (Wurzel 5): Wenn nicht feststellbar ist, ob ein
            # Faktor existiert, darf das NICHT als „hat keinen, lass durch"
            # gelten. Der Aufrufer uebersetzt das in einen 503.
            log.error("mfa_faktoren_lesen_failed", user_id=user_id, error=str(exc))
            raise MfaError(
                "Faktor-Status nicht ermittelbar.", status_code=503
            ) from exc
        return list(res.data or [])

    def hat_faktor(self, user_id: str) -> bool:
        return bool(self.faktoren(user_id))

    # -- Pflicht-Erzwingung -------------------------------------------------

    def rolle_aus_db(self, user_id: str) -> str | None:
        """Die Rolle aus `public.users` — die Quelle der Wahrheit.

        NICHT aus `ctx.role` (JWT): ein entzogener Admin behielte seine Rolle
        sonst bis zum Token-Ablauf und damit auch seine Pflicht-Ausnahme
        (Wurzel 7).
        """
        res = (
            self._db.table("users")
            .select("role")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        return res.data[0].get("role") if res.data else None

    def pflicht_pruefen(
        self, user_id: str, *, rolle: str | None, tenant_id: str | None = None
    ) -> MfaPflicht:
        """Muss dieser Nutzer einen zweiten Faktor haben, und ist er faellig?

        Setzt die Frist beim ERSTEN Kontakt eines pflichtigen Kontos ohne
        Faktor (nicht vorab fuer alle) — so laeuft sie ab dem ersten Login und
        nicht ab dem Zeitpunkt der Migration, an dem niemand die Aufforderung
        gesehen haette.

        AUSNAHME VORFUEHR-MANDANT (0407): dort gibt es keine Pflicht. Der
        Vorfuehr-Zugang traegt Rolle `admin` und waere damit pflichtig — aber
        einrichten KANN ihn niemand: das Enrollment ist ein Schreibvorgang, den
        der Demo-Riegel ablehnt. Die Folge waere, dass sich die Vorfuehrung nach
        Ablauf der Frist selbst abschaltet (gemessen: Frist lief auf den
        23.08.2026) und jeder Besucher einen 401 saehe. Eine Pflicht, die
        strukturell nicht erfuellbar ist, ist keine Sicherheitsmassnahme,
        sondern eine Zeitbombe.

        Der Zugang ist dadurch nicht schwaecher geschuetzt: er kann
        ausschliesslich lesen, und was er liest, ist ein Bestand aus erfundenen
        Buchungen.
        """
        if tenant_id and self._ist_demo_mandant(tenant_id):
            return MfaPflicht(
                pflichtig=False, hat_faktor=False, erzwingen=False, grace_until=None
            )

        if rolle not in PFLICHT_ROLLEN:
            return MfaPflicht(
                pflichtig=False, hat_faktor=False, erzwingen=False, grace_until=None
            )

        if self.hat_faktor(user_id):
            # Faktor vorhanden → Frist ist gegenstandslos. Einmalig festhalten,
            # damit sie nie wieder neu vergeben wird (auch nicht, wenn der
            # Nutzer den Faktor spaeter entfernt).
            self._enrollment_festhalten(user_id)
            return MfaPflicht(
                pflichtig=True, hat_faktor=True, erzwingen=False, grace_until=None
            )

        grace_until = self._grace_holen_oder_setzen(user_id)
        return MfaPflicht(
            pflichtig=True,
            hat_faktor=False,
            erzwingen=_now() >= grace_until,
            grace_until=grace_until,
        )

    def _ist_demo_mandant(self, tenant_id: str) -> bool:
        """Ist das der oeffentliche Vorfuehr-Mandant? (0407)

        Ein Lesefehler heisst NICHT „Demo": faellt die Abfrage aus, gilt die
        Pflicht weiter. Das ist die sichere Richtung — im Zweifel mahnen statt
        eine Pflicht stillschweigend fallen zu lassen (Wurzel 5).
        """
        try:
            res = (
                self._db.table("tenants")
                .select("is_demo")
                .eq("id", tenant_id)
                .limit(1)
                .execute()
            )
        except Exception as exc:  # noqa: BLE001 — im Zweifel gilt die Pflicht
            log.warning(
                "mfa_demo_pruefung_fehlgeschlagen",
                tenant_id=tenant_id,
                error=str(exc)[:200],
            )
            return False
        rows = res.data or []
        return bool(rows and rows[0].get("is_demo"))

    def _grace_holen_oder_setzen(self, user_id: str) -> datetime:
        """Die Frist dieses Nutzers. Fehlt sie, wird sie JETZT + GRACE_DAUER
        gesetzt und zurueckgegeben.

        Idempotent (Wurzel 2): der Insert laeuft als upsert mit
        `ignore_duplicates`, damit zwei parallele Requests desselben Nutzers
        nicht zwei Fristen anlegen bzw. die bestehende verlaengern. Ein Retry
        darf die Frist NIE nach hinten schieben — sonst koennte ein Konto sie
        durch simples Neuladen ewig verlaengern.
        """
        res = (
            self._db.table("mfa_enforcement")
            .select("grace_until, enrolled_at")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        row = res.data[0] if res.data else None
        if row and row.get("grace_until"):
            return _zeit(row["grace_until"])

        grace_until = _now() + GRACE_DAUER
        try:
            self._db.table("mfa_enforcement").upsert(
                {"user_id": user_id, "grace_until": grace_until.isoformat()},
                on_conflict="user_id",
                ignore_duplicates=True,
            ).execute()
        except APIError as exc:
            log.error("mfa_grace_setzen_failed", user_id=user_id, error=str(exc))
            raise MfaError("2FA-Status nicht ermittelbar.", status_code=503) from exc

        # Zurueckgelesen statt den lokal berechneten Wert zu glauben: hat ein
        # paralleler Request die Zeile zuerst angelegt, gilt DESSEN Frist.
        nach = (
            self._db.table("mfa_enforcement")
            .select("grace_until")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if nach.data and nach.data[0].get("grace_until"):
            return _zeit(nach.data[0]["grace_until"])
        return grace_until

    def _enrollment_festhalten(self, user_id: str) -> None:
        """`enrolled_at` einmalig setzen, sobald ein Faktor existiert."""
        try:
            res = (
                self._db.table("mfa_enforcement")
                .select("enrolled_at")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if res.data and res.data[0].get("enrolled_at"):
                return
            self._db.table("mfa_enforcement").upsert(
                {
                    "user_id": user_id,
                    "enrolled_at": _now().isoformat(),
                    "grace_until": None,
                },
                on_conflict="user_id",
            ).execute()
        except APIError as exc:  # noqa: BLE001 — Buchhaltung, nie den Login kippen
            # Best effort: `enrolled_at` ist eine Notiz, keine Zugangskontrolle.
            # Der Faktor existiert bereits — der Nutzer kommt so oder so durch.
            log.warning("mfa_enrollment_notiz_failed", user_id=user_id, error=str(exc))

    # -- Wiederherstellungscodes -------------------------------------------

    def codes_erzeugen(self, user_id: str) -> list[str]:
        """Neue Wiederherstellungscodes. ERSETZT alle bisherigen.

        Der Klartext existiert genau einmal: in dieser Rueckgabe. Gespeichert
        wird nur der Hash (Wurzel 6). Das Ersetzen ist der Gegenzustand
        (Wurzel 1): alte Codes duerfen nach einer Neuausgabe nicht weiter
        gelten, sonst waechst der Vorrat gueltiger Codes bei jedem Aufruf.
        """
        codes = [_neuer_code() for _ in range(RECOVERY_CODE_ANZAHL)]
        # ZUERST loeschen, DANN einfuegen. Andersherum koennte ein Fehler beim
        # Loeschen alte und neue Codes gleichzeitig gueltig lassen.
        self._db.table("mfa_recovery_code").delete().eq("user_id", user_id).execute()
        self._db.table("mfa_recovery_code").insert(
            [{"user_id": user_id, "code_hash": _hash_code(c)} for c in codes]
        ).execute()
        log.info("mfa_recovery_codes_issued", user_id=user_id, anzahl=len(codes))
        return codes

    def codes_offen(self, user_id: str) -> int:
        """Wie viele Wiederherstellungscodes noch einloesbar sind."""
        res = (
            self._db.table("mfa_recovery_code")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .is_("used_at", "null")
            .execute()
        )
        return res.count or 0

    def code_einloesen(self, user_id: str, code: str, *, ip: str | None) -> None:
        """Einen Wiederherstellungscode einloesen. Erfolg = der Code ist
        danach dauerhaft verbraucht.

        Wurzel 2 (doppelte Einloesung): Der Verbrauch ist ein ATOMARER CLAIM —
        das Update filtert selbst auf `used_at is null` und liefert die
        getroffenen Zeilen zurueck. Zwei parallele Requests mit demselben Code
        koennen deshalb nicht beide gewinnen: der zweite trifft 0 Zeilen und
        wird abgelehnt. Ein „lesen, pruefen, dann schreiben" haette hier ein
        Zeitfenster gehabt.

        Wurzel 5: Vergleich byteweise ueber `secrets_match` gegen den Hash,
        nicht per `==` und nicht gegen den Klartext.
        """
        gesucht = _hash_code(code)
        offene = (
            self._db.table("mfa_recovery_code")
            .select("id, code_hash")
            .eq("user_id", user_id)
            .is_("used_at", "null")
            .execute()
        ).data or []

        treffer_id: str | None = None
        for zeile in offene:
            if secrets_match(gesucht, zeile.get("code_hash")):
                treffer_id = zeile["id"]
                break
        if treffer_id is None:
            log.warning("mfa_recovery_code_invalid", user_id=user_id)
            raise MfaError("Code ist ungültig.", status_code=401)

        # Der Claim. `is_("used_at", "null")` steht bewusst NOCHMAL in der
        # Bedingung, obwohl oben nur offene gelesen wurden — genau das
        # schliesst das Rennen zwischen Lesen und Schreiben.
        beansprucht = (
            self._db.table("mfa_recovery_code")
            .update({"used_at": _now().isoformat(), "used_ip": ip})
            .eq("id", treffer_id)
            .is_("used_at", "null")
            .execute()
        ).data or []
        if not beansprucht:
            # Ein paralleler Request war schneller. Kein Erfolg vortaeuschen.
            log.warning("mfa_recovery_code_race", user_id=user_id)
            raise MfaError("Code ist ungültig.", status_code=401)

        log.info(
            "mfa_recovery_code_redeemed",
            user_id=user_id,
            verbleibend=self.codes_offen(user_id),
        )

    # -- Faktor entfernen (Aussperr-Schutz) --------------------------------

    def faktor_entfernen_erlaubt(self, user_id: str, factor_id: str) -> None:
        """Darf dieser Faktor weg, ohne den Nutzer auszusperren?

        Es geht NICHT darum, das Entfernen zu erschweren, sondern darum, dass
        ein Pflicht-Konto sich nicht selbst den letzten Schluessel wegnimmt und
        danach vom eigenen Guard ausgesperrt wird. Bleibt ein anderer Faktor
        ODER ein Wiederherstellungscode, ist alles offen.
        """
        vorhandene = self.faktoren(user_id)
        if not any(f.get("id") == factor_id for f in vorhandene):
            # Wurzel 9: nur eigene Faktoren — die Liste ist bereits auf den
            # Nutzer gescoped, ein fremder factor_id trifft hier nichts.
            raise MfaError("Faktor nicht gefunden.", status_code=404)

        if len(vorhandene) > 1:
            return

        rolle = self.rolle_aus_db(user_id)
        if rolle not in PFLICHT_ROLLEN:
            return

        if self.codes_offen(user_id) == 0:
            raise MfaError(
                "Das ist der letzte zweite Faktor und es sind keine "
                "Wiederherstellungscodes übrig. Erzeuge zuerst neue Codes "
                "oder richte einen weiteren Faktor ein.",
                status_code=409,
            )

    def faktor_entfernen(self, user_id: str, factor_id: str) -> None:
        """EINEN Faktor entfernen. Die Erlaubnis prueft
        `faktor_entfernen_erlaubt` VORHER — hier passiert nur noch die Tat.

        Der Aufruf ist auf den Nutzer gescoped (Wurzel 3/9): die RPC loescht
        ausschliesslich Zeilen mit passendem user_id UND factor_id, ein
        fremder Faktor ist damit auch bei manipulierter ID nicht erreichbar.
        """
        try:
            self._db.rpc(
                "mfa_faktor_loeschen",
                {"p_user_id": user_id, "p_factor_id": factor_id},
            ).execute()
        except APIError as exc:
            log.error(
                "mfa_faktor_entfernen_failed", user_id=user_id, error=str(exc)
            )
            raise MfaError(
                "Faktor konnte nicht entfernt werden.", status_code=502
            ) from exc
        log.info("mfa_factor_removed", user_id=user_id, factor_id=factor_id)

    def email_von(self, user_id: str) -> str | None:
        """E-Mail eines Nutzers fuer die Audit-Zeile. Fehlt sie, bleibt das
        Feld leer — kein erfundener Platzhalter (Wurzel 4)."""
        res = (
            self._db.table("users")
            .select("email")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        return res.data[0].get("email") if res.data else None

    def faktoren_zuruecksetzen(self, user_id: str) -> list[dict]:
        """ALLE Faktoren eines Nutzers entfernen (Admin-Rettung).

        Gibt zurueck, was entfernt wurde — die Audit-Zeile soll belegen, ob ein
        Passkey oder nur eine SMS-Nummer fiel, nicht bloss „irgendwas".
        """
        vorher = self.faktoren(user_id)
        # ALLES in einem try: schlaegt ein Schritt NACH dem Faktor-Loeschen
        # fehl, darf das nicht als Erfolg durchgehen. Sonst waeren die Faktoren
        # weg, die alten Wiederherstellungscodes aber noch gueltig — ein
        # halbfertiger Zustand, und die Audit-Zeile (die der Aufrufer erst
        # danach schreibt) gaebe es auch nicht (Wurzel 5).
        try:
            self._db.rpc("mfa_faktoren_loeschen", {"p_user_id": user_id}).execute()
            # Wiederherstellungscodes ebenfalls entwerten: sie gehoerten zur
            # alten 2FA-Einrichtung (Wurzel 1 — Gegenzustand mitpflegen).
            self._db.table("mfa_recovery_code").delete().eq(
                "user_id", user_id
            ).execute()
            self._db.table("mfa_enforcement").upsert(
                {
                    "user_id": user_id,
                    "enrolled_at": None,
                    # Die Frist NUR anstossen, wenn das Konto noch keine hatte
                    # bzw. die alte schon abgelaufen ist — siehe
                    # `_reset_frist`. Sie hier bedingungslos auf „jetzt + 14
                    # Tage" zu setzen, machte den Admin-Reset zum Schalter,
                    # mit dem sich die Pflicht beliebig oft verlaengern
                    # laesst (Faktor anlegen → reset → 14 neue Tage → …).
                    "grace_until": self._reset_frist(user_id).isoformat(),
                },
                on_conflict="user_id",
            ).execute()
        except APIError as exc:
            log.error("mfa_reset_failed", user_id=user_id, error=str(exc))
            raise MfaError(
                "Faktoren konnten nicht zurückgesetzt werden.", status_code=502
            ) from exc
        log.info("mfa_factors_reset", user_id=user_id, anzahl=len(vorher))
        return vorher

    def _reset_frist(self, user_id: str) -> datetime:
        """Die Frist, die nach einem Admin-Reset gilt.

        Eine noch LAUFENDE Frist bleibt unangetastet — nur wenn keine da ist
        oder die alte bereits abgelaufen war, gibt es eine neue. Damit ist der
        Reset ein Rettungsweg und kein Umgehungsschalter: Wer die Pflicht
        aussitzen wollte, gewinnt durch wiederholte Resets keine Zeit.

        Ein Konto, dessen Frist laengst abgelaufen ist, bekommt bewusst eine
        neue — sonst waere es nach der Rettung sofort wieder gesperrt und der
        Reset waere wirkungslos (Aussperr-Schutz).
        """
        res = (
            self._db.table("mfa_enforcement")
            .select("grace_until")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        row = res.data[0] if res.data else None
        if row and row.get("grace_until"):
            bestehend = _zeit(row["grace_until"])
            if bestehend > _now():
                return bestehend
        return _now() + GRACE_DAUER

    def reset_auditieren(
        self,
        *,
        actor_user_id: str,
        actor_email: str | None,
        target_user_id: str,
        target_email: str | None,
        entfernt: list[dict],
        reason: str,
        ip: str | None,
        user_agent: str | None,
    ) -> None:
        """Den Admin-Reset revisionssicher festhalten.

        Bewusst KEIN best-effort-except: einen fremden zweiten Faktor ohne
        Spur zurueckzusetzen waere schlimmer als der fehlgeschlagene Reset.
        Schlaegt das Schreiben fehl, muss der Aufrufer das sehen.
        """
        self._db.table("mfa_reset_audit").insert(
            {
                "actor_user_id": actor_user_id,
                "actor_email": actor_email,
                "target_user_id": target_user_id,
                "target_email": target_email,
                "removed_factors": [
                    {
                        "id": f.get("id"),
                        "factor_type": f.get("factor_type"),
                        "friendly_name": f.get("friendly_name"),
                    }
                    for f in entfernt
                ],
                "reason": reason,
                "ip": ip,
                "user_agent": user_agent,
            }
        ).execute()
