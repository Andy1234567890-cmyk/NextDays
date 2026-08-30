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

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.supabase import escape_like

log = get_logger("nextdays.guests.identity")


class GuestCreateError(Exception):
    """Ein Gast konnte nicht angelegt werden (fail-closed) — statt eine
    guest-lose Buchung durchzulassen (Wurzel 1/5)."""


# Partielle Unique-Indizes aus Migration 0113 (tenant_id, lower(email) / phone).
# Verliert ein paralleler Insert das Race, meldet PostgREST diese Namen — dann
# wird der vom Gewinner angelegte Gast geladen statt ein Duplikat zu erzeugen.
_GUEST_EMAIL_UNIQUE = "guests_tenant_email_uq"
_GUEST_PHONE_UNIQUE = "guests_tenant_phone_uq"


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
    # Zweite, STABILE externe ID: die Gast-ID des Kanals (OTA customer.id), die
    # über MEHRERE Buchungen desselben Gastes gleich bleibt — anders als
    # external_ref (Reservierungscode = pro Buchung). Wird zusätzlich verknüpft,
    # damit ein wiederkehrender OTA-Gast ohne E-Mail/Telefon nicht dupliziert.
    stable_external_ref: str | None = None
    # Gästemappen-Stammdaten (0046), sofern der Kanal sie liefert — werden
    # beim Anlegen strukturiert gespeichert (nicht nur der zusammengesetzte
    # `name`), damit die Gästekartei Vorname/Nachname/Sprache/Nationalität hat.
    language: str | None = None
    country: str | None = None
    # Wohnanschrift, sofern der Kanal sie liefert. Sie geht NICHT in `guests`,
    # sondern nach `guest_addresses` (0046) — dort gehört sie hin, und dort ist
    # bereits Platz für Straße, PLZ und Ort. Vorher endete der Weg beim Land:
    # `city`/`address`/`zip` kamen im `customer` an und wurden verworfen.
    city: str | None = None
    address: str | None = None
    zip_code: str | None = None
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
        language=customer.get("language"),
        country=customer.get("country"),
        # Vollständig übernehmen, was das Portal schickt — diese drei wurden
        # bisher gelesen und dann fallen gelassen.
        city=customer.get("city"),
        address=customer.get("address"),
        zip_code=customer.get("zip"),
        # external_ref = Reservierungscode (pro Buchung), stable_external_ref =
        # OTA-Guest-ID (pro Gast, buchungsübergreifend). Beide werden verknüpft;
        # der Resolver matcht auch über die stabile ID, sodass ein wiederkehrender
        # Gast ohne E-Mail/Telefon wiedergefunden statt dupliziert wird.
        external_ref=external_ref,
        stable_external_ref=customer.get("id") or customer.get("guest_id"),
    )




def _find_by_email(
    db: Client, tenant_id: str, email: str
) -> str | None:
    # Case-INSENSITIVE suchen: der Unique-Index ist auf (tenant_id, lower(email))
    # (0113). Ein exaktes .eq('email', …) würde einen Bestandsgast mit mixed-case
    # E-Mail (Legacy/anderer Schreibpfad) NICHT finden — der folgende Insert würde
    # dann am lower(email)-Index kollidieren und die Idempotenz-Recovery liefe ins
    # Leere (500). `ilike` mit escapten Wildcards ist ein case-insensitiver
    # LITERAL-Vergleich und trifft dieselbe Zeile wie der Index.
    rows = (
        db.table("guests")
        .select("id")
        .eq("tenant_id", tenant_id)
        .ilike("email", escape_like(email))
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
    contact: GuestContact | None = None,
) -> None:
    """Fehlende Stammdaten am gefundenen Gast ergänzen (nie überschreiben):
    E-Mail/Telefon plus Gästemappen-Felder (Vorname/Nachname/Sprache/
    Nationalität, 0046), sofern der Kanal sie liefert.

    Die API nutzt den Service-Role-Key (umgeht RLS), darum wird auch hier explizit
    nach tenant_id gefiltert — der guest_id stammt zwar aus einer tenant-gescopten
    Suche, der Filter härtet Lese- und Schreibpfad aber gegen Tenant-Verwechslung."""
    current = (
        db.table("guests")
        .select("email, phone, first_name, last_name, language")
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
    if contact:
        # BEWUSST ohne country→nationality: das Kanal-„Land" ist ein
        # Adress-/Wohnsitzland, keine Staatsangehörigkeit — es landet als
        # Adresse in guest_addresses (siehe _ensure_country_address).
        for column, value in (
            ("first_name", contact.first_name),
            ("last_name", contact.last_name),
            ("language", contact.language),
        ):
            cleaned = (value or "").strip()
            if cleaned and not current[0].get(column):
                patch[column] = cleaned
        _ensure_country_address(db, tenant_id, guest_id, contact)
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
    stable_id = (contact.stable_external_ref or "").strip() or None
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
            contact=contact,
        )

    matched = by_email or by_phone

    # 3) Kanal-spezifische externe IDs — erst die STABILE Gast-ID (buchungs-
    #    übergreifend), dann der Reservierungscode. Die stabile ID zuerst, damit
    #    ein wiederkehrender Gast ohne E-Mail/Telefon zuverlässig wiedergefunden
    #    wird statt bei jeder Buchung neu angelegt zu werden.
    if not matched and channel and stable_id:
        matched = _find_by_external_id(db, tenant_id, channel, stable_id)
    if not matched and channel and external_id:
        matched = _find_by_external_id(db, tenant_id, channel, external_id)

    if matched:
        _backfill_missing(
            db, tenant_id, matched, email=email, phone=phone, contact=contact
        )
        # BEIDE IDs verknüpfen (idempotent) — die stabile Gast-ID und der
        # Reservierungscode zeigen künftig auf denselben Gast.
        if channel and stable_id:
            _link_external_id(db, tenant_id, matched, channel, stable_id)
        if channel and external_id:
            _link_external_id(db, tenant_id, matched, channel, external_id)
        return matched

    # 4) Nichts gefunden — nur anlegen, wenn ein Merkmal existiert (auch die
    #    stabile Gast-ID zählt als Merkmal).
    if not (name or email or phone or external_id or stable_id):
        return None
    new_id = _create_guest(
        db,
        tenant_id,
        name=name,
        email=email,
        phone=phone,
        channel=channel,
        external_id=external_id,
        needs_review=False,
        contact=contact,
    )
    # Die stabile Gast-ID zusätzlich zum (beim Anlegen verknüpften) external_id
    # anhängen, damit die nächste Buchung desselben Gastes matcht.
    if new_id and channel and stable_id:
        _link_external_id(db, tenant_id, new_id, channel, stable_id)
    return new_id


