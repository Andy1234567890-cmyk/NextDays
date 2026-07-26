"""Der Katalog der Benachrichtigungs-Kategorien — EINE Quelle der Wahrheit.

Hier steht, welche Kategorien es gibt, in welchem Tab und welcher Gruppe sie
haengen, welche Kanaele sie anbieten und ob E-Mail abwaehlbar ist. Schemas,
Service und die Spaltennamen leiten sich daraus ab — so kann eine neue
Kategorie nicht an drei Stellen auseinanderlaufen (Wurzel 4).

Die Spaltennamen in public.notification_settings folgen strikt
`<schluessel>_<kanal>` (siehe Migration 0225).
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Kanal(StrEnum):
    EMAIL = "email"
    SMS = "sms"
    PHONE = "phone"


class Tab(StrEnum):
    # Marketing — frei abwaehlbar, Sammel-Opt-out moeglich.
    ANGEBOTE = "angebote"
    # Betrieb — E-Mail teils nicht abwaehlbar.
    KONTO = "konto"


@dataclass(frozen=True, slots=True)
class Kategorie:
    """Eine Zeile in der Benachrichtigungs-Liste."""

    schluessel: str
    tab: Tab
    gruppe: str
    kanaele: tuple[Kanal, ...]
    # True = E-Mail kann NICHT abgeschaltet werden (rechtlich/vertraglich
    # noetig: Buchungsbestaetigungen, Richtlinien, Konto-Sicherheit).
    # Airbnb zeigt den Schalter dort ausgegraut-an.
    email_pflicht: bool = False

    def spalte(self, kanal: Kanal) -> str:
        return f"{self.schluessel}_{kanal.value}"


_ALLE_KANAELE = (Kanal.EMAIL, Kanal.SMS, Kanal.PHONE)
_MAIL_SMS = (Kanal.EMAIL, Kanal.SMS)

KATALOG: tuple[Kategorie, ...] = (
    # --- Tab „Angebote und Updates" (Marketing) --------------------------
    Kategorie("insights_recognition", Tab.ANGEBOTE, "insights", _ALLE_KANAELE),
    Kategorie("insights_tips", Tab.ANGEBOTE, "insights", _ALLE_KANAELE),
    Kategorie("insights_pricing", Tab.ANGEBOTE, "insights", _ALLE_KANAELE),
    Kategorie("insights_perks", Tab.ANGEBOTE, "insights", _ALLE_KANAELE),
    Kategorie("hosting_news", Tab.ANGEBOTE, "hosting", _ALLE_KANAELE),
    Kategorie("hosting_local_laws", Tab.ANGEBOTE, "hosting", _ALLE_KANAELE),
    Kategorie("travel_inspiration", Tab.ANGEBOTE, "travel", _ALLE_KANAELE),
    Kategorie("travel_planning", Tab.ANGEBOTE, "travel", _ALLE_KANAELE),
    Kategorie("platform_news", Tab.ANGEBOTE, "platform", _ALLE_KANAELE),
    Kategorie("platform_feedback", Tab.ANGEBOTE, "platform", _ALLE_KANAELE),
    Kategorie("platform_travel_regulations", Tab.ANGEBOTE, "platform", _ALLE_KANAELE),
    # --- Tab „Konto" (Betrieb) -------------------------------------------
    # E-Mail hier Pflicht: Buchungs-/Kontoaktivitaet und Richtlinien sind
    # vertraglich nötig — ein Gastgeber darf eine Stornierung oder eine
    # Richtlinienaenderung nicht stillschweigend abschalten koennen.
    Kategorie("account_activity", Tab.KONTO, "aktivitaet", _MAIL_SMS, email_pflicht=True),
    Kategorie("listing_activity", Tab.KONTO, "aktivitaet", _MAIL_SMS, email_pflicht=True),
    Kategorie("guest_policies", Tab.KONTO, "aktivitaet", _MAIL_SMS, email_pflicht=True),
    Kategorie("host_policies", Tab.KONTO, "aktivitaet", _MAIL_SMS, email_pflicht=True),
    Kategorie("reminders", Tab.KONTO, "erinnerungen", _MAIL_SMS),
    Kategorie("messages", Tab.KONTO, "nachrichten", _MAIL_SMS),
)

NACH_SCHLUESSEL: dict[str, Kategorie] = {k.schluessel: k for k in KATALOG}

# Alle Spalten der Tabelle (ohne user_id/updated_at) — fuer select().
SPALTEN: tuple[str, ...] = tuple(
    k.spalte(kanal) for k in KATALOG for kanal in k.kanaele
) + ("marketing_unsubscribed_all",)

# Nur die Marketing-Spalten — das Sammel-Opt-out schaltet genau diese aus.
MARKETING_SPALTEN: tuple[str, ...] = tuple(
    k.spalte(kanal)
    for k in KATALOG
    if k.tab is Tab.ANGEBOTE
    for kanal in k.kanaele
)

# E-Mail-Spalten, die nicht abgeschaltet werden duerfen.
PFLICHT_EMAIL_SPALTEN: frozenset[str] = frozenset(
    k.spalte(Kanal.EMAIL) for k in KATALOG if k.email_pflicht
)
