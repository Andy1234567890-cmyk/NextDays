"""§ 14 Abs. 4 PStTG gegen die ECHTE DB.

Der Kern ist die Aggregation nach § 6 Abs. 7: Objekte an derselben Anschrift
mit demselben Eigentümer sind EINE inserierte Immobilieneinheit. Ein Hotel mit
zwölf Zimmern wird einmal gemeldet, nicht zwölfmal.

Warum kein Double: Diese Logik liest properties, owner_properties und
reservations und rechnet über Datums- und Statusspalten. Ein Fake müsste das
Schema nachbauen — und hätte beim Bau genau den Fehler verdeckt, der hier
wirklich passiert ist: `owner_property_assignments.owner_id` existiert nicht,
die Eigentümerzuordnung liegt in `owner_properties`.
"""
from __future__ import annotations

import contextlib
from collections.abc import Iterator
from datetime import datetime

import pytest

from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.taxpayer.objektangaben import (
    _VERGUETETE_STATUS,
    ObjektangabenService,
)
from src.features.taxpayer.schemas import ObjektAngabe
from src.features.taxpayer.service import TaxpayerError, TaxpayerService

pytestmark = pytest.mark.integration

JAHR = 2026


@pytest.fixture
def betrieb() -> Iterator[tuple[AuthContext, int]]:
    """Ein Betrieb mit mindestens zwei Objekten — sonst zeigt die
    Aggregation nichts."""
    db = get_service_client()
    for t in (db.table("tenants").select("id").execute()).data or []:
        anzahl = (
            db.table("properties")
            .select("id", count="exact")
            .eq("tenant_id", t["id"])
            .execute()
        ).count or 0
        if anzahl >= 2:
            ctx = AuthContext(user_id="test", tenant_id=t["id"], role="admin")
            yield ctx, anzahl
            return
    pytest.skip("Kein Betrieb mit mindestens zwei Objekten.")


@pytest.fixture
def sauber(betrieb: tuple[AuthContext, int]) -> Iterator[AuthContext]:
    """Setzt die Grundbuch-Felder nach dem Test zurück."""
    ctx, _ = betrieb
    db = get_service_client()
    ids = [
        r["id"]
        for r in (
            db.table("properties")
            .select("id")
            .eq("tenant_id", ctx.tenant_id)
            .execute()
        ).data
        or []
    ]
    try:
        yield ctx
    finally:
        for pid in ids:
            with contextlib.suppress(Exception):  # noqa: BLE001 — Teardown
                db.table("properties").update(
                    {
                        "land_registration_number": None,
                        "land_registration_unavailable": False,
                        "land_registration_confirmed_at": None,
                    }
                ).eq("id", pid).execute()


# -- § 6 Abs. 7: Aggregation ------------------------------------------------


def test_objekte_gehen_restlos_in_einheiten_auf(
    betrieb: tuple[AuthContext, int],
) -> None:
    """Kein Objekt darf bei der Zusammenfassung verloren gehen — ein
    fehlendes Objekt wäre eine unvollständige Meldung (§ 25 Abs. 1 Nr. 6)."""
    ctx, anzahl = betrieb
    einheiten = ObjektangabenService(get_service_client()).fuer_jahr(ctx, JAHR)
    assert sum(len(e.property_ids) for e in einheiten) == anzahl


def test_gleiche_anschrift_wird_zusammengefasst(
    betrieb: tuple[AuthContext, int],
) -> None:
    """Der Kern von § 6 Abs. 7: mehrere Zimmer an einer Anschrift sind EINE
    inserierte Immobilieneinheit."""
    ctx, anzahl = betrieb
    einheiten = ObjektangabenService(get_service_client()).fuer_jahr(ctx, JAHR)
    assert len(einheiten) <= anzahl
    for e in einheiten:
        if len(e.property_ids) > 1:
            return  # Zusammenfassung nachgewiesen
    pytest.skip("Betrieb hat keine zwei Objekte an derselben Anschrift.")


def test_quartale_sind_gueltig(betrieb: tuple[AuthContext, int]) -> None:
    """§ 14 Abs. 4 Nr. 2 verlangt die Aufschlüsselung je Quartal."""
    ctx, _ = betrieb
    einheiten = ObjektangabenService(get_service_client()).fuer_jahr(ctx, JAHR)
    for e in einheiten:
        assert all(1 <= q <= 4 for q in e.verguetung_je_quartal)


def test_summe_stimmt_mit_den_quartalen(
    betrieb: tuple[AuthContext, int],
) -> None:
    ctx, _ = betrieb
    einheiten = ObjektangabenService(get_service_client()).fuer_jahr(ctx, JAHR)
    for e in einheiten:
        assert e.verguetung_gesamt == sum(e.verguetung_je_quartal.values())


