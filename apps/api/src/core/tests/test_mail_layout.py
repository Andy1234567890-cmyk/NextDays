"""Tests für core/mail_layout.py (das gemeinsame Layout aller Mails).

Schwerpunkte sind die Wurzeln, nicht die Optik:
- W4: Firmendaten kommen aus der Konfiguration. Fehlen sie, entfällt die Zeile
  bzw. der Mangel wird benannt — es entsteht NIE eine erfundene Adresse.
- W8: alles Eingesetzte wird escaped, Link-Ziele gegen eine Schema-Allowlist
  geprüft (fail-closed).
Dazu die Zusagen, auf die sich die Absender verlassen: Text und HTML tragen
dieselben Aussagen, und die Mail bleibt ohne Bilder vollständig.
"""
import pytest

from src.core.config import Settings
from src.core.mail_layout import (
    LOGO_CID,
    Aktion,
    MailInhalt,
    MailLayoutError,
    Marke,
    mail_rendern,
    marke_bestdays,
    marke_nextdays,
)
from src.core.mail_texte import text

_FIRMA = {
    "company_legal_name": "myNextDays ApS",
    "company_legal_form": "Anpartsselskab (ApS) dänischen Rechts",
    "company_street": "Hirtshalsvej 21",
    "company_city": "9881 Bindslev",
    "company_country": "Dänemark",
    "company_registration_number": "46615182",
    "company_contact_email": "info@mynextdays.dk",
    "company_contact_phone": "+45 43 16 70 40",
    # Marktplatz = myBestDays und der läuft unter .dk (DanDomain). `.com` gehört
    # uns NICHT (GoDaddy-Fremddomain, am 17.08.2026 nachgemessen).
    "marketing_base_url": "https://www.mynextdays.com",
    "marketplace_base_url": "https://www.mybestdays.dk",
}


def _settings(**over: object) -> Settings:
    base: dict[str, object] = dict(_FIRMA)
    base.update(over)
    return Settings(**base)  # type: ignore[arg-type]


def _inhalt(**over: object) -> MailInhalt:
    base: dict[str, object] = {
        "titel": "Dein Zugang",
        "absaetze": ["Ein Betrieb hat dir einen Zugang eingerichtet."],
        "aktion": Aktion(text="Passwort setzen", url="https://app.example/x?token=a"),
    }
    base.update(over)
    return MailInhalt(**base)  # type: ignore[arg-type]


# -- Grundaufbau ------------------------------------------------------------


def test_rendert_beide_darstellungen() -> None:
    """Eine Quelle, zwei Fassungen — die Textfassung ist kein Notnagel."""
    mail = mail_rendern(_inhalt(), settings=_settings())
    assert "<!DOCTYPE html>" in mail.html
    assert "Dein Zugang" in mail.text
    assert "Ein Betrieb hat dir einen Zugang eingerichtet." in mail.text


def test_link_steht_auch_im_klartext() -> None:
    """Der Button ist in der Textfassung nicht klickbar — die URL muss stehen.

    Und auch im HTML zusätzlich als Klartext: Clients, die den Button ohne
    Hintergrund zeigen, machen ihn sonst unsichtbar.
    """
    mail = mail_rendern(_inhalt(), settings=_settings())
    assert "https://app.example/x?token=a" in mail.text
    assert mail.html.count("https://app.example/x?token=a") >= 2


def test_mail_bleibt_ohne_bilder_vollstaendig() -> None:
    """Kein Inhalt darf nur im Logo stecken (blockierte Bilder sind Alltag)."""
    mail = mail_rendern(_inhalt(), settings=_settings())
    assert 'alt="myNextDays"' in mail.html
    # Die Kernaussage steht als Text, nicht in einer Grafik.
    assert "Ein Betrieb hat dir einen Zugang eingerichtet." in mail.html


def test_layout_ist_tabellenbasiert_mit_inline_styles() -> None:
    """Outlook rendert mit der Word-Engine: kein Flex/Grid, keine Kaskade."""
    mail = mail_rendern(_inhalt(), settings=_settings())
    assert 'role="presentation"' in mail.html
    assert "style=" in mail.html
    assert "display:flex" not in mail.html
    assert "display:grid" not in mail.html


# -- W4: Firmendaten aus der Konfiguration ----------------------------------


