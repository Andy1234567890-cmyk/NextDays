"""Zentraler, kanalübergreifender Gast-Resolver (eine Quelle der Wahrheit).

Jede eingehende Buchung/Nachricht — egal über welchen Kanal (OTA via Channex,
WhatsApp, später E-Mail/Direkt) — wird über `resolve_or_create_guest` dem
richtigen Gast zugeordnet. EIN deterministischer Pfad statt drei unabhängiger
`_upsert_guest`-Implementierungen.

Match-Reihenfolge (konservativ, fail-safe):
  1. normalisierte E-Mail (exakt)
  2. normalisierte Telefonnummer (E.164, exakt)
  3. kanal-spezifische externe ID (guest_external_ids: OTA-Guest-ID /
     WhatsApp-Nummer / external_ref)
  4. sonst neuen Gast anlegen

Nie allein auf den Namen mergen. Bei MEHRDEUTIGEN Treffern (E-Mail und Telefon
zeigen auf verschiedene Gäste) wird konservativ ein NEUER Gast mit
`needs_review=true` angelegt — manuelle Zusammenführung später über /guests/merge.

Alles tenant-scoped: tenant_id stammt aus dem AuthContext/Aufrufer, nie aus
User-Input. KEINE Fallback-Werte: fehlen E-Mail UND Telefon UND Name UND
Kanal-ID, wird kein Gast angelegt (None).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.guests.identity")


def normalize_email(value: str | None) -> str | None:
    """E-Mail vergleichbar machen: trim + lowercase. None/leer → None.

    Bewusst konservativ (keine Plus-Adress-/Punkt-Normalisierung), damit zwei
    real getrennte Adressen nicht fälschlich zusammenfallen.
    """
    if not value:
        return None
    cleaned = value.strip().lower()
    return cleaned or None


def normalize_phone(value: str | None) -> str | None:
    """Telefonnummer auf E.164-ähnliche Form bringen: nur Ziffern, führendes '+'.

    '00'-Präfix → '+'. Ohne Ländervorwahl-Indikator ('+'/'00') kann keine
    sichere E.164 gebildet werden — dann nur die Ziffern (für Exakt-Vergleich
    untereinander reicht das, kein erfundener Ländercode). None/zu kurz → None.
    """
    if not value:
        return None
    raw = value.strip()
    has_plus = raw.startswith("+")
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return None
    if has_plus:
        normalized = "+" + digits
    elif digits.startswith("00"):
        normalized = "+" + digits[2:]
    else:
        normalized = digits
    # Zu kurz für eine echte Rufnummer → kein Match-Schlüssel.
    if len(digits) < 6:
        return None
    return normalized


@dataclass
class GuestContact:
    """Kanal-neutrale Kontaktangabe für den Resolver.

    `channel`/`external_ref` sind optional: nur gesetzt, wenn der Kanal eine
    stabile externe ID liefert (OTA-Guest-ID, WhatsApp-Nummer). `needs_review`
    wird vom Resolver gesetzt, nicht vom Aufrufer.
    """

    first_name: str | None = None
    last_name: str | None = None
    name: str | None = None  # voller Name, falls der Kanal nicht splittet
    email: str | None = None
    phone: str | None = None
    channel: str | None = None
    external_ref: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def full_name(self) -> str:
        if self.name and self.name.strip():
            return self.name.strip()
        return " ".join(x for x in [self.first_name, self.last_name] if x).strip()


def contact_from_ota_customer(
    customer: dict[str, Any], *, external_ref: str | None = None
) -> GuestContact:
    """Channex/OTA-`customer`-JSON → GuestContact (Feldnamen: name/surname/mail)."""
    return GuestContact(
        first_name=customer.get("name"),
        last_name=customer.get("surname"),
        email=customer.get("mail") or customer.get("email"),
        phone=customer.get("phone"),
        channel="ota",
        external_ref=external_ref
        or customer.get("id")
        or customer.get("guest_id"),
    )


def _find_by_email(
    db: Client, tenant_id: str, email: str
) -> str | None:
    rows = (
        db.table("guests")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("email", email)
        .limit(1)
        .execute()
    ).data
    return rows[0]["id"] if rows else None


def _find_by_phone(
    db: Client, tenant_id: str, phone: str
) -> str | None:
    rows = (
        db.table("guests")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("phone", phone)
        .limit(1)
        .execute()
    ).data
    return rows[0]["id"] if rows else None


def _find_by_external_id(
    db: Client, tenant_id: str, channel: str, external_id: str
) -> str | None:
    rows = (
        db.table("guest_external_ids")
        .select("guest_id")
        .eq("tenant_id", tenant_id)
        .eq("channel", channel)
        .eq("external_id", external_id)
        .limit(1)
        .execute()
    ).data
    return rows[0]["guest_id"] if rows else None


def _link_external_id(
    db: Client, tenant_id: str, guest_id: str, channel: str, external_id: str
) -> None:
    """Kanal-ID an Gast knüpfen (idempotent über unique(tenant,channel,ext))."""
    db.table("guest_external_ids").upsert(
        {
            "tenant_id": tenant_id,
            "guest_id": guest_id,
            "channel": channel,
            "external_id": external_id,
        },
        on_conflict="tenant_id,channel,external_id",
    ).execute()


def _backfill_missing(
    db: Client,
    tenant_id: str,
    guest_id: str,
    *,
    email: str | None,
    phone: str | None,
) -> None:
    """Fehlende E-Mail/Telefon am gefundenen Gast ergänzen (nie überschreiben).

    Die API nutzt den Service-Role-Key (umgeht RLS), darum wird auch hier explizit
    nach tenant_id gefiltert — der guest_id stammt zwar aus einer tenant-gescopten
    Suche, der Filter härtet Lese- und Schreibpfad aber gegen Tenant-Verwechslung."""
    current = (
        db.table("guests")
        .select("email, phone")
        .eq("id", guest_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data
    if not current:
        return
    patch: dict[str, Any] = {}
    if email and not current[0].get("email"):
        patch["email"] = email
    if phone and not current[0].get("phone"):
        patch["phone"] = phone
    if patch:
        db.table("guests").update(patch).eq("id", guest_id).eq(
            "tenant_id", tenant_id
        ).execute()


def resolve_or_create_guest(
    db: Client, tenant_id: str, contact: GuestContact
) -> str | None:
    """Gast deterministisch finden oder anlegen. Gibt guest_id oder None zurück.

    None nur, wenn KEIN identifizierendes Merkmal vorliegt (kein Name, keine
    E-Mail, kein Telefon, keine Kanal-ID) — dann wird bewusst nichts erfunden.
    """
    email = normalize_email(contact.email)
    phone = normalize_phone(contact.phone)
    channel = (contact.channel or "").strip() or None
    external_id = (contact.external_ref or "").strip() or None
    name = contact.full_name()

    # 1) + 2) E-Mail / Telefon — getrennt auflösen, um Mehrdeutigkeit zu erkennen.
    by_email = _find_by_email(db, tenant_id, email) if email else None
    by_phone = _find_by_phone(db, tenant_id, phone) if phone else None

    if by_email and by_phone and by_email != by_phone:
        # Mehrdeutig: E-Mail und Telefon zeigen auf verschiedene Gäste.
        # Konservativ NEU anlegen + zur manuellen Prüfung markieren.
        log.warning(
            "guest_resolve_ambiguous",
            tenant_id=tenant_id,
            by_email=by_email,
            by_phone=by_phone,
        )
        return _create_guest(
            db,
            tenant_id,
            name=name,
            email=email,
            phone=phone,
            channel=channel,
            external_id=external_id,
            needs_review=True,
        )

    matched = by_email or by_phone

    # 3) Kanal-spezifische externe ID.
    if not matched and channel and external_id:
        matched = _find_by_external_id(db, tenant_id, channel, external_id)

    if matched:
        _backfill_missing(db, tenant_id, matched, email=email, phone=phone)
        if channel and external_id:
            _link_external_id(db, tenant_id, matched, channel, external_id)
        return matched

    # 4) Nichts gefunden — nur anlegen, wenn ein Merkmal existiert.
    if not (name or email or phone or external_id):
        return None
    return _create_guest(
        db,
        tenant_id,
        name=name,
        email=email,
        phone=phone,
        channel=channel,
        external_id=external_id,
        needs_review=False,
    )


def _create_guest(
    db: Client,
    tenant_id: str,
    *,
    name: str,
    email: str | None,
    phone: str | None,
    channel: str | None,
    external_id: str | None,
    needs_review: bool,
) -> str | None:
    payload: dict[str, Any] = {
        "tenant_id": tenant_id,
        # name ist NOT NULL → bei reiner Kanal-ID/E-Mail auf E-Mail/'—' ableiten.
        "name": name or email or "—",
        "email": email,
        "phone": phone,
        "needs_review": needs_review,
    }
    ins = db.table("guests").insert(payload).execute()
    if not ins.data:
        return None
    guest_id = ins.data[0]["id"]
    if channel and external_id:
        _link_external_id(db, tenant_id, guest_id, channel, external_id)
    return guest_id
