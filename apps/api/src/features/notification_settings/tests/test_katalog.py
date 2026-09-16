"""Tests des Katalogs — reine Datenprüfung, keine DB, kein Double.

Der Katalog ist die eine Quelle für Kategorien, Kanäle und Spaltennamen. Läuft
er gegen die Migration auseinander, bricht der Slice zur Laufzeit — darum wird
hier gegen die tatsächlichen Spalten aus 0225 geprüft.
"""
from __future__ import annotations

import pathlib
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
MIGRATIONS_DIR = Path(__file__).resolve().parents[6] / "supabase" / "migrations"

# 0225 legt die Tabelle an; spätere Migrationen ergänzen Spalten (0331: Aufgaben
# und Eigentümer-Meldungen, 0332: Sperr-Antrags-Workflow). Der Katalog muss die
# SUMME aller abdecken — würde hier nur 0225 gelesen, schlüge der Test bei jeder
# legitimen Erweiterung fehl und der eigentliche Schutz ginge verloren.
MIGRATIONEN = (
    "0225_notification_settings.sql",
    "0331_benachrichtigungen_aufgaben_buchungen.sql",
    "0332_sperrantrag_genehmigung.sql",
    "0390_benachrichtigung_block_freigabe.sql",
    "0399_betrieb_buchungsbenachrichtigung.sql",
    "0408_benachrichtigung_offene_anfrage.sql",
    # Push-Kanal (nur `betrieb_buchung` und `messages` — die zwei
    # Ereignisse, die den Betrieb sofort erreichen muessen).
    "0414_push_geraete.sql",
    # Vertretung (eigene Kategorie: anderer Empfaenger als task_assigned,
    # mit Push, weil eine offene Vertretung heute gebraucht wird).
    "0415_vertretung_benachrichtigung.sql",
    # Testphase endet (nur E-Mail: drei Tage Vorlauf, SMS waere die falsche
    # Dringlichkeit).
    "0488_testphase_einmalig.sql",
    # KI-Eskalation (Mail + Push, kein SMS: eine Beschwerde ist dringend, aber
    # SMS ist fuer Fristen von Stunden reserviert).
    "0499_ki_eskalation_benachrichtigung.sql",
    # Push in die Eigentuemer-App (ADR-0022): owner_booking, owner_service,
    # block_decision bekommen den Kanal, seit es eine App gibt, die ihn
    # empfangen kann.
    "0532_push_app_eigentuemer.sql",
    # Personal & Dienstplan (0541/0542): fuenf Kategorien, je Empfaenger eine.
    "0542_personal_benachrichtigungen.sql",
    # Personal-Ausbau (0544–0547): Tausch, Ueberstunden, Verspaetung.
    "0548_personal_benachrichtigungen_ausbau.sql",
    # Antwort auf ein Buchungsangebot (0586/0587): Mail + SMS, weil das Fenster
    # zwischen Zusage und Zahlung kurz ist und der Zeitraum in ihm nicht
    # anderweitig verkauft werden soll.
    "0587_angebot_antwort_benachrichtigung.sql",
    # Eigentuemer-Chat (0611/0612): zwei Kategorien, weil die beiden Richtungen
    # an verschiedene APPS gehen. Mail + Push ohne SMS — der Inhalt ist
    # Ende-zu-Ende verschluesselt, eine Meldung kann nur sagen, DASS jemand
    # geschrieben hat.
    "0612_eigentuemer_chat_benachrichtigung.sql",
    # Push fuer die zugewiesene Aufgabe (0706). Nachgezogen, weil die Kategorie
    # seit 0331 nur Mail und SMS kannte — fuer „neue Aufgabe" konnte damit nie
    # ein Push entstehen, auch nicht nachdem der Versand selbst repariert war.
    "0706_aufgabe_push_kanal.sql",
)


def _migrations_spalten() -> set[str]:
    """Die bool-Spalten aus allen notification_settings-Migrationen.

    `create table` rückt die Spalten mit 4 Leerzeichen ein, `alter table ... add
    column if not exists` ebenfalls — beide Formen werden erfasst.
    """
    spalten: set[str] = set()
    for name in MIGRATIONEN:
        sql = (MIGRATIONS_DIR / name).read_text(encoding="utf-8")
        spalten |= set(
            re.findall(r"^\s{4}([a-z_]+)\s+boolean", sql, flags=re.MULTILINE)
        )
        spalten |= set(
            re.findall(
                r"add column if not exists\s+([a-z_]+)\s+boolean",
                sql,
                flags=re.MULTILINE,
            )
        )
    return spalten


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


def test_jede_versendende_kategorie_bietet_email() -> None:
    """Wer überhaupt nach draußen geht, muss E-Mail können.

    SMS allein wäre nicht zustellbar: nicht jeder hinterlegt eine Nummer, und
    ein Betrieb, der nur SMS abwählt, verlöre die Meldung ganz.

    Eine Kategorie OHNE Kanäle ist davon ausgenommen und kein Versehen: sie
    geht ausschließlich in die Glocke (Kanal.INAPP läuft immer mit, ohne
    Präferenzspalte). Das ist der richtige Weg für Meldungen, die eine STÖRUNG
    beschreiben — die trifft viele Vorgänge gleichzeitig, und eine Mail je
    Vorgang wäre eine Flut genau dann, wenn der Betrieb Ruhe zum Beheben
    braucht (`zustellproblem`, 15.08.2026).
    """
    for kategorie in KATALOG:
        if not kategorie.kanaele:
            continue
        assert Kanal.EMAIL in kategorie.kanaele


