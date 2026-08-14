"""Tests des Einladungs-/Passwort-Reset-Wegs für Tenant-Nutzer (0334).

Geprüft werden die Zusagen, an denen der Vorgang steht oder fällt:
abgelaufener Token, verbrauchter Token, Müll-Token, doppelte Einlösung,
User-Enumeration bei „Passwort vergessen" und der Gegenzustand bei
Mailfehlern.

Der `MailService` wird IMMER injiziert (Mock) — es geht nie eine echte Mail
raus, auch nicht an eine eigene Adresse.
"""
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest

from src.core.mail import MailError
from src.features.auth.einladung_service import (
    RESET_ANTWORT,
    ZWECK_INVITE,
    ZWECK_RESET,
    EinladungError,
    EinladungService,
    hash_token,
)


def _settings(app_url: str = "https://app.example") -> MagicMock:
    s = MagicMock(name="settings")
    s.app_base_url = app_url
    return s


def _zeit(delta: timedelta) -> str:
    return (datetime.now(UTC) + delta).isoformat()


def _token_zeile(**over: object) -> dict:
    basis = {
        "id": "tok-1",
        "user_id": "u-1",
        "tenant_id": "t-1",
        "zweck": ZWECK_INVITE,
        "token_hash": hash_token("geheim"),
        "expires_at": _zeit(timedelta(days=1)),
        "used_at": None,
    }
    basis.update(over)
    return basis


def _db(
    token_zeile: dict | None = None,
    *,
    claim_gewinnt: bool = True,
    nutzer: dict | None = None,
    letzte_anfrage: str | None = None,
    benutzte_zeile: dict | None = None,
) -> MagicMock:
    """Supabase-Mock für den Token-Weg.

    Die Ketten sind bewusst getrennt nach der Form, in der der Dienst sie
    aufruft — so schlägt ein versehentlich geänderter Aufruf im Test auf,
    statt still einen anderen Zweig zu treffen.
    """
    db = MagicMock(name="supabase")
    tabelle = MagicMock()
    select_eq = tabelle.select.return_value.eq.return_value
    update_eq = tabelle.update.return_value.eq.return_value

    # _offene_zeile: select(...).eq(hash).eq(zweck).is_(used_at).limit(1)
    select_eq.eq.return_value.is_.return_value.limit.return_value.execute.return_value.data = (
        [token_zeile] if token_zeile else []
    )
    # _gesperrt: select(created_at).eq(user).eq(zweck).order(...).limit(1)
    select_eq.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = (
        [{"created_at": letzte_anfrage}] if letzte_anfrage else []
    )
    # _tenant_nutzer: select(...).eq(email).limit(2)
    select_eq.limit.return_value.execute.return_value.data = (
        [nutzer] if nutzer else []
    )
    # _token_ausgeben: insert(...).execute()
    tabelle.insert.return_value.execute.return_value.data = [{"id": "tok-neu"}]
    # _claim: update(...).eq(id).is_(used_at).execute()
    update_eq.is_.return_value.execute.return_value.data = (
        [{"id": "tok-1"}] if claim_gewinnt else []
    )
    # _tokens_entwerten: update(...).eq(user).eq(zweck).is_(used_at).execute()
    update_eq.eq.return_value.is_.return_value.execute.return_value.data = []
    # bereits_eingeloest: select(...).eq(hash).eq(zweck).not_.is_(used_at).limit(1)
    # Eigene Kette (`not_`), damit ein versehentlich gelockerter Filter im Test
    # auffällt und nicht still die `_offene_zeile`-Kette trifft.
    select_eq.eq.return_value.not_.is_.return_value.limit.return_value.execute.return_value.data = (
        [benutzte_zeile] if benutzte_zeile else []
    )
    db.table.return_value = tabelle
    return db


def _service(db: MagicMock, mail: MagicMock | None = None) -> EinladungService:
    return EinladungService(
        service_client=db, settings=_settings(), mail=mail or MagicMock(name="mail")
    )


# --- Token-Prüfung: die vier Ablehnungsgründe ------------------------------


def test_abgelaufener_token_wird_abgelehnt() -> None:
    # Gültigkeitsende in der Vergangenheit → fail-closed, kein Passwortwechsel.
    db = _db(_token_zeile(expires_at=_zeit(timedelta(hours=-1))))
    svc = _service(db)
    with pytest.raises(EinladungError) as exc:
        svc.passwort_setzen("geheim", "neuespasswort", ZWECK_INVITE)
    assert exc.value.status_code == 400
    db.auth.admin.update_user_by_id.assert_not_called()