def create_placeholder_guest(
    db: Client,
    tenant_id: str,
    *,
    channel: str,
    external_ref: str | None = None,
) -> str:
    """Platzhaltergast (Name „—", needs_review) für eine externe Buchung OHNE
    jedes Kontaktmerkmal anlegen. Erzwingt die Regel „jede externe Buchung hat
    einen Gast" (Wurzel 1), wenn resolve_or_create_guest None lieferte. Gibt IMMER
    eine guest_id zurück — nie None. Über external_ref (falls vorhanden)
    idempotent verknüpft, sodass eine Redelivery denselben Platzhalter trifft."""
    ext = (external_ref or "").strip() or None
    if ext:
        existing = _find_by_external_id(db, tenant_id, channel, ext)
        if existing:
            return existing
    guest_id = _create_guest(
        db, tenant_id, name="—", email=None, phone=None,
        channel=channel, external_id=ext, needs_review=True,
    )
    if guest_id is None:
        # _create_guest gibt None nur bei leerer Insert-Response zurück — das ist
        # ein DB-/Konfigurationsfehler, kein Normalpfad. Fail-closed statt eine
        # guest-lose Buchung durchzulassen (Wurzel 5).
        raise GuestCreateError("Platzhaltergast konnte nicht angelegt werden.")
    return guest_id


