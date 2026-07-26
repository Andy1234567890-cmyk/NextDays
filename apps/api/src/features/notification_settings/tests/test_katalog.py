"""Tests des Katalogs — reine Datenprüfung, keine DB, kein Double.

Der Katalog ist die eine Quelle für Kategorien, Kanäle und Spaltennamen. Läuft
er gegen die Migration auseinander, bricht der Slice zur Laufzeit — darum wird
hier gegen die tatsächlichen Spalten aus 0225 geprüft.
"""
from __future__ import annotations

import re
from pathlib import Path

from src.features.notification_settings.katalog import (
    KATALOG,
    MARKETING_SPALTEN,
    NACH_SCHLUESSEL,
    PFLICHT_EMAIL_SPALTEN,
    SPALTEN,
    Kanal,
    Tab,
)
from src.features.notification_settings.schemas import NotificationSettings

# tests/ → notification_settings/ → features/ → src/ → api/ → apps/ → Repo-Wurzel
MIGRATION = (
    Path(__file__).resolve().parents[6]
    / "supabase"
    / "migrations"
    / "0225_notification_settings.sql"
)


def _migrations_spalten() -> set[str]:
    """Die bool-Spalten aus der Migration (ohne user_id/updated_at)."""
    sql = MIGRATION.read_text(encoding="utf-8")
    return set(re.findall(r"^\s{4}([a-z_]+) boolean", sql, flags=re.MULTILINE))


def test_katalog_deckt_migration_exakt_ab() -> None:
    """Jede Spalte der Migration kommt im Katalog vor — und umgekehrt.

    Das ist der eigentliche Schutz: ein neues Feld in der Migration ohne
    Katalog-Eintrag (oder andersherum) fällt hier auf, nicht erst im Betrieb.
    """
    assert set(SPALTEN) == _migrations_spalten()


def test_spaltennamen_folgen_dem_schema() -> None:
    for kategorie in KATALOG:
        for kanal in kategorie.kanaele:
            assert kategorie.spalte(kanal) == f"{kategorie.schluessel}_{kanal.value}"


def test_schluessel_sind_eindeutig() -> None:
    assert len(NACH_SCHLUESSEL) == len(KATALOG)


def test_nur_konto_tab_hat_pflicht_mails() -> None:
    """Marketing darf NIE erzwungen werden — sonst wäre das Opt-out gelogen."""
    for kategorie in KATALOG:
        if kategorie.email_pflicht:
            assert kategorie.tab is Tab.KONTO


def test_pflicht_spalten_sind_email_spalten() -> None:
    assert all(s.endswith("_email") for s in PFLICHT_EMAIL_SPALTEN)


def test_marketing_spalten_enthalten_kein_konto_feld() -> None:
    konto_schluessel = {k.schluessel for k in KATALOG if k.tab is Tab.KONTO}
    for spalte in MARKETING_SPALTEN:
        assert not any(spalte.startswith(f"{s}_") for s in konto_schluessel)


def test_jede_kategorie_bietet_email() -> None:
    """Ohne E-Mail-Kanal wäre eine Kategorie nicht zustellbar."""
    for kategorie in KATALOG:
        assert Kanal.EMAIL in kategorie.kanaele


def test_defaults_entsprechen_airbnb() -> None:
    """E-Mail an, SMS aus — außer Objekt-Aktivität (Airbnb: „Email and SMS")."""
    s = NotificationSettings()
    assert s.insights_tips_email is True
    assert s.insights_tips_sms is False
    assert s.listing_activity_sms is True
    assert s.marketing_unsubscribed_all is False


def test_schema_hat_genau_die_katalog_felder() -> None:
    felder = set(NotificationSettings.model_fields) - {"marketing_unsubscribed_all"}
    erwartet = set(SPALTEN) - {"marketing_unsubscribed_all"}
    assert felder == erwartet
