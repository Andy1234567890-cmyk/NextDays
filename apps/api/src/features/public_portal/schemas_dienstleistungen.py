"""Schemas fuer die Eigentuemer-Dienstleistungen (Etappe D).

Eigene Datei neben `schemas.py`: der Auftrag ist ein eigener Schreibpfad, und
die Feldgrenzen (Wurzel 8) gehoeren dorthin, wo sie gelesen werden.

Die harten Grenzen hier sind keine Kosmetik: `freitext` und `notiz` landen in
`tasks.title`/`tasks.description` und damit in Listen, Kalendern und
Benachrichtigungen. Ohne Obergrenze koennte ein Client megabytegrosse Titel
einstellen (Wurzel 8 — jeder unbegrenzte Bereich bekommt eine Grenze → 422).
"""
from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

# Ein Aufgaben-Titel, der in eine Zeile passt. Grosszuegig genug fuer einen
# echten Satz, klein genug fuer Liste und Kalenderbalken.
MAX_FREITEXT = 200
# Die Notiz darf ausfuehrlicher sein (Zugang, Besonderheiten), bleibt aber
# begrenzt.
MAX_NOTIZ = 2000


def _ohne_steuerzeichen(wert: str) -> str:
    """Steuerzeichen entfernen (ausser Zeilenumbruch/Tab).

    Der Text geht in Mail-Betreffs und SMS. Ein eingeschmuggeltes CR/LF koennte
    dort eine Kopfzeile faelschen (Header-Injection) — deshalb faellt es hier
    heraus, beim SPEICHERN, nicht erst bei der Anzeige (Wurzel 8).
    """
    return "".join(c for c in wert if c == "\n" or c == "\t" or c >= " ")


class ServiceTypeItem(BaseModel):
    """Ein beauftragbarer Leistungstyp.

    KEIN `name`: der Anzeigename kommt aus den Message-Katalogen
    (`services.type.<key>`), nicht aus der Datenbank. Ein deutsches Wort hier
    waere in 23 der 24 Sprachen falsch (Wurzel 4).
    """

    id: str
    key: str
    kategorie: str
    standard_dauer_minuten: int | None = None
    # True = Systemvorgabe (fuer alle Betriebe), False = eigener Typ.
    system: bool = False


class ServiceTypeList(BaseModel):
    items: list[ServiceTypeItem]
    total: int


class ServiceRequestCreate(BaseModel):
    """Eine Dienstleistung beauftragen.

    Entweder `service_type_id` (Katalog) ODER `freitext` — nie beides, nie
    keines. Zwei Wege in einem Feld zu vermischen („freitext gewinnt") waere
    eine stille Annahme; hier ist es eine 422.
    """

    property_id: str
    service_type_id: str | None = None
    freitext: str | None = Field(default=None, max_length=MAX_FREITEXT)
    datum: date
    # Optionales Ende fuer mehrtaegige Arbeiten (z. B. Aussenanstrich).
    datum_bis: date | None = None
    notiz: str | None = Field(default=None, max_length=MAX_NOTIZ)

    @field_validator("freitext", "notiz")
    @classmethod
    def _saeubern(cls, v: str | None) -> str | None:
        if v is None:
            return None
        sauber = _ohne_steuerzeichen(v).strip()
        return sauber or None

    @field_validator("property_id", "service_type_id")
    @classmethod
    def _muss_uuid_sein(cls, v: str | None) -> str | None:
        """Beide IDs gehen in `.eq("id", ...)` gegen Postgres-uuid-Spalten.

        Ein Nicht-UUID-Wert („abc") liefe bis zur DB durch und wuerfe dort
        22P02 → ein angreifergesteuerter 500 statt einer sauberen Ablehnung
        (Wurzel 8: Fehl-Input darf keinen 500 werfen). Als Validator hier
        wird daraus ein 422, bevor der Service ueberhaupt laeuft.
        """
        if v is None:
            return None
        try:
            UUID(str(v))
        except (ValueError, AttributeError, TypeError) as exc:
            msg = "Ungültige ID."
            raise ValueError(msg) from exc
        return v

    @model_validator(mode="after")
    def _genau_ein_weg(self) -> ServiceRequestCreate:
        hat_typ = bool(self.service_type_id)
        hat_text = bool(self.freitext)
        if hat_typ == hat_text:
            msg = (
                "Entweder eine Leistung aus dem Katalog (service_type_id) "
                "oder eine eigene Beschreibung (freitext) angeben."
            )
            raise ValueError(msg)
        return self


class ServiceRequestItem(BaseModel):
    """Ein beauftragter Auftrag in der Sicht des Eigentuemers.

    Was hier bewusst FEHLT (§4.3 Datensplit): wer den Auftrag ausfuehrt.
    `zugewiesen` sagt nur, OB jemand dran ist — der Personaleinsatz des
    Betriebs geht den Eigentuemer nichts an. Ebenso wenig Kosten: ein
    beauftragter Auftrag traegt hier keinen Preis.
    """

    id: str
    property_id: str | None
    service_type_id: str | None
    # Katalog-Schluessel fuer die Uebersetzung; None bei Freitext-Auftraegen.
    service_key: str | None = None
    titel: str
    notiz: str | None = None
    status: str
    zugewiesen: bool = False
    start_at: date | None = None
    created_at: str | None = None


class ServiceRequestList(BaseModel):
    items: list[ServiceRequestItem]
    total: int