def test_nur_bezahlte_buchungen_zaehlen(
    betrieb: tuple[AuthContext, int],
) -> None:
    """Gezählt wird, was BEZAHLT wurde — nicht, was gebucht wurde.

    Anhang V Abschnitt III.A.7 stellt auf die „gezahlte oder gutgeschriebene"
    Vergütung ab. Zwei Filter greifen also hintereinander: der Status muss
    eine relevante Tätigkeit sein (kein Storno), UND es muss eine erfolgreiche
    Zahlung im Meldezeitraum geben. Eine bestätigte, aber unbezahlte Buchung
    ist keine Vergütung.
    """
    ctx, _ = betrieb
    db = get_service_client()
    einheiten = ObjektangabenService(db).fuer_jahr(ctx, JAHR)
    gezaehlt = sum(e.anzahl_taetigkeiten for e in einheiten)

    roh = (
        db.table("reservations")
        .select("id, status")
        .eq("tenant_id", ctx.tenant_id)
        .execute()
    ).data or []
    verguetet = [r["id"] for r in roh if r["status"] in _VERGUETETE_STATUS]
    if not verguetet:
        assert gezaehlt == 0
        return

    bezahlt = {
        z["reservation_id"]
        for z in (
            db.table("payments")
            .select("reservation_id")
            .in_("reservation_id", verguetet)
            .eq("status", "succeeded")
            .gte("created_at", f"{JAHR}-01-01")
            .lt("created_at", f"{JAHR + 1}-01-01")
            .execute()
        ).data
        or []
    }
    assert gezaehlt == len(bezahlt)


def test_quartal_folgt_dem_zahlungsdatum(
    betrieb: tuple[AuthContext, int],
) -> None:
    """Anhang V Abschnitt III.A.7: das Quartal richtet sich nach dem
    Zeitpunkt der ZAHLUNG, nicht nach Anreise oder Buchung.

    Eine im März bezahlte Buchung, die im April stattfindet, gehört in Q1.
    Die Anreise-Konvention lieferte dem Finanzamt die falsche Zeile — und
    zwar bei jeder Buchung über einen Quartalswechsel.
    """
    ctx, _ = betrieb
    db = get_service_client()
    einheiten = ObjektangabenService(db).fuer_jahr(ctx, JAHR)
    gemeldet = {
        q for e in einheiten for q in e.verguetung_je_quartal
    }
    if not gemeldet:
        pytest.skip("Keine bezahlten Buchungen im Meldezeitraum.")

    property_ids = [pid for e in einheiten for pid in e.property_ids]
    reservierungen = [
        r["id"]
        for r in (
            db.table("reservations")
            .select("id")
            .in_("property_id", property_ids)
            .in_("status", sorted(_VERGUETETE_STATUS))
            .execute()
        ).data
        or []
    ]
    zahlungen = (
        db.table("payments")
        .select("created_at")
        .in_("reservation_id", reservierungen)
        .eq("status", "succeeded")
        .gte("created_at", f"{JAHR}-01-01")
        .lt("created_at", f"{JAHR + 1}-01-01")
        .execute()
    ).data or []
    erwartet = {
        (datetime.fromisoformat(z["created_at"]).month - 1) // 3 + 1
        for z in zahlungen
    }
    assert gemeldet == erwartet


def test_waehrung_kommt_aus_der_zahlung(
    betrieb: tuple[AuthContext, int],
) -> None:
    """Abschnitt III.A.6: gemeldet wird „in der Währung, in der gezahlt oder
    gutgeschrieben wurde" — nicht in der Währung der Buchung."""
    ctx, _ = betrieb
    db = get_service_client()
    for e in ObjektangabenService(db).fuer_jahr(ctx, JAHR):
        if e.currency is None:
            continue
        reservierungen = [
            r["id"]
            for r in (
                db.table("reservations")
                .select("id")
                .in_("property_id", e.property_ids)
                .execute()
            ).data
            or []
        ]
        waehrungen = {
            z["currency"]
            for z in (
                db.table("payments")
                .select("currency")
                .in_("reservation_id", reservierungen)
                .eq("status", "succeeded")
                .gte("created_at", f"{JAHR}-01-01")
                .lt("created_at", f"{JAHR + 1}-01-01")
                .execute()
            ).data
            or []
            if z.get("currency")
        }
        assert e.currency in waehrungen


def test_meldefaehig_verlangt_die_pflichtangaben(
    betrieb: tuple[AuthContext, int],
) -> None:
    """Nr. 1 (Anschrift) ist Pflicht, ebenso eine Währung für Nr. 2. Fehlt
    eines, ist die Einheit nicht meldefähig — das muss sichtbar sein, nicht
    still durchgehen (Wurzel 5)."""
    ctx, _ = betrieb
    einheiten = ObjektangabenService(get_service_client()).fuer_jahr(ctx, JAHR)
    for e in einheiten:
        assert e.meldefaehig == bool(e.anschrift and e.country and e.currency)


