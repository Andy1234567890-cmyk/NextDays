"""Pydantic-Schemas für den property_dossier-Slice (8-stufige Objektkartei,
Lastenheft §6).

i18n: Enum-artige Felder tragen SPRACHNEUTRALE Keys (z. B. service_type
'caretaker', trade 'electrician') — die Labels leben im Frontend (next-intl).
Kein deutsches/dänisches Wort als Wert.

Stufe 1 liefert den Eigentümer READ-ONLY aus dem verknüpften owners-Datensatz
(owner_properties); die Kartei erfasst KEINE Eigentümer-Stammdaten selbst.
"""

from datetime import date, datetime

from pydantic import BaseModel, Field


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"


# --- Stufe 1: verknüpfter Eigentümer (READ-ONLY aus owners) ------------------
class LinkedOwner(BaseModel):
    """Read-only-Sicht des via owner_properties verknüpften Eigentümers. Die
    Bearbeitung passiert im owners-Slice (/eigentuemer), nicht hier."""

    owner_id: str
    name: str
    company: str | None = None
    email: str | None = None
    phone: str | None = None
    iban: str | None = None
    bic: str | None = None
    bank_name: str | None = None
    account_holder: str | None = None
    # Dänische Bankverbindung (0581): Reg.-Nr. + Konto-Nr. neben IBAN/BIC.
    bank_reg_nr: str | None = None
    bank_konto_nr: str | None = None
    tax_id: str | None = None
    vat_id: str | None = None
    cpr_number: str | None = None
    ownership_share: float | None = None


# --- Stufe 2: Proces & Kontrakt (1:1) ---------------------------------------
class ProcessData(BaseModel):
    first_meeting_at: date | None = None
    contract_sent_at: date | None = None
    contract_signed_at: date | None = None
    onboarding_invoice_sent_at: date | None = None
    onboarding_invoice_paid_at: date | None = None


# --- Stufe 3: Adgang & Teknik (1:1) — nur was NICHT im Gastmodul liegt -------
class AccessData(BaseModel):
    key_status: str | None = None  # Key: agency_extra | owner_only
    key_placement: str | None = None


# --- Stufe 4: Serviceaftaler (1:n) ------------------------------------------
class ServiceAgreementBase(BaseModel):
    service_type: str  # Key: caretaker | window_cleaning | ...
    frequency: str | None = None
    price: float | None = None
    currency: str | None = None  # aus den Daten, kein Default (Wurzel 4)
    notes: str | None = None


class ServiceAgreementResponse(ServiceAgreementBase):
    id: str


# --- Stufe 5: Håndværkere (1:n) + Vollmacht (1:1) ---------------------------
class TradespersonBase(BaseModel):
    trade: str  # Key: electrician | plumbing | ...
    name: str | None = None
    phone: str | None = None
    notes: str | None = None


class TradespersonResponse(TradespersonBase):
    id: str


class EmergencyAuthority(BaseModel):
    authority_mode: str | None = None  # Key: up_to_amount | always_owner
    authority_limit: float | None = None
    currency: str | None = None


# --- Stufe 6: Markedsføring (1:1) -------------------------------------------
class MarketingData(BaseModel):
    photographer_booked_at: date | None = None
    media_received_at: date | None = None
    site_walkthrough_at: date | None = None
    defects_list_sent_at: date | None = None


# --- Stufe 7: Husmappe (1:1) — nur Status, Texte liegen in messaging ---------
class HousebookData(BaseModel):
    welcome_text_status: str | None = None  # Key: received | open
    physical_folder_placed: bool = False
    # Geheimtipps des Eigentümers (0582) — Onboarding-Notiz der Agentur, aus
    # der später der Gasttext im Nachrichten-Bereich entsteht. Harte Obergrenze
    # statt unbegrenztem Freitext (Wurzel 8).
    secret_tips: str | None = Field(default=None, max_length=5000)


# --- Stufe 8: Annoncering — Plattform-Matrix (1:n) --------------------------
class PlatformLaunchBase(BaseModel):
    platform: str  # Key: native | airbnb | booking | vrbo
    launch_at: date | None = None
    status: str | None = None


class PlatformLaunchResponse(PlatformLaunchBase):
    id: str


# --- Aggregat für Übersicht/PDF ---------------------------------------------
class DossierFull(BaseModel):
    owner: LinkedOwner | None = None  # None = kein Eigentümer zugeordnet
    process: ProcessData
    access: AccessData
    service_agreements: list[ServiceAgreementResponse]
    tradespeople: list[TradespersonResponse]
    emergency_authority: EmergencyAuthority
    marketing: MarketingData
    housebook: HousebookData
    platform_launches: list[PlatformLaunchResponse]


