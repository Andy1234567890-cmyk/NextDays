"""Firmendaten des Betriebs für seine Kunden-Website.

Warum ein eigenes Modul und nicht weiter im Service: der Service war bei 1512
Zeilen und damit über der Grenze, die `pylint` hier setzt (1500). Der Schnitt ist
aber nicht nur eine Zeilenzählung — diese Funktionen sind die EINE Stelle, an der
die Website Daten aus dem KONTO liest (``tenant_billing_profile``, ``tenants``).
Alles andere im Service arbeitet auf den Site-Tabellen.

Der Grundsatz dahinter: Firmenname, Logo, E-Mail, Telefon und Anschrift pflegt
der Betrieb unter Konto → Profil. Sie im Baukasten ein zweites Mal einzutragen
wäre nicht nur Arbeit, sondern eine zweite Wahrheit — wer umzieht, ändert die
Adresse an einer Stelle und wundert sich, dass die Fußzeile die alte zeigt.
Deshalb wird hier abgeleitet, nicht kopiert.
"""

from __future__ import annotations

from supabase import Client


def firmendaten(db: Client, tenant_id: str) -> dict[str, str | None]:
    """Name, Logo und Kontaktdaten des Betriebs, wie sie im Konto stehen.

    Quelle ist ``tenant_billing_profile`` (dort pflegt der Betrieb seine
    Firmendaten für Rechnungen) plus ``tenants.name``. Gelesen werden NUR die
    Felder, die auf einer öffentlichen Website ohnehin erscheinen — dieselbe
    Tabelle trägt daneben IBAN, Steuernummer und Stripe-Kennungen, und die
    haben auf einer Gästeseite nichts zu suchen.

    Fehlt eine Angabe, bleibt sie ``None``: es wird nichts erfunden und
    nichts aus einem anderen Feld abgeleitet (Wurzel 4)."""
    firma = (
        db.table("tenant_billing_profile")
        .select(
            "legal_name, company_logo_url, email, phone_number, "
            "company_street, company_house_number, company_postal_code, "
            "company_city, company_country"
        )
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    f = firma[0] if firma else {}
    betrieb = (
        db.table("tenants")
        .select("name")
        .eq("id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    # `tenants.name` ist der Name, unter dem der Betrieb auftritt;
    # `legal_name` die Firmierung („… GmbH"). Für eine Website passt der
    # erste besser, deshalb zuerst.
    name = (betrieb[0].get("name") if betrieb else None) or f.get("legal_name")

    strasse = " ".join(
        teil
        for teil in (f.get("company_street"), f.get("company_house_number"))
        if teil
    ).strip()
    ort = " ".join(
        teil
        for teil in (f.get("company_postal_code"), f.get("company_city"))
        if teil
    ).strip()
    # Nur aus den Teilen, die WIRKLICH da sind — eine Zeile „None None"
    # wäre schlechter als keine Anschrift.
    #
    # Und keine Dubletten: in der Praxis stehen in `company_city` oft schon
    # Region und Land mit („Bindslev, Nordjylland, Denmark"), während
    # `company_country` „DK" trägt. Ohne diese Prüfung stünde auf der
    # Kundenseite „… Denmark" und darunter noch einmal „DK".
    land = (f.get("company_country") or "").strip()
    # Ein zweibuchstabiges Länderkürzel („DK") ist keine Adresszeile. Es
    # steht im Konto für Rechnungen und Portale; auf einer Gästeseite liest
    # sich „9881 Bindslev" ohne Zusatz richtig, „DK" darunter falsch.
    # Ausgeschrieben („Denmark") kommt das Land mit — sofern es nicht schon
    # im Ort steht, wie es bei diesem Feld häufig der Fall ist.
    if len(land) <= 2:
        land = ""
    zeilen: list[str] = []
    for teil in (strasse, ort, land):
        if not teil:
            continue
        schon_da = any(
            teil.casefold() in vorhanden.casefold() for vorhanden in zeilen
        )
        if not schon_da:
            zeilen.append(teil)

    return {
        "site_name": name or None,
        "logo_url": f.get("company_logo_url") or None,
        "email": f.get("email") or None,
        "phone": f.get("phone_number") or None,
        "address": "\n".join(zeilen) or None,
    }


def kontakt_mit_firmendaten(
    inhalt: dict,
    firma: dict[str, str | None],
    *,
    nur_leere: bool = False,
) -> dict:
    """Kontaktdaten aus dem Konto in einen Kontakt-Abschnitt setzen.

    `nur_leere=True` füllt nur, was noch nicht gesetzt ist — für einen NEU
    angelegten Abschnitt, in dem der Kunde vielleicht schon selbst etwas
    eingetragen hat.

    `nur_leere=False` überschreibt die Beispielwerte einer Vorlage
    (`…@bergchalet.example`), die auf einer Kundenseite nichts zu suchen
    haben. Fehlt eine Angabe im Konto, bleibt der Beispielwert stehen: er ist
    als Platzhalter erkennbar und damit ehrlicher als ein leeres Feld, in dem
    niemand merkt, dass etwas fehlt."""
    out = dict(inhalt)
    for feld in ("email", "phone"):
        if firma.get(feld) and not (nur_leere and out.get(feld)):
            out[feld] = firma[feld]
    if firma.get("address") and not (nur_leere and out.get("address")):
        # Anschrift ist eine Locale-Map; die Adresse ist in jeder Sprache
        # dieselbe, steht also unter allen bereits gepflegten Sprachen.
        sprachen = list((inhalt.get("address") or {}).keys()) or ["de"]
        out["address"] = {s: firma["address"] for s in sprachen}
    return out


def firmen_schema_daten(db: Client, tenant_id: str) -> dict[str, str | None]:
    """Anschrift des Betriebs in EINZELTEILEN — für strukturierte Daten (0430).

    ``firmendaten`` liefert die Anschrift als fertige, mehrzeilige Adresszeile;
    das ist richtig für eine Fußzeile und falsch für JSON-LD. Schema.org
    verlangt eine ``PostalAddress`` mit getrennten Feldern (``streetAddress``,
    ``postalCode``, ``addressLocality``, ``addressCountry``) — eine
    zusammengeklebte Zeile dort einzusetzen ist der Fehler, den Googles
    Testwerkzeug als „unstrukturiert" zurückmeldet.

    Deshalb eine zweite Funktion statt eines Schalters an der ersten: die zwei
    Aufrufer wollen wirklich Verschiedenes, und ein `zerlegt=True` würde beiden
    Rückgabetypen dieselbe Signatur aufzwingen.

    Das Länderkürzel bleibt hier ERHALTEN, anders als in ``firmendaten``: „DK"
    liest sich in einer Adresszeile falsch, ist aber genau das, was Schema.org
    für ``addressCountry`` erwartet (ISO 3166-1 alpha-2).

    Fehlt eine Angabe, bleibt sie ``None`` — der Aufrufer lässt das Feld dann
    im Schema weg statt eine Anschrift zu erfinden (Wurzel 4)."""
    firma = (
        db.table("tenant_billing_profile")
        .select(
            "legal_name, email, phone_number, company_street, "
            "company_house_number, company_postal_code, company_city, "
            "company_country"
        )
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    f = firma[0] if firma else {}
    betrieb = (
        db.table("tenants")
        .select("name")
        .eq("id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    name = (betrieb[0].get("name") if betrieb else None) or f.get("legal_name")

    strasse = " ".join(
        teil
        for teil in (f.get("company_street"), f.get("company_house_number"))
        if teil
    ).strip()

    def wert(schluessel: str) -> str | None:
        roh = (f.get(schluessel) or "").strip()
        return roh or None

    return {
        "name": name or None,
        "street": strasse or None,
        "postal_code": wert("company_postal_code"),
        "city": wert("company_city"),
        "country": wert("company_country"),
        "phone": wert("phone_number"),
        "email": wert("email"),
    }
