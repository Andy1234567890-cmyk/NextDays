"""Schemas des Eigentümer-Chats (0611, ADR-0029).

Alle Inhaltsfelder sind base64-Zeichenketten, keine Texte: der Server bekommt
Chiffretext und gibt Chiffretext zurück. Wo hier `str` steht, wo man `str`
erwartet, ist trotzdem nichts lesbar.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class GeraetAufgabe(BaseModel):
    """Die Zufallsaufgabe, die das Gerät signieren muss."""

    aufgabe: str


class GeraetRegistrieren(BaseModel):
    # X25519, base64 — für dieses Gerät werden Inhaltsschlüssel verpackt.
    public_key: str = Field(min_length=1, max_length=256)
    # Ed25519, base64 — belegt den Besitz des privaten Teils.
    signing_key: str = Field(min_length=1, max_length=256)
    signatur: str = Field(min_length=1, max_length=256)
    geraet_name: str = Field(min_length=1, max_length=80)


class GeraetInfo(BaseModel):
    id: str
    geraet_name: str
    seite: str
    gesperrt_am: str | None = None
    zuletzt_aktiv: str | None = None
    created_at: str | None = None


class GeraetListe(BaseModel):
    items: list[GeraetInfo] = []


class EmpfaengerGeraet(BaseModel):
    """Ein Gerät, für das der Absender verschlüsseln muss.

    Der Server stellt diese Liste — der Client darf sie nicht selbst
    bestimmen (Wurzel 3), sonst schriebe er ein fremdes Gerät hinein.
    """

    device_id: str
    public_key: str
    seite: str


class EmpfaengerListe(BaseModel):
    """Die Geräte, für die eine Nachricht verschlüsselt werden muss.

    KEIN Stand-/Versionsfeld: Hier stand eines, samt Kommentar über eine
    Optimierung, die nie gebaut wurde — das API lieferte immer `null`. Der
    beschriebene Schutz greift ohnehin schon: Kommt zwischen dem Abholen
    dieser Liste und dem Senden ein Gerät dazu, fehlt sein Schlüssel, und
    `kern._schluessel_pruefen` antwortet mit 409. Dafür braucht es keinen
    zweiten Mechanismus.
    """

    items: list[EmpfaengerGeraet] = []


class NachrichtSenden(BaseModel):
    # Chiffretext, base64. Leer erlaubt, wenn Bilder dabei sind.
    chiffre: str = Field(default="", max_length=100_000)
    # device_id → verpackter Inhaltsschlüssel (base64). Für JEDES Gerät des
    # Empfängerkreises muss einer dabei sein, sonst 409.
    schluessel: dict[str, str] = {}
    # Pfade im privaten Bucket `owner-chat`, vorher per Upload-Endpunkt belegt.
    bilder: list[str] = []
    # Öffentlicher Schlüssel des sendenden Geräts — der Empfänger braucht ihn,
    # um den verpackten Schlüssel zu öffnen.
    sender_key: str = ""


class ChatNachricht(BaseModel):
    id: str
    sender: str            # 'owner' | 'agency'
    sender_name: str
    # Chiffretext — die Oberfläche entschlüsselt ihn auf dem Gerät.
    chiffre: str
    # Öffentlicher Schlüssel des SENDENDEN Geräts. Ohne ihn kann der Empfänger
    # das gemeinsame Geheimnis nicht bilden und die Nachricht NICHT öffnen —
    # er gehört deshalb an jede Nachricht, nicht in eine separate Abfrage.
    # Öffentlich im Wortsinn: er verrät nichts, er ist der halbe Handschlag.
    sender_key: str | None = None
    # Der für DAS ANFRAGENDE GERÄT verpackte Inhaltsschlüssel. Fehlt er, ist
    # die Nachricht für dieses Gerät nicht lesbar (älter als das Gerät) — die
    # Oberfläche zeigt dann einen Hinweis statt einer leeren Blase.
    wrapped_key: str | None = None
    # Gegen WELCHEN öffentlichen Schlüssel `wrapped_key` zu öffnen ist (0614).
    # `None` = gegen `sender_key`, den Normalfall. Gesetzt nach einer
    # Freigabe, bei der ein drittes Gerät neu verpackt hat.
    wrapper_key: str | None = None
    bilder: list[str] = []
    sent_at: str | None = None


class ChatVerlauf(BaseModel):
    thread_id: str
    property_id: str
    property_title: str | None = None
    items: list[ChatNachricht] = []
    # Nachrichten, die dieses Gerät nicht öffnen kann. Ehrlich benannt statt
    # stumm weggelassen — sonst wirkte der Verlauf lückenlos, obwohl er es
    # nicht ist (Wurzel 5).
    nicht_lesbar: int = 0


class ChatFaden(BaseModel):
    thread_id: str
    property_id: str
    property_title: str | None = None
    last_message_at: str | None = None
    ungelesen: bool = False


class ChatFadenListe(BaseModel):
    items: list[ChatFaden] = []


class BildAdresse(BaseModel):
    """Kurzlebige signierte Adresse eines abgelegten Bildes."""

    url: str


class BildHochgeladen(BaseModel):
    pfad: str
    # Kurzlebige Adresse zum Anzeigen; der Bucket ist privat.
    url: str


class FreigabeOffen(BaseModel):
    message_id: str
    chiffre: str


class FreigabeOffenListe(BaseModel):
    items: list[FreigabeOffen] = []


class FreigabeSenden(BaseModel):
    device_id: str
    # message_id → neu verpackter Schlüssel.
    schluessel: dict[str, str] = {}
    # Öffentlicher Schlüssel des GERÄTS, das neu verpackt hat (0614). Ohne ihn
    # kann das Zielgerät die nachgetragenen Schlüssel nicht öffnen — es wüsste
    # nicht, gegen wen.
    wrapper_key: str = ""


class FreigabeErgebnis(BaseModel):
    nachgetragen: int


class WiederherstellungAblegen(BaseModel):
    wrapped_identity: str = Field(min_length=1, max_length=4096)
    kdf_params: dict


class WiederherstellungInfo(BaseModel):
    wrapped_identity: str
    kdf_params: dict