# -- Nr. 6: Grundbuchnummer -------------------------------------------------


def test_jeder_betrieb_sieht_nur_seine_objekte() -> None:
    """Wurzel 3, gegen ALLE Betriebe der DB auf einmal.

    Der Service-Client umgeht RLS — der Tenant-Scope ist hier der einzige
    Schutz. Ein `.eq("tenant_id", …)`, das jemand später entfernt, wäre ein
    mandantenübergreifendes Leck der Objektliste. Dieser Test prüft beide
    Richtungen: keine fremden Objekte, und keine eigenen fehlen.
    """
    db = get_service_client()
    svc = TaxpayerService(db)
    alle = (db.table("properties").select("id, tenant_id").execute()).data or []
    tenants = (db.table("tenants").select("id").execute()).data or []
    if not tenants:
        pytest.skip("Keine Betriebe in der DB.")

    for t in tenants:
        ctx = AuthContext(user_id="test", tenant_id=t["id"], role="admin")
        gesehen = {a.property_id for a in svc.objektangaben(ctx)}
        eigene = {p["id"] for p in alle if p["tenant_id"] == t["id"]}
        assert gesehen == eigene, (
            f"Betrieb {t['id']}: fremd={sorted(gesehen - eigene)} "
            f"fehlend={sorted(eigene - gesehen)}"
        )


def test_meldedatensatz_enthaelt_keine_fremden_objekte() -> None:
    """Derselbe Schutz für die Meldung: eine Steuermeldung mit fremden
    Objekten wäre nicht nur ein Leck, sondern eine Falschmeldung."""
    db = get_service_client()
    svc = ObjektangabenService(db)
    alle = (db.table("properties").select("id, tenant_id").execute()).data or []
    tenants = (db.table("tenants").select("id").execute()).data or []
    if not tenants:
        pytest.skip("Keine Betriebe in der DB.")

    for t in tenants:
        ctx = AuthContext(user_id="test", tenant_id=t["id"], role="admin")
        gemeldet = {
            pid
            for e in svc.fuer_jahr(ctx, JAHR)
            for pid in e.property_ids
        }
        eigene = {p["id"] for p in alle if p["tenant_id"] == t["id"]}
        assert gemeldet == eigene, (
            f"Betrieb {t['id']}: fremd={sorted(gemeldet - eigene)}"
        )


def test_nummer_speichern_und_normalisieren(sauber: AuthContext) -> None:
    svc = TaxpayerService(get_service_client())
    erstes = svc.objektangaben(sauber)[0]
    gespeichert = svc.objektangabe_speichern(
        sauber,
        erstes.property_id,
        ObjektAngabe(land_registration_number="  1234/5678  "),
    )
    assert gespeichert.land_registration_number == "1234/5678"
    assert gespeichert.confirmed_at is not None
    assert gespeichert.erledigt


def test_keine_nummer_vorhanden_gilt_als_erhoben(
    sauber: AuthContext,
) -> None:
    """„Gefragt, gibt es nicht" muss von „noch nicht gefragt" unterscheidbar
    sein — sonst kann der Betreiber seine Erhebung nicht belegen."""
    svc = TaxpayerService(get_service_client())
    erstes = svc.objektangaben(sauber)[0]
    ohne = svc.objektangabe_speichern(
        sauber,
        erstes.property_id,
        ObjektAngabe(land_registration_unavailable=True),
    )
    assert ohne.land_registration_number is None
    assert ohne.land_registration_unavailable
    assert ohne.erledigt


def test_widerspruch_wird_abgelehnt() -> None:
    """Entweder eine Nummer oder die Erklärung, dass keine existiert."""
    with pytest.raises(ValueError, match="nicht beides"):
        ObjektAngabe(
            land_registration_number="X1",
            land_registration_unavailable=True,
        )


def test_offene_zaehler_wird_mitgepflegt(sauber: AuthContext) -> None:
    """Wurzel 1: wer die Angabe setzt, muss den Gegenzustand pflegen."""
    svc = TaxpayerService(get_service_client())
    vorher = svc.overview(sauber).objekte_ohne_angabe
    if vorher == 0:
        pytest.skip("Alle Objekte haben bereits eine Angabe.")
    erstes = svc.objektangaben(sauber)[0]
    svc.objektangabe_speichern(
        sauber,
        erstes.property_id,
        ObjektAngabe(land_registration_number="A-1"),
    )
    assert svc.overview(sauber).objekte_ohne_angabe == vorher - 1