def test_bereits_benutzter_token_wird_abgelehnt() -> None:
    # used_at gesetzt → der Link ist verbraucht. Zusätzlich zum DB-Filter
    # prüft der Dienst das selbst, damit ein gelockerter Filter nicht
    # unbemerkt durchrutscht.
    db = _db(_token_zeile(used_at=_zeit(timedelta(minutes=-5))))
    svc = _service(db)
    with pytest.raises(EinladungError) as exc:
        svc.passwort_setzen("geheim", "neuespasswort", ZWECK_INVITE)
    assert exc.value.status_code == 400
    db.auth.admin.update_user_by_id.assert_not_called()


@pytest.mark.parametrize(
    "muell",
    [
        "",
        "   ",
        "nicht-existent-aber-lang-genug-fuer-das-schema",
        "ümläute-und-nicht-ascii-ÄÖÜ",
        "'; drop table user_auth_tokens; --",
    ],
)
def test_muell_token_wirft_keinen_500(muell: str) -> None:
    # Angreiferkontrollierter Input darf NIE einen 500 auslösen (Wurzel 5) —
    # insbesondere nicht-ASCII, an dem ein naiver secrets.compare_digest
    # mit TypeError zerbricht.
    db = _db(None)
    svc = _service(db)
    with pytest.raises(EinladungError) as exc:
        svc.passwort_setzen(muell, "neuespasswort", ZWECK_INVITE)
    assert exc.value.status_code in (400, 422)


def test_unbekannter_token_ist_nicht_gueltig() -> None:
    assert _service(_db(None)).ist_gueltig("irgendwas", ZWECK_INVITE) is False


def test_gueltiger_token_ist_gueltig_und_wird_nicht_verbraucht() -> None:
    db = _db(_token_zeile())
    assert _service(db).ist_gueltig("geheim", ZWECK_INVITE) is True
    # Vorab-Prüfung darf den Token NICHT beanspruchen.
    db.table.return_value.update.assert_not_called()


# --- „Schon registriert" → Anmeldung statt Warnseite ------------------------


def test_eingeloester_token_wird_als_benutzt_erkannt() -> None:
    """Der Live-Fall: zweiter Klick auf den Einladungslink in der Mail.

    Die Person hat ihr Passwort längst gesetzt; „Link ungültig oder abgelaufen"
    war für sie eine Sackgasse mit Warndreieck für einen normalen Vorgang.
    """
    db = _db(None, benutzte_zeile=_token_zeile(used_at=_zeit(timedelta(minutes=-5))))
    assert _service(db).bereits_eingeloest("geheim", ZWECK_INVITE) is True


def test_geratener_token_verraet_nichts() -> None:
    """Kein Orakel (die Regel aus `ist_gueltig` gilt weiter).

    Für einen Token, der nicht in der Tabelle steht, ist die Antwort `False` —
    dieselbe wie für „ungültig" und „abgelaufen". Wer ein `True` auslösen kann,
    kennt den echten Token bereits; er hatte die Mail.
    """
    assert _service(_db(None)).bereits_eingeloest("geraten", ZWECK_INVITE) is False


def test_bereits_eingeloest_verbraucht_den_token_nicht() -> None:
    db = _db(None, benutzte_zeile=_token_zeile(used_at=_zeit(timedelta(minutes=-5))))
    _service(db).bereits_eingeloest("geheim", ZWECK_INVITE)
    db.table.return_value.update.assert_not_called()


def test_bereits_eingeloest_prueft_den_hash_byteweise() -> None:
    """Ein fremder Hash in der Antwort darf NICHT als Treffer durchgehen.

    Der Nachvergleich schließt aus, dass eine spätere Änderung der Abfrage
    (Präfix-Match, ilike) unbemerkt zu einem lockereren Kriterium wird.
    """
    db = _db(
        None,
        benutzte_zeile=_token_zeile(
            token_hash=hash_token("ein-anderer-token"),
            used_at=_zeit(timedelta(minutes=-5)),
        ),
    )
    assert _service(db).bereits_eingeloest("geheim", ZWECK_INVITE) is False