def test_kategorie_ohne_kanaele_erzeugt_keine_spalten() -> None:
    """Gegenprobe: eine reine Glocken-Kategorie darf das Schema nicht anfassen.

    `SPALTEN` leitet sich aus den Kanälen ab. Trüge die Kategorie welche, kämen
    Präferenzspalten hinzu, die es in der Tabelle nicht gibt — jede Abfrage
    liefe auf einen Spaltenfehler.
    """
    ohne = [k for k in KATALOG if not k.kanaele]
    for kategorie in ohne:
        assert not [s for s in SPALTEN if s.startswith(f"{kategorie.schluessel}_")]


def test_defaults_entsprechen_airbnb() -> None:
    """E-Mail an, SMS aus — außer Objekt-Aktivität (Airbnb: „Email and SMS")."""
    s = NotificationSettings()
    assert s.insights_tips_email is True
    assert s.insights_tips_sms is False
    assert s.listing_activity_sms is True
    assert s.marketing_unsubscribed_all is False


def test_push_defaults_stimmen_mit_den_migrationen_ueberein() -> None:
    """Der Code-Default JEDER Push-Spalte muss dem DB-Default entsprechen.

    Bis zum 09.09.2026 standen alle 17 `*_push`-Felder im Schema auf `False`,
    waehrend die Migrationen sie als `not null default true` anlegen — zwei
    Wahrheiten fuer denselben Wert (Wurzel 4).

    Scharf wurde der Widerspruch, weil `notification_settings` live NULL
    Zeilen hat: `soll_senden` faellt dann auf den Code-Default zurueck, und
    der Dispatcher verwarf JEDEN Push als abgewaehlt, ohne den Versandpfad zu
    betreten. Acht registrierte Geraete, kein einziger Versuch, im Protokoll
    nur „uebersprungen: push" — nicht von einem Fehler zu unterscheiden, den
    ein Nutzer selbst eingestellt hat (Wurzel 5).

    Dieser Test liest die MIGRATIONEN, nicht eine zweite Liste: eine neue
    Push-Spalte mit abweichendem Default faellt hier auf, statt still zu
    wirken.
    """
    muster = re.compile(
        r"add column if not exists\s+([a-z_]+_push)\s+boolean[^,;]*?"
        r"default\s+(true|false)",
        re.IGNORECASE,
    )
    migrationen = (
        pathlib.Path(__file__).resolve().parents[6] / "supabase" / "migrations"
    )
    assert migrationen.is_dir(), f"Migrationsordner nicht gefunden: {migrationen}"
    db_default: dict[str, bool] = {}
    for datei in sorted(migrationen.glob("*.sql")):
        for spalte, wert in muster.findall(datei.read_text(encoding="utf-8")):
            db_default[spalte] = wert.lower() == "true"

    assert db_default, "Keine Push-Spalte in den Migrationen gefunden"
    schema = NotificationSettings()
    for spalte, erwartet in sorted(db_default.items()):
        if spalte not in NotificationSettings.model_fields:
            continue
        assert getattr(schema, spalte) is erwartet, (
            f"{spalte}: Code sagt {getattr(schema, spalte)}, "
            f"die Migration sagt {erwartet}"
        )


def test_schema_hat_genau_die_katalog_felder() -> None:
    felder = set(NotificationSettings.model_fields) - {"marketing_unsubscribed_all"}
    erwartet = set(SPALTEN) - {"marketing_unsubscribed_all"}
    assert felder == erwartet


# --- Push-Zustaendigkeit je App (ADR-0022) ----------------------------------
# Ein Push erreicht ein GERAET, nicht ein Konto. Faellt `push_app` auf den
# Default zurueck, geht eine Eigentuemer-Meldung an die Verwaltungs-App — dort
# ist der Eigentuemer nicht angemeldet, die Meldung verschwindet, und niemand
# sieht einen Fehler. Genau diese Stille rechtfertigt die Tests.

EIGENTUEMER_KATEGORIEN = ("owner_booking", "owner_service", "block_decision")


def test_eigentuemer_kategorien_pushen_in_die_owner_app() -> None:
    for schluessel in EIGENTUEMER_KATEGORIEN:
        kategorie = NACH_SCHLUESSEL[schluessel]
        assert kategorie.push_app == "mynextdaysowner", (
            f"{schluessel} pusht nach {kategorie.push_app!r} — eine Meldung "
            "fuer den Eigentuemer landete damit auf einem Telefon der "
            "Verwaltungs-App."
        )


def test_eigentuemer_kategorien_haben_den_push_kanal() -> None:
    """Ohne PUSH in `kanaele` ist `push_app` toter Buchstabe."""
    for schluessel in EIGENTUEMER_KATEGORIEN:
        assert Kanal.PUSH in NACH_SCHLUESSEL[schluessel].kanaele, schluessel


def test_verwaltungs_kategorien_bleiben_bei_der_pms_app() -> None:
    """Die Gegenrichtung: der Umbau darf nichts umgehaengt haben."""
    for schluessel in ("betrieb_buchung", "messages", "task_substitution"):
        assert NACH_SCHLUESSEL[schluessel].push_app == "mynextdays", schluessel


def test_jede_push_kategorie_nennt_eine_bekannte_app() -> None:
    """Ein Tippfehler in `push_app` findet still kein Geraet — hier faellt er auf.

    Die Werte muessen zur Allowlist des Geraete-Services passen; sonst lehnt
    die Anmeldung ab (400) oder der Versand sucht eine App, die es nicht gibt.
    """
    from src.features.notification_settings.geraete import _APPS

    for kategorie in KATALOG:
        if Kanal.PUSH in kategorie.kanaele:
            assert kategorie.push_app in _APPS, (
                f"{kategorie.schluessel}: push_app={kategorie.push_app!r} "
                f"ist keine bekannte App {sorted(_APPS)}"
            )
