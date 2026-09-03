"""Durchstich Strukturvertrieb: von der bezahlten Rechnung bis in die
Buchhaltung des Backoffice — Provisionsliste, Team-Ansicht, Tracking, Sperre,
Reifung, Auszahlungslauf und Gutschrift. Kette: Einsteiger (wirbt) →
Aufsteiger → Experte auf 100 € Netto-Abo: 15 / 5 / 5."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from src.core.security import AffiliateContext, PlatformContext
from src.features.affiliates import auszahlung
from src.features.affiliates import provision as prov
from src.features.affiliates.service import AffiliatesService
from src.jobs import partner_laeufe

from .fakedb import FakeDb
from .test_team import ELITE2, MEMBER, PAID_AT, SPONSOR, _db_kette, _invoice, _zeilen

ADMIN = PlatformContext(user_id="admin-1", platform_role="platform_admin")
REIF = datetime.fromtimestamp(PAID_AT, tz=UTC) + timedelta(days=40)


def _betrag(liste: list) -> str:
    """Die eine EUR-Summe einer Betrag-Liste — '0.00', wenn leer."""
    eur = [b for b in liste if b.currency == "EUR"]
    return eur[0].amount if eur else "0.00"


def _db() -> FakeDb:
    db = _db_kette("aufsteiger", "experte")
    for a in db.zeilen("affiliates"):
        a.update(
            country="DK",
            legal_form="private",
            vat_id_verified_at=None,
            payout_method="stripe",
            payout_details={},
            stripe_account_id=f"acct_{a['id'][-4:]}",
            stripe_payouts_enabled=True,
        )
    db.zeilen("affiliate_payout_minimums").append({"currency": "EUR", "minimum": "1.00"})
    assert prov.verbuche_rechnung(db, _invoice(), event_id="evt_1", lines_loader=None) == "gebucht"
    return db


def _svc(db: FakeDb) -> AffiliatesService:
    return AffiliatesService(db, db, mails=SimpleNamespace())


def _ctx(affiliate_id: str) -> AffiliateContext:
    return AffiliateContext(affiliate_id=affiliate_id, email="x@x.example", status="approved")


def test_backoffice_provisionsliste_zeigt_quelle_und_elternzeile() -> None:
    db = _db()
    earn = _zeilen(db, "earn")[0]
    liste = _svc(db).bo_provisionen(ELITE2)
    assert liste.total == 1
    z = liste.items[0]
    assert (z.kind, z.amount, z.source_affiliate_id, z.parent_id) == (
        "override", "5.00", MEMBER, earn["id"]
    )
    werber = next(a for a in db.zeilen("affiliates") if a["id"] == MEMBER)
    assert z.source_partner_name == werber["full_name"]  # der WERBER, nicht das Mitglied


def test_backoffice_team_ansicht_rechnet_die_ganze_struktur() -> None:
    """Der Experte sieht in der Admin-Team-Ansicht sein direktes Mitglied
    (Aufsteiger) — mit dem Umsatz und der Team-Provision aus DESSEN Struktur,
    also aus dem Einsteiger-Kunden zwei Ebenen tiefer."""
    svc = _svc(_db())
    team = svc.bo_team(ELITE2)
    assert [m.affiliate_id for m in team.members] == [SPONSOR]
    assert _betrag(team.members[0].revenue_total) == "100.00"
    assert _betrag(team.members[0].override_total) == "5.00"
    assert _betrag(team.override_pending) == "5.00"
    # Eine Ebene tiefer stimmt es genauso.
    team2 = svc.bo_team(SPONSOR)
    assert _betrag(team2.members[0].override_total) == "5.00"
    assert _betrag(team2.members[0].revenue_total) == "100.00"


def test_backoffice_tracking_teamumsatz_ueber_alle_ebenen() -> None:
    tr = _svc(_db()).bo_tracking(ELITE2)
    assert _betrag(tr.team_revenue_90d) == "100.00"
    assert _betrag(tr.override_90d) == "5.00"


def test_partner_dashboard_und_team_des_experten() -> None:
    svc = _svc(_db())
    dash = svc.dashboard(_ctx(ELITE2))
    assert _betrag(dash.kennzahlen.team_override) == "5.00"
    team = svc.team(_ctx(ELITE2))
    assert _betrag(team.members[0].override_pending) == "5.00"
    assert _betrag(team.members[0].revenue_total) == "100.00"


def test_sperre_der_mitte_haelt_die_kette_darueber_an() -> None:
    """Wird der Aufsteiger (Mitte) gesperrt, ist die Kette Einsteiger→Experte
    unterbrochen — dieselbe Regel wie beim Buchen (held, wenn darunter jemand
    nicht freigegeben ist). Entsperren stellt alles samt Quelle wieder her."""
    db = _db()
    svc = _svc(db)
    svc.bo_sperren(SPONSOR, SimpleNamespace(reason="Prüfung"), ADMIN)
    stand = {z["affiliate_id"]: (z["status"], z["reason"]) for z in _zeilen(db, "override")}
    assert stand[SPONSOR][0] == "held"
    assert stand[ELITE2][0] == "held"
    assert _zeilen(db, "earn")[0]["status"] == "pending"  # der Werber selbst ist sauber
    svc.bo_entsperren(SPONSOR, ADMIN)
    stand = {z["affiliate_id"]: (z["status"], z["reason"]) for z in _zeilen(db, "override")}
    assert stand[SPONSOR] == ("pending", f"team:{MEMBER}")
    assert stand[ELITE2] == ("pending", f"team:{MEMBER}")


def test_reifung_auszahlungslauf_und_gutschrift() -> None:
    db = _db()
    assert partner_laeufe.provisionen_reifen(db, jetzt=REIF) == 3
    bilanz = auszahlung.lauf_vorbereiten(db, jetzt=REIF)
    assert bilanz["angelegt"] == 3 and bilanz["gesperrt"] == 0
    zahlungen = {p["affiliate_id"]: p for p in db.zeilen("affiliate_payouts")}
    assert {a: str(p["amount"]) for a, p in zahlungen.items()} == {
        MEMBER: "15.00", SPONSOR: "5.00", ELITE2: "5.00"
    }

    class _S:
        company_legal_name = "myNextDays"
        company_legal_form = "ApS"
        company_street = "Vej 1"
        company_city = "København"
        company_country = "DK"
        company_registration_number = "12345678"
        company_vat_id = "DK12345678"

    text = auszahlung.gutschrift_rendern(db, zahlungen[ELITE2]["id"], settings=_S())
    assert "Team-Provision" in text and "5.00 EUR" in text


def test_sperre_des_werbers_erhaelt_die_gruende() -> None:
    """Vorher überschrieb die Sperre den Grund jeder eigenen Zeile und das
    Entsperren setzte ihn auf None — die Team-Zuordnung war danach weg."""
    db = _db()
    svc = _svc(db)
    # Der Aufsteiger hat selbst eine Team-Provision (Grund team:<Werber>).
    svc.bo_sperren(SPONSOR, SimpleNamespace(reason="Prüfung"), ADMIN)
    eigene = next(z for z in _zeilen(db, "override") if z["affiliate_id"] == SPONSOR)
    assert eigene["status"] == "held"
    assert eigene["reason"].startswith("team_suspended:")
    # Werber sperren: sein Ertrag hält an, der Grund-Marker ist rein.
    svc.bo_sperren(MEMBER, SimpleNamespace(reason="Prüfung"), ADMIN)
    assert _zeilen(db, "earn")[0]["status"] == "held"
    assert _zeilen(db, "earn")[0]["reason"] == "partner_suspended"
    svc.bo_entsperren(MEMBER, ADMIN)
    assert (_zeilen(db, "earn")[0]["status"], _zeilen(db, "earn")[0]["reason"]) == ("pending", None)
    # Die Zeilen des noch gesperrten Aufsteigers bleiben angehalten.
    assert {z["status"] for z in _zeilen(db, "override")} == {"held"}
    svc.bo_entsperren(SPONSOR, ADMIN)
    assert {(z["status"], z["reason"]) for z in _zeilen(db, "override")} == {
        ("pending", f"team:{MEMBER}")
    }


def test_entsperren_versteht_altbestand_ohne_werber() -> None:
    """Zeilen aus 0520 tragen `team_suspended:<id>` ohne Werber."""
    db = _db()
    alt = next(z for z in _zeilen(db, "override") if z["affiliate_id"] == SPONSOR)
    alt.update(status="held", reason=f"team_suspended:{MEMBER}")
    for a in db.zeilen("affiliates"):
        if a["id"] == MEMBER:
            a["status"] = "suspended"
    _svc(db).bo_entsperren(MEMBER, ADMIN)
    assert (alt["status"], alt["reason"]) == ("pending", f"team:{MEMBER}")