@pytest.mark.parametrize("muell", ["", "   ", "ümläute-ÄÖÜ", "'; drop table x; --"])
def test_bereits_eingeloest_wirft_bei_muell_keinen_500(muell: str) -> None:
    """Angreiferkontrollierter Input darf keinen 500 auslösen (Wurzel 5)."""
    assert _service(_db(None)).bereits_eingeloest(muell, ZWECK_INVITE) is False


# --- Wurzel 2: doppelte Einlösung -------------------------------------------


def test_doppelte_einloesung_wirkt_nur_einmal() -> None:
    # Der Claim (bedingter UPDATE) verliert beim zweiten Aufruf → kein
    # zweiter Passwortwechsel. Das ist der Doppelklick-/Retry-Fall.
    db = _db(_token_zeile(), claim_gewinnt=False)
    svc = _service(db)
    with pytest.raises(EinladungError) as exc:
        svc.passwort_setzen("geheim", "neuespasswort", ZWECK_INVITE)
    assert exc.value.status_code == 400
    db.auth.admin.update_user_by_id.assert_not_called()


def test_claim_laeuft_vor_dem_passwortwechsel() -> None:
    # Reihenfolge ist die Zusage: erst beanspruchen, dann wirken.
    db = _db(_token_zeile())
    _service(db).passwort_setzen("geheim", "neuespasswort", ZWECK_INVITE)
    db.auth.admin.update_user_by_id.assert_called_once()
    # Der Claim ist ein UPDATE mit is_("used_at", "null") — der Riegel.
    db.table.return_value.update.return_value.eq.return_value.is_.assert_any_call(
        "used_at", "null"
    )


def test_erfolgreiche_einloesung_entwertet_alle_weiteren_tokens() -> None:
    # Nach einem gesetzten Passwort darf kein zweiter offener Link bleiben —
    # weder eine weitere Einladung noch ein älterer Reset (Wurzel 1).
    db = _db(_token_zeile())
    _service(db).passwort_setzen("geheim", "neuespasswort", ZWECK_INVITE)
    zwecke = [
        c.args[1]
        for c in db.table.return_value.update.return_value.eq.return_value.eq.call_args_list
    ]
    assert ZWECK_INVITE in zwecke
    assert ZWECK_RESET in zwecke


def test_reset_widerruft_alle_sitzungen() -> None:
    # Ein Reset ist der Weg des Kompromittierten — eine überlebende fremde
    # Sitzung würde ihn wirkungslos machen.
    db = _db(_token_zeile(zweck=ZWECK_RESET))
    _service(db).passwort_setzen("geheim", "neuespasswort", ZWECK_RESET)
    db.rpc.assert_called_once()
    assert db.rpc.call_args.args[0] == "host_revoke_other_sessions"


def test_einladung_widerruft_keine_sitzungen() -> None:
    # Bei der Einladung gibt es noch keine Sitzung, die zu widerrufen wäre.
    db = _db(_token_zeile())
    _service(db).passwort_setzen("geheim", "neuespasswort", ZWECK_INVITE)
    db.rpc.assert_not_called()


# --- Passwortregeln serverseitig --------------------------------------------


def test_zu_kurzes_passwort_wird_serverseitig_abgelehnt() -> None:
    # Der Endpunkt ist öffentlich und ohne Browser aufrufbar — die Regel muss
    # hier stehen, nicht nur im Frontend (Wurzel 3).
    db = _db(_token_zeile())
    with pytest.raises(EinladungError) as exc:
        _service(db).passwort_setzen("geheim", "kurz", ZWECK_INVITE)
    assert exc.value.status_code == 422
    db.auth.admin.update_user_by_id.assert_not_called()


def test_passwortpruefung_laeuft_vor_dem_token_lookup() -> None:
    # Ein zu kurzes Passwort darf nicht erst den Token verbrauchen.
    db = _db(_token_zeile())
    with pytest.raises(EinladungError):
        _service(db).passwort_setzen("geheim", "kurz", ZWECK_INVITE)
    db.table.return_value.update.assert_not_called()


# --- User-Enumeration bei „Passwort vergessen" ------------------------------