def _ensure_country_address(
    db: Client, tenant_id: str, guest_id: str, contact: GuestContact | None,
    country: str | None = None,
) -> None:
    """Wohnanschrift aus der Buchung in die Gästemappe übernehmen
    (guest_addresses, 0046) — aber NUR, wenn der Gast noch gar keine Adresse
    hat. Kuratierte Adressdaten werden nie überschrieben/ergänzt.

    Übernommen wird ALLES, was der Kanal liefert: Straße, PLZ, Ort, Land. Vorher
    schrieb diese Funktion ausschließlich `country` — Ort, Straße und PLZ der
    Buchung landeten nirgends, obwohl `guest_addresses` die Spalten dafür hat
    und die Portale sie mitsenden (Channex führt `city`/`address`/`zip` im
    `customer`, Booking.com überträgt `<CityName>`/`<AddressLine>`/
    `<PostalCode>`). Genau das war das leere „Ort" in der Gästekarte.

    `country` bleibt als zweiter Parameter erhalten, damit Aufrufer ohne
    vollständigen Kontakt (nur ein Länderkürzel) weiter funktionieren.
    """
    felder = {
        "street": (contact.address if contact else None),
        "postal_code": (contact.zip_code if contact else None),
        "city": (contact.city if contact else None),
        "country": (contact.country if contact else None) or country,
    }
    sauber = {
        spalte: wert.strip()
        for spalte, wert in felder.items()
        if isinstance(wert, str) and wert.strip()
    }
    if not sauber:
        return
    existing = (
        db.table("guest_addresses")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("guest_id", guest_id)
        .limit(1)
        .execute()
    ).data
    if existing:
        return
    db.table("guest_addresses").insert(
        {
            "tenant_id": tenant_id,
            "guest_id": guest_id,
            "type": "private",
            "is_primary": True,
            **sauber,
        }
    ).execute()


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
    contact: GuestContact | None = None,
) -> str | None:
    # Ein Gast OHNE echten Namen ist immer prüfbedürftig — egal, über welchen
    # Pfad er entstand.
    #
    # WARUM DIESE ZEILE: `create_placeholder_guest` setzt `needs_review=True`,
    # `resolve_or_create_guest` im Regelfall `False`. Airbnb liefert über
    # Channex eine stabile Gast-ID, aber KEINEN Namen — damit greift der
    # Regelpfad, der Name fällt auf '—' zurück, und die Markierung bleibt aus.
    # Live am 30.08.2026 gemessen: 148 von 293 Gästen des Beta-Betriebs hießen
    # '—', und ALLE 293 trugen `needs_review = false`. Die Kennzeichnung, an
    # der die Kartei Unvollständiges erkennen soll, hat nie einen einzigen
    # Datensatz getroffen.
    #
    # Die Ableitung gehört hierher und nicht in die sechs Aufrufer: sie hängt
    # am Ergebnis (kein Name), nicht an der Absicht des Aufrufers. In den
    # Aufrufern wäre sie sechs Kopien, von denen die siebte fehlt.
    abgeleiteter_name = name or email or "—"
    ohne_echten_namen = abgeleiteter_name == "—"
    payload: dict[str, Any] = {
        "tenant_id": tenant_id,
        # name ist NOT NULL → bei reiner Kanal-ID/E-Mail auf E-Mail/'—' ableiten.
        "name": abgeleiteter_name,
        "email": email,
        "phone": phone,
        "needs_review": needs_review or ohne_echten_namen,
    }
    # Gästemappen-Stammdaten (0046) strukturiert mitschreiben, sofern der Kanal
    # sie liefert — sonst zeigt die Gästekartei nur den zusammengesetzten Namen
    # und Vorname/Nachname/Sprache bleiben leer. BEWUSST ohne country→
    # nationality: das Kanal-„Land" ist ein Adress-/Wohnsitzland, keine
    # Staatsangehörigkeit — es wird nach dem Insert als Adresse angelegt
    # (_ensure_country_address → guest_addresses.country).
    if contact:
        for column, value in (
            ("first_name", contact.first_name),
            ("last_name", contact.last_name),
            ("language", contact.language),
        ):
            cleaned = (value or "").strip()
            if cleaned:
                payload[column] = cleaned
    try:
        ins = db.table("guests").insert(payload).execute()
    except APIError as exc:
        # Race-Backstop (0113): ein paralleler Insert hat den Gast in der Lücke
        # zwischen _find_by_* und diesem Insert bereits angelegt. Statt ein
        # Duplikat zu erzwingen (oder mit 500 zu scheitern), den bestehenden
        # Gast laden und dessen ID zurückgeben (Resolver bleibt idempotent).
        matched = _guest_id_after_conflict(db, tenant_id, exc, email=email, phone=phone)
        if matched is None:
            raise
        if channel and external_id:
            _link_external_id(db, tenant_id, matched, channel, external_id)
        if contact:
            _ensure_country_address(db, tenant_id, matched, contact)
        return matched
    if not ins.data:
        return None
    guest_id = ins.data[0]["id"]
    if channel and external_id:
        _link_external_id(db, tenant_id, guest_id, channel, external_id)
    if contact:
        # Wohnsitzland → Adresse in der Gästemappe (nicht nationality).
        _ensure_country_address(db, tenant_id, guest_id, contact)
    return guest_id


def _guest_id_after_conflict(
    db: Client,
    tenant_id: str,
    exc: APIError,
    *,
    email: str | None,
    phone: str | None,
) -> str | None:
    """Nach einer Unique-Verletzung beim Insert den bereits angelegten Gast finden.

    Nur bei den erwarteten Gast-Unique-Indizes (E-Mail/Telefon) — jede andere
    APIError wird vom Aufrufer weitergereicht (kein Verschlucken echter Fehler).
    """
    msg = str(exc)
    if _GUEST_EMAIL_UNIQUE in msg and email:
        return _find_by_email(db, tenant_id, email)
    if _GUEST_PHONE_UNIQUE in msg and phone:
        return _find_by_phone(db, tenant_id, phone)
    # Manche PostgREST-Fehler nennen den Indexnamen nicht — generische
    # Unique-Verletzung (23505) trotzdem über die vorhandenen Merkmale auflösen.
    if getattr(exc, "code", None) == "23505" or "duplicate key" in msg:
        if email:
            found = _find_by_email(db, tenant_id, email)
            if found:
                return found
        if phone:
            return _find_by_phone(db, tenant_id, phone)
    return None