def test_fusszeile_traegt_die_pflichtangaben_aus_der_konfiguration() -> None:
    """Firma, Rechtsform, Sitz, CVR und Kontakt kommen aus den Settings."""
    mail = mail_rendern(_inhalt(), settings=_settings())
    for teil in ("myNextDays ApS", "Hirtshalsvej 21", "9881 Bindslev", "Dänemark"):
        assert teil in mail.html
        assert teil in mail.text
    assert "CVR-nr. 46615182" in mail.html
    assert "info@mynextdays.dk" in mail.html


def test_ohne_firmendaten_wird_nichts_erfunden() -> None:
    """Fehlt die Firmierung, benennt die Fußzeile den Mangel (W4).

    Weder Adresse noch Registernummer dürfen als plausibler Ersatzwert
    auftauchen — ein leerer Fuß sähe zudem nach Absicht aus.
    """
    mail = mail_rendern(_inhalt(), settings=_settings(company_legal_name=""))
    assert "COMPANY_LEGAL_NAME" in mail.html
    assert "Hirtshalsvej" not in mail.html
    assert "CVR" not in mail.html


def test_fehlende_ust_id_entfaellt_statt_erfunden_zu_werden() -> None:
    """Die Momsnummer gibt es erst mit der Registrierung — sonst keine Zeile."""
    mail = mail_rendern(_inhalt(), settings=_settings())
    assert "CVR-nr. 46615182" in mail.html
    assert "USt-IdNr." not in mail.html


def test_vorhandene_ust_id_wird_ausgewiesen() -> None:
    mail = mail_rendern(
        _inhalt(), settings=_settings(company_vat_id="DK46615182")
    )
    assert "USt-IdNr. DK46615182" in mail.html


def test_logo_reist_als_cid_anhang_mit() -> None:
    """Das Bild haengt IN der Mail — keine URL, kein erreichbarer Host noetig.

    Der erste Bau nutzte eine gehostete URL; live (08.08.2026) blieb in Apple
    Mail ein leerer Rahmen (die damals gemessene Adresse trug ein
    selbstsigniertes Zertifikat), und lokal/Staging gibt es ueberhaupt keine
    oeffentliche Adresse — eine URL kann dort nie funktionieren.
    """
    mail = mail_rendern(_inhalt(), settings=_settings())
    assert f'src="cid:{LOGO_CID}"' in mail.html
    assert "https://www.mynextdays.com/marketing" not in mail.html
    # Der Anhang muss mitgegeben werden, sonst zeigt der cid:-Verweis ins Leere.
    assert mail.inline_bilder[LOGO_CID].is_file()


def test_logo_hat_feste_masse_und_lesbaren_alt_text() -> None:
    """Ohne Breite skaliert Apple Mail auf die native Groesse (~1470 px).

    Der `alt`-Text steht bei blockierten Bildern auf der schwarzen Kopfflaeche
    und braucht deshalb eine helle Farbe.
    """
    mail = mail_rendern(_inhalt(), settings=_settings())
    assert 'width="180"' in mail.html
    assert "width:180px" in mail.html
    assert "color:#ffffff" in mail.html


def test_ohne_logodatei_bleibt_der_markenname_als_text() -> None:
    """Ein fehlendes Logo darf keine Einladung verhindern (fail-soft)."""
    ohne = Marke(name="myNextDays", logo_datei=None, website_url="")
    mail = mail_rendern(_inhalt(), marke=ohne, settings=_settings())
    assert "<img" not in mail.html
    assert "myNextDays" in mail.html
    assert mail.inline_bilder == {}


# -- W8: Escaping und Link-Prüfung ------------------------------------------


def test_nutzername_mit_markup_ergibt_keine_injektion() -> None:
    """Ein Name `<script>` wird Text, nicht Code."""
    mail = mail_rendern(
        _inhalt(titel="Hallo <script>alert(1)</script>,"), settings=_settings()
    )
    assert "<script>" not in mail.html
    assert "&lt;script&gt;" in mail.html


def test_freitext_wird_escaped() -> None:
    mail = mail_rendern(
        _inhalt(absaetze=["Objekt <b>Haus</b> & Co"]), settings=_settings()
    )
    assert "<b>Haus</b>" not in mail.html
    assert "&lt;b&gt;" in mail.html
    assert "&amp;" in mail.html


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "file:///etc/passwd",
        "kein-schema",
    ],
)
def test_unerlaubtes_link_schema_wird_abgewiesen(url: str) -> None:
    """Fail-closed: lieber keine Mail als eine mit gefährlichem Ziel (W8)."""
    with pytest.raises(MailLayoutError):
        mail_rendern(
            _inhalt(aktion=Aktion(text="Klick", url=url)), settings=_settings()
        )