# --- Digitale Mappe: PDFs mit Auswertung (0619) -----------------------------
class MappeDokument(BaseModel):
    """Ein abgelegtes PDF, wie es die Mappe zeigt.

    Ohne `datei_pfad`: der Ablageort im privaten Bucket geht die Oberfläche
    nichts an, sie holt sich eine kurzlebige signierte Adresse über den
    eigenen Endpunkt. Ein Pfad in der Antwort wäre eine Einladung, ihn
    anderswo einzusetzen.
    """

    id: str
    mappe: str  # gast | haus
    datei_name: str
    datei_groesse_bytes: int
    # None = nicht ermittelt, NICHT „eine Seite" (Wurzel 4).
    seiten: int | None = None
    # offen | gelesen | uebernommen | ohne_treffer | fehler
    auswertung: str
    auswertung_hinweis: str | None = None
    ausgewertet_am: datetime | None = None
    created_at: datetime


class MappeVorschlag(BaseModel):
    """Ein erkannter Wert — VORGESCHLAGEN, nicht gespeichert."""

    key: str = Field(max_length=100)
    # Klartext des Feldes, damit die Liste ohne zweite Übersetzungstabelle
    # lesbar ist.
    titel: str = Field(default="", max_length=200)
    wert: str = Field(max_length=5000)
    # Wie gut das Modell lesen konnte: hoch | mittel | niedrig. None = das
    # Modell hat sich nicht geäussert — kein geratenes „hoch".
    sicher: str | None = None
    # Wo im Dokument es steht. Damit ein Mensch nachschlagen kann, statt dem
    # Vorschlag glauben zu müssen.
    fundstelle: str | None = Field(default=None, max_length=200)
    # Türcode, WLAN-Passwort: falsch übernommen fällt es dem GAST auf, nicht
    # dem Betrieb. In der Liste vorab NICHT angehakt.
    heikel: bool = False


class MappeDokumentVorschau(BaseModel):
    """Antwort nach dem Hochladen: die Datei plus was darin gefunden wurde."""

    dokument: MappeDokument
    # Sprache des Dokuments (de|en|da); None = nicht erkannt. Sie schlägt die
    # Sprachfassung vor, in die geschrieben wird.
    sprache: str | None = None
    seiten: int | None = None
    items: list[MappeVorschlag] = Field(default_factory=list)


class MappeUebernahmeRequest(BaseModel):
    """Was der Mensch bestätigt hat."""

    dokument_id: str
    # In welche Sprachfassung der Gästemappe geschrieben wird. Übersetzt wird
    # NICHT — eine maschinell nebenbei erzeugte zweite Fassung wäre ein Text,
    # den niemand gelesen hat.
    sprache: str = Field(default="de", max_length=5)
    items: list[MappeVorschlag] = Field(default_factory=list)
    # Standard: nur LEERE Felder füllen. Ein gepflegter Türcode ist die
    # Wahrheit des Betriebs; ihn wegen eines alten PDFs zu ersetzen wäre
    # Datenverlust ohne Rückfrage (Wurzel 1).
    ueberschreiben: bool = False


class MappeUebernahmeErgebnis(BaseModel):
    """Was wirklich geschrieben wurde — und was nicht.

    Beides benannt: „3 übernommen" allein liesse offen, warum das WLAN-Feld
    unverändert blieb. Die Oberfläche kann so sagen, dass ein Feld schon
    gepflegt war.
    """

    gesetzt: list[str] = Field(default_factory=list)
    uebersprungen: list[str] = Field(default_factory=list)
    ueberschrieben: bool = False


class MappeFeldInfo(BaseModel):
    """Ein Feld des Katalogs, für die Oberfläche."""

    key: str
    titel: str
    heikel: bool = False


# --- Inventarliste je Objekt (0620) -----------------------------------------
class InventarRaum(BaseModel):
    """Ein Raum als Gliederung — die Reihenfolge des Rundgangs."""

    id: str
    name: str = Field(max_length=120)
    sortierung: int = 0


class InventarRaumInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    sortierung: int = 0


