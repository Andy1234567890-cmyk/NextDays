"""Zwei-Faktor-Authentifizierung: freiwillige Faktoren (AAL2) und der eine
Baustein, den GoTrue nicht kennt (Wiederherstellungscodes).

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

FREIWILLIG, KEINE PFLICHT (Entscheidung vom 25.08.2026): Es gab hier eine
Rollen-Pflicht (`PFLICHT_ROLLEN` = admin/co_admin, 14-Tage-Frist,
`mfa_enforcement`), die ein Konto ohne Faktor nach Fristablauf aussperrte. Sie
ist ersatzlos entfernt: ein Betrieb haftet nicht dafuer, dass jemand keinen
zweiten Faktor einrichtet, und eine Sperre mit Ausweg-Frist ist genau die Art
erzwungener Kontrolle, die es nicht mehr geben soll. `mfa_gate.py` prueft
seither nur noch, ob ein VORHANDENER Faktor geloest wurde — nie, ob einer
existieren MUSS.

Wiederherstellungscodes sind der Rettungsweg fuer wer freiwillig einen Faktor
eingerichtet hat und liegen in `public.mfa_recovery_code` — nur als
SHA-256-Hash (Wurzel 6), Einloesung als atomarer DB-Claim (Wurzel 2),
byteweiser Vergleich (Wurzel 5).
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import secrets_match

log = get_logger("nextdays.auth.mfa")

# Anzahl und Entropie der Wiederherstellungscodes. 10 Codes a 10 Zeichen aus
# einem 32er-Alphabet = ~50 Bit je Code — weit ausserhalb von Bruteforce, und
# der Einloese-Endpunkt liegt zusaetzlich im strengen `mfa`-Rate-Limit-Bucket.
RECOVERY_CODE_ANZAHL = 10
_RECOVERY_CODE_LAENGE = 10
# Crockford-Base32 ohne I/L/O/U: keine Verwechslung von 0/O und 1/I/L beim
# Abtippen, kein zufaelliges Bilden anstoessiger Woerter (kein U).
_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


class MfaError(Exception):
    """Fachlicher 2FA-Fehler mit HTTP-Status (nie ein 500 aus Nutzereingabe)."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _now() -> datetime:
    return datetime.now(UTC)


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

    # -- Wiederherstellungscodes ---------------------------------------------
    #
    # Der Rettungsweg fuer wer freiwillig einen Faktor eingerichtet hat und das
    # Geraet verliert. Keine Pflicht-Erzwingung mehr hier (s. Moduldoc) — wer
    # keinen Faktor hat, kommt ueber `mfa_gate.mfa_zugang_pruefen` ohnehin durch
    # und braucht auch keine Wiederherstellungscodes.

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

    # -- Faktor entfernen ----------------------------------------------------

    def faktor_entfernen_erlaubt(self, user_id: str, factor_id: str) -> None:
        """Gehoert dieser Faktor wirklich dem Nutzer?

        Keine weitere Huerde mehr (kein „letzter Faktor eines Pflicht-Kontos" —
        es gibt keine Pflicht, s. Moduldoc): wer freiwillig einen Faktor
        eingerichtet hat, darf ihn auch wieder entfernen, ohne Recovery-Codes
        vorweisen zu muessen.
        """
        vorhandene = self.faktoren(user_id)
        if not any(f.get("id") == factor_id for f in vorhandene):
            # Wurzel 9: nur eigene Faktoren — die Liste ist bereits auf den
            # Nutzer gescoped, ein fremder factor_id trifft hier nichts.
            raise MfaError("Faktor nicht gefunden.", status_code=404)

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
        except APIError as exc:
            log.error("mfa_reset_failed", user_id=user_id, error=str(exc))
            raise MfaError(
                "Faktoren konnten nicht zurückgesetzt werden.", status_code=502
            ) from exc
        log.info("mfa_factors_reset", user_id=user_id, anzahl=len(vorher))
        return vorher

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