def test_abmeldelink_wird_ebenfalls_geprueft() -> None:
    with pytest.raises(MailLayoutError):
        mail_rendern(
            _inhalt(abmelde_url="javascript:alert(1)"), settings=_settings()
        )


# -- Marketing vs. transaktional --------------------------------------------


@pytest.mark.parametrize("sprache", ["de", "en", "fr", "da"])
def test_transaktionale_mail_hat_keinen_abmeldelink(sprache: str) -> None:
    """Von einer Einladung kann sich niemand abmelden — kein Link dorthin.

    Das erwartete Wort kommt aus dem KATALOG, nicht als deutsches Literal:
    eine Mail an einen Franzosen trägt „Se désabonner". Ein hart deutsches
    „Abmelden" im Test würde in jeder anderen Sprache stillschweigend
    durchgehen — der Test hätte dann genau das nicht mehr geprüft, wofür er da
    ist. Über mehrere Sprachen, weil ein einzelner Durchlauf nicht zeigt, dass
    das Layout überhaupt übersetzt.
    """
    mail = mail_rendern(_inhalt(sprache=sprache), settings=_settings())
    wort = text("layout.abmelden", sprache)
    assert wort not in mail.html
    assert wort not in mail.text


@pytest.mark.parametrize("sprache", ["de", "en", "fr", "da"])
def test_marketing_mail_traegt_den_abmeldelink(sprache: str) -> None:
    """Der Abmeldelink steht in der Sprache des Empfängers (Art. 13 DSGVO).

    Ein Abmeldehinweis, den der Empfänger nicht lesen kann, ist kein
    Abmeldehinweis — deshalb wird hier gegen den Katalogtext der jeweiligen
    Sprache geprüft und nicht gegen ein deutsches Wort.
    """
    mail = mail_rendern(
        _inhalt(
            sprache=sprache,
            abmelde_url="https://www.mynextdays.com/abmelden?t=x",
        ),
        settings=_settings(),
    )
    assert text("layout.abmelden", sprache) in mail.html
    assert "https://www.mynextdays.com/abmelden?t=x" in mail.text


# -- Marken -----------------------------------------------------------------


def test_marke_bestdays_nutzt_marktplatz_logo_und_name() -> None:
    """Gast-Mails sind myBestDays, nicht myNextDays (Marken-Grenze).

    Die beiden Marken legen ihre Logos UNTERSCHIEDLICH ab (myBestDays im Paket
    unter `src/core/assets/`, myNextDays unter `marketing/brand/`) — deshalb wird
    hier die real angehaengte Datei geprueft, nicht nur der Name.
    """
    s = _settings()
    mail = mail_rendern(_inhalt(), marke=marke_bestdays(s), settings=s)
    assert 'alt="myBestDays"' in mail.html
    angehaengt = mail.inline_bilder[LOGO_CID]
    assert angehaengt.name == "mybestdays-logo-light.png"
    assert angehaengt.is_file()


def test_beide_marken_haengen_unterschiedliche_dateien_an() -> None:
    """Ein geteilter Pfad waere ein 404 — die Ablagen sind wirklich verschieden."""
    s = _settings()
    assert marke_nextdays(s).logo_datei != marke_bestdays(s).logo_datei


def test_marke_nextdays_ist_die_voreinstellung() -> None:
    s = _settings()
    assert marke_nextdays(s).name == "myNextDays"
    mail = mail_rendern(_inhalt(), settings=s)
    assert 'alt="myNextDays"' in mail.html


# -- Kleinigkeiten mit Wirkung ----------------------------------------------


def test_vorschautext_ist_der_erste_absatz() -> None:
    """Sonst zeigt die Postfach-Liste bei jeder Mail denselben Anfang."""
    mail = mail_rendern(
        _inhalt(absaetze=["Ganz eigener erster Satz."]), settings=_settings()
    )
    assert "Ganz eigener erster Satz." in mail.html


def test_mail_ohne_aktion_rendert_ebenfalls() -> None:
    """Nicht jede Benachrichtigung hat ein Ziel — dann eben kein Button."""
    mail = mail_rendern(_inhalt(aktion=None), settings=_settings())
    assert "<!DOCTYPE html>" in mail.html
    assert "Falls der Button nicht funktioniert" not in mail.html


def test_hinweise_erscheinen_in_beiden_fassungen() -> None:
    mail = mail_rendern(
        _inhalt(hinweise=["Der Link ist 7 Tage gültig."]), settings=_settings()
    )
    assert "Der Link ist 7 Tage gültig." in mail.html
    assert "Der Link ist 7 Tage gültig." in mail.text