@pytest.mark.parametrize(
    ("email", "nutzer"),
    [
        ("gibtsnicht@example.de", None),          # kein Konto
        ("kaputt", None),                          # keine gültige Adresse
        ("", None),                                # leer
        ("chef@example.de", {"id": "u-1", "tenant_id": "t-1",
                             "email": "chef@example.de", "full_name": "Chef"}),
    ],
)
def test_passwort_vergessen_antwortet_immer_gleich(
    email: str, nutzer: dict | None
) -> None:
    # DIE Zusage gegen User-Enumeration: existierende und nicht existierende
    # Adresse sind an der Antwort NICHT zu unterscheiden (OWASP).
    svc = _service(_db(nutzer=nutzer))
    assert svc.passwort_reset_anfordern(email) == RESET_ANTWORT


def test_passwort_vergessen_verschickt_mail_nur_bei_echtem_nutzer() -> None:
    mail = MagicMock(name="mail")
    nutzer = {
        "id": "u-1", "tenant_id": "t-1",
        "email": "chef@example.de", "full_name": "Chef",
    }
    _service(_db(nutzer=nutzer), mail).passwort_reset_anfordern("chef@example.de")
    mail.send.assert_called_once()

    mail_ohne = MagicMock(name="mail")
    _service(_db(nutzer=None), mail_ohne).passwort_reset_anfordern("nix@example.de")
    mail_ohne.send.assert_not_called()


def test_passwort_vergessen_bei_mehrdeutiger_adresse_ohne_mail() -> None:
    # Zwei users-Zeilen zur selben Adresse: fail-closed KEINE Mail, statt zu
    # raten, welches Konto gemeint ist (Wurzel 4).
    db = MagicMock(name="supabase")
    tabelle = MagicMock()
    tabelle.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"id": "u-1", "tenant_id": "t-1", "email": "doppelt@example.de"},
        {"id": "u-2", "tenant_id": "t-2", "email": "doppelt@example.de"},
    ]
    db.table.return_value = tabelle
    mail = MagicMock(name="mail")
    antwort = _service(db, mail).passwort_reset_anfordern("doppelt@example.de")
    assert antwort == RESET_ANTWORT
    mail.send.assert_not_called()


def test_reset_sperrfrist_verhindert_mailbombe() -> None:
    # Der IP-Ratelimit schützt ein fremdes Postfach nicht (wechselnde IPs) —
    # die Sperrfrist je Konto tut es.
    nutzer = {
        "id": "u-1", "tenant_id": "t-1",
        "email": "chef@example.de", "full_name": "Chef",
    }
    db = _db(nutzer=nutzer, letzte_anfrage=_zeit(timedelta(seconds=-5)))
    mail = MagicMock(name="mail")
    antwort = _service(db, mail).passwort_reset_anfordern("chef@example.de")
    assert antwort == RESET_ANTWORT          # nach aussen nicht unterscheidbar
    mail.send.assert_not_called()            # aber es geht keine Mail raus


def test_reset_mailfehler_nimmt_den_token_zurueck() -> None:
    # Gegenzustand (Wurzel 1): ging die Mail nicht raus, darf kein gültiger
    # Token zurückbleiben, den niemand bekommen hat.
    nutzer = {
        "id": "u-1", "tenant_id": "t-1",
        "email": "chef@example.de", "full_name": "Chef",
    }
    db = _db(nutzer=nutzer)
    mail = MagicMock(name="mail")
    mail.send.side_effect = MailError("SMTP tot")
    antwort = _service(db, mail).passwort_reset_anfordern("chef@example.de")
    assert antwort == RESET_ANTWORT
    # Entwertung lief: update(...).eq(user).eq(zweck).is_(used_at)
    db.table.return_value.update.return_value.eq.return_value.eq.return_value.is_.assert_any_call(
        "used_at", "null"
    )


# --- Token-Speicherung: nur der Hash ----------------------------------------


def test_in_der_db_liegt_nur_der_hash() -> None:
    # Die zentrale Zusage der Migration: ein DB-Leser bekommt keinen
    # benutzbaren Link.
    nutzer = {
        "id": "u-1", "tenant_id": "t-1",
        "email": "chef@example.de", "full_name": "Chef",
    }
    db = _db(nutzer=nutzer)
    mail = MagicMock(name="mail")
    _service(db, mail).passwort_reset_anfordern("chef@example.de")

    gespeichert = db.table.return_value.insert.call_args.args[0]
    versendet = mail.send.call_args.args[0].text
    klartext = versendet.split("token=")[1].split()[0]

    assert gespeichert["token_hash"] == hash_token(klartext)
    assert klartext not in str(gespeichert)   # nirgends im Klartext
    assert len(klartext) >= 40                # 32 Byte urlsafe ≈ 43 Zeichen


