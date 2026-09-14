"""Schemas des Bereichs »gobd« (Festschreibung, Prüfprotokoll, Datenträgerüberlassung).

camelCase nach außen (`alias_generator=to_camel`), snake_case innen — so passt
das Bestands-Frontend (`web/services/gobdService.ts`, `web/types/gobdTypes.ts`:
`autoLockOnSend`, `lockDeadlineDays`, `notificationSettings`) ohne Umbau, und
die neue Seite `/buchhaltung/gobd` spricht dieselbe Form.

Die Literale MÜSSEN mit den `check`-Klauseln in 0691/0692 deckungsgleich bleiben
(Regel „DB-CHECK und Pydantic-Literal deckungsgleich").
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

# Deckungsgleich mit 0691 `check (auto_lock_mode in (...))`.
AutoLockMode = Literal["on_send", "after_days", "manual"]
AUTO_LOCK_MODES: frozenset[str] = frozenset({"on_send", "after_days", "manual"})
# Deckungsgleich mit 0692 `check (action in (...))` / `check (object_type in (...))`.
AuditAction = Literal["lock", "unlock_denied", "storno", "export", "change"]
AUDIT_ACTIONS: frozenset[str] = frozenset({"lock", "unlock_denied", "storno", "export", "change"})
AuditObjectType = Literal["invoice", "settings", "export", "audit_log"]
AUDIT_OBJECT_TYPES: frozenset[str] = frozenset({"invoice", "settings", "export", "audit_log"})

# Obergrenzen (Regel: limit ≤ 500, Zeitspannen ≤ 366 Tage → 422).
LIMIT_MAX = 500
LIMIT_STANDARD = 100
MAX_ZEITRAUM_TAGE = 366
# Wie viele Rechnungs-IDs ein Lock-Aufruf höchstens trägt.
LOCK_IDS_MAX = 500
# Datenträgerüberlassung: mehr Belege je Lauf gibt es nicht — Zeitraum verkleinern.
EXPORT_BELEGE_MAX = 20_000
# Ein ZIP größer als das wird nicht gebaut (Wurzel 8: harter Cap statt RAM-Ende).
EXPORT_ZIP_MAX_BYTES = 50 * 1024 * 1024
# `notification_settings` aus dem Bestands-Frontend — jsonb mit Cap.
NOTIFICATION_SETTINGS_MAX_KEYS = 20


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


# --- Einstellungen -------------------------------------------------------------


class GobdSettingsUpdate(_Camel):
    """PUT /gobd/settings — teilweise erlaubt (`exclude_unset`), damit das
    Bestands-Formular (kennt `retentionYears` nicht) nichts löscht.

    `auto_lock_mode` ist die Wahrheit. Schickt der Bestand nur `autoLockOnSend`,
    wird daraus `on_send` bzw. `manual` abgeleitet; `lockDeadlineDays` ist der
    Bestandsname für `lockAfterDays`.
    """

    auto_lock_mode: AutoLockMode | None = None
    lock_after_days: int | None = Field(default=None, ge=0, le=366)
    retention_years: int | None = Field(default=None, ge=1, le=30)
    audit_log_enabled: bool | None = None
    auto_lock_on_export: bool | None = None
    allow_storno_after_lock: bool | None = None
    require_approval_for_unlock: bool | None = None
    notification_settings: dict[str, bool] | None = None
    # Bestandsnamen (web/types/gobdTypes.ts) — werden im Validator umgesetzt.
    auto_lock_on_send: bool | None = None
    lock_deadline_days: int | None = Field(default=None, ge=0, le=366)

    @model_validator(mode="after")
    def _bestand_umsetzen(self) -> "GobdSettingsUpdate":
        gesetzt = self.model_fields_set
        if "lock_deadline_days" in gesetzt and "lock_after_days" not in gesetzt:
            self.lock_after_days = self.lock_deadline_days
            self.model_fields_set.add("lock_after_days")
        if "auto_lock_on_send" in gesetzt and "auto_lock_mode" not in gesetzt:
            self.auto_lock_mode = "on_send" if self.auto_lock_on_send else "manual"
            self.model_fields_set.add("auto_lock_mode")
        anzahl = len(self.notification_settings or {})
        if anzahl > NOTIFICATION_SETTINGS_MAX_KEYS:
            raise ValueError("Zu viele Benachrichtigungs-Schalter.")
        return self


class GobdSettingsResponse(_Camel):
    """GET: fehlt die Zeile, stehen Standardwerte (`manual`, Protokoll an) und
    `configured=false`, bis der Betrieb die Aufbewahrungsfrist gesetzt hat —
    es gibt für sie keinen Ersatzwert (Wurzel 4)."""

    company_id: str
    auto_lock_mode: AutoLockMode
    lock_after_days: int | None = None
    retention_years: int | None = None
    audit_log_enabled: bool
    auto_lock_on_export: bool
    allow_storno_after_lock: bool
    require_approval_for_unlock: bool
    notification_settings: dict[str, bool] = Field(default_factory=dict)
    # Bestandsnamen, abgeleitet — das alte Formular liest sie.
    auto_lock_on_send: bool
    lock_deadline_days: int | None = None
    configured: bool
    updated_at: datetime | None = None


# --- Festschreiben ----------------------------------------------------------------


class LockRequest(_Camel):
    """POST /gobd/lock — Rechnungs-IDs festschreiben. `documentId` (Einzahl) ist
    die Form von `gobdService.lockDocument`/`autoLockOnSend`."""

    invoice_ids: list[str] = Field(default_factory=list, max_length=LOCK_IDS_MAX)
    document_id: str | None = None
    reason: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def _ids_zusammenfuehren(self) -> "LockRequest":
        ids = [i.strip() for i in self.invoice_ids if i and i.strip()]
        if self.document_id and self.document_id.strip():
            ids.append(self.document_id.strip())
        if not ids:
            raise ValueError("Mindestens eine Rechnungs-ID ist erforderlich.")
        if len(ids) > LOCK_IDS_MAX:
            raise ValueError(f"Höchstens {LOCK_IDS_MAX} Rechnungen je Aufruf.")
        self.invoice_ids = list(dict.fromkeys(ids))
        return self


class LockResult(_Camel):
    locked: list[str]
    already_locked: list[str]
    locked_at: datetime | None = None
    # Bestand liest `success`/`message` (gobdService.ts).
    success: bool = True
    message: str | None = None


class UnlockRequest(_Camel):
    invoice_ids: list[str] = Field(min_length=1, max_length=LOCK_IDS_MAX)
    reason: str | None = Field(default=None, max_length=1000)


class AutoLockRunResult(_Camel):
    mode: AutoLockMode
    candidates: int
    locked: list[str]
    locked_at: datetime | None = None


class OffeneRechnung(_Camel):
    """Ausgestellt, aber noch nicht festgeschrieben — Auswahl für den manuellen Lock."""

    id: str
    invoice_number: str | None = None
    invoice_type: str
    status: str
    issue_date: date | None = None
    gross_amount: Decimal
    currency: str
    customer_name: str | None = None


class GobdStatus(_Camel):
    drafts: int
    open: int
    locked: int
    storno: int
    last_locked_at: datetime | None = None
    auto_lock_mode: AutoLockMode
    retention_years: int | None = None
    configured: bool
    audit_entries: int


# --- Prüfprotokoll ------------------------------------------------------------------


class AuditEntry(_Camel):
    id: str
    seq: int
    object_type: AuditObjectType
    object_id: str
    action: AuditAction
    user_id: str | None = None
    created_at: datetime
    diff: dict = Field(default_factory=dict)
    prev_hash: str
    hash: str


class KettenBruch(_Camel):
    seq: int
    id: str
    reason: Literal["hash_mismatch", "prev_hash_mismatch"]


class VerifyResult(_Camel):
    ok: bool
    checked: int
    first_break: KettenBruch | None = None
    last_hash: str | None = None
    verified_at: datetime
