"""Schemas des taxpayer-Slice (Airbnb „Konto → Steuern → Steuerzahler").

Die Validierung sitzt hier UND als CHECK in der DB (0226) — doppelt bewusst:
Pydantic liefert dem Nutzer eine sprechende Meldung, der DB-Constraint schuetzt
auch Schreibpfade, die nicht durch dieses Schema laufen.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator, model_validator


class TaxpayerKind(StrEnum):
    INDIVIDUAL = "individual"
    ENTITY = "entity"


class TaxpayerBase(BaseModel):
    """Gemeinsame Felder. Welche davon Pflicht sind, entscheidet `kind`."""

    country: str = Field(min_length=2, max_length=2)
    kind: TaxpayerKind
    tin: str | None = None

    # natuerliche Person
    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: date | None = None
    birth_place_city: str | None = None
    birth_place_country: str | None = Field(default=None, min_length=2, max_length=2)

    # Rechtstraeger
    legal_name: str | None = None
    business_registration_number: str | None = None

    # Anschrift
    address_line1: str | None = None
    address_line2: str | None = None
    postal_code: str | None = None
    city: str | None = None

    @field_validator("country", "birth_place_country")
    @classmethod
    def _laenderkuerzel_gross(cls, v: str | None) -> str | None:
        return v.upper() if v else v

    @field_validator("tin")
    @classmethod
    def _tin_normalisieren(cls, v: str | None) -> str | None:
        """Leerzeichen/Bindestriche raus — Behoerden schreiben sie
        unterschiedlich, gemeldet wird die reine Nummer."""
        if not v:
            return None
        gesaeubert = "".join(v.split()).replace("-", "").replace(".", "")
        return gesaeubert.upper() or None

    @model_validator(mode="after")
    def _pflichtfelder_je_art(self) -> TaxpayerBase:
        """Spiegelt die DB-Constraints aus 0226 mit lesbaren Meldungen."""
        if self.kind is TaxpayerKind.INDIVIDUAL:
            fehlt = [
                name
                for name, wert in (
                    ("Vorname", self.first_name),
                    ("Nachname", self.last_name),
                    ("Geburtsdatum", self.date_of_birth),
                )
                if not wert
            ]
            if fehlt:
                msg = f"Für eine natürliche Person fehlt: {', '.join(fehlt)}."
                raise ValueError(msg)
        elif not self.legal_name:
            msg = "Für ein Unternehmen ist der Firmenname Pflicht."
            raise ValueError(msg)

        # DAC7 laesst den Geburtsort als Ersatz zu, wenn das Land keine
        # Steuer-ID an Privatpersonen vergibt — aber nur dort.
        if not self.tin:
            if self.kind is TaxpayerKind.ENTITY:
                msg = "Für ein Unternehmen ist die Steuernummer Pflicht."
                raise ValueError(msg)
            if not (self.birth_place_city and self.birth_place_country):
                msg = (
                    "Ohne Steueridentifikationsnummer sind Geburtsort und "
                    "Geburtsland Pflicht."
                )
                raise ValueError(msg)
        return self


class TaxpayerCreate(TaxpayerBase):
    """Anlegen oder Ersetzen des Eintrags für ein Land."""


class TaxpayerEntry(TaxpayerBase):
    """Ein gespeicherter Eintrag."""

    id: str
    confirmed_at: datetime | None = None
    updated_at: datetime | None = None


class LandRegelAusgabe(BaseModel):
    """Was fuer ein Land gilt — steuert, welche Felder der Wizard zeigt.

    Ohne diese Angaben muesste das Frontend Steuerrecht kennen. Es soll es
    aber NICHT kennen: eine zweite Kopie der Regeln im Client liefe
    auseinander (Wurzel 4), und die Saetze sind geldwirksam.
    """

    country: str
    regime: str
    reporting_authority: str | None = None
    # Welche Identifikatoren dieses Land erwartet (tin/ssn/rfc/pan …).
    # Leer = keiner, dann zeigt der Wizard das Feld gar nicht erst.
    required_ids: list[str] = []
    # Nur im OECD-Raum: Geburtsort darf die fehlende Steuer-ID ersetzen.
    birthplace_substitutes_id: bool = False
    # Ob fuer dieses Land ueberhaupt Steuerangaben erhoben werden.
    erhebt_steuerangaben: bool = True
    # Die Erhebung der Personen-ID ist rechtlich UNZULAESSIG (CH, JP).
    id_erhebung_verboten: bool = False
    # Quellensteuer in Basispunkten (0,1 % = 10) — geldwirksam, darum
    # sichtbar: der Gastgeber soll wissen, was ihn eine fehlende ID kostet.
    host_tax_bps_with_id: int | None = None
    host_tax_bps_without_id: int | None = None
    legal_basis: str | None = None
    notes: str | None = None


class ObjektAngabe(BaseModel):
    """Die erfassbare Angabe je Objekt nach § 14 Abs. 4 Nr. 6 PStTG.

    Es ist bewusst nur EINE: Anschrift (Nr. 1) steht schon am Objekt, Nr. 2/3/5
    werden aus den Buchungen gerechnet und Nr. 4 aus dem Objekttyp abgeleitet.
    Genau dieselbe Aufteilung nutzen Airbnb und Booking — Steuerdaten am Konto,
    Grundbuchnummer am Objekt.
    """

    land_registration_number: str | None = Field(default=None, max_length=200)
    # Der Gastgeber erklaert, dass es fuer dieses Objekt keine Nummer gibt.
    # Ohne dieses Feld waeren „noch nicht gefragt" und „gefragt, gibt es nicht"
    # nicht unterscheidbar — und die Erhebung nicht belegbar.
    land_registration_unavailable: bool = False

    @field_validator("land_registration_number")
    @classmethod
    def _nummer_normalisieren(cls, v: str | None) -> str | None:
        return (v or "").strip() or None

    @model_validator(mode="after")
    def _kein_widerspruch(self) -> ObjektAngabe:
        """Spiegelt den DB-CHECK aus 0228 mit einer lesbaren Meldung."""
        if self.land_registration_unavailable and self.land_registration_number:
            msg = (
                "Entweder eine Grundbuchnummer angeben oder erklären, dass "
                "keine existiert — nicht beides."
            )
            raise ValueError(msg)
        return self


class ObjektAngabeStatus(ObjektAngabe):
    """Der gespeicherte Stand eines Objekts, für die Übersicht."""

    property_id: str
    title: str | None = None
    city: str | None = None
    country: str | None = None
    # BFE-Nummer: die daenische Kennung der Immobilie. Sie wird in der
    # Objektkartei gepflegt und ist fuer eine daenische DAC7-Meldung die
    # massgebliche Objektkennung (RS_ACT_DK_REAL_PROP_REG_NUM) — die
    # Matrikelnummer daneben ist ein anderes Feld.
    bfe_number: str | None = None
    confirmed_at: datetime | None = None

    @property
    def erledigt(self) -> bool:
        """Erhoben ist erhoben — auch wenn das Ergebnis „keine Nummer" war.

        Die BFE-Nummer zaehlt mit: Ein daenisches Objekt wird ueber sie
        gemeldet (RS_ACT_DK_REAL_PROP_REG_NUM), nicht ueber die
        Matrikelnummer. Ohne diesen Zweig galten 18 vollstaendig gepflegte
        Objekte als „ohne Angabe", weil nur `land_registration_number` und
        das Bestaetigungsdatum geprueft wurden — beide sind in Daenemark
        nicht die massgebliche Kennung.
        """
        return bool(
            self.bfe_number
            or self.land_registration_number
            or self.land_registration_unavailable
        )


class TaxpayerOverview(BaseModel):
    """Die Sicht für den Steuern-Tab.

    `fehlende_laender` sind Länder, in denen der Betrieb Objekte hat, für die
    aber noch keine Steuerangaben vorliegen — genau die, die nach DAC7 fehlen.
    Sie werden aus den Objekten abgeleitet, nicht geraten (Wurzel 4).
    """

    eintraege: list[TaxpayerEntry]
    fehlende_laender: list[str]
    vat_id: str | None = None
    # Objekte, für die die Grundbuchnummer noch nicht erhoben wurde (§ 14
    # Abs. 4 Nr. 6). KEIN Mangel im Rechtssinn — die Angabe ist nur „sofern
    # vorhanden" —, aber der Betreiber muss die Erhebung belegen können.
    objekte_ohne_angabe: int = 0


class MeldeeinheitAusgabe(BaseModel):
    """Eine inserierte Immobilieneinheit nach § 6 Abs. 7 PStTG.

    Fasst alle Objekte an derselben Anschrift mit demselben Eigentümer zu
    EINER Meldeeinheit zusammen. Ein Hotel mit zwölf Zimmern erscheint hier
    einmal — das Datenmodell (1 property = 1 buchbare Einheit) bleibt davon
    unberührt, die Zusammenfassung existiert nur für die Meldung.
    """

    # Nr. 1 — Pflicht
    anschrift: str
    country: str | None = None
    # Welche Objekte in dieser Einheit aufgehen (Nachvollziehbarkeit).
    property_ids: list[str]
    # Nr. 4 / Nr. 6 — „sofern vorhanden"
    art: str | None = None
    land_registration_number: str | None = None
    # Nr. 2 — Pflicht, je Quartal (Schlüssel 1..4)
    verguetung_je_quartal: dict[int, Decimal]
    verguetung_gesamt: Decimal
    # Nr. 3 / Nr. 5
    anzahl_taetigkeiten: int
    vermietete_tage: int
    currency: str | None = None
    # False = Pflichtangabe fehlt (Anschrift oder Währung). Sichtbar machen
    # statt still melden: eine unvollständige Meldung ist bußgeldbewehrt
    # (§ 25 Abs. 1 Nr. 6).
    meldefaehig: bool


class MeldeUebersicht(BaseModel):
    """Der Meldedatensatz eines Kalenderjahres (§ 6 Abs. 6: Meldezeitraum)."""

    jahr: int
    einheiten: list[MeldeeinheitAusgabe]
    # Einheiten, denen eine Pflichtangabe fehlt — die Arbeitsliste vor der
    # Meldung zum 31. Januar (§ 13 Abs. 1).
    nicht_meldefaehig: int = 0