def test_fremdes_objekt_ist_nicht_auffindbar(sauber: AuthContext) -> None:
    """Wurzel 3/9: derselbe Scope wie die Liste, nicht nur der Tenant-Check
    danach."""
    db = get_service_client()
    fremd = (
        db.table("properties")
        .select("id")
        .neq("tenant_id", sauber.tenant_id)
        .limit(1)
        .execute()
    ).data
    if not fremd:
        pytest.skip("Kein Objekt eines anderen Betriebs vorhanden.")
    with pytest.raises(TaxpayerError) as exc:
        TaxpayerService(db).objektangabe_speichern(
            sauber,
            fremd[0]["id"],
            ObjektAngabe(land_registration_number="X"),
        )
    assert exc.value.status_code == 404


def test_nummer_erscheint_im_meldedatensatz(sauber: AuthContext) -> None:
    """Die erfasste Nummer muss in Nr. 6 der Meldung ankommen — sonst wäre
    die Erfassung folgenlos."""
    db = get_service_client()
    svc = TaxpayerService(db)
    erstes = svc.objektangaben(sauber)[0]
    svc.objektangabe_speichern(
        sauber,
        erstes.property_id,
        ObjektAngabe(land_registration_number="GB-4711"),
    )
    einheiten = ObjektangabenService(db).fuer_jahr(sauber, JAHR)
    assert any(e.land_registration_number == "GB-4711" for e in einheiten)


# -- Zwei-Klassen-Modell beim Ändern (Airbnb Art. 417) ----------------------


def test_stammdaten_sind_aenderbar(sauber: AuthContext) -> None:
    """Name und Anschrift dürfen korrigiert werden — Tippfehler und Umzüge
    sind der Normalfall, kein Identitätswechsel."""
    from src.features.taxpayer.schemas import TaxpayerCreate, TaxpayerKind

    db = get_service_client()
    svc = TaxpayerService(db)
    land = "DE"
    basis = {
        "country": land,
        "kind": TaxpayerKind.ENTITY,
        "legal_name": "Test GmbH",
        "tin": "DE111111111",
    }
    try:
        svc.upsert(sauber, TaxpayerCreate(**basis, city="Berlin"))
        geaendert = svc.upsert(
            sauber, TaxpayerCreate(**basis, city="Hamburg")
        )
        assert geaendert.city == "Hamburg"
        assert geaendert.tin == "DE111111111"
    finally:
        with contextlib.suppress(Exception):  # noqa: BLE001 — Teardown
            db.table("taxpayer_info").delete().eq(
                "tenant_id", sauber.tenant_id
            ).eq("country", land).execute()


def test_steuernummer_ist_gesperrt(sauber: AuthContext) -> None:
    """Eine geänderte Steuernummer ist ein ANDERER Steuerpflichtiger.

    Würde sie still überschrieben, stünde in der nächsten Meldung eine andere
    Person unter demselben Eintrag — und die bereits abgegebene
    Selbstauskunft wäre nicht mehr nachvollziehbar.
    """
    from src.features.taxpayer.schemas import TaxpayerCreate, TaxpayerKind

    db = get_service_client()
    svc = TaxpayerService(db)
    land = "AT"
    try:
        svc.upsert(
            sauber,
            TaxpayerCreate(
                country=land,
                kind=TaxpayerKind.ENTITY,
                legal_name="Test GmbH",
                tin="ATU11111111",
            ),
        )
        with pytest.raises(TaxpayerError) as exc:
            svc.upsert(
                sauber,
                TaxpayerCreate(
                    country=land,
                    kind=TaxpayerKind.ENTITY,
                    legal_name="Test GmbH",
                    tin="ATU99999999",
                ),
            )
        assert exc.value.status_code == 409
        assert "Steuernummer" in exc.value.message
    finally:
        with contextlib.suppress(Exception):  # noqa: BLE001 — Teardown
            db.table("taxpayer_info").delete().eq(
                "tenant_id", sauber.tenant_id
            ).eq("country", land).execute()


def test_entfernen_und_neu_anlegen_geht(sauber: AuthContext) -> None:
    """Der von Airbnb vorgesehene Weg: Remove Taxpayer → Add tax info."""
    from src.features.taxpayer.schemas import TaxpayerCreate, TaxpayerKind

    db = get_service_client()
    svc = TaxpayerService(db)
    land = "NL"
    try:
        svc.upsert(
            sauber,
            TaxpayerCreate(
                country=land,
                kind=TaxpayerKind.ENTITY,
                legal_name="Test BV",
                tin="NL111111111B01",
            ),
        )
        svc.delete(sauber, land)
        neu = svc.upsert(
            sauber,
            TaxpayerCreate(
                country=land,
                kind=TaxpayerKind.ENTITY,
                legal_name="Test BV",
                tin="NL999999999B01",
            ),
        )
        assert neu.tin == "NL999999999B01"
    finally:
        with contextlib.suppress(Exception):  # noqa: BLE001 — Teardown
            db.table("taxpayer_info").delete().eq(
                "tenant_id", sauber.tenant_id
            ).eq("country", land).execute()