class InventarGegenstand(BaseModel):
    """Ein Gegenstand der Liste.

    SOLL und IST getrennt: bei einer Inventur ist genau die Differenz die
    Aussage. `soll_menge = None` heisst „kein Soll hinterlegt", nicht „null
    Stück" (Wurzel 4).
    """

    id: str
    name: str = Field(max_length=300)
    room_id: str | None = None
    ist_menge: int = 0
    soll_menge: int | None = None
    beschreibung: str | None = None
    # manuell | dokument — woher die Zeile kam.
    quelle: str = "manuell"
    # Letzte Sichtprüfung; None = nie geprüft, NICHT „heute geprüft".
    geprueft_am: datetime | None = None

    # --- was eine INVENTUR ausmacht (0623) ---
    # bestand | verbrauch — ein Sofa und Spülmittel sind nicht dasselbe.
    art: str = "bestand"
    # Guestys „par level": Unterschreitung löst eine Nachfüll-Aufgabe aus.
    # None = nicht gepflegt, NICHT 0 („melde nie").
    meldebestand: int | None = None
    # jede_abreise | quartal | jaehrlich | nie
    zaehl_rhythmus: str = "jaehrlich"
    zuletzt_gezaehlt_am: datetime | None = None
    # neu | gut | abgenutzt | ersatz_faellig — für die Ersatzplanung,
    # unabhängig vom Schaden.
    zustand: str = "gut"
    zustand_notiz: str | None = None
    # Ob ein Bild des INTAKTEN Zustands hinterlegt ist. Nur das Ja/Nein: den
    # Ablagepfad braucht die Oberfläche nicht, sie holt eine signierte
    # Adresse über den eigenen Endpunkt.
    hat_referenz_foto: bool = False
    angeschafft_am: date | None = None
    anschaffungswert: float | None = None
    anschaffung_currency: str | None = None


class InventarGegenstandInput(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    room_id: str | None = None
    ist_menge: int | None = Field(default=None, ge=0)
    soll_menge: int | None = Field(default=None, ge=0)
    beschreibung: str | None = Field(default=None, max_length=2000)
    art: str | None = Field(default=None, pattern="^(bestand|verbrauch)$")
    meldebestand: int | None = Field(default=None, ge=0)
    zaehl_rhythmus: str | None = Field(
        default=None, pattern="^(jede_abreise|quartal|jaehrlich|nie)$"
    )
    zustand: str | None = Field(
        default=None, pattern="^(neu|gut|abgenutzt|ersatz_faellig)$"
    )


class InventarAnlegenRequest(BaseModel):
    """Mehrere Zeilen auf einmal — von Hand oder aus einem bestätigten PDF."""

    eintraege: list[InventarGegenstandInput] = Field(default_factory=list)
    # Bei „dokument": aus welchem PDF sie stammen.
    dokument_id: str | None = None


class InventarAendernRequest(BaseModel):
    """Nur die mitgegebenen Felder ändern — ein weggelassenes bleibt, wie es
    ist. Deshalb durchgehend optional statt eines vollen Objekts, das ein
    fehlendes Feld auf null setzen würde (Wurzel 1)."""

    name: str | None = Field(default=None, max_length=300)
    room_id: str | None = None
    ist_menge: int | None = Field(default=None, ge=0)
    soll_menge: int | None = Field(default=None, ge=0)
    beschreibung: str | None = Field(default=None, max_length=2000)
    # true = beim Rundgang gesichtet. Setzt `geprueft_am` auf jetzt.
    geprueft: bool = False
    art: str | None = Field(default=None, pattern="^(bestand|verbrauch)$")
    meldebestand: int | None = Field(default=None, ge=0)
    zaehl_rhythmus: str | None = Field(
        default=None, pattern="^(jede_abreise|quartal|jaehrlich|nie)$"
    )
    zustand: str | None = Field(
        default=None, pattern="^(neu|gut|abgenutzt|ersatz_faellig)$"
    )
    zustand_notiz: str | None = Field(default=None, max_length=500)
    angeschafft_am: date | None = None
    # Die Währung setzt der Server aus dem Objekt — sie mitzugeben hiesse,
    # dem Client eine Angabe zu erlauben, die er nicht verantworten kann
    # (Wurzel 4).
    anschaffungswert: float | None = Field(default=None, ge=0)


class InventarSchaden(BaseModel):
    """Ein gemeldeter Schaden. Eigene Zeile je Vorfall."""

    id: str
    item_id: str | None = None
    # Name zum Zeitpunkt der Meldung — bleibt, auch wenn der Gegenstand aus
    # der Liste genommen wird.
    item_name: str
    # beschaedigt | fehlt | entsorgt
    art: str
    beschreibung: str | None = None
    menge: int = 1
    # offen | eigentuemer | gast | betrieb — beim Melden gewählt.
    traeger: str = "offen"
    # gemeldet | bestaetigt | abgerechnet | verworfen
    status: str = "gemeldet"
    # None, solange niemand den Preis kennt. Keine 0 als Platzhalter.
    betrag: float | None = None
    currency: str | None = None
    gemeldet_am: datetime
    bestaetigt_am: datetime | None = None
    owner_expense_id: str | None = None
    task_id: str | None = None
    foto_ids: list[str] = Field(default_factory=list)


class SchadenBestaetigung(BaseModel):
    """Betrag und Träger festlegen — löst Aufgabe und Posten aus."""

    betrag: float = Field(ge=0)
    # `offen` ist hier NICHT erlaubt: ohne Träger kein Posten.
    traeger: str = Field(pattern="^(eigentuemer|gast|betrieb)$")
    # Bei `entsorgt` gibt es nichts zu reparieren — dann bleibt es aus.
    aufgabe_anlegen: bool = True