def test_reset_token_traegt_keinen_erfundenen_urheber() -> None:
    # Bei einem Reset ist der Anfordernde nicht angemeldet — eine user_id in
    # created_by wäre eine erfundene Behauptung (Wurzel 4).
    nutzer = {
        "id": "u-1", "tenant_id": "t-1",
        "email": "chef@example.de", "full_name": "Chef",
    }
    db = _db(nutzer=nutzer)
    _service(db).passwort_reset_anfordern("chef@example.de")
    assert db.table.return_value.insert.call_args.args[0]["created_by"] is None


# --- Links: keine erfundene Domain ------------------------------------------


def test_ohne_app_base_url_schlaegt_die_einladung_klar_fehl() -> None:
    # Wurzel 4: lieber ein klarer Konfigurationsfehler als ein Link auf eine
    # geratene Domain.
    svc = EinladungService(
        service_client=_db(), settings=_settings(""), mail=MagicMock()
    )
    with pytest.raises(EinladungError) as exc:
        svc.einladung_versenden(
            user_id="u-1", tenant_id="t-1", email="neu@example.de",
            full_name="Neu", eingeladen_von="admin-1",
        )
    assert exc.value.status_code == 500


def test_einladungslink_zeigt_auf_die_annahmeseite() -> None:
    mail = MagicMock(name="mail")
    _service(_db(), mail).einladung_versenden(
        user_id="u-1", tenant_id="t-1", email="neu@example.de",
        full_name="Neu", eingeladen_von="admin-1", betrieb="Acme",
    )
    text = mail.send.call_args.args[0].text
    assert "https://app.example/einladung?token=" in text
    # Marke: das PMS ist myNextDays, nicht der Marktplatz myBestDays.
    assert "myNextDays" in text
    assert "myBestDays" not in text


def test_resetlink_zeigt_auf_die_passwortseite() -> None:
    nutzer = {
        "id": "u-1", "tenant_id": "t-1",
        "email": "chef@example.de", "full_name": "Chef",
    }
    mail = MagicMock(name="mail")
    _service(_db(nutzer=nutzer), mail).passwort_reset_anfordern("chef@example.de")
    assert "https://app.example/passwort-neu?token=" in mail.send.call_args.args[0].text


def test_einladung_mailfehler_nimmt_den_token_zurueck() -> None:
    # Wie beim Reset: kein Versand → kein offener Token. Der Aufrufer
    # (AuthService.invite) rollt daraufhin die ganze Anlage zurück.
    db = _db()
    mail = MagicMock(name="mail")
    mail.send.side_effect = MailError("SMTP tot")
    with pytest.raises(EinladungError):
        _service(db, mail).einladung_versenden(
            user_id="u-1", tenant_id="t-1", email="neu@example.de",
            full_name="Neu", eingeladen_von="admin-1",
        )
    db.table.return_value.update.return_value.eq.return_value.eq.return_value.is_.assert_any_call(
        "used_at", "null"
    )


def test_erneut_senden_entwertet_den_alten_link() -> None:
    # Sonst wüchse mit jedem Klick auf „erneut senden" die Zahl gültiger
    # Zugänge zu demselben Konto (Wurzel 1).
    db = _db()
    mail = MagicMock(name="mail")
    _service(db, mail).einladung_erneut_senden(
        user_id="u-1", tenant_id="t-1", email="neu@example.de",
        full_name="Neu", eingeladen_von="admin-1",
    )
    db.table.return_value.update.return_value.eq.return_value.eq.return_value.is_.assert_any_call(
        "used_at", "null"
    )
    mail.send.assert_called_once()


def test_erneut_senden_hat_eine_sperrfrist() -> None:
    db = _db(letzte_anfrage=_zeit(timedelta(seconds=-5)))
    mail = MagicMock(name="mail")
    with pytest.raises(EinladungError) as exc:
        _service(db, mail).einladung_erneut_senden(
            user_id="u-1", tenant_id="t-1", email="neu@example.de",
            full_name="Neu", eingeladen_von="admin-1",
        )
    assert exc.value.status_code == 429
    mail.send.assert_not_called()
